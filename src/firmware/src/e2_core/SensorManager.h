// =============================================================================
// SensorManager.h - E2: owns the E1 sensor modules (sensing task, 1 s)
// Calls readPH(), readTempC(), readFlowLpm(), levelOK() (ICD 4.5), detects
// sensor faults and publishes one SensorSnapshot per cycle to SystemState.
// No other module touches a sensor pin.
// =============================================================================
#pragma once                                   // include this header only once

#include "types.h"                             // LevelReading
#include "e1_sensors/PhSensor.h"               // PhSensor::CalResult

namespace SensorManager {                      // single-instance module

bool begin();                                  // start every sensor, load calibrations
void runCycle();                               // sensing task body (every 1 s)
void pollFastInputs();                         // safety task: debounce the float switch (every 100 ms)
LevelReading levelNow();                       // latest debounced float switch state
PhSensor::CalResult calibratePh(float bufferPh); // one pH calibration step, saved to flash

}  // namespace SensorManager
