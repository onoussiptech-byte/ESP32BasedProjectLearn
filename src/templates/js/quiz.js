/* quiz.js - the quiz engine: one question per page, six question types, a live mark, animated
 * page changes and a results page. Used by sub-lesson quizzes (8 questions) and, later, final quizzes (20).
 *
 *   const quiz = Quiz.create({ qid, label, title, questions, hasNext, onNext, onRetake, onReview, onList, onExit });
 *   container.append(quiz.el);  quiz.inProgress();  quiz.destroy();
 *
 * Every attempt shuffles the questions and the answers. Nothing is saved until the last question has been
 * checked; then Store.recordAttempt() keeps the best mark (Score) and the latest mark (Total mark). */
(function () {
  'use strict';
  const { h, icon, counter, statusIcon, floatDelta, modal, button } = UI;

  const L = (x) => (typeof x === 'string' ? x : I18n.pick(x));
  const rich = (x) => UI.inline(L(x));
  const reduced = () => UI.reduced();

  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  function shuffleNotSame(ids) {                       // never show an ordering question already solved
    let r; let guard = 0;
    do { r = shuffle(ids); guard++; } while (ids.length > 1 && guard < 20 && r.every((x, i) => x === ids[i]));
    return r;
  }

  const TYPE_ICON = { single: 'target', multi: 'list-checks', truefalse: 'circle-help', code_output: 'cpu', fill_blank: 'file-text', order: 'list' };

  // ================================================================== question types
  // Each builder returns { el, answered(), grade(), lock(), reveal(), userText(), correctText(), pick(i) }
  // ctl.change() tells the page the answer changed (enables the Check button).

  function buildChoice(q, ctl) {                       // single, code_output, multi, truefalse
    const multi = q.type === 'multi', tf = q.type === 'truefalse';
    const opts = tf
      ? [{ id: 'true', text: t('quiz.true'), correct: q.answer === true }, { id: 'false', text: t('quiz.false'), correct: q.answer === false }]
      : shuffle(q.options);
    const sel = new Set();
    const btns = opts.map((o, i) => {
      const key = tf ? icon(o.id === 'true' ? 'check' : 'x') : multi ? h('i', { class: 'box' }, icon('check')) : String.fromCharCode(65 + i);
      const b = h('button', { type: 'button', class: 'opt' + (tf ? ' tf' : ''), role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false', 'data-id': o.id },
        h('span', { class: 'opt-key' }, key), h('span', { class: 'opt-text' }, rich(o.text)));
      b.addEventListener('click', () => toggle(o.id));
      return b;
    });
    function paint() {
      btns.forEach((b, i) => { const on = sel.has(opts[i].id); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      ctl.change();
    }
    function toggle(id) {
      if (ctl.locked()) return;
      if (multi) { if (sel.has(id)) sel.delete(id); else sel.add(id); }
      else { sel.clear(); sel.add(id); }
      paint();
    }
    const list = h('div', { class: 'opts' + (multi ? ' multi' : '') + (tf ? ' tf-row' : ''), role: multi ? 'group' : 'radiogroup' }, btns);
    const text = (o) => L(o.text);
    return {
      el: list,
      answered: () => sel.size > 0,
      grade: () => opts.every((o) => !!o.correct === sel.has(o.id)),
      lock: () => btns.forEach((b) => { b.disabled = true; }),
      reveal() {
        btns.forEach((b, i) => {
          const o = opts[i], on = sel.has(o.id);
          if (o.correct) { b.classList.add('is-correct'); if (!on) b.classList.add('missed'); }
          else if (on) b.classList.add('is-wrong');
          else b.classList.add('dim');
          b.appendChild(h('span', { class: 'opt-flag' }, icon(o.correct ? 'check' : 'x')));
        });
      },
      userText: () => opts.filter((o) => sel.has(o.id)).map(text).join(' · ') || '—',
      correctText: () => opts.filter((o) => o.correct).map(text).join(' · '),
      pick: (i) => { if (opts[i]) toggle(opts[i].id); }
    };
  }

  function buildFill(q, ctl) {
    const tpl = L(q.template), parts = tpl.split(/\{(\d+)\}/);   // text, n, text, n, text ...
    const nums = parts.filter((_, i) => i % 2 === 1);
    const slots = {};
    nums.forEach((n) => { slots[n] = null; });
    const choices = shuffle(q.choices);
    const word = (id) => { const c = q.choices.find((x) => x.id === id); return c ? L(c.text) : ''; };

    const slotEls = {}, chipEls = {};
    const sentence = h('p', { class: 'fill-text' }, parts.map((p, i) => {
      if (i % 2 === 0) return p ? h('span', null, p) : null;
      const b = h('button', { type: 'button', class: 'blank', 'data-n': p, 'aria-label': t('quiz.blank', { n: p }) }, h('span', { class: 'blank-text' }, ' '));
      b.addEventListener('click', () => { if (ctl.locked() || !slots[p]) return; slots[p] = null; paint(); });
      slotEls[p] = b; return b;
    }));
    const bank = h('div', { class: 'chip-bank', role: 'group', 'aria-label': t('quiz.words') }, choices.map((c) => {
      const b = h('button', { type: 'button', class: 'word', 'data-id': c.id }, L(c.text));
      b.addEventListener('click', () => {
        if (ctl.locked()) return;
        const free = nums.find((n) => !slots[n]);
        if (!free || Object.values(slots).includes(c.id)) return;
        slots[free] = c.id; paint(free);
      });
      chipEls[c.id] = b; return b;
    }));
    function paint(justFilled) {
      nums.forEach((n) => {
        const b = slotEls[n], v = slots[n];
        b.classList.toggle('filled', !!v);
        b.firstChild.textContent = v ? word(v) : ' ';
        if (v && n === justFilled && !reduced()) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
      });
      const used = new Set(Object.values(slots));
      choices.forEach((c) => { chipEls[c.id].classList.toggle('used', used.has(c.id)); chipEls[c.id].disabled = used.has(c.id) || ctl.locked(); });
      ctl.change();
    }
    const filledText = (map) => parts.map((p, i) => (i % 2 === 0 ? p : '[' + word(map[p]) + ']')).join('');
    return {
      el: h('div', { class: 'fill' }, sentence, bank),
      answered: () => nums.every((n) => slots[n]),
      grade: () => nums.every((n) => slots[n] === q.blanks[n]),
      lock: () => { Object.values(slotEls).forEach((b) => { b.disabled = true; }); Object.values(chipEls).forEach((b) => { b.disabled = true; }); },
      reveal() { nums.forEach((n) => { slotEls[n].classList.add(slots[n] === q.blanks[n] ? 'ok' : 'bad'); }); },
      userText: () => filledText(slots),
      correctText: () => filledText(q.blanks),
      pick: () => {}
    };
  }

  function buildOrder(q, ctl) {
    const byId = {}; q.items.forEach((x) => { byId[x.id] = x; });
    const pool = shuffleNotSame(q.items.map((x) => x.id));
    let placed = [];
    const ans = h('ol', { class: 'order-answer', 'aria-label': t('quiz.order.yours') });
    const src = h('div', { class: 'order-pool', role: 'group', 'aria-label': t('quiz.steps') });
    function paint(justPlaced) {
      ans.replaceChildren(...q.items.map((_, i) => {
        const id = placed[i], li = h('li', { class: 'slot' + (id ? ' has' : '') }, h('span', { class: 'slot-n' }, String(i + 1)));
        if (id) {
          const b = h('button', { type: 'button', class: 'step' + (id === justPlaced && !reduced() ? ' pop' : ''), 'data-id': id, disabled: ctl.locked() }, L(byId[id].text));
          b.addEventListener('click', () => { if (ctl.locked()) return; placed = placed.filter((x) => x !== id); paint(); });
          li.appendChild(b);
        } else li.appendChild(h('span', { class: 'slot-empty' }, i === placed.length ? t('quiz.order.next') : ''));
        return li;
      }));
      src.replaceChildren(...pool.filter((id) => !placed.includes(id)).map((id) => {
        const b = h('button', { type: 'button', class: 'step src', 'data-id': id, disabled: ctl.locked() }, L(byId[id].text));
        b.addEventListener('click', () => { if (ctl.locked()) return; placed.push(id); paint(id); });
        return b;
      }));
      ctl.change();
    }
    paint();
    const textOf = (ids) => ids.map((id) => L(byId[id].text)).join(' → ');
    return {
      el: h('div', { class: 'order' }, ans, src),
      answered: () => placed.length === q.items.length,
      grade: () => placed.length === q.items.length && placed.every((id, i) => id === q.items[i].id),
      lock: () => { ans.querySelectorAll('button').forEach((b) => { b.disabled = true; }); src.querySelectorAll('button').forEach((b) => { b.disabled = true; }); },
      reveal() { ans.querySelectorAll('li').forEach((li, i) => { li.classList.add(placed[i] === q.items[i].id ? 'ok' : 'bad'); }); },
      userText: () => textOf(placed),
      correctText: () => textOf(q.items.map((x) => x.id)),
      pick: () => {}
    };
  }

  function buildBody(q, ctl) { return q.type === 'fill_blank' ? buildFill(q, ctl) : q.type === 'order' ? buildOrder(q, ctl) : buildChoice(q, ctl); }

  // ================================================================== the quiz
  function create(o) {
    const acc = Store.current();
    const defs = shuffle(o.questions), total = defs.length;
    const max = (Course.quizById[o.qid] || {}).max || total;
    const state = { i: 0, correct: 0, answered: 0, done: false, recs: [] };
    let cur = null;                                           // controller of the question on screen

    // ---------------------------------------------------------------- header, segments, live mark
    const segs = defs.map(() => h('i', { class: 'seg' }));
    const liveNum = h('b'), liveCnt = counter(liveNum);
    const live = h('div', { class: 'q-live num-anchor', title: t('quiz.mark') },
      h('span', null, t('quiz.mark')), liveNum, h('small', null, '/ ' + total));
    liveCnt.set(0, true);
    const exitBtn = h('button', { class: 'btn ghost sm q-exit', type: 'button' }, icon('x'), h('span', null, t('quiz.exit')));
    const head = h('header', { class: 'q-head' },
      h('div', { class: 'q-title' }, h('span', { class: 'lesson-num' }, o.label), h('b', null, t('quiz.title')), h('span', { class: 'q-sub' }, o.title)), exitBtn);
    const progress = h('div', { class: 'q-progress' }, h('div', { class: 'q-segs', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': '0' }, segs), live);
    const stage = h('div', { class: 'q-stage' });
    const root = h('section', { class: 'quiz', 'aria-label': t('quiz.title') }, head, progress, stage);

    exitBtn.addEventListener('click', () => {
      if (!state.answered || state.done) return o.onExit && o.onExit();
      const m = modal({ title: t('quiz.exit.title'), body: h('div', { class: 'confirm' }, h('p', { class: 'sub' }, t('quiz.exit.text')),
        h('div', { class: 'actions' }, button(t('quiz.exit.stay'), { kind: 'ghost', onclick: () => m.close() }),
          button(t('quiz.exit.leave'), { kind: 'danger', icon: 'log-out', onclick: () => { m.close(); if (o.onExit) o.onExit(); } }))) });
    });

    // ---------------------------------------------------------------- one question page
    function questionCard(idx) {
      const q = defs[idx];
      let locked = false, checked = false, body = null, primary = null;     // assigned below; builders call ctl.change() while building
      const ctl = { locked: () => locked, change: () => { if (primary && body && !checked) primary.disabled = !body.answered(); } };
      body = buildBody(q, ctl);
      const hint = q.type === 'multi' ? t('quiz.hint.multi') : q.type === 'fill_blank' ? t('quiz.hint.fill') : q.type === 'order' ? t('quiz.hint.order') : null;
      const prompt = h('h2', { class: 'q-prompt', tabindex: '-1' }, rich(q.prompt));
      primary = h('button', { type: 'button', class: 'btn primary q-primary', disabled: true }, icon('check'), h('span', null, t('quiz.check')));
      const fbBox = h('div', { class: 'q-fbwrap', 'aria-live': 'polite' });
      const card = h('article', { class: 'q-card', 'data-type': q.type },
        h('div', { class: 'q-top' }, h('span', { class: 'q-type' }, icon(TYPE_ICON[q.type]), t('quiz.type.' + q.type)),
          h('span', { class: 'q-count' }, t('quiz.qn', { n: idx + 1, m: total }))),
        prompt,
        q.type === 'code_output' && q.code ? UI.codeBlock(q.code.lang || 'cpp', q.code.text) : null,
        hint ? h('p', { class: 'q-hint' }, icon('info'), h('span', null, hint)) : null,
        body.el, fbBox, h('div', { class: 'q-actions' }, primary));

      function check() {
        if (checked || !body.answered()) return;
        checked = true; locked = true;
        body.lock();
        const ok = body.grade();
        body.reveal();
        state.answered++;
        if (ok) state.correct++;
        const rec = { q, ok, user: body.userText(), right: body.correctText() };
        state.recs.push(rec);
        segs[idx].className = 'seg ' + (ok ? 'ok' : 'bad');
        segs[idx].parentNode.setAttribute('aria-valuenow', String(state.answered));
        liveCnt.set(state.correct);
        if (ok) floatDelta(live, '+1', true);
        fbBox.replaceChildren(h('div', { class: 'q-fb ' + (ok ? 'ok' : 'bad') + (reduced() ? '' : ' in') },
          icon(ok ? 'circle-check' : 'circle-x'),
          h('div', { class: 'q-fb-text' },
            h('b', null, ok ? t('quiz.fb.ok') : t('quiz.fb.bad')),
            ok ? null : h('p', null, h('span', { class: 'lbl' }, t('quiz.fb.answer')), ' ', h('span', { class: 'ans' }, rec.right)),
            h('p', { class: 'why' }, rich(q.explain)))));
        const last = idx === total - 1;
        primary.replaceChildren(icon(last ? 'flag' : 'arrow-right'), h('span', null, last ? t('quiz.finish') : t('quiz.next')));
        primary.disabled = false; primary.classList.add('next');
        primary.onclick = () => { if (last) finish(); else go(idx + 1); };
        primary.focus({ preventScroll: true });
        fbBox.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      }
      primary.onclick = check;
      return { card, prompt, primary, body, check, isChecked: () => checked };
    }

    function show(next, animate) {
      const old = stage.firstElementChild;
      if (!old || !animate || reduced()) { stage.replaceChildren(next.card); }
      else {
        old.classList.add('leave'); next.card.classList.add('enter'); stage.appendChild(next.card);
        setTimeout(() => { old.remove(); next.card.classList.remove('enter'); }, 340);
      }
      cur = next;
      segs.forEach((s, i) => s.classList.toggle('cur', i === state.i && !state.done));
      if (!animate) return;                                   // the first question: the page positions itself
      const r = root.getBoundingClientRect();
      if (r.top < 70) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 130), behavior: reduced() ? 'auto' : 'smooth' });
      next.prompt.focus({ preventScroll: true });
    }
    function go(i) { state.i = i; show(questionCard(i), true); }

    // ---------------------------------------------------------------- results page
    function finish() {
      state.done = true;
      segs.forEach((s) => s.classList.remove('cur'));
      const before = acc.results[o.qid];
      const prevBest = before ? before.best : -1;
      const res = Store.recordAttempt(acc.uid, o.qid, state.correct);
      const next = { card: resultCard(res, prevBest), prompt: null };
      const old = stage.firstElementChild;
      if (old && !reduced()) { old.classList.add('leave'); next.card.classList.add('enter'); stage.appendChild(next.card); setTimeout(() => { old.remove(); next.card.classList.remove('enter'); }, 340); }
      else stage.replaceChildren(next.card);
      cur = null;
      exitBtn.style.display = 'none';
      const r = root.getBoundingClientRect();
      if (r.top < 70) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 130), behavior: reduced() ? 'auto' : 'smooth' });
      const hd = next.card.querySelector('.res-title'); if (hd) hd.focus({ preventScroll: true });
      setTimeout(() => { if (window.App && res) App.showDeltas(res); }, 500);
      if (o.onFinish) o.onFinish(res);
    }

    function resultCard(res, prevBest) {
      const mark = state.correct;
      const kind = (Course.quizById[o.qid] || {}).kind || 'sub';
      const rg = Course.ranges(kind);
      const status = Course.statusOf(kind, mark);                 // what THIS attempt earned
      const qStatus = res ? res.status : status, prev = res ? res.prevStatus : 'new';   // the quiz's status follows the BEST mark
      const rec = Store.current().results[o.qid] || { n: 1, best: mark };
      const icn = statusIcon(status, null, 84);
      if (!reduced()) icn.classList.add('anim');
      const need = status === 'todo' ? rg.done[0] - mark : 0;
      const msg = status === 'done' ? t('quiz.res.done.msg') : status === 'todo' ? t('quiz.res.todo.msg', { n: need }) : t('quiz.res.failed.msg');
      const sgn = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0');
      const tile = (label, value, cls, note) => h('div', { class: 'res-tile ' + (cls || '') }, h('span', { class: 'res-k' }, label), h('b', null, value), note ? h('small', null, note) : null);
      const bands = h('div', { class: 'res-bands' }, ['done', 'todo', 'failed'].map((s) => {
        const a = rg[s]; const txt = a[0] === a[1] ? String(a[0]) : a[0] + '–' + a[1];
        return h('span', { class: 'band b-' + s + (s === status ? ' on' : '') }, statusIcon(s, null, 16), h('b', null, t('status.' + s)), h('span', null, txt));
      }));

      const review = state.recs.map((r, i) => h('details', { class: 'rev ' + (r.ok ? 'ok' : 'bad'), open: !r.ok },
        h('summary', null, icon(r.ok ? 'circle-check' : 'circle-x'), h('span', { class: 'rev-n' }, String(i + 1)), h('span', { class: 'rev-q' }, rich(r.q.prompt)), icon('chevron-down')),
        h('div', { class: 'rev-body' },
          r.q.type === 'code_output' && r.q.code ? UI.codeBlock(r.q.code.lang || 'cpp', r.q.code.text) : null,
          h('p', null, h('span', { class: 'lbl' }, t('quiz.fb.yours')), ' ', h('span', { class: r.ok ? 'ans ok' : 'ans bad' }, r.user)),
          r.ok ? null : h('p', null, h('span', { class: 'lbl' }, t('quiz.fb.answer')), ' ', h('span', { class: 'ans ok' }, r.right)),
          h('p', { class: 'why' }, rich(r.q.explain)))));

      const doneNow = qStatus === 'done';
      const actions = h('div', { class: 'res-actions' },
        button(t('quiz.retake'), { icon: 'rotate-ccw', kind: doneNow ? 'ghost' : 'primary', onclick: () => o.onRetake && o.onRetake() }),
        o.hasNext ? button(t('quiz.next.sub'), { icon: 'arrow-right', kind: doneNow ? 'primary' : 'ghost', onclick: () => o.onNext && o.onNext() }) : null,
        button(t('quiz.review.lesson'), { icon: 'book-open', kind: 'ghost', onclick: () => o.onReview && o.onReview() }),
        button(t('quiz.all'), { icon: 'list', kind: 'ghost', onclick: () => o.onList && o.onList() }));

      const scoreNum = h('span', { class: 'res-big' }), cnt = counter(scoreNum);
      setTimeout(() => cnt.set(mark), reduced() ? 0 : 250);
      if (reduced()) cnt.set(mark, true);
      return h('article', { class: 'q-card q-result res-' + status },
        h('div', { class: 'res-hero' }, icn,
          h('div', { class: 'res-main' },
            h('h2', { class: 'res-title', tabindex: '-1' }, t('quiz.res.title')),
            h('div', { class: 'res-score' }, scoreNum, h('span', { class: 'res-of' }, '/ ' + max),
              h('span', { class: 'state-pill st-' + status }, t('status.' + status)),
              prev !== qStatus ? h('span', { class: 'chg' }, t('quiz.res.status'), ': ', t('status.' + prev), ' → ', t('status.' + qStatus)) : null,
              prevBest >= 0 && mark > prevBest ? h('span', { class: 'newbest' }, icon('sparkles'), t('quiz.res.newbest')) : null),
            h('p', { class: 'res-msg' }, msg),
            status !== qStatus ? h('p', { class: 'res-keeps' }, icon('shield-check'), h('span', null, t('quiz.res.keeps', { s: t('status.' + qStatus), b: rec.best, m: max }))) : null,
            bands)),
        h('div', { class: 'res-tiles' },
          tile(t('quiz.res.attempt'), mark + ' / ' + max),
          tile(t('quiz.res.best'), (res ? res.best : mark) + ' / ' + max, 'blue'),
          tile(t('quiz.res.score'), res ? sgn(res.scoreDelta) : '±0', res && res.scoreDelta > 0 ? 'up' : '', t('quiz.res.score.note')),
          tile(t('quiz.res.mark'), res ? sgn(res.markDelta) : '±0', res && res.markDelta > 0 ? 'up' : res && res.markDelta < 0 ? 'down' : '', t('quiz.res.mark.note')),
          tile(t('quiz.res.tries'), String(rec.n))),
        h('h3', { class: 'res-h' }, t('quiz.review')), h('div', { class: 'rev-list' }, review), actions);
    }

    // ---------------------------------------------------------------- keyboard: 1-9 pick an option, Enter checks / continues
    function onKey(e) {
      if (state.done || e.ctrlKey || e.metaKey || e.altKey || !cur || document.querySelector('.modal-back')) return;
      if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
      if (/^[1-9]$/.test(e.key)) { cur.body.pick(Number(e.key) - 1); return; }
      if (e.key === 'Enter') {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return;
        if (cur.isChecked()) cur.primary.click(); else cur.check();
      }
    }
    document.addEventListener('keydown', onKey);

    show(questionCard(0), false);
    return {
      el: root,
      inProgress: () => state.answered > 0 && !state.done,
      destroy: () => document.removeEventListener('keydown', onKey)
    };
  }

  window.Quiz = { create };
})();
