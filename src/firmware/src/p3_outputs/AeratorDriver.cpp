// =============================================================================
// AeratorDriver.cpp - P3: air pump driver
// =============================================================================
#include "p3_outputs/AeratorDriver.h"          // this module's interface

#include "logger.h"                            // LOGI

bool AeratorDriver::begin() {
  sw_.begin(true);                             // safe default: aerator ON from the first instant
  LOGI("AERATOR", "ON (safe default) on GPIO%u", sw_.pin()); // report it
  return true;                                 // nothing can fail here
}
