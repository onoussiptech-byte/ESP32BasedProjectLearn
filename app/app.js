/* app.js - shell: workspace header (logo, workspace switch, tabs, progress ring, Score, Total mark), routing, account dialogs. */
(function () {
  'use strict';
  const { h, icon, ring, counter, field, button, modal, toast, floatDelta } = UI;
  const root = () => document.getElementById('root');
  const fmt = (n) => I18n.num(n);

  const TAB_ICONS = { t1: 'book-open', t2: 'workflow', t3: 'boxes', t4: 'blocks' };
  let shell = null;               // {el, header, main, ws, route, dash, lessons}

  // ------------------------------------------------------------------ theme
  function applyTheme() {
    const a = Store.current(), th = a ? a.theme : 'auto';
    if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th);
    else document.documentElement.removeAttribute('data-theme');
  }

  // ------------------------------------------------------------------ routing
  function routeId() {
    const m = (location.hash || '').match(/^#\/(overview|account|settings|dashboard|aquaponics|t[1-4])\b/);
    return m ? m[1] : 'overview';                             // the Overview is the home page
  }
  function tabTitle(id) { return Overview.has(id) ? Overview.title(id) : Overview.workspaceOf(id).dash === id ? t('tab.dashboard') : I18n.pick(Course.tab(id).title); }

  // ------------------------------------------------------------------ header (one per workspace)
  // the app icon shows the same page again, fresh
  function refreshPage() {
    const again = () => { if (shell.lessons) { shell.lessons.destroy(); shell.lessons = null; } showRoute(); window.scrollTo(0, 0); };
    if (!document.querySelector('.q-segs .ok, .q-segs .bad') || document.querySelector('.res-hero')) return again();
    const m = modal({ title: t('quiz.exit.title'), body: h('div', { class: 'confirm' }, h('p', { class: 'sub' }, t('quiz.exit.text')),
      h('div', { class: 'actions' }, button(t('quiz.exit.stay'), { kind: 'ghost', onclick: () => m.close() }),
        button(t('quiz.exit.leave'), { kind: 'danger', icon: 'log-out', onclick: () => { m.close(); again(); } }))) });
  }

  function buildHeader(ws) {
    const hi = h('button', { class: 'name-chip ws-chip', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': t('ws.switch') },
      icon('arrow-left-right', 'ws-ic'), h('span', { class: 'hi' }, t('ws.switch')), icon('chevron-down'));
    hi.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(hi); });

    const r = ring({ size: 46, stroke: 5, fontSize: 11 });
    const scoreVal = h('b'), markVal = h('b');
    const sc = counter(scoreVal), mk = counter(markVal);
    const scoreBox = h('div', { class: 'metric num-anchor', title: t('dash.score.sub') }, h('span', { class: 'metric-label' }, icon('trophy'), t('header.score')), scoreVal);
    const markBox = h('div', { class: 'metric num-anchor', title: t('dash.mark.sub') }, h('span', { class: 'metric-label' }, icon('target'), t('header.mark')), markVal);
    const progBox = h('div', { class: 'metric prog', title: t('dash.progress.sub') }, r.el, h('span', { class: 'metric-label vert' }, t('header.progress')));

    const tabs = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': t('ws.' + ws.id) },
      [ws.dash, ...ws.tabs].map((id) => h('a', { class: 'tab', role: 'tab', href: '#/' + id, 'data-tab': id },
        icon(TAB_ICONS[id] || 'layout-dashboard'), h('span', null, tabTitle(id)))));

    const el = h('header', { class: 'topbar' },
      h('div', { class: 'top-row' }, h('button', { class: 'brand-btn', type: 'button', title: t('header.refresh'), 'aria-label': t('header.refresh'), onclick: refreshPage }, UI.logo(true)), h('div', { class: 'menu-wrap' }, hi), h('span', { class: 'grow' }), h('div', { class: 'metrics' }, progBox, scoreBox, markBox)),
      tabs);

    let first = true;
    return {
      el, hi,
      update() {
        const tot = Store.stats(Store.current(), ws.tabs).total;
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

  // ------------------------------------------------------------------ workspace switch (the account stays the same)
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
    const item = (ic, label, href, current) => h('a', { class: 'menu-item' + (current ? ' on' : ''), role: 'menuitem', href, 'aria-current': current ? 'true' : null },
      icon(ic), h('span', null, label), current ? icon('check', 'menu-check') : null);
    const el = h('div', { class: 'menu', role: 'menu', 'aria-label': t('ws.switch') },
      Overview.WORKSPACES.map((ws) => item(ws.icon, t('ws.' + ws.id), ws.href, ws === shell.ws)),
      h('div', { class: 'menu-sep' }),
      item('house', t('ov.title'), '#/overview'));
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
  function authOpts() { return { onDone: goHome }; }

  function addAccount() { Auth.show('signup', { adding: true, onDone: goHome, onCancel: enter }); }

  // what the Account management and Settings pages can do
  const ACTIONS = {
    switchAccount: openSwitch, add: addAccount, password: openChangePassword, save: openSaveToFolder, appCopy: downloadAppCopy,
    importFile, signOut, del: openDelete,
    setTheme(v) { Store.setPrefs(Store.current().uid, { theme: v }); showRoute(); },
    setLang(l) { Store.setPrefs(Store.current().uid, { lang: l }); I18n.set(l); render(); }
  };

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
          else { m.close(); Store.startSession(a.uid, false); goHome(); }
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
    const fNew = field({ label: t('field.newpass'), name: 'new', type: 'password', autocomplete: 'new-password', maxlength: 128, hint: t('hint.password', { n: Store.PW_MIN }) });
    const fNew2 = field({ label: t('field.confirm'), name: 'new2', type: 'password', autocomplete: 'new-password', maxlength: 128 });
    const err = h('div', { class: 'form-err', role: 'alert' });
    const go = button(t('common.save'), { type: 'submit', icon: 'check' });
    const form = h('form', { class: 'auth-form', novalidate: true }, fOld.el, fNew.el, fNew2.el, err,
      h('div', { class: 'actions' }, button(t('common.cancel'), { kind: 'ghost', onclick: () => m.close() }), go));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); [fOld, fNew, fNew2].forEach((f) => f.clear()); err.textContent = '';
      if (!fOld.value) return fOld.error('err.required');
      if (fNew.value.length < Store.PW_MIN) return fNew.error('err.pw.short', { n: Store.PW_MIN });
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
      try { const r = Store.importText(await f.text()); toast(t('auth.imported', { n: r.added, m: r.merged })); goHome(); }
      catch (e) { toast(t('auth.import.bad'), 'error'); }
      input.remove();
    });
    document.body.appendChild(input); input.click();
  }

  // ------------------------------------------------------------------ views
  function placeholder(id) {
    return h('section', { class: 'placeholder' },
      h('div', { class: 'big-icon' }, icon(TAB_ICONS[id])),
      h('h1', null, t('ph.title')), h('p', null, t('ph.text', { title: tabTitle(id) })),
      h('a', { class: 'btn primary', href: shell.ws.href }, icon('layout-dashboard'), h('span', null, t('ph.back'))));
  }

  function showRoute() {
    if (!shell) return;
    const id = routeId();
    const ws = Overview.workspaceOf(id);
    shell.route = id;
    if (ws && ws !== shell.ws) {                               // another workspace: its own tabs, progress, Score and Total mark
      const old = shell.header;
      shell.ws = ws; shell.header = buildHeader(ws);
      old.el.replaceWith(shell.header.el); shell.header.update();
    }
    shell.header.setActive(id);
    document.title = tabTitle(id) + ' · ' + t('app.short');
    if (shell.lessons && shell.lessons.tab !== id) { shell.lessons.destroy(); shell.lessons = null; }
    closeMenu();
    shell.el.classList.toggle('bare', Overview.has(id));       // the Overview pages have no workspace header
    if (Overview.has(id)) { shell.dash = null; shell.main.replaceChildren(Overview.mount(id, ACTIONS)); }
    else if (id === ws.dash) {
      shell.dash = Dashboard.mount(ws);
      shell.main.replaceChildren(shell.dash.el); shell.dash.update();
    } else if (Lessons.TABS.includes(id)) {
      shell.dash = null;
      if (!shell.lessons) { shell.lessons = Lessons.mount(id); shell.main.replaceChildren(shell.lessons.el); }
      else shell.lessons.go(location.hash);                  // the lessons view keeps its own scroll and navigation state
      return;
    } else { shell.dash = null; shell.main.replaceChildren(placeholder(id)); }
    window.scrollTo(0, 0);
  }

  function refresh() {
    if (!shell || !Store.current()) return;
    shell.header.update();
    if (shell.dash) shell.dash.update();
    if (shell.lessons) shell.lessons.update();
  }

  // Build the whole signed-in screen
  function render() {
    closeMenu();
    const ws = Overview.workspaceOf(routeId()) || Overview.WORKSPACES[0], header = buildHeader(ws);
    const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
    const el = h('div', { class: 'app' }, header.el, main,
      h('footer', { class: 'foot' }, t('footer.version', { v: Store.VERSION }),
        Store.versionNote ? ' · ' + t('update.note', { v: Store.versionNote }) : ''));
    shell = { el, header, main, ws, route: null, dash: null, lessons: null };
    root().replaceChildren(el);
    header.update(); showRoute();
  }

  function enter() { applyTheme(); render(); }
  // after sign in, sign up, account switch and import: open the Overview
  function goHome() {
    try { history.replaceState(null, '', '#/overview'); } catch (e) { location.hash = '#/overview'; }
    enter();
  }

  const App = {
    boot() {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';   // the lessons view positions the page itself
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
    // Called by the quiz engine after Store.recordAttempt(): floats "+n" / "▼n" over Score and Total mark
    appCopyHtml,
    showDeltas(res) { if (shell) { shell.header.deltas(res); if (shell.dash) shell.dash.floatDeltas(res); } }
  };
  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.boot());
})();
