// =============================================================================
// TaskManager.cpp - E2: one generic periodic task runner for every top module
// =============================================================================
#include "e2_core/TaskManager.h"               // this module's interface

#include <Arduino.h>                           // FreeRTOS API, ESP object
#include <esp_task_wdt.h>                      // hardware task watchdog

#include "config.h"                            // task table values
#include "logger.h"                            // LOGI/LOGE
#include "e2_core/SystemState.h"               // uptime
#include "e2_core/SafetyManager.h"             // safety task body
#include "e2_core/ControlManager.h"            // control task body
#include "e2_core/SensorManager.h"             // sensing task body
#include "e2_core/CommManager.h"               // comms task body

namespace {                                    // private to this file

constexpr const char* TAG = "TASKS";           // log tag

// Description of one periodic task
struct TaskSpec {
  const char* name;                            // FreeRTOS task name
  void (*body)();                              // function run once per period
  uint32_t periodMs;                           // period
  uint32_t stackBytes;                         // stack size
  UBaseType_t priority;                        // FreeRTOS priority
  BaseType_t core;                             // CPU core (0 = protocol, 1 = application)
  bool watchdog;                               // true = must feed the 5 s task watchdog
  TaskHandle_t handle;                         // filled in by startAll()
};

// The task table (order = creation order: safety first). The comms task is not watched: the network library
// may wait up to 10 s for a phone that left the Wi-Fi, and losing the phone must not reset the system (ICD 4.6).
TaskSpec g_tasks[] = {
    {"safety",  SafetyManager::runCycle,  cfg::tasks::SAFETY_PERIOD_MS,  cfg::tasks::SAFETY_STACK,  cfg::tasks::SAFETY_PRIORITY,  cfg::tasks::SAFETY_CORE,  true,  nullptr},
    {"control", ControlManager::runCycle, cfg::tasks::CONTROL_PERIOD_MS, cfg::tasks::CONTROL_STACK, cfg::tasks::CONTROL_PRIORITY, cfg::tasks::CONTROL_CORE, true,  nullptr},
    {"sensing", SensorManager::runCycle,  cfg::tasks::SENSING_PERIOD_MS, cfg::tasks::SENSING_STACK, cfg::tasks::SENSING_PRIORITY, cfg::tasks::SENSING_CORE, true,  nullptr},
    {"comms",   CommManager::runCycle,    cfg::tasks::COMMS_PERIOD_MS,   cfg::tasks::COMMS_STACK,   cfg::tasks::COMMS_PRIORITY,   cfg::tasks::COMMS_CORE,   false, nullptr},
};

// Generic task body: subscribe to the watchdog, then run at a fixed rate forever
void taskEntry(void* arg) {
  TaskSpec* spec = static_cast<TaskSpec*>(arg);// which task we are
  if (spec->watchdog) {                        // critical task...
    esp_task_wdt_add(nullptr);                 // ...must feed the watchdog
  }
  TickType_t lastWake = xTaskGetTickCount();   // fixed-rate reference
  const TickType_t period = pdMS_TO_TICKS(spec->periodMs); // period in ticks
  for (;;) {                                   // tasks never return
    spec->body();                              // one cycle of the top module
    if (spec->watchdog) {                      // watched task...
      esp_task_wdt_reset();                    // ...proof of life
    }
    if (xTaskDelayUntil(&lastWake, period > 0 ? period : 1) == pdFALSE) { // sleep until the next period (no drift)
      vTaskDelay(1);                           // the cycle overran: still let lower tasks run...
      lastWake = xTaskGetTickCount();          // ...and restart the rhythm instead of running late cycles in a burst
    }
  }
}

// Configure the 5 s hardware watchdog with a reset (panic) on timeout
bool configureWatchdog() {
  esp_task_wdt_config_t wdt = {};              // zero all fields
  wdt.timeout_ms = cfg::wdt::TIMEOUT_MS;       // 5 s
  wdt.idle_core_mask = (1u << 0) | (1u << 1);  // also watch both idle tasks (CPU starvation)
  wdt.trigger_panic = true;                    // reset the chip instead of only printing
  esp_err_t err = esp_task_wdt_reconfigure(&wdt); // the Arduino core usually started it already
  if (err == ESP_ERR_INVALID_STATE) {          // not started yet...
    err = esp_task_wdt_init(&wdt);             // ...start it
  }
  return err == ESP_OK;                        // result
}

}  // namespace

namespace TaskManager {

bool startAll() {
  if (configureWatchdog()) {                   // watchdog ready
    LOGI(TAG, "task watchdog %lu ms, panic on timeout", (unsigned long)cfg::wdt::TIMEOUT_MS);
  } else {                                     // watchdog problem
    LOGE(TAG, "task watchdog configuration failed"); // keep running, but report it
  }
  bool ok = true;                              // overall result
  for (TaskSpec& t : g_tasks) {                // create every task
    const BaseType_t r = xTaskCreatePinnedToCore(taskEntry, t.name, t.stackBytes, &t, t.priority, &t.handle, t.core);
    if (r != pdPASS) {                         // creation failed (memory)
      LOGE(TAG, "cannot create task '%s'", t.name);
      ok = false;                              // remember the failure
    } else {                                   // created
      LOGI(TAG, "task %-8s prio %u core %d every %lu ms", t.name, (unsigned)t.priority, (int)t.core, (unsigned long)t.periodMs);
    }
  }
  return ok;                                   // true if every task runs
}

void logHealth() {
  LOGI(TAG, "up %lu s, heap free %lu B, min %lu B", (unsigned long)SystemState::uptimeSeconds(),
       (unsigned long)ESP.getFreeHeap(), (unsigned long)ESP.getMinFreeHeap()); // leak detection
  for (const TaskSpec& t : g_tasks) {          // stack margin of each task
    if (t.handle != nullptr) {                 // only created tasks
      LOGI(TAG, "  %-8s stack margin %lu B", t.name, (unsigned long)uxTaskGetStackHighWaterMark(t.handle));
    }
  }
}

}  // namespace TaskManager
