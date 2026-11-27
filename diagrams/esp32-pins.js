/* esp32-pins: the ESP32 DevKit V1 (30 pins) as a box, every header pin named, coloured by its role in AquaNode
 * and explained when tapped. Pin map: include/config.h namespace pins (ICD 4.2). Lesson 3.1.4. */
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['esp32-pins'] = function (D) {
  D.size(1000, 700);
  D.minWidth(760);
  const P = (n, role, use, en, fr, alt) => ({ n, role, alt, use, info: { en, fr } });

  const left = [
    P('EN', 'power', { en: 'Reset (EN button)', fr: 'Reset (bouton EN)' },
      'Chip enable. Pulled LOW, the ESP32 resets; this is the EN button of the board. Never use it as a GPIO.',
      'Activation de la puce. Tirée à LOW, l’ESP32 redémarre ; c’est le bouton EN de la carte. Jamais utilisée comme GPIO.'),
    P('GPIO36', 'free', { en: 'VP · input only, not used', fr: 'VP · entrée seule, non utilisée' },
      'Also printed VP. Input only (no output driver, no internal pull-up), ADC1 channel 0. Free in AquaNode.',
      'Aussi marquée VP. Entrée seule (pas de sortie, pas de pull-up interne), canal 0 de l’ADC1. Libre dans AquaNode.'),
    P('GPIO39', 'free', { en: 'VN · input only, not used', fr: 'VN · entrée seule, non utilisée' },
      'Also printed VN. Input only, ADC1 channel 3. Free in AquaNode.',
      'Aussi marquée VN. Entrée seule, canal 3 de l’ADC1. Libre dans AquaNode.'),
    P('GPIO34', 'used', { en: 'Flow pulses (YF-S201)', fr: 'Impulsions du débitmètre (YF-S201)' },
      'Used: the YF-S201 flow sensor pulses, through the 10 kΩ / 15 kΩ divider, counted by an interrupt. Input only, which is all a pulse input needs.',
      'Utilisée : les impulsions du débitmètre YF-S201, par le pont 10 kΩ / 15 kΩ, comptées par une interruption. Entrée seule, c’est tout ce qu’il faut pour des impulsions.'),
    P('GPIO35', 'input', { en: 'pH fallback (ADC1), reserved', fr: 'pH de secours (ADC1), réservée' },
      'Reserved: reads the pH board directly (ADC1) only if the ADS1115 is missing. Input only. ADC1 keeps working while Wi-Fi is on.',
      'Réservée : lit la carte pH directement (ADC1) seulement si l’ADS1115 manque. Entrée seule. L’ADC1 fonctionne même avec le Wi-Fi actif.'),
    P('GPIO32', 'used', { en: 'Heater demo → Q4', fr: 'Chauffage démo → Q4' },
      'Used: gate of MOSFET Q4, the heater demo resistors (2 × 47 Ω on 12 V). On/off with ±0.5 °C hysteresis.',
      'Utilisée : grille du MOSFET Q4, les résistances du chauffage démo (2 × 47 Ω sur 12 V). Marche/arrêt avec une hystérésis de ±0,5 °C.'),
    P('GPIO33', 'used', { en: 'Dosing pump → Q3', fr: 'Pompe doseuse → Q3' },
      'Used: gate of MOSFET Q3, the 5 V dosing pump. One short dose, then a wait for mixing; never continuous.',
      'Utilisée : grille du MOSFET Q3, la pompe doseuse 5 V. Une courte dose, puis une attente de mélange ; jamais en continu.'),
    P('GPIO25', 'used', { en: 'Pump PWM 20 kHz → Q1', fr: 'Pompe MLI 20 kHz → Q1' },
      'Used: gate of MOSFET Q1, the 12 V circulation pump, driven by PWM at 20 kHz (LEDC) to set its speed.',
      'Utilisée : grille du MOSFET Q1, la pompe de circulation 12 V, commandée en MLI à 20 kHz (LEDC) pour régler sa vitesse.'),
    P('GPIO26', 'used', { en: 'Air pump → Q2', fr: 'Pompe à air → Q2' },
      'Used: gate of MOSFET Q2, the 12 V air pump. ON by default; a bypass switch can keep it ON without the ESP32.',
      'Utilisée : grille du MOSFET Q2, la pompe à air 12 V. En marche par défaut ; un interrupteur de secours peut la garder en marche sans l’ESP32.'),
    P('GPIO27', 'used', { en: 'Float switch (LOW = low water)', fr: 'Flotteur (LOW = eau basse)' },
      'Used: the float switch to GND with the internal pull-up. HIGH = water OK, LOW = low water: pump and dosing stop.',
      'Utilisée : le flotteur vers GND avec le pull-up interne. HIGH = eau correcte, LOW = eau basse : pompe et dosage s’arrêtent.'),
    P('GPIO14', 'spare', { en: 'Spare (future)', fr: 'Réserve (futur)' },
      'Spare: kept for a future servo, display or EC sensor. It outputs a short PWM at boot, so check before driving a load with it.',
      'Réserve : gardée pour un servo, un écran ou un capteur EC futurs. Elle sort une courte MLI au démarrage : vérifier avant d’y brancher une charge.'),
    P('GPIO12', 'avoid', { en: 'Strapping (flash voltage): avoid', fr: 'Configuration (tension flash) : à éviter' },
      'Avoid: strapping pin MTDI. Read at reset to choose the flash voltage; pulled HIGH by a circuit, the board may not boot.',
      'À éviter : broche de configuration MTDI. Lue au reset pour choisir la tension de la flash ; tirée à HIGH par un circuit, la carte peut ne pas démarrer.'),
    P('GPIO13', 'spare', { en: 'Spare (future)', fr: 'Réserve (futur)' },
      'Spare: free GPIO kept for later (servo, display, EC).',
      'Réserve : GPIO libre gardée pour plus tard (servo, écran, EC).'),
    P('GND', 'gnd', { en: 'Ground (star point)', fr: 'Masse (point étoile)' },
      'Ground. All grounds meet at the star point at the adapter negative.',
      'Masse. Toutes les masses se rejoignent au point étoile, au négatif de l’adaptateur.'),
    P('VIN', 'power', { en: '5 V in from LM2596 #2', fr: '5 V venant du LM2596 n°2' },
      'Power input: 5.0 V from the second buck converter. The board regulator makes 3.3 V from it.',
      'Entrée d’alimentation : 5,0 V du deuxième convertisseur abaisseur. Le régulateur de la carte en fait 3,3 V.'),
  ];
  const right = [
    P('GPIO23', 'free', { en: 'Not used', fr: 'Non utilisée' },
      'Free GPIO (default SPI MOSI). Not used in AquaNode.', 'GPIO libre (MOSI SPI par défaut). Non utilisée dans AquaNode.'),
    P('GPIO22', 'used', { en: 'I²C SCL → ADS1115', fr: 'I²C SCL → ADS1115' },
      'Used: I²C clock to the ADS1115 (address 0x48), which reads the pH board.',
      'Utilisée : horloge I²C vers l’ADS1115 (adresse 0x48), qui lit la carte pH.'),
    P('GPIO1', 'avoid', { en: 'TX0 · USB serial: avoid', fr: 'TX0 · série USB : à éviter' },
      'Avoid: UART0 transmit, wired to the USB chip. It carries the upload and the log (and the simulated Bluetooth lines).',
      'À éviter : émission UART0, reliée à la puce USB. Elle porte le téléversement et le journal (et les lignes Bluetooth simulées).'),
    P('GPIO3', 'avoid', { en: 'RX0 · USB serial: avoid', fr: 'RX0 · série USB : à éviter' },
      'Avoid: UART0 receive, wired to the USB chip, used to upload the firmware.',
      'À éviter : réception UART0, reliée à la puce USB, sert à téléverser le firmware.'),
    P('GPIO21', 'used', { en: 'I²C SDA → ADS1115', fr: 'I²C SDA → ADS1115' },
      'Used: I²C data to the ADS1115.', 'Utilisée : données I²C vers l’ADS1115.'),
    P('GPIO19', 'free', { en: 'Not used', fr: 'Non utilisée' }, 'Free GPIO (default SPI MISO).', 'GPIO libre (MISO SPI par défaut).'),
    P('GPIO18', 'free', { en: 'Not used', fr: 'Non utilisée' }, 'Free GPIO (default SPI SCK).', 'GPIO libre (SCK SPI par défaut).'),
    P('GPIO5', 'free', { en: 'Not used (strapping)', fr: 'Non utilisée (configuration)' },
      'Free, but a strapping pin (SDIO timing) read at reset, so it is not the first choice for an output.',
      'Libre, mais broche de configuration (timing SDIO) lue au reset : ce n’est pas le premier choix pour une sortie.'),
    P('GPIO17', 'spare', { en: 'TX2 · spare (future)', fr: 'TX2 · réserve (futur)' },
      'Spare: UART2 TX, kept for a future display or sensor.', 'Réserve : TX de l’UART2, gardée pour un écran ou un capteur futur.'),
    P('GPIO16', 'spare', { en: 'RX2 · spare (future)', fr: 'RX2 · réserve (futur)' },
      'Spare: UART2 RX, kept for later.', 'Réserve : RX de l’UART2, gardée pour plus tard.'),
    P('GPIO4', 'used', { en: 'DS18B20 1-Wire data', fr: 'Données 1-Wire DS18B20' },
      'Used: the DS18B20 data line, with a 4.7 kΩ pull-up to 3.3 V.', 'Utilisée : la ligne de données du DS18B20, avec un pull-up de 4,7 kΩ vers 3,3 V.'),
    P('GPIO2', 'used', { en: 'Status LED (on-board)', fr: 'LED d’état (sur la carte)' },
      'Used: the blue on-board LED. Also a strapping pin: an LED is harmless, a strong pull-up would not be.',
      'Utilisée : la LED bleue de la carte. Aussi une broche de configuration : une LED est sans danger, un fort pull-up ne le serait pas.'),
    P('GPIO15', 'avoid', { en: 'Strapping (boot log): avoid', fr: 'Configuration (journal de démarrage) : à éviter' },
      'Avoid: strapping pin MTDO, read at reset (it controls the boot messages and timing).',
      'À éviter : broche de configuration MTDO, lue au reset (elle règle les messages de démarrage et le timing).'),
    P('GND', 'gnd', { en: 'Ground', fr: 'Masse' }, 'Ground.', 'Masse.'),
    P('3V3', 'power', { en: '3.3 V out → ADS1115, DS18B20', fr: '3,3 V sortie → ADS1115, DS18B20' },
      'The 3.3 V made by the board regulator. It powers the ADS1115 and the DS18B20 and their pull-ups. Every GPIO works at 3.3 V: never 5 V on a pin.',
      'Le 3,3 V produit par le régulateur de la carte. Il alimente l’ADS1115, le DS18B20 et leurs pull-ups. Chaque GPIO travaille en 3,3 V : jamais de 5 V sur une broche.'),
  ];

  const X = 345, Y = 40, W = 310, PITCH = 34;
  const c = D.chip({ x: X, y: Y, w: W, pitch: PITCH, name: 'ESP32 DevKit V1', sub: 'ESP32-WROOM-32 · 30 pins', nameSize: 18,
    pins: { left, right }, pinSize: 13,
    info: { en: 'The development board: the ESP32-WROOM-32 module (chip, flash, antenna), a 3.3 V regulator, a USB-serial chip, the EN and BOOT buttons and 30 header pins.',
            fr: 'La carte de développement : le module ESP32-WROOM-32 (puce, flash, antenne), un régulateur 3,3 V, une puce USB-série, les boutons EN et BOOT et 30 broches.' } });
  // board details inside the box
  D.box(X + W / 2 - 45, Y + 6, 90, 26, { title: { en: 'antenna', fr: 'antenne' }, size: 11,
    info: { en: 'The PCB antenna of the module: keep metal and wires away from it.', fr: 'L’antenne imprimée du module : éloigner le métal et les fils.' } });
  D.box(X + W / 2 - 40, Y + c.box.h - 30, 80, 26, { title: 'micro-USB', size: 11,
    info: { en: 'USB: power and serial (upload, log) through GPIO1 and GPIO3.', fr: 'USB : alimentation et série (téléversement, journal) par GPIO1 et GPIO3.' } });

  // the AquaNode use of each pin, outside the pin ends
  left.forEach((p, i) => D.text(X - 40, Y + PITCH * (i + 1), p.use, { anchor: 'end', size: 13, cls: p.role === 'used' ? '' : 'dg-muted', weight: p.role === 'used' ? 600 : 400 }));
  right.forEach((p, i) => D.text(X + W + 40, Y + PITCH * (i + 1), p.use, { anchor: 'start', size: 13, cls: p.role === 'used' ? '' : 'dg-muted', weight: p.role === 'used' ? 600 : 400 }));

  // legend of the pin colours
  const roles = [['used', { en: 'used by AquaNode', fr: 'utilisée par AquaNode' }], ['spare', { en: 'spare, kept for later', fr: 'réserve pour plus tard' }],
    ['input', { en: 'input only, reserved', fr: 'entrée seule, réservée' }], ['avoid', { en: 'avoid (boot, USB)', fr: 'à éviter (démarrage, USB)' }],
    ['free', { en: 'free, not used', fr: 'libre, non utilisée' }], ['power', { en: 'power / reset', fr: 'alimentation / reset' }], ['gnd', 'GND']];
  roles.forEach(([r, lab], i) => {
    const x = 30 + (i % 4) * 240, y = 618 + Math.floor(i / 4) * 24;
    const g = D.group('dg-pin ' + r); g.line(x, y, x + 30, y);
    D.text(x + 38, y, lab, { size: 13 });
  });
  D.note(500, 680, { en: 'GPIO 6 to 11 drive the module’s flash memory: they are not on this header and must never be used.',
    fr: 'Les GPIO 6 à 11 pilotent la mémoire flash du module : ils ne sont pas sur ce connecteur et ne doivent jamais être utilisés.' }, { anchor: 'middle', size: 13 });
};
