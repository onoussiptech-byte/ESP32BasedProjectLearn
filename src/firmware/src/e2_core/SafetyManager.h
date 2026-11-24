// =============================================================================
// SafetyManager.h - E2: hard protections (safety task, 100 ms, highest priority)
//   Low water     -> pump OFF, dosing OFF, heater OFF, alarm LOW_WATER
//   Sensor fault  -> dosing OFF (other outputs hold their last safe state)
// It also drives the output service tick (pump ramp, LED) every 100 ms.
// =============================================================================
#pragma once                                   // include this header only once

namespace SafetyManager {                      // single-instance module

bool begin();                                  // initial evaluation before the tasks start
void runCycle();                               // safety task body (every 100 ms)

}  // namespace SafetyManager
