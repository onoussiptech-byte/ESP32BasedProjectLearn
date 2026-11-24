// =============================================================================
// logger.h - tiny, thread-safe-enough logging macros on the USB serial port
// Each macro formats one complete line and sends it in a single write, so lines
// from different FreeRTOS tasks do not interleave in the middle.
// =============================================================================
#pragma once                                   // include this header only once

#include <Arduino.h>                           // Serial and millis()

// Information message: [   12345] I TAG     : text
#define LOGI(tag, fmt, ...) Serial.printf("[%8lu] I %-8s: " fmt "\r\n", (unsigned long)millis(), tag, ##__VA_ARGS__)

// Warning message: something unexpected but the system keeps working
#define LOGW(tag, fmt, ...) Serial.printf("[%8lu] W %-8s: " fmt "\r\n", (unsigned long)millis(), tag, ##__VA_ARGS__)

// Error message: a function failed or a safety reaction was triggered
#define LOGE(tag, fmt, ...) Serial.printf("[%8lu] E %-8s: " fmt "\r\n", (unsigned long)millis(), tag, ##__VA_ARGS__)
