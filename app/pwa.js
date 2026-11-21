/* pwa.js - registers the offline service worker (only over http/https; file:// and the single file skip it),
 * shows "Ready to work offline" and "Update available", and asks the browser to keep the data. */
(function () {
  'use strict';
  const secure = /^https?:$/.test(location.protocol);

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
