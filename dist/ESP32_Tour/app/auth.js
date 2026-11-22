/* auth.js - sign in, sign up (create account), forgot password, recovery code, new-ID screens. */
(function () {
  'use strict';
  const { h, icon, field, button, logo, langSwitch, toast } = UI;
  const root = () => document.getElementById('root');

  let current = null;            // {mode, opts} so a language change can redraw the same screen

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back */ }
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = text;
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  UI.copyText = copyText;

  function frame(card, opts) {
    const bullets = ['auth.b1', 'auth.b2', 'auth.b3'].map((k) => h('li', null, icon('check'), h('span', null, t(k))));
    const brand = h('aside', { class: 'auth-brand' },
      logo(false),
      h('h1', null, t('auth.tagline')),
      h('ul', { class: 'auth-points' }, bullets),
      h('div', { class: 'auth-chip-art', 'aria-hidden': 'true' }, icon('cpu')));
    const lang = langSwitch((l) => { I18n.set(l); Auth.show(current.mode, current.opts); });
    const main = h('main', { class: 'auth-main' },
      h('div', { class: 'auth-top' }, opts && opts.adding ? null : h('span'), lang),
      card,
      h('p', { class: 'auth-foot' }, t('footer.version', { v: Store.VERSION })));
    return h('div', { class: 'auth' }, brand, main);
  }

  function banner() {
    const parts = [];
    if (!Store.storageOk) parts.push(h('div', { class: 'notice warn' }, icon('circle-alert'), h('span', null, t('auth.nostorage'))));
    if (Store.foundFromFile) parts.push(h('div', { class: 'notice ok' }, icon('shield-check'), h('span', null, t('auth.found'))));
    return parts;
  }

  function importLink(opts) {
    const input = h('input', { type: 'file', accept: '.js,.json,.txt', class: 'sr-only', tabindex: '-1' });
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        const r = Store.importText(await f.text());
        toast(t('auth.imported', { n: r.added, m: r.merged }));
        Auth.show(Store.hasAccounts() ? 'signin' : 'signup', opts);
      } catch (e) { toast(t('auth.import.bad'), 'error'); }
      input.value = '';
    });
    return h('div', null, input,
      h('button', { class: 'link-btn', type: 'button', onclick: () => input.click() }, icon('upload'), h('span', null, t('auth.import'))));
  }

  // ------------------------------------------------------------------ sign in
  function signin(opts) {
    const fId = field({ label: t('field.id'), name: 'id', autocomplete: 'username', maxlength: 24 });
    const fPw = field({ label: t('field.password'), name: 'password', type: 'password', autocomplete: 'current-password', maxlength: 128 });
    const keep = h('input', { type: 'checkbox', id: 'keep' });
    const err = h('div', { class: 'form-err', role: 'alert' });
    const btn = button(t('auth.signin.btn'), { type: 'submit', icon: 'log-in', block: true });
    const form = h('form', { class: 'auth-form', novalidate: true }, fId.el, fPw.el,
      h('div', { class: 'row-between' },
        h('label', { class: 'check', for: 'keep' }, keep, h('span', null, t('auth.keep'))),
        h('button', { class: 'link-btn', type: 'button', onclick: () => Auth.show('forgot', opts) }, t('auth.forgot'))),
      err, btn);

    const chips = Store.accounts().map((a) => h('button', {
      type: 'button', class: 'acct-chip', onclick: () => { fId.input.value = a.id; fPw.input.focus(); }
    }, h('span', { class: 'avatar' }, (a.first[0] || a.id[0]).toUpperCase()),
    h('span', { class: 'acct-chip-text' }, h('strong', null, a.first), h('small', null, a.id))));

    form.addEventListener('submit', async (e) => {
      e.preventDefault(); fId.clear(); fPw.clear(); err.textContent = '';
      if (!fId.value.trim()) return fId.error('err.required');
      if (!fPw.value) return fPw.error('err.required');
      btn.setBusy(true);
      try {
        const r = await Store.signIn(fId.value, fPw.value);
        if (!r.ok) { err.textContent = t(r.err, r.vars); return; }
        if (r.account.needsNewId) return Auth.show('newid', { ...opts, account: r.account, keep: keep.checked });
        Store.startSession(r.account.uid, keep.checked);
        opts.onDone();
      } catch (ex) { err.textContent = t('err.generic'); console.error(ex); }
      finally { btn.setBusy(false); }
    });

    const card = h('section', { class: 'auth-card' },
      h('h2', null, t('auth.signin.title')), h('p', { class: 'sub' }, t('auth.signin.sub')),
      banner(), chips.length ? h('div', { class: 'acct-chips', 'aria-label': t('auth.device') }, chips) : null,
      form,
      h('p', { class: 'switch-line' }, t('auth.new') + ' ',
        h('button', { class: 'link-btn', type: 'button', onclick: () => Auth.show('signup', opts) }, t('auth.create'))),
      importLink(opts),
      opts.adding ? h('button', { class: 'link-btn muted', type: 'button', onclick: opts.onCancel }, t('common.cancel')) : null);
    return frame(card, opts);
  }

  // ------------------------------------------------------------------ sign up
  function signup(opts) {
    const fId = field({ label: t('field.id'), name: 'id', autocomplete: 'username', maxlength: 24, hint: t('hint.id') });
    const fFirst = field({ label: t('field.first'), name: 'first', autocomplete: 'given-name', maxlength: 60 });
    const fLast = field({ label: t('field.last'), name: 'last', autocomplete: 'family-name', maxlength: 60 });
    const fPw = field({ label: t('field.password'), name: 'password', type: 'password', autocomplete: 'new-password', maxlength: 128, hint: t('hint.password', { n: Store.PW_MIN }) });
    const fPw2 = field({ label: t('field.confirm'), name: 'confirm', type: 'password', autocomplete: 'new-password', maxlength: 128 });
    const err = h('div', { class: 'form-err', role: 'alert' });
    const btn = button(t('auth.signup.btn'), { type: 'submit', icon: 'user-plus', block: true });
    const form = h('form', { class: 'auth-form', novalidate: true },
      fId.el, h('div', { class: 'two' }, fFirst.el, fLast.el), fPw.el, fPw2.el, err, btn);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      [fId, fFirst, fLast, fPw, fPw2].forEach((f) => f.clear()); err.textContent = '';
      let bad = null;
      const fail = (f, key, vars) => { if (!bad) { f.error(key, vars); bad = f; } else f.error(key, vars); };
      const idErr = Store.validateId(fId.value);
      if (idErr) fail(fId, idErr); else if (Store.idTaken(fId.value)) fail(fId, 'err.id.taken');
      if (!fFirst.value.trim()) fail(fFirst, 'err.required');
      if (!fLast.value.trim()) fail(fLast, 'err.required');
      if (fPw.value.length < Store.PW_MIN) fail(fPw, 'err.pw.short', { n: Store.PW_MIN });
      else if (fPw.value !== fPw2.value) fail(fPw2, 'err.pw.mismatch');
      if (bad) { bad.input.focus(); return; }
      btn.setBusy(true);
      try {
        if (await Store.passwordInUse(fPw.value)) { fPw.error('err.pw.used'); fPw.input.focus(); return; }
        const r = await Store.createAccount({ id: fId.value, first: fFirst.value, last: fLast.value, password: fPw.value, lang: I18n.lang });
        Auth.show('recovery', { ...opts, account: r.account, code: r.recovery, afterCreate: true });
      } catch (ex) { err.textContent = t('err.generic'); console.error(ex); }
      finally { btn.setBusy(false); }
    });

    const card = h('section', { class: 'auth-card wide' },
      h('h2', null, t('auth.signup.title')),
      h('p', { class: 'sub' }, opts.adding ? t('auth.adding') : t('auth.signup.sub')),
      banner(), form,
      Store.hasAccounts() ? h('p', { class: 'switch-line' }, t('auth.have') + ' ',
        h('button', { class: 'link-btn', type: 'button', onclick: () => Auth.show('signin', opts) }, t('auth.signin.link'))) : null,
      importLink(opts),
      opts.adding ? h('button', { class: 'link-btn muted', type: 'button', onclick: opts.onCancel }, t('common.cancel')) : null);
    return frame(card, opts);
  }

  // ------------------------------------------------------------------ recovery code (after sign up or reset)
  function recovery(opts) {
    const saved = h('input', { type: 'checkbox', id: 'saved' });
    const go = button(t('common.continue'), { icon: 'check', block: true });
    go.disabled = true;
    saved.addEventListener('change', () => { go.disabled = !saved.checked; });
    go.addEventListener('click', () => {
      if (opts.afterCreate) { Store.startSession(opts.account.uid, false); opts.onDone(); }
      else Auth.show('signin', opts);
    });
    const copy = h('button', { class: 'btn ghost', type: 'button' }, icon('copy'), h('span', null, t('common.copy')));
    copy.addEventListener('click', async () => {
      if (await copyText(opts.code)) { copy.lastChild.textContent = t('common.copied'); setTimeout(() => { copy.lastChild.textContent = t('common.copy'); }, 1600); }
    });
    const card = h('section', { class: 'auth-card' },
      h('div', { class: 'big-icon ok' }, icon('shield-check')),
      h('h2', null, t('auth.recovery.title')),
      h('p', { class: 'sub' }, opts.afterCreate ? t('auth.recovery.text') : t('auth.reset.done') + ' ' + t('auth.recovery.text')),
      h('div', { class: 'code-box', 'aria-label': t('field.recovery') }, opts.code), copy,
      h('label', { class: 'check', for: 'saved' }, saved, h('span', null, t('auth.recovery.saved'))),
      go);
    return frame(card, opts);
  }

  // ------------------------------------------------------------------ forgot password
  function forgot(opts) {
    const fId = field({ label: t('field.id'), name: 'id', autocomplete: 'username', maxlength: 24 });
    const fCode = field({ label: t('field.recovery'), name: 'code', maxlength: 24, placeholder: 'XXXX-XXXX-XXXX-XXXX' });
    const fPw = field({ label: t('field.newpass'), name: 'password', type: 'password', autocomplete: 'new-password', maxlength: 128, hint: t('hint.password', { n: Store.PW_MIN }) });
    const fPw2 = field({ label: t('field.confirm'), name: 'confirm', type: 'password', autocomplete: 'new-password', maxlength: 128 });
    const err = h('div', { class: 'form-err', role: 'alert' });
    const btn = button(t('auth.forgot.btn'), { type: 'submit', icon: 'key-round', block: true });
    const form = h('form', { class: 'auth-form', novalidate: true }, fId.el, fCode.el, fPw.el, fPw2.el, err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); [fId, fCode, fPw, fPw2].forEach((f) => f.clear()); err.textContent = '';
      if (!fId.value.trim()) return fId.error('err.required');
      if (!fCode.value.trim()) return fCode.error('err.required');
      if (fPw.value.length < Store.PW_MIN) return fPw.error('err.pw.short', { n: Store.PW_MIN });
      if (fPw.value !== fPw2.value) return fPw2.error('err.pw.mismatch');
      btn.setBusy(true);
      try {
        const r = await Store.resetWithRecovery(fId.value, fCode.value, fPw.value);
        if (!r.ok) { if (r.err === 'err.pw.used') fPw.error(r.err); else err.textContent = t(r.err, r.vars); return; }
        Auth.show('recovery', { ...opts, account: r.account, code: r.recovery, afterCreate: false });
      } catch (ex) { err.textContent = t('err.generic'); console.error(ex); }
      finally { btn.setBusy(false); }
    });
    const card = h('section', { class: 'auth-card' },
      h('h2', null, t('auth.forgot.title')), h('p', { class: 'sub' }, t('auth.forgot.sub')), form,
      h('button', { class: 'link-btn', type: 'button', onclick: () => Auth.show('signin', opts) }, icon('log-in'), h('span', null, t('auth.signin.link'))));
    return frame(card, opts);
  }

  // ------------------------------------------------------------------ choose a new ID (copied account clashed)
  function newid(opts) {
    const fId = field({ label: t('field.id'), name: 'id', maxlength: 24, hint: t('hint.id') });
    const btn = button(t('common.continue'), { type: 'submit', block: true });
    const form = h('form', { class: 'auth-form', novalidate: true }, fId.el, btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault(); fId.clear();
      const r = Store.changeId(opts.account.uid, fId.value);
      if (!r.ok) return fId.error(r.err);
      Store.startSession(opts.account.uid, !!opts.keep); opts.onDone();
    });
    const card = h('section', { class: 'auth-card' },
      h('h2', null, t('auth.newid.title')), h('p', { class: 'sub' }, t('auth.newid.text', { id: opts.account.id })), form);
    return frame(card, opts);
  }

  const SCREENS = { signin, signup, recovery, forgot, newid };

  const Auth = {
    show(mode, opts) {
      const o = opts || {};
      if ((mode === 'signin') && !Store.hasAccounts()) mode = 'signup';
      current = { mode, opts: o };
      document.title = t('app.short') + ' · ' + t(mode === 'signup' ? 'auth.signup.title' : 'auth.signin.title');
      const page = SCREENS[mode](o);
      root().replaceChildren(page);
      const first = page.querySelector('input:not([type=file]):not([type=checkbox])');
      if (first) first.focus({ preventScroll: true });
    }
  };
  window.Auth = Auth;
})();
