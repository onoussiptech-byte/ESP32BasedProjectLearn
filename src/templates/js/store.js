/* store.js - accounts, sessions, scoring and device-to-device carrying for ESP32 Tour.
 * Only Dashboard, Basic Concepts (t1) and FreeRTOS/Linking/PlatformIO (t2) exist, so every
 * quiz id, score, mark and percentage is derived from those tabs in course.js. */
(function () {
  'use strict';

  const LS_DB = 'esp32tour.db.v1', LS_SESSION = 'esp32tour.session', LS_THROTTLE = 'esp32tour.throttle';
  const PW_ITER = 100000, REC_ITER = 20000, ATTEMPT_CAP = 300;
  const COURSE = window.ESP32TOUR_COURSE;
  const RULES = COURSE.rules, VERSION = COURSE.app.version;

  // ------------------------------------------------------------------ course helpers
  const quizzes = [];                       // every quiz of tabs t1 and t2
  const quizById = {};
  const lessonList = [];                    // {key:'t1.l01', tab, num, title, subs}
  COURSE.tabs.filter((tb) => tb.lessons).forEach((tb) => {
    tb.lessons.forEach((ls, li) => {
      const key = tb.id + '.' + ls.id;
      lessonList.push({ key, tab: tb.id, num: li + 1, title: ls.title, subs: ls.subs, subTitles: ls.sub_titles || null });
      for (let s = 1; s <= ls.subs; s++) {
        const q = { qid: key + '.s' + String(s).padStart(2, '0'), tab: tb.id, lesson: key, kind: 'sub', n: s,
          max: RULES.sub_quiz.questions };
        quizzes.push(q); quizById[q.qid] = q;
      }
      const f = { qid: key + '.final', tab: tb.id, lesson: key, kind: 'final', n: 0, max: RULES.final_quiz.questions };
      quizzes.push(f); quizById[f.qid] = f;
    });
  });

  // FAILED / TO DO / DONE are decided from the BEST mark of a quiz
  function statusOf(kind, best) {
    if (best == null) return 'new';
    const r = kind === 'final' ? RULES.final_quiz : RULES.sub_quiz;
    if (best <= r.failed_max) return 'failed';
    if (best <= r.todo_max) return 'todo';
    return 'done';
  }

  const available = new Set(COURSE.available || []);   // quiz ids whose lesson content exists (t1.l01.s01 ...)

  const Course = {
    quizzes, quizById, lessonList, statusOf, available,
    tabs: COURSE.tabs, rules: RULES,
    tab: (id) => COURSE.tabs.find((tb) => tb.id === id),
    lesson: (key) => lessonList.find((l) => l.key === key),
    hasContent: (qid) => available.has(qid),
    // Title of sub-lesson n (1-based) of a lesson; falls back to "Sub-lesson n" when none is written
    subTitle(key, n) {
      const l = lessonList.find((x) => x.key === key);
      return l && l.subTitles && l.subTitles[n - 1] ? l.subTitles[n - 1] : { en: 'Sub-lesson ' + n, fr: 'Sous-leçon ' + n };
    },
    ranges(kind) {
      const r = kind === 'final' ? RULES.final_quiz : RULES.sub_quiz, max = r.questions;
      return { failed: [0, r.failed_max], todo: [r.failed_max + 1, r.todo_max], done: [r.done_min, max] };
    },
    maxScore: quizzes.reduce((a, q) => a + q.max, 0)
  };

  // ------------------------------------------------------------------ persistence
  const listeners = [];
  let db = { format: 1, accounts: [], deleted: [] };
  let sessionUid = null;
  let folderFile = null, folderTimer = null;
  let storageOk = true;
  let loadedVersionNote = null;

  const readLS = (k) => { try { return localStorage.getItem(k); } catch (e) { storageOk = false; return null; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { storageOk = false; return false; } };
  const delLS = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  const emit = (what) => listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } });
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function persist() {
    writeLS(LS_DB, JSON.stringify(db));
    if (folderFile) {
      clearTimeout(folderTimer);
      folderTimer = setTimeout(() => writeFolder().catch(() => { folderFile = null; }), 400);
    }
  }

  function validAccount(a) {
    return a && typeof a === 'object' && typeof a.uid === 'string' && typeof a.id === 'string' &&
      typeof a.first === 'string' && typeof a.last === 'string' && typeof a.salt === 'string' &&
      typeof a.hash === 'string' && typeof a.iter === 'number';
  }

  function normalise(a) {
    a.results = a.results && typeof a.results === 'object' ? a.results : {};
    a.attempts = Array.isArray(a.attempts) ? a.attempts : [];
    a.lang = a.lang === 'fr' ? 'fr' : 'en';
    a.theme = ['auto', 'light', 'dark'].includes(a.theme) ? a.theme : 'auto';
    a.pwdAt = a.pwdAt || 0; a.prefAt = a.prefAt || 0;
    return a;
  }

  function mergeAccount(loc, inc) {
    Object.keys(inc.results || {}).forEach((q) => {
      const l = loc.results[q], i = inc.results[q];
      if (!quizById[q] || !i) return;
      if (!l) { loc.results[q] = { ...i }; return; }
      l.best = Math.max(l.best, i.best);                       // best never goes down
      if ((i.at || 0) > (l.at || 0)) { l.latest = i.latest; l.at = i.at; }   // latest = most recent
      l.n = Math.max(l.n || 0, i.n || 0);
    });
    const seen = new Set(loc.attempts.map((x) => x.q + '|' + x.at));
    (inc.attempts || []).forEach((x) => { if (!seen.has(x.q + '|' + x.at)) loc.attempts.push(x); });
    loc.attempts.sort((x, y) => x.at - y.at);
    if (loc.attempts.length > ATTEMPT_CAP) loc.attempts = loc.attempts.slice(-ATTEMPT_CAP);
    if ((inc.pwdAt || 0) > (loc.pwdAt || 0)) {                  // most recent password change wins
      Object.assign(loc, { salt: inc.salt, hash: inc.hash, iter: inc.iter, rec: inc.rec, pwdAt: inc.pwdAt });
    }
    if ((inc.prefAt || 0) > (loc.prefAt || 0)) Object.assign(loc, { lang: inc.lang, theme: inc.theme, prefAt: inc.prefAt });
  }

  // Merge accounts from a file (copied folder or exported file) into this device
  function mergeIn(data) {
    const r = { added: 0, merged: 0, conflicts: 0 };
    const gone = new Set(db.deleted);
    (data.deleted || []).forEach((u) => { if (!gone.has(u)) { db.deleted.push(u); gone.add(u); } });
    db.accounts = db.accounts.filter((a) => !gone.has(a.uid));
    (data.accounts || []).filter(validAccount).forEach((inc) => {
      if (gone.has(inc.uid)) return;
      const loc = db.accounts.find((a) => a.uid === inc.uid);
      if (loc) { mergeAccount(loc, normalise(clone(inc))); r.merged++; return; }
      const copy = normalise(clone(inc));
      if (db.accounts.some((a) => a.id.toLowerCase() === copy.id.toLowerCase())) { copy.needsNewId = true; r.conflicts++; }
      db.accounts.push(copy); r.added++;
    });
    return r;
  }

  function dataObject() {
    return { format: 1, app: VERSION, savedAt: Date.now(), accounts: db.accounts, deleted: db.deleted };
  }
  // "<" is escaped so typed names can never end an inline script block in the single-file copy
  const dataFileText = () => 'window.ESP32TOUR_DATA=' + JSON.stringify(dataObject()).replace(/</g, '\\u003c') + ';\n';

  function parseDataText(text) {
    let s = String(text).trim();
    s = s.replace(/^window\.ESP32TOUR_DATA\s*=\s*/, '').replace(/;\s*$/, '');
    const o = JSON.parse(s);
    if (!o || !Array.isArray(o.accounts)) throw new Error('bad file');
    return o;
  }

  async function writeFolder() {
    const w = await folderFile.createWritable();
    await w.write(dataFileText());
    await w.close();
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ------------------------------------------------------------------ validation + throttling
  const ID_RE = /^[A-Za-z0-9._-]{3,24}$/;
  const norm = (s) => String(s || '').trim();
  const byId = (id) => db.accounts.filter((a) => a.id.toLowerCase() === norm(id).toLowerCase());

  function throttleState() { try { return JSON.parse(readLS(LS_THROTTLE) || '{}'); } catch (e) { return {}; } }
  function waitSeconds(id) {
    const e = throttleState()[norm(id).toLowerCase()];
    return e && e.until > Date.now() ? Math.ceil((e.until - Date.now()) / 1000) : 0;
  }
  function recordFailure(id) {
    const st = throttleState(), k = norm(id).toLowerCase(), e = st[k] || { n: 0, until: 0 };
    e.n += 1;
    if (e.n >= 3) e.until = Date.now() + Math.min(60, Math.pow(2, e.n - 2)) * 1000;
    st[k] = e; writeLS(LS_THROTTLE, JSON.stringify(st));
  }
  function clearFailures(id) {
    const st = throttleState(); delete st[norm(id).toLowerCase()]; writeLS(LS_THROTTLE, JSON.stringify(st));
  }

  async function verify(acc, password) {
    return (await CryptoX.derive(password, acc.salt, acc.iter)) === acc.hash;
  }

  // The unique-password rule: true when ANY other account already uses this password
  async function passwordInUse(password, exceptUid) {
    for (const a of db.accounts) {
      if (a.uid !== exceptUid && await verify(a, password)) return true;
    }
    return false;
  }

  async function setPassword(acc, password) {
    acc.salt = CryptoX.randomHex(16); acc.iter = PW_ITER;
    acc.hash = await CryptoX.derive(password, acc.salt, PW_ITER);
    acc.pwdAt = Date.now();
  }

  async function newRecovery(acc) {
    const code = CryptoX.recoveryCode();
    const salt = CryptoX.randomHex(16);
    acc.rec = { salt, iter: REC_ITER, hash: await CryptoX.derive(code.replace(/-/g, ''), salt, REC_ITER) };
    return code;
  }

  // ------------------------------------------------------------------ public store
  const Store = {
    Course, VERSION, PW_MIN: RULES.password_min || 4,
    get storageOk() { return storageOk; },
    get versionNote() { return loadedVersionNote; },
    on(fn) { listeners.push(fn); },

    init() {
      try { const raw = readLS(LS_DB); if (raw) { const o = JSON.parse(raw); if (o && Array.isArray(o.accounts)) db = { format: 1, accounts: o.accounts, deleted: o.deleted || [] }; } }
      catch (e) { console.warn('stored accounts unreadable', e); }
      db.accounts.forEach(normalise);
      const file = window.ESP32TOUR_DATA;
      this.foundFromFile = 0;
      if (file && Array.isArray(file.accounts) && file.accounts.length) {
        const before = db.accounts.length;
        mergeIn(file);
        this.foundFromFile = db.accounts.length - before;
        if (file.app && file.app !== VERSION) loadedVersionNote = file.app;
      }
      persist();
      let uid = null;
      try { uid = sessionStorage.getItem(LS_SESSION); } catch (e) { /* ignore */ }
      if (!uid) uid = readLS(LS_SESSION);
      sessionUid = db.accounts.some((a) => a.uid === uid) ? uid : null;
    },

    accounts: () => db.accounts.slice(),
    hasAccounts: () => db.accounts.length > 0,
    current: () => db.accounts.find((a) => a.uid === sessionUid) || null,
    findById: (id) => byId(id),
    validateId(id) { const v = norm(id); if (!v) return 'err.required'; return ID_RE.test(v) ? null : 'err.id.format'; },
    idTaken(id, exceptUid) { return byId(id).some((a) => a.uid !== exceptUid); },
    waitSeconds, passwordInUse,

    async createAccount({ id, first, last, password, lang }) {
      const acc = normalise({
        uid: CryptoX.randomHex(12), id: norm(id), first: norm(first), last: norm(last),
        created: Date.now(), lang: lang || 'en', theme: 'auto', results: {}, attempts: []
      });
      await setPassword(acc, password);
      const code = await newRecovery(acc);
      db.accounts.push(acc); persist(); emit('accounts');
      return { account: acc, recovery: code };
    },

    startSession(uid, keep) {
      sessionUid = uid;
      try { sessionStorage.setItem(LS_SESSION, uid); } catch (e) { /* ignore */ }
      if (keep) writeLS(LS_SESSION, uid); else delLS(LS_SESSION);
      const acc = this.current();
      if (acc) I18n.set(acc.lang);
      emit('session');
    },

    async signIn(id, password) {
      const wait = waitSeconds(id);
      if (wait) return { ok: false, err: 'err.wait', vars: { s: wait } };
      for (const a of byId(id)) {
        if (await verify(a, password)) { clearFailures(id); return { ok: true, account: a }; }
      }
      recordFailure(id);
      const w2 = waitSeconds(id);
      return w2 ? { ok: false, err: 'err.wait', vars: { s: w2 } } : { ok: false, err: 'err.login' };
    },

    async verifyAccount(uid, password) {
      const a = db.accounts.find((x) => x.uid === uid);
      if (!a) return false;
      const wait = waitSeconds(a.id);
      if (wait) return { wait };
      const ok = await verify(a, password);
      if (ok) clearFailures(a.id); else recordFailure(a.id);
      return ok;
    },

    signOut() {
      sessionUid = null;
      try { sessionStorage.removeItem(LS_SESSION); } catch (e) { /* ignore */ }
      delLS(LS_SESSION);
      emit('session');
    },

    async changePassword(uid, oldPw, newPw) {
      const a = db.accounts.find((x) => x.uid === uid);
      if (!a || !(await verify(a, oldPw))) return { ok: false, err: 'err.pw.old' };
      if (await passwordInUse(newPw, uid)) return { ok: false, err: 'err.pw.used' };
      await setPassword(a, newPw); persist(); emit('accounts');
      return { ok: true };
    },

    async resetWithRecovery(id, code, newPw) {
      const wait = waitSeconds(id);
      if (wait) return { ok: false, err: 'err.wait', vars: { s: wait } };
      const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      for (const a of byId(id)) {
        if (a.rec && (await CryptoX.derive(clean, a.rec.salt, a.rec.iter)) === a.rec.hash) {
          if (await passwordInUse(newPw, a.uid)) return { ok: false, err: 'err.pw.used' };
          await setPassword(a, newPw);
          const fresh = await newRecovery(a);
          clearFailures(id); persist(); emit('accounts');
          return { ok: true, account: a, recovery: fresh };
        }
      }
      recordFailure(id);
      return { ok: false, err: 'err.recovery' };
    },

    async deleteAccount(uid, password) {
      const a = db.accounts.find((x) => x.uid === uid);
      if (!a || !(await verify(a, password))) return { ok: false, err: 'err.pw.old' };
      db.accounts = db.accounts.filter((x) => x.uid !== uid);
      if (!db.deleted.includes(uid)) db.deleted.push(uid);
      persist();
      if (sessionUid === uid) this.signOut(); else emit('accounts');
      return { ok: true };
    },

    changeId(uid, newId) {
      const a = db.accounts.find((x) => x.uid === uid);
      const bad = this.validateId(newId);
      if (bad) return { ok: false, err: bad };
      if (this.idTaken(newId, uid)) return { ok: false, err: 'err.id.taken' };
      a.id = norm(newId); delete a.needsNewId; persist(); emit('accounts');
      return { ok: true };
    },

    setPrefs(uid, patch) {
      const a = db.accounts.find((x) => x.uid === uid);
      if (!a) return;
      Object.assign(a, patch); a.prefAt = Date.now();
      persist(); emit('prefs');
    },

    /* Record a finished quiz attempt. mark = number of correct answers.
       Score uses the BEST mark per quiz; Total mark uses the LATEST mark per quiz. */
    recordAttempt(uid, qid, mark) {
      const a = db.accounts.find((x) => x.uid === uid), q = quizById[qid];
      if (!a || !q || !Number.isInteger(mark) || mark < 0 || mark > q.max) return null;
      const before = this.stats(a);
      const r = a.results[qid] || { best: -1, latest: 0, n: 0, at: 0 };
      const prevStatus = statusOf(q.kind, r.best < 0 ? null : r.best);
      r.n += 1; r.at = Date.now(); r.latest = mark; r.best = Math.max(r.best, mark);
      a.results[qid] = r;
      a.attempts.push({ q: qid, m: mark, at: r.at });
      if (a.attempts.length > ATTEMPT_CAP) a.attempts = a.attempts.slice(-ATTEMPT_CAP);
      persist();
      const after = this.stats(a);
      emit('results');
      return {
        qid, mark, max: q.max, best: r.best, status: statusOf(q.kind, r.best), prevStatus,
        scoreDelta: after.total.score - before.total.score,
        markDelta: after.total.mark - before.total.mark
      };
    },

    /* Everything the header and Dashboard show, for one account */
    stats(acc) {
      const blank = () => ({ quizzes: 0, passed: 0, score: 0, mark: 0, max: 0, counts: { new: 0, todo: 0, failed: 0, done: 0 } });
      const out = { total: blank(), tabs: {}, lessons: {} };
      COURSE.tabs.filter((tb) => tb.lessons).forEach((tb) => { out.tabs[tb.id] = blank(); });
      lessonList.forEach((l) => { out.lessons[l.key] = { subs: l.subs, subsDone: 0, final: 'new', started: false, state: 'new' }; });
      quizzes.forEach((q) => {
        const res = acc && acc.results[q.qid];
        const st = statusOf(q.kind, res ? res.best : null);
        [out.total, out.tabs[q.tab]].forEach((b) => {
          b.quizzes++; b.max += q.max; b.counts[st]++;
          if (st === 'done') b.passed++;
          if (res) { b.score += res.best; b.mark += res.latest; }
        });
        const ls = out.lessons[q.lesson];
        if (res) ls.started = true;
        if (q.kind === 'sub' && st === 'done') ls.subsDone++;
        if (q.kind === 'final') ls.final = st;
      });
      Object.values(out.lessons).forEach((ls) => {
        ls.state = (ls.subsDone === ls.subs && ls.final === 'done') ? 'done' : ls.started ? 'progress' : 'new';
      });
      const pct = (b) => (b.quizzes ? (b.passed / b.quizzes) * 100 : 0);
      out.total.pct = pct(out.total);
      Object.values(out.tabs).forEach((b) => { b.pct = pct(b); });
      return out;
    },

    // ---- moving between devices
    exportText: dataFileText,
    exportDownload() { download('accounts.js', dataFileText()); },
    importText(text) {
      const data = parseDataText(text);
      const r = mergeIn(data);
      db.accounts.forEach(normalise);
      persist(); emit('accounts');
      return r;
    },
    get folderLinked() { return !!folderFile; },
    async saveToFolder() {
      if (!window.showDirectoryPicker) { download('accounts.js', dataFileText()); return 'download'; }
      try {
        const root = await window.showDirectoryPicker({ mode: 'readwrite' });
        const dir = await root.getDirectoryHandle('data', { create: true });
        folderFile = await dir.getFileHandle('accounts.js', { create: true });
        await writeFolder();
        return 'linked';
      } catch (e) {
        folderFile = null;
        return e && e.name === 'AbortError' ? 'cancel' : 'error';
      }
    },
    downloadAccountsFile() { download('accounts.js', dataFileText()); }
  };

  window.Store = Store;
  window.Course = Course;
})();
