// =============================================================================
// StatusLed.h - P3: on-board status LED on GPIO 2
// Patterns: Boot = steady on, Normal = slow 1 Hz blink, Alarm = fast 5 Hz blink.
// =============================================================================
#pragma once                                   // include this header only once

#include <atomic>                              // pattern can be set from any task
#include <stdint.h>                            // fixed-width integer types

class StatusLed {
 public:
  enum class Pattern : uint8_t { Boot, Normal, Alarm }; // available blink patterns

  bool begin();                                // configure the pin, show the Boot pattern
  void setPattern(Pattern p) { pattern_.store(p); } // choose the pattern
  void service(uint32_t nowMs);                // update the LED (every 100 ms)

 private:
  std::atomic<Pattern> pattern_{Pattern::Boot};// active pattern
  bool on_ = false;                            // current LED state
  uint32_t lastToggleMs_ = 0;                  // time of the last toggle
};
