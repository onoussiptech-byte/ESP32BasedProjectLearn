// =============================================================================
// OutputManager.cpp - E2: owns the P3 drivers, merges requests with inhibits
// =============================================================================
#include "e2_core/OutputManager.h"             // this module's interface

#include <Arduino.h>                           // millis
#include <atomic>                              // lock-free requests and inhibits

#include "config.h"                            // pump boot duty
#include "logger.h"                            // LOGI
#include "e2_core/SystemState.h"               // publish the actuator snapshot
#include "p3_outputs/PumpDriver.h"             // circulation pump
#include "p3_outputs/AeratorDriver.h"          // air pump
#include "p3_outputs/DosingPumpDriver.h"       // dosing pump
#include "p3_outputs/HeaterDriver.h"           // heater demo
#include "p3_outputs/StatusLed.h"              // status LED

namespace {                                    // private to this file

constexpr const char* TAG = "OUTPUTS";         // log tag

PumpDriver g_pump;                             // MOSFET Q1, PWM
AeratorDriver g_aerator;                       // MOSFET Q2
DosingPumpDriver g_dosing;                     // MOSFET Q3
HeaterDriver g_heater;                         // MOSFET Q4
StatusLed g_led;                               // on-board LED

std::atomic<uint8_t> g_reqPump{0};             // requested pump duty
std::atomic<bool> g_reqAerator{true};          // requested aerator state
std::atomic<bool> g_reqHeater{false};          // requested heater state

std::atomic<bool> g_inhibitPump{false};        // safety: pump must be off
std::atomic<bool> g_inhibitDosing{false};      // safety: dosing forbidden
std::atomic<bool> g_inhibitHeater{false};      // safety: heater must be off

}  // namespace

namespace OutputManager {

bool begin() {
  bool ok = true;                              // overall result
  ok &= g_heater.begin();                      // heater OFF first (largest resistive load)
  ok &= g_dosing.begin();                      // dosing OFF
  ok &= g_aerator.begin();                     // aerator ON: fish need oxygen immediately
  ok &= g_pump.begin();                        // pump PWM ready, still at 0 %
  ok &= g_led.begin();                         // LED steady on during boot
  g_reqPump.store(cfg::pump::BOOT_DUTY);       // boot default: ramp the pump to 60 %
  g_reqAerator.store(true);                    // boot default: aerator ON
  g_reqHeater.store(false);                    // boot default: heater OFF
  SystemState::setActuators(snapshot());       // publish the initial state
  LOGI(TAG, "safe defaults applied (aerator ON, pump -> %u %%, dosing OFF, heater OFF)", cfg::pump::BOOT_DUTY);
  return ok;                                   // tell the caller
}

void requestPumpDuty(uint8_t percent) { g_reqPump.store(percent > 100 ? 100 : percent); } // clamp and store
void requestAerator(bool on) { g_reqAerator.store(on); }   // store the aerator request
void requestHeater(bool on) { g_reqHeater.store(on); }     // store the heater request

bool requestDosePulse(uint32_t durationMs) {
  if (g_inhibitDosing.load()) {                // safety forbids dosing
    return false;                              // refuse
  }
  return g_dosing.startPulse(durationMs);      // the driver enforces its own limits
}

void setPumpInhibit(bool inhibit) { g_inhibitPump.store(inhibit); }     // store pump inhibit
void setDosingInhibit(bool inhibit) { g_inhibitDosing.store(inhibit); } // store dosing inhibit
void setHeaterInhibit(bool inhibit) { g_inhibitHeater.store(inhibit); } // store heater inhibit

void setAlarmIndication(bool alarm) {
  g_led.setPattern(alarm ? StatusLed::Pattern::Alarm : StatusLed::Pattern::Normal); // fast or slow blink
}

void service(uint32_t elapsedMs) {
  // ---- Pump: an inhibit stops it at once, otherwise ramp toward the request
  if (g_inhibitPump.load()) {                  // low water or other hard stop
    if (g_pump.duty() != 0 || g_pump.target() != 0) { // still running?
      g_pump.forceOff();                       // stop immediately, no ramp
    }
  } else {                                     // normal operation
    g_pump.setTarget(g_reqPump.load());        // follow the controller
    g_pump.service(elapsedMs);                 // soft-start ramp step
  }

  // ---- Aerator: follows the request (hardware bypass covers firmware faults)
  g_aerator.set(g_reqAerator.load());          // apply the aerator request

  // ---- Dosing: stop a running pulse as soon as dosing is inhibited
  if (g_inhibitDosing.load() && g_dosing.isActive()) { // inhibited while pumping
    g_dosing.stop();                           // stop now
    LOGI(TAG, "dosing stopped by safety");     // report it
  }

  // ---- Heater: request AND not inhibited
  g_heater.set(g_reqHeater.load() && !g_inhibitHeater.load()); // apply the heater state

  // ---- Status LED and published state
  g_led.service(millis());                     // advance the blink pattern
  SystemState::setActuators(snapshot());       // publish what the hardware really does
}

ActuatorSnapshot snapshot() {
  return ActuatorSnapshot{g_pump.duty(),        // applied pump duty
                          g_aerator.isOn(),     // aerator state
                          g_dosing.isActive(),  // dosing state
                          g_heater.isOn()};     // heater state
}

}  // namespace OutputManager
