// =============================================================================
// StatusLed.cpp - P3: status LED blink patterns
// =============================================================================
#include "p3_outputs/StatusLed.h"              // this module's interface

#include <Arduino.h>                           // pinMode, digitalWrite

#include "config.h"                            // pin

namespace {                                    // private to this file
constexpr uint32_t NORMAL_HALF_PERIOD_MS = 500;// 1 Hz blink
constexpr uint32_t ALARM_HALF_PERIOD_MS  = 100;// 5 Hz blink
}  // namespace

bool StatusLed::begin() {
  pinMode(cfg::pins::STATUS_LED, OUTPUT);      // LED pin as output
  digitalWrite(cfg::pins::STATUS_LED, HIGH);   // Boot pattern: steady on
  on_ = true;                                  // remember the state
  return true;                                 // nothing can fail here
}

void StatusLed::service(uint32_t nowMs) {
  const Pattern p = pattern_.load();           // read the requested pattern
  if (p == Pattern::Boot) {                    // steady on
    if (!on_) {                                // only write on change
      on_ = true;                              // remember
      digitalWrite(cfg::pins::STATUS_LED, HIGH); // LED on
    }
    return;                                    // nothing else to do
  }
  const uint32_t half = (p == Pattern::Alarm) ? ALARM_HALF_PERIOD_MS : NORMAL_HALF_PERIOD_MS; // blink speed
  if (nowMs - lastToggleMs_ >= half) {         // time to toggle (wrap-safe)
    lastToggleMs_ = nowMs;                     // remember when
    on_ = !on_;                                // invert the state
    digitalWrite(cfg::pins::STATUS_LED, on_ ? HIGH : LOW); // apply it
  }
}
