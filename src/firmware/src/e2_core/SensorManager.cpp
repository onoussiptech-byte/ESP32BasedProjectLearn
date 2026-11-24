// =============================================================================
// SensorManager.cpp - E2: measurement cycle, fault detection, SIM_MODE switch
// =============================================================================
#include "e2_core/SensorManager.h"             // this module's interface

#include <Arduino.h>                           // millis, FreeRTOS semaphores

#include "config.h"                            // fault and compensation constants
#include "logger.h"                            // LOGI/LOGW
#include "e2_core/SystemState.h"               // publish snapshots and alarms
#include "e2_core/StorageManager.h"            // calibration persistence
#include "e1_sensors/Ads1115Bus.h"             // shared ADC
#include "e1_sensors/PhSensor.h"               // pH
#include "e1_sensors/TemperatureSensor.h"      // DS18B20
#include "e1_sensors/FlowSensor.h"             // YF-S201
#include "e1_sensors/LevelSwitch.h"            // float switch
#include "e1_sensors/SimulatedSensors.h"       // SIM_MODE plant model
#include "p3_outputs/RailMonitor.h"            // optional 12 V / 5 V rail check

namespace {                                    // private to this file

constexpr const char* TAG = "SENSORS";         // log tag

PhSensor g_ph;                                 // pH channel
TemperatureSensor g_temp;                      // water temperature
FlowSensor g_flow;                             // flow rate
LevelSwitch g_level;                           // low-water switch
RailMonitor g_rails;                           // auxiliary supply monitor

SemaphoreHandle_t g_phMutex = nullptr;         // pH object is used by sensing and control tasks
uint8_t g_phBadCycles = 0;                     // consecutive invalid pH readings
uint8_t g_tempBadCycles = 0;                   // consecutive invalid temperature readings
uint32_t g_lastCycleMs = 0;                    // previous cycle time (SIM_MODE dt)

// Count consecutive bad cycles, saturating at 255
uint8_t countBad(uint8_t counter, bool valid) {
  if (valid) return 0;                         // good reading resets the counter
  return counter < 255 ? counter + 1 : counter;// one more bad cycle
}

}  // namespace

namespace SensorManager {

bool begin() {
  g_phMutex = xSemaphoreCreateMutex();         // protects g_ph
  Ads1115Bus::begin();                         // I2C + ADS1115 (pH falls back to ADC1 if missing)
  g_ph.begin(StorageManager::loadPhCalibration(PhSensor::defaultCalibration())); // stored calibration
  g_temp.begin();                              // DS18B20
  g_flow.begin(StorageManager::loadFlowPulsesPerLitre(cfg::flow::PULSES_PER_LITRE)); // stored flow constant
  g_level.begin();                             // float switch
  g_rails.begin();                             // rail monitor (disabled by default)
#if SIM_SENSORS                                // plant-model build
  SimulatedSensors::begin();                   // fake pH/temp/flow model
  LOGW(TAG, "SIM_MODE: pH, temperature and flow are simulated"); // make it obvious in the log
#endif                                         // end of SIM_MODE
  g_lastCycleMs = millis();                    // first SIM_MODE time step reference
  return g_phMutex != nullptr;                 // ready if the mutex exists
}

void runCycle() {
  SensorSnapshot s{};                          // new snapshot
  const uint32_t now = millis();               // cycle time

#if SIM_SENSORS                                // ---- simulated sensors ----
  const float dtS = (now - g_lastCycleMs) / 1000.0f; // seconds since the last cycle
  SimulatedSensors::step(SystemState::getActuators(), dtS); // plant reacts to the real outputs
  s.tempC = SimulatedSensors::readTempC();     // fake temperature
  s.ph = SimulatedSensors::readPH();           // fake pH
  s.flowLpm = SimulatedSensors::readFlowLpm(); // fake flow
#else                                          // ---- real sensors ----
  s.tempC = g_temp.readTempC();                // temperature first: pH needs it
  const float compC = s.tempC.valid ? s.tempC.value : cfg::ph::COMPENSATION_FALLBACK_C; // compensation temp
  if (xSemaphoreTake(g_phMutex, pdMS_TO_TICKS(200)) == pdTRUE) { // lock the pH object
    s.ph = g_ph.readPH(compC);                 // filtered, compensated pH
    xSemaphoreGive(g_phMutex);                 // unlock
  } else {                                     // calibration is using it right now
    s.ph = SensorReading{SystemState::getSensors().ph.value, false}; // skip one cycle
  }
  s.flowLpm = g_flow.readFlowLpm();            // average flow over the last second
#endif                                         // end of sensor source selection
  g_lastCycleMs = now;                         // remember this cycle

  s.levelOk = g_level.levelOK();               // debounced float switch (real in both modes)
  s.timestampMs = now;                         // when the snapshot was taken

  // ---- Sensor fault detection: N bad cycles in a row raises SENSOR_FAULT
  g_phBadCycles = countBad(g_phBadCycles, s.ph.valid);       // pH health
  g_tempBadCycles = countBad(g_tempBadCycles, s.tempC.valid);// temperature health
  const bool fault = g_phBadCycles >= cfg::fault::INVALID_CYCLES
                  || g_tempBadCycles >= cfg::fault::INVALID_CYCLES; // either sensor down
  const bool wasFault = (SystemState::getAlarms() & alarmbit::SENSOR_FAULT) != 0; // previous state
  if (fault != wasFault) {                     // log only transitions
    if (fault) {                               // fault appeared
      LOGW(TAG, "SENSOR_FAULT (pH %s, temp %s)", s.ph.valid ? "ok" : "bad", s.tempC.valid ? "ok" : "bad");
    } else {                                   // fault cleared
      LOGI(TAG, "sensors recovered");          // report recovery
    }
  }
  SystemState::setAlarm(alarmbit::SENSOR_FAULT, fault); // publish the alarm bit
  SystemState::setSensors(s);                  // publish the snapshot

  g_rails.sample();                            // auxiliary supply check (no-op when disabled)
}

void pollFastInputs() {
  g_level.update();                            // 100 ms debounce step
}

LevelReading levelNow() {
  return g_level.levelOK();                    // lock-free read
}

PhSensor::CalResult calibratePh(float bufferPh) {
  const SensorReading t = SystemState::getSensors().tempC; // buffer temperature
  const float tempC = t.valid ? t.value : cfg::ph::COMPENSATION_FALLBACK_C; // fallback if no probe
  PhSensor::CalResult r = PhSensor::CalResult::ReadError; // pessimistic default
  if (xSemaphoreTake(g_phMutex, pdMS_TO_TICKS(500)) == pdTRUE) { // lock the pH object
    r = g_ph.calibrate(bufferPh, tempC);       // perform the step
    if (r == PhSensor::CalResult::PointStored || r == PhSensor::CalResult::Complete) { // something changed
      StorageManager::savePhCalibration(g_ph.calibration()); // persist it
    }
    xSemaphoreGive(g_phMutex);                 // unlock
  }
  LOGI(TAG, "pH calibration %.2f: %s", bufferPh, PhSensor::calResultText(r)); // report the outcome
  return r;                                    // tell the caller
}

}  // namespace SensorManager
