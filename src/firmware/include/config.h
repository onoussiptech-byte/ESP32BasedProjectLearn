// =============================================================================
// config.h - single source of truth for pins, thresholds, timings and tasks
// Smart Aquaponics, Local-Control Edition (AQUA-NODE firmware)
//
// Every value here follows the Interface Control Document (ICD, plan section 4).
// Do not change pins, endpoints or safe defaults without the tech lead's approval.
// =============================================================================
#pragma once                                   // include this header only once per translation unit

#include <stdint.h>                            // fixed-width integer types (uint8_t, uint32_t...)

// ---- Build switches (normally set from platformio.ini) ----------------------
#ifndef SIM_MODE                               // if the build did not define SIM_MODE...
#define SIM_MODE 0                             // ...default to real hardware
#endif                                         // end of SIM_MODE default

#ifndef SIM_SENSORS                            // if the build did not define SIM_SENSORS...
#define SIM_SENSORS SIM_MODE                   // ...plant model follows SIM_MODE (1 = fake pH/temp/flow)
#endif                                         // SIM_MODE=1 + SIM_SENSORS=0: real drivers read Wokwi parts

#ifndef PH_ADC_FALLBACK                        // if the build did not choose the pH fallback...
#define PH_ADC_FALLBACK SIM_MODE               // ...only simulations read pH on GPIO 35: on hardware a floating
#endif                                         // pin could look like a pH, so a missing ADS1115 = SENSOR_FAULT

#ifndef BENCH_MODE                             // if the build did not define BENCH_MODE...
#define BENCH_MODE 1                           // ...default to the short bench mixing wait
#endif                                         // end of BENCH_MODE default

namespace cfg {                                // all configuration lives in the cfg namespace

// ---- Firmware identity ------------------------------------------------------
constexpr const char* FW_NAME    = "AQUA-NODE"; // product / device name
constexpr const char* FW_VERSION = "0.1.0";     // firmware version printed at boot

// ---- ESP32 pin map (ICD 4.2, DevKit V1 30 pin) ------------------------------
namespace pins {                               // GPIO assignments
constexpr uint8_t I2C_SDA         = 21;        // I2C data line to the ADS1115
constexpr uint8_t I2C_SCL         = 22;        // I2C clock line to the ADS1115
constexpr uint8_t DS18B20         = 4;         // 1-Wire data (4.7 kOhm pull-up to 3.3 V)
constexpr uint8_t FLOW            = 34;        // YF-S201 pulses via 10k/15k divider (input only)
constexpr uint8_t FLOAT_SWITCH    = 27;        // float switch to GND, internal pull-up (LOW = low water)
constexpr uint8_t PUMP_PWM        = 25;        // MOSFET Q1 gate, circulation pump PWM
constexpr uint8_t AERATOR         = 26;        // MOSFET Q2 gate, air pump
constexpr uint8_t DOSING          = 33;        // MOSFET Q3 gate, dosing pump (5 V rail)
constexpr uint8_t HEATER          = 32;        // MOSFET Q4 gate, heater demo resistors
constexpr uint8_t STATUS_LED      = 2;         // on-board LED
constexpr uint8_t PH_FALLBACK_ADC = 35;        // ADC1 pin used for pH only if the ADS1115 is missing
}  // namespace pins

// ---- ADS1115 external ADC (ICD 4.2) -----------------------------------------
namespace ads {                                // ADS1115 settings
constexpr uint8_t  I2C_ADDRESS  = 0x48;        // ADDR pin to GND
constexpr uint32_t I2C_CLOCK_HZ = 400000;      // fast-mode I2C
constexpr uint8_t  CH_PH        = 0;           // A0 = pH board output through the divider
constexpr uint8_t  CH_TDS       = 1;           // A1 = reserved for TDS/EC (phase 2)
constexpr uint8_t  CH_RAIL_12V  = 2;           // A2 = spare, optional 12 V rail monitor
constexpr uint8_t  CH_RAIL_5V   = 3;           // A3 = spare, optional 5 V rail monitor
constexpr uint32_t CONVERSION_TIMEOUT_MS = 20; // a 128 SPS conversion takes about 8 ms: give up after this
constexpr uint32_t MUTEX_WAIT_MS = 100;        // longest wait for the shared I2C bus
}  // namespace ads

// ---- FreeRTOS tasks (plan E2: sensing 1 s, control 1 s, comms event, safety 100 ms)
namespace tasks {                              // task periods, priorities, stacks and cores
constexpr uint32_t SAFETY_PERIOD_MS  = 100;    // safety task period
constexpr uint32_t CONTROL_PERIOD_MS = 1000;   // control task period
constexpr uint32_t SENSING_PERIOD_MS = 1000;   // sensing task period
constexpr uint32_t COMMS_PERIOD_MS   = 10;     // comms polling period (keeps HTTP/BT responsive)

constexpr uint32_t SAFETY_PRIORITY   = 5;      // highest: protects fish and hardware
constexpr uint32_t CONTROL_PRIORITY  = 4;      // control loops
constexpr uint32_t SENSING_PRIORITY  = 3;      // measurement
constexpr uint32_t COMMS_PRIORITY    = 2;      // lowest of ours: phone link is not safety critical

constexpr uint32_t SAFETY_STACK      = 4096;   // bytes of stack for the safety task
constexpr uint32_t CONTROL_STACK     = 6144;   // bytes for control (NVS writes need room)
constexpr uint32_t SENSING_STACK     = 6144;   // bytes for sensing (I2C, 1-Wire, filters)
constexpr uint32_t COMMS_STACK       = 8192;   // bytes for comms (WebServer, JSON, Bluetooth)

constexpr int SAFETY_CORE  = 1;                // application core
constexpr int CONTROL_CORE = 1;                // application core
constexpr int SENSING_CORE = 1;                // application core
constexpr int COMMS_CORE   = 0;                // protocol core, next to the Wi-Fi/BT stacks

constexpr uint32_t COMMAND_QUEUE_LENGTH = 8;   // commands buffered between comms and control
}  // namespace tasks

// ---- Hardware task watchdog --------------------------------------------------
namespace wdt {                                // ESP-IDF task watchdog
constexpr uint32_t TIMEOUT_MS = 5000;          // 5 s hardware watchdog (plan E2)
}  // namespace wdt

// ---- pH measurement and control (plan E1 / E2) -------------------------------
namespace ph {                                 // pH constants
constexpr float DIVIDER_RATIO     = 15.0f / (10.0f + 15.0f); // 10k/15k divider: Vadc = 0.6 x Vboard
constexpr float BOARD_V_MIN_VALID = 0.10f;     // below this the board/probe is unplugged
constexpr float BOARD_V_MAX_VALID = 4.90f;     // above this the board output is saturated
constexpr float DEFAULT_SLOPE     = -5.56f;    // pH per volt before calibration (about -0.18 V/pH)
constexpr float DEFAULT_OFFSET    = 20.9f;     // pH at 0 V before calibration (pH 7 at 2.5 V)
constexpr float DEFAULT_CAL_TEMP  = 25.0f;     // temperature of the default calibration, deg C
constexpr float MIN_ABS_SLOPE     = 2.0f;      // calibration rejected if |slope| is below this
constexpr float MAX_ABS_SLOPE     = 15.0f;     // calibration rejected if |slope| is above this
constexpr float MIN_CAL_SPAN_V    = 0.10f;     // two buffers must differ by at least this voltage
constexpr float EMA_ALPHA         = 0.30f;     // exponential average weight of a new sample
constexpr uint8_t BURST_SAMPLES   = 5;         // samples taken per reading (median of 5)
constexpr float VALID_MIN         = 0.0f;      // lowest physically possible pH
constexpr float VALID_MAX         = 14.0f;     // highest physically possible pH
constexpr float ALARM_LOW         = 6.0f;      // PH_RANGE alarm below this
constexpr float ALARM_HIGH        = 7.5f;      // PH_RANGE alarm above this
constexpr float SETPOINT_DEFAULT  = 6.8f;      // default pH target
constexpr float SETPOINT_MIN      = 6.0f;      // lowest pH setpoint accepted from the phone (= ALARM_LOW; FAO 2014: 6-7)
constexpr float SETPOINT_MAX      = 7.5f;      // highest pH setpoint accepted (= ALARM_HIGH; SRAC-5007: 6.5-7.5)
constexpr float DOSE_DEADBAND     = 0.2f;      // dose only when pH < setpoint - deadband
constexpr float DOSE_MIN_PH       = 5.0f;      // never dose below this: probe in a buffer or faulty, not tank water
constexpr float COMPENSATION_FALLBACK_C = 25.0f; // temperature used if the DS18B20 is invalid
}  // namespace ph

// ---- Water temperature (plan E1 / E2) ----------------------------------------
namespace temp {                               // temperature constants
constexpr uint8_t RESOLUTION_BITS = 12;        // DS18B20 resolution (0.0625 deg C, 750 ms conversion)
constexpr float EMA_ALPHA         = 0.40f;     // exponential average weight of a new sample
constexpr float VALID_MIN         = -10.0f;    // readings below this are rejected
constexpr float VALID_MAX         = 60.0f;     // readings above this are rejected (85 = power-on value)
constexpr uint8_t MAX_FAILS       = 3;         // consecutive failures before re-scanning the bus
constexpr float ALARM_LOW         = 20.0f;     // TEMP_RANGE alarm below this
constexpr float ALARM_HIGH        = 32.0f;     // TEMP_RANGE alarm above this
constexpr float SETPOINT_DEFAULT  = 27.0f;     // default water temperature target
constexpr float SETPOINT_MIN      = 20.0f;     // lowest temperature setpoint accepted (= ALARM_LOW, inside the bacteria 17-34 C)
constexpr float SETPOINT_MAX      = 32.0f;     // highest temperature setpoint accepted
constexpr float HYSTERESIS        = 0.5f;      // heater on/off band, +/- deg C
}  // namespace temp

// ---- Flow sensor (plan E1) ---------------------------------------------------
namespace flow {                               // YF-S201 constants
constexpr float PULSES_PER_LITRE  = 450.0f;    // nominal; about 7.5 Hz per L/min
constexpr uint32_t GLITCH_US      = 1000;      // ignore edges closer than 1 ms (max ~1000 Hz)
constexpr float EMA_ALPHA         = 0.40f;     // smoothing: 1 pulse per second is already 0.13 L/min
constexpr float SETPOINT_LPM      = 1.4f;      // AUTO flow target (pump datasheet: 1.6 L/min max, sensor: 1 L/min min)
constexpr float NO_FLOW_LPM       = 0.5f;      // below this the pipe is considered dry/blocked
constexpr uint32_t NO_FLOW_DELAY_MS = 20000;   // NO_FLOW after this long: longer than the PID boot hold, so the
                                               // PID can first raise a 60 % duty that is too slow for the sensor
}  // namespace flow

// ---- Water of the rig (FAO 2014, section 4.2.4: move the whole volume 1 to 2 times per hour)
namespace water {                              // water volume and turnover
constexpr float SYSTEM_VOLUME_L     = 40.0f;   // all the water of the rig, litres: two ~20 L buckets (measure yours)
constexpr float MIN_TURNOVERS_PER_H = 1.0f;    // FAO: once per hour at low fish density (twice when densely stocked)
constexpr float TURNOVERS_PER_H     = flow::SETPOINT_LPM * 60.0f / SYSTEM_VOLUME_L; // what the AUTO flow target gives
static_assert(TURNOVERS_PER_H >= MIN_TURNOVERS_PER_H,
              "flow target too low for this water volume: raise flow::SETPOINT_LPM or use less water");
}  // namespace water

// ---- Float switch (plan E1) --------------------------------------------------
namespace level {                              // low-water switch constants
constexpr uint8_t DEBOUNCE_SAMPLES = 3;        // 3 x 100 ms = trips in about 0.3 s (< 1 s target)
constexpr uint8_t RECOVER_SAMPLES  = 30;       // 30 x 100 ms = 3 s of good level before the pump may restart
}  // namespace level

// ---- Circulation pump (plan P3 / E2) -----------------------------------------
namespace pump {                               // pump driver and controller constants
constexpr uint32_t PWM_FREQ_HZ    = 20000;     // 20 kHz LEDC: above hearing, no whine
constexpr uint8_t PWM_RES_BITS    = 10;        // 10-bit duty resolution (0..1023)
constexpr uint8_t BOOT_DUTY       = 60;        // safe default after boot (ICD 4.6)
constexpr uint8_t MIN_DUTY        = 30;        // smallest duty that starts the pump (measure on rig)
constexpr uint32_t RAMP_TIME_MS   = 1000;      // 0 -> 100 % soft-start time
constexpr bool PID_ENABLED        = true;      // AUTO uses PID on flow when true
constexpr float PID_KP            = 8.0f;      // proportional gain, % duty per L/min
constexpr float PID_KI            = 2.0f;      // integral gain, % duty per (L/min x s)
constexpr float PID_KD            = 0.0f;      // derivative gain (off: flow signal is noisy)
constexpr uint32_t PID_START_DELAY_MS = 10000; // hold boot duty this long before the PID takes over
}  // namespace pump

// ---- Dosing pump (plan E2: dose a pulse, then wait for mixing) ---------------
namespace dosing {                             // dosing constants
constexpr uint32_t PULSE_MS       = 2000;      // one dose pulse of base solution
constexpr uint32_t MAX_PULSE_MS   = 10000;     // driver refuses longer pulses
#if BENCH_MODE                                 // bench test: small container mixes fast
constexpr uint32_t MIX_WAIT_MS    = 90UL * 1000UL;   // 1.5 min wait before re-measuring
#else                                          // water rig: buckets mix slowly
constexpr uint32_t MIX_WAIT_MS    = 10UL * 60UL * 1000UL; // 10 min wait before re-measuring
#endif                                         // end of BENCH_MODE selection
#if SIM_MODE                                   // simulations start dosing tests sooner
constexpr uint32_t BOOT_HOLD_MS   = 10000;     // no dose during the first 10 s
#else                                          // real hardware
constexpr uint32_t BOOT_HOLD_MS   = MIX_WAIT_MS; // a reset loop must not become continuous dosing
#endif                                         // end of boot hold selection
constexpr uint8_t MAX_DOSES_PER_HOUR = 4;      // hard limit against overdosing
}  // namespace dosing

// ---- Operating modes (ICD 4.6) -----------------------------------------------
namespace mode {                               // mode constants
constexpr uint32_t MANUAL_TIMEOUT_MS = 30UL * 60UL * 1000UL; // manual override expires after 30 min
constexpr uint32_t AERATOR_MAX_OFF_MS = 10UL * 60UL * 1000UL; // MANUAL: air pump back ON after 10 min off (oxygen)
}  // namespace mode

// ---- Sensor fault detection ---------------------------------------------------
namespace fault {                              // fault constants
constexpr uint8_t INVALID_CYCLES = 3;          // SENSOR_FAULT after 3 bad readings in a row
}  // namespace fault

// ---- Local communication (ICD 4.3) --------------------------------------------
namespace net {                                // network constants
constexpr const char* AP_SSID     = "AQUA-NODE";      // Wi-Fi access point name
constexpr const char* AP_PASSWORD = "change-me-2026";  // WPA2 password (>= 8 chars): the team must change it
constexpr uint8_t AP_IP[4]        = {192, 168, 4, 1}; // access point address
constexpr uint8_t AP_MASK[4]      = {255, 255, 255, 0}; // access point subnet mask
constexpr uint8_t AP_CHANNEL      = 6;                // Wi-Fi channel
constexpr uint8_t AP_MAX_CLIENTS  = 4;                // phones allowed at the same time
constexpr const char* SIM_SSID    = "Wokwi-GUEST";    // simulator virtual network (SIM_MODE)
constexpr const char* SIM_PASSWORD = "";              // simulator network has no password
constexpr uint8_t SIM_CHANNEL     = 6;                // simulator network channel
constexpr uint32_t SIM_RECONNECT_MS = 10000;          // station reconnect interval in SIM_MODE
constexpr uint16_t HTTP_PORT      = 80;               // web server port
constexpr const char* BT_NAME     = "AQUA-NODE";      // Bluetooth serial device name
constexpr bool BT_ENABLED         = true;             // false = Wi-Fi only fallback
constexpr bool SERIAL_STATUS_STREAM = (SIM_MODE != 0);// stream status JSON on USB serial in SIM_MODE
constexpr uint32_t STATUS_PERIOD_MS = 1000;           // status line every second (ICD 4.4)
constexpr uint16_t CMD_LINE_MAX       = 256;              // longest accepted JSON command line
constexpr uint16_t STATUS_JSON_MAX = 256;             // buffer size for one status message
constexpr uint16_t REPLY_JSON_MAX  = 96;              // buffer size for one command reply
}  // namespace net

// ---- Auxiliary supply monitor (optional, uses spare ADS1115 channels) -------
// NOTE: no divider is fitted for this in the ICD. Leave disabled until P3 fits
// dividers on A2/A3 and the tech lead confirms the ratios below.
namespace rail {                               // rail monitor constants
constexpr bool MONITOR_ENABLED    = false;     // disabled until the hardware exists
constexpr float RATIO_12V         = 22.0f / (100.0f + 22.0f); // proposed 100k/22k divider (to confirm)
constexpr float RATIO_5V          = 15.0f / (10.0f + 15.0f);  // proposed 10k/15k divider (to confirm)
constexpr float NOMINAL_12V       = 12.0f;     // expected 12 V rail
constexpr float NOMINAL_5V        = 5.0f;      // expected 5 V rail
constexpr float TOLERANCE_12V     = 0.2f;      // P3 acceptance: 12.0 V +/- 0.2 V
constexpr float TOLERANCE_5V      = 0.1f;      // P3 acceptance: 5.0 V +/- 0.1 V
}  // namespace rail

// ---- Diagnostics -------------------------------------------------------------
namespace diag {                               // diagnostics constants
constexpr uint32_t HEALTH_LOG_PERIOD_MS = 60000; // print free heap once a minute (24 h test)
}  // namespace diag

// ---- Design checks: the build stops if an edit makes these values disagree ----
static_assert(ph::SETPOINT_MIN >= ph::ALARM_LOW && ph::SETPOINT_MAX <= ph::ALARM_HIGH,
              "a pH setpoint accepted from the phone would raise PH_RANGE all the time");
static_assert(ph::SETPOINT_DEFAULT >= ph::SETPOINT_MIN && ph::SETPOINT_DEFAULT <= ph::SETPOINT_MAX,
              "default pH setpoint outside the accepted range");
static_assert(ph::ALARM_LOW >= 6.0f && ph::ALARM_HIGH <= 8.5f,
              "pH alarm band outside the tolerance of the nitrifying bacteria (FAO 2014, table 2.1: 6-8.5)");
static_assert(temp::SETPOINT_MIN >= temp::ALARM_LOW && temp::SETPOINT_MAX <= temp::ALARM_HIGH,
              "a temperature setpoint accepted from the phone would raise TEMP_RANGE all the time");
static_assert(temp::ALARM_LOW >= 17.0f && temp::ALARM_HIGH <= 34.0f,
              "temperature alarm band outside the tolerance of the nitrifying bacteria (FAO 2014, table 2.1: 17-34 C)");
static_assert(mode::AERATOR_MAX_OFF_MS <= mode::MANUAL_TIMEOUT_MS, "the air pump limit must be shorter than MANUAL");

}  // namespace cfg
