/* dashboard.js - the Dashboard page (the first tab) of a workspace. Mounted once; update() refreshes values with animation.
 * Everything it shows comes from the tabs of that workspace only. */
(function () {
  'use strict';
  const { h, icon, ring, counter, statusIcon, floatDelta } = UI;
  const fmt = (n) => I18n.num(n);

  function quizLabel(qid) {
    const q = Course.quizById[qid]; if (!q) return qid;
    const l = Course.lessonList.find((x) => x.key === q.lesson);
    return q.tab.slice(1) + '.' + l.num + (q.kind === 'final' ? ' · ' + t('dash.final') : '.' + q.n);
  }

  function card(cls, title, ...kids) {
    return h('section', { class: 'card ' + cls }, title ? h('h3', { class: 'card-title' }, title) : null, kids);
  }

  function mount(ws) {
    const wsTabs = ws.tabs.map(Course.tab), inWs = (qid) => ws.tabs.includes(qid.split('.')[0]), aqua = ws.id === 'aqua';
    const acct = Store.current();
    const el = h('div', { class: 'dash' });

    // ---------------------------------------------------------------- hero
    const initial = (acct.first.trim()[0] || acct.id[0]).toUpperCase();
    el.appendChild(h('section', { class: 'hero' + (aqua ? ' aqua' : '') },
      h('span', { class: 'avatar xl' }, initial),
      h('div', { class: 'hero-text' },
        h('h1', null, t('dash.welcome', { name: acct.first })),
        h('p', null, aqua ? t('ws.aqua') + ' · ' + t('ws.aqua.sub') : I18n.pick(window.ESP32TOUR_COURSE.app.long_name))),
      h('span', { class: 'pill' }, icon('user'), h('span', null, acct.id))));

    // ---------------------------------------------------------------- profile
    const row = (k, v, extra) => h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v, extra));
    const profile = card('c-profile', t('dash.profile'),
      row(t('dash.id'), acct.id), row(t('dash.first'), acct.first), row(t('dash.last'), acct.last),
      row(t('dash.password'), h('span', { class: 'dots', 'aria-label': t('dash.password') }, '••••••••')),
      h('p', { class: 'note' }, icon('lock'), h('span', null, t('dash.pw.note'))));

    // ---------------------------------------------------------------- progress ring
    const bigRing = ring({ size: 150, stroke: 14, fontSize: 32 });
    const passedTxt = h('p', { class: 'center muted' });
    const progress = card('c-progress', t('dash.progress'), h('div', { class: 'center' }, bigRing.el),
      passedTxt, h('p', { class: 'center tiny muted' }, t('dash.progress.sub')));

    // ---------------------------------------------------------------- score
    const scoreNum = h('span', { class: 'big-num' });
    const scoreCnt = counter(scoreNum);
    const scoreOf = h('span', { class: 'of' });
    const scoreAnchor = h('div', { class: 'num-anchor' }, scoreNum, scoreOf);
    const score = card('c-score', t('dash.score'), scoreAnchor, h('p', { class: 'note' }, t('dash.score.sub')));

    // ---------------------------------------------------------------- total mark (horizontal bar)
    const markPct = h('span', { class: 'big-num blue' });
    const markCnt = counter(markPct, { suffix: ' %', format: (v) => (Math.round(v * 10) / 10).toLocaleString(I18n.lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1, minimumFractionDigits: 0 }) });
    const markFill = h('div', { class: 'bar-fill' });
    const markFig = h('span', { class: 'fig' });
    const markAnchor = h('div', { class: 'num-anchor' }, markPct, markFig);
    const counts = h('div', { class: 'count-chips' });
    const mark = card('c-mark', t('dash.mark'), markAnchor,
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, markFill),
      h('p', { class: 'note' }, t('dash.mark.sub')), counts);

    // ---------------------------------------------------------------- continue
    const cont = card('c-continue', t('dash.continue'));

    // ---------------------------------------------------------------- the project (Aquaponics Realisation only)
    const LOOP = [['fish', 'fish'], ['filter', 'recycle'], ['plants', 'sprout'], ['water', 'droplets']];
    const MEASURES = [['droplet', 'ph'], ['thermometer', 'temp'], ['waves', 'flow'], ['ruler', 'level']];
    const DRIVES = [['refresh-cw', 'pump'], ['wind', 'air'], ['flask-conical', 'dose'], ['flame', 'heat']];
    const chips = (list) => h('div', { class: 'aq-chips' }, list.map(([ic, k]) => h('span', { class: 'meta-chip' }, icon(ic), h('span', null, t('aq.' + k)))));
    const project = aqua ? h('section', { class: 'card c-project span-all' }, h('h3', { class: 'card-title' }, t('aq.title')),
      h('div', { class: 'aq-grid' },
        h('figure', { class: 'aq-fig' }, UI.figure('aquaponics-cycle'), h('figcaption', null, t('aq.caption'))),
        h('div', null,
          h('ol', { class: 'aq-loop' }, LOOP.map(([k, ic]) => h('li', null, h('span', { class: 'aq-ic' }, icon(ic)),
            h('div', null, h('b', null, t('aq.loop.' + k)), h('p', null, t('aq.loop.' + k + '.text')))))),
          h('p', { class: 'aq-node' }, t('aq.node')),
          h('div', { class: 'aq-two' },
            h('div', null, h('h4', null, t('aq.measures')), chips(MEASURES)),
            h('div', null, h('h4', null, t('aq.drives')), chips(DRIVES)))))) : null;

    // ---------------------------------------------------------------- per section
    const tabCards = {};
    const sectionRow = h('div', { class: 'section-row' });
    wsTabs.forEach((tb) => {
      const r = ring({ size: 84, stroke: 9, fontSize: 18 });
      const sc = h('b'), mk = h('b'), cnt1 = counter(sc), cnt2 = counter(mk);
      const fill = h('div', { class: 'bar-fill' });
      tabCards[tb.id] = { r, cnt1, cnt2, sc, mk, fill, of1: h('small'), of2: h('small') };
      sectionRow.appendChild(h('section', { class: 'card c-tab' },
        h('div', { class: 'tab-card-head' }, r.el,
          h('div', null, h('h3', { class: 'card-title tight' }, I18n.pick(tb.title)),
            h('p', { class: 'tiny muted', 'data-passed': tb.id }))),
        tb.about ? h('p', { class: 'note tab-about' }, I18n.pick(tb.about)) : null,
        h('div', { class: 'mini-stats' },
          h('div', null, h('span', { class: 'tiny muted' }, t('dash.score')), h('div', null, sc, tabCards[tb.id].of1)),
          h('div', null, h('span', { class: 'tiny muted' }, t('dash.mark')), h('div', null, mk, tabCards[tb.id].of2))),
        h('div', { class: 'bar thin' }, fill)));
    });
    const bySection = h('div', { class: 'span-all' }, h('h3', { class: 'section-title' }, t('dash.pertab')), sectionRow);

    // ---------------------------------------------------------------- timeline
    const timeline = h('div', { class: 'timeline-wrap' });

    // ---------------------------------------------------------------- activity + recent
    const bars = h('div', { class: 'bars' });
    const activity = card('c-activity', t('dash.activity'), bars, h('p', { class: 'empty', 'data-empty': 'act' }, t('dash.activity.empty')));
    const recentList = h('ul', { class: 'recent' });
    const recent = card('c-recent', t('dash.recent'), recentList);

    // ---------------------------------------------------------------- legend
    function legendBlock(kind, title) {
      const rg = Course.ranges(kind);
      const rng = (a) => (a[0] === a[1] ? t('range.single', { a: a[0] }) : t('range.todo', { a: a[0], b: a[1] }));
      return h('div', { class: 'legend-block' }, h('h4', null, title),
        ['failed', 'todo', 'done'].map((s) => h('div', { class: 'legend-row' }, statusIcon(s), h('b', null, t('status.' + s)), h('span', null, rng(rg[s])))));
    }
    const legend = card('c-legend', t('dash.legend'),
      h('div', { class: 'legend-grid' }, legendBlock('sub', t('dash.legend.sub')), legendBlock('final', t('dash.legend.final')),
        h('div', { class: 'legend-block' }, h('h4', null, t('status.new')),
          h('div', { class: 'legend-row' }, statusIcon('new'), h('b', null, t('status.new')), h('span', null, '—')),
          h('p', { class: 'note' }, t('dash.legend.rules')))));

    el.append(...[h('div', { class: 'grid' }, profile, progress, score, mark, cont), project, bySection,
      h('div', { class: 'span-all' }, h('h3', { class: 'section-title' }, t('dash.timeline')), timeline),
      h('div', { class: 'grid two' }, activity, recent), legend].filter(Boolean));

    // the sub-lessons of a main lesson, with the state of their quizzes (opens inside its card)
    function subList(a, l) {
      const rows = [];
      for (let n = 1; n <= l.subs; n++) {
        const qid = l.key + '.s' + String(n).padStart(2, '0'), res = a.results[qid];
        rows.push(h('li', null, h('span', { class: 'ln-sn' }, l.tab.slice(1) + '.' + l.num + '.' + n),
          h('span', { class: 'ln-st' }, I18n.pick(Course.subTitle(l.key, n))), statusIcon(Course.statusOf('sub', res ? res.best : null), 'dash:' + qid, 16)));
      }
      const d = h('details', { class: 'lesson-subs', open: openLists.has(l.key) }, h('summary', null, t('dash.subs', { n: l.subs }), icon('chevron-down')), h('ul', null, rows));
      d.addEventListener('toggle', () => { if (d.open) openLists.add(l.key); else openLists.delete(l.key); });
      return d;
    }

    // ================================================================ update
    let first = true;
    const openLists = new Set();                              // lesson cards whose list of sub-lessons is open
    function update() {
      const a = Store.current(); if (!a) return;
      const s = Store.stats(a, ws.tabs), tot = s.total, instant = first;
      const attempts = a.attempts.filter((x) => inWs(x.q));
      first = false;

      bigRing.set(tot.pct, instant);
      passedTxt.textContent = t('dash.passed', { n: fmt(tot.passed), m: fmt(tot.quizzes) });

      scoreCnt.set(tot.score, instant);
      scoreOf.textContent = ' / ' + fmt(tot.max);

      const mpct = tot.max ? (tot.mark / tot.max) * 100 : 0;
      markCnt.set(mpct, instant);
      markFill.style.width = mpct + '%';
      markFig.textContent = fmt(tot.mark) + ' / ' + fmt(tot.max);
      mark.querySelector('.bar').setAttribute('aria-valuenow', String(Math.round(mpct)));

      counts.replaceChildren(...['done', 'todo', 'failed', 'new'].map((st) =>
        h('span', { class: 'count-chip c-' + st }, statusIcon(st, 'count:' + st), h('b', null, fmt(tot.counts[st])), h('span', null, t('status.' + st)))));

      Object.keys(tabCards).forEach((id) => {
        const c = tabCards[id], b = s.tabs[id];
        c.r.set(b.pct, instant); c.cnt1.set(b.score, instant); c.cnt2.set(b.mark, instant);
        c.of1.textContent = ' / ' + fmt(b.max); c.of2.textContent = ' / ' + fmt(b.max);
        c.fill.style.width = (b.max ? (b.mark / b.max) * 100 : 0) + '%';
        el.querySelector('[data-passed="' + id + '"]').textContent = t('dash.passed', { n: fmt(b.passed), m: fmt(b.quizzes) });
      });

      // continue card
      const last = attempts[attempts.length - 1];
      const go = aqua ? { href: '#/' + (last ? last.q.split('.')[0] : ws.tabs[0]) }        // the lessons of tabs 3 and 4 are still to come
        : { href: last && last.q.startsWith('t1.') ? '#/' + last.q.replace(/\./g, '/') : '#/t1/l01/s01' };
      cont.replaceChildren(h('h3', { class: 'card-title' }, t('dash.continue')),
        h('div', { class: 'cont-icon' }, icon('play')),
        h('p', { class: 'strong' }, last ? t('dash.continue.last', { q: quizLabel(last.q) }) : t('dash.continue.none')),
        h('p', { class: 'note' }, t('dash.continue.note')),
        h('a', { class: 'btn primary sm cont-go', href: go.href },
          icon('arrow-right'), h('span', null, last ? t('dash.continue.go') : aqua ? t('dash.continue.tab', { title: I18n.pick(wsTabs[0].title) }) : t('dash.continue.start'))));

      // timeline
      timeline.replaceChildren(...wsTabs.map((tb) => {
        const cards = Course.lessonList.filter((l) => l.tab === tb.id).map((l) => {
          const ls = s.lessons[l.key];
          const pct = ls.subs ? (ls.subsDone / ls.subs) * 100 : 0;
          const lessonCard = h('article', { class: 'lesson-card ' + ls.state },
            h('div', { class: 'lesson-top' }, h('span', { class: 'lesson-num' }, tb.id.slice(1) + '.' + l.num),
              h('span', { class: 'state-chip ' + ls.state }, t('dash.lesson.' + ls.state))),
            h('h4', null, I18n.pick(l.title)),
            h('div', { class: 'bar thin' }, h('div', { class: 'bar-fill', style: { width: pct + '%' } })),
            h('div', { class: 'lesson-foot' }, h('span', null, t('dash.quizzes', { d: ls.subsDone, n: ls.subs })),
              h('span', { class: 'final-st' }, statusIcon(ls.final, 'final:' + l.key, 18), h('span', null, t('dash.final')))), aqua ? subList(a, l) : null);
          // the Basic Concepts lessons exist now, so their cards open the lesson; FreeRTOS... lessons are still to come
          return tb.id === 't1' ? h('a', { class: 'lesson-link', href: '#/' + l.key.replace(/\./g, '/') }, lessonCard) : lessonCard;
        });
        return h('div', { class: 'timeline-group' }, h('h4', { class: 'group-title' }, I18n.pick(tb.title)), h('div', { class: 'timeline-grid' + (aqua ? ' roomy' : '') }, cards));
      }));

      // activity (last 14 days)
      const days = [], now = new Date();
      for (let i = 13; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); days.push({ d, n: 0, key: d.toDateString() }); }
      attempts.forEach((x) => { const k = new Date(x.at).toDateString(); const dd = days.find((y) => y.key === k); if (dd) dd.n++; });
      const maxN = Math.max(1, ...days.map((x) => x.n));
      bars.replaceChildren(...days.map((x) => h('div', { class: 'bar-col', title: x.d.toLocaleDateString(I18n.lang) + ': ' + x.n },
        h('div', { class: 'bar-v' }, h('i', { style: { height: (x.n / maxN) * 100 + '%' } })), h('span', null, String(x.d.getDate())))));
      activity.querySelector('[data-empty]').style.display = attempts.length ? 'none' : '';

      // recent quizzes
      const items = attempts.slice(-5).reverse();
      recentList.replaceChildren(...(items.length ? items.map((x) => {
        const q = Course.quizById[x.q];
        return h('li', null, statusIcon(Course.statusOf(q.kind, x.m)), h('span', { class: 'rq' }, quizLabel(x.q)),
          h('b', null, x.m + ' / ' + q.max),
          h('time', null, new Date(x.at).toLocaleDateString(I18n.lang, { day: 'numeric', month: 'short' })));
      }) : [h('li', { class: 'empty' }, t('dash.recent.empty'))]));
    }

    update.floatDeltas = (res) => {                         // "+3" / "▼2" floating over Score and Total mark
      if (!res) return;
      if (res.scoreDelta) floatDelta(scoreAnchor, '+' + res.scoreDelta, true);
      if (res.markDelta) floatDelta(markAnchor, (res.markDelta > 0 ? '+' : '▼') + Math.abs(res.markDelta), res.markDelta > 0);
    };
    return { el, update, floatDeltas: update.floatDeltas };
  }

  window.Dashboard = { mount };
})();
