// =============================================================================
// OutputManager.h - E2: the single gate between control decisions and P3 drivers
// Control code only *requests* outputs. Safety code sets *inhibits*. service()
// (safety task, 100 ms) combines both, so a safety inhibit always wins.
// =============================================================================
#pragma once                                   // include this header only once

#include <stdint.h>                            // fixed-width integer types

#include "types.h"                             // ActuatorSnapshot

namespace OutputManager {                      // single-instance module

bool begin();                                  // init every driver in its safe default (ICD 4.6)

void requestPumpDuty(uint8_t percent);         // control: pump duty 0..100 %
void requestAerator(bool on);                  // control: aerator on/off
void requestHeater(bool on);                   // control: heater on/off
bool requestDosePulse(uint32_t durationMs);    // control: one dosing pulse; false if refused/inhibited

void setPumpInhibit(bool inhibit);             // safety: force the pump OFF
void setDosingInhibit(bool inhibit);           // safety: forbid and stop dosing
void setHeaterInhibit(bool inhibit);           // safety: force the heater OFF
void setAlarmIndication(bool alarm);           // safety: status LED pattern

void service(uint32_t elapsedMs);              // apply requests + inhibits, run ramps (every 100 ms)
ActuatorSnapshot snapshot();                   // real state of every output

}  // namespace OutputManager
