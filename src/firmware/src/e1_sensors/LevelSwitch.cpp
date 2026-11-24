// =============================================================================
// LevelSwitch.cpp - E1: float switch debouncing (LOW = low water, per ICD 4.2)
// =============================================================================
#include "e1_sensors/LevelSwitch.h"            // this module's interface

#include <Arduino.h>                           // pinMode, digitalRead

#include "config.h"                            // pin and debounce settings
#include "logger.h"                            // LOGI

namespace {                                    // private to this file
constexpr const char* TAG = "LEVEL";           // log tag
}  // namespace

bool LevelSwitch::readRaw() {
  return digitalRead(cfg::pins::FLOAT_SWITCH) == HIGH; // pull-up HIGH = switch open = level OK
}

bool LevelSwitch::begin() {
  pinMode(cfg::pins::FLOAT_SWITCH, INPUT_PULLUP); // internal pull-up, switch pulls to GND
  lastRaw_ = readRaw();                        // first sample
  stableOk_.store(lastRaw_);                   // start in the real state, no debounce delay at boot
  LOGI(TAG, "float switch on GPIO%u: %s", cfg::pins::FLOAT_SWITCH, lastRaw_ ? "OK" : "LOW WATER");
  return true;                                 // nothing can fail here
}

void LevelSwitch::update() {
  const bool raw = readRaw();                  // sample the contact
  if (raw == lastRaw_) {                       // same as last time...
    if (sameCount_ < 255) {                    // ...avoid counter overflow
      ++sameCount_;                            // ...one more identical sample
    }
  } else {                                     // the contact changed (or bounced)
    lastRaw_ = raw;                            // remember the new value
    sameCount_ = 1;                            // restart counting
  }
  const uint8_t needed = raw ? cfg::level::RECOVER_SAMPLES   // water back: wait 3 s, so waves cannot cycle the pump
                             : cfg::level::DEBOUNCE_SAMPLES; // low water: trip fast (0.3 s)
  if (sameCount_ >= needed) {                  // stable long enough
    stableOk_.store(raw);                      // accept the new state
  }
}

LevelReading LevelSwitch::levelOK() const {
  return LevelReading{stableOk_.load(), true}; // a simple contact is always readable
}
