// =============================================================================
// ControlManager.cpp - E2: AUTO/MANUAL logic, control loops, range alarms
// =============================================================================
#include "e2_core/ControlManager.h"            // this module's interface

#include <Arduino.h>                           // millis
#include <math.h>                              // lroundf

#include "config.h"                            // control constants
#include "types.h"                             // shared data types
#include "logger.h"                            // LOGI/LOGW
#include "e2_core/SystemState.h"               // snapshots, mode, alarms, command queue
#include "e2_core/OutputManager.h"             // output requests
#include "e2_core/SensorManager.h"             // pH calibration
#include "e2_core/StorageManager.h"            // setpoint persistence
#include "e2_core/PidController.h"             // pump flow PID

namespace {                                    // private to this file

constexpr const char* TAG = "CONTROL";         // log tag
constexpr uint32_t ONE_HOUR_MS = 3600UL * 1000UL; // dose-rate window

enum class DoseState : uint8_t { Idle, Waiting }; // pH dosing state machine

PidController g_pid(cfg::pump::PID_KP, cfg::pump::PID_KI, cfg::pump::PID_KD, // gains
                    static_cast<float>(cfg::pump::MIN_DUTY), 100.0f);        // output range, %

uint32_t g_lastCycleMs = 0;                    // previous cycle time (PID dt)
uint32_t g_pidHoldUntilMs = 0;                 // boot hold at 60 % ends at this time
uint8_t g_autoPumpDuty = cfg::pump::BOOT_DUTY; // last AUTO pump duty

uint8_t g_manualPumpDuty = cfg::pump::BOOT_DUTY; // MANUAL pump duty from the phone
bool g_manualAerator = true;                   // MANUAL aerator state from the phone
uint32_t g_manualSinceMs = 0;                  // last manual action (30 min timeout)
uint32_t g_aerOffSinceMs = 0;                  // when MANUAL switched the air pump off (10 min limit)

bool g_heaterOn = false;                       // hysteresis memory

DoseState g_doseState = DoseState::Idle;       // dosing state
uint32_t g_doseWaitUntilMs = 0;                // no new dose before this time
uint32_t g_doseTimes[cfg::dosing::MAX_DOSES_PER_HOUR] = {}; // recent dose times (ring)
uint8_t g_doseIndex = 0;                       // next ring slot
uint8_t g_doseCount = 0;                       // used ring slots

bool g_noFlowTiming = false;                   // pump runs without flow: timer started
uint32_t g_noFlowSinceMs = 0;                  // when the dry condition began

// ---- small helpers ----------------------------------------------------------

bool reached(uint32_t now, uint32_t deadline) {// wrap-safe "now >= deadline"
  return static_cast<int32_t>(now - deadline) >= 0;
}

bool doseAllowed(uint32_t now) {               // fewer than MAX doses in the last hour?
  uint8_t recent = 0;                          // doses inside the window
  for (uint8_t i = 0; i < g_doseCount; ++i) {  // check stored dose times
    if (now - g_doseTimes[i] < ONE_HOUR_MS) {  // inside the last hour
      ++recent;                                // count it
    }
  }
  return recent < cfg::dosing::MAX_DOSES_PER_HOUR; // under the limit?
}

void holdDosing(uint32_t now, uint32_t waitMs) { // forbid dosing for a while
  g_doseWaitUntilMs = now + waitMs;            // end of the wait
  g_doseState = DoseState::Waiting;            // switch state
}

void recordDose(uint32_t now) {                // remember a dose time
  g_doseTimes[g_doseIndex] = now;              // store in the ring
  g_doseIndex = (g_doseIndex + 1) % cfg::dosing::MAX_DOSES_PER_HOUR; // advance
  if (g_doseCount < cfg::dosing::MAX_DOSES_PER_HOUR) ++g_doseCount;  // grow until full
}

void enterAuto(const char* reason) {           // switch to AUTO without a pump jump
  const ActuatorSnapshot act = SystemState::getActuators(); // present output state
  g_autoPumpDuty = act.pumpDuty > 0 ? act.pumpDuty : cfg::pump::BOOT_DUTY; // continue from here
  g_pid.reset(g_autoPumpDuty);                 // bumpless PID start
  g_noFlowTiming = false;                      // give the PID a full delay before judging the flow again
  SystemState::setMode(Mode::Auto);            // publish the mode
  LOGI(TAG, "mode AUTO (%s)", reason);         // report why
}

void enterManual(uint32_t now) {               // switch to MANUAL keeping the outputs as they are
  const ActuatorSnapshot act = SystemState::getActuators(); // present output state
  g_manualPumpDuty = act.pumpDuty;             // start from the current duty
  g_manualAerator = act.aerator;               // and the current aerator state
  g_aerOffSinceMs = now;                       // if it is off, the oxygen limit starts now
  g_manualSinceMs = now;                       // start the 30 min timer
  SystemState::setMode(Mode::Manual);          // publish the mode
  LOGI(TAG, "mode MANUAL (expires in %lu min)", (unsigned long)(cfg::mode::MANUAL_TIMEOUT_MS / 60000UL));
}

// ---- commands from the phone ------------------------------------------------

void handleCommand(const Command& c, uint32_t now) {
  switch (c.type) {                            // dispatch on the command type
    case CommandType::SetOutputs:              // {"cmd":"set",...}
      if (SystemState::getMode() != Mode::Manual) { // only allowed in MANUAL
        LOGW(TAG, "'set' ignored: not in MANUAL");  // the comms layer normally rejects it first
        break;                                 // ignore
      }
      if (c.hasPump) g_manualPumpDuty = c.pumpDuty;   // new pump duty
      if (c.hasAerator) {                      // new aerator state
        if (g_manualAerator && !c.aerator) g_aerOffSinceMs = now; // switched off now: start the oxygen limit
        g_manualAerator = c.aerator;           // apply it
        if (!c.aerator) LOGW(TAG, "air pump OFF: back ON after %lu min at most", (unsigned long)(cfg::mode::AERATOR_MAX_OFF_MS / 60000UL));
      }
      g_manualSinceMs = now;                   // any manual action restarts the timeout
      LOGI(TAG, "manual pump=%u%% aer=%u", g_manualPumpDuty, g_manualAerator ? 1 : 0);
      break;

    case CommandType::SetMode:                 // {"cmd":"mode",...}
      if (c.mode == Mode::Manual) {            // MANUAL requested
        if (SystemState::getMode() == Mode::Manual) { // already manual
          g_manualSinceMs = now;               // just restart the timeout
        } else {                               // coming from AUTO
          enterManual(now);                    // switch
        }
      } else if (SystemState::getMode() != Mode::Auto) { // AUTO requested from MANUAL
        enterAuto("phone");                    // switch back
      }
      break;

    case CommandType::SetSetpoints: {          // {"cmd":"setpoint",...}
      Setpoints sp = SystemState::getSetpoints(); // start from the current targets
      if (c.hasPh) sp.ph = c.ph;               // new pH target (range-checked by the parser)
      if (c.hasTemp) sp.tempC = c.tempC;       // new temperature target
      SystemState::setSetpoints(sp);           // publish
      StorageManager::saveSetpoints(sp);       // persist across reboots
      LOGI(TAG, "setpoints pH=%.2f temp=%.1f", sp.ph, sp.tempC);
      break;
    }

    case CommandType::Calibrate:               // {"cmd":"cal","ph":"7.00"}
      SensorManager::calibratePh(c.calBufferPh); // the sensor module does the work and saves it
      holdDosing(now, cfg::dosing::MIX_WAIT_MS); // the probe is in a buffer: no dose until it has settled again
      break;
  }
}

// ---- alarms owned by the control task ----------------------------------------

void evaluateAlarms(const SensorSnapshot& s, const ActuatorSnapshot& act, uint32_t now) {
  const bool phBad = s.ph.valid && (s.ph.value < cfg::ph::ALARM_LOW || s.ph.value > cfg::ph::ALARM_HIGH); // pH out of band
  SystemState::setAlarm(alarmbit::PH_RANGE, phBad); // publish PH_RANGE

  const bool tBad = s.tempC.valid && (s.tempC.value < cfg::temp::ALARM_LOW || s.tempC.value > cfg::temp::ALARM_HIGH); // temp out of band
  SystemState::setAlarm(alarmbit::TEMP_RANGE, tBad); // publish TEMP_RANGE

  const bool dry = act.pumpDuty >= cfg::pump::MIN_DUTY  // pump is driven...
                && s.flowLpm.valid && s.flowLpm.value < cfg::flow::NO_FLOW_LPM; // ...but nothing flows
  if (dry && !g_noFlowTiming) {                // dry condition just started
    g_noFlowTiming = true;                     // start timing
    g_noFlowSinceMs = now;                     // remember when
  } else if (!dry) {                           // flow is fine (or pump off)
    g_noFlowTiming = false;                    // stop timing
  }
  const bool noFlow = g_noFlowTiming && (now - g_noFlowSinceMs >= cfg::flow::NO_FLOW_DELAY_MS); // long enough?
  const bool wasNoFlow = (SystemState::getAlarms() & alarmbit::NO_FLOW) != 0; // previous state
  if (noFlow && !wasNoFlow) LOGW(TAG, "NO_FLOW: pump at %u%% but flow %.2f L/min", act.pumpDuty, s.flowLpm.value);
  if (!noFlow && wasNoFlow) LOGI(TAG, "flow restored");
  SystemState::setAlarm(alarmbit::NO_FLOW, noFlow); // publish NO_FLOW
}

// ---- individual control loops -----------------------------------------------

void updatePump(Mode mode, const SensorSnapshot& s, uint8_t alarms, uint32_t now, float dtS) {
  if (mode == Mode::Manual) {                  // phone decides
    OutputManager::requestPumpDuty(g_manualPumpDuty);
    return;                                    // done
  }
  const bool hold = !cfg::pump::PID_ENABLED    // PID switched off in config
                 || !reached(now, g_pidHoldUntilMs) // still in the boot hold
                 || !s.flowLpm.valid           // no usable flow measurement
                 || (alarms & (alarmbit::NO_FLOW | alarmbit::LOW_WATER)); // flow loop cannot work now
  if (hold) {                                  // keep the last safe duty
    if (!reached(now, g_pidHoldUntilMs) || !cfg::pump::PID_ENABLED) { // boot hold or fixed-duty mode
      g_autoPumpDuty = cfg::pump::BOOT_DUTY;   // 60 % default
    }
    g_pid.reset(g_autoPumpDuty);               // no integral wind-up while holding
  } else {                                     // closed loop on flow
    g_autoPumpDuty = static_cast<uint8_t>(lroundf(g_pid.update(cfg::flow::SETPOINT_LPM, s.flowLpm.value, dtS)));
  }
  OutputManager::requestPumpDuty(g_autoPumpDuty); // send the request
}

void updateAerator(Mode mode, uint32_t now) {
  if (mode == Mode::Manual && !g_manualAerator && now - g_aerOffSinceMs >= cfg::mode::AERATOR_MAX_OFF_MS) {
    g_manualAerator = true;                    // fish and bacteria need dissolved oxygen (FAO 2014, 4.2.5)
    LOGW(TAG, "air pump back ON: off for %lu min", (unsigned long)(cfg::mode::AERATOR_MAX_OFF_MS / 60000UL));
  }
  OutputManager::requestAerator(mode == Mode::Manual ? g_manualAerator : true); // ON in AUTO
}

void updateHeater(const SensorSnapshot& s, const Setpoints& sp) {
  if (!s.tempC.valid) {                        // no temperature: never heat blind
    g_heaterOn = false;                        // safe state
  } else if (s.tempC.value < sp.tempC - cfg::temp::HYSTERESIS) { // too cold
    g_heaterOn = true;                         // heat
  } else if (s.tempC.value > sp.tempC + cfg::temp::HYSTERESIS) { // warm enough
    g_heaterOn = false;                        // stop heating
  }                                            // inside the band: keep the previous state
  OutputManager::requestHeater(g_heaterOn);    // send the request
}

void updateDosing(Mode mode, const SensorSnapshot& s, const Setpoints& sp, uint8_t alarms, uint32_t now) {
  if (g_doseState == DoseState::Waiting) {     // boot hold, calibration, or waiting for the dose to mix
    if (reached(now, g_doseWaitUntilMs)) {     // waited long enough
      g_doseState = DoseState::Idle;           // ready to re-measure
      LOGI(TAG, "dosing wait over, pH now %.2f", s.ph.value);
    }
    return;                                    // never dose while waiting
  }
  if (mode != Mode::Auto) return;              // dosing is automatic only
  if (alarms & (alarmbit::LOW_WATER | alarmbit::SENSOR_FAULT | alarmbit::NO_FLOW)) return; // unsafe, or no mixing
  if (!s.ph.valid || s.ph.value < cfg::ph::DOSE_MIN_PH) return; // no trustworthy tank pH (probe in a buffer?)
  if (s.ph.value >= sp.ph - cfg::ph::DOSE_DEADBAND) return; // pH high enough
  if (!doseAllowed(now)) return;               // hourly limit reached
  if (OutputManager::requestDosePulse(cfg::dosing::PULSE_MS)) { // one pulse of base solution
    recordDose(now);                           // count it
    holdDosing(now, cfg::dosing::PULSE_MS + cfg::dosing::MIX_WAIT_MS); // pulse, then mix, then re-measure
    LOGI(TAG, "dose %lu ms (pH %.2f < %.2f), waiting %lu s", (unsigned long)cfg::dosing::PULSE_MS,
         s.ph.value, sp.ph - cfg::ph::DOSE_DEADBAND, (unsigned long)(cfg::dosing::MIX_WAIT_MS / 1000UL));
  }
}

// Clamp a stored setpoint to its allowed range (protects against corrupt flash)
float clampf(float v, float lo, float hi, float fallback) {
  return (v >= lo && v <= hi) ? v : fallback;  // out of range -> default
}

}  // namespace

namespace ControlManager {

bool begin() {
  const Setpoints defaults{cfg::ph::SETPOINT_DEFAULT, cfg::temp::SETPOINT_DEFAULT}; // factory targets
  Setpoints sp = StorageManager::loadSetpoints(defaults); // stored targets
  sp.ph = clampf(sp.ph, cfg::ph::SETPOINT_MIN, cfg::ph::SETPOINT_MAX, defaults.ph);           // sanity check
  sp.tempC = clampf(sp.tempC, cfg::temp::SETPOINT_MIN, cfg::temp::SETPOINT_MAX, defaults.tempC); // sanity check
  SystemState::setSetpoints(sp);               // publish
  SystemState::setMode(Mode::Auto);            // boot in AUTO (ICD 4.6)
  g_autoPumpDuty = cfg::pump::BOOT_DUTY;       // boot default duty
  g_pid.reset(g_autoPumpDuty);                 // PID starts at 60 %
  g_lastCycleMs = millis();                    // dt reference
  g_pidHoldUntilMs = g_lastCycleMs + cfg::pump::PID_START_DELAY_MS; // boot hold window
  holdDosing(g_lastCycleMs, cfg::dosing::BOOT_HOLD_MS); // the probe settles first; a reset loop cannot overdose
  LOGI(TAG, "AUTO, setpoints pH=%.2f temp=%.1f, mixing wait %lu s", sp.ph, sp.tempC,
       (unsigned long)(cfg::dosing::MIX_WAIT_MS / 1000UL));
  LOGI(TAG, "flow target %.1f L/min = %.1f turnovers per hour of %.0f L", cfg::flow::SETPOINT_LPM,
       cfg::water::TURNOVERS_PER_H, cfg::water::SYSTEM_VOLUME_L);
  return true;                                 // ready
}

void runCycle() {
  const uint32_t now = millis();               // cycle time
  const float dtS = (now - g_lastCycleMs) / 1000.0f; // seconds since the last cycle
  g_lastCycleMs = now;                         // remember

  Command cmd;                                 // command buffer
  while (SystemState::receiveCommand(cmd, 0)) {// drain every pending command (no waiting)
    handleCommand(cmd, now);                   // apply it
  }

  if (SystemState::getMode() == Mode::Manual && now - g_manualSinceMs >= cfg::mode::MANUAL_TIMEOUT_MS) { // override too old
    enterAuto("manual timeout");               // ICD 4.6: back to AUTO after 30 min
  }

  const SensorSnapshot s = SystemState::getSensors();     // latest measurements
  const ActuatorSnapshot act = SystemState::getActuators(); // real output state
  const Setpoints sp = SystemState::getSetpoints();       // targets
  evaluateAlarms(s, act, now);                 // PH_RANGE, TEMP_RANGE, NO_FLOW

  const uint8_t alarms = SystemState::getAlarms(); // all alarms incl. LOW_WATER and SENSOR_FAULT
  const Mode mode = SystemState::getMode();    // mode after command handling
  updatePump(mode, s, alarms, now, dtS);       // circulation pump
  updateAerator(mode, now);                    // air pump (10 min limit when OFF in MANUAL)
  updateHeater(s, sp);                         // heater demo
  updateDosing(mode, s, sp, alarms, now);      // pH correction
}

}  // namespace ControlManager
