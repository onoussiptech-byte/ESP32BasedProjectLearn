// =============================================================================
// HeaterDriver.h - P3: heater demo (2 x 47 Ohm 5 W in parallel, ~6 W at 12 V)
// on GPIO 32 (MOSFET Q4). Safe default is OFF (ICD 4.6).
// =============================================================================
#pragma once                                   // include this header only once

#include "p3_outputs/LowSideSwitch.h"          // MOSFET gate driver
#include "config.h"                            // pin

class HeaterDriver {
 public:
  bool begin();                                // configure the pin, heater OFF
  void set(bool on) { sw_.set(on); }           // switch the heater
  bool isOn() const { return sw_.isOn(); }     // current state

 private:
  LowSideSwitch sw_{cfg::pins::HEATER};        // MOSFET Q4
};
