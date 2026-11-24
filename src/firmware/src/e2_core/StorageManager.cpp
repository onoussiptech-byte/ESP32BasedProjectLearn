// =============================================================================
// StorageManager.cpp - E2: Preferences (NVS) wrapper with a mutex
// =============================================================================
#include "e2_core/StorageManager.h"            // this module's interface

#include <Arduino.h>                           // FreeRTOS semaphores
#include <Preferences.h>                       // NVS key/value storage

#include "logger.h"                            // LOGI/LOGE

namespace {                                    // private to this file

constexpr const char* TAG = "STORAGE";         // log tag
constexpr const char* NAMESPACE = "aquanode";  // NVS namespace (max 15 chars)
constexpr const char* K_PH_SLOPE  = "ph_slope";// key: pH slope
constexpr const char* K_PH_OFFSET = "ph_offset";// key: pH offset
constexpr const char* K_PH_CALT   = "ph_cal_t";// key: calibration temperature
constexpr const char* K_FLOW_PPL  = "flow_ppl";// key: flow pulses per litre
constexpr const char* K_SP_PH     = "sp_ph";   // key: pH setpoint
constexpr const char* K_SP_TEMP   = "sp_temp"; // key: temperature setpoint

Preferences g_prefs;                           // NVS handle (kept open)
SemaphoreHandle_t g_mutex = nullptr;           // serialises flash access between tasks
bool g_open = false;                           // true once the namespace is open

// RAII lock for the storage mutex
class Lock {
 public:
  Lock() : held_(g_mutex != nullptr && xSemaphoreTake(g_mutex, portMAX_DELAY) == pdTRUE) {} // wait for it
  ~Lock() { if (held_) xSemaphoreGive(g_mutex); } // release on scope exit
  bool held() const { return held_ && g_open; }   // usable only if NVS is open too
 private:
  bool held_;                                  // lock state
};

}  // namespace

namespace StorageManager {

bool begin() {
  g_mutex = xSemaphoreCreateMutex();           // create the mutex
  g_open = g_prefs.begin(NAMESPACE, false);    // open read/write
  if (!g_open) {                               // NVS problem
    LOGE(TAG, "NVS open failed: defaults only"); // run with defaults
  } else {                                     // ready
    LOGI(TAG, "NVS namespace '%s' open", NAMESPACE); // report it
  }
  return g_open;                               // tell the caller
}

PhCalibration loadPhCalibration(const PhCalibration& d) {
  Lock lock;                                   // lock flash access
  if (!lock.held()) return d;                  // no storage: defaults
  return PhCalibration{g_prefs.getFloat(K_PH_SLOPE, d.slope),   // stored slope or default
                       g_prefs.getFloat(K_PH_OFFSET, d.offset), // stored offset or default
                       g_prefs.getFloat(K_PH_CALT, d.calTempC)};// stored temperature or default
}

bool savePhCalibration(const PhCalibration& c) {
  Lock lock;                                   // lock flash access
  if (!lock.held()) return false;              // no storage
  const bool ok = g_prefs.putFloat(K_PH_SLOPE, c.slope) > 0   // write slope
               && g_prefs.putFloat(K_PH_OFFSET, c.offset) > 0 // write offset
               && g_prefs.putFloat(K_PH_CALT, c.calTempC) > 0;// write temperature
  if (!ok) LOGE(TAG, "pH calibration save failed"); // report a failure
  return ok;                                   // result
}

float loadFlowPulsesPerLitre(float d) {
  Lock lock;                                   // lock flash access
  if (!lock.held()) return d;                  // no storage: default
  return g_prefs.getFloat(K_FLOW_PPL, d);      // stored or default
}

bool saveFlowPulsesPerLitre(float ppl) {
  Lock lock;                                   // lock flash access
  if (!lock.held()) return false;              // no storage
  return g_prefs.putFloat(K_FLOW_PPL, ppl) > 0;// write the constant
}

Setpoints loadSetpoints(const Setpoints& d) {
  Lock lock;                                   // lock flash access
  if (!lock.held()) return d;                  // no storage: defaults
  return Setpoints{g_prefs.getFloat(K_SP_PH, d.ph),         // stored pH target or default
                   g_prefs.getFloat(K_SP_TEMP, d.tempC)};   // stored temperature target or default
}

bool saveSetpoints(const Setpoints& sp) {
  Lock lock;                                   // lock flash access
  if (!lock.held()) return false;              // no storage
  const bool ok = g_prefs.putFloat(K_SP_PH, sp.ph) > 0      // write pH target
               && g_prefs.putFloat(K_SP_TEMP, sp.tempC) > 0;// write temperature target
  if (!ok) LOGE(TAG, "setpoint save failed");  // report a failure
  return ok;                                   // result
}

}  // namespace StorageManager
