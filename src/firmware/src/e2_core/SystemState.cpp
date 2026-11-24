// =============================================================================
// SystemState.cpp - E2: mutex-protected snapshots, atomic flags, command queue
// =============================================================================
#include "e2_core/SystemState.h"               // this module's interface

#include <atomic>                              // lock-free mode and alarm flags
#include <esp_timer.h>                         // 64-bit microsecond uptime

#include "config.h"                            // queue length, default setpoints
#include "logger.h"                            // LOGE

namespace {                                    // private to this file

constexpr const char* TAG = "STATE";           // log tag
constexpr TickType_t LOCK_WAIT = pdMS_TO_TICKS(50); // longest wait for the data mutex

SemaphoreHandle_t g_mutex = nullptr;           // protects the snapshot structures below
QueueHandle_t g_commands = nullptr;            // comms -> control command queue

SensorSnapshot g_sensors = {                   // measurements (invalid until the first cycle)
    {7.0f, false}, {25.0f, false}, {0.0f, false}, {true, false}, 0};
ActuatorSnapshot g_actuators = {0, true, false, false}; // outputs: safe defaults
Setpoints g_setpoints = {cfg::ph::SETPOINT_DEFAULT, cfg::temp::SETPOINT_DEFAULT}; // default targets

std::atomic<uint8_t> g_mode{static_cast<uint8_t>(Mode::Auto)}; // AUTO at boot
std::atomic<uint8_t> g_alarms{alarmbit::NONE}; // no alarm at boot

// RAII lock: takes the mutex in the constructor, releases it in the destructor
class Lock {
 public:
  Lock() : held_(g_mutex != nullptr && xSemaphoreTake(g_mutex, LOCK_WAIT) == pdTRUE) {} // try to lock
  ~Lock() {                                    // leaving the scope...
    if (held_) {                               // ...if we hold the lock
      xSemaphoreGive(g_mutex);                 // ...release it
    }
  }
  bool held() const { return held_; }          // true if the lock was obtained
 private:
  bool held_;                                  // lock state
};

}  // namespace

namespace SystemState {

bool begin() {
  g_mutex = xSemaphoreCreateMutex();           // data mutex (priority inheritance built in)
  g_commands = xQueueCreate(cfg::tasks::COMMAND_QUEUE_LENGTH, sizeof(Command)); // command queue
  if (g_mutex == nullptr || g_commands == nullptr) { // out of memory
    LOGE(TAG, "allocation failed");            // report it
    return false;                              // the system cannot run
  }
  return true;                                 // ready
}

void setSensors(const SensorSnapshot& s) {
  Lock lock;                                   // lock the store
  if (lock.held()) {                           // only write while locked
    g_sensors = s;                             // copy the snapshot
  }
}

SensorSnapshot getSensors() {
  Lock lock;                                   // lock the store
  return g_sensors;                            // copy out (a stale copy is acceptable if the lock timed out)
}

void setActuators(const ActuatorSnapshot& a) {
  Lock lock;                                   // lock the store
  if (lock.held()) {                           // only write while locked
    g_actuators = a;                           // copy the snapshot
  }
}

ActuatorSnapshot getActuators() {
  Lock lock;                                   // lock the store
  return g_actuators;                          // copy out
}

void setSetpoints(const Setpoints& sp) {
  Lock lock;                                   // lock the store
  if (lock.held()) {                           // only write while locked
    g_setpoints = sp;                          // copy the targets
  }
}

Setpoints getSetpoints() {
  Lock lock;                                   // lock the store
  return g_setpoints;                          // copy out
}

void setMode(Mode m) {
  g_mode.store(static_cast<uint8_t>(m));       // atomic write
}

Mode getMode() {
  return static_cast<Mode>(g_mode.load());     // atomic read
}

void setAlarm(uint8_t bits, bool active) {
  if (active) {                                // raise...
    g_alarms.fetch_or(bits);                   // ...set the bits atomically
  } else {                                     // clear...
    g_alarms.fetch_and(static_cast<uint8_t>(~bits)); // ...reset the bits atomically
  }
}

uint8_t getAlarms() {
  return g_alarms.load();                      // atomic read
}

uint32_t uptimeSeconds() {
  return static_cast<uint32_t>(esp_timer_get_time() / 1000000LL); // 64-bit clock: no 49-day wrap
}

StatusSnapshot getStatus() {
  StatusSnapshot st{};                         // zero-initialised result
  {                                            // locked section
    Lock lock;                                 // lock the store
    st.sensors = g_sensors;                    // measurements
    st.actuators = g_actuators;                // outputs
  }                                            // lock released here
  st.uptimeS = uptimeSeconds();                // uptime
  st.mode = getMode();                         // mode
  st.alarms = getAlarms();                     // alarms
  return st;                                   // consistent copy
}

bool postCommand(const Command& cmd, TickType_t wait) {
  return g_commands != nullptr && xQueueSend(g_commands, &cmd, wait) == pdTRUE; // copy into the queue
}

bool receiveCommand(Command& cmd, TickType_t wait) {
  return g_commands != nullptr && xQueueReceive(g_commands, &cmd, wait) == pdTRUE; // copy out of the queue
}

}  // namespace SystemState
