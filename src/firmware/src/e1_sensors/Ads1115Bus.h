// =============================================================================
// Ads1115Bus.h - E1: shared, mutex-protected access to the ADS1115 16-bit ADC
// The pH sensor (A0) and the optional rail monitor (A2/A3) both use this ADC,
// possibly from different tasks, so every access goes through one mutex.
// =============================================================================
#pragma once                                   // include this header only once

#include <stdint.h>                            // fixed-width integer types

namespace Ads1115Bus {                         // single-instance module

bool begin();                                  // start I2C and detect the ADS1115; true if found
bool isPresent();                              // true if the ADC answered on the last access
bool readVolts(uint8_t channel, float& volts); // single-ended reading of A0..A3 in volts; false on error

}  // namespace Ads1115Bus
