/* pwa.js - registers the offline service worker (only over http/https; file:// and the single file skip it),
 * shows "Ready to work offline" and "Update available", stores the documents, and asks the browser to keep the data. */
(function () {
  'use strict';
  const secure = /^https?:$/.test(location.protocol);

  // The reference documents and the PDF viewer have their own cache (the same name as in sw.js).
  const DOCS = 'esp32tour-docs-1';
  const list = () => window.ESP32TOUR_COURSE.store || [];
  const abs = (p) => new URL(p, document.baseURI).href;
  let running = null;
  window.DocStore = {
    supported: secure && 'caches' in window && 'serviceWorker' in navigator && !window.ESP32TOUR_SINGLE && list().length > 0,
    async missing() {
      const c = await caches.open(DOCS), out = [];
      for (const p of list()) if (!(await c.match(abs(p)))) out.push(p);
      return out;
    },
    // Store what is not there yet. Returns true when everything is stored.
    store(onStep) {
      if (!running) {
        running = (async () => {
          const c = await caches.open(DOCS), todo = await this.missing();
          for (let i = 0; i < todo.length; i++) {
            const r = await fetch(abs(todo[i]), { cache: 'reload' });   // never an old copy or an old error page
            if (!r.ok) throw new Error(todo[i] + ' ' + r.status);
            await c.put(abs(todo[i]), r);
            if (this.onStep) this.onStep(todo.length - i - 1);
          }
          return todo.length;
        })().finally(() => { running = null; });
      }
      this.onStep = onStep || this.onStep;
      return running;
    }
  };
  function storeDocs() {                                              // in the background, after the app itself is stored
    const net = navigator.connection;
    if (!DocStore.supported || (net && net.saveData)) return;         // "data saver" is on: Settings has the button
    DocStore.store().then((n) => { if (n) UI.toast(t('pwa.docs')); }).catch((e) => console.warn('documents not stored yet', e));
  }

  function register() {
    if (!secure || !('serviceWorker' in navigator) || window.ESP32TOUR_SINGLE) return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;

    navigator.serviceWorker.register('sw.js').then((reg) => {
      const offer = (worker) => UI.toast(t('pwa.update'), 'info', {
        label: t('pwa.reload'), sticky: true, onClick: () => worker.postMessage('SKIP_WAITING')
      });
      if (reg.waiting && hadController) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state !== 'installed') return;
          if (navigator.serviceWorker.controller) offer(w);          // an older version is running: new one is waiting
          else UI.toast(t('pwa.ready'));                              // first install: everything is now cached
        });
      });
      navigator.serviceWorker.ready.then(() => setTimeout(storeDocs, 1500));
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);   // look for a new version hourly while open
    }).catch((e) => console.warn('service worker not registered', e));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return;                        // do not reload on the very first install
      reloading = true; location.reload();
    });

    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  window.addEventListener('load', register);
})();
