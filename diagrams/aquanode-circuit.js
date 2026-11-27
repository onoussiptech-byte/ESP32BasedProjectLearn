/* aquanode-circuit: the whole AquaNode circuit (CLAUDE.md ICD 4.1, 4.2; E1 and P3 sections).
 * Power: 19 V adapter, 3 A fuse, LM2596 12 V and 5 V. Sensors on the left, MOSFET output stages on the right.
 * Wire colours: red 19 V, orange 12 V, pink 5 V, blue 3.3 V, dark GND, yellow signals, green I2C. Lesson 3.1.4. */
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['aquanode-circuit'] = function (D) {
  D.size(1650, 960);
  D.minWidth(1150);
  const I = (en, fr) => ({ en, fr });
  const pin = (n, role, en, fr) => ({ n, role, info: I(en, fr) });
  const V5 = (x, y) => D.rail(x, y, '+5 V', 'v5'), V33 = (x, y) => D.rail(x, y, '+3.3 V', 'v33');

  // ================================================================ power
  D.text(20, 16, I('Power: adapter, fuse, two buck converters', 'Alimentation : adaptateur, fusible, deux convertisseurs'), { weight: 700, size: 16 });
  D.chip({ x: 20, y: 30, w: 230, pitch: 30, name: I('Laptop adapter', 'Adaptateur PC'), sub: '19 V · ≥ 3 A',
    info: I('The only energy source: a laptop adapter, about 19 V and at least 3 A (65 W). Measure its voltage and polarity before anything else.',
      'La seule source d’énergie : un adaptateur de PC portable, environ 19 V et au moins 3 A (65 W). Mesurer sa tension et sa polarité avant tout.'),
    pins: { right: [pin('+19 V', 'power', 'Positive output, through the DC jack (red wire).', 'Sortie positive, par la prise jack (fil rouge).'),
      pin('GND', 'gnd', 'Negative output: the star point where every ground meets.', 'Sortie négative : le point étoile où toutes les masses se rejoignent.')] } });
  D.fuse([280, 60], [350, 60], { label: 'F1', value: '3 A', cls: 'v19',
    info: I('3 A fuse in the positive lead, first after the adapter. A short circuit blows it before wires or modules burn.',
      'Fusible 3 A sur le fil positif, juste après l’adaptateur. Un court-circuit le fait fondre avant que fils ou modules ne brûlent.') });
  D.wire([[350, 60], [410, 60]], { cls: 'v19', flow: true });
  D.wire([[370, 60], [370, 180], [410, 180]], { cls: 'v19', flow: true, label: [376, 128, '19 V'] });
  D.dot(370, 60);
  D.wire([[280, 90], [295, 90]], { cls: 'gnd' }); D.ground(295, 90);
  const buck = (y, name, out, en, fr) => D.chip({ x: 440, y, w: 230, pitch: 30, name, sub: out, info: I(en, fr),
    pins: { left: [pin('IN+', 'power', 'Input +, from the 19 V bus.', 'Entrée +, depuis le bus 19 V.'), pin('IN−', 'gnd', 'Input −, ground.', 'Entrée −, masse.')],
      right: [pin('OUT+', 'power', 'Output +, set with the multimeter before any load is connected.', 'Sortie +, réglée au multimètre avant de brancher une charge.'),
        pin('OUT−', 'gnd', 'Output −, ground.', 'Sortie −, masse.')] } });
  buck(30, 'LM2596 #1', '19 V → 12.0 V', 'Buck converter module set to 12.0 V (±0.2 V) for the pump, the air pump and the heater demo. Peak about 1.6 A, under its 3 A rating.',
    'Module abaisseur réglé à 12,0 V (±0,2 V) pour la pompe, la pompe à air et le chauffage démo. Pointe d’environ 1,6 A, sous ses 3 A.');
  buck(150, 'LM2596 #2', '19 V → 5.0 V', 'Buck converter module set to 5.0 V (±0.1 V) for the ESP32 (VIN), the sensors and the dosing pump.',
    'Module abaisseur réglé à 5,0 V (±0,1 V) pour l’ESP32 (VIN), les capteurs et la pompe doseuse.');
  D.wire([[410, 90], [396, 90]], { cls: 'gnd' }); D.ground(396, 90);
  D.wire([[410, 210], [396, 210]], { cls: 'gnd' }); D.ground(396, 210);
  D.wire([[700, 60], [760, 60]], { cls: 'v12', flow: true, label: [768, 60, I('+12 V rail: pumps, heater', 'rail +12 V : pompes, chauffage')],
    info: I('The 12 V rail (orange wires).', 'Le rail 12 V (fils orange).') });
  D.wire([[700, 180], [760, 180]], { cls: 'v5', flow: true, label: [768, 180, I('+5 V rail: ESP32, sensors, dosing', 'rail +5 V : ESP32, capteurs, dosage')],
    info: I('The 5 V rail (pink wires).', 'Le rail 5 V (fils roses).') });
  D.wire([[700, 90], [715, 90]], { cls: 'gnd' }); D.ground(715, 90);
  D.wire([[700, 210], [715, 210]], { cls: 'gnd' }); D.ground(715, 210);

  // ================================================================ ESP32
  const esp = D.chip({ x: 760, y: 300, w: 220, pitch: 60, name: 'ESP32', sub: 'DevKit V1 (WROOM-32)', nameSize: 20, nameY: 360,
    info: I('The controller: reads the sensors, drives the four MOSFETs and talks to the phone (Wi-Fi access point AQUA-NODE and Bluetooth).',
      'Le contrôleur : lit les capteurs, commande les quatre MOSFET et parle au téléphone (point d’accès Wi-Fi AQUA-NODE et Bluetooth).'),
    pins: {
      left: [pin('VIN', 'power', '5 V input from LM2596 #2.', 'Entrée 5 V depuis le LM2596 n°2.'),
        pin('GND', 'gnd', 'Ground.', 'Masse.'),
        pin('3V3', 'power', '3.3 V made by the board, for the ADS1115 and the DS18B20.', '3,3 V produit par la carte, pour l’ADS1115 et le DS18B20.'),
        pin('GPIO22 · SCL', 'used', 'I²C clock.', 'Horloge I²C.'),
        pin('GPIO21 · SDA', 'used', 'I²C data.', 'Données I²C.'),
        null,
        pin('GPIO4', 'used', 'DS18B20 data (1-Wire).', 'Données du DS18B20 (1-Wire).'),
        pin('GPIO34', 'used', 'Flow pulses, input only.', 'Impulsions de débit, entrée seule.'),
        pin('GPIO27', 'used', 'Float switch, internal pull-up: LOW = low water.', 'Flotteur, pull-up interne : LOW = eau basse.')],
      right: [null, pin('GPIO25', 'used', 'Pump PWM 20 kHz → Q1.', 'MLI pompe 20 kHz → Q1.'), null,
        pin('GPIO26', 'used', 'Air pump → Q2.', 'Pompe à air → Q2.'), null, null,
        pin('GPIO33', 'used', 'Dosing pump → Q3.', 'Pompe doseuse → Q3.'), null,
        pin('GPIO32', 'used', 'Heater demo → Q4.', 'Chauffage démo → Q4.')],
    } });
  D.wire([[730, 360], [705, 360], [705, 345]], { cls: 'v5' }); V5(705, 345);
  D.wire([[730, 420], [712, 420]], { cls: 'gnd' }); D.ground(712, 420);
  D.wire([[730, 480], [705, 480], [705, 465]], { cls: 'v33' }); V33(705, 465);

  // ================================================================ sensors
  D.text(20, 420, I('Sensors (E1)', 'Capteurs (E1)'), { weight: 700, size: 16 });
  // pH board -> divider -> ADS1115 A0
  D.chip({ x: 40, y: 450, w: 170, pitch: 30, name: 'PH-4502C', sub: I('pH board', 'carte pH'),
    info: I('The pH board amplifies the tiny probe voltage: about 2.5 V at pH 7, output up to about 5 V. Powered at 5 V.',
      'La carte pH amplifie la très faible tension de la sonde : environ 2,5 V à pH 7, sortie jusqu’à environ 5 V. Alimentée en 5 V.'),
    pins: { left: [null, null, pin('BNC', 'input', 'The pH probe connector. Keep the probe wet; use a twisted cable away from the PWM wires.',
      'Le connecteur de la sonde pH. Garder la sonde mouillée ; câble torsadé loin des fils MLI.')],
      right: [pin('VCC', 'power', '5 V supply.', 'Alimentation 5 V.'), pin('GND', 'gnd', 'Ground.', 'Masse.'),
        pin('PO', 'used', 'Analog pH output, 0 to about 5 V: too high for 3.3 V parts, hence the divider.', 'Sortie pH analogique, 0 à environ 5 V : trop haut pour les composants 3,3 V, d’où le pont diviseur.'),
        pin('DO', 'free', 'Digital limit output: not used.', 'Sortie numérique de seuil : non utilisée.'),
        pin('TO', 'free', 'Temperature output of the board: not used (the DS18B20 is better).', 'Sortie température de la carte : non utilisée (le DS18B20 est meilleur).')] } });
  D.wire([[240, 480], [260, 480], [260, 465]], { cls: 'v5' }); V5(260, 465);
  D.wire([[240, 510], [255, 510]], { cls: 'gnd' }); D.ground(255, 510);
  D.wire([[240, 540], [260, 540]]);
  D.resistor([260, 540], [330, 540], { label: 'R1', value: '10 kΩ',
    info: I('Divider, upper resistor (sensor side). With R2: Vout = Vin × 15 / 25, so 5 V becomes 3.0 V.', 'Pont diviseur, résistance du haut (côté capteur). Avec R2 : Vout = Vin × 15 / 25, donc 5 V devient 3,0 V.') });
  D.wire([[330, 540], [410, 540]], { cls: 'sig', label: [362, 528, '0–3 V'] });
  D.dot(350, 540);
  D.resistor([350, 540], [350, 620], { label: 'R2', value: '15 kΩ',
    info: I('Divider, lower resistor (ground side). Exchanged with R1, 5 V would give only 2 V.', 'Pont diviseur, résistance du bas (côté masse). Inversée avec R1, 5 V ne donnerait que 2 V.') });
  D.ground(350, 620);
  D.chip({ x: 440, y: 510, w: 220, pitch: 30, name: 'ADS1115', sub: I('16-bit ADC · 0x48', 'CAN 16 bits · 0x48'),
    info: I('An external 16-bit analog-to-digital converter, more precise than the ESP32 ADC. Powered at 3.3 V; read over I²C at address 0x48.',
      'Un convertisseur analogique-numérique externe 16 bits, plus précis que celui de l’ESP32. Alimenté en 3,3 V ; lu en I²C à l’adresse 0x48.'),
    pins: { top: [null, pin('VDD', 'power', '3.3 V supply (so its pins never see more than 3.3 V).', 'Alimentation 3,3 V (ses broches ne voient jamais plus de 3,3 V).')],
      left: [pin('A0', 'used', 'Channel 0: the pH signal from the divider.', 'Canal 0 : le signal pH venant du pont.'),
        pin('A1', 'spare', 'Reserved for a future TDS/EC sensor.', 'Réservé à un futur capteur TDS/EC.'),
        pin('ADDR', 'gnd', 'Address pin to GND: I²C address 0x48.', 'Broche d’adresse à GND : adresse I²C 0x48.'),
        pin('GND', 'gnd', 'Ground.', 'Masse.')],
      right: [pin('SCL', 'used', 'I²C clock from GPIO22.', 'Horloge I²C depuis GPIO22.'), null, pin('SDA', 'used', 'I²C data to/from GPIO21.', 'Données I²C avec GPIO21.')] } });
  D.wire([[500, 480], [500, 470]], { cls: 'v33' }); V33(500, 470);
  D.wire([[410, 600], [392, 600], [392, 640]], { cls: 'gnd' }); D.wire([[410, 630], [392, 630]], { cls: 'gnd' }); D.dot(392, 630); D.ground(392, 640);
  D.wire([[690, 540], [730, 540]], { cls: 'data', info: I('I²C clock line.', 'Ligne d’horloge I²C.') });
  D.wire([[690, 600], [730, 600]], { cls: 'data', info: I('I²C data line.', 'Ligne de données I²C.') });

  // DS18B20 with its 4.7 k pull-up, on GPIO4
  D.chip({ x: 470, y: 690, w: 170, h: 75, pitch: 30, name: 'DS18B20', sub: I('water temp.', 'temp. de l’eau'),
    info: I('Digital waterproof temperature sensor, ±0.5 °C, on a 1-Wire bus.', 'Capteur numérique de température étanche, ±0,5 °C, sur un bus 1-Wire.'),
    pins: { left: [pin('VDD', 'power', '3.3 V supply.', 'Alimentation 3,3 V.'), pin('GND', 'gnd', 'Ground.', 'Masse.')],
      right: [pin('DQ', 'used', '1-Wire data: open drain, so it needs the pull-up.', 'Données 1-Wire : drain ouvert, d’où le pull-up.')] } });
  D.wire([[440, 720], [425, 720], [425, 705]], { cls: 'v33' }); V33(425, 705);
  D.wire([[440, 750], [428, 750]], { cls: 'gnd' }); D.ground(428, 750);
  D.wire([[670, 720], [730, 720]], { cls: 'sig' });
  D.dot(690, 720);
  D.resistor([690, 720], [690, 650], { label: 'R5', value: '4.7 kΩ',
    info: I('Pull-up of the 1-Wire line to 3.3 V: the sensor only pulls the line LOW.', 'Pull-up de la ligne 1-Wire vers 3,3 V : le capteur ne fait que tirer la ligne à LOW.') });
  V33(690, 650);

  // YF-S201 -> divider -> GPIO34
  D.chip({ x: 40, y: 720, w: 170, pitch: 30, name: 'YF-S201', sub: I('flow sensor', 'débitmètre'),
    info: I('Hall-effect flow sensor: about 450 pulses per litre (7.5 Hz per L/min). Reads zero below about 1 L/min.',
      'Débitmètre à effet Hall : environ 450 impulsions par litre (7,5 Hz par L/min). Lit zéro sous environ 1 L/min.'),
    pins: { right: [pin('VCC', 'power', '5 V supply (red wire).', 'Alimentation 5 V (fil rouge).'),
      pin('SIG', 'used', 'Pulse output, up to 5 V (yellow wire).', 'Sortie impulsions, jusqu’à 5 V (fil jaune).'),
      pin('GND', 'gnd', 'Ground (black wire).', 'Masse (fil noir).')] } });
  D.wire([[240, 750], [260, 750], [260, 735]], { cls: 'v5' }); V5(260, 735);
  D.wire([[240, 810], [255, 810]], { cls: 'gnd' }); D.ground(255, 810);
  D.wire([[240, 780], [260, 780]]);
  D.resistor([260, 780], [330, 780], { label: 'R3', value: '10 kΩ', info: I('Flow divider, upper resistor.', 'Pont du débitmètre, résistance du haut.') });
  D.wire([[330, 780], [730, 780]], { cls: 'sig', label: [372, 768, '0–3 V pulses'] });
  D.dot(350, 780);
  D.resistor([350, 780], [350, 860], { label: 'R4', value: '15 kΩ', info: I('Flow divider, lower resistor: 5 V pulses become 3 V pulses.', 'Pont du débitmètre, résistance du bas : des impulsions de 5 V deviennent 3 V.') });
  D.ground(350, 860);

  // float switch on GPIO27
  D.switch([590, 840], [670, 840], { label: 'S1', value: I('float switch', 'flotteur'),
    info: I('Float switch to GND. The ESP32 internal pull-up keeps GPIO27 HIGH; low water closes the switch and the pin reads LOW in under 1 s.',
      'Flotteur vers GND. Le pull-up interne de l’ESP32 garde GPIO27 à HIGH ; l’eau basse ferme le contact et la broche lit LOW en moins de 1 s.') });
  D.wire([[670, 840], [730, 840]], { cls: 'sig' });
  D.wire([[590, 840], [570, 840]], { cls: 'gnd' }); D.ground(570, 840);

  // ================================================================ outputs (P3)
  D.text(1050, 230, I('Outputs (P3): one low-side MOSFET per load', 'Sorties (P3) : un MOSFET côté bas par charge'), { weight: 700, size: 16 });
  const gateInfo = I('Gate resistor 220 Ω: limits the current that charges the MOSFET gate and damps ringing.', 'Résistance de grille 220 Ω : limite le courant qui charge la grille du MOSFET et amortit les oscillations.');
  const pdInfo = I('Gate pull-down 10 kΩ: keeps the MOSFET OFF while the ESP32 resets and its pin floats.', 'Pull-down de grille 10 kΩ : garde le MOSFET bloqué pendant le reset de l’ESP32, quand sa broche flotte.');
  const qInfo = I('IRLZ44N logic-level N-MOSFET, low side: source to GND, load to drain. 3.3 V on the gate turns it fully ON.',
    'MOSFET N IRLZ44N à niveau logique, côté bas : source à GND, charge au drain. 3,3 V sur la grille le rend complètement passant.');
  const dInfo = I('Flyback diode (1N5819) across the motor: when the MOSFET turns OFF, the motor coil current flows through it instead of making a high voltage spike on the drain.',
    'Diode de roue libre (1N5819) aux bornes du moteur : quand le MOSFET se bloque, le courant de la bobine passe par elle au lieu de créer un pic de tension sur le drain.');
  function stage(x, y, o) {
    D.text(x, y - 150, o.title, { weight: 700, size: 14 });
    D.resistor([x, y], [x + 80, y], { label: 'R' + o.n + 'g', value: '220 Ω', info: gateInfo });
    D.wire([[x + 80, y], [x + 110, y]], { cls: 'sig' }); D.dot(x + 90, y);
    D.resistor([x + 90, y], [x + 90, y + 70], { value: '10 kΩ', info: pdInfo }); D.ground(x + 90, y + 70);
    const q = D.nmos(x + 110, y, { label: 'Q' + o.n, value: 'IRLZ44N', info: qInfo });
    D.ground(q.s[0], q.s[1]);
    const nb = [x + 150, y - 45], nt = [x + 150, y - 125];
    D.wire([q.d, nb]);
    if (o.heater) D.resistor(nb, nt, { label: 'RH', value: '2 × 47 Ω 5 W', info: o.info });
    else D.motor(nb, nt, { label: o.load, value: o.value, info: o.info });
    D.wire([nt, [x + 150, y - 140]], { cls: o.rail });
    D.rail(x + 150, y - 140, o.rail === 'v5' ? '+5 V' : '+12 V', o.rail);
    if (!o.heater) {
      D.wire([nb, [x + 110, y - 45]]); D.wire([[x + 110, y - 125], nt]);
      D.diode([x + 110, y - 45], [x + 110, y - 125], { schottky: true, info: dInfo });
      D.note(x + 100, y - 85, 'D' + o.n, { anchor: 'end', weight: 700 });
      D.dot(nb[0], nb[1]); D.dot(nt[0], nt[1]);
    }
    if (o.bypass) {
      D.wire([nb, [x + 230, y - 45]]);
      D.switch([x + 230, y - 45], [x + 230, y + 30], { info: o.bypass });
      D.ground(x + 230, y + 30);
      D.note(x + 244, y - 18, 'S2', { weight: 700 }); D.note(x + 244, y - 2, I('bypass', 'secours'));
    }
  }
  D.wire([[1010, 420], [1050, 420]], { cls: 'sig', label: [1012, 408, 'PWM'] });
  stage(1050, 420, { n: 1, title: I('Circulation pump', 'Pompe de circulation'), load: 'M1', value: '12 V', rail: 'v12',
    info: I('The 12 V water pump. PWM at 20 kHz sets its speed; small pumps often need 30 % or more to start.', 'La pompe à eau 12 V. La MLI à 20 kHz règle sa vitesse ; les petites pompes demandent souvent 30 % ou plus pour démarrer.') });
  D.wire([[1010, 540], [1330, 540]], { cls: 'sig' });
  stage(1330, 540, { n: 2, title: I('Air pump (aerator)', 'Pompe à air (aérateur)'), load: 'M2', value: '12 V', rail: 'v12',
    info: I('The 12 V air pump: oxygen for fish, bacteria and roots. ON by default.', 'La pompe à air 12 V : de l’oxygène pour poissons, bactéries et racines. En marche par défaut.'),
    bypass: I('Bypass toggle switch (ALWAYS ON / ESP32): closed, it grounds the air pump directly, so the air keeps flowing even if the ESP32 has crashed.',
      'Interrupteur de secours (TOUJOURS / ESP32) : fermé, il relie directement la pompe à air à la masse, l’air continue donc même si l’ESP32 est planté.') });
  D.wire([[1010, 720], [1050, 720]], { cls: 'sig' });
  stage(1050, 720, { n: 3, title: I('Dosing pump', 'Pompe doseuse'), load: 'M3', value: '5 V', rail: 'v5',
    info: I('The small 5 V dosing pump: adds base (baking soda) in short pulses, then waits for mixing.', 'La petite pompe doseuse 5 V : ajoute une base (bicarbonate) par courtes impulsions, puis attend le mélange.') });
  D.wire([[1010, 840], [1330, 840]], { cls: 'sig' });
  stage(1330, 840, { n: 4, title: I('Heater demo', 'Chauffage démo'), heater: true, rail: 'v12',
    info: I('Heater demo: two 47 Ω 5 W resistors in parallel (23.5 Ω), about 6 W at 12 V. A resistor has no coil, so no flyback diode.',
      'Chauffage démo : deux résistances 47 Ω 5 W en parallèle (23,5 Ω), environ 6 W sous 12 V. Une résistance n’a pas de bobine, donc pas de diode de roue libre.') });

  D.legend(1230, 40, [['v19', '19 V'], ['v12', '12 V'], ['v5', '5 V'], ['v33', '3.3 V'], ['gnd', 'GND'], ['sig', I('signal', 'signal')], ['data', 'I²C']]);
  D.note(1330, 40, I('Every ground symbol is the same node:', 'Chaque symbole de masse est le même nœud :'), { size: 13 });
  D.note(1330, 58, I('wired back to one star point at the', 'relié à un seul point étoile au'), { size: 13 });
  D.note(1330, 76, I('adapter negative.', 'négatif de l’adaptateur.'), { size: 13 });
  D.note(1330, 104, I('Every rail symbol (+12 V, +5 V, +3.3 V) is', 'Chaque symbole de rail (+12 V, +5 V, +3,3 V) est'), { size: 13 });
  D.note(1330, 122, I('wired to its source above or to the ESP32 3V3.', 'relié à sa source en haut ou au 3V3 de l’ESP32.'), { size: 13 });
};
