/* q314-stage: quiz drawing for 3.1.4, one output stage (pump on GPIO25 through Q1), every part named. */
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['q314-stage'] = function (D) {
  D.size(560, 330);
  const x = 150, y = 210;
  D.chip({ x: 10, y: y - 40, w: 90, h: 80, pitch: 40, name: 'ESP32', pins: { right: [{ n: 'GPIO25', role: 'used' }] } });
  D.wire([[130, y], [x, y]], { cls: 'sig' });
  D.resistor([x, y], [x + 80, y], { label: 'R1', value: '220 Ω' });
  D.wire([[x + 80, y], [x + 110, y]], { cls: 'sig' }); D.dot(x + 90, y);
  D.resistor([x + 90, y], [x + 90, y + 70], { label: 'R2', value: '10 kΩ' }); D.ground(x + 90, y + 70);
  const q = D.nmos(x + 110, y, { label: 'Q1', value: 'IRLZ44N' });
  D.ground(q.s[0], q.s[1]);
  const nb = [x + 150, y - 45], nt = [x + 150, y - 125];
  D.wire([q.d, nb]);
  D.motor(nb, nt, { label: 'M1', value: { en: 'pump 12 V', fr: 'pompe 12 V' } });
  D.wire([nt, [x + 150, y - 140]], { cls: 'v12' }); D.rail(x + 150, y - 140, '+12 V', 'v12');
  D.wire([nb, [x + 110, y - 45]]); D.wire([[x + 110, y - 125], nt]);
  D.diode([x + 110, y - 45], [x + 110, y - 125], { schottky: true });
  D.note(x + 100, y - 85, 'D1', { anchor: 'end', weight: 700 });
  D.dot(nb[0], nb[1]); D.dot(nt[0], nt[1]);
  D.fuse([400, 40], [500, 40], { label: 'F1', value: '3 A', cls: 'v19' });
  D.note(450, 70, { en: '(in the 19 V lead)', fr: '(sur le fil 19 V)' }, { anchor: 'middle' });
};
