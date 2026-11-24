// =============================================================================
// DosingPumpDriver.h - P3: mini dosing pump on the 5 V rail, GPIO 33 (MOSFET Q3)
// Only ever runs as a timed pulse ("never dose continuously"). The stop is done
// by a one-shot hardware-timer callback (esp_timer), so the pump stops on time
// even if a FreeRTOS task is late. Safe default is OFF (ICD 4.6).
// =============================================================================
#pragma once                                   // include this header only once

#include <esp_timer.h>                         // one-shot high-resolution timer
#include <stdint.h>                            // fixed-width integer types

#include "p3_outputs/LowSideSwitch.h"          // MOSFET gate driver
#include "config.h"                            // pin

class DosingPumpDriver {
 public:
  bool begin();                                // configure the pin and create the stop timer
  bool startPulse(uint32_t durationMs);        // run the pump for durationMs; false if refused
  void stop();                                 // stop immediately (safety)
  bool isActive() const { return sw_.isOn(); } // true while a pulse is running

 private:
  static void onPulseEnd(void* arg);           // timer callback: switches the pump off

  LowSideSwitch sw_{cfg::pins::DOSING};        // MOSFET Q3
  esp_timer_handle_t timer_ = nullptr;         // one-shot stop timer
};
