// =============================================================================
// AeratorDriver.h - P3: 12 V air pump on GPIO 26 (MOSFET Q2)
// Safe default is ON (ICD 4.6). A hardware SPDT bypass switch can also power
// the air pump directly, so the fish keep oxygen even if the ESP32 crashes.
// =============================================================================
#pragma once                                   // include this header only once

#include "p3_outputs/LowSideSwitch.h"          // MOSFET gate driver
#include "config.h"                            // pin

class AeratorDriver {
 public:
  bool begin();                                // configure the pin and switch the air pump ON
  void set(bool on) { sw_.set(on); }           // switch the air pump
  bool isOn() const { return sw_.isOn(); }     // current state

 private:
  LowSideSwitch sw_{cfg::pins::AERATOR};       // MOSFET Q2
};
