// =============================================================================
// SimulatedSensors.h - E1: fake pH / temperature / flow for SIM_MODE
// A very small "plant model" that reacts to the real output states, so the
// control loops, the JSON link and the app can be tested without hardware.
// =============================================================================
#pragma once                                   // include this header only once

#include "types.h"                             // SensorReading, ActuatorSnapshot

namespace SimulatedSensors {                   // single-instance module

void begin();                                  // start from typical tank values
void step(const ActuatorSnapshot& outputs, float dtS); // advance the model by dtS seconds
SensorReading readPH();                        // simulated pH
SensorReading readTempC();                     // simulated water temperature
SensorReading readFlowLpm();                   // simulated flow

}  // namespace SimulatedSensors
