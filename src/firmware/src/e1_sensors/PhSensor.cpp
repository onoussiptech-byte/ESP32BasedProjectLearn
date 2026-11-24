// =============================================================================
// PhSensor.cpp - E1: pH measurement, temperature compensation and calibration
//
// Model:   pH_raw = slope x V_board + offset         (V_board = V_adc / 0.6)
// Compensation (Nernst, slope proportional to absolute temperature):
//          pH = 7 + (pH_raw - 7) x (T_cal + 273.15) / (T_water + 273.15)
// =============================================================================
#include "e1_sensors/PhSensor.h"               // this module's interface

#include <Arduino.h>                           // analogReadMilliVolts, pinMode
#include <math.h>                              // fabsf

#include "e1_sensors/Ads1115Bus.h"             // shared ADS1115 access
#include "logger.h"                            // LOGI/LOGW

namespace {                                    // private to this file

constexpr const char* TAG = "PH";              // log tag
constexpr float KELVIN = 273.15f;              // 0 deg C in kelvin
constexpr float BUFFERS[] = {4.01f, 6.86f, 7.00f, 9.18f}; // accepted calibration buffers
constexpr float BUFFER_TOLERANCE = 0.005f;     // tolerance when matching a buffer value

// True if bufferPh is one of the standard buffer solutions
bool isKnownBuffer(float bufferPh) {
  for (float b : BUFFERS) {                    // check every standard buffer
    if (fabsf(bufferPh - b) < BUFFER_TOLERANCE) { // close enough?
      return true;                             // known buffer
    }
  }
  return false;                                // not a standard buffer
}

}  // namespace

PhCalibration PhSensor::defaultCalibration() {
  return PhCalibration{cfg::ph::DEFAULT_SLOPE,  // nominal slope
                       cfg::ph::DEFAULT_OFFSET, // nominal offset
                       cfg::ph::DEFAULT_CAL_TEMP}; // nominal calibration temperature
}

// True if a slope is plausible: right size and same direction as the board (voltage falls when pH rises)
bool PhSensor::slopeOk(float slope) {
  return fabsf(slope) >= cfg::ph::MIN_ABS_SLOPE && fabsf(slope) <= cfg::ph::MAX_ABS_SLOPE // size (false for NaN)
      && (slope < 0.0f) == (cfg::ph::DEFAULT_SLOPE < 0.0f); // wrong sign = the two buffers were swapped
}

bool PhSensor::begin(const PhCalibration& cal) {
  cal_ = cal;                                  // use the calibration loaded from flash
  if (!slopeOk(cal_.slope) || !isfinite(cal_.offset) || !isfinite(cal_.calTempC)) { // corrupt flash values
    LOGW(TAG, "stored calibration rejected: using defaults"); // report it
    cal_ = defaultCalibration();               // safe nominal values
  }
  useFallbackAdc_ = PH_ADC_FALLBACK && !Ads1115Bus::isPresent(); // no ADS1115 at boot -> ESP32 ADC1 (if allowed)
  if (useFallbackAdc_) {                       // fallback path...
    pinMode(cfg::pins::PH_FALLBACK_ADC, INPUT);// ...pin 35 as analog input
    analogSetPinAttenuation(cfg::pins::PH_FALLBACK_ADC, ADC_11db); // ~0..3.1 V range
    LOGW(TAG, "ADS1115 missing: using ADC1 GPIO%u (less accurate)", cfg::pins::PH_FALLBACK_ADC);
  }
  LOGI(TAG, "slope=%.3f offset=%.3f calT=%.1f", cal_.slope, cal_.offset, cal_.calTempC); // show calibration
  return true;                                 // the pH channel is always available in some form
}

bool PhSensor::sampleAdcVolts(float& volts) {
  if (useFallbackAdc_) {                       // ESP32 internal ADC1 path
    volts = analogReadMilliVolts(cfg::pins::PH_FALLBACK_ADC) / 1000.0f; // factory-calibrated mV -> V
    return true;                               // the internal ADC always answers
  }
  return Ads1115Bus::readVolts(cfg::ads::CH_PH, volts); // external 16-bit ADC on A0
}

bool PhSensor::readBoardVoltage(float& boardVolts) {
  float s[cfg::ph::BURST_SAMPLES];             // burst of samples
  for (uint8_t i = 0; i < cfg::ph::BURST_SAMPLES; ++i) { // take five samples
    if (!sampleAdcVolts(s[i])) {               // any failed read...
      return false;                            // ...invalidates the whole reading
    }
  }
  const float adcVolts = filt::median5(s[0], s[1], s[2], s[3], s[4]); // reject single spikes
  boardVolts = adcVolts / cfg::ph::DIVIDER_RATIO; // undo the 10k/15k divider
  return true;                                 // good voltage
}

SensorReading PhSensor::readPH(float waterTempC) {
  float v = 0.0f;                              // board output voltage
  if (!readBoardVoltage(v)) {                  // ADC failure
    return SensorReading{lastValue_, false};   // keep last value, flag it invalid
  }
  if (!(v >= cfg::ph::BOARD_V_MIN_VALID && v <= cfg::ph::BOARD_V_MAX_VALID)) { // unplugged, saturated or NaN
    return SensorReading{lastValue_, false};   // invalid reading
  }
  const float phRaw = cal_.slope * v + cal_.offset; // linear calibration at calibration temperature
  const float comp = (cal_.calTempC + KELVIN) / (waterTempC + KELVIN); // Nernst slope ratio
  const float ph = 7.0f + (phRaw - 7.0f) * comp; // temperature-compensated pH
  if (!(ph >= cfg::ph::VALID_MIN && ph <= cfg::ph::VALID_MAX)) { // outside 0..14 or NaN = bad probe/calibration
    return SensorReading{lastValue_, false};   // invalid reading
  }
  lastValue_ = ema_.update(ph);                // smooth with the EMA
  return SensorReading{lastValue_, true};      // good reading
}

PhSensor::CalResult PhSensor::calibrate(float bufferPh, float waterTempC) {
  if (!isKnownBuffer(bufferPh)) {              // only standard buffers are accepted
    return CalResult::InvalidBuffer;           // reject
  }
  float v = 0.0f;                              // board voltage in the buffer
  if (!readBoardVoltage(v) || v < cfg::ph::BOARD_V_MIN_VALID || v > cfg::ph::BOARD_V_MAX_VALID) {
    return CalResult::ReadError;               // probe not readable
  }

  // Step 1 (or a repeat of the same buffer): store the point, shift the offset
  if (!hasFirstPoint_ || fabsf(bufferPh - firstPh_) < BUFFER_TOLERANCE) {
    firstPh_ = bufferPh;                       // remember the buffer value
    firstVolts_ = v;                           // remember its voltage
    firstTempC_ = waterTempC;                  // remember its temperature
    hasFirstPoint_ = true;                     // wait for the second buffer
    cal_.offset = bufferPh - cal_.slope * v;   // single-point correction keeps the current slope
    cal_.calTempC = waterTempC;                // calibration now refers to this temperature
    ema_.reset();                              // restart smoothing on the new scale
    return CalResult::PointStored;             // step 1 done
  }

  // Step 2: two different buffers -> compute slope and offset
  const float dv = v - firstVolts_;            // voltage difference between buffers
  if (fabsf(dv) < cfg::ph::MIN_CAL_SPAN_V) {   // too close: probe dead or same solution
    return CalResult::PointsTooClose;          // reject
  }
  const float slope = (bufferPh - firstPh_) / dv; // pH per volt
  if (!slopeOk(slope)) {                       // implausible size or swapped buffers
    hasFirstPoint_ = false;                    // restart the procedure
    return CalResult::SlopeOutOfRange;         // reject
  }
  cal_.slope = slope;                          // accept the slope
  cal_.offset = firstPh_ - slope * firstVolts_;// line through the first point
  cal_.calTempC = 0.5f * (firstTempC_ + waterTempC); // average buffer temperature
  hasFirstPoint_ = false;                      // procedure finished
  ema_.reset();                                // restart smoothing on the new scale
  LOGI(TAG, "calibrated: slope=%.3f offset=%.3f calT=%.1f", cal_.slope, cal_.offset, cal_.calTempC);
  return CalResult::Complete;                  // two-point calibration done
}

PhCalibration PhSensor::calibration() const {
  return cal_;                                 // copy of the active calibration
}

const char* PhSensor::calResultText(CalResult r) {
  switch (r) {                                 // map each result to text
    case CalResult::PointStored:     return "point stored";
    case CalResult::Complete:        return "calibration complete";
    case CalResult::InvalidBuffer:   return "invalid buffer";
    case CalResult::ReadError:       return "probe read error";
    case CalResult::PointsTooClose:  return "buffers too close";
    case CalResult::SlopeOutOfRange: return "slope out of range";
  }
  return "unknown";                            // never reached
}
