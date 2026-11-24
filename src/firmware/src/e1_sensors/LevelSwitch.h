// =============================================================================
// LevelSwitch.h - E1: low-water float switch on GPIO 27 (switch to GND)
// Provides levelOK() (ICD 4.5). update() is called every 100 ms by the safety
// task and debounces the contact; levelOK() can be read from any task.
// =============================================================================
#pragma once                                   // include this header only once

#include <atomic>                              // lock-free state shared between tasks
#include <stdint.h>                            // fixed-width integer types

#include "types.h"                             // LevelReading

class LevelSwitch {
 public:
  bool begin();                                // configure the pin with its internal pull-up
  void update();                               // sample and debounce (call every 100 ms)
  LevelReading levelOK() const;                // debounced state: true = water level OK

 private:
  static bool readRaw();                       // true when the pin reads HIGH (level OK)

  std::atomic<bool> stableOk_{true};           // debounced state (written by safety task)
  bool lastRaw_ = true;                        // previous raw sample
  uint8_t sameCount_ = 0;                      // how many identical samples in a row
};
