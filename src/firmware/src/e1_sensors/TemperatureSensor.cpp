// =============================================================================
// TemperatureSensor.cpp - E1: DS18B20 driver with hot-plug and filtering
// =============================================================================
#include "e1_sensors/TemperatureSensor.h"      // this module's interface

#include "logger.h"                            // LOGI/LOGW

namespace {                                    // private to this file
constexpr const char* TAG = "TEMP";            // log tag
}  // namespace

TemperatureSensor::TemperatureSensor()
    : oneWire_(cfg::pins::DS18B20),            // 1-Wire bus on GPIO 4
      bus_(&oneWire_) {}                       // DS18B20 driver uses that bus

bool TemperatureSensor::discover() {
  bus_.begin();                                // scan the bus
  present_ = bus_.getDeviceCount() > 0;        // at least one probe answered?
  if (present_) {                              // probe found...
    bus_.setResolution(cfg::temp::RESOLUTION_BITS); // ...12-bit resolution
    bus_.setWaitForConversion(false);          // never block inside requestTemperatures()
    bus_.requestTemperatures();                // start the first conversion now
    failCount_ = 0;                            // fresh start
  }
  return present_;                             // tell the caller
}

bool TemperatureSensor::begin() {
  if (discover()) {                            // probe found at boot
    LOGI(TAG, "DS18B20 found on GPIO%u", cfg::pins::DS18B20); // report it
  } else {                                     // no probe
    LOGW(TAG, "no DS18B20 on GPIO%u", cfg::pins::DS18B20); // report it, retry later
  }
  return present_;                             // presence at boot
}

SensorReading TemperatureSensor::readTempC() {
  if (!present_ && !discover()) {              // still no probe after a re-scan
    return SensorReading{lastValue_, false};   // invalid reading
  }
  if (!bus_.isConversionComplete()) {          // conversion still running (should be rare at 1 s)
    return SensorReading{lastValue_, hasValue_ && failCount_ == 0}; // keep the previous state
  }
  const float t = bus_.getTempCByIndex(0);     // read the finished conversion
  bus_.requestTemperatures();                  // start the next conversion right away
  const bool ok = (t != DEVICE_DISCONNECTED_C) // -127 means no answer
                  && (t >= cfg::temp::VALID_MIN) // too cold to be real
                  && (t <= cfg::temp::VALID_MAX); // too hot (85 = power-on value)
  if (!ok) {                                   // bad reading
    if (++failCount_ >= cfg::temp::MAX_FAILS) {// several in a row...
      present_ = false;                        // ...force a bus re-scan next cycle
      LOGW(TAG, "probe lost");                 // report it
    }
    return SensorReading{lastValue_, false};   // invalid reading
  }
  failCount_ = 0;                              // good reading resets the counter
  lastValue_ = filter_.update(t);              // median-of-5 then EMA
  hasValue_ = true;                            // from now on lastValue_ is a real measurement
  return SensorReading{lastValue_, true};      // good reading
}
