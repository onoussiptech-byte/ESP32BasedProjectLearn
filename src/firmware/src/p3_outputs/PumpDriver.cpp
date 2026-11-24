// =============================================================================
// PumpDriver.cpp - P3: LEDC PWM with soft-start ramp
// =============================================================================
#include "p3_outputs/PumpDriver.h"             // this module's interface

#include <Arduino.h>                           // ledcAttach, ledcWrite
#include <math.h>                              // lroundf

#include "config.h"                            // pump constants and pin
#include "logger.h"                            // LOGI/LOGE

namespace {                                    // private to this file
constexpr const char* TAG = "PUMP";            // log tag
constexpr uint32_t MAX_COUNTS = (1u << cfg::pump::PWM_RES_BITS) - 1u; // 1023 at 10 bits
}  // namespace

bool PumpDriver::begin() {
  const bool ok = ledcAttach(cfg::pins::PUMP_PWM, cfg::pump::PWM_FREQ_HZ, cfg::pump::PWM_RES_BITS); // 20 kHz, 10 bit
  write(0.0f);                                 // start with the pump OFF
  if (ok) {                                    // PWM channel ready
    LOGI(TAG, "PWM %lu Hz on GPIO%u", (unsigned long)cfg::pump::PWM_FREQ_HZ, cfg::pins::PUMP_PWM);
  } else {                                     // no free LEDC channel / bad frequency
    LOGE(TAG, "LEDC attach failed");           // report it
  }
  return ok;                                   // tell the caller
}

void PumpDriver::setTarget(uint8_t percent) {
  if (percent > 100) {                         // clamp to 100 %
    percent = 100;                             // full speed
  }
  if (percent > 0 && percent < cfg::pump::MIN_DUTY) { // too low to spin...
    percent = cfg::pump::MIN_DUTY;             // ...use the minimum start duty
  }
  target_.store(percent);                      // ramp will move toward it
}

void PumpDriver::forceOff() {
  target_.store(0);                            // no target
  current_ = 0.0f;                             // ramp position at zero
  write(0.0f);                                 // stop the pump now
}

void PumpDriver::service(uint32_t elapsedMs) {
  const float target = static_cast<float>(target_.load()); // where we are going
  const float step = 100.0f * static_cast<float>(elapsedMs) / static_cast<float>(cfg::pump::RAMP_TIME_MS); // % per call
  if (current_ < target) {                     // ramp up
    current_ = (current_ + step > target) ? target : current_ + step; // never overshoot
  } else if (current_ > target) {              // ramp down (gentle on the hose too)
    current_ = (current_ - step < target) ? target : current_ - step; // never undershoot
  }
  write(current_);                             // apply the new duty
}

void PumpDriver::write(float percent) {
  const uint32_t counts = static_cast<uint32_t>(lroundf(percent * MAX_COUNTS / 100.0f)); // % -> counts
  ledcWrite(cfg::pins::PUMP_PWM, counts);      // update the PWM compare value
  applied_.store(static_cast<uint8_t>(lroundf(percent))); // remember the applied duty
}
