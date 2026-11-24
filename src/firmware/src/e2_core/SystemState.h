// =============================================================================
// SystemState.h - E2: thread-safe shared data between the FreeRTOS tasks
// The top modules never call each other's internals: they exchange data only
// through this store (mutex-protected snapshots + atomic flags) and through
// the command queue (comms task -> control task). This keeps them loosely coupled.
// =============================================================================
#pragma once                                   // include this header only once

#include <Arduino.h>                           // FreeRTOS TickType_t

#include "types.h"                             // snapshots, Command, Mode, Setpoints

namespace SystemState {                        // single-instance module

bool begin();                                  // create the mutex and the command queue

void setSensors(const SensorSnapshot& s);      // sensing task publishes measurements
SensorSnapshot getSensors();                   // copy of the latest measurements

void setActuators(const ActuatorSnapshot& a);  // output manager publishes real output states
ActuatorSnapshot getActuators();               // copy of the latest output states

void setSetpoints(const Setpoints& sp);        // control task publishes targets
Setpoints getSetpoints();                      // copy of the targets

void setMode(Mode m);                          // AUTO or MANUAL
Mode getMode();                                // current mode (lock-free)

void setAlarm(uint8_t bits, bool active);      // raise or clear alarm bits (lock-free)
uint8_t getAlarms();                           // active alarm bits (lock-free)

uint32_t uptimeSeconds();                      // seconds since boot
StatusSnapshot getStatus();                    // consistent copy of everything for the phone

bool postCommand(const Command& cmd, TickType_t wait);   // comms -> control; false if the queue is full
bool receiveCommand(Command& cmd, TickType_t wait);      // control takes the next command; false if none

}  // namespace SystemState
