// =============================================================================
// PhSensor.h - E1: PH-4502C pH board through a 10k/15k divider into ADS1115 A0
// Provides readPH() (ICD 4.5) with median-of-5, EMA, temperature compensation
// and a two-point buffer calibration (7.00 then 4.01, or 6.86 / 9.18).
// =============================================================================
#pragma once                                   // include this header only once

#include "types.h"                             // SensorReading, PhCalibration
#include "e1_sensors/SignalFilter.h"           // Ema
#include "config.h"                            // pH constants

class PhSensor {
 public:
  // Result of one calibration step
  enum class CalResult : uint8_t {
    PointStored,                               // first buffer stored, offset adjusted (single point)
    Complete,                                  // second buffer stored, slope and offset computed
    InvalidBuffer,                             // buffer value is not 4.01, 6.86, 7.00 or 9.18
    ReadError,                                 // the board voltage could not be read
    PointsTooClose,                            // the two buffers gave nearly the same voltage
    SlopeOutOfRange                            // computed slope is not a plausible pH probe
  };

  bool begin(const PhCalibration& cal);        // choose ADS1115 or ADC1 fallback, load calibration
  SensorReading readPH(float waterTempC);      // filtered, temperature-compensated pH
  CalResult calibrate(float bufferPh, float waterTempC); // one calibration step
  PhCalibration calibration() const;           // current calibration (to save in flash)
  static PhCalibration defaultCalibration();   // values used before any calibration
  static const char* calResultText(CalResult r); // human-readable result for logs

 private:
  static bool slopeOk(float slope);            // plausible size and direction
  bool sampleAdcVolts(float& volts);           // one raw ADC voltage (ADS1115 or ADC1)
  bool readBoardVoltage(float& boardVolts);    // median of 5 samples, scaled back to board volts

  bool useFallbackAdc_ = false;                // true when the ADS1115 is not present at boot
  PhCalibration cal_ = defaultCalibration();   // active calibration
  filt::Ema ema_{cfg::ph::EMA_ALPHA};          // smoothing stage
  bool hasFirstPoint_ = false;                 // true between calibration step 1 and step 2
  float firstPh_ = 0.0f;                       // buffer pH of the first point
  float firstVolts_ = 0.0f;                    // board voltage of the first point
  float firstTempC_ = 0.0f;                    // temperature of the first point
  float lastValue_ = 7.0f;                     // last good pH (reported with valid=false on errors)
};
