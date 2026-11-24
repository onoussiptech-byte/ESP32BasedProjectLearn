// =============================================================================
// FlowSensor.h - E1: YF-S201 Hall flow sensor on GPIO 34 (interrupt counting)
// Provides readFlowLpm() (ICD 4.5). The interrupt path is pure C++ with a
// lock-free atomic counter and lives in IRAM, so it is safe and very fast.
// Only one instance may exist (one interrupt pin).
// =============================================================================
#pragma once                                   // include this header only once

#include <stdint.h>                            // fixed-width integer types

#include "types.h"                             // SensorReading
#include "e1_sensors/SignalFilter.h"           // exponential average
#include "config.h"                            // smoothing weight

class FlowSensor {
 public:
  bool begin(float pulsesPerLitre);            // attach the interrupt, set the calibration constant
  SensorReading readFlowLpm();                 // average flow since the previous call, L/min
  void setPulsesPerLitre(float ppl);           // update the bucket-test calibration
  float pulsesPerLitre() const { return pulsesPerLitre_; } // current calibration constant
  float totalLitres() const { return totalLitres_; } // volume pumped since boot

 private:
  float pulsesPerLitre_ = 450.0f;              // pulses per litre (YF-S201 nominal)
  int64_t lastReadUs_ = 0;                     // time of the previous readFlowLpm()
  float totalLitres_ = 0.0f;                   // cumulative volume
  filt::Ema ema_{cfg::flow::EMA_ALPHA};        // smooths the 1 s pulse counts
};
