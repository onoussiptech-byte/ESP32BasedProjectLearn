// =============================================================================
// types.h - plain data types shared by every module
// Pure C++ (no Arduino dependency) so the structures can also be unit tested.
// =============================================================================
#pragma once                                   // include this header only once

#include <stdint.h>                            // fixed-width integer types

// ---- Generic measurement: a value plus a validity flag (ICD 4.5) ------------
template <typename T>                          // works for float, bool...
struct Reading {                               // one measurement result
  T value;                                     // the measured value
  bool valid;                                  // false when the sensor is missing or out of range
};

using SensorReading = Reading<float>;          // analog-style reading (pH, deg C, L/min)
using LevelReading  = Reading<bool>;           // float switch reading (true = water level OK)

// ---- Operating mode (ICD 4.4 "mode") ----------------------------------------
enum class Mode : uint8_t {                    // controller mode
  Auto   = 0,                                  // firmware controls every output
  Manual = 1                                   // phone controls pump and aerator (expires after 30 min)
};

// ---- Alarm bits (ICD 4.4 alarm codes) ---------------------------------------
namespace alarmbit {                           // bit mask constants, several can be active
constexpr uint8_t NONE         = 0;            // no alarm
constexpr uint8_t LOW_WATER    = 1u << 0;      // float switch reports low water
constexpr uint8_t NO_FLOW      = 1u << 1;      // pump runs but no flow is measured
constexpr uint8_t SENSOR_FAULT = 1u << 2;      // pH or temperature sensor invalid
constexpr uint8_t TEMP_RANGE   = 1u << 3;      // water temperature outside the safe band
constexpr uint8_t PH_RANGE     = 1u << 4;      // pH outside the safe band
}  // namespace alarmbit

// ---- Latest filtered measurements -------------------------------------------
struct SensorSnapshot {                        // produced by the sensing task
  SensorReading ph;                            // pH (temperature compensated)
  SensorReading tempC;                         // water temperature, deg C
  SensorReading flowLpm;                       // flow rate, L/min
  LevelReading levelOk;                        // true when the water level is fine
  uint32_t timestampMs;                        // millis() when the snapshot was taken
};

// ---- Real state of the outputs ------------------------------------------------
struct ActuatorSnapshot {                      // produced by the output manager
  uint8_t pumpDuty;                            // circulation pump duty, 0..100 %
  bool aerator;                                // air pump on/off
  bool dosing;                                 // dosing pump currently pulsing
  bool heater;                                 // heater demo on/off
};

// ---- Control targets ------------------------------------------------------------
struct Setpoints {                             // stored in flash
  float ph;                                    // pH target
  float tempC;                                 // water temperature target, deg C
};

// ---- Everything the phone sees (ICD 4.4 status message) -----------------------
struct StatusSnapshot {                        // consistent copy taken under one lock
  uint32_t uptimeS;                            // seconds since boot ("up")
  SensorSnapshot sensors;                      // latest measurements
  ActuatorSnapshot actuators;                  // latest output states
  Mode mode;                                   // AUTO or MANUAL
  uint8_t alarms;                              // active alarm bits
};

// ---- pH probe calibration (stored in flash) ------------------------------------
struct PhCalibration {                         // linear model pH = slope x V + offset
  float slope;                                 // pH per volt of board output
  float offset;                                // pH at 0 V of board output
  float calTempC;                              // buffer temperature during calibration
};

// ---- Commands from the phone (ICD 4.4) ------------------------------------------
enum class CommandType : uint8_t {             // which command was received
  SetOutputs,                                  // {"cmd":"set",...}
  SetMode,                                     // {"cmd":"mode",...}
  SetSetpoints,                                // {"cmd":"setpoint",...}
  Calibrate                                    // {"cmd":"cal",...}
};

enum class CommandSource : uint8_t {           // where the command came from (for logs)
  Http,                                        // POST /api/cmd over Wi-Fi
  Bluetooth,                                   // Bluetooth serial line
  Serial                                       // USB serial line (bench and SIM_MODE)
};

struct Command {                               // decoded, validated command
  CommandType type;                            // command kind
  CommandSource source;                        // origin of the command
  bool hasPump;                                // true if "pump" was given
  uint8_t pumpDuty;                            // requested pump duty, 0..100 %
  bool hasAerator;                             // true if "aer" was given
  bool aerator;                                // requested aerator state
  Mode mode;                                   // requested mode (SetMode)
  bool hasPh;                                  // true if a pH setpoint was given
  float ph;                                    // requested pH setpoint
  bool hasTemp;                                // true if a temperature setpoint was given
  float tempC;                                 // requested temperature setpoint
  float calBufferPh;                           // buffer value for a calibration step
};
