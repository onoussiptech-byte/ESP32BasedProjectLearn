# Plan for version 0.5.0: workspaces, offline documents, Tabs 3 and 4

Status: built: the Overview, Account management, Settings, the workspace switch, the app icon refresh, separate scores, and
the Aquaponics Realisation workspace with its Dashboard (Tabs 3 and 4: titles only). Not built yet: removal of the recovery
code, the other lessons and quizzes of Tabs 3 and 4. Lessons 3.1.1 and 3.1.2 are written (version 0.7.2), with pictures,
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
| 3 | The work packages and code folders | types.h: shared data types | pH, the probe board and the divider: PhSensor.h |
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

Not used by AquaNode, kept as reference only: LM317, CJQ4435, and the DFRobot pH page (another pH board; the saved page also
carries trackers, so it is not put in the app).

## 8. Order of work

1. Overview, Account, Settings, workspace switch, separate scores, recovery code removed, Tabs 3 and 4 with all titles (EN/FR).
2. Offline documents, PDF viewer, figure block.
3. Firmware code blocks and the coverage check.
4. Pilots 3.1.1 and 3.2.6.
5. The remaining sub-lessons and final quizzes, in order.
