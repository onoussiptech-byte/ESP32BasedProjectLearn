/* ui.js - small UI kit: DOM helper, icons, status icons, rings, counters, toasts, modals, fields.
 * User-provided text is always inserted as text nodes, never as HTML. */
(function () {
  'use strict';

  const ICONS = window.ESP32TOUR_ICONS || {};
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.keys(props || {}).forEach((k) => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;              // only used with built-in SVG strings
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  }

  function icon(name, cls) {
    const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    return h('span', { class: 'ic' + (cls ? ' ' + cls : ''), html: svg });
  }

  // ---------------------------------------------------------------- status icons
  const lastStatus = {};                       // key -> last shown status, to animate only changes
  const STATUS_SVG = {
    new: '<circle class="s-ring" cx="12" cy="12" r="9"/>',
    todo: '<circle class="s-ring" cx="12" cy="12" r="9"/><path class="s-half" d="M12 3a9 9 0 0 1 0 18z"/>',
    done: '<circle class="s-disc" cx="12" cy="12" r="10"/><path class="s-check" d="M7.5 12.5l3 3 6-6.5"/>',
    failed: '<circle class="s-disc" cx="12" cy="12" r="10"/><path class="s-cross" d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>'
  };

  function statusIcon(status, key, size) {
    const el = h('span', { class: 'st st-' + status, role: 'img', 'aria-label': t('status.' + status), title: t('status.' + status) });
    if (size) el.style.setProperty('--st-size', size + 'px');
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + STATUS_SVG[status] + '</svg>';
    if (key) {
      const prev = lastStatus[key];
      if (prev !== undefined && prev !== status && !reduced()) el.classList.add('anim');
      lastStatus[key] = status;
    }
    return el;
  }
  const statusLabel = (s) => t('status.' + s);

  // ---------------------------------------------------------------- counters and rings
  function fmt(n) { return I18n.num(n); }

  function counter(el, opts) {
    const o = opts || {};
    let cur = 0, raf = 0;
    const draw = (v) => { el.textContent = (o.format ? o.format(v) : fmt(Math.round(v))) + (o.suffix || ''); };
    draw(0);
    return {
      get value() { return cur; },
      set(to, instant) {
        cancelAnimationFrame(raf);
        const from = cur;
        if (instant || reduced() || from === to) { cur = to; draw(to); return; }
        const t0 = performance.now(), dur = 650;
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          cur = from + (to - from) * e; draw(cur);
          if (p < 1) raf = requestAnimationFrame(step); else { cur = to; draw(to); }
        };
        raf = requestAnimationFrame(step);
      },
      redraw() { draw(cur); }
    };
  }

  function ring(o) {
    const size = o.size || 96, stroke = o.stroke || 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const label = h('span', { class: 'ring-label' });
    if (o.fontSize) label.style.fontSize = o.fontSize + 'px';
    const el = h('div', { class: 'ring', style: { width: size + 'px', height: size + 'px' }, role: 'img' },
      h('span', { html: '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
        '<circle class="ring-track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '" fill="none"/>' +
        '<circle class="ring-val" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '" fill="none" ' +
        'stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>' }),
      label);
    if (o.color) el.style.setProperty('--ring-color', o.color);
    const val = el.querySelector('.ring-val');
    const cnt = counter(label, { suffix: o.noPercent ? '' : '%' });
    let pct = 0;
    return {
      el,
      get pct() { return pct; },
      set(p, instant) {
        pct = Math.max(0, Math.min(100, p));
        val.style.strokeDashoffset = String(c * (1 - pct / 100));
        cnt.set(Math.round(pct), instant);
        el.setAttribute('aria-label', t('header.progress') + ' ' + Math.round(pct) + '%');
      },
      redraw() { cnt.redraw(); }
    };
  }

  function floatDelta(anchor, text, up) {
    if (reduced()) return;
    const d = h('span', { class: 'delta ' + (up ? 'up' : 'down'), 'aria-hidden': 'true' }, text);
    anchor.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  // ---------------------------------------------------------------- toasts and modals
  // opts: {label, onClick, sticky} adds an action button (used for "Update available")
  function toast(msg, kind, opts) {
    const o = opts || {};
    const box = document.getElementById('toasts');
    const hide = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
    const el = h('div', { class: 'toast ' + (kind || 'info'), role: 'status' },
      icon(kind === 'error' ? 'circle-alert' : o.label ? 'sparkles' : 'check'), h('span', null, msg),
      o.label ? h('button', { class: 'toast-action', type: 'button', onclick: () => { hide(); if (o.onClick) o.onClick(); } }, o.label) : null,
      o.sticky ? h('button', { class: 'toast-x', type: 'button', 'aria-label': t('common.close'), onclick: hide }, icon('x')) : null);
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    if (!o.sticky) setTimeout(hide, 3600);
  }

  function modal(o) {
    const prevFocus = document.activeElement;
    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      back.classList.remove('in');
      setTimeout(() => back.remove(), 180);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (o.onClose) o.onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {                                    // keep focus inside the dialog
        const f = Array.from(card.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onclick: close }, icon('x'));
    const card = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
      h('div', { class: 'modal-head' }, h('h2', null, o.title), closeBtn),
      h('div', { class: 'modal-body' }, o.body));
    const back = h('div', { class: 'modal-back', onmousedown: (e) => { if (e.target === back) close(); } }, card);
    document.body.appendChild(back);
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      back.classList.add('in');
      const first = card.querySelector('input,select,button:not(.icon-btn)');
      if (first) first.focus();
    });
    return { close, el: card };
  }

  // ---------------------------------------------------------------- form fields
  function field(o) {
    const id = 'f-' + Math.random().toString(36).slice(2, 8);
    const input = h('input', {
      id, name: o.name, type: o.type || 'text', autocomplete: o.autocomplete || 'off',
      value: o.value || '', placeholder: o.placeholder || '', maxlength: o.maxlength || 64,
      autocapitalize: 'none', spellcheck: 'false', 'aria-describedby': id + '-m'
    });
    const msg = h('div', { class: 'field-msg', id: id + '-m' }, o.hint || '');
    const wrap = h('div', { class: 'field' });
    const lab = h('label', { for: id }, o.label);
    let control = input;
    if (o.type === 'password') {
      const eye = h('button', { class: 'eye', type: 'button', 'aria-label': t('common.show'), tabindex: '-1' }, icon('eye'));
      eye.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eye.replaceChildren(icon(show ? 'eye-off' : 'eye'));
        eye.setAttribute('aria-label', show ? t('common.hide') : t('common.show'));
      });
      control = h('div', { class: 'pw-wrap' }, input, eye);
    }
    wrap.append(lab, control, msg);
    const hint = o.hint || '';
    return {
      el: wrap, input,
      get value() { return input.value; },
      error(key, vars) {
        wrap.classList.add('invalid'); msg.textContent = key ? t(key, vars) : '';
        wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
      },
      clear() { wrap.classList.remove('invalid', 'shake'); msg.textContent = hint; }
    };
  }

  function button(label, o) {
    const x = o || {};
    const b = h('button', { type: x.type || 'button', class: 'btn ' + (x.kind || 'primary') + (x.block ? ' block' : ''), onclick: x.onclick },
      x.icon ? icon(x.icon) : null, h('span', null, label));
    b.setBusy = (on) => { b.disabled = on; b.classList.toggle('busy', on); };
    return b;
  }

  function langSwitch(onChange) {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': t('settings.language') });
    ['en', 'fr'].forEach((l) => {
      wrap.appendChild(h('button', {
        type: 'button', class: 'seg-btn' + (I18n.lang === l ? ' on' : ''), 'aria-pressed': String(I18n.lang === l),
        onclick: () => { if (I18n.lang !== l) onChange(l); }
      }, l === 'en' ? 'EN' : 'FR'));
    });
    return wrap;
  }

  function logo(small) {
    return h('div', { class: 'brand' + (small ? ' small' : '') },
      h('span', { class: 'brand-chip' }, icon('cpu')),
      h('span', { class: 'brand-text' },
        h('strong', null, t('app.short')),
        small ? null : h('small', null, I18n.pick(window.ESP32TOUR_COURSE.app.long_name))));
  }

  // ---------------------------------------------------------------- lesson text: inline markup and code blocks
  // Markup (always built as DOM nodes, never as HTML): **bold**  *italic*  `code`
  //   [[label|t1.l01.s01/p2#section]] concept chip   [label](https://...) link to an online resource
  const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[\[[^\]|]+\|[^\]]+\]\]|\[[^\]]+\]\(https:\/\/[^)\s]+\))/;
  function inline(text, o) {
    const opts = o || {}, out = [];
    String(text == null ? '' : text).split(INLINE_RE).forEach((part) => {
      if (!part) return;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) out.push(h('strong', null, inline(part.slice(2, -2), opts)));
      else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) out.push(h('code', { class: 'icode' }, part.slice(1, -1)));
      else if (part.startsWith('[[') && part.endsWith(']]')) {
        const i = part.indexOf('|'), label = part.slice(2, i), target = part.slice(i + 1, -2);
        out.push(opts.onChip
          ? h('button', { class: 'chip-link', type: 'button', 'data-target': target, onclick: () => opts.onChip(target, label) }, icon('link-2'), h('span', null, label))
          : h('span', { class: 'chip-link' }, label));
      } else if (part.startsWith('[') && part.includes('](https://')) {
        const i = part.indexOf(']('), label = part.slice(1, i), url = part.slice(i + 2, -1);
        out.push(h('a', { class: 'ext', href: url, target: '_blank', rel: 'noopener noreferrer' }, label, h('span', { class: 'online-tag' }, t('common.online'))));
      } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) out.push(h('em', null, inline(part.slice(1, -1), opts)));
      else out.push(part);
    });
    return out;
  }

  // A picture of figures/ (its size and bilingual description come from course.js; the single file carries it inside)
  function figure(name, cls) {
    const f = window.ESP32TOUR_COURSE.figures[name];
    return h('img', { class: cls || 'fig-img', src: (window.ESP32TOUR_FIGURES || {})[name] || 'figures/' + name + '.webp',
      alt: I18n.pick(f.alt), width: f.w, height: f.h, decoding: 'async' });
  }

  // Syntax-highlighted code (Prism builds escaped markup; unknown languages fall back to plain text)
  function codeBlock(lang, code, caption) {
    const el = h('code', { class: 'language-' + lang });
    const grammar = window.Prism && window.Prism.languages && window.Prism.languages[lang];
    if (grammar) el.innerHTML = window.Prism.highlight(code, grammar, lang); else el.textContent = code;
    const copy = h('button', { class: 'code-copy', type: 'button', 'aria-label': t('common.copy') }, icon('copy'), h('span', null, t('common.copy')));
    copy.addEventListener('click', async () => {
      const ok = UI.copyText ? await UI.copyText(code) : false;
      if (ok) { copy.lastChild.textContent = t('common.copied'); setTimeout(() => { copy.lastChild.textContent = t('common.copy'); }, 1600); }
    });
    return h('figure', { class: 'code' },
      h('div', { class: 'code-head' }, h('span', { class: 'code-lang' }, lang === 'cpp' ? 'C++' : lang.toUpperCase()), caption ? h('span', { class: 'code-cap' }, caption) : null, copy),
      h('pre', { class: 'code-pre', tabindex: '0' }, el));
  }

  window.UI = { h, icon, statusIcon, statusLabel, counter, ring, floatDelta, toast, modal, field, button, langSwitch, logo, reduced, fmt, inline, codeBlock, figure };
})();
