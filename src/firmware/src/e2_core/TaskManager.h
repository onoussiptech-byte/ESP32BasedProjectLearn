// =============================================================================
// TaskManager.h - E2: FreeRTOS task creation, scheduling and watchdog
//
//   Task     Period   Priority  Core  Body
//   safety   100 ms   5 (high)  1     SafetyManager::runCycle
//   control  1 s      4         1     ControlManager::runCycle
//   sensing  1 s      3         1     SensorManager::runCycle
//   comms    10 ms    2         0     CommManager::runCycle (next to Wi-Fi/BT)
//
// Periodic tasks use vTaskDelayUntil (fixed rate, no drift). Every task is
// subscribed to the 5 s hardware task watchdog: if any task hangs, the ESP32
// resets and boots into the safe defaults.
// =============================================================================
#pragma once                                   // include this header only once

namespace TaskManager {                        // single-instance module

bool startAll();                               // configure the watchdog and create every task
void logHealth();                              // print heap and stack margins (24 h test)

}  // namespace TaskManager
