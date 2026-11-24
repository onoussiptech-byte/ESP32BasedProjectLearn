// =============================================================================
// RailMonitor.h - P3: auxiliary supply supervision (LM2596 12 V and 5 V rails)
// The rails are pure hardware (laptop adapter -> fuse -> LM2596 bucks). This
// module optionally measures them on the spare ADS1115 channels A2/A3 and
// warns when they leave the P3 acceptance window (12.0 +/- 0.2 V, 5.0 +/- 0.1 V).
// It stays disabled (cfg::rail::MONITOR_ENABLED) until P3 fits the dividers.
// =============================================================================
#pragma once                                   // include this header only once

#include "types.h"                             // SensorReading

class RailMonitor {
 public:
  bool begin();                                // report whether monitoring is enabled
  void sample();                               // measure both rails (call once per sensing cycle)
  SensorReading rail12V() const { return v12_; } // last 12 V rail reading
  SensorReading rail5V() const { return v5_; }   // last 5 V rail reading
  bool healthy() const { return healthy_; }    // true if both rails are in tolerance (or not monitored)

 private:
  SensorReading v12_{0.0f, false};             // 12 V rail
  SensorReading v5_{0.0f, false};              // 5 V rail
  bool healthy_ = true;                        // combined result
};
