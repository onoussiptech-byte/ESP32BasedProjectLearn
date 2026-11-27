/* q314-pins: quiz drawing for 3.1.4, six DevKit pins with no role colours (the student chooses). */
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['q314-pins'] = function (D) {
  D.size(640, 260);
  const p = (n) => ({ n, role: 'free' });
  D.chip({ x: 220, y: 20, w: 200, pitch: 36, name: 'ESP32', sub: 'DevKit V1',
    pins: { left: [p('GPIO12'), p('GPIO25'), p('GPIO34')], right: [p('GPIO1 · TX0'), p('GPIO26'), p('GPIO15')] } });
  D.note(320, 200, { en: 'Which of these pins can safely drive a MOSFET gate?', fr: 'Lesquelles de ces broches peuvent commander une grille de MOSFET sans risque ?' }, { anchor: 'middle', size: 14 });
};
