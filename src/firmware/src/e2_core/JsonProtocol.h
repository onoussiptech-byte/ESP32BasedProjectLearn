// =============================================================================
// JsonProtocol.h - E2: one shared JSON builder and command parser (ICD 4.4)
// Used identically by the HTTP server, Bluetooth serial and USB serial, so the
// three links can never disagree on field names.
// =============================================================================
#pragma once                                   // include this header only once

#include <stddef.h>                            // size_t
#include <stdint.h>                            // uint8_t

#include "types.h"                             // StatusSnapshot, Command

namespace JsonProtocol {                       // stateless module

// Status message, e.g. {"up":3600,"ph":6.82,...,"mode":"AUTO","alarm":""}
// Allocation-free (snprintf into the caller's buffer). Returns the length, 0 on overflow.
size_t buildStatus(const StatusSnapshot& s, char* buf, size_t len);

// Parse and validate a command line. On failure, error points to a short static text.
bool parseCommand(const char* json, size_t length, Command& out, const char*& error);

// Reply to a command: {"ok":true} or {"ok":false,"err":"..."}. Returns the length.
size_t buildReply(bool ok, const char* error, char* buf, size_t len);

// Highest-priority alarm code for the "alarm" field ("" when none)
const char* alarmCode(uint8_t alarms);

}  // namespace JsonProtocol
