// =============================================================================
// ControlManager.h - E2: control loops and phone commands (control task, 1 s)
//   Pump     : AUTO = PID on flow (after a boot hold at 60 %), MANUAL = phone duty
//   Heater   : on/off with +/-0.5 deg C hysteresis
//   pH       : dose one pulse of base, wait for mixing, re-measure (never continuous)
//   Aerator  : ON in AUTO, phone-controlled in MANUAL
//   Manual override expires after 30 min and returns to AUTO (ICD 4.6).
// =============================================================================
#pragma once                                   // include this header only once

namespace ControlManager {                     // single-instance module

bool begin();                                  // load setpoints, start in AUTO with boot defaults
void runCycle();                               // control task body (every 1 s)

}  // namespace ControlManager
