// =============================================================================
// FlowSensor.cpp - E1: pulse counting in an IRAM interrupt (time critical)
// Flow [L/min] = pulses / dt[s] x 60 / pulsesPerLitre   (450 p/L -> Hz / 7.5)
// =============================================================================
#include "e1_sensors/FlowSensor.h"             // this module's interface

#include <Arduino.h>                           // attachInterrupt, pinMode
#include <atomic>                              // lock-free counters shared with the ISR
#include <esp_timer.h>                         // esp_timer_get_time(): IRAM-safe microsecond clock

#include "config.h"                            // pins and flow constants
#include "logger.h"                            // LOGI

namespace {                                    // private to this file

constexpr const char* TAG = "FLOW";            // log tag

std::atomic<uint32_t> g_pulses{0};             // pulses counted since the last read (ISR -> task)
std::atomic<uint32_t> g_lastEdgeUs{0};         // time of the last accepted edge (low 32 bits)

// Interrupt service routine: runs from IRAM on every falling edge.
// Pure C++, no Arduino calls, no locks: a few CPU cycles only.
void IRAM_ATTR onPulseIsr() {
  const uint32_t now = static_cast<uint32_t>(esp_timer_get_time()); // microseconds (wraps every ~71 min)
  const uint32_t last = g_lastEdgeUs.load(std::memory_order_relaxed); // previous accepted edge
  if (static_cast<uint32_t>(now - last) < cfg::flow::GLITCH_US) { // wrap-safe difference
    return;                                    // too close: electrical noise, ignore it
  }
  g_lastEdgeUs.store(now, std::memory_order_relaxed); // remember this edge
  g_pulses.fetch_add(1u, std::memory_order_relaxed);  // count it
}

}  // namespace

bool FlowSensor::begin(float pulsesPerLitre) {
  setPulsesPerLitre(pulsesPerLitre);           // apply the calibration constant
  pinMode(cfg::pins::FLOW, INPUT);             // GPIO 34 has no internal pull-up (divider drives it)
  lastReadUs_ = esp_timer_get_time();          // start of the first measuring window
  attachInterrupt(digitalPinToInterrupt(cfg::pins::FLOW), onPulseIsr, FALLING); // count falling edges
  LOGI(TAG, "YF-S201 on GPIO%u, %.1f pulses/L", cfg::pins::FLOW, pulsesPerLitre_); // report
  return true;                                 // nothing can fail here
}

void FlowSensor::setPulsesPerLitre(float ppl) {
  if (ppl > 1.0f) {                            // reject zero/negative or absurd values
    pulsesPerLitre_ = ppl;                     // accept the new constant
  }
}

SensorReading FlowSensor::readFlowLpm() {
  const int64_t now = esp_timer_get_time();    // end of this measuring window
  const uint32_t pulses = g_pulses.exchange(0u, std::memory_order_relaxed); // take and clear atomically
  const float dtS = static_cast<float>(now - lastReadUs_) / 1e6f; // window length in seconds
  lastReadUs_ = now;                           // next window starts here
  if (dtS <= 0.0f) {                           // should never happen
    return SensorReading{0.0f, false};         // invalid window
  }
  const float litres = static_cast<float>(pulses) / pulsesPerLitre_; // volume in this window
  totalLitres_ += litres;                      // update the running total
  const float lpm = litres / dtS * 60.0f;      // litres per second -> litres per minute
  return SensorReading{ema_.update(lpm), true};// smoothed; the sensor cannot report a fault: always valid
}
