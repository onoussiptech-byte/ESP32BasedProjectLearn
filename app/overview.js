/* overview.js - the Overview page (home and menu in one) and the two pages behind its last two buttons:
 * Account management and Settings. They are shown without the workspace header (tabs, Score, Total mark).
 *
 * Routes (location.hash):  #/overview   #/account   #/settings */
(function () {
  'use strict';
  const { h, icon, ring, toast } = UI;

  // A workspace groups some tabs of the course; its progress, Score and Total mark come from those tabs only.
  // dash = the route of its Dashboard
  const WORKSPACES = [
    { id: 'esp32', icon: 'cpu', tone: 'blue', tabs: ['t1', 't2'], dash: 'dashboard', href: '#/dashboard' },
    { id: 'aqua', icon: 'fish', tone: 'green', tabs: ['t3', 't4'], dash: 'aquaponics', href: '#/aquaponics' }
  ];

  const initial = (a) => (a.first.trim()[0] || a.id[0]).toUpperCase();
  const delay = (i) => ({ animationDelay: i * 60 + 'ms' });

  function who(a, cls) {
    return h('div', { class: 'ov-who' + (cls ? ' ' + cls : '') }, h('span', { class: 'avatar' }, initial(a)),
      h('span', { class: 'ov-who-text' }, h('small', null, t('ov.current')), h('strong', null, a.first + ' ' + a.last), h('small', null, a.id)));
  }

  // ------------------------------------------------------------------ Overview
  // below = an extra line under the texts, side = something before the arrow (the progress ring)
  function rowLink(i, o, below, side) {
    return h('a', { class: 'ov-row', href: o.href, 'data-ov': o.id, style: delay(i + 1) },
      h('span', { class: 'ov-ic ' + o.tone }, icon(o.icon)),
      h('span', { class: 'ov-text' }, h('strong', null, o.title), h('span', { class: 'ov-sub' }, o.sub), below || null),
      side || null, icon('chevron-right', 'ov-go'));
  }

  function workspaceRow(ws, i) {
    const o = { id: ws.id, href: ws.href, icon: ws.icon, tone: ws.tone, title: t('ws.' + ws.id), sub: t('ws.' + ws.id + '.sub') };
    const b = Store.stats(Store.current(), ws.tabs).total, r = ring({ size: 58, stroke: 6, fontSize: 13 }), of = ' / ' + I18n.num(b.max);
    const stat = (ic, label, v) => h('span', { class: 'ov-stat' }, icon(ic), h('span', null, label), h('b', null, I18n.num(v)), h('span', null, of));
    r.set(0, true);
    setTimeout(() => r.set(b.pct), 60);                        // the ring fills once the page is on screen
    return rowLink(i, o, h('span', { class: 'ov-stats' }, stat('trophy', t('header.score'), b.score), stat('target', t('header.mark'), b.mark)), r.el);
  }

  function home() {
    return h('div', { class: 'ov' },
      h('section', { class: 'ov-hero' }, UI.logo(false), who(Store.current())),
      h('h1', { class: 'sr-only' }, t('ov.title')),
      h('nav', { class: 'ov-list', 'aria-label': t('ov.title') },
        WORKSPACES.map(workspaceRow),
        rowLink(2, { id: 'account', href: '#/account', icon: 'user-cog', tone: 'orange', title: t('ov.account'), sub: t('ov.account.sub') }),
        rowLink(3, { id: 'settings', href: '#/settings', icon: 'settings', tone: 'grey', title: t('settings.title'), sub: t('ov.settings.sub') })));
  }

  // ------------------------------------------------------------------ pages behind the buttons
  function page(title, ...body) {
    return h('div', { class: 'ov' },
      h('div', { class: 'ov-head' },
        h('a', { class: 'btn ghost sm', href: '#/overview' }, icon('arrow-left'), h('span', null, t('ov.title'))), h('h1', null, title)),
      body);
  }

  // act = the account actions of app.js
  function account(act) {
    const item = (ic, label, fn, danger) => h('button', { class: 'ov-item' + (danger ? ' danger' : ''), type: 'button', onclick: fn },
      icon(ic), h('span', null, label), icon('chevron-right', 'ov-go'));
    const group = (i, title, ...items) => h('section', { class: 'card ov-group', style: delay(i) }, h('h3', { class: 'card-title' }, title), items);
    return page(t('ov.account'), who(Store.current(), 'card'),
      group(1, t('ov.g.account'), item('users', t('menu.switch'), act.switchAccount), item('user-plus', t('menu.add'), act.add),
        item('key-round', t('menu.password'), act.password)),
      group(2, t('ov.g.files'), item('save', t('menu.save'), act.save),
        window.ESP32TOUR_SINGLE ? item('copy', t('menu.appcopy'), act.appCopy) : null,
        item('download', t('menu.export'), () => { Store.exportDownload(); toast(t('export.done')); }),
        item('upload', t('menu.import'), act.importFile)),
      group(3, t('ov.g.session'), item('log-out', t('menu.signout'), act.signOut), item('trash-2', t('menu.delete'), act.del, true)));
  }

  function settings(act) {
    const a = Store.current();
    // pick() redraws the page, so the focus is put back on the chosen button
    const seg = (name, label, values, cur, pick, face) => h('div', { class: 'seg wide', role: 'group', 'aria-label': label }, values.map((v) => h('button', {
      type: 'button', class: 'seg-btn' + (cur === v ? ' on' : ''), 'aria-pressed': String(cur === v), 'data-key': name + ':' + v,
      onclick: () => { pick(v); const b = document.querySelector('[data-key="' + name + ':' + v + '"]'); if (b) b.focus({ preventScroll: true }); }
    }, face(v))));
    return page(t('settings.title'), h('section', { class: 'card settings ov-settings' },
      h('div', { class: 'set-row' }, h('h3', null, t('settings.theme')),
        seg('theme', t('settings.theme'), ['auto', 'light', 'dark'], a.theme, act.setTheme,
          (v) => [icon(v === 'auto' ? 'monitor' : v === 'light' ? 'sun' : 'moon'), t('settings.theme.' + v)])),
      h('div', { class: 'set-row' }, h('h3', null, t('settings.language')),
        seg('lang', t('settings.language'), ['en', 'fr'], I18n.lang, act.setLang, (l) => [icon('languages'), l === 'en' ? 'English' : 'Français']),
        h('p', { class: 'note' }, t('settings.language.hint'))),
      window.DocStore && DocStore.supported ? docsRow() : null));
  }

  // phones: are the reference documents stored on this device?
  function docsRow() {
    const total = window.ESP32TOUR_COURSE.store.length;
    const state = h('p', { class: 'note' }, '…');
    const btn = UI.button(t('settings.docs.btn'), { kind: 'ghost', icon: 'download', onclick: async () => {
      btn.setBusy(true);
      try { await DocStore.store(draw); } catch (e) { toast(t('settings.docs.err'), 'error'); }
      btn.setBusy(false); check();
    } });
    function draw(missing) {
      state.textContent = missing ? t('settings.docs.part', { a: total - missing, b: total }) : t('settings.docs.all');
      btn.style.display = missing ? '' : 'none';
    }
    const check = () => DocStore.missing().then((m) => draw(m.length));
    check();
    return h('div', { class: 'set-row' }, h('h3', null, t('settings.docs', { mb: I18n.num(Math.round(window.ESP32TOUR_COURSE.storeBytes / 1e5) / 10) })), state, btn);
  }

  const PAGES = { overview: home, account, settings };
  const TITLES = { overview: 'ov.title', account: 'ov.account', settings: 'settings.title' };

  window.Overview = {
    WORKSPACES,
    workspaceOf: (route) => WORKSPACES.find((ws) => ws.dash === route || ws.tabs.includes(route)) || null,
    has: (id) => Object.prototype.hasOwnProperty.call(PAGES, id),
    title: (id) => t(TITLES[id]),
    mount: (id, act) => PAGES[id](act)
  };
})();
