// =============================================================================
// CommManager.h - E2: local links only, no internet (ICD 4.3) (comms task)
//   Wi-Fi   : access point AQUA-NODE at 192.168.4.1 (SIM_MODE: joins Wokwi-GUEST)
//   HTTP    : GET /, GET /api/status, POST /api/cmd
//   BT SPP  : device AQUA-NODE, one JSON message per line, status every 1 s
//   Serial  : same JSON lines on USB (bench tests, and Bluetooth stand-in in SIM_MODE)
// Commands are validated here, then queued to the control task.
// =============================================================================
#pragma once                                   // include this header only once

namespace CommManager {                        // single-instance module

bool begin();                                  // start Wi-Fi, web server and Bluetooth
void runCycle();                               // comms task body (polled every 10 ms)

}  // namespace CommManager
