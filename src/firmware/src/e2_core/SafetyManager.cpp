// =============================================================================
// SafetyManager.cpp - E2: interlocks applied before every output update
// =============================================================================
#include "e2_core/SafetyManager.h"             // this module's interface

#include <Arduino.h>                           // millis

#include "config.h"                            // safety period
#include "types.h"                             // alarm bits
#include "logger.h"                            // LOGI/LOGW
#include "e2_core/SystemState.h"               // alarms
#include "e2_core/SensorManager.h"             // float switch
#include "e2_core/OutputManager.h"             // inhibits and service tick

namespace {                                    // private to this file

constexpr const char* TAG = "SAFETY";          // log tag
uint32_t g_lastMs = 0;                         // previous cycle time
bool g_lowWater = false;                       // previous low-water state (for logging)

}  // namespace

namespace SafetyManager {

bool begin() {
  g_lastMs = millis();                         // elapsed-time reference
  runCycle();                                  // apply interlocks once before the scheduler takes over
  return true;                                 // ready
}

void runCycle() {
  const uint32_t now = millis();               // cycle time
  const uint32_t elapsed = now - g_lastMs;     // time since the last cycle (normally 100 ms)
  g_lastMs = now;                              // remember

  SensorManager::pollFastInputs();             // debounce the float switch
  const LevelReading level = SensorManager::levelNow(); // debounced level
  const bool lowWater = level.valid && !level.value;    // LOW = low water

  if (lowWater != g_lowWater) {                // log transitions only
    if (lowWater) {                            // water dropped
      LOGW(TAG, "LOW_WATER: pump, dosing and heater forced OFF");
    } else {                                   // water back
      LOGI(TAG, "water level OK: pump released");
    }
    g_lowWater = lowWater;                     // remember
  }
  SystemState::setAlarm(alarmbit::LOW_WATER, lowWater); // publish the alarm bit

  const uint8_t alarms = SystemState::getAlarms();      // every active alarm
  const bool sensorFault = (alarms & alarmbit::SENSOR_FAULT) != 0; // from the sensing task

  OutputManager::setPumpInhibit(lowWater);     // dry pump protection
  OutputManager::setDosingInhibit(lowWater || sensorFault); // never dose blind or into a dry tank
  OutputManager::setHeaterInhibit(lowWater);   // never heat a dry element
  OutputManager::setAlarmIndication(alarms != alarmbit::NONE); // fast LED blink on any alarm
  OutputManager::service(elapsed);             // apply everything to the hardware
}

}  // namespace SafetyManager
