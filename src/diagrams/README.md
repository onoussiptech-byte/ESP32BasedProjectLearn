# Diagrams drawn with code (SVG.js)

One file per diagram: `src/diagrams/<name>.js`, shown by a lesson block `{"type": "diagram", "name": "<name>", "caption": {...}}`.
The file registers a function that receives the drawing kit `D` of `src/templates/js/diagrams.js`:

```js
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['divider'] = function (D) {
  D.size(520, 300);                                   // the drawing area (it scales to the page)
  D.rail(80, 40, '+5 V', 'v5');
  D.resistor([80, 40], [80, 140], { label: 'R1', value: '10 kΩ', info: { en: '...', fr: '...' } });
  D.resistor([80, 140], [80, 240], { label: 'R2', value: '15 kΩ' });
  D.ground(80, 240);
  D.wire([[80, 140], [220, 140]], { cls: 'sig', label: [230, 140, 'to GPIO 34'] });
};
```

Kit: `size`, `text`, `wire` (cls `v19` `v12` `v5` `v33` `gnd` `sig` `data`; `flow: true` animates), `arrow`, `dot`, `box`,
`chip` (a rectangle with named pins on its four sides; returns the pin ends), `resistor`, `capacitor`, `diode` (`schottky`,
`led`), `fuse`, `motor`, `switch`, `nmos` (returns gate, drain, source), `ground`, `rail`, `note`, `legend`.
Texts may be `{en, fr}`. Any part, pin or wire may have `info: {en, fr}`: it is shown under the drawing when tapped.
Parts the kit does not have (ESP32, pH board, LM2596 module...) are drawn as `chip` boxes with their real pin names.
No simulation. SVG.js 3.2.8 (MIT) is in `src/assets/vendor/svgjs/`, fetched by `src/tools/fetch_vendor.py`.

## Extra tools (loaded only when a diagram asks for them)

Add after the function: `ESP32TOUR_DIAGRAMS['name'].uses = ['katex', 'wavedrom', 'jsxgraph', 'mermaid'];` (only the ones needed).
The build then copies those tools to `app/lib/` (and inlines them in the single file, KaTeX fonts included). Nothing is copied otherwise.

| Tool (licence) | Kit call | For |
|---|---|---|
| KaTeX 0.16.11 (MIT) | ``D.math(x, y, String.raw`V_{out} = D \cdot V_{in}`, {size, anchor, w, h, info})``, `D.mathHtml(tex, display)` | formulas: fractions, sums, units |
| WaveDrom 3.5.0 (MIT) | `D.wave({signal: [{name: 'PWM', wave: 'p....'}]}, {info})` | timing waveforms (PWM, I2C, pulses) |
| JSXGraph 1.10.1 (MIT) | `D.graph({box: [x0, y1, x1, y0], height}, (board, JXG) => {...})` | interactive curves, sliders, draggable points |
| Mermaid 11.4.1 (MIT) | `D.mermaid('flowchart LR\n A --> B', {info})` (returns a promise: return it) | block diagrams and flowcharts written as text |

Write TeX with ``String.raw`...` `` so the backslashes stay. `D.svgOff()` hides the SVG area when a diagram uses only panels.

## Diagrams in quiz questions

A question may carry `"diagram": {"name": "esp32-pins", "caption": {...}}`. In the question the tap explanations are hidden
(they could give the answer); in the review after the quiz the same diagram shows them.
