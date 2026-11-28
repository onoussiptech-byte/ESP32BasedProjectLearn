# Plan for version 0.5.0: workspaces, offline documents, Tabs 3 and 4

Status: built: the Overview, Account management, Settings, the workspace switch, the app icon refresh, separate scores, and
the Aquaponics Realisation workspace with its Dashboard (Tabs 3 and 4: titles only). Not built yet: removal of the recovery
code, the other lessons and quizzes of Tabs 3 and 4. Lessons 3.1.1, 3.1.2 and 3.1.3 are written (version 0.8.0), with pictures,
firmware code blocks, and document links that open offline (in the browser on a computer, in the PDF viewer on phones).
Tabs 1 and 2 stay in the app; their content is paused.

## 1. Overview page (home and menu in one)

- Opens after sign-in, sign-up, account switch and import. Top: the app icon and the current account name.
- Four list buttons: **Learning ESP32**, **Aquaponics Realisation**, **Account management**, **Settings**.
- The two workspace buttons show their own progress, Score and Total mark.
- Account management: Switch account, Add account, Change password, Save accounts to folder, Export, Import, Sign out, Delete.
- Settings: theme and language, plus the present settings. The sign-in page keeps its own language button.
- Inside a workspace: no account and no settings items. **Clicking the app icon refreshes the same workspace page.**
  The dropdown is **Switch workspace** ("Changer d'apprentissage"): the two workspaces, and Overview (the only way back to
  Account management and Settings). The account never changes there.
- Recovery code and "Forgot password?" are removed. A forgotten password cannot be reset.

## 2. Scores, separate per workspace (rules unchanged)

| Workspace | Tabs | Quizzes | Points |
|---|---|---|---|
| Learning ESP32 | 1, 2 | 176 | 1,600 |
| Aquaponics Realisation | 3, 4 | 110 | 1,000 |

States: NOT STARTED, TO DO, DONE, FAILED. 8 questions per sub-lesson, 20 per main lesson.

## 3. Offline documents and pictures

- All reference PDFs are in `docs/` and go into the PC build and the phone build.
- PC: a reference opens `docs/<file>#page=N` in the browser. Phone: the PDF.js viewer (`src/assets/vendor/pdfjs`) opens page N.
- Phones keep the PDFs in their own store, separate from the app, so an app update does not download them again.
- `src/references/index.json` gives the exact page of every section (built by `src/tools/pdf_index.py`).
- `src/references/figures.json` lists the pictures in `src/assets/figures/` (built by `src/tools/extract_figures.py`).
  A new content block `figure` shows one, with its caption and a link to its page. Pictures are part of the app's own files.

## 4. Sub-lesson structure (Tabs 3 and 4)

1. Why and overview. For a component: a short summary of the component with its picture.
2. Useful concepts, each with a link to the exact page of the component's own document or the ESP32 documents.
3. Code from the firmware (`src/firmware/`), with a copy button.
4. Development, step by step.
5. Implementation in PlatformIO (and how to run it when it can run).
6. Pitfalls and safety.
7. Conclusion. Then the quiz.

Tab 3: 1 to 4 pages. Tab 4: one page. C/C++, PlatformIO, linking and FreeRTOS ideas are explained just before their first use.
One PlatformIO project grows through the course. Each runnable step (marked ▶) adds a short test `main`, its environment
(`src/firmware/bench_envs.ini`), its libraries, the steps and the expected output. Parts that cannot run yet only show where
the code goes. The build checks that every firmware line is taught somewhere.

## 5. Tab 3: Generalities_BIOM ("Généralités_BIOM")

| # | 3.1 Generalities and PlatformIO | 3.2 Shared files, level and temperature | 3.3 pH, flow and simulation |
|---|---|---|---|
| 1 | What aquaponics is and what AquaNode does | config.h: pins and namespaces | I2C and the ADS1115: Ads1115Bus.h |
| 2 | Power, rails, sensors and loads | config.h: thresholds and build flags | Ads1115Bus.cpp: reading volts ▶ |
| 3 | Aquaponics Structure and Code folders packages structure | types.h: shared data types | pH, the probe board and the divider: PhSensor.h |
| 4 | The pin map and pins to avoid | logger.h: messages on serial ▶ | PhSensor.cpp: sampling and median |
| 5 | Messages, alarms and safe defaults | The float switch: LevelSwitch.h | PhSensor.cpp: volts to pH and temperature ▶ |
| 6 | Safety around water | LevelSwitch.cpp: debounce ▶ | PhSensor.cpp: two-point calibration ▶ |
| 7 | Installing PlatformIO, creating the project | SignalFilter.h: median and average ▶ | Interrupts and pulses: FlowSensor.h and the ISR |
| 8 | platformio.ini line by line | The DS18B20: TemperatureSensor.h | FlowSensor.cpp: pulses to L/min ▶ |
| 9 | From source to firmware: compile and link | TemperatureSensor.cpp: non-blocking reading ▶ | SimulatedSensors: fake values ▶ |
| 10 | Build, upload, monitor: first run ▶ | Unplug tests and review | Noise control and accuracy targets |

| # | 3.4 Output modules | 3.5 Dosing, rails and trust |
|---|---|---|
| 1 | Loads, MOSFET and flyback diode | esp_timer: DosingPumpDriver.h |
| 2 | LowSideSwitch.h: the class | DosingPumpDriver.cpp: starting a pulse |
| 3 | LowSideSwitch.cpp: glitch-free start ▶ | DosingPumpDriver.cpp: stopping on time ▶ |
| 4 | StatusLed: blink patterns ▶ | Rail dividers: RailMonitor.h |
| 5 | AeratorDriver and the bypass switch ▶ | RailMonitor.cpp: tolerance check ▶ |
| 6 | HeaterDriver: the demo load ▶ | Safe states during reset ▶ |
| 7 | PWM and LEDC: PumpDriver.h | What can go wrong: failure list |
| 8 | PumpDriver.cpp: attach and write ▶ | Sensor bench test sheet |
| 9 | PumpDriver.cpp: minimum duty and targets | Output bench test sheet |
| 10 | PumpDriver.cpp: soft start ▶ | Checkpoint: every module runs alone ▶ |

## 6. Tab 4: Building Core Modules ("Construire les modules centraux")

| # | 4.1 State and storage | 4.2 Joining sensors, outputs and safety | 4.3 Control loops |
|---|---|---|---|
| 1 | From separate modules to one system | SensorManager.h: one door to the sensors | Setpoint, error, hysteresis and PID |
| 2 | Linking modules in depth | Starting all the sensors | PidController.h and anti-windup ▶ |
| 3 | SystemState.h: the shared interface | The sensing cycle | ControlManager: state and time helpers |
| 4 | Mutex and the Lock class | Switching to simulated sensors | AUTO, MANUAL and the 30 min limit |
| 5 | Snapshots: set and get | Sensor fault detection ▶ | Handling commands |
| 6 | Mode and alarms with atomics | Calibration through a mutex | Alarms: no flow and ranges |
| 7 | The command queue ▶ | OutputManager: requests and inhibits | The pump loop |
| 8 | NVS and Preferences | Safe defaults at boot | Aerator and heater |
| 9 | Saving calibration and setpoints ▶ | Applying outputs every 100 ms ▶ | Dosing: pulse, wait, re-measure |
| 10 | State and storage together ▶ | SafetyManager: the interlocks ▶ | The control cycle complete ▶ |

| # | 4.4 Communication | 4.5 FreeRTOS, main.cpp and acceptance |
|---|---|---|
| 1 | Endpoints and messages | Tasks, scheduler and ticks |
| 2 | One status builder | Priorities, cores and stacks |
| 3 | Parsing set and mode | Periodic tasks: xTaskDelayUntil |
| 4 | Parsing setpoint and cal ▶ | The 5 s watchdog |
| 5 | The page stored in flash | Starting tasks and logging health |
| 6 | Access point and SIM_MODE | main.cpp: includes and fatal() |
| 7 | HTTP routes and handlers | main.cpp: start-up order in setup() |
| 8 | From text to command | main.cpp: loop() and full firmware ▶ |
| 9 | Serial and Bluetooth lines | Linker, memory map and partitions |
| 10 | Wi-Fi and Bluetooth together ▶ | Failure tests, 24/48 h runs and demo |

## 7. Component, document, pictures, lessons

| Component | Document key | Pictures (`figures.json`) | Lessons |
|---|---|---|---|
| Aquaponics (project pictures) | `Images/` | aquaponics-cycle, aquaponics-parts | 3.1.1 to 3.1.3 |
| Aquaponic units and their parts | fao_aquaponics, srac5007 | fao-components, fao-nitrification, fao-mediabed, fao-nft, fao-dwc, fao-separator, fao-biofilter, fao-airpump, fao-airstone, fao-sump, srac-biofilter, srac-dwc | 3.1.3, 3.1.6, 3.3 (pH), 3.2 (temperature) |
| ESP32 chip | datasheet, trm, idf, hwdesign | esp32-pins, esp32-strapping, esp32-bootflow, hw-power, hw-reset | 3.1.2, 3.1.4, 3.5.6 |
| LM2596 | lm2596 | lm2596-typical, lm2596-pins, lm2596-block | 3.1.2, 3.5.4 |
| DC jack, fuse, toggle | dcjack, fuse, toggle | dcjack-photo, fuse-photo, toggle-photo | 3.1.2, 3.1.6, 3.4.5 |
| Float switch | floatswitch | float-photo | 3.2.5, 3.2.6 |
| DS18B20 | ds18b20 | ds18b20-pinout, -block, -register, -power, -resolution | 3.2.8, 3.2.9 |
| ADS1115 | ads1115, trm, idf | ads1115-pinout, -block, -mux, -fsr, -address, i2c-write, i2c-read | 3.3.1, 3.3.2 |
| PH-4502C | ph4502c, ads1115 | ph4502c-pinout, -offset, -wiring, ph-buffers | 3.3.3 to 3.3.6 |
| YF-S201 | yfs201 | yfs201-photo, -drawing, -table | 3.3.7, 3.3.8 |
| IRLZ44N | irlz44n | irlz44n-package, irlz44n-transfer | 3.4.1 to 3.4.3 |
| Diodes | d1n5819, d1n4007 | d1n5819-photo, d1n5819-outline, d1n4007-photo | 3.4.1 |
| Air pump | airpump | (no picture in its document) | 3.4.5 |
| Heater resistors | resistor_sqp | sqp-photo, sqp-marking, sqp-temperature | 3.4.6 |
| Water pump, LEDC | waterpump, trm, idf | waterpump-drawing, ledc-block, ledc-signal, ledc-api | 3.4.7 to 3.4.10 |
| Dosing pump | dosingpump | dosingpump-photo, dosingpump-views | 3.5.1 to 3.5.3 |
| Dividers | resistor_cf, ads1115 | resistor-photo | 3.3.3, 3.5.4 |

Not used by AquaNode, kept as reference only: LM317, CJQ4435, and the DFRobot SEN0161-V2 page, kept as the PDF
`docs/DFRobot_SEN0161-V2_pH_sensor.pdf` (another pH board).

Large documents on phones: a document over 2 MB (FAO manual, ESP-IDF guide, TRM, LM2596, ADS1115...) goes to the phones as a
light copy built by `build.py`: the same number of pages, so every link opens the same page, but only the cited pages and
the page after each keep their content, as pictures (130 dpi), so 0.8.0 phones store 21 MB. The computer version always carries the full documents.

## 8. Sub-lesson 3.1.3 (written in 0.8.0) "Aquaponics Structure and Code folders packages structure"

FR: "Structure de l'aquaponie et structure des dossiers et paquets du code". Written in 0.8.0 from this plan. Prepared before: the title (EN/FR),
the two documents indexed with exact pages (`fao_aquaponics`, `srac5007` in `src/references/index.json`), 12 pictures.
Planned pages (1 to 4), with the 7 parts:

| Page | Parts | Content | References (doc key: section) | Pictures |
|---|---|---|---|---|
| 1 | 1 Why, 2 concepts | The three living parts (fish, plants, bacteria) and the nitrification steps; balance between feed, fish and plants | fao: 2.1, 2.1.1, 2.2, 2.4; srac: Introduction | fao-components, fao-nitrification |
| 2 | 2 concepts | The physical structure: fish tank, solids removal, biofilter, plant unit, sump, water movement, aeration, plumbing; the three plant units (media bed, NFT, DWC) and how to choose; where AquaNode's sensors and loads sit in this structure | fao: 4.2 to 4.2.8, 4.3, 4.4, 4.5, 4.6; srac: Fish unit, Plant unit, Solids removal, Biofiltration, Movement of water | fao-mediabed, fao-nft, fao-dwc, fao-separator, fao-biofilter, fao-sump, fao-airpump, fao-airstone, srac-dwc, srac-biofilter |
| 3 | 3 code, 4 development | The work packages E1, P3, E2, E4 and the folders `e1_sensors/`, `p3_outputs/`, `e2_core/`, `include/`; header (.h) and source (.cpp); how `#include "e2_core/..."` finds a file (`-I src`) | firmware: `src/main.cpp` includes (`#include "config.h"` to `#include "e2_core/TaskManager.h"`), `platformio.ini` line `-I src` | (folder tree as a code block) |
| 4 | 5 PlatformIO, 6 pitfalls, 7 conclusion | Where each folder lives in the PlatformIO project (nothing to run yet, PlatformIO comes in 3.1.7); pitfalls: mixing modules across folders, wrong include path, units in the manuals (gallons, inches: give litres, cm) | fao: Appendix 6; srac: Management, Water quality | - |

Quiz: 8 questions, at least 4 types (order of the water path, match folder to work package, include path code output...).

## 8b. Sub-lesson 3.1.4 (written in 0.9.0) "ESP32 pins and the Aquaponic project circuit"

FR: "Les broches de l'ESP32 et le circuit du projet aquaponique". Prepared: the title (EN/FR), the diagram tool and the `diagram` lesson block.
Tool: SVG.js 3.2.8 (MIT) only, with our kit `src/templates/js/diagrams.js` (see `src/diagrams/README.md`). No simulation in the app, so
CircuitJS1 is not installed; Mermaid, JSXGraph, WaveDrom, KaTeX are not needed for this sub-lesson. Parts the kit does not have (ESP32 DevKit,
PH-4502C board, ADS1115, LM2596 module, YF-S201, DS18B20, float switch, adapter) are drawn as named rectangles with professionally named pins.

Two diagrams (files to write with the lesson):

1. `src/diagrams/esp32-pins.js`: the ESP32 DevKit V1 (30 pin) as a box "ESP32 DevKit V1 (ESP32-WROOM-32)", 15 pins per side, each pin tappable.
   - Left side: EN, VP/GPIO36, VN/GPIO39, GPIO34, GPIO35, GPIO32, GPIO33, GPIO25, GPIO26, GPIO27, GPIO14, GPIO12, GPIO13, GND, VIN.
   - Right side: GPIO23, GPIO22, TX0/GPIO1, RX0/GPIO3, GPIO21, GPIO19, GPIO18, GPIO5, GPIO17, GPIO16, GPIO4, GPIO2, GPIO15, GND, 3V3.
   - Roles (colours): used = 21 SDA, 22 SCL, 4 DS18B20, 34 flow (input only), 27 float switch, 25 pump PWM, 26 aerator, 33 dosing, 32 heater,
     2 status LED; reserved = 35 pH fallback (ADC1); spare = 13, 14, 16, 17; avoid = 0, 12, 15 (strapping), 1/3 (USB serial),
     6 to 11 (internal flash, not on the header); input only = 34, 35, 36, 39; power = VIN 5 V, 3V3, GND; EN = reset.
   - Note: ADC2 pins do not work with Wi-Fi on, so analogue inputs stay on ADC1 (32 to 39).
2. `src/diagrams/aquanode-circuit.js`: the whole circuit, wires in the ICD colours (red 19 V, orange 12 V, pink 5 V, black GND, yellow signals).
   - Power: laptop adapter 19 V (>= 3 A) -> DC jack -> fuse 3 A -> LM2596 #1 (12.0 V) and LM2596 #2 (5.0 V); star ground at the adapter negative.
   - 5 V rail: ESP32 VIN, PH-4502C V+, YF-S201 VCC, dosing pump; 3.3 V (ESP32 3V3): ADS1115 VDD, DS18B20 VDD, pull-ups.
   - Sensors: PH-4502C Po -> 10 k / 15 k divider -> ADS1115 A0; ADS1115 SDA/SCL -> GPIO21/22, ADDR -> GND (0x48);
     DS18B20 DQ -> GPIO4 with 4.7 k to 3.3 V; YF-S201 signal -> 10 k / 15 k divider -> GPIO34; float switch GPIO27 to GND (internal pull-up).
   - Outputs, each: IRLZ44N low side, 220 ohm gate resistor, 10 k gate pull-down, load to drain, source to GND, flyback diode on motors:
     Q1 GPIO25 pump (12 V, PWM 20 kHz), Q2 GPIO26 air pump (12 V) with the SPDT bypass "ALWAYS ON / ESP32", Q3 GPIO33 dosing pump (5 V),
     Q4 GPIO32 heater demo 2 x 47 ohm 5 W in parallel (12 V, about 6 W, no diode needed).
   - Animated current flow on the rails (optional), info text on every part and pin.

Planned pages (1 to 4):

| Page | Content | References (doc key: section) |
|---|---|---|
| 1 | ESP32 pins in general: power pins, GPIO, input-only pins, ADC1/ADC2, strapping pins, flash pins, UART0; diagram `esp32-pins` | datasheet: 2.2 Pin Overview (p14), 2.3.1 Restrictions (p17), 3 Boot Configurations (p22), 4.8.1 GPIO (p36), 4.9.1 ADC (p43); hwdesign: Strapping Pins (p16), GPIO (p17), ADC (p18) |
| 2 | The AquaNode pin map: which pins are used and why, which are spare or avoided; the firmware `namespace pins` | firmware: `include/config.h` namespace pins; ICD 4.2 |
| 3 | The whole circuit: diagram `aquanode-circuit`; the power path and rails | lm2596; fuse; dcjack; irlz44n; d1n5819 / d1n4007; toggle; resistor_sqp |
| 4 | Brief explanation of each block (sensors and their conditioning, outputs and flyback, safety: fuse, bypass, pull-downs), pitfalls, conclusion | ph4502c; ads1115; ds18b20; yfs201; floatswitch; waterpump; airpump; dosingpump; fao: 4.2.6 aeration; srac: Movement of water |

Quiz: 8 questions, at least 4 types (match pin to role, which pin to avoid, divider output voltage, why a flyback diode...).

## 8c. Sub-lesson 3.1.5 (written in 1.0.0) "Messages, alarms and safe defaults"

Two pages only (kept short on purpose). p1: the two links (HTTP on the AQUA-NODE access point, JSON lines on Bluetooth SPP), diagram `aquanode-messages`, the 11 status fields, `JsonProtocol::buildStatus`, the four commands and their refusals. p2: the five alarms and `alarmCode` priority, diagram `aquanode-modes` (boot, AUTO, MANUAL, safety task), the ICD 4.6 safe defaults, `SafetyManager` interlocks, development, pitfalls, conclusion. Quiz: 8 questions, 6 types, 2 with a diagram.

## 9. Order of work

1. Overview, Account, Settings, workspace switch, separate scores, recovery code removed, Tabs 3 and 4 with all titles (EN/FR).
2. Offline documents, PDF viewer, figure block.
3. Firmware code blocks and the coverage check.
4. Pilots 3.1.1 and 3.2.6.
5. The remaining sub-lessons and final quizzes, in order.
