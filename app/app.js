/* app.js - shell: header (logo, name, tabs, progress ring, Score, Total mark), routing, account menu, dialogs. */
(function () {
  'use strict';
  const { h, icon, ring, counter, field, button, modal, toast, floatDelta, langSwitch } = UI;
  const root = () => document.getElementById('root');
  const fmt = (n) => I18n.num(n);

  const TABS = [{ id: 'dashboard', icon: 'layout-dashboard' }, { id: 't1', icon: 'book-open' }, { id: 't2', icon: 'workflow' }];
  let shell = null;               // {header, main, view, route, dash}

  // ------------------------------------------------------------------ theme
  function applyTheme() {
    const a = Store.current(), th = a ? a.theme : 'auto';
    if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th);
    else document.documentElement.removeAttribute('data-theme');
  }

  // ------------------------------------------------------------------ routing
  function routeId() {
    const m = (location.hash || '').match(/^#\/(dashboard|t1|t2)\b/);
    return m ? m[1] : 'dashboard';
  }
  function tabTitle(id) { return id === 'dashboard' ? t('tab.dashboard') : I18n.pick(Course.tab(id).title); }

  // ------------------------------------------------------------------ header
  function buildHeader() {
    const a = Store.current();
    const hi = h('button', { class: 'name-chip', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': t('header.menu') },
      h('span', { class: 'avatar' }, (a.first.trim()[0] || a.id[0]).toUpperCase()),
      h('span', { class: 'hi' }, t('header.hi', { name: a.first })), icon('chevron-down'));
    hi.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(hi); });

    const r = ring({ size: 46, stroke: 5, fontSize: 11 });
    const scoreVal = h('b'), markVal = h('b');
    const sc = counter(scoreVal), mk = counter(markVal);
    const scoreBox = h('div', { class: 'metric num-anchor', title: t('dash.score.sub') }, h('span', { class: 'metric-label' }, icon('trophy'), t('header.score')), scoreVal);
    const markBox = h('div', { class: 'metric num-anchor', title: t('dash.mark.sub') }, h('span', { class: 'metric-label' }, icon('target'), t('header.mark')), markVal);
    const progBox = h('div', { class: 'metric prog', title: t('dash.progress.sub') }, r.el, h('span', { class: 'metric-label vert' }, t('header.progress')));

    const tabs = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': t('app.short') },
      TABS.map((tb) => h('a', { class: 'tab', role: 'tab', href: '#/' + tb.id, 'data-tab': tb.id }, icon(tb.icon), h('span', null, tabTitle(tb.id)))));

    const el = h('header', { class: 'topbar' },
      h('div', { class: 'top-row' }, UI.logo(true), h('div', { class: 'menu-wrap' }, hi), h('span', { class: 'grow' }), h('div', { class: 'metrics' }, progBox, scoreBox, markBox)),
      tabs);

    let first = true;
    return {
      el, hi,
      update() {
        const s = Store.stats(Store.current()), tot = s.total;
        r.set(tot.pct, first); sc.set(tot.score, first); mk.set(tot.mark, first); first = false;
        markBox.title = t('dash.mark.sub') + ' — ' + (tot.max ? Math.round((tot.mark / tot.max) * 1000) / 10 : 0) + ' %';
      },
      setActive(id) {
        tabs.querySelectorAll('.tab').forEach((x) => {
          const on = x.dataset.tab === id; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on));
          if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
        });
      },
      deltas(res) {
        if (!res) return;
        if (res.scoreDelta) floatDelta(scoreBox, '+' + res.scoreDelta, true);
        if (res.markDelta) floatDelta(markBox, (res.markDelta > 0 ? '+' : '▼') + Math.abs(res.markDelta), res.markDelta > 0);
      }
    };
  }

  // ------------------------------------------------------------------ account menu
  let openMenu = null;
  function closeMenu() {
    if (!openMenu) return;
    openMenu.el.remove(); openMenu.anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', closeMenu); document.removeEventListener('keydown', menuKey, true);
    openMenu = null;
  }
  function menuKey(e) { if (e.key === 'Escape') { e.stopPropagation(); const a = openMenu && openMenu.anchor; closeMenu(); if (a) a.focus(); } }

  function toggleMenu(anchor) {
    if (openMenu) return closeMenu();
    const item = (ic, label, fn, danger) => h('button', { class: 'menu-item' + (danger ? ' danger' : ''), role: 'menuitem', type: 'button',
      onclick: () => { closeMenu(); fn(); } }, icon(ic), h('span', null, label));
    const a = Store.current();
    const el = h('div', { class: 'menu', role: 'menu' },
      h('div', { class: 'menu-head' }, h('b', null, a.first + ' ' + a.last), h('small', null, a.id)),
      item('settings', t('menu.settings'), openSettings),
      item('users', t('menu.switch'), openSwitch),
      item('user-plus', t('menu.add'), addAccount),
      item('key-round', t('menu.password'), openChangePassword),
      h('div', { class: 'menu-sep' }),
      item('save', t('menu.save'), openSaveToFolder),
      window.ESP32TOUR_SINGLE ? item('copy', t('menu.appcopy'), downloadAppCopy) : null,
      item('download', t('menu.export'), () => { Store.exportDownload(); toast(t('export.done')); }),
      item('upload', t('menu.import'), importFile),
      h('div', { class: 'menu-sep' }),
      item('log-out', t('menu.signout'), signOut),
      item('trash-2', t('menu.delete'), openDelete, true));
    anchor.parentNode.appendChild(el);
    anchor.setAttribute('aria-expanded', 'true');
    openMenu = { el, anchor };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
    document.addEventListener('keydown', menuKey, true);
    const f = el.querySelector('.menu-item'); if (f) f.focus();
  }

  // ------------------------------------------------------------------ single-file copy with the accounts inside
  // Rebuilds this very page (scripts + styles + fonts are inline) with the current accounts in #accounts-data.
  function appCopyHtml() {
    const c = document.documentElement.cloneNode(true);
    c.querySelector('#root').replaceChildren();
    c.querySelector('#toasts').replaceChildren();
    c.querySelectorAll('.modal-back, input[type=file]').forEach((n) => n.remove());
    c.removeAttribute('data-theme');
    c.querySelector('#accounts-data').textContent = Store.exportText();
    return '<!doctype html>\n' + c.outerHTML;
  }
  function downloadAppCopy() {
    const url = URL.createObjectURL(new Blob([appCopyHtml()], { type: 'text/html' }));
    const a = h('a', { href: url, download: 'ESP32_Tour_single.html' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(t('appcopy.done'));
  }

  // ------------------------------------------------------------------ dialogs
  function signOut() { Store.signOut(); Auth.show('signin', authOpts()); }
  function authOpts() { return { onDone: enter }; }

  function addAccount() { Auth.show('signup', { adding: true, onDone: enter, onCancel: enter }); }

  function openSettings() {
    const a = Store.current();
    const themeSeg = h('div', { class: 'seg wide', role: 'group' }, ['auto', 'light', 'dark'].map((v) => h('button', {
      type: 'button', class: 'seg-btn' + (a.theme === v ? ' on' : ''), 'aria-pressed': String(a.theme === v),
      onclick: () => { Store.setPrefs(a.uid, { theme: v }); m.close(); openSettings(); }
    }, icon(v === 'auto' ? 'monitor' : v === 'light' ? 'sun' : 'moon'), t('settings.theme.' + v))));
    const langs = h('div', { class: 'seg wide', role: 'group', 'aria-label': t('settings.language') }, ['en', 'fr'].map((l) => h('button', {
      type: 'button', class: 'seg-btn' + (I18n.lang === l ? ' on' : ''), 'aria-pressed': String(I18n.lang === l),
      onclick: () => { Store.setPrefs(a.uid, { lang: l }); I18n.set(l); m.close(); render(); openSettings(); }
    }, icon('languages'), l === 'en' ? 'English' : 'Français')));
    const m = modal({ title: t('settings.title'), body: h('div', { class: 'settings' },
      h('div', { class: 'set-row' }, h('h3', null, t('settings.language')), langs, h('p', { class: 'note' }, t('settings.language.hint'))),
      h('div', { class: 'set-row' }, h('h3', null, t('settings.theme')), themeSeg)) });
  }

  function openSwitch() {
    const cur = Store.current();
    const body = h('div', { class: 'switch' });
    const showList = () => {
      body.replaceChildren(h('p', { class: 'sub' }, t('switch.text')), h('div', { class: 'acct-list' }, Store.accounts().map((a) => h('button', {
        type: 'button', class: 'acct-row', disabled: a.uid === cur.uid, onclick: () => ask(a)
      }, h('span', { class: 'avatar' }, (a.first.trim()[0] || a.id[0]).toUpperCase()),
      h('span', { class: 'acct-chip-text' }, h('strong', null, a.first + ' ' + a.last), h('small', null, a.id)),
      a.uid === cur.uid ? h('span', { class: 'state-chip done' }, t('switch.current')) : null))));
    };
    const ask = (a) => {
      const f = field({ label: t('field.password'), name: 'password', type: 'password', autocomplete: 'off', maxlength: 128 });
      const err = h('div', { class: 'form-err', role: 'alert' });
      const go = button(t('auth.signin.btn'), { type: 'submit', icon: 'log-in' });
      const form = h('form', { class: 'auth-form', novalidate: true }, h('p', { class: 'sub' }, a.first + ' ' + a.last + ' · ' + a.id), f.el, err,
        h('div', { class: 'actions' }, button(t('common.back'), { kind: 'ghost', onclick: showList }), go));
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); f.clear(); err.textContent = '';
        if (!f.value) return f.error('err.required');
        go.setBusy(true);
        try {
          const ok = await Store.verifyAccount(a.uid, f.value);
          if (ok && ok.wait) err.textContent = t('err.wait', { s: ok.wait });
          else if (!ok) err.textContent = t('err.login');
          else { m.close(); Store.startSession(a.uid, false); enter(); }
        } finally { go.setBusy(false); }
      });
      body.replaceChildren(form); f.input.focus();
    };
    const m = modal({ title: t('switch.title'), body });
    showList();
  }

  function openChangePassword() {
    const a = Store.current();
    const fOld = field({ label: t('field.oldpass'), name: 'old', type: 'password', autocomplete: 'current-password', maxlength: 128 });
    const fNew = field({ label: t('field.newpass'), name: 'new', type: 'password', autocomplete: 'new-password', maxlength: 128, hint: t('hint.password') });
    const fNew2 = field({ label: t('field.confirm'), name: 'new2', type: 'password', autocomplete: 'new-password', maxlength: 128 });
    const err = h('div', { class: 'form-err', role: 'alert' });
    const go = button(t('common.save'), { type: 'submit', icon: 'check' });
    const form = h('form', { class: 'auth-form', novalidate: true }, fOld.el, fNew.el, fNew2.el, err,
      h('div', { class: 'actions' }, button(t('common.cancel'), { kind: 'ghost', onclick: () => m.close() }), go));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); [fOld, fNew, fNew2].forEach((f) => f.clear()); err.textContent = '';
      if (!fOld.value) return fOld.error('err.required');
      if (fNew.value.length < 6) return fNew.error('err.pw.short');
      if (fNew.value !== fNew2.value) return fNew2.error('err.pw.mismatch');
      go.setBusy(true);
      try {
        const r = await Store.changePassword(a.uid, fOld.value, fNew.value);
        if (!r.ok) { (r.err === 'err.pw.old' ? fOld : fNew).error(r.err); return; }
        m.close(); toast(t('pw.done'));
      } finally { go.setBusy(false); }
    });
    const m = modal({ title: t('pw.title'), body: form });
  }

  function openDelete() {
    const a = Store.current();
    const f = field({ label: t('field.password'), name: 'password', type: 'password', autocomplete: 'off', maxlength: 128 });
    const err = h('div', { class: 'form-err', role: 'alert' });
    const go = button(t('common.delete'), { type: 'submit', icon: 'trash-2', kind: 'danger' });
    const form = h('form', { class: 'auth-form', novalidate: true }, h('p', { class: 'sub' }, t('del.text')), f.el, err,
      h('div', { class: 'actions' }, button(t('common.cancel'), { kind: 'ghost', onclick: () => m.close() }), go));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); f.clear(); err.textContent = '';
      if (!f.value) return f.error('err.required');
      go.setBusy(true);
      try {
        const r = await Store.deleteAccount(a.uid, f.value);
        if (!r.ok) return f.error(r.err);
        m.close(); toast(t('del.done'));
        if (!Store.current()) Auth.show('signin', authOpts());
      } finally { go.setBusy(false); }
    });
    const m = modal({ title: t('del.title'), body: form });
  }

  function openSaveToFolder() {
    const status = h('p', { class: 'note ok-note' }, Store.folderLinked ? [icon('check'), h('span', null, t('save.linked'))] : '');
    const pick = button(t('save.pick'), { icon: 'folder-open', onclick: async () => {
      const r = await Store.saveToFolder();
      if (r === 'linked') { status.replaceChildren(icon('check'), h('span', null, t('save.linked'))); toast(t('save.done')); }
      else if (r === 'download') toast(t('save.unsupported'));
      else if (r === 'error') toast(t('err.generic'), 'error');
    } });
    const dl = button(t('save.download'), { kind: 'ghost', icon: 'download', onclick: () => { Store.downloadAccountsFile(); toast(t('export.done')); } });
    modal({ title: t('save.title'), body: h('div', { class: 'save' }, h('p', { class: 'sub' }, t('save.text')),
      h('div', { class: 'actions left' }, window.showDirectoryPicker ? pick : null, dl), status, h('p', { class: 'note' }, t('save.hint'))) });
  }

  function importFile() {
    const input = h('input', { type: 'file', accept: '.js,.json,.txt', class: 'sr-only' });
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0]; if (!f) return;
      try { const r = Store.importText(await f.text()); toast(t('auth.imported', { n: r.added, m: r.merged })); refresh(); }
      catch (e) { toast(t('auth.import.bad'), 'error'); }
      input.remove();
    });
    document.body.appendChild(input); input.click();
  }

  // ------------------------------------------------------------------ views
  function placeholder(id) {
    const title = tabTitle(id);
    return h('section', { class: 'placeholder' },
      h('div', { class: 'big-icon' }, icon(id === 't1' ? 'book-open' : 'workflow')),
      h('h1', null, t('ph.title')), h('p', null, t('ph.text', { title })),
      h('a', { class: 'btn primary', href: '#/dashboard' }, icon('layout-dashboard'), h('span', null, t('ph.back'))));
  }

  function showRoute() {
    if (!shell) return;
    const id = routeId();
    shell.route = id;
    shell.header.setActive(id);
    document.title = tabTitle(id) + ' · ' + t('app.short');
    if (id === 'dashboard') {
      shell.dash = Dashboard.mount({ onChangePassword: openChangePassword });
      shell.main.replaceChildren(shell.dash.el); shell.dash.update();
    } else { shell.dash = null; shell.main.replaceChildren(placeholder(id)); }
    window.scrollTo(0, 0);
  }

  function refresh() {
    if (!shell || !Store.current()) return;
    shell.header.update();
    if (shell.dash) shell.dash.update();
  }

  // Build the whole signed-in screen
  function render() {
    closeMenu();
    const header = buildHeader();
    const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
    shell = { header, main, route: null, dash: null };
    root().replaceChildren(h('div', { class: 'app' }, header.el, main,
      h('footer', { class: 'foot' }, t('footer.version', { v: Store.VERSION }),
        Store.versionNote ? ' · ' + t('update.note', { v: Store.versionNote }) : '')));
    header.update(); showRoute();
  }

  function enter() { applyTheme(); render(); }

  const App = {
    boot() {
      Store.init(); I18n.init();
      Store.on((what) => {
        if (what === 'results') refresh();
        if (what === 'prefs') applyTheme();
        if (what === 'accounts' && shell && Store.current()) refresh();
        if (what === 'session' && !Store.current()) { shell = null; applyTheme(); }
      });
      window.addEventListener('hashchange', () => { if (shell) showRoute(); });
      if (Store.current()) enter(); else Auth.show('signin', authOpts());
    },
    // Called by the quiz engine (later) after Store.recordAttempt(): floats "+n" / "▼n" over Score and Total mark
    appCopyHtml,
    showDeltas(res) { if (shell) { shell.header.deltas(res); if (shell.dash) shell.dash.floatDeltas(res); } }
  };
  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.boot());
})();
