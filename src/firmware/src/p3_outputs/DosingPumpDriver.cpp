// =============================================================================
// DosingPumpDriver.cpp - P3: timed dosing pulses (time critical stop path)
// =============================================================================
#include "p3_outputs/DosingPumpDriver.h"       // this module's interface

#include "logger.h"                            // LOGI/LOGE

namespace {                                    // private to this file
constexpr const char* TAG = "DOSING";          // log tag
}  // namespace

bool DosingPumpDriver::begin() {
  sw_.begin(false);                            // safe default: dosing OFF
  esp_timer_create_args_t args = {};           // zero all timer options
  args.callback = &DosingPumpDriver::onPulseEnd; // function called when the pulse ends
  args.arg = this;                             // give it this driver instance
  args.dispatch_method = ESP_TIMER_TASK;       // run from the esp_timer task (not an ISR)
  args.name = "dose_stop";                     // name for debugging
  if (esp_timer_create(&args, &timer_) != ESP_OK) { // allocate the timer
    LOGE(TAG, "timer creation failed: dosing disabled"); // without a stop timer we never dose
    timer_ = nullptr;                          // mark it unusable
    return false;                              // report the failure
  }
  LOGI(TAG, "OFF (safe default) on GPIO%u", sw_.pin()); // report it
  return true;                                 // ready
}

bool DosingPumpDriver::startPulse(uint32_t durationMs) {
  if (timer_ == nullptr || durationMs == 0 || durationMs > cfg::dosing::MAX_PULSE_MS) { // guard rails
    return false;                              // refuse impossible or dangerous pulses
  }
  if (sw_.isOn()) {                            // a pulse is already running
    return false;                              // never extend a running dose
  }
  sw_.set(true);                               // start pumping
  if (esp_timer_start_once(timer_, static_cast<uint64_t>(durationMs) * 1000ULL) != ESP_OK) { // arm the stop
    sw_.set(false);                            // timer failed: stop at once
    return false;                              // report the failure
  }
  return true;                                 // pulse running
}

void DosingPumpDriver::stop() {
  if (timer_ != nullptr) {                     // timer exists...
    esp_timer_stop(timer_);                    // ...cancel a pending stop (error if idle is harmless)
  }
  sw_.set(false);                              // pump OFF now
}

void DosingPumpDriver::onPulseEnd(void* arg) {
  static_cast<DosingPumpDriver*>(arg)->sw_.set(false); // end of pulse: pump OFF
}
