// =============================================================================
// CommManager.cpp - E2: Wi-Fi AP + HTTP server + Bluetooth SPP + USB serial
// =============================================================================
#include "e2_core/CommManager.h"               // this module's interface

#include <Arduino.h>                           // Stream, Serial, millis
#include <WiFi.h>                              // soft-AP / station
#include <WebServer.h>                         // synchronous HTTP server
#if !SIM_MODE                                  // Bluetooth is not simulated
#include <BluetoothSerial.h>                   // classic Bluetooth serial (SPP)
#endif                                         // end of !SIM_MODE

#include "config.h"                            // network settings
#include "types.h"                             // Command, StatusSnapshot
#include "logger.h"                            // LOGI/LOGW
#include "e2_core/SystemState.h"               // status snapshot and command queue
#include "e2_core/JsonProtocol.h"              // shared JSON builder/parser
#include "e2_core/DashboardPage.h"             // GET / page

namespace {                                    // private to this file

constexpr const char* TAG = "COMMS";           // log tag

// Collects characters until a newline, without heap allocation
struct LineReader {
  char buf[cfg::net::CMD_LINE_MAX];                // line storage
  size_t len = 0;                              // characters stored
  bool overflow = false;                       // line longer than the buffer
};

WebServer g_server(cfg::net::HTTP_PORT);       // HTTP server on port 80
#if !SIM_MODE                                  // real hardware only
BluetoothSerial g_bt;                          // Bluetooth serial port
bool g_btActive = false;                       // true when Bluetooth started
LineReader g_btLine;                           // Bluetooth input line
#endif                                         // end of !SIM_MODE
LineReader g_serialLine;                      // USB serial input line
uint32_t g_lastStatusMs = 0;                   // last status broadcast
bool g_manualQueued = false;                   // last accepted mode command was MANUAL
uint32_t g_manualQueuedMs = 0;                 // when it was accepted
#if SIM_MODE                                   // only the simulator uses station mode
uint32_t g_lastReconnectMs = 0;                // last station reconnect attempt (SIM_MODE)
#endif                                         // end of SIM_MODE

const char* sourceName(CommandSource s) {      // text for logs
  switch (s) {
    case CommandSource::Http:      return "http";
    case CommandSource::Bluetooth: return "bt";
    case CommandSource::Serial:    return "serial";
  }
  return "?";                                  // never reached
}

// True in MANUAL, or when a MANUAL command is already queued ahead of this one (the control task
// applies it within one period, so a phone may send "mode" and "set" back to back).
bool manualNowOrNext() {
  return SystemState::getMode() == Mode::Manual
      || (g_manualQueued && millis() - g_manualQueuedMs < 2 * cfg::tasks::CONTROL_PERIOD_MS);
}

// Validate one JSON command and queue it for the control task.
// Writes the reply into reply[] and returns true on success.
bool processCommandText(const char* text, size_t len, CommandSource src, char* reply, size_t replyLen) {
  Command cmd;                                 // decoded command
  const char* err = nullptr;                   // error text
  bool ok = JsonProtocol::parseCommand(text, len, cmd, err); // syntax + range checks
  if (ok && cmd.type == CommandType::SetOutputs && !manualNowOrNext()) { // ICD: set = MANUAL only
    ok = false;                                // reject
    err = "MANUAL mode required";              // tell the phone why
  }
  if (ok) {                                    // valid so far
    cmd.source = src;                          // remember the origin
    if (!SystemState::postCommand(cmd, 0)) {   // queue full (control task stuck?)
      ok = false;                              // reject
      err = "busy";                            // phone may retry
    } else if (cmd.type == CommandType::SetMode) { // remember the mode that is on its way
      g_manualQueued = (cmd.mode == Mode::Manual); // MANUAL or AUTO
      g_manualQueuedMs = millis();             // when
    }
  }
  if (!ok) {                                   // log rejected commands
    LOGW(TAG, "%s command rejected: %s", sourceName(src), err);
  }
  JsonProtocol::buildReply(ok, err, reply, replyLen); // {"ok":...}
  return ok;                                   // result
}

// ---- HTTP handlers -----------------------------------------------------------

void addCorsHeaders() {                        // allow pages/apps from other origins
  g_server.sendHeader("Access-Control-Allow-Origin", "*");
  g_server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  g_server.sendHeader("Cache-Control", "no-store"); // always fresh data
}

void handleRoot() {                            // GET /
  g_server.send(200, "text/html", DASHBOARD_HTML); // placeholder dashboard page
}

void handleStatus() {                          // GET /api/status
  char json[cfg::net::STATUS_JSON_MAX];        // stack buffer, no heap
  JsonProtocol::buildStatus(SystemState::getStatus(), json, sizeof(json)); // ICD 4.4 status
  addCorsHeaders();                            // headers
  g_server.send(200, "application/json", json);// reply
}

void handleCommand() {                         // POST /api/cmd
  char reply[cfg::net::REPLY_JSON_MAX];        // reply buffer
  addCorsHeaders();                            // headers
  if (!g_server.hasArg("plain")) {             // no body
    JsonProtocol::buildReply(false, "empty body", reply, sizeof(reply));
    g_server.send(400, "application/json", reply);
    return;                                    // done
  }
  const String& body = g_server.arg("plain");  // raw JSON body
  const bool ok = processCommandText(body.c_str(), body.length(), CommandSource::Http, reply, sizeof(reply));
  g_server.send(ok ? 200 : 400, "application/json", reply); // 200 accepted / 400 rejected
}

void handleOptions() {                         // CORS pre-flight for POST /api/cmd
  addCorsHeaders();                            // headers
  g_server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  g_server.send(204);                          // no content
}

void handleNotFound() {                        // any other URL
  g_server.send(404, "application/json", "{\"ok\":false,\"err\":\"not found\"}");
}

// ---- line-based JSON links (Bluetooth and USB serial) --------------------------

void pollStream(Stream& io, LineReader& line, CommandSource src) {
  while (io.available() > 0) {                 // consume everything received
    const char c = static_cast<char>(io.read());// next character
    if (c == '\n') {                           // end of message
      if (line.len > 0 && line.buf[line.len - 1] == '\r') { // strip a CR from CRLF
        --line.len;                            // drop it
      }
      if (line.overflow) {                     // line was too long
        char reply[cfg::net::REPLY_JSON_MAX];  // reply buffer
        JsonProtocol::buildReply(false, "line too long", reply, sizeof(reply));
        io.println(reply);                     // tell the sender
      } else if (line.len > 0 && line.buf[0] == '{') { // looks like JSON (log text is ignored)
        line.buf[line.len] = '\0';             // terminate the string
        char reply[cfg::net::REPLY_JSON_MAX];  // reply buffer
        processCommandText(line.buf, line.len, src, reply, sizeof(reply)); // validate + queue
        io.println(reply);                     // one reply line per command
      }
      line.len = 0;                            // start a new line
      line.overflow = false;                   // clear the flag
    } else if (line.len < sizeof(line.buf) - 1) { // room left (keep one byte for '\0')
      line.buf[line.len++] = c;                // store the character
    } else {                                   // buffer full
      line.overflow = true;                    // discard the rest of this line
    }
  }
}

void startWifi() {
#if SIM_MODE                                   // simulators cannot host a soft-AP
  WiFi.mode(WIFI_STA);                         // station mode
  WiFi.begin(cfg::net::SIM_SSID, cfg::net::SIM_PASSWORD, cfg::net::SIM_CHANNEL); // join the virtual network
  LOGI(TAG, "SIM_MODE: joining '%s' (station)", cfg::net::SIM_SSID);
#else                                          // real hardware: own access point
  const IPAddress ip(cfg::net::AP_IP[0], cfg::net::AP_IP[1], cfg::net::AP_IP[2], cfg::net::AP_IP[3]);         // 192.168.4.1
  const IPAddress mask(cfg::net::AP_MASK[0], cfg::net::AP_MASK[1], cfg::net::AP_MASK[2], cfg::net::AP_MASK[3]); // /24
  WiFi.mode(WIFI_AP);                          // access point only
  WiFi.softAPConfig(ip, ip, mask);             // fixed address, gateway = itself
  const bool ok = WiFi.softAP(cfg::net::AP_SSID, cfg::net::AP_PASSWORD, cfg::net::AP_CHANNEL, 0, cfg::net::AP_MAX_CLIENTS); // WPA2
  if (ok) {                                    // AP running
    LOGI(TAG, "Wi-Fi AP '%s' at %s", cfg::net::AP_SSID, WiFi.softAPIP().toString().c_str());
  } else {                                     // AP failed
    LOGW(TAG, "Wi-Fi AP start failed");        // Bluetooth/serial still work
  }
#endif                                         // end of Wi-Fi mode selection
}

void startBluetooth() {
#if !SIM_MODE                                  // real hardware only
  if (!cfg::net::BT_ENABLED) {                 // Wi-Fi-only fallback chosen in config
    LOGI(TAG, "Bluetooth disabled in config"); // report it
    return;                                    // skip
  }
  g_btActive = g_bt.begin(cfg::net::BT_NAME, false, true); // SPP slave; true = free the unused BLE memory
  if (g_btActive) {                            // running
    LOGI(TAG, "Bluetooth SPP '%s' ready", cfg::net::BT_NAME);
  } else {                                     // failed (memory with Wi-Fi?)
    LOGW(TAG, "Bluetooth start failed: Wi-Fi only"); // plan fallback
  }
#else                                          // simulation
  LOGI(TAG, "SIM_MODE: Bluetooth replaced by USB serial JSON lines");
#endif                                         // end of Bluetooth selection
}

}  // namespace

namespace CommManager {

bool begin() {
  startWifi();                                 // network first
  g_server.on("/", HTTP_GET, handleRoot);      // dashboard page
  g_server.on("/api/status", HTTP_GET, handleStatus); // status JSON
  g_server.on("/api/cmd", HTTP_POST, handleCommand);  // command JSON
  g_server.on("/api/cmd", HTTP_OPTIONS, handleOptions); // CORS pre-flight
  g_server.onNotFound(handleNotFound);         // everything else
  g_server.begin();                            // start listening
  LOGI(TAG, "HTTP server on port %u", cfg::net::HTTP_PORT);
  startBluetooth();                            // second link
  g_lastStatusMs = millis();                   // status timer reference
  return true;                                 // links are optional: never block boot
}

void runCycle() {
  const uint32_t now = millis();               // cycle time
  g_server.handleClient();                     // serve at most one pending HTTP request

#if !SIM_MODE                                  // real hardware
  if (g_btActive) {                            // Bluetooth running
    pollStream(g_bt, g_btLine, CommandSource::Bluetooth); // read command lines
  }
#else                                          // simulation: keep the station connected
  if (WiFi.status() != WL_CONNECTED && now - g_lastReconnectMs >= cfg::net::SIM_RECONNECT_MS) {
    g_lastReconnectMs = now;                   // rate-limit attempts
    WiFi.reconnect();                          // try again
  }
#endif                                         // end of link-specific polling
  pollStream(Serial, g_serialLine, CommandSource::Serial); // USB serial commands (bench and SIM)

  if (now - g_lastStatusMs >= cfg::net::STATUS_PERIOD_MS) { // once per second
    g_lastStatusMs = now;                      // restart the period
    char json[cfg::net::STATUS_JSON_MAX];      // stack buffer
    if (JsonProtocol::buildStatus(SystemState::getStatus(), json, sizeof(json)) > 0) { // build the line
#if !SIM_MODE                                  // real hardware
      if (g_btActive && g_bt.hasClient()) {    // only when a phone is connected
        g_bt.println(json);                    // one JSON message per line (ICD 4.3)
      }
#endif                                         // end of Bluetooth output
      if (cfg::net::SERIAL_STATUS_STREAM) {    // SIM_MODE: Bluetooth stand-in
        Serial.println(json);                  // same line on USB
      }
    }
  }
}

}  // namespace CommManager
