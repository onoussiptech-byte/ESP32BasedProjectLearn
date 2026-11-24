// =============================================================================
// Ads1115Bus.cpp - E1: ADS1115 driver wrapper with bus locking and hot-plug
// =============================================================================
#include "e1_sensors/Ads1115Bus.h"             // this module's interface

#include <Arduino.h>                           // FreeRTOS types and Arduino helpers
#include <Wire.h>                              // I2C driver
#include <Adafruit_ADS1X15.h>                  // ADS1115 library

#include "config.h"                            // pins and ADC settings
#include "logger.h"                            // LOGI/LOGW/LOGE

namespace {                                    // private to this file

constexpr const char* TAG = "ADS1115";         // log tag

Adafruit_ADS1115 g_ads;                        // the ADC driver object
SemaphoreHandle_t g_mutex = nullptr;           // protects the I2C bus and g_ads
bool g_present = false;                        // last known presence of the ADC

// Configure gain and data rate after a successful begin()
void configureAdc() {
  g_ads.setGain(GAIN_ONE);                     // +/-4.096 V range: covers the 3.0 V divider output
  g_ads.setDataRate(RATE_ADS1115_128SPS);      // 128 samples/s: ~8 ms per conversion, low noise
}

// Probe the I2C address: true if the chip acknowledges
bool probe() {
  Wire.beginTransmission(cfg::ads::I2C_ADDRESS); // address the ADC
  return Wire.endTransmission() == 0;          // 0 = ACK received
}

// One single-shot conversion with a time limit. The library's readADC_SingleEnded() waits forever if the
// chip is unplugged during a conversion, which would hang the sensing task until the watchdog resets.
bool convert(uint8_t channel, int16_t& raw) {
  g_ads.startADCReading(MUX_BY_CHANNEL[channel], /*continuous=*/false); // start one conversion
  const uint32_t start = millis();             // time reference
  do {                                         // wait without blocking the other tasks
    vTaskDelay(pdMS_TO_TICKS(2));              // let them run
    if (g_ads.conversionComplete()) {          // result ready
      raw = g_ads.getLastConversionResults();  // read it
      return probe();                          // trust it only if the chip still answers
    }
  } while (millis() - start < cfg::ads::CONVERSION_TIMEOUT_MS); // about 8 ms expected
  return false;                                // timed out: unplugged
}

}  // namespace

namespace Ads1115Bus {

bool begin() {
  g_mutex = xSemaphoreCreateMutex();           // create the bus mutex
  if (g_mutex == nullptr) {                    // out of memory?
    LOGE(TAG, "mutex creation failed");        // report it
    return false;                              // cannot continue safely
  }
  Wire.begin(cfg::pins::I2C_SDA, cfg::pins::I2C_SCL); // start I2C on GPIO 21/22
  Wire.setClock(cfg::ads::I2C_CLOCK_HZ);       // 400 kHz fast mode
  g_present = g_ads.begin(cfg::ads::I2C_ADDRESS, &Wire); // try to find the ADC
  if (g_present) {                             // found...
    configureAdc();                            // ...apply gain and rate
    LOGI(TAG, "found at 0x%02X", cfg::ads::I2C_ADDRESS); // report success
  } else {                                     // not found...
    LOGW(TAG, "not found at 0x%02X", cfg::ads::I2C_ADDRESS); // ...pH reports a fault (or the ADC1 fallback)
  }
  return g_present;                            // tell the caller
}

bool isPresent() {
  return g_present;                            // last known state (no bus access)
}

bool readVolts(uint8_t channel, float& volts) {
  if (channel > 3 || g_mutex == nullptr) {     // invalid channel or module not started
    return false;                              // nothing to read
  }
  if (xSemaphoreTake(g_mutex, pdMS_TO_TICKS(cfg::ads::MUTEX_WAIT_MS)) != pdTRUE) { // lock the bus
    return false;                              // bus busy too long: report a failed read
  }
  bool ok = false;                             // result of this access
  if (!probe()) {                              // chip does not answer (unplugged wire?)
    if (g_present) {                           // it was there before...
      LOGW(TAG, "lost");                       // ...log the loss once
    }
    g_present = false;                         // mark it missing
  } else {                                     // chip answers
    if (!g_present) {                          // it came back (hot-plug)...
      g_present = g_ads.begin(cfg::ads::I2C_ADDRESS, &Wire); // ...re-initialise it
      if (g_present) {                         // re-init worked
        configureAdc();                        // re-apply settings
        LOGI(TAG, "reconnected");              // log the recovery
      }
    }
    if (g_present) {                           // ready to convert
      int16_t raw = 0;                         // conversion result, counts
      ok = convert(channel, raw);              // about 8 ms, never longer than the time limit
      if (ok) {                                // successful reading
        volts = g_ads.computeVolts(raw);       // convert counts to volts using the gain
      }
    }
  }
  xSemaphoreGive(g_mutex);                     // release the bus
  return ok;                                   // report the result
}

}  // namespace Ads1115Bus
