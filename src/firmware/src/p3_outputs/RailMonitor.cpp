// =============================================================================
// RailMonitor.cpp - P3: rail voltage check through the shared ADS1115
// =============================================================================
#include "p3_outputs/RailMonitor.h"            // this module's interface

#include <math.h>                              // fabsf

#include "config.h"                            // rail constants and ADC channels
#include "e1_sensors/Ads1115Bus.h"             // shared ADC access
#include "logger.h"                            // LOGI/LOGW

namespace {                                    // private to this file

constexpr const char* TAG = "RAILS";           // log tag

// Read one rail: ADC volts divided by the divider ratio
SensorReading readRail(uint8_t channel, float ratio) {
  float v = 0.0f;                              // ADC voltage
  if (!Ads1115Bus::readVolts(channel, v)) {    // ADC not available
    return SensorReading{0.0f, false};         // invalid
  }
  return SensorReading{v / ratio, true};       // undo the divider
}

}  // namespace

bool RailMonitor::begin() {
  if (!cfg::rail::MONITOR_ENABLED) {           // feature switched off
    LOGI(TAG, "monitoring disabled (no dividers fitted)"); // report it
    return false;                              // nothing to monitor
  }
  LOGI(TAG, "monitoring 12 V on A%u and 5 V on A%u", cfg::ads::CH_RAIL_12V, cfg::ads::CH_RAIL_5V);
  return true;                                 // monitoring active
}

void RailMonitor::sample() {
  if (!cfg::rail::MONITOR_ENABLED) {           // feature switched off
    return;                                    // keep healthy_ = true
  }
  v12_ = readRail(cfg::ads::CH_RAIL_12V, cfg::rail::RATIO_12V); // 12 V rail
  v5_  = readRail(cfg::ads::CH_RAIL_5V, cfg::rail::RATIO_5V);   // 5 V rail
  const bool ok12 = v12_.valid && fabsf(v12_.value - cfg::rail::NOMINAL_12V) <= cfg::rail::TOLERANCE_12V; // 12 V in window
  const bool ok5  = v5_.valid  && fabsf(v5_.value  - cfg::rail::NOMINAL_5V)  <= cfg::rail::TOLERANCE_5V;  // 5 V in window
  const bool nowHealthy = ok12 && ok5;         // both rails fine?
  if (nowHealthy != healthy_) {                // log only state changes
    if (nowHealthy) {                          // recovered
      LOGI(TAG, "rails back in tolerance");    // report recovery
    } else {                                   // went out of tolerance
      LOGW(TAG, "out of tolerance: 12V=%.2f 5V=%.2f", v12_.value, v5_.value); // report values
    }
  }
  healthy_ = nowHealthy;                       // store the result
}
