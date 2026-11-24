// =============================================================================
// main.cpp - AQUA-NODE firmware entry point (integration only)
// Smart Aquaponics, Local-Control Edition - ESP32 DevKit V1
//
// This file only wires the top-level E2 modules together:
//   1. shared state  2. outputs in their safe defaults  3. flash storage
//   4. sensors  5. control  6. safety  7. communication  8. FreeRTOS tasks
// All real work runs inside the FreeRTOS tasks created by TaskManager.
// =============================================================================
#include <Arduino.h>                           // Arduino core (setup/loop, Serial)

#include "config.h"                            // firmware name, version, periods
#include "logger.h"                            // LOGI/LOGE
#include "e2_core/SystemState.h"               // shared data and command queue
#include "e2_core/OutputManager.h"             // P3 drivers behind one gate
#include "e2_core/StorageManager.h"            // NVS settings
#include "e2_core/SensorManager.h"             // E1 sensors
#include "e2_core/ControlManager.h"            // control loops
#include "e2_core/SafetyManager.h"             // interlocks
#include "e2_core/CommManager.h"               // Wi-Fi, HTTP, Bluetooth
#include "e2_core/TaskManager.h"               // FreeRTOS scheduling

namespace {                                    // private to this file

// Unrecoverable start-up error: outputs are already safe, so wait and reboot
[[noreturn]] void fatal(const char* what) {
  LOGE("MAIN", "fatal: %s -> restart in 5 s", what); // report the reason
  delay(5000);                                 // leave time to read the message
  ESP.restart();                               // reboot into safe defaults
  for (;;) {}                                  // never reached
}

}  // namespace

void setup() {
  Serial.begin(115200);                        // USB serial for logs and JSON lines
  delay(200);                                  // let the USB-UART settle
  LOGI("MAIN", "%s firmware %s (%s, %s, sensors %s)", cfg::FW_NAME, cfg::FW_VERSION,
       SIM_MODE ? "SIM_MODE" : "hardware", BENCH_MODE ? "bench" : "rig",
       SIM_SENSORS ? "simulated" : "real drivers"); // banner

  if (!SystemState::begin()) fatal("shared state");  // 1. mutex + command queue (needed by all)
  OutputManager::begin();                      // 2. outputs to safe defaults as early as possible
  StorageManager::begin();                     // 3. flash settings (defaults if it fails)
  SensorManager::begin();                      // 4. sensors (missing sensors are reported, not fatal)
  ControlManager::begin();                     // 5. setpoints, AUTO mode
  SafetyManager::begin();                      // 6. first interlock evaluation
  CommManager::begin();                        // 7. Wi-Fi AP, web server, Bluetooth
  if (!TaskManager::startAll()) fatal("task creation"); // 8. hand over to FreeRTOS

  LOGI("MAIN", "system running");              // boot complete
}

void loop() {
  // The Arduino loop task (priority 1, core 1) only does low-priority diagnostics.
  TaskManager::logHealth();                    // free heap + stack margins (24 h acceptance test)
  vTaskDelay(pdMS_TO_TICKS(cfg::diag::HEALTH_LOG_PERIOD_MS)); // sleep one minute, lets idle run
}
