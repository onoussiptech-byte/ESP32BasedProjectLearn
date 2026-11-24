// =============================================================================
// SimulatedSensors.cpp - E1: first-order plant model for software-in-the-loop
// =============================================================================
#include "e1_sensors/SimulatedSensors.h"       // this module's interface

#include <esp_random.h>                        // hardware random numbers for sensor noise

#include "config.h"                            // pump minimum duty

namespace {                                    // private to this file

constexpr float PH_DRIFT_PER_S   = -0.0005f;   // fish waste slowly acidifies the water
constexpr float PH_DOSE_PER_S    = 0.02f;      // baking soda raises pH while the dosing pump runs
constexpr float AMBIENT_C        = 25.5f;      // room temperature the tank drifts toward
constexpr float TEMP_LOSS_PER_S  = 0.01f;      // heat-loss rate toward ambient (1/s)
constexpr float HEATER_C_PER_S   = 0.03f;      // warming rate with the heater on
constexpr float LPM_PER_PERCENT  = 0.016f;     // flow per % of pump duty (pump datasheet: 100 % -> 1.6 L/min)

float g_ph = 7.0f;                             // model state: pH
float g_tempC = 26.0f;                         // model state: temperature
float g_flowLpm = 0.0f;                        // model state: flow

// Small symmetric noise in [-amplitude, +amplitude]
float noise(float amplitude) {
  const float u = static_cast<float>(esp_random() % 2001u) / 1000.0f - 1.0f; // uniform in [-1, 1]
  return u * amplitude;                        // scale it
}

}  // namespace

namespace SimulatedSensors {

void begin() {
  g_ph = 7.0f;                                 // neutral start
  g_tempC = 26.0f;                             // warm Yaounde water
  g_flowLpm = 0.0f;                            // pump not running yet
}

void step(const ActuatorSnapshot& outputs, float dtS) {
  g_ph += PH_DRIFT_PER_S * dtS;                // slow acidification
  if (outputs.dosing) {                        // dosing pump running...
    g_ph += PH_DOSE_PER_S * dtS;               // ...pH rises
  }
  g_tempC += (AMBIENT_C - g_tempC) * TEMP_LOSS_PER_S * dtS; // relax toward ambient
  if (outputs.heater) {                        // heater on...
    g_tempC += HEATER_C_PER_S * dtS;           // ...water warms up
  }
  g_flowLpm = (outputs.pumpDuty >= cfg::pump::MIN_DUTY) // pump spinning?
                  ? outputs.pumpDuty * LPM_PER_PERCENT  // flow proportional to duty
                  : 0.0f;                               // stalled pump: no flow
}

SensorReading readPH() { return SensorReading{g_ph + noise(0.01f), true}; }          // pH with noise
SensorReading readTempC() { return SensorReading{g_tempC + noise(0.05f), true}; }    // deg C with noise
SensorReading readFlowLpm() { return SensorReading{g_flowLpm + (g_flowLpm > 0 ? noise(0.05f) : 0.0f), true}; } // L/min

}  // namespace SimulatedSensors
