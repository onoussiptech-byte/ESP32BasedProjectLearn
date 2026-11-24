// =============================================================================
// StorageManager.h - E2: persistent settings in flash (NVS via Preferences)
// pH calibration, flow constant and setpoints survive power cycles.
// =============================================================================
#pragma once                                   // include this header only once

#include "types.h"                             // PhCalibration, Setpoints

namespace StorageManager {                     // single-instance module

bool begin();                                  // open the NVS namespace

PhCalibration loadPhCalibration(const PhCalibration& defaults); // stored or default calibration
bool savePhCalibration(const PhCalibration& cal);              // write calibration

float loadFlowPulsesPerLitre(float defaultValue);              // stored or default flow constant
bool saveFlowPulsesPerLitre(float ppl);                        // write flow constant

Setpoints loadSetpoints(const Setpoints& defaults);            // stored or default setpoints
bool saveSetpoints(const Setpoints& sp);                       // write setpoints

}  // namespace StorageManager
