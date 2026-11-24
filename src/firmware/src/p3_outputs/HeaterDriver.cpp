// =============================================================================
// HeaterDriver.cpp - P3: heater demo driver
// =============================================================================
#include "p3_outputs/HeaterDriver.h"           // this module's interface

#include "logger.h"                            // LOGI

bool HeaterDriver::begin() {
  sw_.begin(false);                            // safe default: heater OFF
  LOGI("HEATER", "OFF (safe default) on GPIO%u", sw_.pin()); // report it
  return true;                                 // nothing can fail here
}
