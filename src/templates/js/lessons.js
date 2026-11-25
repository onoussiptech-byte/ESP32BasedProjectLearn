/* lessons.js - a tab of lessons (TABS): vertical lesson tabs (the main lessons, their sub-lessons and final quiz),
 * lesson pages (1-4 per sub-lesson), concept chips with a Back button, and the quiz page.
 * Sub-lessons without written content show a calm "coming soon" page; nothing is ever locked.
 *
 * Routes (location.hash), shown for t1:
 *   #/t1                      tab overview            #/t1/l01              main-lesson overview
 *   #/t1/l01/s01              lesson page 1           #/t1/l01/s01/p2/levels  page 2, scrolled to the section "levels"
 *   #/t1/l01/s01/quiz         the quiz                #/t1/l01/final        final quiz of the main lesson */
(function () {
  'use strict';
  const { h, icon, statusIcon, button, modal } = UI;
  const TABS = ['t1', 't3'];                                  // the tabs whose lessons are open
  let TAB = 't1';                                             // the tab on screen (one at a time)
  const L = (x) => (typeof x === 'string' ? x : I18n.pick(x));
  const pad = (n) => String(n).padStart(2, '0');
  const reduced = () => UI.reduced();

  // ------------------------------------------------------------------ routes
  const ROUTE_RE = /^#\/(t\d)(?:\/(l\d\d)(?:\/(s\d\d|final)(?:\/(?:p(\d)|(quiz))(?:\/([a-z0-9-]+))?)?)?)?\/?$/;

  function parse(hash) {
    const m = (hash || '').match(ROUTE_RE);
    const r = { lesson: null, sub: null, n: 0, view: 'tab', page: 1, section: null };
    if (!m || m[1] !== TAB || !m[2]) return r;
    const l = Course.lessonList.find((x) => x.key === TAB + '.' + m[2]);
    if (!l) return r;
    r.lesson = m[2];
    if (!m[3]) { r.view = 'lesson'; return r; }
    if (m[3] === 'final') { r.sub = 'final'; r.view = 'sub'; return r; }
    const n = Number(m[3].slice(1));
    if (n < 1 || n > l.subs) { r.view = 'lesson'; return r; }
    r.sub = m[3]; r.n = n; r.view = m[5] ? 'quiz' : 'sub'; r.page = m[4] ? Number(m[4]) : 1; r.section = m[6] || null;
    return r;
  }
  function href(lesson, sub, page, section) {
    return '#/' + TAB + (lesson ? '/' + lesson + (sub ? '/' + sub + (page === 'quiz' ? '/quiz' : page ? '/p' + page + (section ? '/' + section : '') : '') : '') : '');
  }
  const lessonOf = (r) => Course.lesson(TAB + '.' + r.lesson);
  const qidOf = (r) => TAB + '.' + r.lesson + '.' + r.sub;
  const subHref = (l, n, page) => href(l.key.split('.')[1], 's' + pad(n), page);
  const lessonHref = (l) => href(l.key.split('.')[1]);
  const labelOf = (l, n) => TAB.slice(1) + '.' + l.num + (n ? '.' + n : '');

  // ------------------------------------------------------------------ results
  const resultOf = (qid) => { const a = Store.current(); return (a && a.results[qid]) || null; };
  function statusOf(qid) {
    const q = Course.quizById[qid], r = resultOf(qid);
    return Course.statusOf(q.kind, r ? r.best : null);
  }
  const maxOf = (qid) => Course.quizById[qid].max;

  // ------------------------------------------------------------------ lesson content (one script per sub-lesson, loaded when opened)
  function loadContent(qid) {
    const reg = (window.ESP32TOUR_CONTENT = window.ESP32TOUR_CONTENT || {});
    if (reg[qid]) return Promise.resolve(reg[qid]);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'content/' + qid + '.js?v=' + Store.VERSION;
      s.onload = () => { s.remove(); if (reg[qid]) resolve(reg[qid]); else reject(new Error('empty')); };
      s.onerror = () => { s.remove(); reject(new Error('load')); };
      document.head.appendChild(s);
    });
  }

  // ------------------------------------------------------------------ lesson blocks
  const CALLOUT_ICON = { tip: 'lightbulb', note: 'info', warn: 'triangle-alert' };

  function renderBlock(b, o) {
    const rich = (x) => UI.inline(L(x), o);
    switch (b.type) {
      case 'p': return h('p', { class: 'bp' }, rich(b.text));
      case 'h': return h('h2', { class: 'bh', 'data-sec': b.id }, L(b.text));
      case 'list': return h(b.ordered ? 'ol' : 'ul', { class: 'bl' }, b.items.map((it) => h('li', null, rich(it))));
      case 'facts': return h('div', { class: 'facts' }, b.items.map((it) => h('div', { class: 'fact' }, h('b', null, it.value), h('span', null, L(it.label)))));
      case 'table': return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, b.head.map((c) => h('th', null, L(c))))),
        h('tbody', null, b.rows.map((r) => h('tr', null, r.map((c, i) => h(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : null, rich(c))))))));
      case 'callout': return h('aside', { class: 'callout k-' + b.kind }, icon(CALLOUT_ICON[b.kind]),
        h('div', null, h('b', null, L(b.title)), h('p', null, rich(b.text))));
      case 'flow': return h('div', { class: 'flow' }, b.items.map((it, i) => [
        h('div', { class: 'flow-card' }, h('span', { class: 'flow-ic' }, icon(it.icon || 'layers')), h('b', null, L(it.title)), h('p', null, rich(it.text))),
        i < b.items.length - 1 ? h('span', { class: 'flow-arrow', 'aria-hidden': 'true' }, icon('arrow-right')) : null]));
      case 'steps': return h('ol', { class: 'steps' }, b.items.map((it) => h('li', null, h('div', null, h('b', null, L(it.title)), h('p', null, rich(it.text))))));
      case 'figure': return UI.figureBlock(b.name, rich(b.caption));
      case 'gallery': return h('div', { class: 'gallery' }, b.items.map((it) => h('section', { class: 'gal-card' },
        it.name ? UI.figureBlock(it.name, null) : h('div', { class: 'gal-icon' }, icon(it.icon)),
        h('div', { class: 'gal-text' }, h('b', null, L(it.title)), h('p', null, rich(it.text)),
          it.ref ? h('p', { class: 'gal-ref' }, icon('file-text'), UI.docLink(t('src.' + it.ref.doc) + ' · ' + t('learn.page.short', { n: it.ref.page }), it.ref.url)) : null))));
      case 'refs': return h('div', { class: 'refs' }, icon('book-marked'), h('span', { class: 'refs-label' }, t('learn.refs')),
        b.items.map((s) => h('span', { class: 'ref-chip' }, UI.docLink(t('src.' + s.doc) + ' · ' + s.section + ' · ' + t('learn.page.short', { n: s.page }), s.url))));
      case 'code': return UI.codeBlock(b.lang || 'plain', b.code, b.caption ? L(b.caption) : null);
      default: return null;
    }
  }

  function sourcesBox(list) {
    if (!list || !list.length) return null;
    return h('aside', { class: 'sources' },
      h('h3', null, icon('book-marked'), h('span', null, t('learn.sources'))),
      h('ul', null, list.map((s) => h('li', null,
        h('span', { class: 'src-doc' }, t('src.' + s.doc)),
        s.local ? UI.docLink(s.section, s.url) : h('a', { class: 'ext', href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.section),
        s.page ? h('span', { class: 'src-page' }, t('learn.page.short', { n: s.page })) : null,
        s.local ? null : h('span', { class: 'online-tag' }, t('common.online'))))),
      h('p', { class: 'note' }, icon('info'), h('span', null, t(list[0].local ? 'learn.sources.local' : 'learn.sources.note'))));
  }

  // ================================================================== the view
  function mount(tab) {
    TAB = tab;
    const el = h('div', { class: 'learn' });
    let route = parse(location.hash), token = 0, quiz = null, pageApi = null;
    let backStack = [], pendingScroll = null;
    const expanded = new Set();

    // ---------------------------------------------------------------- navigation guard (quiz in progress)
    function confirmLeave(then) {
      const m = modal({ title: t('quiz.exit.title'), body: h('div', { class: 'confirm' }, h('p', { class: 'sub' }, t('quiz.exit.text')),
        h('div', { class: 'actions' }, button(t('quiz.exit.stay'), { kind: 'ghost', onclick: () => m.close() }),
          button(t('quiz.exit.leave'), { kind: 'danger', icon: 'log-out', onclick: () => { m.close(); then(); } }))) });
    }
    // data-nav links start a new context: they clear the Back trail and ask before abandoning a quiz
    function navLink(attrs, ...kids) {
      const a = h('a', { ...attrs, 'data-nav': '' }, ...kids);
      a.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
        e.preventDefault();
        const to = attrs.href, run = () => { backStack = []; closeDrawer(); if (location.hash === to) { render(); } else location.hash = to; };
        if (quiz && quiz.inProgress()) confirmLeave(run); else run();
      });
      return a;
    }

    // ---------------------------------------------------------------- side navigation (the vertical tabs)
    const nav = h('aside', { class: 'lnav', 'aria-label': t('learn.nav') });
    const navHead = h('div', { class: 'ln-head' });
    const navList = h('div', { class: 'ln-list' });
    const navClose = h('button', { class: 'icon-btn ln-close', type: 'button', 'aria-label': t('common.close'), onclick: () => closeDrawer() }, icon('x'));
    nav.append(h('div', { class: 'ln-top' }, navHead, navClose), navList);
    const scrim = h('div', { class: 'ln-scrim', onclick: () => closeDrawer() });
    const barLabel = h('span', { class: 'lbar-cur' });
    const bar = h('div', { class: 'lbar' },
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-controls': 'ln-nav', onclick: () => openDrawer() }, icon('menu'), h('span', null, t('learn.nav'))), barLabel);
    nav.id = 'ln-nav';
    function openDrawer() { el.classList.add('drawer'); }
    function closeDrawer() { el.classList.remove('drawer'); }

    function drawNav() {
      const a = Store.current(); if (!a) return;
      const s = Store.stats(a), tb = s.tabs[TAB];
      navHead.replaceChildren(h('b', null, I18n.pick(Course.tab(TAB).title)),
        h('small', null, t('dash.passed', { n: UI.fmt(tb.passed), m: UI.fmt(tb.quizzes) })),
        h('div', { class: 'bar thin' }, h('div', { class: 'bar-fill', style: { width: (tb.pct || 0) + '%' } })));
      navList.replaceChildren(...Course.lessonList.filter((l) => l.tab === TAB).map((l) => {
        const ls = s.lessons[l.key], open = expanded.has(l.key);
        const lrow = h('div', { class: 'ln-lrow' },
          navLink({ class: 'ln-lesson', href: lessonHref(l), 'data-lesson': l.key },
            h('span', { class: 'ln-num' }, labelOf(l)), h('span', { class: 'ln-title' }, L(l.title)),
            h('span', { class: 'ln-prog', title: t('learn.passed', { d: ls.subsDone, n: ls.subs }) }, ls.subsDone + '/' + ls.subs)),
          h('button', { class: 'ln-toggle', type: 'button', 'aria-expanded': String(open), 'aria-label': L(l.title) }, icon('chevron-down')));
        const subs = h('ul', { class: 'ln-subs' });
        for (let n = 1; n <= l.subs; n++) {
          const qid = l.key + '.s' + pad(n), st = statusOf(qid), has = Course.hasContent(qid);
          subs.appendChild(h('li', null, navLink({ class: 'ln-sub' + (has ? '' : ' soon'), href: subHref(l, n), 'data-q': qid, title: has ? '' : t('learn.soon.title') },
            h('span', { class: 'ln-sn' }, labelOf(l, n)), h('span', { class: 'ln-st' }, L(Course.subTitle(l.key, n))), statusIcon(st, 'nav:' + qid, 16))));
        }
        const fq = l.key + '.final';
        subs.appendChild(h('li', null, navLink({ class: 'ln-sub final soon', href: href(l.key.split('.')[1], 'final'), 'data-q': fq },
          h('span', { class: 'ln-sn' }, icon('flag')), h('span', { class: 'ln-st' }, t('learn.final')), statusIcon(statusOf(fq), 'nav:' + fq, 16))));
        const block = h('div', { class: 'ln-block' + (open ? ' open' : ''), 'data-lesson': l.key }, lrow, h('div', { class: 'ln-subs-wrap' }, subs));
        lrow.querySelector('.ln-toggle').addEventListener('click', () => {
          const on = !block.classList.contains('open');
          block.classList.toggle('open', on); lrow.querySelector('.ln-toggle').setAttribute('aria-expanded', String(on));
          if (on) expanded.add(l.key); else expanded.delete(l.key);
        });
        return block;
      }));
      markCurrent(false);
    }
    function markCurrent(scrollIntoView) {
      const key = route.lesson ? TAB + '.' + route.lesson : null;
      const curQ = route.lesson && route.sub ? qidOf(route) : null;
      if (key && !expanded.has(key)) {
        expanded.add(key);
        const blk = navList.querySelector('.ln-block[data-lesson="' + key + '"]');
        if (blk) { blk.classList.add('open'); blk.querySelector('.ln-toggle').setAttribute('aria-expanded', 'true'); }
      }
      navList.querySelectorAll('.ln-lesson').forEach((a) => {
        const on = a.dataset.lesson === key && !route.sub;
        a.classList.toggle('current', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      navList.querySelectorAll('.ln-sub').forEach((a) => {
        const on = a.dataset.q === curQ;
        a.classList.toggle('current', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      if (scrollIntoView) { const c = navList.querySelector('.ln-sub.current'); if (c && nav.scrollHeight > nav.clientHeight) c.scrollIntoView({ block: 'nearest' }); }
    }

    // ---------------------------------------------------------------- the main column
    const backSlot = h('div', { class: 'back-slot' });
    const viewSlot = h('div', { class: 'view-slot' });
    const main = h('section', { class: 'lmain', id: 'lmain' }, backSlot, viewSlot);
    el.append(bar, scrim, nav, main);

    function currentLabel() {
      const l = route.lesson ? lessonOf(route) : null;
      if (!l) return I18n.pick(Course.tab(TAB).title);
      if (route.sub === 'final') return labelOf(l) + ' · ' + t('learn.final');
      if (route.n) {
        const where = labelOf(l, route.n) + ' · ' + L(Course.subTitle(l.key, route.n));
        if (!Course.hasContent(qidOf(route))) return where;               // coming soon: no pages to number
        if (route.view === 'quiz') return where + ' · ' + t('quiz.title');
        const loaded = (window.ESP32TOUR_CONTENT || {})[qidOf(route)];
        return loaded && loaded.pages.length < 2 ? where : where + ' · ' + t('learn.page.short', { n: route.page });   // a one-page lesson has no page number
      }
      return labelOf(l) + ' · ' + L(l.title);
    }
    function drawBack() {
      const top = backStack[backStack.length - 1];
      backSlot.replaceChildren(top ? h('button', { class: 'back-btn', type: 'button', onclick: goBack },
        icon('corner-up-left'), h('span', null, t('learn.back.to', { where: top.label }))) : '');
    }
    function goBack() {
      const b = backStack.pop(); if (!b) return;
      pendingScroll = b.scroll;
      if (location.hash === b.hash) { drawBack(); window.scrollTo(0, b.scroll); pendingScroll = null; } else location.hash = b.hash;
    }
    function onChip(target) {
      const m = target.match(/^(t\d)\.(l\d\d)\.(s\d\d|final)(?:\/p(\d))?(?:#([a-z0-9-]+))?$/);
      if (!m) return;
      const to = '#/' + m[1] + '/' + m[2] + '/' + m[3] + (m[3] === 'final' ? '' : '/p' + (m[4] || 1) + (m[5] ? '/' + m[5] : ''));
      backStack.push({ hash: location.hash, scroll: window.scrollY, label: currentLabel() });
      if (location.hash === to) { drawBack(); scrollToSection(m[5]); } else location.hash = to;
    }
    const chipOpts = { onChip };

    function crumbs(l, n, extra) {
      const parts = [navLink({ href: href() }, I18n.pick(Course.tab(TAB).title))];
      if (l) parts.push(navLink({ href: lessonHref(l) }, labelOf(l) + ' ' + L(l.title)));
      if (l && n) parts.push(navLink({ href: subHref(l, n) }, labelOf(l, n)));
      if (extra) parts.push(h('span', { class: 'crumb-cur' }, extra));
      const out = [];
      parts.forEach((p, i) => { if (i) out.push(icon('chevron-right')); out.push(p); });
      return h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, out);
    }

    function firstToDo() {                                   // first sub-lesson with content that is not DONE yet
      const l = Course.lessonList.find((x) => x.tab === TAB);
      for (const lesson of Course.lessonList.filter((x) => x.tab === TAB)) {
        for (let n = 1; n <= lesson.subs; n++) {
          const qid = lesson.key + '.s' + pad(n);
          if (Course.hasContent(qid) && statusOf(qid) !== 'done') return { l: lesson, n, qid };
        }
      }
      return { l, n: 1, qid: l.key + '.s01' };
    }

    // ---------------------------------------------------------------- tab overview
    function tabView() {
      const a = Store.current(), s = Store.stats(a), tb = s.tabs[TAB];
      const f = firstToDo(), started = !!Object.keys(a.results).some((q) => q.startsWith(TAB + '.'));
      return h('div', { class: 'lview' },
        h('header', { class: 'lhero' },
          h('div', { class: 'lhero-text' }, h('h1', null, I18n.pick(Course.tab(TAB).title)), h('p', null, t(TAB === 't1' ? 'learn.tab.intro' : 'learn.tab.intro5')),
            h('div', { class: 'lhero-stats' }, h('span', { class: 'pill-soft' }, icon('graduation-cap'), t('dash.passed', { n: UI.fmt(tb.passed), m: UI.fmt(tb.quizzes) })))),
          h('div', { class: 'lhero-cta' }, h('p', { class: 'tiny' }, started ? t('learn.continue.text') : t('learn.start.text')),
            navLink({ class: 'btn primary', href: subHref(f.l, f.n) }, icon('rocket'), h('span', null, (started ? t('learn.continue') : t('learn.start')) + ' · ' + labelOf(f.l, f.n))))),
        h('div', { class: 'lcards' }, Course.lessonList.filter((l) => l.tab === TAB).map((l) => {
          const ls = s.lessons[l.key], pct = ls.subs ? (ls.subsDone / ls.subs) * 100 : 0;
          const avail = Array.from({ length: l.subs }, (_, i) => l.key + '.s' + pad(i + 1)).filter((q) => Course.hasContent(q)).length;
          return navLink({ class: 'lcard ' + ls.state, href: lessonHref(l) },
            h('div', { class: 'lesson-top' }, h('span', { class: 'lesson-num' }, labelOf(l)), h('span', { class: 'state-chip ' + ls.state }, t('dash.lesson.' + ls.state))),
            h('h3', null, L(l.title)),
            h('div', { class: 'bar thin' }, h('div', { class: 'bar-fill', style: { width: pct + '%' } })),
            h('div', { class: 'lesson-foot' }, h('span', null, t('learn.passed', { d: ls.subsDone, n: ls.subs })),
              h('span', { class: 'final-st' }, statusIcon(ls.final, 'lc:' + l.key, 18), h('span', null, t('learn.final')))),
            h('div', { class: 'lcard-ready' }, avail ? icon('check') : icon('hourglass'), h('span', null, avail ? t('learn.ready', { n: avail }) : t('learn.soon'))));
        })));
    }

    // ---------------------------------------------------------------- main-lesson overview
    function lessonView() {
      const l = lessonOf(route), a = Store.current(), ls = Store.stats(a).lessons[l.key];
      const pct = ls.subs ? (ls.subsDone / ls.subs) * 100 : 0;
      const cards = [];
      for (let n = 1; n <= l.subs; n++) {
        const qid = l.key + '.s' + pad(n), st = statusOf(qid), rec = resultOf(qid), has = Course.hasContent(qid);
        cards.push(navLink({ class: 'subcard st-' + st + (has ? '' : ' soon'), href: subHref(l, n) },
          h('span', { class: 'sc-top' }, h('span', { class: 'lesson-num' }, labelOf(l, n)), statusIcon(st, 'sc:' + qid, 20)),
          h('b', { class: 'sc-title' }, L(Course.subTitle(l.key, n))),
          h('span', { class: 'sc-foot' }, rec ? h('span', { class: 'sc-mark' }, t('learn.best', { a: rec.best, b: maxOf(qid) })) : null,
            has ? null : h('span', { class: 'soon-tag' }, icon('hourglass'), t('learn.soon')))));
      }
      const fq = l.key + '.final', frec = resultOf(fq);
      return h('div', { class: 'lview' }, crumbs(l),
        h('header', { class: 'lhead' }, h('span', { class: 'lesson-num big' }, labelOf(l)),
          h('div', { class: 'lhead-text' }, h('h1', null, L(l.title)),
            h('div', { class: 'lhead-meta' }, h('span', null, t('learn.passed', { d: ls.subsDone, n: ls.subs })),
              h('div', { class: 'bar thin grow' }, h('div', { class: 'bar-fill', style: { width: pct + '%' } }))))),
        h('div', { class: 'subgrid' }, cards,
          navLink({ class: 'subcard final st-' + ls.final + ' soon', href: href(l.key.split('.')[1], 'final') },
            h('span', { class: 'sc-top' }, h('span', { class: 'lesson-num' }, icon('flag')), statusIcon(ls.final, 'sc:' + fq, 20)),
            h('b', { class: 'sc-title' }, t('learn.final')),
            h('span', { class: 'sc-foot' }, h('span', { class: 'sc-mark' }, frec ? t('learn.best', { a: frec.best, b: maxOf(fq) }) : t('learn.final.q', { n: maxOf(fq) })),
              h('span', { class: 'soon-tag' }, icon('hourglass'), t('learn.soon'))))));
    }

    // ---------------------------------------------------------------- coming soon (no content written yet)
    function soonView() {
      const l = lessonOf(route), isFinal = route.sub === 'final';
      const f = firstToDo();
      return h('div', { class: 'lview' }, crumbs(l, isFinal ? 0 : route.n, isFinal ? t('learn.final') : null),
        h('section', { class: 'soon-card' },
          h('div', { class: 'big-icon' }, icon('construction')),
          h('span', { class: 'lesson-num' }, isFinal ? labelOf(l) + ' · ' + t('learn.final') : labelOf(l, route.n)),
          h('h1', null, isFinal ? t('learn.final') : L(Course.subTitle(l.key, route.n))),
          h('h2', { class: 'soon-h' }, t('learn.soon.title')),
          h('p', null, isFinal ? t('learn.soon.final') : t('learn.soon.text')),
          h('div', { class: 'actions center-actions' },
            navLink({ class: 'btn primary', href: subHref(f.l, f.n) }, icon('rocket'), h('span', null, t('learn.soon.open', { label: labelOf(f.l, f.n) + ' ' + L(Course.subTitle(f.l.key, f.n)) }))),
            navLink({ class: 'btn ghost', href: lessonHref(l) }, icon('list'), h('span', null, t('learn.back.overview'))))));
    }

    function loadingView() {
      return h('div', { class: 'lview' }, h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner' }), h('span', null, t('learn.loading'))));
    }
    function errorView() {
      return h('div', { class: 'lview' }, h('section', { class: 'soon-card' }, h('div', { class: 'big-icon' }, icon('circle-alert')),
        h('h2', null, t('learn.error')), h('p', null, t('learn.error.text')),
        h('div', { class: 'actions center-actions' }, button(t('learn.retry'), { icon: 'refresh-cw', onclick: () => render() }))));
    }

    // ---------------------------------------------------------------- a sub-lesson: lesson pages
    function subView(content) {
      const l = lessonOf(route), n = route.n, qid = qidOf(route), pages = content.pages, total = pages.length;
      let cur = -1;                                           // index of the page on screen (-1 before the first show)
      const st = statusOf(qid), rec = resultOf(qid);
      const stepper = h('nav', { class: 'stepper', 'aria-label': t('learn.pages') }, pages.map((p, i) =>
        h('a', { class: 'step-seg', href: subHref(l, n, i + 1), 'data-i': String(i), 'aria-label': t('learn.page', { n: i + 1, m: total }) + ': ' + L(p.title) },
          h('span', { class: 'step-n' }, String(i + 1)), h('span', { class: 'step-t' }, L(p.title)))));
      const stage = h('div', { class: 'page-stage' });
      const pager = h('div', { class: 'pager' });
      const goals = h('section', { class: 'goals' }, h('h3', null, icon('flag'), h('span', null, t('learn.goals'))),
        h('ul', null, (content.goals || []).map((g) => h('li', null, icon('check'), h('span', null, L(g))))));

      function pageEl(i) {
        const p = pages[i];
        return h('article', { class: 'lpage', 'aria-label': L(p.title) },
          h('h2', { class: 'lpage-title', tabindex: '-1' }, total > 1 ? h('span', { class: 'pg-n' }, t('learn.page', { n: i + 1, m: total })) : null, L(p.title)),
          p.blocks.map((b) => renderBlock(b, chipOpts)), sourcesBox(p.sources));
      }
      function drawPager() {
        const prev = cur > 0 ? h('a', { class: 'btn ghost', href: subHref(l, n, cur) }, icon('arrow-left'), h('span', null, t('learn.prev'))) : h('span');
        const last = cur === total - 1;
        const next = last
          ? h('a', { class: 'btn primary', href: href(l.key.split('.')[1], 's' + pad(n), 'quiz') }, icon('play'), h('span', null, rec ? t('learn.quiz.retake') : t('learn.quiz.start')))
          : h('a', { class: 'btn primary', href: subHref(l, n, cur + 2) }, h('span', null, t('learn.next')), icon('arrow-right'));
        // a one-page lesson has nothing to page through: only the button that leads to the quiz
        pager.replaceChildren(...(total > 1 ? [prev, h('span', { class: 'pager-mid' }, t('learn.page', { n: cur + 1, m: total })), next] : [h('span'), next]));
      }
      function show(i, section) {
        i = Math.max(0, Math.min(total - 1, i));
        if (i === cur) { if (section) scrollToSection(section); return; }
        const dir = i > cur ? 1 : -1, first = cur < 0;
        cur = i;
        const next = pageEl(i), old = stage.firstElementChild;
        if (first || reduced() || !old) stage.replaceChildren(next);
        else {
          old.classList.add('leave'); next.classList.add(dir > 0 ? 'in-fwd' : 'in-back'); stage.appendChild(next);
          setTimeout(() => { old.remove(); next.classList.remove('in-fwd', 'in-back'); }, 320);
        }
        stepper.querySelectorAll('.step-seg').forEach((a, k) => { a.classList.toggle('on', k === i); a.classList.toggle('past', k < i); if (k === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
        goals.style.display = i === 0 ? '' : 'none';
        drawPager();
        if (first) return;                                    // the first page is positioned by afterRender() once it is in the document
        if (section) scrollToSection(section);
        else if (pendingScroll == null) scrollToTop(head);
      }
      const head = h('header', { class: 'lhead' }, h('span', { class: 'lesson-num big' }, labelOf(l, n)),
        h('div', { class: 'lhead-text' }, h('h1', null, L(Course.subTitle(l.key, n))), h('p', { class: 'lsum' }, L(content.summary)),
          h('div', { class: 'lhead-meta' },
            h('span', { class: 'meta-chip' }, icon('file-text'), total === 1 ? t('learn.pages.one') : t('learn.pages.n', { n: total })),
            h('span', { class: 'meta-chip' }, icon('list-checks'), t('learn.questions.n', { n: maxOf(qid) })),
            h('span', { class: 'meta-chip st-' + st }, statusIcon(st, null, 16), rec ? t('learn.best', { a: rec.best, b: maxOf(qid) }) : t('status.new')),
            navLink({ class: 'link-btn', href: href(l.key.split('.')[1], 's' + pad(n), 'quiz') }, icon('play'), t('learn.skip.quiz')))));
      pageApi = { show };
      const view = h('div', { class: 'lview' }, crumbs(l, n), head, goals, total > 1 ? stepper : null, stage, pager);
      show(route.page - 1, route.section);
      return view;
    }

    // ---------------------------------------------------------------- the quiz page
    function quizView(content) {
      const l = lessonOf(route), n = route.n, qid = qidOf(route);
      quiz = Quiz.create({
        qid, label: labelOf(l, n), title: L(Course.subTitle(l.key, n)), questions: content.quiz.questions,
        hasNext: n < l.subs,
        onNext: () => { location.hash = subHref(l, n + 1); },
        onRetake: () => { render(); },
        onReview: () => { location.hash = subHref(l, n); },
        onList: () => { location.hash = lessonHref(l); },
        onExit: () => { location.hash = subHref(l, n); }
      });
      return h('div', { class: 'lview' }, crumbs(l, n, t('quiz.title')), quiz.el);
    }

    // ---------------------------------------------------------------- scrolling helpers
    function scrollToTop(target) {
      const r = target.getBoundingClientRect();
      if (r.top < 90 || r.top > window.innerHeight) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 120), behavior: reduced() ? 'auto' : 'smooth' });
    }
    function scrollToSection(id, instant) {
      if (!id) return;
      const target = main.querySelector('[data-sec="' + id + '"]');
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: reduced() || instant ? 'auto' : 'smooth' });
      target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
    }

    // ---------------------------------------------------------------- render
    function disposeQuiz() { if (quiz) { quiz.destroy(); quiz = null; } }
    function afterRender() {
      barLabel.textContent = currentLabel();
      document.title = currentLabel() + ' · ' + t('app.short');
      drawBack();
      markCurrent(true);
      if (pendingScroll != null) { const y = pendingScroll; pendingScroll = null; window.scrollTo(0, y); }
      else if (route.view === 'sub' && route.section) scrollToSection(route.section, true);   // arriving: jump, do not glide
      else window.scrollTo(0, 0);
    }
    function render() {
      disposeQuiz(); pageApi = null;
      const tk = ++token;
      if (route.view === 'tab') viewSlot.replaceChildren(tabView());
      else if (route.view === 'lesson') viewSlot.replaceChildren(lessonView());
      else {
        const qid = qidOf(route);
        if (route.sub === 'final' || !Course.hasContent(qid)) viewSlot.replaceChildren(soonView());
        else {
          viewSlot.replaceChildren(loadingView());
          loadContent(qid).then((c) => {
            if (tk !== token) return;
            viewSlot.replaceChildren(route.view === 'quiz' ? quizView(c) : subView(c));
            afterRender();
          }).catch(() => { if (tk === token) { viewSlot.replaceChildren(errorView()); afterRender(); } });
          barLabel.textContent = currentLabel(); drawBack(); markCurrent(true);
          return;
        }
      }
      afterRender();
    }

    function go(hash) {
      const r = parse(hash), prev = route;
      route = r;
      closeDrawer();
      const samePage = pageApi && prev.lesson === r.lesson && prev.sub === r.sub && prev.view === 'sub' && r.view === 'sub';
      if (samePage) {                                         // only the page or the section changed
        pageApi.show(r.page - 1, r.section);
        barLabel.textContent = currentLabel(); document.title = currentLabel() + ' · ' + t('app.short'); drawBack(); markCurrent(true);
        if (pendingScroll != null) { const y = pendingScroll; pendingScroll = null; window.scrollTo(0, y); }
        return;
      }
      render();
    }

    // the sticky lesson tabs sit just under the header, whatever its height is on this screen
    function syncTop() { const tb = document.querySelector('.topbar'); if (tb) el.style.setProperty('--nav-top', (tb.offsetHeight + 12) + 'px'); }
    window.addEventListener('resize', syncTop);
    syncTop();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncTop);

    drawNav();
    render();
    return {
      el, go, tab,
      update() {                                              // after a quiz result or a change of accounts
        drawNav();
        if (route.view === 'tab' || route.view === 'lesson') { const y = window.scrollY; viewSlot.replaceChildren(route.view === 'tab' ? tabView() : lessonView()); window.scrollTo(0, y); }
      },
      destroy() { token++; disposeQuiz(); window.removeEventListener('resize', syncTop); }
    };
  }

  window.Lessons = { mount, parse, TABS };
})();
