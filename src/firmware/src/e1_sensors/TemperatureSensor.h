// =============================================================================
// TemperatureSensor.h - E1: DS18B20 waterproof probe on 1-Wire GPIO 4
// Provides readTempC() (ICD 4.5). Conversions are non-blocking: a reading is
// requested in one cycle and collected in the next, so the task never waits 750 ms.
// =============================================================================
#pragma once                                   // include this header only once

#include <OneWire.h>                           // 1-Wire bus driver
#include <DallasTemperature.h>                 // DS18B20 driver

#include "types.h"                             // SensorReading
#include "e1_sensors/SignalFilter.h"           // MedianEmaFilter
#include "config.h"                            // temperature constants

class TemperatureSensor {
 public:
  TemperatureSensor();                         // binds the bus to the DS18B20 pin
  bool begin();                                // detect the probe and start the first conversion
  SensorReading readTempC();                   // filtered water temperature in deg C

 private:
  bool discover();                             // (re)scan the bus for a probe

  OneWire oneWire_;                            // 1-Wire bus (declared before bus_: init order)
  DallasTemperature bus_;                      // DS18B20 protocol on that bus
  filt::MedianEmaFilter filter_{cfg::temp::EMA_ALPHA}; // median-of-5 + EMA
  bool present_ = false;                       // true when a probe was found
  bool hasValue_ = false;                      // true after the first real measurement
  uint8_t failCount_ = 0;                      // consecutive bad readings
  float lastValue_ = 25.0f;                    // last good temperature
};
