/* pdfview.js - opens the reference documents (docs/*.pdf) inside the app on phones, which cannot open a PDF at an exact
 * page by themselves. A computer opens them in the browser itself. PDF.js (pdfjs/) is loaded only when it is needed. */
(function () {
  'use strict';
  const { h, icon } = UI;
  const ZOOMS = [1, 1.5, 2, 3];
  const MAX_PIXELS = 12e6;                                     // phones refuse larger canvases
  let lib = null;

  const wanted = () => /^https?:$/.test(location.protocol) && !window.ESP32TOUR_SINGLE &&
    (window.matchMedia('(pointer: coarse)').matches || navigator.pdfViewerEnabled === false);

  function load() {
    if (!lib) {
      const base = new URL('pdfjs/', document.baseURI).href;
      lib = import(base + 'pdf.min.mjs').then((m) => {
        m.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
        return { m, base };
      });
      lib.catch(() => { lib = null; });                        // offline and not stored yet: try again next time
    }
    return lib;
  }

  // url = docs/<file>.pdf#page=N
  function open(url, title) {
    const file = url.split('#')[0], first = Number((url.match(/#page=(\d+)/) || [])[1]) || 1;
    let pdf = null, page = first, zoom = 0, task = null, drawn = 0, closed = false;
    const num = h('span', { class: 'pdf-num' }, '…');
    const btn = (ic, key, fn) => h('button', { class: 'pdf-btn', type: 'button', 'aria-label': t(key), title: t(key), onclick: fn }, icon(ic));
    const prev = btn('arrow-left', 'learn.prev', () => show(page - 1)), next = btn('arrow-right', 'learn.next', () => show(page + 1));
    const out = btn('zoom-out', 'pdf.zoom.out', () => setZoom(zoom - 1)), inn = btn('zoom-in', 'pdf.zoom.in', () => setZoom(zoom + 1));
    const body = h('div', { class: 'pdf-body', tabindex: '0' }, h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner' }), h('span', null, t('pdf.loading'))));
    const el = h('div', { class: 'pdf-view', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'pdf-head' }, icon('file-text'), h('b', null, title), btn('x', 'common.close', () => history.back())),
      body, h('div', { class: 'pdf-foot' }, prev, num, next, h('span', { class: 'grow' }), out, inn));
    const prevFocus = document.activeElement;

    function buttons() {
      prev.disabled = !pdf || page <= 1; next.disabled = !pdf || page >= pdf.numPages;
      out.disabled = !pdf || zoom === 0; inn.disabled = !pdf || zoom === ZOOMS.length - 1;
      num.textContent = pdf ? t('learn.page', { n: page, m: pdf.numPages }) : '…';
    }
    async function draw() {
      const turn = ++drawn;
      if (task) { task.cancel(); task = null; }
      const p = await pdf.getPage(page);
      if (closed || turn !== drawn) return;
      const base = p.getViewport({ scale: 1 }), fit = Math.max(200, body.clientWidth - 16) / base.width;
      const css = fit * ZOOMS[zoom];
      let dens = Math.min(window.devicePixelRatio || 1, 3);
      const px = base.width * base.height * css * css;
      if (px * dens * dens > MAX_PIXELS) dens = Math.sqrt(MAX_PIXELS / px);
      const vp = p.getViewport({ scale: css * dens });
      const canvas = h('canvas', { class: 'pdf-page', width: Math.floor(vp.width), height: Math.floor(vp.height), 'aria-label': t('learn.page', { n: page, m: pdf.numPages }) });
      canvas.style.width = Math.floor(base.width * css) + 'px';
      task = p.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      try { await task.promise; } catch (e) { return; }         // cancelled by a newer page or zoom
      if (closed || turn !== drawn) return;
      body.replaceChildren(canvas); el.dataset.page = String(page);
    }
    function show(n) { if (!pdf) return; page = Math.max(1, Math.min(pdf.numPages, n)); buttons(); body.scrollTo(0, 0); draw(); }
    function setZoom(z) { zoom = Math.max(0, Math.min(ZOOMS.length - 1, z)); buttons(); draw(); }
    function close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('popstate', close); window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey, true);
      if (pdf) pdf.destroy();
      document.documentElement.classList.remove('pdf-open'); el.remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    }
    const onResize = () => { if (pdf) draw(); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); history.back(); }
      else if (e.key === 'ArrowLeft') show(page - 1);
      else if (e.key === 'ArrowRight') show(page + 1);
    };

    history.pushState({ pdf: 1 }, '');                           // the phone's Back button closes the document
    window.addEventListener('popstate', close); window.addEventListener('resize', onResize); document.addEventListener('keydown', onKey, true);
    document.documentElement.classList.add('pdf-open');
    document.body.appendChild(el); buttons(); body.focus({ preventScroll: true });

    (async () => {
      try {
        const [{ m, base }, data] = await Promise.all([load(), fetch(file).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })]);
        if (closed) return;
        pdf = await m.getDocument({ data, cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', isEvalSupported: false }).promise;
        if (closed) { pdf.destroy(); return; }
        show(first);
      } catch (e) {
        console.warn('document not opened', e);
        if (!closed) body.replaceChildren(h('div', { class: 'pdf-err' }, icon('circle-alert'), h('p', null, t('pdf.err'))));
      }
    })();
  }

  window.PdfView = { wanted, open };
})();
