/* q314-divider: quiz drawing for 3.1.4, the pH divider between the PH-4502C and the ADS1115. */
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['q314-divider'] = function (D) {
  D.size(640, 250);
  D.chip({ x: 20, y: 40, w: 130, pitch: 30, name: 'PH-4502C', sub: { en: 'pH board', fr: 'carte pH' },
    pins: { right: [{ n: 'VCC', role: 'power' }, { n: 'GND', role: 'gnd' }, { n: 'PO', role: 'used' }] } });
  D.wire([[180, 70], [200, 70], [200, 55]], { cls: 'v5' }); D.rail(200, 55, '+5 V', 'v5');
  D.wire([[180, 100], [195, 100]], { cls: 'gnd' }); D.ground(195, 100);
  D.wire([[180, 130], [220, 130]]);
  D.note(186, 150, 'PO = 5.0 V', { weight: 700 });
  D.resistor([220, 130], [310, 130], { label: 'R1', value: '10 kΩ' });
  D.wire([[310, 130], [460, 130]], { cls: 'sig' }); D.dot(340, 130);
  D.resistor([340, 130], [340, 220], { label: 'R2', value: '15 kΩ' }); D.ground(340, 220);
  D.text(400, 112, 'A0 = ?', { weight: 700, size: 16 });
  D.chip({ x: 490, y: 100, w: 130, pitch: 30, name: 'ADS1115', pins: { left: [{ n: 'A0', role: 'used' }] } });
};
