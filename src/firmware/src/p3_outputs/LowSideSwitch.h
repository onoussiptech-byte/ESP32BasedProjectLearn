// =============================================================================
// LowSideSwitch.h - P3: common on/off driver for one IRLZ44N low-side MOSFET
// Hardware per output: 220 Ohm gate resistor, 10 kOhm gate pull-down (OFF at
// reset), flyback diode across inductive loads. HIGH on the pin = load ON.
// Used by the aerator, heater and dosing drivers.
// =============================================================================
#pragma once                                   // include this header only once

#include <atomic>                              // lock-free state readable from any task
#include <stdint.h>                            // fixed-width integer types

class LowSideSwitch {
 public:
  explicit LowSideSwitch(uint8_t pin) : pin_(pin) {} // remember the gate pin

  void begin(bool initialOn);                  // configure the pin glitch-free in its first state
  void set(bool on);                           // switch the load
  bool isOn() const { return on_.load(); }     // current commanded state
  uint8_t pin() const { return pin_; }         // gate pin number

 private:
  const uint8_t pin_;                          // GPIO driving the MOSFET gate
  std::atomic<bool> on_{false};                // last written state
};
