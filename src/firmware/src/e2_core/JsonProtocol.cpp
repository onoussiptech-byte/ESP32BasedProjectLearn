// =============================================================================
// JsonProtocol.cpp - E2: ICD 4.4 message formats
// The status builder is plain C/C++ (snprintf, no heap) because it runs every
// second on every link. Commands are rare, so they use ArduinoJson.
// =============================================================================
#include "e2_core/JsonProtocol.h"              // this module's interface

#include <ArduinoJson.h>                       // command parsing
#include <stdio.h>                             // snprintf
#include <stdlib.h>                            // strtof
#include <string.h>                            // strcmp

#include "config.h"                            // setpoint limits

namespace {                                    // private to this file

constexpr float CAL_BUFFERS[] = {4.01f, 6.86f, 7.00f, 9.18f}; // accepted pH buffers

// Accept a 0/1 integer or a true/false boolean
bool readSwitch(JsonVariantConst v, bool& out) {
  if (v.is<bool>()) { out = v.as<bool>(); return true; } // true / false
  if (v.is<int>()) {                           // 0 / 1
    const int i = v.as<int>();                 // integer value
    if (i == 0 || i == 1) { out = (i == 1); return true; } // only 0 or 1
  }
  return false;                                // anything else is invalid
}

bool isCalBuffer(float ph) {                   // one of the standard buffers?
  for (float b : CAL_BUFFERS) {                // check each
    if (ph > b - 0.005f && ph < b + 0.005f) return true; // match
  }
  return false;                                // no match
}

}  // namespace

namespace JsonProtocol {

const char* alarmCode(uint8_t a) {
  if (a & alarmbit::LOW_WATER)    return "LOW_WATER";    // most urgent: dry pump
  if (a & alarmbit::NO_FLOW)      return "NO_FLOW";      // blocked pipe / dead pump
  if (a & alarmbit::SENSOR_FAULT) return "SENSOR_FAULT"; // control is partly blind
  if (a & alarmbit::TEMP_RANGE)   return "TEMP_RANGE";   // fish stress
  if (a & alarmbit::PH_RANGE)     return "PH_RANGE";     // fish/plant stress
  return "";                                   // no alarm
}

size_t buildStatus(const StatusSnapshot& s, char* buf, size_t len) {
  const int n = snprintf(buf, len,             // format into the caller's buffer
      "{\"up\":%lu,\"ph\":%.2f,\"temp\":%.1f,\"flow\":%.1f,\"level\":%u,"
      "\"pump\":%u,\"aer\":%u,\"dose\":%u,\"heat\":%u,\"mode\":\"%s\",\"alarm\":\"%s\"}",
      (unsigned long)s.uptimeS,                // "up": seconds since boot
      s.sensors.ph.value,                      // "ph": 2 decimals
      s.sensors.tempC.value,                   // "temp": 1 decimal
      s.sensors.flowLpm.value,                 // "flow": 1 decimal
      s.sensors.levelOk.value ? 1u : 0u,       // "level": 1 = OK, 0 = low water
      (unsigned)s.actuators.pumpDuty,          // "pump": duty %
      s.actuators.aerator ? 1u : 0u,           // "aer": 0/1
      s.actuators.dosing ? 1u : 0u,            // "dose": 0/1
      s.actuators.heater ? 1u : 0u,            // "heat": 0/1
      s.mode == Mode::Manual ? "MANUAL" : "AUTO", // "mode"
      alarmCode(s.alarms));                    // "alarm": highest-priority code
  return (n > 0 && static_cast<size_t>(n) < len) ? static_cast<size_t>(n) : 0; // 0 if truncated
}

size_t buildReply(bool ok, const char* error, char* buf, size_t len) {
  const int n = ok ? snprintf(buf, len, "{\"ok\":true}")                       // success
                   : snprintf(buf, len, "{\"ok\":false,\"err\":\"%s\"}", error); // failure with reason
  return (n > 0 && static_cast<size_t>(n) < len) ? static_cast<size_t>(n) : 0; // 0 if truncated
}

bool parseCommand(const char* json, size_t length, Command& out, const char*& error) {
  out = Command{};                             // start from a clean command
  JsonDocument doc;                            // small temporary document (freed on return)
  if (deserializeJson(doc, json, length)) {    // syntax error?
    error = "bad json";                        // report it
    return false;                              // reject
  }
  const char* cmd = doc["cmd"] | "";           // command name ("" if missing)

  if (strcmp(cmd, "set") == 0) {               // ---- {"cmd":"set","pump":70} / {"cmd":"set","aer":1}
    out.type = CommandType::SetOutputs;        // command type
    JsonVariantConst pump = doc["pump"];       // optional pump duty
    if (!pump.isNull()) {                      // given?
      const float duty = pump.as<float>();     // a phone slider may send 70 or 70.4
      if (!pump.is<float>() || !(duty >= 0.0f && duty <= 100.0f)) { error = "pump 0-100"; return false; }
      out.hasPump = true;                      // remember it was given
      out.pumpDuty = static_cast<uint8_t>(duty + 0.5f); // round to a whole percent
    }
    JsonVariantConst aer = doc["aer"];         // optional aerator state
    if (!aer.isNull()) {                       // given?
      if (!readSwitch(aer, out.aerator)) { error = "aer 0/1"; return false; }
      out.hasAerator = true;                   // remember it was given
    }
    if (!out.hasPump && !out.hasAerator) { error = "nothing to set"; return false; } // empty command
    return true;                               // valid
  }

  if (strcmp(cmd, "mode") == 0) {             // ---- {"cmd":"mode","value":"AUTO"}
    out.type = CommandType::SetMode;           // command type
    const char* v = doc["value"] | "";         // requested mode
    if (strcmp(v, "AUTO") == 0) { out.mode = Mode::Auto; return true; }     // AUTO
    if (strcmp(v, "MANUAL") == 0) { out.mode = Mode::Manual; return true; } // MANUAL
    error = "value AUTO|MANUAL";               // anything else
    return false;                              // reject
  }

  if (strcmp(cmd, "setpoint") == 0) {         // ---- {"cmd":"setpoint","ph":6.8,"temp":27}
    out.type = CommandType::SetSetpoints;      // command type
    JsonVariantConst ph = doc["ph"];           // optional pH target
    if (!ph.isNull()) {                        // given?
      const float v = ph.as<float>();          // numeric value
      if (!ph.is<float>() || v < cfg::ph::SETPOINT_MIN || v > cfg::ph::SETPOINT_MAX) { error = "ph out of range"; return false; }
      out.hasPh = true;                        // remember it was given
      out.ph = v;                              // store it
    }
    JsonVariantConst t = doc["temp"];          // optional temperature target
    if (!t.isNull()) {                         // given?
      const float v = t.as<float>();           // numeric value
      if (!t.is<float>() || v < cfg::temp::SETPOINT_MIN || v > cfg::temp::SETPOINT_MAX) { error = "temp out of range"; return false; }
      out.hasTemp = true;                      // remember it was given
      out.tempC = v;                           // store it
    }
    if (!out.hasPh && !out.hasTemp) { error = "nothing to set"; return false; } // empty command
    return true;                               // valid
  }

  if (strcmp(cmd, "cal") == 0) {              // ---- {"cmd":"cal","ph":"7.00"}
    out.type = CommandType::Calibrate;         // command type
    JsonVariantConst ph = doc["ph"];           // buffer value (string per ICD, number also accepted)
    float v = 0.0f;                            // parsed buffer value
    if (ph.is<const char*>()) {                // "7.00"
      v = strtof(ph.as<const char*>(), nullptr); // text -> float
    } else if (ph.is<float>()) {               // 7.00
      v = ph.as<float>();                      // number
    }
    if (!isCalBuffer(v)) { error = "ph buffer 4.01|6.86|7.00|9.18"; return false; } // unknown buffer
    out.calBufferPh = v;                       // store it
    return true;                               // valid
  }

  error = "unknown cmd";                       // not in the ICD
  return false;                                // reject
}

}  // namespace JsonProtocol
