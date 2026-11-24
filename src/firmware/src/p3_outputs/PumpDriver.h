// =============================================================================
// PumpDriver.h - P3: 12 V circulation pump, 20 kHz PWM on GPIO 25 (MOSFET Q1)
// Soft start: the duty ramps toward the target (0 -> 100 % in 1 s) so the
// 12 V rail never sees a step load. Duties below the minimum start duty are
// raised to it, because a small pump will not spin below ~30 %.
// =============================================================================
#pragma once                                   // include this header only once

#include <atomic>                              // lock-free target/duty shared between tasks
#include <stdint.h>                            // fixed-width integer types

class PumpDriver {
 public:
  bool begin();                                // attach the LEDC PWM channel, pump OFF
  void setTarget(uint8_t percent);             // requested duty 0..100 % (0 = off)
  void forceOff();                             // immediate stop, no ramp (low water)
  void service(uint32_t elapsedMs);            // advance the soft-start ramp (every 100 ms)
  uint8_t duty() const { return applied_.load(); }  // duty actually applied now, %
  uint8_t target() const { return target_.load(); } // duty being ramped toward, %

 private:
  void write(float percent);                   // convert % to LEDC counts and output it

  std::atomic<uint8_t> target_{0};             // target duty, %
  std::atomic<uint8_t> applied_{0};            // applied duty, % (rounded)
  float current_ = 0.0f;                       // exact ramp position, % (safety task only)
};
