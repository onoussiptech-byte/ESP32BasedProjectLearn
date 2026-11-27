/* diagrams.js - code-drawn diagrams for the lessons (pin maps, circuits, block diagrams), drawn with SVG.js.
 *
 * A lesson block {"type": "diagram", "name": "esp32-pins", "caption": {...}} shows src/diagrams/esp32-pins.js. That file
 * registers a drawing function:
 *
 *   window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
 *   ESP32TOUR_DIAGRAMS['esp32-pins'] = function (D) { D.size(900, 600); const p = D.chip({...}); D.wire([...]); };
 *
 * D is the kit below. Colours follow the project's wire colours (red 19 V, orange 12 V, pink 5 V, blue 3.3 V,
 * GND = text colour, yellow/amber signals) and switch with the light and dark themes. Every part or pin may carry an
 * explanation ({en, fr}) shown under the drawing when it is hovered or tapped. Nothing is simulated.
 * SVG.js (app/svg.min.js) and the diagram file are loaded only when a lesson shows a diagram.
 *
 * Extra tools, loaded only when a diagram file asks for them with  ESP32TOUR_DIAGRAMS['name'].uses = ['katex', ...]:
 *   katex    D.math(x, y, 'V_{out} = D \\cdot V_{in}', {size, anchor})  a formula inside the drawing
 *   wavedrom D.wave({signal: [...]})                                     a timing waveform panel under the drawing
 *   jsxgraph D.graph({box: [x0, y1, x1, y0], height}, (board, JXG) => {...})  an interactive graph / curve panel
 *   mermaid  D.mermaid('flowchart LR; A-->B')                              a block diagram written as text
 * D.svgOff() hides the SVG area when a diagram is made only of panels. The build copies the asked tools into app/lib/. */
(function () {
  'use strict';
  const { h, icon } = UI;
  const L = (x) => (x == null ? '' : typeof x === 'string' ? x : I18n.pick(x));
  const loaded = {};

  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => { s.remove(); resolve(); };
        s.onerror = () => { s.remove(); delete loaded[src]; reject(new Error('load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }
  function loadCss(href) {
    if (!loaded[href]) {
      loaded[href] = new Promise((resolve, reject) => {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href; l.onload = resolve;
        l.onerror = () => { delete loaded[href]; reject(new Error('load ' + href)); };
        document.head.appendChild(l);
      });
    }
    return loaded[href];
  }
  // the extra tools: [global it defines, scripts in order, stylesheets]; in the single file they are already inside
  const LIBS = {
    katex: ['katex', ['katex/katex.min.js'], ['katex/katex.min.css']],
    wavedrom: ['WaveDrom', ['wavedrom/default.js', 'wavedrom/wavedrom.min.js'], []],
    jsxgraph: ['JXG', ['jsxgraph/jsxgraphcore.js'], ['jsxgraph/jsxgraph.css']],
    mermaid: ['mermaid', ['mermaid/mermaid.min.js'], []],
  };
  function lib(n, v) {
    const it = LIBS[n];
    if (!it) return Promise.reject(new Error('unknown diagram tool ' + n));
    if (window[it[0]]) return Promise.resolve();
    return Promise.all(it[2].map((c) => loadCss('app/lib/' + c + v)))
      .then(() => it[1].reduce((pr, s) => pr.then(() => loadScript('app/lib/' + s + v)), Promise.resolve()));
  }
  function ready(name) {
    const reg = (window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {});
    const v = '?v=' + Store.VERSION;
    return Promise.all([window.SVG ? null : loadScript('app/svg.min.js' + v), reg[name] ? null : loadScript('diagrams/' + name + '.js' + v)])
      .then(() => {
        if (!reg[name]) throw new Error('empty diagram ' + name);
        return Promise.all((reg[name].uses || []).map((n) => lib(n, v)));
      })
      .then(() => reg[name]);
  }

  // ================================================================== the drawing kit
  let seq = 0;
  function kit(svg, info, panels) {
    const D = { svg, L, lang: I18n.lang, W: 800, H: 500 };
    const panel = (cls) => { const el = h('div', { class: 'dg-panel ' + (cls || '') }); panels.appendChild(el); return el; };
    const hotPanel = (el, o) => {
      if (!o.info) return;
      el.classList.add('dg-hot');
      el.addEventListener('click', () => info.show(L(o.label), L(o.info)));
    };
    D.svgOff = () => svg.node.classList.add('dg-off');
    D.math = (x, y, tex, o = {}) => {                              // KaTeX formula placed in the drawing
      const w = o.w || 360, hh = o.h || 60;
      const left = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
      const fo = (o.g || svg).foreignObject(w, hh).attr({ x: left, y: y - hh / 2 });
      const align = o.anchor === 'middle' ? 'center' : o.anchor === 'end' ? 'right' : 'left';
      const div = h('div', { class: 'dg-math', style: 'font-size:' + (o.size || 18) + 'px;text-align:' + align + ';height:' + hh + 'px' });
      window.katex.render(L(tex), div, { throwOnError: false, displayMode: false });
      fo.node.appendChild(div);
      if (o.info) tip(fo, o.info, o.label);
      return fo;
    };
    D.mathHtml = (tex, display) => {                               // KaTeX formula as an HTML element (for panels)
      const s = h('span');
      window.katex.render(L(tex), s, { throwOnError: false, displayMode: !!display });
      return s;
    };
    D.wave = (source, o = {}) => {                                  // WaveDrom timing diagram
      const el = panel('dg-wave'), id = 'dgwave' + (++seq) + '_';
      el.appendChild(h('div', { id: id + '0' }));
      window.WaveDrom.RenderWaveForm(0, source, id);
      hotPanel(el, o);
      return el;
    };
    D.graph = (o, build) => {                                       // JSXGraph board: sliders, draggable points, curves
      const el = panel('dg-graph'), id = 'dggraph' + (++seq);
      el.appendChild(h('div', { id, class: 'jxgbox', style: 'width:100%;height:' + (o.height || 300) + 'px' }));
      const board = window.JXG.JSXGraph.initBoard(id, {
        boundingbox: o.box || [-1, 6, 10, -1], axis: o.axis !== false, keepAspectRatio: false,
        showCopyright: false, showNavigation: !!o.nav, pan: { enabled: false }, zoom: { enabled: false } });
      build(board, window.JXG);
      hotPanel(el, o);
      return board;
    };
    D.mermaid = (text, o = {}) => {                                 // block diagram written as text
      const el = panel('dg-mer'), id = 'dgmer' + (++seq);
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', fontFamily: 'Inter, sans-serif' });
      hotPanel(el, o);
      return window.mermaid.render(id, L(text)).then((res) => { el.innerHTML = res.svg; return el; });
    };
    const PITCH = 30, PIN = 30;                                    // chip pin spacing and pin length

    function tip(el, text, title) {
      if (!text) return el;
      el.addClass('dg-hot');
      const show = () => { info.show(L(title), L(text)); el.addClass('dg-on'); };
      el.on('mouseenter', show); el.on('click', show); el.on('mouseleave', () => el.removeClass('dg-on'));
      return el;
    }
    D.tip = tip;
    D.size = (w, hgt) => { D.W = w; D.H = hgt; svg.viewbox(0, 0, w, hgt); };
    D.minWidth = (px) => { svg.node.style.minWidth = px + 'px'; };   // a large drawing scrolls in its frame instead of shrinking too much
    D.group = (cls) => svg.group().addClass(cls || '');
    D.text = (x, y, s, o = {}) => {
      const t = (o.g || svg).plain(L(s)).font({ size: o.size || 15, anchor: o.anchor || 'start', weight: o.weight || 400 })
        .addClass('dg-text ' + (o.cls || ''));
      t.attr({ x, y, 'dominant-baseline': 'middle' });
      if (o.rotate) t.rotate(o.rotate, x, y);
      return t;
    };
    // a wire through points [[x,y], ...]; cls = 'sig' | 'v19' | 'v12' | 'v5' | 'v33' | 'gnd' | 'data'; flow animates it
    D.wire = (pts, o = {}) => {
      const g = svg.group().addClass('dg-wire ' + (o.cls || 'sig') + (o.flow ? ' dg-flow' : '') + (o.dash ? ' dg-dash' : ''));
      g.polyline(pts.flat()).fill('none');
      if (o.label) D.text(o.label[0], o.label[1], o.label[2], { g, size: 12, cls: 'dg-net', anchor: o.labelAnchor || 'start' });
      return tip(g, o.info, o.title);
    };
    D.arrow = (pts, o = {}) => {
      const w = D.wire(pts, o), [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
      const a = Math.atan2(y2 - y1, x2 - x1), s = 8;
      w.polygon([x2, y2, x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45), x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)]).addClass('dg-head');
      return w;
    };
    D.dot = (x, y, cls) => svg.circle(7).center(x, y).addClass('dg-dot ' + (cls || ''));
    D.box = (x, y, w, hgt, o = {}) => {
      const g = svg.group().addClass('dg-box ' + (o.cls || ''));
      g.rect(w, hgt).move(x, y).radius(o.r == null ? 8 : o.r);
      if (o.title) D.text(x + w / 2, y + (o.sub ? hgt / 2 - 9 : hgt / 2), o.title, { g, anchor: 'middle', weight: 700, size: o.size || 14 });
      if (o.sub) D.text(x + w / 2, y + hgt / 2 + 10, o.sub, { g, anchor: 'middle', size: 11, cls: 'dg-muted' });
      return tip(g, o.info, o.title);
    };

    /* A chip or module as a rectangle with named pins:
       D.chip({x, y, w, name, sub, pitch, pins: {left: [...], right: [...], top: [...], bottom: [...]}})
       pin = {n: 'GPIO25', alt: 'D25', role: 'used' | 'spare' | 'avoid' | 'power' | 'gnd' | 'free' | 'input', info: {en, fr}} or null (gap).
       Returns {pins: {n: [x, y]} (outer end of each pin line), box: {x, y, w, h}}. */
    D.chip = (o) => {
      const p = o.pins || {}, pitch = o.pitch || PITCH, side = (a) => (a || []).length;
      const hgt = o.h || Math.max(side(p.left), side(p.right), 2) * pitch + pitch;
      const w = o.w || Math.max(160, Math.max(side(p.top), side(p.bottom), 2) * pitch + pitch);
      const g = svg.group().addClass('dg-chip ' + (o.cls || ''));
      g.rect(w, hgt).move(o.x, o.y).radius(6).addClass('dg-chip-body');
      const ny = o.nameY != null ? o.y + o.nameY : o.y + hgt / 2;     // nameY: put the name between two pin rows
      D.text(o.x + w / 2, ny - (o.sub ? 10 : 0), o.name, { g, anchor: 'middle', weight: 700, size: o.nameSize || 16 });
      if (o.sub) D.text(o.x + w / 2, ny + 12, o.sub, { g, anchor: 'middle', size: 11, cls: 'dg-muted' });
      if (o.info) tip(g, o.info, o.name);
      const ends = {};
      const put = (pin, x1, y1, x2, y2, tx, ty, anchor, rot) => {
        if (!pin) return;
        const pg = svg.group().addClass('dg-pin ' + (pin.role || 'free'));
        pg.line(x1, y1, x2, y2);
        pg.circle(5).center(x2, y2).addClass('dg-pin-end');
        D.text(tx, ty, pin.n, { g: pg, anchor, size: o.pinSize || 13, weight: 600, rotate: rot });
        if (pin.alt) D.text(x2 + (x2 > x1 ? 4 : x2 < x1 ? -4 : 0), y2 + (y2 === y1 ? -9 : y2 > y1 ? 10 : -10), pin.alt,
          { g: pg, anchor: x2 > x1 ? 'start' : x2 < x1 ? 'end' : 'middle', size: 12, cls: 'dg-muted' });
        tip(pg, pin.info, pin.n + (pin.alt ? ' (' + pin.alt + ')' : ''));
        ends[pin.n] = [x2, y2];
      };
      (p.left || []).forEach((pin, i) => { const y = o.y + pitch * (i + 1); put(pin, o.x, y, o.x - PIN, y, o.x + 6, y, 'start'); });
      (p.right || []).forEach((pin, i) => { const y = o.y + pitch * (i + 1); put(pin, o.x + w, y, o.x + w + PIN, y, o.x + w - 6, y, 'end'); });
      (p.top || []).forEach((pin, i) => { const x = o.x + pitch * (i + 1); put(pin, x, o.y, x, o.y - PIN, x, o.y + 8, 'end', -90); });
      (p.bottom || []).forEach((pin, i) => { const x = o.x + pitch * (i + 1); put(pin, x, o.y + hgt, x, o.y + hgt + PIN, x, o.y + hgt - 8, 'start', -90); });
      return { pins: ends, box: { x: o.x, y: o.y, w, h: hgt } };
    };

    // ---- two-terminal parts between a and b (horizontal or vertical); the body sits in the middle
    function two(a, b, o, body) {
      const [x1, y1] = a, [x2, y2] = b, len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const g = svg.group().addClass('dg-part ' + (o.cls || ''));
      const inner = g.group();
      const bl = o.bodyLen || 44, s = (len - bl) / 2;
      inner.line(0, 0, s, 0); inner.line(len - s, 0, len, 0);
      body(inner, s, bl);
      inner.transform({ translateX: x1, translateY: y1, rotate: ang, origin: [0, 0] });
      if (o.label || o.value) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, vert = Math.abs(x2 - x1) < Math.abs(y2 - y1);
        const lx = vert ? mx + 16 : mx, ly = vert ? my : my - 18;
        if (o.label) D.text(lx, ly - (vert && o.value ? 8 : 0), o.label, { g, anchor: vert ? 'start' : 'middle', weight: 700, size: 14 });
        if (o.value) D.text(lx, vert ? ly + (o.label ? 8 : 0) : my + 18, o.value, { g, anchor: vert ? 'start' : 'middle', size: 11, cls: 'dg-muted', size: 13 });
      }
      return tip(g, o.info, o.label);
    }
    D.resistor = (a, b, o = {}) => two(a, b, o, (g, s, bl) => g.polyline([s, 0, s + 4, -7, s + 11, 7, s + 18, -7, s + 25, 7, s + 32, -7, s + 39, 7, s + bl, 0]).fill('none'));
    D.capacitor = (a, b, o = {}) => two(a, b, { bodyLen: 12, ...o }, (g, s) => { g.line(s, -11, s, 11); g.line(s + 12, -11, s + 12, 11);
      if (o.polar) D.text(s - 8, -12, '+', { g, size: 11, anchor: 'middle' }); });
    D.diode = (a, b, o = {}) => two(a, b, { bodyLen: 22, ...o }, (g, s) => {          // anode at a, cathode at b
      g.polygon([s, -9, s, 9, s + 16, 0]).addClass('dg-fill');
      const c = s + 16;
      g.line(c, -9, c, 9);
      if (o.schottky) { g.line(c, -9, c + 4, -9); g.line(c + 4, -9, c + 4, -6); g.line(c, 9, c - 4, 9); g.line(c - 4, 9, c - 4, 6); }
      if (o.led) { g.line(s + 6, -12, s + 12, -20); g.line(s + 12, -12, s + 18, -20); }
    });
    D.fuse = (a, b, o = {}) => two(a, b, { bodyLen: 34, ...o }, (g, s, bl) => { g.rect(bl, 12).move(s, -6).radius(2).addClass('dg-hollow'); g.line(s, 0, s + bl, 0); });
    D.motor = (a, b, o = {}) => two(a, b, { bodyLen: 32, ...o }, (g, s) => { g.circle(32).center(s + 16, 0).addClass('dg-hollow');
      D.text(s + 16, 1, 'M', { g, anchor: 'middle', weight: 700, size: 14 }).rotate(-Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, s + 16, 1); });
    D.switch = (a, b, o = {}) => two(a, b, { bodyLen: 34, ...o }, (g, s, bl) => { g.circle(5).center(s, 0); g.circle(5).center(s + bl, 0); g.line(s, 0, s + bl - 3, -12); });

    // ---- N-channel MOSFET (enhancement). Gate on the left at (x, y); drain up, source down. Returns the three pin ends.
    D.nmos = (x, y, o = {}) => {
      const g = svg.group().addClass('dg-part ' + (o.cls || ''));
      g.line(x, y, x + 18, y);                                       // gate lead
      g.line(x + 18, y - 14, x + 18, y + 14);                        // gate plate
      [[-12, -6], [-3, 3], [6, 12]].forEach(([a, b2]) => g.line(x + 24, y + a, x + 24, y + b2));   // channel (3 parts)
      g.polyline([x + 24, y - 9, x + 40, y - 9, x + 40, y - 30]).fill('none');                       // drain
      g.polyline([x + 24, y + 9, x + 40, y + 9, x + 40, y + 30]).fill('none');                       // source
      g.line(x + 24, y, x + 40, y); g.line(x + 40, y, x + 40, y + 9);                                 // body tied to source
      g.polygon([x + 25, y, x + 31, y - 4, x + 31, y + 4]).addClass('dg-fill');                       // arrow into the channel
      if (o.label) D.text(x + 48, y - 8, o.label, { g, weight: 700, size: 12 });
      if (o.value) D.text(x + 48, y + 8, o.value, { g, size: 11, cls: 'dg-muted' });
      tip(g, o.info, o.label);
      return { g: [x, y], d: [x + 40, y - 30], s: [x + 40, y + 30] };
    };
    D.ground = (x, y) => { const g = svg.group().addClass('dg-part gnd'); g.line(x, y, x, y + 8); g.line(x - 10, y + 8, x + 10, y + 8); g.line(x - 6, y + 12, x + 6, y + 12); g.line(x - 2, y + 16, x + 2, y + 16); return g; };
    D.rail = (x, y, label, cls) => { const g = svg.group().addClass('dg-part ' + (cls || '')); g.line(x - 12, y, x + 12, y); D.text(x, y - 10, label, { g, anchor: 'middle', weight: 700, size: 12 }); return g; };
    D.note = (x, y, s, o = {}) => D.text(x, y, s, { size: 12, cls: 'dg-muted', ...o });
    // a legend of wire colours: items = [[cls, label], ...]
    D.legend = (x, y, items) => items.forEach(([cls, lab], i) => {
      svg.line(x, y + i * 18, x + 26, y + i * 18).addClass('dg-wire ' + cls);
      D.text(x + 34, y + i * 18, lab, { size: 11 });
    });
    return D;
  }

  // ================================================================== the lesson block
  function block(name, caption, opts = {}) {
    const holder = h('div', { class: 'dg-holder', role: 'img', 'aria-label': caption ? caption.textContent || '' : name },
      h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner' }), h('span', null, t('dg.loading'))));
    const infoTitle = h('b'), infoText = h('span', null, t('dg.hint'));
    const infoBox = h('div', { class: 'dg-info', 'aria-live': 'polite' }, icon('info'), h('div', null, infoTitle, infoText));
    const info = { show: (ti, tx) => { infoTitle.textContent = ti ? ti + ' · ' : ''; infoText.textContent = tx; } };
    const big = h('button', { class: 'dg-big', type: 'button', title: t('fig.enlarge'), 'aria-label': t('fig.enlarge') }, icon('layers'));
    const quiet = !!opts.quiz;                                     // inside a quiz question: explanations hidden (they could give the answer)
    if (quiet) infoBox.hidden = true;
    const fig = h('figure', { class: quiet ? 'dg dg-quiz' : 'dg' }, big, holder, infoBox, caption ? h('figcaption', null, caption) : null);
    const mute = { show() {} };
    function draw(into, inf) {
      return ready(name).then((fn) => {
        into.replaceChildren();
        const svg = window.SVG().addTo(into).addClass('dg-svg');
        const panels = h('div', { class: 'dg-panels' });
        into.appendChild(panels);
        return fn(kit(svg, quiet ? mute : inf, panels));
      });
    }
    draw(holder, info).catch((e) => { console.warn(e); holder.replaceChildren(h('p', { class: 'dg-err' }, icon('circle-alert'), t('dg.err'))); });
    big.addEventListener('click', () => {                          // a larger copy in a window, with its own explanation line
      const area = h('div', { class: 'dg-holder big' }), t2 = h('b'), x2 = h('span', null, t('dg.hint'));
      const m = UI.modal({ title: caption ? caption.textContent : name,
        body: h('div', null, area, quiet ? null : h('div', { class: 'dg-info' }, icon('info'), h('div', null, t2, x2))) });
      m.el.classList.add('modal-wide');
      draw(area, { show: (ti, tx) => { t2.textContent = ti ? ti + ' · ' : ''; x2.textContent = tx; } })
        .catch((e) => { console.warn(e); area.replaceChildren(h('p', { class: 'dg-err' }, icon('circle-alert'), t('dg.err'))); });
    });
    return fig;
  }

  window.Diagrams = { block, kit, LIBS };
})();
