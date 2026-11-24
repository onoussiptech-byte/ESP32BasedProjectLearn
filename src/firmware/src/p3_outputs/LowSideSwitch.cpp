// =============================================================================
// LowSideSwitch.cpp - P3: MOSFET gate drive
// =============================================================================
#include "p3_outputs/LowSideSwitch.h"          // this module's interface

#include <Arduino.h>                           // pinMode, digitalWrite
#include <driver/gpio.h>                       // gpio_set_level (works before pinMode)

void LowSideSwitch::begin(bool initialOn) {
  gpio_set_level(static_cast<gpio_num_t>(pin_), initialOn ? 1 : 0); // preload the output latch (digitalWrite would refuse here)
  pinMode(pin_, OUTPUT);                       // now drive the gate (no glitch to the wrong level)
  set(initialOn);                              // record and apply the state
}

void LowSideSwitch::set(bool on) {
  on_.store(on);                               // remember the state for snapshots
  digitalWrite(pin_, on ? HIGH : LOW);         // HIGH = MOSFET conducts = load ON
}
