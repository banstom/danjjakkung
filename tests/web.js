// node tests/web.js <shots-dir>
// 사이트판을 http로 띄우고, Firebase 대신 가짜(메모리) 로그인 · 저장소를 끼워서 두 사람 흐름을 확인한다.
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const OUT = process.argv[2] || '/tmp/shots';
const ROOT = path.join(__dirname, '..');
const PORT = 8766;
const URL = `http://127.0.0.1:${PORT}/`;
const ALLOWED = ['junmin@example.com', 'dajin@example.com']; // 규칙에 넣을 두 이메일 흉내

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => server.kill());

// ── 공용 가짜 저장소 (node 쪽) ──
const docs = new Map();
let failPlaces = false; // true 면 다음 places 저장 한 번을 실패시킨다
const aiReplies = [], aiCalls = []; // 단짝 식탁 AI(parseMeal) 가짜 답 · 받은 요청
const accounts = new Map(); // email → { uid, password }
const pages = [];
async function pushAll(changed) {
  const snap = JSON.stringify([...docs.entries()]);
  for (const p of pages) await p.evaluate(([s, c]) => window.__push && window.__push(s, c), [snap, changed]).catch(() => {});
}

// ── 페이지 안: firebase compat 흉내 ──
const FAKE_FIREBASE = `
(function () {
  var local = new Map(), docL = new Set(), colL = new Set();
  var user = null, authCbs = [];
  try { var saved = localStorage.getItem('fake.user'); if (saved) user = JSON.parse(saved); } catch (e) {}
  function snapDoc(p) { return { id: p.split('/').pop(), exists: local.has(p), data: function () { return local.get(p); } }; }
  function allowed() { return user && user.emailVerified && ${JSON.stringify(ALLOWED)}.indexOf(user.email) >= 0; }
  function denied() { return { code: 'permission-denied', message: 'denied' }; }
  window.__colCount = function () { return colL.size; }; // 지도를 닫으면 places 구독이 끊기는지 보려고
  window.__push = function (s, changed) {
    local = new Map(JSON.parse(s));
    docL.forEach(function (f) { f(); });
    colL.forEach(function (f) { f(changed); });
  };
  function toCode(e) { var m = new RegExp('auth/[a-z-]+').exec(String(e && e.message)); throw { code: m ? m[0] : 'unknown' }; }
  function setAuth(u) {
    user = u;
    try { if (u) localStorage.setItem('fake.user', JSON.stringify(u)); else localStorage.removeItem('fake.user'); } catch (e) {}
    authCbs.forEach(function (cb) { setTimeout(function () { cb(user); }, 0); });
  }
  function verifiedFlag(u) { return !!(u && u.emailVerified); }
  var auth = {
    onAuthStateChanged: function (cb) { authCbs.push(cb); setTimeout(function () { cb(user); }, 20); return function () {}; },
    setPersistence: function () { return Promise.resolve(); },
    signInWithEmailAndPassword: function (e, p) { return window.__auth('in', e, p).then(function (u) { setAuth(u); return { user: u }; }, toCode); },
    createUserWithEmailAndPassword: function (e, p) { return window.__auth('up', e, p).then(function (u) { setAuth(u); return { user: u }; }, toCode); },
    sendPasswordResetEmail: function () { return Promise.resolve(); },
    signOut: function () { setAuth(null); return Promise.resolve(); },
    get currentUser() {
      if (!user) return null;
      return {
        emailVerified: verifiedFlag(user),
        sendEmailVerification: function () { window.__sentVerify = (window.__sentVerify || 0) + 1; return Promise.resolve(); },
        reload: function () { return window.__isVerified(user.email).then(function (v) { user.emailVerified = v; try { localStorage.setItem('fake.user', JSON.stringify(user)); } catch (e) {} }); },
        getIdToken: function () { return Promise.resolve('t'); }
      };
    }
  };
  // 컬렉션 · 조건(where == >= <) · 정렬(orderBy) · 개수(limit) — Firestore 처럼 그 칸이 없는 문서는 조건에서 빠진다
  function query(c, filters, order, lim) {
    function match(k) {
      if (k.indexOf(c + '/') !== 0 || k.split('/').length !== 2) return false;
      var v = local.get(k);
      return filters.every(function (f) {
        if (!(f[0] in v) || v[f[0]] === null && f[1] !== '==') return false;
        var a = v[f[0]], b = f[2];
        return f[1] === '==' ? a === b : f[1] === '>=' ? a >= b : f[1] === '<' ? a < b : false;
      });
    }
    function keys() {
      var ks = Array.from(local.keys()).filter(match).sort();
      if (order) ks.sort(function (x, y) { var a = local.get(x)[order[0]], b = local.get(y)[order[0]]; var r = a < b ? -1 : a > b ? 1 : 0; return order[1] === 'desc' ? -r : r; });
      return lim ? ks.slice(0, lim) : ks;
    }
    function snap(changed) {
      var ks = keys(), list = ks.map(snapDoc);
      var ch = (changed || []).filter(function (k) { return ks.indexOf(k) >= 0; }).map(function (k) { return { type: 'added', doc: snapDoc(k) }; });
      return { docs: list, size: list.length, empty: !list.length, docChanges: function () { return ch; }, metadata: { fromCache: false } };
    }
    return {
      where: function (f, op, v) { return query(c, filters.concat([[f, op, v]]), order, lim); },
      orderBy: function (f, dir) { return query(c, filters, [f, dir || 'asc'], lim); },
      limit: function (n) { return query(c, filters, order, n); },
      get: function () { if (!allowed()) return Promise.reject(denied()); window.__reads = (window.__reads || 0) + keys().length; return Promise.resolve(snap([])); },
      onSnapshot: function (x, y, z) {
        // (x, y, z): 옵션을 먼저 받는 형태도 지원
        var next = typeof x === 'function' ? x : y, err = typeof x === 'function' ? y : z;
        if (!allowed()) { setTimeout(function () { err && err(denied()); }, 10); return function () {}; }
        var f = function (changed) { next(snap(changed)); };
        colL.add(f); window.__hello(); return function () { colL.delete(f); };
      }
    };
  }
  var db = {
    enablePersistence: function () { return Promise.resolve(); },
    terminate: function () { return Promise.resolve(); },
    clearPersistence: function () { return Promise.resolve(); },
    doc: function (p) {
      return {
        set: function (v, o) { if (!allowed()) return Promise.reject(denied());
          // mergeFields: 적힌 칸만 통째로 바꾸고 나머지 칸은 그대로 (Firestore와 같게)
          if (o && o.merge) v = Object.assign({}, local.get(p) || {}, v); // merge: 적은 칸만 덮음
          if (o && o.mergeFields) { var base = Object.assign({}, local.get(p) || {}); o.mergeFields.forEach(function (k) { if (k in v) base[k] = v[k]; else delete base[k]; }); v = base; }
          return window.__set(p, JSON.stringify(v), user.uid); },
        delete: function () { if (!allowed()) return Promise.reject(denied()); return window.__set(p, null, user.uid); },
        // update: 'ui.<uid>' 처럼 점으로 이은 칸도 그 안만 바꾼다 (Firestore와 같게), 없는 문서는 실패
        update: function (patch) { if (!allowed()) return Promise.reject(denied());
          if (!local.has(p)) return Promise.reject({ code: 'not-found' });
          var base = JSON.parse(JSON.stringify(local.get(p)));
          Object.keys(patch).forEach(function (k) { var parts = k.split('.'), o = base; for (var i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== 'object' || !o[parts[i]]) o[parts[i]] = {}; o = o[parts[i]]; } o[parts[parts.length - 1]] = patch[k]; });
          return window.__set(p, JSON.stringify(base), user.uid); },
        onSnapshot: function (x, y, z) { var next = typeof x === 'function' ? x : y, err = typeof x === 'function' ? y : z; if (!allowed()) { setTimeout(function () { err && err(denied()); }, 10); return function () {}; }
          var f = function () { next(snapDoc(p)); }; docL.add(f); window.__hello(); return function () { docL.delete(f); }; },
        get: function () { if (!allowed()) return Promise.reject(denied()); return Promise.resolve(snapDoc(p)); },
        path: p
      };
    },
    // 일괄 쓰기 흉내 (가고 싶은 곳 순위 다시 매기기)
    batch: function () { var ops = []; return { update: function (ref, patch) { ops.push(function () { return ref.update(patch); }); }, set: function (ref, v, o) { ops.push(function () { return ref.set(v, o); }); },
      commit: function () { window.__batches = (window.__batches || 0) + 1; return ops.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); } }; },
    // 트랜잭션 흉내: 읽고 → set 한 번 (실제처럼 다시 시도는 하지 않음)
    runTransaction: function (fn) {
      var writes = [];
      var tx = { get: function (ref) { return ref.get(); }, set: function (ref, v) { writes.push([ref, v]); } };
      return Promise.resolve(fn(tx)).then(function (r) { return Promise.all(writes.map(function (w) { return w[0].set(w[1]); })).then(function () { return r; }); });
    },
    collection: function (c) { return query(c, [], null, 0); }
  };
  var fb = { initializeApp: function () {}, auth: function () { return auth; }, firestore: function () { return db; } };
  fb.auth.Auth = { Persistence: { LOCAL: 'local' } };
  window.firebase = fb;
})();`;

// 가짜 푸시(FCM): 토큰을 바로 돌려주고, 앞에 떠 있을 때 받는 알림을 흉내 낸다
const FAKE_MESSAGING = `
(function () {
  var m = {
    getToken: function () { var u = JSON.parse(localStorage.getItem('fake.user') || '{}'); return Promise.resolve('tok-' + (u.uid || 'x')); },
    deleteToken: function () { return Promise.resolve(true); },
    onMessage: function (cb) { window.__fg = cb; }
  };
  window.firebase.messaging = function () { return m; };
  window.firebase.messaging.isSupported = function () { return true; };
})();`;
// 서비스 워커 없이도 알림 켜기 흐름을 볼 수 있게 등록만 흉내 낸다
// (헤드리스 크롬은 알림 권한을 늘 'denied'로 보고하므로 허용 창도 흉내 낸다)
const FAKE_SW = `Object.defineProperty(navigator, 'serviceWorker', { value: { register: function () { return Promise.resolve({}); }, ready: Promise.resolve({}) } });
  (function () { var perm = 'default'; function N() {} Object.defineProperty(N, 'permission', { get: function () { return perm; } });
    N.requestPermission = function () { window.__asked = (window.__asked || 0) + 1; perm = 'granted'; return Promise.resolve('granted'); }; window.Notification = N; })();`;

// v47: 알림 · 테마 · 계정은 「전체」 탭 설정 줄에 있다
async function toAll(p) {
  await p.waitForSelector('.tabbar');
  await p.click('[data-act="tab"][data-tab="all"]');
  await p.waitForSelector('.all');
}
async function openSet(p, act) { await toAll(p); await p.click(`[data-act="${act}"]`); }

async function open(browser, name, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Seoul', serviceWorkers: opts.sw ? 'allow' : 'block', userAgent: opts.ua });
  if (opts.push) await ctx.grantPermissions(['notifications']);
  const page = await ctx.newPage();
  if (opts.push) await page.addInitScript(FAKE_SW);
  if (opts.user) await page.addInitScript((u) => localStorage.setItem('fake.user', u), JSON.stringify(opts.user));
  page.on('pageerror', (e) => console.log(name, 'PAGE ERROR', e.message));
  await page.clock.install({ time: new Date('2026-10-27T21:00:00+09:00') });
  await page.route('**/vendor/firebase/firebase-app-compat.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_FIREBASE }));
  await page.route('**/vendor/firebase/firebase-auth-compat.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route('**/vendor/firebase/firebase-firestore-compat.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route('**/vendor/firebase/firebase-messaging-compat.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_MESSAGING }));
  await page.route('**/js/firebase-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.DANJJAKKUNG_FIREBASE_CONFIG={apiKey:"test"};window.DANJJAKKUNG_PUSH_READY=true;' }));
  await page.route(/cloudfunctions\.net\/parseMeal/, async (r) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(r.request().postData() || '{}'); aiCalls.push({ data: body.data, auth: r.request().headers().authorization });
    const rep = aiReplies.shift() || { status: 503, body: { error: { status: 'UNAVAILABLE', message: 'x' } } };
    if (rep.delay) await new Promise((ok) => setTimeout(ok, rep.delay));
    return r.fulfill({ status: rep.status || 200, headers: cors, contentType: 'application/json', body: JSON.stringify(rep.body) });
  });
  await page.exposeFunction('__set', async (p, v, uid) => {
    // 규칙 흉내: 루틴 · 체크는 자기 것만
    const d = v === null ? null : JSON.parse(v);
    if (p.startsWith('routines/')) { const old = docs.get(p); if ((old && old.owner !== uid) || (d && d.owner !== uid)) throw new Error('permission-denied'); }
    if (p.startsWith('users/') && p.split('/')[1] !== uid) throw new Error('permission-denied');
    // 할 일: 함께 것은 둘 다, 각자 것은 본인만 / 일정: 내 것 · 함께 것만
    if (p.startsWith('todos/')) { const old = docs.get(p); const sc = (old || d).scope; if (sc !== 'together' && sc !== uid) throw new Error('permission-denied'); if (d && old && d.scope !== old.scope) throw new Error('permission-denied');
      // ui: 내 칸만 바꿀 수 있다
      if (d) { const nu = d.ui || {}, ou = (old && old.ui) || {}; for (const k of new Set([...Object.keys(nu), ...Object.keys(ou)])) if (k !== uid && JSON.stringify(nu[k]) !== JSON.stringify(ou[k])) throw new Error('permission-denied'); } }
    if (p.startsWith('uiLog/')) { if (!d || d.by !== uid || docs.has(p)) throw new Error('permission-denied'); }
    if (p.startsWith('kungs/')) { if (!d || d.from !== uid || docs.has(p) || p !== 'kungs/' + d.date + '_' + uid) throw new Error('permission-denied'); }
    // 단짝 지도 (v48 · v54): 지우기 없음, 기록(entries)은 내 칸만, 가장 이른 방문 ≥ 단짝이 된 날
    // 단짝 식탁: 몸 정보 · 목표는 자기 것만 쓸 수 있다
    if ((p.startsWith('private/') || p.startsWith('goals/')) && p.split('/')[1] !== uid) throw new Error('permission-denied');
    // 규칙 흉내: goals 는 정해진 칸 · 숫자 범위 (validGoal), private 는 정해진 칸 · 몸 정보 범위 (validBody)
    if (p.startsWith('goals/') && d) { const ok = Object.keys(d).every((k) => ['kind', 'kcal', 'carb', 'protein', 'fat', 'edited', 'retune', 'updatedAt'].includes(k)) && ['cut', 'keep', 'bulk'].includes(d.kind)
        && [['kcal', 10000], ['carb', 2000], ['protein', 1000], ['fat', 1000]].every(([k, hi]) => typeof d[k] === 'number' && isFinite(d[k]) && d[k] >= 0 && d[k] <= hi) && typeof d.edited === 'boolean' && typeof d.retune === 'boolean';
      if (!ok) throw new Error('permission-denied'); }
    if (p.startsWith('private/') && d && p.split('/').length === 2) { const ok = Object.keys(d).every((k) => ['body', 'suggested', 'edits', 'ackAt', 'updatedAt'].includes(k))
        && (!d.body || (d.body.age >= 1 && d.body.heightCm >= 50 && d.body.weightKg >= 10 && ['m', 'f'].includes(d.body.sex))) && (!d.edits || Object.values(d.edits).every((x) => typeof x === 'number' && isFinite(x)));
      if (!ok) throw new Error('permission-denied'); }
    // 단짝 식탁 D3: 하루 기록은 자기 것만 (meals/<uid>_<날짜>, 정해진 칸 · 20끼까지)
    if (p.startsWith('meals/')) { if (p.split('/')[1].split('_')[0] !== uid) throw new Error('permission-denied');
      if (d && !(Object.keys(d).every((k) => ['uid', 'date', 'meals', 'updatedAt'].includes(k)) && d.uid === uid && p === 'meals/' + uid + '_' + d.date && Array.isArray(d.meals) && d.meals.length <= 20)) throw new Error('permission-denied'); }
    if (p.startsWith('places/') && failPlaces) { failPlaces = false; throw new Error('unavailable'); } // 저장 실패 흉내 (한 번)
    if (p.startsWith('places/')) { const old = docs.get(p) || {}; if (!d) throw new Error('permission-denied');
      // v54: 옛 칸(지역 stars · visits[].note)은 안 받음 · entries 는 내 칸만 (방문을 지우는 쓰기는 예외)
      if ('stars' in d || (d.visits || []).some((v) => 'note' in v)) throw new Error('permission-denied');
      const ne = d.entries || {}, oe = old.entries || {}, shrank = (d.visits || []).length < (old.visits || []).length;
      for (const k of new Set([...Object.keys(ne), ...Object.keys(oe)])) if (k !== uid && !shrank && JSON.stringify(ne[k]) !== JSON.stringify(oe[k])) throw new Error('permission-denied');
      const cs = (docs.get('couple/main') || {}).start || '1950-01-01'; const ov = old.visits || [];
      if ((d.visits || []).length && d.visits[0].date < cs && !(ov.length && JSON.stringify(ov[0]) === JSON.stringify(d.visits[0]))) throw new Error('permission-denied');
      if (d.updatedBy !== uid || d.code !== p.split('/')[1]) throw new Error('permission-denied'); }
    if (p.startsWith('events/')) { const old = docs.get(p); for (const x of [old, d]) if (x && x.owner !== 'both' && x.owner !== uid) throw new Error('permission-denied'); }
    if (p.startsWith('checks/')) { const key = p.split('/')[1].split('_')[0]; const r = docs.get('routines/' + key); if (!r || r.owner !== uid) throw new Error('permission-denied'); }
    if (d === null) docs.delete(p); else docs.set(p, d);
    await pushAll([p]);
  });
  await page.exposeFunction('__hello', async () => { await pushAll([]); });
  await page.exposeFunction('__auth', async (kind, email, pw) => {
    const a = accounts.get(email);
    if (kind === 'up') {
      if (a) throw new Error('auth/email-already-in-use');
      const u = { uid: 'u' + (accounts.size + 1) + 'x'.repeat(20), password: pw, verified: false };
      accounts.set(email, u);
      return { uid: u.uid, email, emailVerified: false };
    }
    if (!a || a.password !== pw) throw new Error('auth/invalid-credential');
    return { uid: a.uid, email, emailVerified: a.verified };
  });
  await page.exposeFunction('__isVerified', async (email) => !!(accounts.get(email) || {}).verified);
  pages.push(page);
  await page.goto(URL);
  await page.waitForSelector('.title');
  await page.waitForTimeout(150);
  return page;
}

async function signUp(page, email, pw, name) {
  await page.click('[data-act="auth-mode"][data-id="signup"]');
  await page.fill('#au-email', email);
  await page.fill('#au-pass', pw);
  await page.click('form[data-form="auth"] button[type="submit"]');
  await page.waitForSelector('#verify-title');
  // 메일의 인증 링크를 눌렀다고 치고 [인증했어요]
  accounts.get(email).verified = true;
  await page.click('[data-act="verify-check"]');
  await page.waitForSelector('#me-name');
  await page.fill('#me-name', name);
  await page.press('#me-name', 'Enter');
  await page.waitForSelector('[data-act="open-manage"]', { timeout: 4000 });
}

async function addRoutine(page, name, icon, start) {
  await page.click('[data-act="open-manage"]');
  await page.click('[data-act="new-routine"]');
  await page.fill('#rt-name', name);
  await page.click(`[data-act="pick-icon"][data-icon="${icon}"]`);
  await page.fill('#rt-start', start);
  await page.dispatchEvent('#rt-start', 'input');
  await page.click('[data-act="save-routine"]');
  await page.waitForTimeout(200);
  await page.click('[data-act="close-manage"]');
}

async function tick(page, dateKey, key) {
  const day = Date.UTC(+dateKey.slice(0, 4), +dateKey.slice(5, 7) - 1, +dateKey.slice(8, 10)) / 86400000;
  await page.click(`.cell[data-day="${day}"]`);
  const sel = key ? `.sheet [data-act="toggle"][data-key="${key}"]` : '.sheet [data-act="toggle"]:not([aria-disabled="true"]):not([disabled])';
  await page.click(sel);
  await page.waitForTimeout(120);
  await page.click('.close-btn');
}

(async () => {
  await new Promise((r) => setTimeout(r, 700));
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

  // 1) 준민: 처음 열면 로그인 화면 → 가입 → 이름 → 빈 화면
  const jm = await open(browser, '준민');
  console.log('처음 화면:', await jm.textContent('#auth-title'));
  await jm.screenshot({ path: path.join(OUT, 'web-login.png') });
  await jm.fill('#au-email', 'junmin@example.com');
  await jm.fill('#au-pass', 'wrongpw');
  await jm.click('form[data-form="auth"] button[type="submit"]');
  await jm.waitForSelector('#au-error');
  console.log('없는 계정 로그인:', await jm.textContent('#au-error'));
  await signUp(jm, 'junmin@example.com', 'pass1234', '준민');
  console.log('가입 뒤:', await jm.textContent('.caption'), '|', await jm.textContent('.notice__title'));

  // 2) 준민: 테니스 루틴 추가 + 오늘 체크
  await addRoutine(jm, '테니스 연습', '🎾', '2026-10-27');
  await tick(jm, '2026-10-27');
  console.log('준민 카드:', (await jm.$$eval('.routine__name', (e) => e.map((x) => x.textContent))).join(', '));

  // 3) 다진: 다른 기기에서 가입 → 스쿼트 추가 → 지난 기록 채우기
  const dj = await open(browser, '다진');
  await signUp(dj, 'dajin@example.com', 'pass5678', '다진');
  await addRoutine(dj, '스쿼트 100개', '🦵', '2026-10-18');
  for (const d of ['2026-10-18', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']) await tick(dj, d, null);
  await jm.waitForTimeout(100);
  await tick(dj, '2026-10-27', null);
  await jm.waitForTimeout(300);
  console.log('준민 실시간 알림:', await jm.textContent('.toast').catch(() => '(없음)'));
  console.log('10/27 칸(준민 화면):', await jm.getAttribute('.cell.is-today', 'class'));
  await dj.waitForTimeout(3000);
  console.log('다진 카드:', (await dj.$$eval('.stat__value', (e) => e.map((x) => x.textContent))).join(' / '));
  await dj.screenshot({ path: path.join(OUT, 'web-dj-main.png'), fullPage: true });

  // 4) 준민 화면에서 다진 루틴은 잠김
  await jm.click('.cell.is-today');
  console.log('준민 시트 스쿼트 잠김:', await jm.getAttribute('.sheet [data-key]:not([data-key^="r"])', 'aria-disabled').catch(() => null),
    '| 잠긴 버튼들:', await jm.$$eval('.sheet [aria-disabled="true"]', (e) => e.length));
  await jm.click('.close-btn');

  // 4-0) 꿍 보내기: 짝꿍이 다 했으면 칸만 보이고, 남았으면 하루 한 번 보낼 수 있다 (각자 기준)
  {
    const jmU = accounts.get('junmin@example.com').uid;
    console.log('꿍 칸(다진 다 함):', (await jm.textContent('.kung__text').catch(() => '(없음)')), '| 버튼 수:', await jm.$$eval('[data-act="send-kung"]', (e) => e.length));
    await tick(dj, '2026-10-27', null); // 다진 오늘 체크 풀기
    await jm.waitForTimeout(400);
    console.log('꿍 칸(다진 1개 남음):', await jm.textContent('.kung__text'), '| 버튼:', await jm.textContent('[data-act="send-kung"]'));
    await jm.click('[data-act="send-kung"]');
    await jm.waitForTimeout(300);
    console.log('보낸 뒤 버튼:', await jm.textContent('.kung__btn'), '| 잠김:', await jm.$eval('.kung__btn', (e) => e.disabled), '| 토스트:', await jm.textContent('.toast').catch(() => '(없음)'));
    console.log('kungs 문서:', JSON.stringify([...docs.entries()].filter(([k]) => k.startsWith('kungs/')).map(([k, v]) => [k, v.from === jmU, v.date])));
    await dj.waitForTimeout(300);
    console.log('다진 화면 꿍 칸(준민은 다 함, 다진 기준은 별도):', await dj.textContent('.kung__text').catch(() => '(없음)'));
    await tick(dj, '2026-10-27', null); // 되돌리기
    await jm.waitForTimeout(300);
  }

  // 4-0b) (v38) 루틴 쉬기: 오늘 체크했으면 내일부터 · 예약은 「쉬기 취소」 / 오늘부터 쉬면 카드 「쉬는 중」 · 짝꿍 꿍 칸 없음 · 모두 해낸 날은 남은 사람 기준 → 다시 시작
  {
    const restOf = (owner) => { const e = [...docs.entries()].find(([k, v]) => k.startsWith('routines/') && v.owner === owner); return JSON.stringify(e && e[1].rest); };
    const jmU = accounts.get('junmin@example.com').uid, djU = accounts.get('dajin@example.com').uid;
    await jm.click('[data-act="open-manage"]');
    await jm.click('[data-act="edit-routine"]');
    await jm.click('[data-act="rest-open"]');
    console.log('쉬기 칸(준민, 오늘 체크함):', await jm.textContent('.rest__note'), '| 오늘 칩 막힘:', await jm.$eval('[data-act="rest-from"][data-v="today"]', (e) => e.disabled));
    await jm.screenshot({ path: path.join(OUT, 'web-rest-form.png') });
    await jm.click('[data-act="rest-save"]');
    await jm.waitForTimeout(250);
    console.log('저장(준민):', restOf(jmU), '| 목록:', await jm.textContent('.mitem__status'), '| 버튼:', await jm.textContent('.mitem [data-act="wake-routine"]'));
    await jm.click('[data-act="close-manage"]');
    console.log('준민 카드 예약 줄:', await jm.textContent('.routine__rest span'));
    await jm.click('.routine__rest [data-act="wake-routine"]');
    await jm.waitForTimeout(250);
    console.log('쉬기 취소 뒤:', restOf(jmU), '| 줄 남음:', await jm.$$eval('.routine__rest', (e) => e.length));

    await tick(dj, '2026-10-27', null); // 다진 오늘 체크 풀기 → 오늘부터 쉴 수 있다
    await dj.click('[data-act="open-manage"]');
    await dj.click('[data-act="edit-routine"]');
    await dj.click('[data-act="rest-open"]');
    await dj.click('[data-act="rest-until"][data-v="3"]');
    console.log('쉬기 칸(다진, 3일):', await dj.textContent('.rest__note'));
    await dj.click('[data-act="rest-save"]');
    await dj.waitForTimeout(250);
    await dj.click('[data-act="close-manage"]');
    console.log('저장(다진):', restOf(djU), '| 카드:', await dj.textContent('.routine--rest .routine__rest span'), '| 연속 칸:', (await dj.$$eval('.routine--rest .stat__label', (e) => e.map((x) => x.textContent))).join(' / '));
    await jm.waitForTimeout(300);
    console.log('준민 화면 꿍 칸(다진 쉬는 중):', await jm.$$eval('.kung', (e) => e.length), '| 오늘 칸:', await jm.getAttribute('.cell.is-today', 'class'), '| 다진 카드 다시 시작 버튼(준민 화면):', await jm.$$eval('.routine--rest [data-act="wake-routine"]', (e) => e.length));
    await jm.click('.cell.is-today');
    console.log('준민 시트 다진 줄:', (await jm.$$eval('.sheet .row', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
    await jm.click('.close-btn');
    await jm.screenshot({ path: path.join(OUT, 'web-rest-partner.png'), fullPage: true });
    console.log('(v39) 사람별 묶음:', (await jm.$$eval('.rgroup__head', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
    await dj.screenshot({ path: path.join(OUT, 'web-rest-card.png'), fullPage: true });
    await dj.click('.routine__rest [data-act="wake-routine"]');
    await dj.waitForTimeout(250);
    console.log('다시 시작 뒤(오늘 시작한 쉬기는 지움):', restOf(djU), '| 토스트:', await dj.textContent('.toast').catch(() => '(없음)'));
    await tick(dj, '2026-10-27', null); // 다시 체크 (뒤 흐름 그대로)
    await jm.waitForTimeout(300);
  }

  // 4-0d) (v41) 언제 할지 · 달력 5단계 · 시트 요약 줄
  {
    const routineOf = (owner) => [...docs.entries()].find(([k, v]) => k.startsWith('routines/') && v.owner === owner);
    const jmU = accounts.get('junmin@example.com').uid;
    await jm.click('[data-act="open-manage"]');
    await jm.click('[data-act="edit-routine"]');
    console.log('(v43) 아이콘 묶음:', (await jm.$$eval('.icon-group', (e) => e.map((x) => x.textContent))).join(' · '), '| 아이콘', await jm.$$eval('.icon-pick', (e) => e.length) + '개');
    await jm.screenshot({ path: path.join(OUT, 'web-v43-icons.png') });
    await jm.click('[data-act="when-mode"][data-v="set"]');
    await jm.click('[data-act="when-cue"][data-v="수업 끝나고"]');
    await jm.fill('#rt-at', '18:30'); await jm.dispatchEvent('#rt-at', 'change');
    await jm.click('[data-act="when-remind"]');
    console.log('언제 폼:', await jm.textContent('.when__preview'), '| 알림 스위치:', await jm.getAttribute('[data-act="when-remind"]', 'aria-checked'));
    await jm.screenshot({ path: path.join(OUT, 'web-when-form.png') });
    await jm.click('[data-act="save-routine"]'); await jm.waitForTimeout(250);
    console.log('저장(when):', JSON.stringify(routineOf(jmU)[1].when));
    assert.deepStrictEqual(routineOf(jmU)[1].when, { cue: '수업 끝나고', at: '18:30', remind: true });
    await jm.click('[data-act="close-manage"]');
    console.log('카드 「언제」:', (await jm.$$eval('.routine__when', (e) => e.map((x) => x.textContent))).join(' | '));
    console.log('달력 칸 단계:', (await jm.$$eval('.cells .cell:not(.lv-out)', (e) => e.map((x) => (x.className.match(/lv-(\w+)/) || [])[1]))).join(' '));
    await jm.click('.cell.is-today');
    console.log('시트 요약 줄:', await jm.textContent('.day-sum'));
    console.log('(v42) 시트 묶음:', (await jm.$$eval('.sgroup__head', (e) => e.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
    await jm.screenshot({ path: path.join(OUT, 'web-v42-sheet.png') });
    await jm.click('.close-btn');
    await jm.screenshot({ path: path.join(OUT, 'web-v41-routine.png'), fullPage: true });
    // 언제든으로 되돌리면 when: null
    await jm.click('[data-act="open-manage"]'); await jm.click('[data-act="edit-routine"]');
    await jm.click('[data-act="when-mode"][data-v="any"]'); await jm.click('[data-act="save-routine"]'); await jm.waitForTimeout(250);
    assert.strictEqual(routineOf(jmU)[1].when, null, '언제든 → when null');
    await jm.click('[data-act="close-manage"]');
  }

  // 4-0e) (v44) 묶어 보기 전환 · 종류 칩 · ↑↓ 순서 · 카드 끌기
  {
    const jmU = accounts.get('junmin@example.com').uid;
    const mineDocs = () => [...docs.entries()].filter(([k, v]) => k.startsWith('routines/') && v.owner === jmU).sort((a, b) => a[1].order - b[1].order);
    const allOrders = () => JSON.stringify([...docs.entries()].filter(([k]) => k.startsWith('routines/')).map(([, v]) => [v.name, v.order]));
    console.log('순서 처음:', allOrders(), '| 칩:', (await jm.$$eval('[data-act="filter"]', (e) => e.map((x) => x.textContent))).join(','));
    // 준민 루틴 하나 더 (독서) → 순서 바꿀 거리
    await jm.click('[data-act="open-manage"]'); await jm.click('[data-act="new-routine"]');
    await jm.fill('#rt-name', '독서'); await jm.click('[data-act="pick-icon"][data-icon="📚"]');
    console.log('종류 칩(자동):', await jm.$eval('[data-act="pick-kind"][aria-pressed="true"]', (e) => e.textContent));
    await jm.click('[data-act="pick-kind"][data-v="mind"]');
    await jm.click('[data-act="save-routine"]'); await jm.waitForTimeout(300);
    console.log('독서 저장 kind:', JSON.stringify(mineDocs().map(([, v]) => [v.name, v.kind || null, v.order])));
    await jm.click('[data-act="rt-order"]');
    const names = async () => (await jm.$$eval('.mitem--order .mitem__name', (e) => e.map((x) => x.textContent))).join(' → ');
    console.log('순서 모드:', await names());
    await jm.click('.mitem--order:last-child [data-act="rt-move"][data-dir="-1"]'); await jm.waitForTimeout(250);
    console.log('↑ 뒤:', await names(), '| 저장:', JSON.stringify(mineDocs().map(([, v]) => [v.name, v.order])));
    await jm.click('[data-act="rt-order-done"]'); await jm.click('[data-act="close-manage"]');
    // 보기 전환
    for (const v of ['kind', 'manual', 'time']) {
      await jm.click('[data-act="routine-view"][data-v="' + v + '"]'); await jm.waitForTimeout(150);
      console.log('보기 ' + v + ':', (await jm.$$eval('.rsub', (e) => e.map((x) => (x.querySelector('.rsub__head') ? x.querySelector('.rsub__head').textContent : '(머리말 없음)') + ' [' + [...x.querySelectorAll('.routine__name')].map((n) => n.textContent.replace('어제 놓침', '')).join(', ') + ']'))).join(' / '));
    }
    assert.strictEqual(docs.get('users/' + jmU).routineView, 'time', '보기 기준 저장');
    // 내 순서 보기에서 카드 꾹 눌러 끌기 (첫 카드 → 맨 아래)
    await jm.click('[data-act="routine-view"][data-v="manual"]'); await jm.waitForTimeout(150);
    const box = '.rsub[data-mine]';
    const first = await jm.$(box + ' > .routine:first-of-type'), last = await jm.$(box + ' > .routine:last-of-type');
    await first.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70));
    await jm.waitForTimeout(100);
    const a = await first.boundingBox(), b = await last.boundingBox();
    await jm.mouse.move(a.x + a.width / 2, a.y + 30); await jm.mouse.down(); await jm.waitForTimeout(500);
    assert.strictEqual(await jm.$$eval('.routine.is-lifted', (e) => e.length), 1, '꾹 누르면 카드가 들림');
    await jm.mouse.move(a.x + a.width / 2, b.y + b.height - 5, { steps: 8 }); await jm.mouse.up(); await jm.waitForTimeout(300);
    console.log('끈 뒤 저장:', JSON.stringify(mineDocs().map(([, v]) => [v.name, v.order])));
    await jm.screenshot({ path: path.join(OUT, 'web-v44-manual.png'), fullPage: true });
    await jm.click('[data-act="routine-view"][data-v="kind"]'); await jm.waitForTimeout(150);
    await jm.screenshot({ path: path.join(OUT, 'web-v44-kind.png'), fullPage: true });
    await jm.click('[data-act="routine-view"][data-v="time"]');
  }

  // 4-0c) (v40 · v41) 토마토 · 주간 퀘스트: 시작일(11/12)이 테스트 시계(10/27)보다 뒤라 10/26 으로 앞당겨 본다
  {
    for (const p of [jm, dj]) {
      await p.evaluate(() => { window.RT.grow.START = window.RT.dates.fromYMD(2026, 10, 26); });
      await p.click('[data-act="tab"][data-tab="todo"]'); await p.click('[data-act="tab"][data-tab="routine"]');
      await p.waitForSelector('.grow'); await p.waitForSelector('.quest');
    }
    const growText = (p) => p.$eval('.grow', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    const questText = (p) => p.$eval('.quest', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    console.log('토마토(준민):', await growText(jm));
    console.log('퀘스트(준민):', await questText(jm));
    assert.strictEqual(await questText(dj), await questText(jm), '두 사람 퀘스트가 같다');
    assert.strictEqual(await growText(dj), await growText(jm), '두 사람 토마토가 같다');
    // 순서: 사람 칩 → 토마토 → 달력 → (꿍) → 퀘스트 → 루틴 카드
    console.log('루틴 탭 순서:', (await jm.$$eval('main > *, .app > *', (e) => e.map((x) => x.className.split(' ').filter((c) => /^(chip-row|grow|grid-card|card|kung|quest|rgroup)$/.test(c)).join('.')).filter(Boolean))).join(' → '));
    await jm.screenshot({ path: path.join(OUT, 'web-grow-routine.png'), fullPage: true });
    await jm.click('[data-act="open-grow"]'); await jm.waitForSelector('#grow-title');
    console.log('토마토 시트:', await jm.$eval('.gbig', (e) => e.textContent.replace(/\s+/g, ' ').trim()), '|', await jm.$eval('.gstats', (e) => e.textContent.replace(/\s+/g, ' ').trim()));
    await jm.screenshot({ path: path.join(OUT, 'web-grow-sheet.png'), fullPage: true });
    await jm.keyboard.press('Escape'); await jm.waitForTimeout(150);
    assert.strictEqual(await jm.$$eval('#grow-title', (e) => e.length), 0, 'Esc 로 닫힘');
    await jm.click('[data-act="open-quest"]'); await jm.waitForSelector('.quest--review');
    console.log('돌아보기 퀘스트:', await jm.$eval('.quest--review', (e) => e.textContent.replace(/\s+/g, ' ').trim()));
    await jm.click('[data-act="tab"][data-tab="routine"]'); await jm.waitForSelector('.grow');
  }

  // 4-1) 할 일 탭: 함께 5개 → 3개까지 + 더 보기, 기한 순서, 짝꿍이 체크, 남의 할 일은 잠김
  async function addTodo(page, key, title, due, date) {
    await page.click(`[data-act="todo-add"][data-key="${key}"]`);
    await page.fill('#td-title', title);
    if (due) await page.click(`[data-act="todo-due"][data-v="${due}"]`);
    if (date) await page.fill('#td-date', date);
    await page.click('form[data-form="todo"] button[type="submit"]');
    await page.waitForTimeout(150);
  }
  await jm.click('[data-act="tab"][data-tab="todo"]');
  console.log('할 일 탭:', await jm.getAttribute('[data-act="tab"][aria-current="page"]', 'data-tab'), '|', await jm.textContent('.tcard--together .tempty'));
  await addTodo(jm, 'together', '부모님 선물 의논', null);
  await addTodo(jm, 'together', '주말 장보기', 'week');
  await addTodo(jm, 'together', '여행 숙소 알아보기', 'date', '2026-11-20');
  await addTodo(jm, 'together', '영화 예매', 'today');
  await addTodo(jm, 'together', '사진 인화', 'date', '2026-10-25');
  await jm.click('[data-act="todo-add"][data-key="together"]');
  await jm.click('form[data-form="todo"] button[type="submit"]');
  console.log('빈 이름 저장:', await jm.textContent('#td-error'));
  await jm.keyboard.press('Escape');
  const togTitles = () => jm.$$eval('.tcard--together .trow__title', (e) => e.map((x) => x.textContent));
  console.log('함께(3개만, 기한 순):', (await togTitles()).join(' > '), '|', await jm.textContent('.tcard--together [data-act="todo-more"]'));
  console.log('지난 기한 표시:', await jm.textContent('.tcard--together .trow__meta--over'));
  await jm.click('.tcard--together [data-act="todo-more"]');
  console.log('더 보기:', (await togTitles()).length, '개 |', await jm.textContent('.tcard--together [data-act="todo-more"]'));
  const jmUid0 = accounts.get('junmin@example.com').uid, djUid0 = accounts.get('dajin@example.com').uid;
  await addTodo(jm, jmUid0, '라켓 줄 교체', 'tomorrow');
  await dj.click('[data-act="tab"][data-tab="todo"]');
  await dj.waitForTimeout(150);
  console.log('다진 화면 칸 순서:', (await dj.$$eval('.tcard--col .tcard__name', (e) => e.map((x) => x.textContent))).join(' | '));
  console.log('다진 화면 준민 할 일 잠김:', await dj.getAttribute(`.tcard--col:has(#t-${jmUid0}) .tcheck`, 'aria-disabled'));
  await dj.click('.tcard--together .tcheck');
  await jm.waitForTimeout(200);
  console.log('다진이 함께 할 일 체크 → 준민 화면:', await jm.textContent('.tcard--together .tcard__count'), '|', await jm.textContent('.tcard--together [data-act="todo-donelist"]'));
  await jm.click('.tcard--together [data-act="todo-donelist"]');
  console.log('완료 펼침:', await jm.textContent('.tcard--together .trow.is-done .trow__meta'));
  await jm.click('.tcard--together [data-act="todo-edit"]');
  await jm.fill('#td-title', '영화 예매 (조조)');
  await jm.press('#td-title', 'Enter');
  await jm.waitForTimeout(150);
  console.log('엔터로 고치기:', (await togTitles())[1]);
  await jm.screenshot({ path: path.join(OUT, 'web-todo.png'), fullPage: true });
  // (점검 6) 체크한 줄이 「완료」로 접혀도 포커스가 근처에 남는다
  await jm.click('.tcard--together [data-act="todo-donelist"]'); // 완료 숨기기
  await jm.focus('.tcard--together .trow:not(.is-done) .tcheck');
  await jm.keyboard.press('Enter');
  await jm.waitForTimeout(250);
  console.log('체크 뒤 포커스:', await jm.evaluate(() => document.activeElement.getAttribute('data-act')));
  // (점검 3) 고치던 함께 할 일을 짝꿍이 지우면 시트가 닫힌다
  await jm.click('.tcard--together [data-act="todo-edit"]');
  await dj.click('.tcard--together [data-act="todo-edit"]');
  await dj.click('[data-act="todo-delete"]'); await dj.waitForTimeout(450); await dj.click('[data-act="todo-delete"]');
  await jm.waitForTimeout(250);
  console.log('짝꿍이 지우면:', !(await jm.$('#todo-sheet-title')), '|', await jm.textContent('.toast').catch(() => '(없음)'));

  // 4-1a) u&I 평면: 목록 | 평면, 안 놓은 일 놓기(끌어 놓기), 추가하고 바로 놓기(위치 추천), 블록 · 점, 상세, 짝꿍 평면, 완료 → 보관함
  async function dragLine(page, frac) { // frac: 0(아래) ~ 1(위)
    const box = await page.locator('.pline__track').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height * (1 - frac);
    const b = await page.locator('.pblock').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(x, (b.y + y) / 2, { steps: 4 }); await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.up(); await page.waitForTimeout(80);
  }
  async function placeBoth(page, u, i) {
    await dragLine(page, u); await page.click('[data-act="place-next"]');
    await dragLine(page, i); await page.click('[data-act="place-next"]'); await page.waitForTimeout(200);
  }
  await jm.click('[data-act="todo-view"][data-v="plane"]');
  console.log('평면 처음:', await jm.textContent('.uempty'), '|', (await jm.textContent('.utray')).replace(/\s+/g, ' '));
  await jm.click('[data-act="uni-unplaced"]');
  console.log('안 놓은 일:', (await jm.$$eval('.ulist .ulist__t', (e) => e.map((x) => x.textContent))).join(', '));
  await jm.click('.ulist [data-act="uni-place"]');
  console.log('첫 할 일 놓기:', await jm.textContent('.place__title'), '|', await jm.textContent('.place__sub'), '| 추천 버튼:', !!(await jm.$('[data-act="place-ask"]')));
  await jm.screenshot({ path: path.join(OUT, 'uni-place-first.png') });
  await placeBoth(jm, 0.85, 0.3);
  console.log('놓은 뒤:', await jm.textContent('.toast'), '| 점', await jm.$$eval('.upt', (e) => e.length), '| 반짝', await jm.$$eval('.upt.is-flash', (e) => e.length));
  // 나머지 함께 할 일 · 내 일도 놓기 (끌어서)
  const spots = [[0.2, 0.8], [0.6, 0.6], [0.4, 0.15]];
  for (const [u, i] of spots) {
    if (!(await jm.$('[data-act="uni-unplaced"]'))) break;
    await jm.click('[data-act="uni-unplaced"]'); await jm.click('.ulist [data-act="uni-place"]');
    await placeBoth(jm, u, i);
  }
  // 평면에서 바로 추가 → 카테고리 → 위치 추천
  await jm.click('[data-act="todo-add"][data-key="plane"]');
  console.log('평면에서 추가 시트:', await jm.textContent('#todo-sheet-title'), '| 누구:', (await jm.$$eval('[data-act="todo-scope"]', (e) => e.map((x) => x.textContent + ':' + x.getAttribute('aria-pressed')))).join(' '));
  await jm.fill('#td-title', '생물학 과제 제출하기');
  await jm.click('[data-act="todo-cat"][data-v="study"]');
  console.log('미리보기:', await jm.textContent('.upreview .upt__tag'), '| 이름 칸 안내:', await jm.getAttribute('#td-short', 'placeholder'));
  await jm.fill('#td-short', '생물 과제');
  console.log('평면 이름 넣으면 미리보기:', await jm.textContent('.upreview .upt__tag'));
  // (v30) 메모 · 할 일 시트에서도 카테고리 「편집」 → 돌아오면 적던 것 그대로
  await jm.fill('#td-memo', '가기 전에\n조끼 챙기기');
  console.log('메모 글자 수:', await jm.textContent('#td-memo-count'));
  await jm.click('.sheet [data-act="cat-open"]');
  console.log('할 일 → 카테고리 시트:', await jm.textContent('#cat-sheet-title'), '| 닫기 버튼:', await jm.textContent('.close-btn[data-act="cat-close"]'));
  await jm.click('.close-btn[data-act="cat-close"]');
  console.log('할 일로 돌아옴:', await jm.inputValue('#td-title'), '|', JSON.stringify(await jm.inputValue('#td-memo')), '|', await jm.inputValue('#td-short'), '| 카테고리', await jm.$$eval('[data-act="todo-cat"][aria-pressed="true"]', (e) => e.map((x) => x.textContent).join()));
  await jm.screenshot({ path: path.join(OUT, 'uni-add.png') });
  await jm.click('form[data-form="todo"] button[type="submit"]');
  await jm.waitForTimeout(150);
  console.log('추가 → 놓기:', await jm.textContent('.place__title'), '| 줄 위 할 일', await jm.$$eval('.pmark', (e) => e.length));
  await dragLine(jm, 0.5);
  console.log('끄는 중 문장:', (await jm.textContent('#pnote')).trim(), '| 이웃 강조', await jm.$$eval('.pmark.is-near', (e) => e.length));
  await jm.screenshot({ path: path.join(OUT, 'uni-place-drag.png') });
  await jm.click('[data-act="place-ask"]');
  const askQ = await jm.textContent('.pask__q');
  let asked = 0;
  while (await jm.$('[data-act="place-ans"]')) { if (!asked) await jm.screenshot({ path: path.join(OUT, 'uni-ask.png') }); await jm.click('[data-act="place-ans"][data-v="yes"]'); asked++; }
  console.log('추천 질문:', askQ, '| 물은 수', asked, '| 말풍선', await jm.textContent('.phint'), '|', (await jm.textContent('#pnote')).trim());
  const btnSpot = async () => { const b = await jm.locator('[data-act="place-ask"]').boundingBox(); return b && Math.round(b.x) + ',' + Math.round(b.y); };
  const askSpotU = await btnSpot();
  await jm.click('[data-act="place-next"]');
  console.log('추천 버튼 같은 자리(급함 → 중요함):', askSpotU === await btnSpot(), '| 이전 버튼:', await jm.textContent('.place__back'));
  await jm.screenshot({ path: path.join(OUT, 'uni-place-i.png') });
  await jm.focus('.pblock'); for (let k = 0; k < 8; k++) await jm.keyboard.press('ArrowUp');
  console.log('방향키 중요도:', (await jm.textContent('#pnote')).trim());
  await jm.click('[data-act="place-next"]'); await jm.waitForTimeout(250);
  const jmUidU = accounts.get('junmin@example.com').uid;
  const bio = [...docs.entries()].find(([k, v]) => k.startsWith('todos/') && v.title === '생물학 과제 제출하기');
  console.log('저장: cat', bio[1].cat, '| short', bio[1].short, '| memo', JSON.stringify(bio[1].memo), '| ui', JSON.stringify(bio[1].ui[jmUidU] && { u: bio[1].ui[jmUidU].u, i: bio[1].ui[jmUidU].i }));
  console.log('평면 블록:', (await jm.$$eval('.upt__tag', (e) => e.map((x) => x.textContent))).join(' / '));
  console.log('범례:', await jm.textContent('.ulegend'));
  await jm.screenshot({ path: path.join(OUT, 'uni-plane-block.png') });
  await jm.click('[data-act="uni-mode"][data-v="dot"]');
  await jm.screenshot({ path: path.join(OUT, 'uni-plane-dot.png') });
  await jm.click('[data-act="uni-mode"][data-v="block"]');
  // (v30) 꾹 눌러 옮기기: 0.4초 누르면 들리고, 끌어서 놓으면 그 자리 이웃 사이로. 바로 끌면(스크롤) 안 옮겨짐
  const bioId = bio[0].split('/')[1];
  const plane = await jm.locator('.uplane').boundingBox();
  const ptAt = async () => { const b = await jm.locator(`[data-uni-pt="${bioId}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const uiNow = () => JSON.stringify(docs.get(bio[0]).ui[jmUidU]);
  let p0 = await ptAt(), uiBefore = uiNow();
  await jm.mouse.move(p0.x, p0.y); await jm.mouse.down(); await jm.mouse.move(p0.x - 40, p0.y + 40, { steps: 3 }); await jm.mouse.up(); await jm.waitForTimeout(150);
  console.log("바로 끌면 그대로:", uiNow() === uiBefore, '| 시트 안 열림', !(await jm.$('#uni-detail-title')));
  p0 = await ptAt();
  await jm.mouse.move(p0.x, p0.y); await jm.mouse.down(); await jm.waitForTimeout(480);
  console.log('꾹 → 들림:', await jm.$$eval('.upt.is-lifted', (e) => e.length), '| 평면 is-moving', await jm.$eval('.uplane', (e) => e.classList.contains('is-moving')));
  await jm.mouse.move(plane.x + plane.width * 0.15, plane.y + plane.height * 0.8, { steps: 8 });
  await jm.screenshot({ path: path.join(OUT, 'uni-lift.png') });
  await jm.mouse.up(); await jm.waitForTimeout(250);
  const moved = docs.get(bio[0]).ui[jmUidU];
  console.log('놓은 뒤:', await jm.textContent('.toast'), '| u', moved.u, 'i', moved.i, '| 바뀜', uiNow() !== uiBefore, '| 상세 안 열림', !(await jm.$('#uni-detail-title')));
  const q = await jm.$eval(`[data-uni-pt="${bioId}"]`, (e) => { const r = e.getBoundingClientRect(), pr = e.parentElement.getBoundingClientRect(); return [(r.left + r.width / 2 - pr.left) / pr.width, (r.top + r.height / 2 - pr.top) / pr.height].map((v) => v.toFixed(2)); });
  console.log('옮긴 뒤 화면 자리(왼쪽 아래 = 나중에):', q.join(','), '| 마지막 기록', [...docs.values()].filter((v) => v && v.type && v.todo === bioId).map((v) => v.type).join(','));
  // 짧게 누르면 예전처럼 상세 (+ 메모)
  await jm.click(`[data-act="uni-open"][data-id="${bioId}"]`);
  console.log('상세 메모:', JSON.stringify(await jm.textContent('.umemo__t').catch(() => '(없음)')));
  await jm.keyboard.press('Escape');
  // 다진은 준민 평면을 꾹 눌러도 못 옮김
  await dj.click('[data-act="todo-view"][data-v="plane"]'); await dj.click(`[data-act="uni-who"][data-v="${jmUidU}"]`).catch(() => {});
  if (await dj.$(`[data-uni-pt="${bioId}"]`)) {
    const db0 = await dj.locator(`[data-uni-pt="${bioId}"]`).boundingBox(); uiBefore = uiNow();
    await dj.mouse.move(db0.x + 12, db0.y + 12); await dj.mouse.down(); await dj.waitForTimeout(480);
    console.log('짝꿍 평면은 안 들림:', await dj.$$eval('.upt.is-lifted', (e) => e.length));
    await dj.mouse.move(db0.x + 100, db0.y + 100, { steps: 4 }); await dj.mouse.up(); await dj.waitForTimeout(150);
    console.log("짝꿍 평면 위치 그대로:", uiNow() === uiBefore); await dj.keyboard.press('Escape');
  }
  await dj.click(`[data-act="uni-who"][data-v="${accounts.get('dajin@example.com').uid}"]`).catch(() => {});
  await dj.click('[data-act="todo-view"][data-v="list"]');
  // 상세
  await jm.click(`[data-act="uni-open"][data-id="${bio[0].split('/')[1]}"]`);
  console.log('상세:', await jm.textContent('#uni-detail-title'), '|', (await jm.$$eval('.uchip', (e) => e.map((x) => x.textContent))).join(', '), '|', (await jm.$$eval('.ustat__v', (e) => e.map((x) => x.textContent))).join(', '));
  await jm.screenshot({ path: path.join(OUT, 'uni-detail.png') });
  // 다시 정하기에서 그냥 넘기면 위치 그대로
  const placedBefore = JSON.stringify(docs.get(bio[0]).ui[jmUidU]);
  await jm.click('[data-act="uni-place"]'); await jm.click('[data-act="place-next"]'); await jm.click('[data-act="place-next"]'); await jm.waitForTimeout(200);
  const after = docs.get(bio[0]).ui[jmUidU]; // (다시 정하기 뒤)
  console.log('다시 정하기 그대로:', placedBefore.includes('"u":' + after.u) && placedBefore.includes('"i":' + after.i), '| 토스트', await jm.textContent('.toast'));
  // 다진: 같은 함께 할 일을 자기 평면에 놓아도 준민 위치는 그대로
  await dj.click('[data-act="todo-view"][data-v="plane"]'); await dj.waitForTimeout(100);
  console.log('다진 평면:', await dj.textContent('.uempty').catch(() => '-'), '| 누구 버튼', (await dj.$$eval('[data-act="uni-who"]', (e) => e.map((x) => x.textContent + ':' + x.getAttribute('aria-pressed')))).join(' '));
  await dj.click('[data-act="uni-unplaced"]'); await dj.click('.ulist [data-act="uni-place"]'); await placeBoth(dj, 0.1, 0.9);
  const tog = [...docs.entries()].find(([k, v]) => k.startsWith('todos/') && v.scope === 'together' && v.ui && Object.keys(v.ui).length === 2);
  console.log('함께 할 일 위치 둘 다:', !!tog, tog && Object.keys(tog[1].ui).length);
  await dj.click(`[data-act="uni-who"][data-v="${jmUidU}"]`);
  console.log('다진이 보는 준민 평면:', await dj.$$eval('.upt', (e) => e.length), '개 | 놓기 버튼', !!(await dj.$('[data-act="uni-unplaced"]')), '| 추가', !!(await dj.$('[data-act="todo-add"][data-key="plane"]')));
  await dj.click(`[data-act="uni-open"][data-id="${bio[0].split('/')[1]}"]`);
  console.log('짝꿍 일 상세(보기만):', await dj.textContent('#uni-detail-title'), '| 버튼', await dj.$$eval('.uacts button', (e) => e.length), '|', await dj.textContent('.sheet__sub'));
  await dj.keyboard.press('Escape');
  // 완료 → 평면에서 빠지고, 목록엔 오늘 완료로 남음
  const nBefore = await jm.$$eval('.upt', (e) => e.length);
  await jm.click(`[data-act="uni-open"][data-id="${bio[0].split('/')[1]}"]`); await jm.click('[data-act="uni-done"]'); await jm.waitForTimeout(500);
  console.log('완료:', await jm.textContent('.toast'), '| 점', nBefore, '→', await jm.$$eval('.upt', (e) => e.length));
  await jm.click('[data-act="todo-view"][data-v="list"]');
  await jm.click(`.tcard--col:has(#t-${jmUidU}) [data-act="todo-donelist"]`);
  console.log('목록 메모 한 줄:', await jm.textContent(`[data-act="todo-edit"][data-id="${bioId}"] .trow__memo`).catch(() => '(없음)'));
  await jm.screenshot({ path: path.join(OUT, 'todo-memo-list.png') });
  await jm.click(`.tcard--col:has(#t-${jmUidU}) [data-act="todo-donelist"]`);
  console.log('목록 오늘 완료:', await jm.textContent(`.tcard--col:has(#t-${jmUidU}) [data-act="todo-donelist"]`));
  const logs = [...docs.entries()].filter(([k]) => k.startsWith('uiLog/')).map(([, v]) => v.type);
  console.log('기록(uiLog):', logs.join(','));
  // 다음 날이 되면 보관함으로 — 완료 시각을 어제로 옮기고 다시 연다
  const y = JSON.parse(JSON.stringify(docs.get(bio[0]))); y.doneAt = '2026-10-26T03:00:00.000Z'; docs.set(bio[0], y); await pushAll([bio[0]]);
  await jm.waitForTimeout(150);
  console.log('어제 완료는 목록에서 빠짐:', !(await jm.$(`.tcard--col:has(#t-${jmUidU}) [data-act="todo-donelist"]`)));
  await jm.click('[data-act="archive-open"]'); await jm.waitForTimeout(200);
  console.log('보관함:', (await jm.$$eval('.agroup__day', (e) => e.map((x) => x.textContent))).join(' / '), '|', await jm.textContent('.arow__title'));
  await jm.screenshot({ path: path.join(OUT, 'uni-archive.png') });
  await jm.click('[data-act="archive-undo"]'); await jm.waitForTimeout(200);
  console.log('되돌리기:', await jm.textContent('.toast'), '| 보관함 남은', await jm.$$eval('.arow', (e) => e.length), '| 저장 done', docs.get(bio[0]).done);
  console.log('되돌린 뒤 포커스:', await jm.evaluate(() => document.activeElement && (document.activeElement.getAttribute('data-act') || document.activeElement.tagName)));
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  console.log('Esc 뒤 보관함 닫힘:', !(await jm.$('#archive-title')));
  await jm.click('[data-act="todo-view"][data-v="plane"]'); await jm.waitForTimeout(100);
  console.log('되돌리면 평면에 다시:', await jm.$$eval(`[data-uni-pt="${bio[0].split('/')[1]}"]`, (e) => e.length));
  await jm.click('[data-act="todo-view"][data-v="list"]');
  await dj.click(`[data-act="uni-who"][data-v="${accounts.get('dajin@example.com').uid}"]`); await dj.click('[data-act="todo-view"][data-v="list"]');

  // 4-1a) 돌아보기 탭 (v37): 이번 주 · 지난주 · 달, 두 사람 화면 숫자가 같다, 끝낸 일 · 꿍은 열 때만 불러온다
  const rvNums = (p) => p.$$eval('.rv-us .stat__value', (e) => e.map((x) => x.textContent).join(' / '));
  const rvDone = (p) => p.textContent('.card[aria-label="끝낸 일 돌아보기"] .rv-sub');
  await jm.evaluate(() => { window.__reads = 0; });
  await jm.click('[data-act="tab"][data-tab="look"]'); await jm.waitForSelector('.rv-us'); await jm.waitForTimeout(250);
  assert.strictEqual((await jm.$$eval('.tabbar__btn span', (e) => e.map((x) => x.textContent))).join(' · '), '루틴 · 시간표 · 할 일 · 돌아보기 · 전체');
  assert.strictEqual(await jm.textContent('.rv-us .rv-title'), '이번 주 우리');
  assert.strictEqual(await jm.textContent('.rv-us .grid-range'), '10월 26일 – 11월 1일');
  assert.ok(await jm.$eval('[data-act="rv-page"][data-dir="-1"]', (e) => e.disabled), '이번 주는 다음이 막힘');
  const rows = await jm.$$eval('.rv-grid .rv-name__text', (e) => e.map((x) => x.textContent));
  assert.strictEqual(await jm.$$eval('.rv-cell', (e) => e.length), rows.length * 7, '줄마다 7칸');
  assert.strictEqual(rows[rows.length - 1], '모두 해낸 날');
  console.log('돌아보기:', await rvNums(jm), '| 줄', rows.join(', '), '|', await rvDone(jm), '| 불러온 문서', await jm.evaluate(() => window.__reads));
  await jm.screenshot({ path: path.join(OUT, 'review-week.png'), fullPage: true });
  await jm.click('[data-act="rv-page"][data-dir="1"]'); await jm.waitForTimeout(250);
  assert.strictEqual(await jm.textContent('.rv-us .rv-title'), '지난주 우리');
  assert.ok(await jm.$('[data-act="rv-now"]'), '지난주에는 「이번 주」 버튼');
  await jm.click('[data-act="rv-page"][data-dir="-1"]'); await jm.waitForTimeout(150);
  // 회귀(점검 AI): 넘긴 쪽 버튼이 막히면 포커스가 반대쪽 버튼으로 (body로 빠지지 않게)
  assert.strictEqual(await jm.evaluate(() => document.activeElement.getAttribute('data-act') + ':' + document.activeElement.getAttribute('data-dir')), 'rv-page:1');
  await jm.click('[data-act="rv-mode"][data-v="month"]'); await jm.waitForTimeout(250);
  assert.strictEqual(await jm.textContent('.rv-us .rv-title'), '이번 달 우리');
  // (v54 R1) 달 보기 = 루틴마다 한 달 달력 · 카드 | 띠 · 처음엔 루틴 수로 (4개 이하 카드, 5개 이상 띠)
  assert.ok(!(await jm.$('.rv-bar--routine')), 'v54: 달 보기는 막대 대신 달력');
  const rvCount = await jm.evaluate(() => document.querySelectorAll('.rv-mcard, button.rv-srow').length);
  assert.ok(rvCount > 0, '루틴마다 하나');
  assert.strictEqual(await jm.getAttribute(`[data-act="rv-view"][data-v="${rvCount >= 5 ? 'strip' : 'card'}"]`, 'aria-pressed'), 'true', '처음 모양 = 루틴 수로 (' + rvCount + '개)');
  await jm.click('[data-act="rv-view"][data-v="card"]'); await jm.waitForTimeout(150);
  assert.ok(await jm.$('.rv-mall .rv-cal--big') && (await jm.$$('.rv-mcard')).length === rvCount, '카드: 모두 + 루틴마다 작은 달력');
  assert.ok(await jm.$('.rv-d--today'), '오늘 테두리');
  assert.strictEqual(docs.get('users/' + jmUid0).reviewMonthView, 'card', '고르면 사람마다 저장 (users.reviewMonthView)');
  await jm.screenshot({ path: path.join(OUT, 'review-month-card.png'), fullPage: true });
  await jm.click('[data-act="rv-view"][data-v="strip"]'); await jm.waitForTimeout(150);
  assert.strictEqual(docs.get('users/' + jmUid0).reviewMonthView, 'strip');
  assert.ok(!(await jm.evaluate(() => Object.keys(localStorage).some((k) => /month/i.test(k)))), '기기에는 저장하지 않음');
  assert.strictEqual(await jm.evaluate(() => document.activeElement.getAttribute('data-v')), 'strip', '고른 뒤 포커스 그대로');
  await jm.screenshot({ path: path.join(OUT, 'review-month.png'), fullPage: true });
  await jm.click('button.rv-srow'); await jm.waitForSelector('#rvrow-title');
  assert.ok(await jm.$('.sheet .rv-cal--big .rv-cal__dow'), '줄을 누르면 그 루틴의 한 달 달력 시트');
  await jm.screenshot({ path: path.join(OUT, 'review-month-row.png') });
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(120);
  assert.ok(!(await jm.$('#rvrow-title')), 'Esc 로 닫힘');
  assert.strictEqual(await jm.evaluate(() => document.activeElement.getAttribute('data-act')), 'rv-row', '닫으면 누른 줄로 포커스');
  for (const v of ['strip', 'card']) for (const w of [320, 375]) {
    await jm.click(`[data-act="rv-view"][data-v="${v}"]`); await jm.setViewportSize({ width: w, height: 760 }); await jm.waitForTimeout(100);
    assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}px 달 보기(${v}) 넘침 없음`);
    await jm.screenshot({ path: path.join(OUT, `review-month-${v}-${w}.png`), fullPage: true });
  }
  await jm.setViewportSize({ width: 390, height: 844 });
  await jm.click('[data-act="rv-mode"][data-v="week"]'); await jm.waitForTimeout(250);
  await dj.click('[data-act="tab"][data-tab="look"]'); await dj.waitForSelector('.rv-us'); await dj.waitForTimeout(250);
  assert.strictEqual(await rvNums(dj), await rvNums(jm), '두 사람 화면 숫자가 같다');
  // 짝꿍이 끝내면 탭을 떠나지 않아도 더해지고, 되돌리면 바로 빠진다 (회귀(점검 AI): 불러 둔 옛 사본이 남던 문제)
  const n0 = await rvDone(jm);
  await dj.click('[data-act="tab"][data-tab="todo"]');
  const tid = await dj.getAttribute('.tcard--together .trow:not(.is-done) [data-act="todo-toggle"]', 'data-id');
  await dj.click(`[data-act="todo-toggle"][data-id="${tid}"]`); await dj.waitForTimeout(300);
  const n1 = await rvDone(jm);
  assert.strictEqual(parseInt(n1, 10), parseInt(n0, 10) + 1, '짝꿍이 끝내면 바로 +1: ' + n0 + ' → ' + n1);
  await jm.click('[data-act="tab"][data-tab="todo"]'); await jm.click('[data-act="tab"][data-tab="look"]'); await jm.waitForTimeout(300); // 다시 열어 그 일을 불러 둔 상태로
  await dj.waitForTimeout(900); // 두 번 눌림 막기(0.8초)가 풀린 뒤
  if (!(await dj.$(`[data-act="todo-toggle"][data-id="${tid}"]`))) await dj.click('.tcard--together [data-act="todo-donelist"]');
  await dj.click(`[data-act="todo-toggle"][data-id="${tid}"]`); await dj.waitForTimeout(300);
  assert.strictEqual(docs.get('todos/' + tid).done, false, '짝꿍이 되돌림');
  assert.strictEqual(await rvDone(jm), n0, '되돌리면 바로 빠진다');
  // 좁은 화면(320px)에서도 아래 탭 다섯이 넘치지 않는다
  await jm.setViewportSize({ width: 320, height: 700 }); await jm.waitForTimeout(150);
  const tabFit = await jm.$$eval('.tabbar__btn', (bs) => bs.every((b) => { const r = b.getBoundingClientRect(), t = b.querySelector('span').getBoundingClientRect(); return r.right <= 320.5 && t.left >= r.left - 0.5 && t.right <= r.right + 0.5; }));
  assert.ok(tabFit, '320px 아래 탭');
  await jm.screenshot({ path: path.join(OUT, 'review-320.png') });
  await jm.setViewportSize({ width: 390, height: 844 });
  console.log('돌아보기 확인 끝 (주 · 지난주 · 달 · 두 사람 · 실시간 · 320px)');

  // 4-1a2) (v46 → v51) 우리 기념일: 「전체」의 「우리 둘」 박스에서 정하고 본다 (머리말 칩 · 돌아보기 카드는 v51에서 뺌)
  await toAll(jm);
  assert.match(await jm.textContent('.ubox__mid'), /우리가 시작한 날을정해 볼까요\?/, '정하기 전');
  assert.ok(!(await jm.$('.dday')), '머리말 칩 없음');
  await jm.click('.ubox__mid'); await jm.waitForSelector('#an-start');
  assert.strictEqual(await jm.getAttribute('[data-act="anniv-label"][aria-pressed="true"]', 'data-v'), '단짝이 된 지', '기본 이름');
  await jm.fill('#an-start', '2026-11-01'); await jm.click('[data-act="anniv-save"]'); await jm.waitForTimeout(150);
  assert.match(await jm.textContent('.anniv-form .rform__error'), /지난 날/, '미래 날짜는 막힘');
  await jm.fill('#an-start', '2025-07-20'); await jm.click('[data-act="anniv-save"]'); await jm.waitForTimeout(300);
  const cp = docs.get('couple/main');
  assert.strictEqual(cp.start, '2025-07-20'); assert.strictEqual(cp.label, '단짝이 된 지'); assert.ok(cp.updatedBy, '누가 바꿨는지');
  const annivN = Math.round((Date.UTC(2026, 9, 27) - Date.UTC(2025, 6, 20)) / 86400000) + 1; // 시작한 날 = 1일
  assert.strictEqual(await jm.textContent('.abig__count'), annivN + '일');
  assert.ok((await jm.$$('.alist:not(.alist--past) li')).length === 3, '다가오는 기념일 3개');
  await jm.screenshot({ path: path.join(OUT, 'anniv-sheet.png'), fullPage: true });
  await jm.click('.close-btn[data-act="close-anniv"]'); await jm.waitForTimeout(150);
  const boxLine = (p, i) => p.$eval('.ubox__mid', (e, k) => e.getAttribute('aria-label').split(' · ')[k], i || 0); // v52: 모양마다 글자 배치가 달라 읽는 이름으로 비교
  assert.strictEqual(await boxLine(jm), '단짝이 된 지 ' + annivN + '일', '박스: 관계 이름 + 며칠');
  assert.match(await boxLine(jm, 1), /^\d[\d,]*일까지 D-\d+$|주년까지 D-\d+$/, '박스: 다음 기념일까지 D-n');
  assert.ok(await jm.$('.ubox--heart .ubox__heart'), 'v52 기본 모양 = 하트 잇기');
  assert.strictEqual(await jm.textContent('.ubox__big'), annivN + '일', '하트 잇기: 큰 숫자');
  await jm.click('[data-act="tab"][data-tab="look"]'); await jm.waitForTimeout(100);
  assert.ok(!(await jm.$('.card.anniv')), '돌아보기엔 기념일 카드 없음 (v51)');
  await toAll(jm);
  await dj.waitForTimeout(200); await toAll(dj);
  assert.strictEqual(await boxLine(dj), '단짝이 된 지 ' + annivN + '일', '짝꿍 박스도 같음');
  await dj.click('.ubox__mid'); await dj.waitForSelector('.abig');
  assert.match(await dj.textContent('.anniv__by'), /준민 님이 10월 27일 정했어요/);
  await dj.click('[data-act="anniv-edit"]'); await dj.click('[data-act="anniv-label"][data-v=""]'); await dj.waitForSelector('#an-label');
  await dj.fill('#an-label', '연애한 지'); await dj.click('[data-act="anniv-save"]'); await dj.waitForTimeout(300);
  assert.strictEqual(docs.get('couple/main').label, '연애한 지');
  assert.strictEqual(await boxLine(jm), '연애한 지 ' + annivN + '일', '짝꿍이 고치면 내 박스도');
  // (v53) 박스 모양: 각자 고르고 각자 화면에서만 — 서버에 안 씀 · 짝꿍 화면은 그대로 · 글자는 그대로
  assert.strictEqual(await dj.getAttribute('[data-act="anniv-box"][aria-pressed="true"]', 'data-v'), 'heart');
  const cpBefore = JSON.stringify(docs.get('couple/main'));
  await dj.click('[data-act="anniv-box"][data-v="ticket"]'); await dj.waitForTimeout(300);
  assert.strictEqual(JSON.stringify(docs.get('couple/main')), cpBefore, 'v53: 모양은 서버에 안 씀');
  assert.match(await dj.textContent('.anniv__by'), /^내가/, '「누가 정했어요」 그대로');
  assert.strictEqual(await dj.getAttribute('[data-act="anniv-box"][aria-pressed="true"]', 'data-v'), 'ticket');
  assert.match(await dj.textContent('.abox + .anniv-form__note'), /내 화면에서만/);
  assert.strictEqual(await dj.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-v')), 'ticket', '누른 버튼에 포커스');
  assert.ok(await dj.$('.ubox--ticket'), '내 박스는 티켓');
  await dj.screenshot({ path: path.join(OUT, 'box-picker.png') });
  await jm.waitForTimeout(200);
  assert.ok(await jm.$('.ubox--heart'), 'v53: 짝꿍 화면은 그대로 하트 잇기');
  // 글자를 고쳐도 내 모양은 그대로
  await dj.click('[data-act="anniv-edit"]'); await dj.click('[data-act="anniv-save"]'); await dj.waitForTimeout(300);
  assert.strictEqual(await dj.getAttribute('[data-act="anniv-box"][aria-pressed="true"]', 'data-v'), 'ticket', '기념일을 저장해도 모양 유지');
  assert.strictEqual(await dj.evaluate(() => Object.keys(localStorage).filter((k) => /^danjjakkung\.box\./.test(k)).map((k) => localStorage.getItem(k)).join()), 'ticket', '이 기기에 사람별로 기억');
  // 준민 폰에서 5가지를 하나씩 (390 · 320)
  for (const st of ['overlap', 'badge', 'ticket', 'polaroid', 'heart']) {
    await jm.click('.ubox [data-act="open-anniv"]'); await jm.waitForSelector('[data-act="anniv-box"]');
    if (await jm.getAttribute('[data-act="anniv-box"][aria-pressed="true"]', 'data-v') !== st) { await jm.click('[data-act="anniv-box"][data-v="' + st + '"]'); await jm.waitForTimeout(150); }
    await jm.keyboard.press('Escape'); await jm.waitForTimeout(250);
    assert.ok(await jm.$('.ubox--' + st), st + ' 모양으로 바뀜'); await jm.screenshot({ path: path.join(OUT, 'box-' + st + '.png') });
    await jm.setViewportSize({ width: 320, height: 700 }); await jm.waitForTimeout(120);
    assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= 320), st + ' 320px 넘치지 않음');
    await jm.screenshot({ path: path.join(OUT, 'box-' + st + '-320.png') });
    await jm.setViewportSize({ width: 390, height: 844 }); await jm.waitForTimeout(120);
  }
  assert.ok(await dj.$('.ubox--ticket'), '준민이 바꿔도 다진 화면은 티켓');
  // 예전(v52)에 둘이 고른 모양이 있으면, 아직 안 고른 기기는 그걸 처음 값으로
  await jm.evaluate(() => { Object.keys(localStorage).filter((k) => /^danjjakkung\.box\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
  docs.set('couple/main', Object.assign({}, docs.get('couple/main'), { box: 'polaroid' })); await pushAll(['couple/main']);
  const jmTab = await open(browser, '준민(새 탭)', { ctx: jm.context() }); // 같은 기기 · 새로 연 앱 (아직 안 고름)
  await toAll(jmTab); await jmTab.waitForSelector('.ubox');
  assert.ok(await jmTab.$('.ubox--polaroid'), 'v52 공유값을 처음 값으로');
  await jmTab.close(); pages.splice(pages.indexOf(jmTab), 1);
  assert.ok(await dj.$('.ubox--ticket'), '이미 고른 기기는 내 선택 그대로');
  await dj.keyboard.press('Escape'); await dj.waitForTimeout(150);
  assert.ok(!(await dj.$('.sheet')), 'Esc 로 닫힘');
  // (v51) 내 사진: 올리기 → 동그라미 자리 고르기 → 저장하면 짝꿍 박스에도 · 단짝 동그라미는 못 누름 · 지우면 사람 색
  assert.strictEqual(await jm.$$eval('.ubox [data-act="ava-open"]', (e) => e.length), 1, '내 동그라미만 버튼');
  assert.strictEqual(await jm.$eval('.ubox .ubox__face', (e) => e.getAttribute('data-act')), 'ava-open', '왼쪽 = 나');
  assert.strictEqual(await jm.textContent('.ubox .ubox__face .ubox__nm'), '준민'); assert.strictEqual(await dj.textContent('.ubox .ubox__face .ubox__nm'), '다진', '단짝 폰에선 단짝이 왼쪽');
  await jm.click('[data-act="ava-open"]'); await jm.waitForSelector('#ava-title');
  await jm.setInputFiles('#ava-file', path.join(ROOT, 'icons', 'icon-512.png')); await jm.waitForSelector('#acrop-img');
  const vb = await (await jm.$('#acrop-view')).boundingBox();
  await jm.fill('#ava-zoom', '2'); await jm.dispatchEvent('#ava-zoom', 'input');
  await jm.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2); await jm.mouse.down(); await jm.mouse.move(vb.x + vb.width / 2 + 40, vb.y + vb.height / 2 + 20, { steps: 4 }); await jm.mouse.up();
  const tf = await jm.$eval('#acrop-img', (e) => e.style.transform);
  assert.ok(/translate\(/.test(tf), '끌면 사진이 움직임');
  await jm.screenshot({ path: path.join(OUT, 'avatar-crop.png') });
  await jm.click('[data-act="ava-crop-save"]'); await jm.waitForTimeout(400);
  const av = docs.get('avatars/' + jmUid0);
  assert.ok(av && /^data:image\/jpeg;base64,/.test(av.img) && av.img.length <= 120000, 'JPEG 저장 ' + (av && av.img.length));
  const avW = await jm.evaluate((src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.src = src; }), av.img);
  assert.ok(avW >= 384, '크게 보기용으로 384px 이상 저장 (v52) ' + avW);
  assert.match(await jm.getAttribute('[data-act="ava-view"] .ubox__ph', 'style'), /background-image:url\(data:image\/jpeg/);
  await dj.waitForTimeout(200);
  assert.ok((await dj.$$eval('.ubox .ubox__ph', (e) => e.map((x) => x.getAttribute('style') || ''))).some((x) => /data:image\/jpeg/.test(x)), '짝꿍 박스에도 내 사진');
  assert.ok(!(await dj.$('.ubox [data-act="ava-open"] .ubox__ph[style]')), '짝꿍 자기 동그라미는 아직 색');
  await jm.screenshot({ path: path.join(OUT, 'avatar-box.png') });
  // (v52) 사진 크게 보기: 짝꿍 폰에서 내 사진을 누르면 크게 · 바꾸기 버튼은 없음 · Esc/닫기
  await dj.click('[data-act="ava-view"]'); await dj.waitForSelector('.aview__img');
  assert.strictEqual(await dj.textContent('.aview__nm'), '준민');
  assert.ok(!(await dj.$('[data-act="ava-view-edit"]')), '단짝 사진엔 바꾸기 없음');
  const big = await (await dj.$('.aview__img')).boundingBox(); assert.ok(big.width >= 200, '크게 보임 ' + big.width);
  await dj.waitForTimeout(300); await dj.screenshot({ path: path.join(OUT, 'avatar-view.png') });
  await dj.keyboard.press('Escape'); await dj.waitForTimeout(150);
  assert.ok(!(await dj.$('.aview')), 'Esc 로 닫힘');
  assert.strictEqual(await dj.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-act')), 'ava-view', '닫으면 사진 버튼으로 포커스');
  // 내 사진은 크게 보기 → 사진 바꾸기 → 시트
  await jm.click('[data-act="ava-view"]'); await jm.waitForSelector('.aview__img');
  await jm.click('[data-act="ava-view-edit"]'); await jm.waitForSelector('#ava-title');
  assert.ok(!(await jm.$('.aview')), '바꾸기 누르면 크게 보기 닫힘');
  await jm.click('[data-act="ava-delete"]'); await jm.waitForTimeout(300);
  assert.ok(!docs.get('avatars/' + jmUid0), '사진 지우기');
  assert.ok(!(await jm.$('[data-act="ava-open"] .ubox__ph[style]')), '지우면 사람 색');
  assert.ok(!(await jm.$('.ubox [data-act="ava-view"]')), '사진 없으면 크게 보기 버튼 없음');
  await jm.setViewportSize({ width: 320, height: 700 }); await jm.waitForTimeout(150);
  assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= 320), '320px 박스 넘치지 않음');
  await jm.screenshot({ path: path.join(OUT, 'anniv-320.png') });
  await jm.setViewportSize({ width: 390, height: 844 });
  console.log('기념일 · 우리 둘 박스 · 사진 확인 끝 (' + annivN + '일 · 두 폰 · 짝꿍이 고침 · 사진 올리기/지우기 · 320px)');

  // 4-1a3) (v47) 「전체」 탭: 머리말엔 칩만, 설정 줄이 각 시트를 연다, 「사귄」이 어디에도 없다
  const topTxt = (p) => p.$eval('header.top', (h) => h.innerHTML);
  for (const t of ['routine', 'schedule', 'todo', 'look']) {
    await jm.click(`[data-act="tab"][data-tab="${t}"]`); await jm.waitForTimeout(80);
    const top = await topTxt(jm);
    assert.ok(!/sign-out|로그아웃|님으로 접속|open-notify|open-theme/.test(top), t + ' 머리말에 접속 · 로그아웃 · 🔔 · 🎨 없음');
    assert.ok(!/class="dday"/.test(top), t + ' 머리말 칩 없음 (v51)');
  }
  await toAll(jm);
  assert.strictEqual(await jm.textContent('h1.title'), '전체');
  assert.ok(!(await jm.$('.dday')), '「전체」는 머리말 칩 없음');
  assert.strictEqual(await boxLine(jm), '연애한 지 ' + annivN + '일', '우리 둘 박스 = 기념일 문구');
  // 예전에 저장된 「사귄 지」는 「단짝이 된 지」로 보인다
  docs.set('couple/main', Object.assign({}, docs.get('couple/main'), { label: '사귄 지' })); await pushAll(['couple/main']); await jm.waitForTimeout(150);
  assert.strictEqual(await boxLine(jm), '단짝이 된 지 ' + annivN + '일');
  for (const t of ['routine', 'look', 'all']) {
    await jm.click(`[data-act="tab"][data-tab="${t}"]`); await jm.waitForTimeout(80);
    assert.ok(!(await jm.evaluate(() => document.body.innerText)).includes('사귄'), t + ' 화면에 「사귄」 없음');
  }
  await jm.click('.ubox__mid'); await jm.waitForSelector('.abig');
  assert.ok(!(await jm.evaluate(() => document.body.innerText)).includes('사귄'), '기념일 시트에 「사귄」 없음');
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  assert.strictEqual(await jm.evaluate(() => document.activeElement.getAttribute('data-act')), 'open-anniv', '닫으면 기념일 버튼으로');
  await jm.screenshot({ path: path.join(OUT, 'all-tab.png'), fullPage: true });
  // 설정 줄 → 시트
  await jm.click('[data-act="open-notify"]'); await jm.waitForSelector('#notify-title');
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  assert.ok(!(await jm.$('#notify-title')), '알림 시트 Esc');
  await jm.click('[data-act="open-theme"]'); await jm.waitForSelector('#theme-title');
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  assert.strictEqual(await jm.evaluate(() => document.activeElement.getAttribute('data-act')), 'open-theme', '테마 시트 닫으면 그 줄로');
  assert.match(await jm.textContent('[data-act="open-theme"] .arow__vl'), /Soft Pastel|.+/);
  assert.match(await jm.textContent('[data-act="open-account"]'), /준민 님으로 접속/);
  await jm.click('[data-act="open-account"]'); await jm.waitForSelector('#account-title');
  assert.match(await jm.textContent('.sheet__sub'), /준민 님으로 접속 · junmin@example\.com/);
  assert.ok(await jm.$('.sheet [data-act="sign-out"]'), '계정 시트에 로그아웃');
  await jm.screenshot({ path: path.join(OUT, 'all-account.png') });
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100); // 회귀: Esc 로도 닫힘
  assert.ok(!(await jm.$('#account-title')), '계정 시트 Esc');
  await jm.click('[data-act="open-account"]'); await jm.waitForSelector('#account-title');
  await jm.click('.close-btn[data-act="close-account"]'); await jm.waitForTimeout(100);
  assert.ok(!(await jm.$('#account-title')), '계정 시트 닫힘');
  assert.strictEqual(await jm.evaluate(() => document.activeElement.getAttribute('data-act')), 'open-account');
  await jm.click('[data-act="open-account"]'); await jm.waitForSelector('#account-title');
  await jm.goBack(); await jm.waitForTimeout(150); // 뒤로가기 = 시트만 닫기
  assert.ok(!(await jm.$('#account-title')) && !(await jm.$('.exit-box')), '뒤로가기는 계정 시트만 닫음');
  // 좁은 화면: 아래 탭 다섯 · 「전체」 화면이 넘치지 않음
  for (const w of [320, 375]) {
    await jm.setViewportSize({ width: w, height: 700 }); await jm.waitForTimeout(120);
    const fit = await jm.evaluate((W) => {
      const tabs = [...document.querySelectorAll('.tabbar__btn')].every((b) => { const r = b.getBoundingClientRect(), t = b.querySelector('span').getBoundingClientRect(); return r.right <= W + 0.5 && t.left >= r.left - 0.5 && t.right <= r.right + 0.5; });
      return { tabs, page: document.documentElement.scrollWidth <= W };
    }, w);
    assert.ok(fit.tabs && fit.page, w + 'px 「전체」 · 아래 탭 ' + JSON.stringify(fit));
    await jm.screenshot({ path: path.join(OUT, `all-${w}.png`), fullPage: true });
    await jm.click('[data-act="tab"][data-tab="routine"]'); await jm.waitForTimeout(80);
    assert.ok(!(await jm.$('.dday')), w + 'px 머리말 칩 없음 (v51)');
    await jm.screenshot({ path: path.join(OUT, `header-${w}.png`) });
    await toAll(jm);
  }
  await jm.setViewportSize({ width: 390, height: 844 });
  console.log('「전체」 탭 확인 끝 (머리말 · 설정 시트 · 계정 · 뒤로가기 · 320/375px · 「사귄」 없음)');

  // 4-1a4) (v48) 단짝 지도 M2: 지도 열기 · 칠하기 규칙 · 함께 다녀왔어요(단짝이 된 날부터) · 지역 찾기 · 확대 · 짝꿍 화면 실시간
  await toAll(jm); await jm.waitForSelector('.afeat__ds');
  assert.strictEqual(await jm.textContent('.afeat__ds'), '함께 0곳', '「전체」 카드 개수');
  const subs0 = await jm.evaluate(() => window.__colCount());
  await jm.click('[data-act="all-map"]'); await jm.waitForSelector('#km .rg');
  assert.strictEqual(await jm.evaluate(() => window.__colCount()), subs0 + 1, '지도를 열면 places 구독 하나');
  assert.strictEqual(await jm.$$eval('#km .rg', (e) => e.length), 230, '시·군·구 230곳');
  assert.ok(!(await jm.$('header.top')), '지도 화면은 머리말 대신 자기 머리줄');
  assert.strictEqual(await jm.textContent('.mbar__title'), '단짝 지도');
  assert.ok(await jm.$('.tabbar'), '아래 탭은 그대로');
  assert.strictEqual(await jm.textContent('.mchip--both'), '함께 다녀온 곳 0');
  await jm.screenshot({ path: path.join(OUT, 'map.png') });
  const tapRegion = (p, code) => p.$eval(`#km [data-code="${code}"]`, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await tapRegion(jm, '52190'); await jm.waitForSelector('#mapsheet-title');
  assert.strictEqual(await jm.textContent('#mapsheet-title'), '전북 남원시');
  assert.match(await jm.textContent('.sheet__sub'), /아직 함께 가 보지 않은 곳/);
  assert.match(await jm.textContent('.mnote'), /단짝이 된 날\(2025년 7월 20일\)부터/);
  assert.ok(await jm.$('#km .sel'), '고른 지역 테두리');
  await jm.screenshot({ path: path.join(OUT, 'map-sheet-new.png') });
  await jm.click('[data-act="map-visit"]'); await jm.waitForSelector('#mp-date');
  assert.strictEqual(await jm.getAttribute('#mp-date', 'min'), '2025-07-20', '날짜 고르기도 단짝이 된 날부터');
  await jm.fill('#mp-date', '2025-07-01'); await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(150);
  assert.match(await jm.textContent('.rform__error'), /단짝이 된 날/, '단짝이 된 날보다 이르면 저장 안 됨');
  assert.ok(!docs.get('places/52190'), '저장 안 됨');
  await jm.fill('#mp-date', '2025-08-15'); await jm.click('[data-act="map-rec-star"][data-v="4"]'); await jm.fill('#mp-note', '광한루 산책');
  assert.strictEqual(await jm.getAttribute('[data-act="map-rec-star"][data-v="4"]', 'aria-checked'), 'true', '별을 누르면 고른 별 표시 (메모는 그대로)');
  assert.strictEqual(await jm.inputValue('#mp-note'), '광한루 산책');
  await jm.screenshot({ path: path.join(OUT, 'map-record.png') });
  await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(300);
  const nw = docs.get('places/52190'), v1 = nw.visits[0].id;
  assert.strictEqual(nw.visits.length, 1); assert.strictEqual(nw.visits[0].date, '2025-08-15'); assert.ok(!('note' in nw.visits[0]), 'v54: 방문에는 메모 없음'); assert.strictEqual(nw.wishRank, null);
  assert.deepStrictEqual({ stars: nw.entries[jmUid0][v1].stars, note: nw.entries[jmUid0][v1].note }, { stars: 4, note: '광한루 산책' }, '내 기록 = entries.<내 uid>.<방문 id>');
  assert.ok(!('stars' in nw), '지역 별점 칸 없음');
  assert.match(await jm.getAttribute('#km [data-code="52190"]', 'class'), /\bv\b/, '다녀온 곳 = --both 칠함');
  assert.strictEqual(await jm.textContent('.mchip--both'), '함께 다녀온 곳 1');
  assert.match(await jm.textContent('.sheet .mchip--both'), /함께 1번/);
  assert.strictEqual(await jm.textContent('.msum__avg'), '4');
  assert.match(await jm.textContent('.msum__cap'), /별점 1개 평균/);
  assert.match(await jm.textContent('.mvlist'), /2025년 8월 15일 · 1번째[^]*광한루 산책/);
  // 또 다녀왔어요 (별점 · 메모 없이도 됨) → 최근 방문이 위, 가장 최근 것만 펼쳐짐
  await jm.click('[data-act="map-visit"]'); await jm.waitForSelector('#mp-date');
  assert.match(await jm.textContent('#mapsheet-title'), /전북 남원시 · 또 다녀왔어요/);
  assert.match(await jm.textContent('.mrec__nudge'), /단짝에게 「별점을 남겨 주세요」 알림이 가요/);
  await jm.fill('#mp-date', '2026-10-01'); await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(300);
  const v2 = docs.get('places/52190').visits[1].id;
  assert.deepStrictEqual(docs.get('places/52190').visits.map((v) => v.date), ['2025-08-15', '2026-10-01'], '또 다녀왔어요 = 날짜 순');
  assert.ok(!docs.get('places/52190').entries[jmUid0][v2], '비운 기록은 저장 안 함');
  assert.match(await jm.textContent('.mvrow'), /10월 1일 · 2번째/, '최근 것이 위');
  assert.deepStrictEqual(await jm.$$eval('.mvrow', (e) => e.map((x) => x.getAttribute('aria-expanded'))), ['true', 'false'], '가장 최근 방문 하나만 펼침');
  assert.match(await jm.textContent('.mvnote--mine'), /＋ 별점 · 한 줄 남기기/);
  assert.match(await jm.textContent('.mvrow'), /—/, '별점이 없으면 —');
  await jm.screenshot({ path: path.join(OUT, 'map-sheet-visited.png') });
  await jm.click(`.mvrow[data-v="${v1}"]`); await jm.waitForTimeout(80);
  assert.strictEqual(await jm.getAttribute(`.mvrow[data-v="${v1}"]`, 'aria-expanded'), 'true', '접힌 줄을 누르면 펼침');
  assert.strictEqual(await jm.evaluate(() => document.activeElement.getAttribute('data-act')), 'map-visit-toggle', '펼친 뒤 포커스 그대로');
  // 내 칸 → 기록 남기기(고치기): 날짜 없음 · 같은 별 다시 누르면 지움
  await jm.click(`.mvnote--mine[data-v="${v2}"]`); await jm.waitForSelector('.mrec__stars');
  assert.match(await jm.textContent('#mapsheet-title'), /전북 남원시 · 2번째 방문/);
  assert.ok(!(await jm.$('#mp-date')), '고칠 땐 날짜 없음');
  await jm.click('[data-act="map-rec-star"][data-v="3"]'); await jm.click('[data-act="map-rec-star"][data-v="3"]');
  assert.strictEqual(await jm.$$eval('.mrec__star.is-on', (e) => e.length), 0, '같은 별을 다시 누르면 지움');
  await jm.click('[data-act="map-rec-star"][data-v="5"]'); await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(300);
  assert.strictEqual(docs.get('places/52190').entries[jmUid0][v2].stars, 5);
  assert.strictEqual(await jm.textContent('.msum__avg'), '4.5', '평균 = 모든 별점');
  // 단짝 기록이 있는 방문을 지우면 두 사람 기록이 함께 사라짐 (규칙: visits 가 줄어든 쓰기만 단짝 칸을 지울 수 있음)
  const withDj = docs.get('places/52190'); docs.set('places/52190', Object.assign({}, withDj, { entries: Object.assign({}, withDj.entries, { [djUid0]: { [v2]: { stars: 3, note: '바람', at: 'x' } } }) }));
  await pushAll(['places/52190']); await jm.waitForTimeout(150);
  assert.match(await jm.textContent('.msum__people'), /4\.5[^]*· 2번[^]*3[^]*· 1번/, '사람별 평균 · 횟수');
  await jm.click(`.mvnote--mine[data-v="${v2}"]`); await jm.waitForSelector('[data-act="map-visit-delete"]');
  await jm.click('[data-act="map-visit-delete"]'); await jm.waitForTimeout(100);
  assert.match(await jm.textContent('[data-act="map-visit-delete"]'), /한 번 더 누르면/, '한 번 누르면 묻기만');
  assert.strictEqual(docs.get('places/52190').visits.length, 2, '아직 안 지움');
  await jm.screenshot({ path: path.join(OUT, 'map-visit-edit.png') });
  await jm.click('[data-act="map-visit-delete"]'); await jm.waitForTimeout(300);
  assert.deepStrictEqual(docs.get('places/52190').visits.map((v) => v.date), ['2025-08-15'], '두 번째 방문 지움');
  assert.ok(!docs.get('places/52190').entries[djUid0], '단짝 기록도 함께 지움');
  assert.match(await jm.textContent('.sheet .mchip--both'), /함께 1번/);
  // 하나 남은 것도 지우면 칠하기가 빠지고 「아직 함께 가 보지 않은 곳」 — v56: 펼친 줄의 「이 방문 지우기」로 (두 번)
  await jm.click(`[data-act="map-visit-del"][data-v="${v1}"]`); await jm.waitForTimeout(80);
  assert.match(await jm.textContent(`[data-act="map-visit-del"][data-v="${v1}"]`), /한 번 더 누르면/, '처음엔 묻기만');
  assert.strictEqual(docs.get('places/52190').visits.length, 1, '아직 안 지움');
  await jm.screenshot({ path: path.join(OUT, 'map-visit-del.png') });
  await jm.click(`[data-act="map-visit-del"][data-v="${v1}"]`); await jm.waitForTimeout(300);
  assert.strictEqual(docs.get('places/52190').visits.length, 0);
  assert.deepStrictEqual(docs.get('places/52190').entries, {});
  assert.doesNotMatch(await jm.getAttribute('#km [data-code="52190"]', 'class'), /\bv\b/, '다 지우면 칠하기 빠짐');
  assert.match(await jm.textContent('.sheet__sub'), /아직 함께 가 보지 않은 곳/);
  await jm.click('[data-act="map-visit"]'); await jm.fill('#mp-date', '2025-08-15'); await jm.fill('#mp-note', '광한루 산책'); await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(300); // 뒤 시험을 위해 다시
  // 회귀(사용자 제보): 한글 조합 중에 입력칸이 사라져도(저장) 그 뒤 변경이 바로 보임 — 조합 끝 신호가 안 오던 문제
  await jm.click('.mvnote--mine'); await jm.waitForSelector('#mp-note');
  await jm.$eval('#mp-note', (el) => { el.focus(); el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); });
  await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(300);
  const keep52 = docs.get('places/52190');
  docs.set('places/52190', Object.assign({}, keep52, { visits: keep52.visits.concat([{ id: 'zz', date: '2026-10-20', createdAt: 'x', createdBy: 'x' }]) })); await pushAll(['places/52190']); await jm.waitForTimeout(150);
  assert.match(await jm.textContent('.sheet .mchip--both'), /함께 2번/, '조합이 남아도 짝꿍 변경이 바로 반영');
  docs.set('places/52190', keep52); await pushAll(['places/52190']); await jm.waitForTimeout(150);
  assert.match(await jm.textContent('.sheet .mchip--both'), /함께 1번/);
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(120);
  assert.ok(!(await jm.$('#mapsheet-title')), 'Esc 로 시트 닫힘');
  // 짝꿍 화면도 바로 칠해짐
  await toAll(dj); await dj.click('[data-act="all-map"]'); await dj.waitForSelector('#km .rg');
  await dj.waitForFunction(() => /\bv\b/.test((document.querySelector('#km [data-code="52190"]') || {}).getAttribute ? document.querySelector('#km [data-code="52190"]').getAttribute('class') : ''), null, { timeout: 3000 }).catch(() => {});
  assert.match(await dj.getAttribute('#km [data-code="52190"]', 'class'), /\bv\b/, '짝꿍 지도도 칠함');
  // 가고 싶은 곳(빗금) · 다녀온 곳을 또 가고 싶은 곳으로(색 위 빗금) — 순위 숫자는 지도에 없음
  docs.set('places/50110', { code: '50110', wishRank: 1000, wishNote: '', entries: {}, visits: [], updatedBy: 'x', updatedAt: 'x' });
  docs.set('places/52190', Object.assign({}, docs.get('places/52190'), { wishRank: 2000 }));
  await pushAll(['places/50110', 'places/52190']); await jm.waitForTimeout(150);
  assert.match(await jm.getAttribute('#km [data-code="50110"]', 'class'), /\bw\b/, '가고 싶은 곳 = 빗금');
  assert.match(await jm.getAttribute('#km [data-code="52190"]', 'class'), /\bvw\b/, '둘 다 = 색 위 빗금');
  assert.match(await jm.textContent('.mlegend'), /가고 싶은 곳 2/, '또 가기도 가고 싶은 곳에 셈');
  assert.ok(!(await jm.$$eval('#km text', (t) => t.some((x) => /\d/.test(x.textContent)))), '지도 안에 순위 숫자 없음');
  assert.strictEqual(await jm.$eval('#km [data-code="50110"]', (e) => getComputedStyle(e).fill), 'url("#kmhatch")');
  await jm.screenshot({ path: path.join(OUT, 'map-hatch.png') });
  // 지역 찾기 → 고르면 그 지역으로 확대 + 시트
  const vb0 = await jm.getAttribute('#km', 'viewBox');
  await jm.click('[data-act="map-find"]'); await jm.waitForSelector('#mp-q');
  await jm.evaluate(() => { window.__q = document.getElementById('mp-q'); window.__km = document.getElementById('km'); });
  await jm.type('#mp-q', '해운대'); await jm.waitForTimeout(100);
  assert.ok(await jm.evaluate(() => window.__q === document.getElementById('mp-q')), '회귀(점검 AI): 찾는 동안 입력칸을 새로 만들지 않음 (한글 조합이 안 깨지게)');
  assert.strictEqual(await jm.evaluate(() => document.activeElement.id), 'mp-q', '찾는 동안 입력칸 포커스 유지');
  assert.match(await jm.textContent('.mfind__row'), /부산 해운대구/);
  await jm.click('.mfind__row'); await jm.waitForSelector('#mapsheet-title');
  assert.strictEqual(await jm.textContent('#mapsheet-title'), '부산 해운대구');
  assert.notStrictEqual(await jm.getAttribute('#km', 'viewBox'), vb0, '찾은 지역으로 확대');
  await jm.click('.scrim[data-act="map-unsel"]'); await jm.waitForTimeout(100);
  // 확대 버튼
  const vb1 = await jm.getAttribute('#km', 'viewBox');
  await jm.click('[data-act="map-zoom"][data-v="-1"]'); await jm.click('[data-act="map-zoom"][data-v="-1"]'); await jm.click('[data-act="map-zoom"][data-v="-1"]');
  assert.strictEqual(await jm.getAttribute('#km', 'viewBox'), '20 140 840 910', '가장 작게 = 처음 자리');
  await jm.click('[data-act="map-zoom"][data-v="1"]');
  assert.notStrictEqual(await jm.getAttribute('#km', 'viewBox'), '20 140 840 910', '크게');
  // 끌기: 보는 자리가 움직이고, 끈 뒤에 지역 시트가 열리지 않음 / 휠: 확대
  const bb = await (await jm.$('#km')).boundingBox(), vbz = await jm.getAttribute('#km', 'viewBox');
  await jm.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await jm.mouse.down();
  await jm.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 + 30, { steps: 6 }); await jm.mouse.up(); await jm.waitForTimeout(100);
  assert.notStrictEqual(await jm.getAttribute('#km', 'viewBox'), vbz, '끌면 움직임');
  assert.ok(!(await jm.$('#mapsheet-title')), '끈 뒤엔 시트 안 열림');
  const vbw = await jm.getAttribute('#km', 'viewBox');
  await jm.mouse.wheel(0, -200); await jm.waitForTimeout(80);
  assert.ok(parseFloat((await jm.getAttribute('#km', 'viewBox')).split(' ')[2]) < parseFloat(vbw.split(' ')[2]), '휠로 확대');
  assert.ok(await jm.evaluate(() => window.__km === document.getElementById('km')), '회귀(점검 AI): 다시 그려도 지도 <svg> 는 같은 것 (새로 만들지 않음)');
  // 단짝이 된 날을 안 정했으면 먼저 정하게 (나중에 정하면 그 전 기록이 걸리지 않게)
  const cpSaved = docs.get('couple/main'); docs.delete('couple/main'); await pushAll(['couple/main']); await jm.waitForTimeout(120);
  await tapRegion(jm, '52110'); await jm.waitForSelector('#mapsheet-title');
  await jm.click('[data-act="map-visit"]'); await jm.waitForTimeout(100);
  assert.match(await jm.textContent('.sheet__sub'), /먼저 단짝이 된 날을 정해 주세요/);
  assert.ok(await jm.$('.sheet [data-act="open-anniv"]'), '기념일 정하기 버튼');
  docs.set('couple/main', cpSaved); await pushAll(['couple/main']); await jm.waitForTimeout(120);
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  if (await jm.$('#mapsheet-title')) { await jm.click('.scrim[data-act="map-unsel"]'); await jm.waitForTimeout(100); }
  // 뒤로가기 = 「전체」로, 카드 개수 · 미리보기 칸
  await jm.goBack(); await jm.waitForTimeout(150);
  assert.ok(await jm.$('.all') && !(await jm.$('.exit-box')), '뒤로가기는 지도만 닫음');
  assert.strictEqual(await jm.evaluate(() => window.__colCount()), subs0, '지도를 닫으면 places 구독도 끊김');
  assert.strictEqual(await jm.textContent('.afeat__ds'), '함께 1곳');
  assert.ok((await jm.$$('.amap__tile.is-on')).length > 0, '미리보기에 전북 칸 칠함');
  await jm.screenshot({ path: path.join(OUT, 'all-map-card.png') });
  // 다크 테마 · 320px 지도
  await jm.click('[data-act="all-map"]'); await jm.waitForSelector('#km .rg');
  await jm.evaluate(() => RT.themes.apply('cosmic-dream'));
  await jm.setViewportSize({ width: 320, height: 640 }); await jm.waitForTimeout(120);
  assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= 320), '320px 지도 화면 넘치지 않음');
  await jm.screenshot({ path: path.join(OUT, 'map-dark-320.png') });
  await jm.setViewportSize({ width: 390, height: 844 }); await jm.evaluate(() => RT.themes.apply(localStorage.getItem('danjjakkung.theme') || 'soft-pastel'));
  await jm.click('[data-act="tab"][data-tab="all"]'); await jm.waitForSelector('.all'); // 지도에서 「전체」 탭 = 「전체」로
  await dj.click('[data-act="map-close"]');
  console.log('단짝 지도 확인 끝 (230곳 · 칠하기 · 단짝이 된 날 · 찾기 · 확대 · 뒤로 · 짝꿍 실시간)');

  // 4-1a5) (v50) 단짝 지도 M3: 가고 싶은 곳 순위(끼워 넣기 · 끌기 · 다시 매기기) · 다녀온 곳 정렬 · 둘이 각자 별점
  const wishNames = (p) => p.$$eval('#mwish .mrow', (rs) => rs.map((r) => r.querySelector('.mrankno').textContent + ' ' + r.querySelector('.mrow__nm').firstChild.textContent));
  const keyOf = (c) => (docs.get('places/' + c) || {}).wishRank;
  await jm.click('[data-act="all-map"]'); await jm.waitForSelector('#km .rg');
  await jm.click('[data-act="map-seg"][data-v="wish"]'); await jm.waitForSelector('#mwish');
  assert.deepStrictEqual(await wishNames(jm), ['1 제주 제주시', '2 전북 남원시']);
  assert.ok(await jm.$('#mwish .mrow[data-code="52190"] .mchip'), '다녀온 곳을 또 담으면 「또 가기」');
  // 더하기 → 찾기 → 순위 고르기: 맨 끝에서 시작, ↑ 두 번 → 1위
  await jm.click('[data-act="map-wish-add"]'); await jm.waitForSelector('#mp-q'); await jm.type('#mp-q', '강릉'); await jm.click('.mfind__row'); await jm.waitForSelector('#mrank-title');
  assert.strictEqual(await jm.textContent('#mrank-title'), '몇 위로 담을까요');
  assert.strictEqual(await jm.textContent('[data-act="map-rank-save"]'), '3위로 담기', '처음엔 맨 끝');
  await jm.click('[data-act="map-rank-move"][data-v="-1"]'); await jm.click('[data-act="map-rank-move"][data-v="-1"]');
  assert.strictEqual(await jm.textContent('[data-act="map-rank-save"]'), '1위로 담기');
  assert.strictEqual(await jm.textContent('.mrow--new .mrankno'), '1');
  assert.deepStrictEqual(await jm.$$eval('#mrank .mrow--ro .mrankno', (e) => e.map((x) => x.textContent)), ['2', '3'], '다른 줄 번호가 바로 다시 매겨짐');
  await jm.fill('#mp-wnote', '커피거리'); await jm.screenshot({ path: path.join(OUT, 'map-rank.png') });
  await jm.click('[data-act="map-rank-save"]'); await jm.waitForTimeout(300);
  assert.ok(keyOf('51150') < keyOf('50110'), '1위 = 가장 작은 키'); assert.strictEqual(docs.get('places/51150').wishNote, '커피거리');
  assert.deepStrictEqual(await wishNames(jm), ['1 강원 강릉시', '2 제주 제주시', '3 전북 남원시']);
  // 3위에 끼워 넣으면 원래 3위부터 한 칸씩 밀림 · 문서 하나만 고침(중간 키)
  const k3 = keyOf('52190');
  await jm.click('[data-act="map-wish-add"]'); await jm.waitForSelector('#mp-q'); await jm.type('#mp-q', '해운대'); await jm.click('.mfind__row'); await jm.waitForSelector('#mrank-title');
  await jm.click('[data-act="map-rank-move"][data-v="-1"]'); await jm.click('[data-act="map-rank-save"]'); await jm.waitForTimeout(300);
  assert.deepStrictEqual(await wishNames(jm), ['1 강원 강릉시', '2 제주 제주시', '3 부산 해운대구', '4 전북 남원시']);
  assert.strictEqual(keyOf('52190'), k3, '밀린 곳의 키는 그대로');
  assert.strictEqual(keyOf('26350'), (keyOf('50110') + k3) / 2, '사이 중간값');
  // 키 간격이 너무 좁으면 한 번에 다시 매김
  docs.set('places/50110', Object.assign({}, docs.get('places/50110'), { wishRank: 1000 })); docs.set('places/26350', Object.assign({}, docs.get('places/26350'), { wishRank: 1000 + 1e-9 }));
  await pushAll(['places/50110', 'places/26350']); await jm.waitForTimeout(120);
  await jm.click('[data-act="map-wish-add"]'); await jm.waitForSelector('#mp-q'); await jm.type('#mp-q', '속초'); await jm.click('.mfind__row'); await jm.waitForSelector('#mrank-title');
  await jm.click('[data-act="map-rank-move"][data-v="-1"]'); await jm.click('[data-act="map-rank-move"][data-v="-1"]'); await jm.click('[data-act="map-rank-save"]'); await jm.waitForTimeout(400);
  assert.deepStrictEqual(await wishNames(jm), ['1 강원 강릉시', '2 제주 제주시', '3 강원 속초시', '4 부산 해운대구', '5 전북 남원시']);
  const ks = ['51150', '50110', '51210', '26350', '52190'].map(keyOf);
  assert.ok(ks.every((k, i) => i === 0 || k > ks[i - 1]) && new Set(ks).size === 5, '다시 매긴 키가 순서대로 · 겹치지 않음 ' + ks.join(','));
  // 끌어서 순위 바꾸기: 1위 손잡이를 3위 아래로
  const grip = await (await jm.$('#mwish .mrow[data-code="51150"] .mrow__grip')).boundingBox();
  const row3 = await (await jm.$('#mwish .mrow[data-code="51210"]')).boundingBox();
  await jm.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await jm.mouse.down();
  await jm.mouse.move(grip.x + grip.width / 2, row3.y + row3.height * 0.8, { steps: 8 }); await jm.mouse.up(); await jm.waitForTimeout(400);
  assert.deepStrictEqual(await wishNames(jm), ['1 제주 제주시', '2 강원 속초시', '3 강원 강릉시', '4 부산 해운대구', '5 전북 남원시'], '끌어서 3위로');
  await jm.screenshot({ path: path.join(OUT, 'map-wish-list.png'), fullPage: true });
  // 가고 싶은 곳 시트: 함께 다녀왔어요 → 목록에서 빠지고 뒤 순위가 당겨짐
  await jm.click('#mwish .mrow[data-code="51210"] .mrow__main'); await jm.waitForSelector('#mapsheet-title');
  assert.strictEqual(await jm.textContent('.mrankno--big'), '2');
  assert.match(await jm.textContent('.mwhead__sub'), /가고 싶은 곳 2위/);
  await jm.screenshot({ path: path.join(OUT, 'map-sheet-wish.png') });
  await jm.click('[data-act="map-visit"]'); await jm.fill('#mp-date', '2026-10-10'); await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(300);
  assert.strictEqual(keyOf('51210'), null, '다녀오면 가고 싶은 곳에서 빠짐');
  assert.strictEqual(docs.get('places/51210').wishNote, '', '메모도 같이 지움');
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  assert.deepStrictEqual(await wishNames(jm), ['1 제주 제주시', '2 강원 강릉시', '3 부산 해운대구', '4 전북 남원시'], '뒤 순위가 당겨짐');
  // 순위 바꾸기(지금 자리에서 시작) · 빼기
  await jm.click('#mwish .mrow[data-code="26350"] .mrow__main'); await jm.waitForSelector('[data-act="map-rank"]');
  await jm.click('[data-act="map-rank"]'); await jm.waitForSelector('#mrank-title');
  assert.strictEqual(await jm.textContent('#mrank-title'), '몇 위로 옮길까요');
  assert.strictEqual(await jm.textContent('[data-act="map-rank-save"]'), '3위로 옮기기', '지금 자리에서 시작');
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  assert.ok(!(await jm.$('#mrank-title')) && await jm.$('#mapsheet-title'), 'Esc = 순위 화면만 닫힘');
  await jm.click('[data-act="map-unwish"]'); await jm.waitForTimeout(300);
  assert.strictEqual(keyOf('26350'), null, '가고 싶은 곳에서 빼기');
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  // 끌기 중 다시 그려져도 다음 그리기가 막히지 않음 (점검 AI: 끌기 상태가 남던 문제)
  if (!(await jm.$('#mwish'))) await jm.click('[data-act="map-seg"][data-v="wish"]');
  await jm.waitForSelector('#mwish');
  const g2 = await (await jm.$('#mwish .mrow[data-code="50110"] .mrow__grip')).boundingBox();
  await jm.mouse.move(g2.x + 5, g2.y + 5); await jm.mouse.down(); await jm.mouse.move(g2.x + 5, g2.y + 30, { steps: 3 });
  await jm.keyboard.press('Escape'); await jm.click('[data-act="tab"][data-tab="all"]').catch(() => {}); await jm.mouse.up(); await jm.waitForTimeout(150);
  if (!(await jm.$('#mwish'))) { await jm.click('[data-act="all-map"]'); await jm.waitForSelector('#km .rg'); await jm.click('[data-act="map-seg"][data-v="wish"]'); await jm.waitForSelector('#mwish'); }
  docs.set('places/50110', Object.assign({}, docs.get('places/50110'), { wishNote: '바다 보이는 숙소' })); await pushAll(['places/50110']); await jm.waitForTimeout(150);
  assert.match(await jm.textContent('#mwish .mrow[data-code="50110"]'), /바다 보이는 숙소/, '다음 변경이 화면에 반영됨');
  // 다녀온 곳 (v54): 방문마다 각자 별점 · 지역 별점 = 모든 별점 평균 · 정렬
  await jm.click('[data-act="map-seg"][data-v="been"]'); await jm.waitForSelector('.msort');
  await jm.click('.mrow__main[data-v="52190"]'); await jm.waitForSelector('.mvlist');
  assert.match(await jm.textContent('.msum'), /아직 별점이 없어요/, '메모만 남긴 곳은 별점 없음');
  const v52 = docs.get('places/52190').visits[0].id;
  await jm.click(`.mvnote--mine[data-v="${v52}"]`); await jm.waitForSelector('.mrec__stars');
  assert.strictEqual(await jm.inputValue('#mp-note'), '광한루 산책', '고칠 때 내 메모가 들어 있음');
  await jm.click('[data-act="map-rec-star"][data-v="4"]'); await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(300);
  assert.strictEqual(docs.get('places/52190').entries[jmUid0][v52].stars, 4, '내 별점 저장');
  assert.strictEqual(await jm.textContent('.msum__avg'), '4');
  // 회귀: 저장이 실패하면 시트에 남아 알려 주고, 저장된 값은 그대로
  await jm.click(`.mvnote--mine[data-v="${v52}"]`); await jm.waitForSelector('.mrec__stars');
  failPlaces = true; await jm.click('[data-act="map-rec-star"][data-v="2"]'); await jm.click('[data-act="map-visit-save"]'); await jm.waitForTimeout(250);
  assert.match(await jm.textContent('.rform__error'), /저장하지 못했어요/);
  assert.strictEqual(docs.get('places/52190').entries[jmUid0][v52].stars, 4);
  await jm.click('[data-act="map-visit-cancel"]'); await jm.waitForSelector('.mvlist');
  // 단짝: 내 칸만 고칠 수 있음 (단짝 칸은 버튼이 아님)
  await toAll(dj); await dj.click('[data-act="all-map"]'); await dj.waitForSelector('#km .rg');
  await dj.click('[data-act="map-seg"][data-v="been"]'); await dj.click('.mrow__main[data-v="52190"]'); await dj.waitForSelector('.mvlist');
  assert.match(await dj.textContent('.mvbody'), /광한루 산책/, '단짝 화면에 내 메모');
  assert.strictEqual(await dj.$$eval('.mvbody button.mvnote', (e) => e.length), 1, '자기 칸만 버튼');
  await dj.click('.mvnote--mine'); await dj.waitForSelector('.mrec__stars');
  await dj.click('[data-act="map-rec-star"][data-v="5"]'); await dj.click('[data-act="map-visit-save"]'); await dj.waitForTimeout(300);
  assert.strictEqual(docs.get('places/52190').entries[jmUid0][v52].stars, 4, '짝꿍이 매겨도 내 별점은 그대로');
  assert.strictEqual(docs.get('places/52190').entries[djUid0][v52].stars, 5);
  await jm.waitForTimeout(150);
  assert.strictEqual(await jm.textContent('.msum__avg'), '4.5');
  assert.match(await jm.textContent('.mvrow'), /★4[^]*★5/, '접힌 줄에 두 사람 별점');
  assert.match(await jm.textContent('.mvbody'), /한 줄은 안 남겼어요/, '단짝이 별점만 남겼을 때');
  await jm.screenshot({ path: path.join(OUT, 'map-sheet-stars.png') });
  for (const w of [320, 375]) {
    await jm.setViewportSize({ width: w, height: 760 }); await jm.waitForTimeout(100);
    assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.sheet .mbtn, .mvrow, .msum')].every((e) => e.getBoundingClientRect().right <= innerWidth + 0.5)), w + 'px 다녀온 곳 시트 넘침 없음');
    await jm.screenshot({ path: path.join(OUT, 'map-sheet-' + w + '.png') });
  }
  await jm.setViewportSize({ width: 390, height: 844 });
  await dj.keyboard.press('Escape'); await dj.click('[data-act="map-close"]');
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  // 정렬: 별점 순(평균 → 횟수 → 최근, 안 매긴 곳은 뒤) · 최근 순 · 많이 간 순
  const beenNames = () => jm.$$eval('.mlist .mrow__nm', (e) => e.map((x) => x.textContent));
  assert.deepStrictEqual(await beenNames(), ['전북 남원시', '강원 속초시'], '별점 있는 곳이 먼저');
  await jm.click('[data-act="map-sort"][data-v="recent"]'); await jm.waitForTimeout(80);
  assert.deepStrictEqual(await beenNames(), ['강원 속초시', '전북 남원시'], '최근 순');
  await jm.click('[data-act="map-sort"][data-v="many"]'); await jm.waitForTimeout(80);
  assert.strictEqual((await beenNames()).length, 2);
  await jm.screenshot({ path: path.join(OUT, 'map-been.png'), fullPage: true });
  await jm.click('[data-act="map-close"]'); await jm.waitForSelector('.all');
  console.log('단짝 지도 M3 확인 끝 (끼워 넣기 · 중간 키 · 다시 매기기 · 끌기 · 다녀오면 빠짐 · 빼기 · 별점 · 정렬)');

  // 4-1a6) (D2) 단짝 식탁: 처음엔 목표 고르기 → 추천(G1 값) → 고치기 → 계산 근거 확인해야 시작 → 몸 정보는 private, 목표는 goals → 단짝 화면에 내 목표
  await toAll(jm); await jm.waitForSelector('[data-act="all-diet"] .afeat__ds');
  assert.strictEqual(await jm.textContent('[data-act="all-diet"] .afeat__ds'), '목표 정하기');
  await jm.click('[data-act="all-diet"]'); await jm.waitForSelector('#dg-title');
  assert.match(await jm.textContent('.dscreen .caption'), /처음 한 번만/);
  assert.match(await jm.textContent('#dg-reco'), /입력하면 목표를 추천/);
  assert.ok(await jm.$('.dlock'), '「나만 보기」 표시');
  await jm.click('[data-act="dg-goal"][data-v="bulk"]'); await jm.click('[data-act="dg-sex"][data-v="m"]');
  await jm.fill('#dg-age', '25'); await jm.fill('#dg-height', '175'); await jm.evaluate(() => window.__ageEl = document.getElementById('dg-age'));
  await jm.type('#dg-weight', '70');
  assert.ok(await jm.evaluate(() => window.__ageEl === document.getElementById('dg-age')), '입력하는 동안 입력칸을 새로 만들지 않음');
  await jm.click('[data-act="dg-act"][data-v="w3_5"]');
  const recoVals = () => jm.$$eval('#dg-reco .drow__vl', (e) => e.map((x) => x.textContent));
  assert.deepStrictEqual(await recoVals(), ['2,854kcal', '140g', '79g', '395g'], 'G1 추천값');
  assert.strictEqual(await jm.$eval('.ddisc', (e) => e.textContent), '참고용 추천이에요. ' + '의학적 진단·처방이 아니어서 효력이 없어요. 정확한 목표는 의사나 임상영양사 같은 전문가와 상의해 주세요. 질환이 있거나 임신 중이거나 성장기라면 꼭 전문가와 상의해 주세요. 숫자는 언제든 직접 고칠 수 있어요.', '안내 문구 그대로');
  await jm.screenshot({ path: path.join(OUT, 'diet-goal.png'), fullPage: true });
  // 회귀(점검 AI): 「고치기」 → 그대로 「완료」는 고친 값이 아님
  await jm.click('[data-act="dg-edit"][data-v="kcal"]'); await jm.waitForSelector('#dg-e-kcal'); await jm.click('[data-act="dg-edit"][data-v="kcal"]'); await jm.waitForTimeout(60);
  assert.ok(!/고친 값/.test(await jm.textContent('#dg-reco')), '그대로 완료 = 고친 값 아님');
  await jm.click('[data-act="dg-edit"][data-v="protein"]'); await jm.waitForSelector('#dg-e-protein');
  await jm.fill('#dg-e-protein', '150'); await jm.click('[data-act="dg-edit"][data-v="protein"]'); await jm.waitForTimeout(80);
  assert.match(await jm.textContent('#dg-reco'), /150g/); assert.match(await jm.textContent('#dg-reco'), /고친 값/);
  // 처음엔 계산 근거를 확인해야 시작
  await jm.click('[data-act="dg-start"]'); await jm.waitForSelector('#dbasis-title');
  assert.match(await jm.textContent('[data-act="dg-basis-ok"]'), /이 목표로 시작/);
  assert.ok(!docs.get('goals/' + jmUid0), '확인 전엔 저장 안 함');
  await jm.screenshot({ path: path.join(OUT, 'diet-basis.png') });
  await jm.click('[data-act="dg-basis-ok"]'); await jm.waitForTimeout(300);
  const pv = docs.get('private/' + jmUid0), gl = docs.get('goals/' + jmUid0);
  assert.deepStrictEqual(pv.body, { sex: 'm', age: 25, heightCm: 175, weightKg: 70, activity: 'w3_5' }, '몸 정보 = private');
  assert.ok(pv.ackAt, '확인한 때');
  assert.strictEqual(gl.kind, 'bulk'); assert.ok(Math.abs(gl.kcal - 2853.74) < 0.1, '목표 칼로리 소수 그대로'); assert.strictEqual(gl.protein, 150); assert.strictEqual(gl.edited, true);
  assert.deepStrictEqual(pv.edits, { protein: 150 }, '고친 줄만 기록');
  assert.ok(!('weightKg' in gl) && !('body' in gl), '목표 문서엔 몸 정보 없음');
  assert.match(await jm.textContent('.dgc'), /2,854kcal[^]*단 150g/);
  await jm.screenshot({ path: path.join(OUT, 'diet-home.png'), fullPage: true });
  // 다시 열면 고치기 화면은 저장된 값으로 · 근거 확인은 다시 안 물음
  await jm.click('[data-act="dg-open"]'); await jm.waitForSelector('#dg-title');
  assert.strictEqual(await jm.inputValue('#dg-weight'), '70'); assert.match(await jm.textContent('.dscreen .caption'), /내 목표 고치기/);
  assert.match(await jm.textContent('#dg-reco'), /150g[^]*고친 값|고친 값[^]*150g/, '다시 열면 고친 줄만 고친 값');
  assert.match(await jm.textContent('#dg-reco'), /2,854kcal/);
  await jm.click('[data-act="dg-goal"][data-v="cut"]'); await jm.click('[data-act="dg-start"]'); await jm.waitForTimeout(300);
  assert.ok(!(await jm.$('#dbasis-title')), '두 번째부턴 근거 확인 없이 저장');
  const gc = docs.get('goals/' + jmUid0);
  assert.strictEqual(gc.kind, 'cut');
  assert.ok(Math.abs(gc.kcal - 2209.31) < 0.1 && Math.abs(gc.protein - 110.47) < 0.1, '회귀(점검 AI): 목표를 바꾸면 추천 숫자도 바뀜 (벌크업 숫자가 굳지 않음)');
  assert.ok(docs.get('private/' + jmUid0).body.weightKg === 70 && docs.get('private/' + jmUid0).ackAt === pv.ackAt, 'merge: 몸 정보 · 확인한 때 그대로');
  assert.deepStrictEqual(docs.get('private/' + jmUid0).edits, {}, '회귀(점검 AI): 고친 값 목록은 안쪽까지 새 것으로 (옛 protein 150 이 남지 않음)');
  // 단짝: 건너뛰고 직접 입력 → 몸 정보 없이 목표만, 내 목표가 보임
  await toAll(dj); await dj.click('[data-act="all-diet"]'); await dj.waitForSelector('#dg-title');
  await dj.click('[data-act="dg-skip"]'); await dj.waitForSelector('#dg-e-kcal');
  assert.ok(!(await dj.$('#dg-weight')), '직접 입력은 몸 정보 칸 없음');
  await dj.fill('#dg-e-kcal', '20000'); await dj.fill('#dg-e-protein', '80'); await dj.fill('#dg-e-fat', '50'); await dj.fill('#dg-e-carb', '240');
  await dj.click('[data-act="dg-start"]'); await dj.waitForTimeout(100);
  assert.match(await dj.textContent('.dscreen .rform__error'), /너무 커요/, '회귀(점검 AI): 규칙 상한을 넘으면 저장 전에 알림');
  assert.ok(!(await dj.$('#dbasis-title')) && !docs.get('goals/' + djUid0));
  await dj.fill('#dg-e-kcal', '1800');
  await dj.click('[data-act="dg-start"]'); await dj.waitForSelector('#dbasis-title'); await dj.click('[data-act="dg-basis-ok"]'); await dj.waitForTimeout(300);
  assert.ok(!(docs.get('private/' + djUid0) || {}).body, '직접 입력이면 몸 정보 저장 안 함');
  assert.strictEqual(docs.get('goals/' + djUid0).kcal, 1800);
  assert.match(await dj.textContent('.mscreen'), /준민 님 목표[^]*감량/, '단짝 화면에 내 목표(숫자만)');
  assert.ok(!/70kg|175cm|25세/.test(await dj.textContent('.mscreen')), '단짝 화면에 몸 정보 없음');
  await dj.click('[data-act="diet-close"]');
  // 뒤로가기 = 「전체」로, 카드에 내 목표 칼로리
  await jm.goBack(); await jm.waitForTimeout(150);
  assert.ok(await jm.$('.all'), '뒤로가기는 단짝 식탁만 닫음');
  assert.match(await jm.textContent('[data-act="all-diet"] .afeat__ds'), /하루 [\d,]+kcal/);
  // 320px · 어두운 테마
  await jm.click('[data-act="all-diet"]'); await jm.click('[data-act="dg-open"]'); await jm.waitForSelector('#dg-title');
  await jm.setViewportSize({ width: 320, height: 640 }); await jm.evaluate(() => RT.themes.apply('cosmic-dream')); await jm.waitForTimeout(120);
  assert.ok(await jm.evaluate(() => { const s = document.querySelector('.dscreen'); return s.scrollWidth <= s.clientWidth + 1; }), '320px 목표 화면 넘치지 않음');
  await jm.screenshot({ path: path.join(OUT, 'diet-goal-dark-320.png') });
  await jm.setViewportSize({ width: 390, height: 844 }); await jm.evaluate(() => RT.themes.apply(localStorage.getItem('danjjakkung.theme') || 'soft-pastel'));
  await jm.keyboard.press('Escape'); await jm.waitForTimeout(80); await jm.click('[data-act="diet-close"]'); await jm.waitForSelector('.all');
  console.log('단짝 식탁 D2 확인 끝 (추천 · 고치기 · 근거 확인 · private/goals · 직접 입력 · 단짝 화면 · 뒤로 · 320px)');
  // 4-1a7) (D3) 기록하기 → 확인 카드 → 저장 · 정리 대기 · 단짝 화면 · 지우기
  await jm.click('[data-act="all-diet"]'); await jm.waitForSelector('[data-act="dl-open"]');
  assert.match(await jm.textContent('.dtoday'), /아직 오늘 기록이 없어요/);
  await jm.click('[data-act="dl-open"]'); await jm.waitForSelector('#dl-text');
  assert.strictEqual(await jm.evaluate(() => document.activeElement.id), 'dl-text', '열면 바로 적기');
  await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; }, null, { timeout: 8000 });
  await jm.click('[data-act="dl-go"]'); await jm.waitForTimeout(80);
  assert.match(await jm.textContent('.dscreen .rform__error'), /적어 주세요/, '빈 글은 안 됨');
  await jm.fill('#dl-text', '점심 12:40\n-사과 1개\n-계란 2개\n-밥 1.5공기\n-우리집 특제 볶음');
  await jm.click('[data-act="dl-who"][data-v="both"]');
  assert.strictEqual(await jm.inputValue('#dl-text'), '점심 12:40\n-사과 1개\n-계란 2개\n-밥 1.5공기\n-우리집 특제 볶음', '누르는 사이 적은 글 그대로');
  await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('#dc-title');
  assert.strictEqual(await jm.textContent('#dc-title'), '12:40 점심 · 4가지');
  const conf = await jm.textContent('.dconf');
  assert.match(conf, /사과[^]*114[^]*계란[^]*136[^]*밥 · 추정[^]*공기 기본값 210g[^]*우리집 특제 볶음[^]*정리 대기/);
  assert.match(await jm.textContent('.dsum'), /약 [\d,]+ kcal[^]*정리 대기 1줄은 합계에 아직 빠져/);
  await jm.screenshot({ path: path.join(OUT, 'diet-confirm.png') });
  await jm.click('[data-act="dl-back"]'); await jm.waitForSelector('#dl-text');
  assert.match(await jm.inputValue('#dl-text'), /우리집 특제 볶음$/, '돌아가도 글 그대로');
  await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('#dc-title');
  await jm.click('[data-act="dl-save"]'); await jm.waitForSelector('.dmeal');
  const today = await jm.evaluate(() => RT.dates.toKey(RT.dates.fromLocal(new Date())));
  const md = docs.get('meals/' + jmUid0 + '_' + today);
  assert.ok(md && md.meals.length === 1, '하루 문서에 끼니 하나');
  const ml = md.meals[0];
  assert.strictEqual(ml.at, '12:40'); assert.strictEqual(ml.label, '점심'); assert.strictEqual(ml.together, true); assert.strictEqual(ml.status, 'pending');
  assert.deepStrictEqual(ml.pending.map((x) => x.raw), ['우리집 특제 볶음']);
  assert.deepStrictEqual(ml.items.map((x) => x.ref.key), ['사과_생것', '달걀_생것', '쌀밥']);
  assert.strictEqual(ml.items[2].est, '공기 기본값 210g'); assert.strictEqual(ml.items[2].grams, 315);
  assert.match(await jm.textContent('.dtoday'), /12:40[^]*점심[^]*함께[^]*정리 대기 1/);
  await jm.screenshot({ path: path.join(OUT, 'diet-today.png') });
  await dj.click('[data-act="all-diet"]'); await dj.waitForSelector('.dtoday');
  await dj.waitForFunction(() => /준민 님 오늘 [\d,]+kcal · 1끼/.test(document.querySelector('.dtoday').textContent));
  await dj.click('[data-act="diet-close"]');
  // 시각을 안 적으면 지금 · 두 번째 끼니는 시각 순
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '아침 07:30 바나나 2개'); await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('#dc-title'); await jm.click('[data-act="dl-save"]'); await jm.waitForTimeout(250);
  assert.deepStrictEqual(docs.get('meals/' + jmUid0 + '_' + today).meals.map((m) => m.at), ['07:30', '12:40'], '시각 순');
  // 지우기: 한 번 누르면 확인, 두 번째에 지움
  await jm.click('.dmeal [data-act="dm-del"]'); await jm.waitForTimeout(60);
  assert.ok(await jm.$('.dmeal__del.is-armed')); assert.strictEqual(docs.get('meals/' + jmUid0 + '_' + today).meals.length, 2);
  await jm.click('.dmeal__del.is-armed'); await jm.waitForTimeout(250);
  assert.deepStrictEqual(docs.get('meals/' + jmUid0 + '_' + today).meals.map((m) => m.at), ['12:40']);
  // 회귀(점검 AI): 두 끼니는 한 끼씩 안내 · 지난 날짜는 그날 문서로
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '아침 08:20\n사과 1개\n점심 12:40\n김밥'); await jm.click('[data-act="dl-go"]'); await jm.waitForTimeout(80);
  await jm.waitForSelector('#dl-text'); assert.match(await jm.textContent('.dscreen .rform__error'), /한 끼씩[^]*AI 정리를 못 해서/, 'AI 가 안 되면 한 끼씩 안내');
  const yKey = await jm.evaluate(() => { const D = RT.dates, n = D.fromLocal(new Date()) - 1, p = D.parts(n); return [D.toKey(n), p.m + '.' + p.d + '.']; });
  await jm.fill('#dl-text', yKey[1] + '\n저녁 19:00\n사과 1개'); await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('#dc-title');
  assert.match(await jm.textContent('.dscreen .caption'), /기록이에요/, '지난 날짜라고 알려 줌');
  await jm.click('[data-act="dl-save"]'); await jm.waitForTimeout(300);
  assert.deepStrictEqual(docs.get('meals/' + jmUid0 + '_' + yKey[0]).meals.map((m) => m.at), ['19:00'], '어제 문서에');
  assert.strictEqual(docs.get('meals/' + jmUid0 + '_' + today).meals.length, 1, '오늘 문서는 그대로');
  // Esc: 확인 카드 → 기록하기 → 닫기
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '사과 1개'); await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('#dc-title');
  await jm.keyboard.press('Escape'); await jm.waitForSelector('#dl-text'); await jm.keyboard.press('Escape'); await jm.waitForTimeout(100);
  assert.ok(!(await jm.$('#dl-text')) && await jm.$('.dtoday'), 'Esc 두 번이면 첫 화면');
  await jm.setViewportSize({ width: 320, height: 640 }); await jm.waitForTimeout(100);
  assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= 320), '320px 첫 화면 넘치지 않음');
  await jm.setViewportSize({ width: 390, height: 844 });
  await jm.click('[data-act="diet-close"]'); await jm.waitForSelector('.all');
  // (D4 연결) 못 맞춘 줄 → AI 정리 → 숫자는 식품표 · 질문 · 답하고 다시 정리 · 여러 끼니 · AI 실패
  const T1AI = { meals: [{ at: '08:20', kind: 'meal', label: '아침', items: [
    { name: '달걀스크램블', amount: 3, unit: '개', match: { kind: 'table', key: '달걀' } },
    { name: '셀프메이드 브라우니', portion: { num: 9, den: 16 }, match: { kind: 'new_recipe' }, ingredients: [{ name: '바나나', amount: 2, unit: '개', match: { kind: 'table', key: '바나나' } }, { name: '무당초콜릿', amount: 2, unit: '줌', match: { kind: 'new_product' } }] }] }],
    unknowns: [{ path: '아침/셀프메이드 브라우니/무당초콜릿', what: 'product_and_grams', kcalRange: [150, 300] }, { path: '아침/달걀스크램블', what: 'cooking_oil', kcalRange: [0, 120] }], corrections: [], learn: [] };
  aiReplies.push({ delay: 400, body: { result: { result: T1AI, used: 1, limit: 40, model: 'claude-haiku-5-5' } } });
  await jm.click('[data-act="all-diet"]'); await jm.waitForSelector('[data-act="dl-open"]');
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '아침 08:20\n달걀스크램블 3개\n셀프메이드 브라우니 9조각/16조각\n:(바나나2개+무당초콜릿2줌)');
  await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('.dai');
  assert.match(await jm.textContent('.dai'), /AI가 정리하는 중/, '정리하는 동안 알림');
  assert.match(await jm.textContent('[data-act="dl-save"]'), /기다리지 않고 저장/);
  await jm.waitForFunction(() => /AI가 정리했어요/.test(document.querySelector('.dai').textContent));
  const call = aiCalls[aiCalls.length - 1];
  assert.match(call.auth, /^Bearer /); assert.strictEqual(call.data.today, today); assert.match(call.data.text, /무당초콜릿2줌/);
  assert.doesNotMatch(call.data.state, /체중|kg|cm|세\b|목표/, '몸 정보 · 목표는 안 보냄');
  const ct = await jm.textContent('.dconf');
  assert.match(ct, /달걀스크램블[^]*셀프메이드 브라우니 \(무당초콜릿\)[^]*재료 중 모르는 것/, 'AI 구조 + 모르는 재료는 정리 대기');
  assert.strictEqual(await jm.evaluate(() => document.activeElement.id), 'dq-0', '질문에 바로');
  assert.match(await jm.textContent('.dasks'), /1 \/ 2[^]*무당초콜릿 · 어떤 제품이고 몇 g쯤이에요\?[^]*2 \/ 2[^]*달걀스크램블 · 기름/);
  await jm.screenshot({ path: path.join(OUT, 'diet-ai-ask.png') });
  aiReplies.push({ body: { result: { result: { meals: [{ at: '08:20', kind: 'meal', label: '아침', items: [{ name: '달걀스크램블', amount: 3, unit: '개', match: { kind: 'table', key: '달걀' }, ingredients: [{ name: '카놀라유', amount: 1, unit: '스푼', match: { kind: 'table', key: '카놀라유' } }] }] }], unknowns: [] } } } });
  aiReplies[aiReplies.length - 1].delay = 300;
  await jm.fill('#dq-1', '카놀라유 "1스푼"'); await jm.click('[data-act="dq-send"]');
  assert.match(await jm.textContent('.dai'), /정리하는 중/, '회귀(점검 AI): 답하고 다시 정리하면 바로 「정리 중」');
  await jm.waitForFunction(() => /AI가 정리했어요/.test((document.querySelector('.dai') || {}).textContent || '') && !document.querySelector('.dasks'));
  assert.ok(aiCalls[aiCalls.length - 1].data.state.includes('{"대상":"달걀스크램블","물은것":"cooking_oil","답":"카놀라유 \\"1스푼\\""}'), '답은 JSON 으로 (따옴표 그대로)');
  assert.match(await jm.textContent('.dconf'), /\+ 카놀라유/, '새 답이 반영됨');
  await jm.click('[data-act="dl-save"]'); await jm.waitForTimeout(250);
  const lastMeal = docs.get('meals/' + jmUid0 + '_' + today).meals.find((m) => m.at === '08:20');
  assert.ok(lastMeal && lastMeal.ai === true && lastMeal.items[0].name === '달걀스크램블');
  assert.ok(lastMeal.items[0].total.kcal > 204 + 50, '기름까지 더한 값이 저장됨');
  // 회귀(점검 AI): AI 정리 중에 닫고 다시 열어 다른 글을 정리하면 늦은 답이 덮지 않음
  aiReplies.push({ delay: 500, body: { result: { result: { meals: [{ at: '01:00', items: [{ name: '사과', amount: 9, unit: '개', match: { kind: 'table', key: '사과' } }] }], unknowns: [] } } } });
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '우리집 비밀 요리'); await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('.dai');
  await jm.click('[data-act="dl-back"]'); await jm.click('[data-act="dl-close"]');
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '점심 13:00 사과 1개'); await jm.click('[data-act="dl-go"]'); await jm.waitForSelector('#dc-title');
  await jm.waitForTimeout(700);
  assert.strictEqual(await jm.textContent('#dc-title'), '13:00 점심 · 1가지', '늦은 AI 답(01:00 사과 9개)이 덮지 않음');
  await jm.keyboard.press('Escape'); await jm.keyboard.press('Escape'); await jm.waitForTimeout(80);
  // 여러 끼니 한 번에 (AI) → 끼니 2개 저장
  aiReplies.push({ body: { result: { result: { meals: [{ at: '07:00', kind: 'meal', label: '아침', items: [{ name: '사과', amount: 1, unit: '개', match: { kind: 'table', key: '사과' } }] }, { at: '15:00', kind: 'snack', items: [{ name: '바나나', amount: 1, unit: '개', match: { kind: 'table', key: '바나나' } }] }], unknowns: [] } } } });
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '아침 07:00 사과 1개\n간식 15:00 바나나 1개'); await jm.click('[data-act="dl-go"]');
  await jm.waitForFunction(() => /끼니 2개 저장/.test((document.querySelector('[data-act="dl-save"]') || {}).textContent || ''));
  assert.match(await jm.textContent('#dc-title'), /끼니 2개/);
  await jm.click('[data-act="dl-save"]'); await jm.waitForTimeout(250);
  assert.deepStrictEqual(docs.get('meals/' + jmUid0 + '_' + today).meals.map((m) => m.at), ['07:00', '08:20', '12:40', '15:00']);
  // AI 실패 → 정리 대기로 저장할 수 있음
  aiReplies.push({ status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED', message: 'x' } } });
  await jm.click('[data-act="dl-open"]'); await jm.waitForFunction(() => { const b = document.querySelector('[data-act="dl-go"]'); return b && !b.disabled; });
  await jm.fill('#dl-text', '우리집 특제 덮밥'); await jm.click('[data-act="dl-go"]');
  await jm.waitForFunction(() => /많이 했어요/.test((document.querySelector('.dai') || {}).textContent || ''));
  await jm.click('[data-act="dl-save"]'); await jm.waitForTimeout(250);
  assert.ok(docs.get('meals/' + jmUid0 + '_' + today).meals.some((m) => m.pending.some((x) => x.raw === '우리집 특제 덮밥')));
  await jm.click('[data-act="diet-close"]'); await jm.waitForSelector('.all');
  // 회귀(점검 AI): 식품표를 받는 동안 적은 글은 다 받은 뒤에도 그대로
  await dj.route('**/data/foods-kr.json', async (r) => { await new Promise((ok) => setTimeout(ok, 700)); await r.continue(); });
  await dj.evaluate(() => { location.hash = ''; }); 
  await toAll(dj); await dj.click('[data-act="all-diet"]'); await dj.waitForSelector('[data-act="dl-open"]');
  await dj.click('[data-act="dl-open"]'); await dj.waitForSelector('#dl-text');
  const loadingNow = await dj.evaluate(() => document.querySelector('[data-act="dl-go"]').disabled);
  await dj.keyboard.type('사과 1개 바나나');
  await dj.waitForFunction(() => !document.querySelector('[data-act="dl-go"]').disabled, null, { timeout: 8000 });
  assert.strictEqual(await dj.inputValue('#dl-text'), '사과 1개 바나나', '받는 동안 적은 글 그대로 (받는 중이었나: ' + loadingNow + ')');
  await dj.keyboard.press('Escape'); await dj.waitForTimeout(80); await dj.click('[data-act="diet-close"]'); await dj.unroute('**/data/foods-kr.json');
  console.log('단짝 식탁 D3 확인 끝 (기록하기 · 확인 카드 · 정리 대기 · 저장 · 단짝 화면 · 지우기 · Esc · 320px)');
  await jm.click('[data-act="tab"][data-tab="todo"]');

  // 4-1b) 시간표 탭: 매주 · 한 번 · 함께 일정, 주 보기 → 일 보기, 남의 일정은 보기만
  async function addEvent(page, title, opts) {
    await page.click('[data-act="event-add"]');
    await page.fill('#ev-title', title);
    if (opts.both) await page.click('[data-act="ev-owner"][data-v="both"]');
    if (opts.cat) await page.click(`[data-act="ev-cat"][data-v="${opts.cat}"]`);
    if (opts.once) { await page.click('[data-act="ev-repeat"][data-v="once"]'); await page.fill('#ev-date', opts.once); }
    else for (const w of [].concat(opts.wd)) await page.click(`[data-act="ev-wd"][data-v="${w}"]`);
    await page.fill('#ev-start', opts.start); await page.fill('#ev-end', opts.end);
    await page.click('form[data-form="event"] button[type="submit"]');
    await page.waitForTimeout(150);
  }
  await jm.click('[data-act="tab"][data-tab="schedule"]');
  await addEvent(jm, '일반생물', { wd: [1, 3], start: '10:00', end: '12:00', cat: 'class' }); // 화 · 목 한 번에
  console.log('화 · 목 일정:', await jm.$$eval('.sblock[aria-label^="일반생물"]', (e) => e.map((x) => x.getAttribute('aria-label')).join(' / ')));
  await addEvent(jm, '과외', { wd: 1, start: '19:00', end: '21:30' });
  await jm.click('[data-act="event-add"]');
  await jm.fill('#ev-title', '거꾸로'); await jm.fill('#ev-start', '12:00'); await jm.fill('#ev-end', '11:00');
  await jm.click('form[data-form="event"] button[type="submit"]');
  console.log('끝이 시작보다 빠르면:', await jm.textContent('#ev-error'));
  await jm.keyboard.press('Escape');
  await dj.click('[data-act="tab"][data-tab="schedule"]');
  await addEvent(dj, '수업', { wd: 1, start: '09:00', end: '12:00', cat: 'class' });
  await addEvent(dj, '필라테스', { wd: 3, start: '18:00', end: '19:00', cat: 'exercise' });
  await addEvent(dj, '스터디', { once: '2026-10-27', start: '20:30', end: '22:00' });
  await addEvent(dj, '데이트', { both: true, once: '2026-10-31', start: '15:00', end: '19:00' });
  await jm.waitForTimeout(200);
  console.log('주 보기 범위:', await jm.textContent('.grid-range'), '| 블록:', (await jm.$$eval('.sblock', (e) => e.map((x) => x.getAttribute('aria-label')))).join(' / '));
  await jm.screenshot({ path: path.join(OUT, 'web-week.png'), fullPage: true });
  await jm.click('.sblock[aria-label^="수업"]');
  console.log('다진 일정 누르면:', await jm.textContent('.einfo__line'), '|', await jm.textContent('.sheet .muted'));
  await jm.keyboard.press('Escape');
  await dj.waitForTimeout(150);
  await dj.click('.sblock[aria-label^="일반생물"][aria-label*="목요일"]');
  console.log('다진이 본 화 · 목 일정:', await dj.textContent('.einfo__line'));
  await dj.keyboard.press('Escape');
  console.log('닫으면 누른 칸(목)으로:', await dj.evaluate(() => document.activeElement.getAttribute('aria-label')));
  // 한 번 일정 → 매주: 날짜 요일이 골라져 있고, 처음 누른 요일이 그걸 바꾼다
  await jm.click('[data-act="event-add"]');
  await jm.click('[data-act="ev-repeat"][data-v="once"]'); await jm.fill('#ev-date', '2026-10-30');
  await jm.click('[data-act="ev-repeat"][data-v="weekly"]');
  const pr = () => jm.$$eval('[data-act="ev-wd"][aria-pressed="true"]', (e) => e.map((x) => x.textContent).join(''));
  const a1 = await pr(); await jm.click('[data-act="ev-wd"][data-v="0"]'); const a2 = await pr(); await jm.click('[data-act="ev-wd"][data-v="2"]');
  console.log('한 번→매주:', a1, '→ 월 누르면', a2, '→ 수 더하면', await pr());
  await jm.keyboard.press('Escape');
  // 고치기: 화 · 목 이 눌려 있고, 금을 더하면 세 요일 · 목을 빼면 다시 하나
  await jm.click('.sblock[aria-label^="일반생물"]');
  const pressed = () => jm.$$eval('[data-act="ev-wd"][aria-pressed="true"]', (e) => e.map((x) => x.textContent).join(''));
  console.log('고치기 요일:', await pressed());
  await jm.click('[data-act="ev-wd"][data-v="4"]'); console.log('금 더하면:', await pressed());
  await jm.screenshot({ path: path.join(OUT, 'event-multi-weekday.png') });
  await jm.click('[data-act="ev-wd"][data-v="4"]'); await jm.click('[data-act="ev-wd"][data-v="1"]'); await jm.click('[data-act="ev-wd"][data-v="3"]');
  console.log('다 빼면:', await pressed() || '(없음)');
  await jm.click('form[data-form="event"] button[type="submit"]');
  console.log('요일 없이 저장:', await jm.textContent('#ev-error'));
  await jm.keyboard.press('Escape');
  // 요일마다 다른 시간: 화 10–12시 그대로, 목만 16–17시
  await jm.click('.sblock[aria-label^="일반생물"]');
  console.log('시간 칸(같은 시간):', await jm.$$eval('[data-act="ev-timemode"]', (e) => e.map((x) => x.textContent + '=' + x.getAttribute('aria-pressed')).join(' ')), '| 요일별 줄', (await jm.$$('.drow:not(.drow--head)')).length);
  await jm.click('[data-act="ev-timemode"][data-v="per"]');
  console.log('요일마다 누르면:', await jm.$$eval('.drow:not(.drow--head)', (e) => e.map((r) => r.querySelector('b').textContent + ' ' + [...r.querySelectorAll('input')].map((i) => i.value).join('-')).join(' / ')));
  await jm.fill('#ev-ts-3', '16:00'); await jm.fill('#ev-te-3', '15:00');
  await jm.click('form[data-form="event"] button[type="submit"]');
  console.log('목 끝이 빠르면:', await jm.textContent('#ev-error'));
  await jm.fill('#ev-te-3', '17:00');
  await jm.screenshot({ path: path.join(OUT, 'event-perday.png') });
  await jm.click('form[data-form="event"] button[type="submit"]');
  await jm.waitForTimeout(250);
  console.log('요일마다 저장 뒤 블록:', await jm.$$eval('.sblock[aria-label^="일반생물"]', (e) => e.map((x) => x.getAttribute('aria-label')).join(' / ')));
  await dj.waitForTimeout(150);
  await dj.click('.sblock[aria-label^="일반생물"]');
  console.log('다진이 본 요일마다 시간:', await dj.textContent('.einfo__line'));
  await dj.keyboard.press('Escape');
  await jm.click('.sblock[aria-label^="일반생물"][aria-label*="목요일"]');
  console.log('다시 열면:', await jm.getAttribute('[data-act="ev-timemode"][aria-pressed="true"]', 'data-v'), await jm.inputValue('#ev-ts-3'), await jm.inputValue('#ev-te-3'));
  // 금을 더하면 첫 요일(화) 시간으로 채워진다
  await jm.click('[data-act="ev-wd"][data-v="4"]');
  console.log('금 더하면 금 시간:', await jm.inputValue('#ev-ts-4'), await jm.inputValue('#ev-te-4'));
  // 목을 뺐다 다시 고르면 첫 요일(화) 시간 · 같은 시간에서 바꾼 뒤 요일마다로 가면 바꾼 시간
  await jm.click('[data-act="ev-wd"][data-v="3"]'); await jm.click('[data-act="ev-wd"][data-v="3"]');
  console.log('목 다시 고르면:', await jm.inputValue('#ev-ts-3'), await jm.inputValue('#ev-te-3'));
  await jm.click('[data-act="ev-timemode"][data-v="same"]');
  await jm.fill('#ev-start', '13:00'); await jm.fill('#ev-end', '14:00');
  await jm.click('[data-act="ev-timemode"][data-v="per"]');
  console.log('같은 시간 13시로 바꾸고 요일마다:', await jm.$$eval('.drow:not(.drow--head) input', (e) => e.map((i) => i.value).join(' ')));
  await jm.click('[data-act="ev-repeat"][data-v="once"]'); await jm.click('[data-act="ev-repeat"][data-v="weekly"]');
  console.log('한 번→매주 뒤 시간 모드:', await jm.getAttribute('[data-act="ev-timemode"][aria-pressed="true"]', 'data-v'), await jm.inputValue('#ev-start'));
  await jm.keyboard.press('Escape');
  console.log('저장 모양:', JSON.stringify([...docs.entries()].filter(([k, v]) => v && (v.title === '일반생물' || v.title === '과외')).map(([k, v]) => ({ t: v.title, weekday: v.weekday, weekdays: v.weekdays, start: v.start, end: v.end, times: v.times }))));
  // 주 보기: 오늘(화) 목록이 기본, 넓은 블록 · 아이콘, 목요일을 누르면 목록이 바뀜
  console.log('기본 목록:', await jm.textContent('.slist__title-day'), '|', await jm.$$eval('.slist__item', (e) => e.map((x) => x.getAttribute('aria-label')).join(' / ')));
  console.log('넓은 블록:', await jm.$$eval('.sblock--full', (e) => [...new Set(e.map((x) => x.getAttribute('aria-label').split(',')[0]))].join(' · ')), '| 아이콘', await jm.$$eval('.sblock__ico', (e) => [...new Set(e.map((x) => x.textContent))].join('')));
  console.log('한 칸 폭(px): 넓은', await jm.$eval('.sblock--full', (e) => Math.round(e.getBoundingClientRect().width)), '| 반쪽', await jm.$eval('.sblock:not(.sblock--full)', (e) => Math.round(e.getBoundingClientRect().width)));
  await jm.screenshot({ path: path.join(OUT, 'web-week-wide.png'), fullPage: true });
  const thu = await jm.getAttribute('.sday:nth-of-type(4)', 'data-day');
  await jm.click(`.sday[data-day="${thu}"]`);
  console.log('목요일 누르면:', await jm.textContent('.slist__title-day'), '| 모드', await jm.getAttribute('[data-act="sched-mode"][aria-pressed="true"]', 'data-mode'), '| 눌림', await jm.getAttribute(`.sday[data-day="${thu}"]`, 'aria-pressed'), '|', await jm.$$eval('.slist__item', (e) => e.map((x) => x.textContent).join(' / ')));
  await jm.click('.slist__item[aria-label^="필라테스"]');
  console.log('목록에서 누르면:', await jm.textContent('.einfo__line'));
  await jm.keyboard.press('Escape');
  console.log('닫으면 포커스:', await jm.evaluate(() => document.activeElement.getAttribute('data-at')));
  await jm.click('.sday.is-today');
  await jm.click('[data-act="sched-open-day"]');
  console.log('크게 보기 뒤 포커스:', await jm.evaluate(() => document.activeElement.className + ' ' + document.activeElement.getAttribute('aria-pressed')));
  console.log('일 보기:', await jm.textContent('.scard__title'), '|', (await jm.$$eval('.sstatus__row', (e) => e.map((x) => x.textContent))).join(' / '));
  await jm.screenshot({ path: path.join(OUT, 'web-day.png'), fullPage: true });
  // (점검 2) 자정이 지나면 일 보기도 오늘로
  await jm.clock.fastForward('04:00:00');
  await jm.waitForTimeout(300);
  console.log('자정 뒤 일 보기:', await jm.textContent('.scard__title'), '| 지금 카드', !!(await jm.$('.sstatus')));
  await jm.click('.sstrip__btn:nth-child(2)');
  await jm.click('.sblock[aria-label^="일반생물"]');
  console.log('내 일정 누르면 고치기:', await jm.textContent('#event-sheet-title'), await jm.inputValue('#ev-title'));
  await jm.keyboard.press('Escape');
  // (v25) 일 보기: 함께 일정은 한 블록으로 두 칸에 · 블록 글자 가운데 · 지난주로 옮겨도 날짜 줄 자리 그대로
  await jm.click('.sstrip__btn:nth-child(6)');
  const both = await jm.$$eval('.sblock--both', (e) => e.map((x) => { const r = x.getBoundingClientRect(), c = x.parentElement.getBoundingClientRect(); return x.getAttribute('aria-label').split(',')[0] + ':' + Math.round(r.width / c.width * 100) + '%'; }));
  const center = await jm.$eval('.sblock--both', (x) => { const r = x.getBoundingClientRect(), t = x.querySelector('.sblock__title').getBoundingClientRect(), m = x.querySelector('.sblock__time').getBoundingClientRect(); return Math.round((t.left + t.right) / 2 - (r.left + r.right) / 2) + 'px/' + Math.round((t.top + m.bottom) / 2 - (r.top + r.bottom) / 2) + 'px'; });
  console.log('일 보기 함께:', both.join(' '), '| 가운데 어긋남(가로/세로)', center);
  await jm.screenshot({ path: path.join(OUT, 'web-day-both.png'), fullPage: true });
  const rx = () => jm.$eval('.grid-range', (e) => Math.round(e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2) + ',' + Math.round(e.getBoundingClientRect().top));
  const before = await rx(), homeShown = () => jm.$eval('.plan__home', (e) => getComputedStyle(e).visibility + ':' + e.textContent);
  console.log('일 보기 오늘 버튼:', await homeShown());
  await jm.click('.sweeknav [data-act="sched-week"][data-dir="-1"]');
  console.log('일 보기 지난주:', await jm.textContent('.sweeknav .grid-range'), '|', await jm.textContent('.scard__title'), '| 범위 자리', before, '→', await rx(), '| 버튼', await homeShown());
  await jm.screenshot({ path: path.join(OUT, 'web-day-prev.png'), fullPage: true });
  await jm.click('.sweeknav [data-act="sched-week"][data-dir="1"]');
  await jm.click('.sweeknav [data-act="sched-week"][data-dir="1"]');
  console.log('일 보기 다음 주:', await jm.textContent('.scard__title'));
  await jm.click('[data-act="sched-mode"][data-mode="week"]');
  console.log('주 보기로 바꾸면:', await jm.textContent('.grid-range'), '| 고른 요일', await jm.textContent('.slist__title-day'));
  const wx = await rx();
  await jm.click('[data-act="sched-thisweek"]');
  console.log('주 보기 이번 주로:', await jm.textContent('.grid-range'), '| 범위 자리', wx, '→', await rx(), '| 버튼', await homeShown());
  // (v25) 뒤로가기: 시트가 열려 있으면 시트만 닫고, 아니면 「나갈까요?」
  await jm.click('.sblock[aria-label^="데이트"]');
  await jm.goBack();
  await jm.waitForTimeout(200);
  console.log('뒤로(시트 열림): 시트', !!(await jm.$('.sheet')), '| 물음', !!(await jm.$('.exit-box')), '| 주소', jm.url());
  await jm.mouse.click(5, 5);
  await jm.goBack();
  await jm.waitForTimeout(200);
  console.log('뒤로(시트 없음): 물음', await jm.textContent('.exit-box__title').catch(() => '(없음)'));
  await jm.screenshot({ path: path.join(OUT, 'web-back-exit.png') });
  await jm.click('.exit-box [data-exit="stay"]');
  await jm.goBack();
  await jm.waitForTimeout(200);
  console.log('머무른 뒤 다시 뒤로: 물음', !!(await jm.$('.exit-box')), '| 주소', jm.url());
  await jm.click('.exit-box [data-exit="stay"]');
  // (점검 7) 함께 일정은 누구를 바꿀 수 없다 · (점검 1) 각자 일정과 겹쳐도 나란히
  await jm.click('.sblock[aria-label^="데이트"]');
  console.log('함께 일정 고치기:', await jm.textContent('.sheet .field .muted'), '| 누구 버튼', await jm.$$eval('[data-act="ev-owner"]', (e) => e.length));
  await jm.keyboard.press('Escape');
  console.log('데이트 조각:', await jm.$$eval('.sblock--both', (e) => e.map((x) => (x.getAttribute('aria-hidden') || 'read') + ':' + x.style.left).join(' ')));
  await jm.click('[data-act="sched-week"][data-dir="1"]');
  console.log('다음 주:', await jm.textContent('.grid-range'), '| 블록', await jm.$$eval('.sblock', (e) => e.length), '| 이번 주 버튼', !!(await jm.$('[data-act="sched-thisweek"]')));
  await jm.click('[data-act="sched-thisweek"]');
  // (쉬는 날) 매주 일정의 그날만 빼기 — 오늘(목) 일반생물 휴강 → 시간표에서 빠지고 목록에 「쉬어요」, 다진 화면도 같게 → 되돌리기
  const bioKey = [...docs.entries()].find(([k, v]) => v && v.title === '일반생물')[0];
  const bioCount = (p) => p.$$eval('.sblock[aria-label^="일반생물"]', (e) => e.length);
  console.log('쉬기 전 블록:', await bioCount(jm));
  await jm.click('.sblock[aria-label^="일반생물"][aria-label*="목요일"]');
  await jm.waitForSelector('.skipbox');
  console.log('쉬는 날 칸:', await jm.textContent('.skipbox__title'), '|', await jm.$$eval('.skipbox [data-act]', (e) => e.map((x) => x.textContent + '=' + x.dataset.v).join(' / ')));
  await jm.screenshot({ path: path.join(OUT, 'web-skip-sheet.png') });
  await jm.click('[data-act="ev-skip"]:not([data-v^="week:"])');
  await jm.waitForTimeout(250);
  console.log('쉰 뒤: 저장', JSON.stringify(docs.get(bioKey).skip), '| 블록', await bioCount(jm), '| 토스트', await jm.textContent('.toast').catch(() => ''), '| 다진 블록', await bioCount(dj));
  await (await jm.$$('.sday'))[3].click(); // 목요일 목록
  console.log('목록:', await jm.$$eval('.slist__item--skipped', (e) => e.map((x) => x.getAttribute('aria-label')).join(' / ')), '| 포커스', await jm.evaluate(() => document.activeElement.getAttribute('data-act')));
  await jm.screenshot({ path: path.join(OUT, 'web-skip-week.png'), fullPage: true });
  // 고치기에서 이름을 바꿔 저장해도 쉬는 날은 그대로
  await jm.click('.slist__item--skipped');
  console.log('쉬는 날 열기:', await jm.textContent('.skipbox__title'), '| 목록', await jm.$$eval('.chip--rest', (e) => e.map((x) => x.textContent).join(', ')));
  await jm.fill('#ev-short', '일생');
  await jm.click('.sheet [type="submit"]');
  await jm.waitForTimeout(250);
  console.log('저장 뒤 쉬는 날 유지:', JSON.stringify(docs.get(bioKey).skip), docs.get(bioKey).short);
  // 다진(일정 주인 아님): 보기만 + 쉬는 날 안내
  if (await dj.$('[data-act="sched-mode"][data-mode="week"]')) await dj.click('[data-act="sched-mode"][data-mode="week"]').catch(() => {});
  await (await dj.$$('.sday'))[3].click().catch(() => {});
  await dj.waitForTimeout(150);
  const djRest = await dj.$('.slist__item--skipped');
  if (djRest) { await djRest.click(); console.log('다진 보기:', await dj.textContent('.einfo__rest').catch(() => '(안내 없음)'), '| 쉬기 버튼', !!(await dj.$('[data-act="ev-skip"]'))); await dj.keyboard.press('Escape'); }
  else console.log('다진 목록에 쉬는 일정 없음');
  // 되돌리기 → 다시 보인다
  await jm.click('.slist__item--skipped');
  await jm.click('[data-act="ev-unskip"][data-v="' + docs.get(bioKey).skip[0] + '"]');
  await jm.waitForTimeout(250);
  console.log('되돌린 뒤:', JSON.stringify(docs.get(bioKey).skip || null), '| 블록', await bioCount(jm));
  // 이번 주 모두 쉬기 (화 · 목) → 그 주 블록 0, 다음 주는 그대로
  await jm.click('.sblock[aria-label^="일반생물"][aria-label*="화요일"]');
  await jm.click('[data-act="ev-skip"][data-v^="week:"]');
  await jm.waitForTimeout(250);
  console.log('이번 주 모두:', JSON.stringify(docs.get(bioKey).skip), '| 블록', await bioCount(jm));
  await jm.click('[data-act="sched-week"][data-dir="1"]');
  console.log('다음 주 블록:', await bioCount(jm));
  // (v32) 그날만 시간 바꾸기 — 다음 주 화요일 일반생물만 11:00–13:00, 그다음 주는 그대로 → 원래 시간으로
  const bioTimes = (p) => p.$$eval('.sblock[aria-label^="일반생물"]', (e) => e.map((x) => x.getAttribute('aria-label').split(', ').slice(1, 3).join(' ')).join(' / '));
  console.log('바꾸기 전:', await bioTimes(jm));
  await jm.click('.sblock[aria-label^="일반생물"][aria-label*="화요일"]');
  await jm.click('[data-act="ev-move"]');
  console.log('시간 칸:', await jm.textContent('.skipbox__title'), '| 값', await jm.inputValue('#ev-ms-0'), await jm.inputValue('#ev-me-0'));
  await jm.fill('#ev-ms-0', '13:00'); await jm.fill('#ev-me-0', '12:00');
  await jm.click('[data-act="ev-move-save"]');
  console.log('거꾸로:', await jm.textContent('.skipbox .rform__error').catch(() => '(오류 없음)'));
  await jm.fill('#ev-ms-0', '11:00'); await jm.fill('#ev-me-0', '13:00');
  await jm.screenshot({ path: path.join(OUT, 'web-move-sheet.png') });
  await jm.click('[data-act="ev-move-save"]');
  await jm.waitForTimeout(250);
  console.log('바꾼 뒤: 저장', JSON.stringify(docs.get(bioKey).moved), '| 토스트', await jm.textContent('.toast').catch(() => ''), '| 블록', await bioTimes(jm));
  await jm.screenshot({ path: path.join(OUT, 'web-move-week.png'), fullPage: true });
  await dj.click('[data-act="sched-week"][data-dir="1"]').catch(() => {});
  await dj.waitForTimeout(150);
  console.log('다진 화면:', await bioTimes(dj));
  const djMoved = await dj.$('.sblock[aria-label^="일반생물"][aria-label*="시간 바뀜"]');
  if (djMoved) { await djMoved.click(); console.log('다진 보기:', await dj.$$eval('.einfo__rest', (e) => e.map((x) => x.textContent).join(' | '))); await dj.keyboard.press('Escape'); }
  await dj.click('[data-act="sched-thisweek"]').catch(() => {});
  await jm.click('[data-act="sched-week"][data-dir="1"]');
  console.log('그다음 주:', await bioTimes(jm));
  await jm.click('[data-act="sched-week"][data-dir="-1"]');
  // 고치기에서 이름만 바꿔 저장해도 바꾼 시간은 그대로
  await jm.click('.sblock[aria-label^="일반생물"][aria-label*="목요일"]');
  console.log('다른 날 열기: 바꾼 날 목록', await jm.$$eval('[data-act="ev-unmove"]', (e) => e.map((x) => x.textContent).join(', ')));
  await jm.click('.sheet [type="submit"]');
  await jm.waitForTimeout(250);
  console.log('저장 뒤 유지:', JSON.stringify(docs.get(bioKey).moved));
  await jm.click('.sblock[aria-label^="일반생물"][aria-label*="시간 바뀜"]');
  console.log('바뀐 날 열기:', await jm.textContent('.skipbox__title'), '|', await jm.$$eval('.skipbox__row [data-act]', (e) => e.map((x) => x.textContent).join(' / ')));
  await jm.click('.skipbox__row [data-act="ev-unmove"]');
  await jm.waitForTimeout(250);
  console.log('원래 시간으로:', JSON.stringify(docs.get(bioKey).moved || null), '| 블록', await bioTimes(jm));
  // (v35) 반복: 이번 주만 · 언제까지 — 다음 주(11/2 주)에서 추가
  const cnt = (p, t) => p.$$eval(`.sblock[aria-label^="${t}"]`, (e) => e.length);
  await jm.click('[data-act="event-add"]');
  console.log('반복 칩:', await jm.$$eval('[data-act="ev-repeat"]', (e) => e.map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '✓' : '')).join(' ')));
  await jm.fill('#ev-title', '특강');
  await jm.click('[data-act="ev-repeat"][data-v="week"]');
  await jm.click('[data-act="ev-wd"][data-v="3"]');
  console.log('이번 주만 칸:', await jm.textContent('.sheet .field__label:has(+ #ev-from), label:has(#ev-from) .field__label').catch(() => ''), '|', await jm.textContent('#ev-from-note'));
  await jm.fill('#ev-start', '15:00'); await jm.fill('#ev-end', '17:00');
  await jm.click('form[data-form="event"] button[type="submit"]');
  await jm.waitForTimeout(250);
  const skKey = [...docs.entries()].find(([k, v]) => v && v.title === '특강')[0];
  console.log('특강 저장:', JSON.stringify({ from: docs.get(skKey).from, last: docs.get(skKey).last }), '| 이 주', await cnt(jm, '특강'));
  await jm.click('[data-act="event-add"]');
  await jm.fill('#ev-title', '스터디2');
  await jm.click('[data-act="ev-repeat"][data-v="until"]');
  console.log('언제까지 기본:', await jm.inputValue('#ev-until'), '|', await jm.textContent('#ev-from-note'));
  await jm.fill('#ev-until', '2026-10-28');
  await jm.dispatchEvent('#ev-until', 'change');
  console.log('앞 날짜 안내:', await jm.textContent('#ev-from-note'));
  await jm.click('form[data-form="event"] button[type="submit"]');
  console.log('앞 날짜 저장:', await jm.textContent('#ev-error'));
  await jm.fill('#ev-until', '2026-11-12'); await jm.dispatchEvent('#ev-until', 'change');
  console.log('11/12까지:', await jm.textContent('#ev-from-note'));
  await jm.click('[data-act="ev-wd"][data-v="2"]'); await jm.click('[data-act="ev-wd"][data-v="3"]');
  console.log('수 · 목 · 금 고른 뒤:', await jm.textContent('#ev-from-note'));
  await jm.screenshot({ path: path.join(OUT, 'web-until-sheet.png'), fullPage: true });
  await jm.click('[data-act="ev-wd"][data-v="4"]');
  await jm.fill('#ev-start', '13:00'); await jm.fill('#ev-end', '14:00');
  await jm.click('form[data-form="event"] button[type="submit"]');
  await jm.waitForTimeout(250);
  const stKey = [...docs.entries()].find(([k, v]) => v && v.title === '스터디2')[0];
  console.log('스터디2 저장:', JSON.stringify({ from: docs.get(stKey).from, last: docs.get(stKey).last, weekdays: docs.get(stKey).weekdays }));
  const weeks = [];
  for (const dir of [-1, 1, 1, 1]) { await jm.click(`[data-act="sched-week"][data-dir="${dir}"]`); weeks.push((await jm.textContent('.grid-range')) + ' 특강' + (await cnt(jm, '특강')) + ' 스터디' + (await cnt(jm, '스터디2'))); }
  console.log('주마다:', weeks.join(' | '));
  await jm.click('[data-act="sched-week"][data-dir="-1"]');
  await jm.click('.sblock[aria-label^="스터디2"]');
  console.log('고치기 반복:', await jm.$eval('[data-act="ev-repeat"][aria-pressed="true"]', (x) => x.textContent), '| 끝', await jm.inputValue('#ev-until'));
  await jm.click('[data-act="event-delete"]'); await jm.waitForTimeout(450); await jm.click('[data-act="event-delete"]'); await jm.waitForTimeout(250);
  await jm.click('[data-act="sched-week"][data-dir="-1"]');
  await jm.click('.sblock[aria-label^="특강"]');
  console.log('특강 보기 문구 · 반복:', await jm.$eval('[data-act="ev-repeat"][aria-pressed="true"]', (x) => x.textContent));
  await jm.click('[data-act="event-delete"]'); await jm.waitForTimeout(450); await jm.click('[data-act="event-delete"]'); await jm.waitForTimeout(250);
  // (v34) 그 주만 다른 날로: 수 · 금 과외2 → 화 · 목 (다음 주는 그대로)
  await jm.click('[data-act="event-add"]');
  await jm.fill('#ev-title', '과외2');
  await jm.click('[data-act="ev-wd"][data-v="2"]'); await jm.click('[data-act="ev-wd"][data-v="4"]');
  await jm.fill('#ev-start', '20:00'); await jm.fill('#ev-end', '21:30');
  await jm.click('form[data-form="event"] button[type="submit"]');
  await jm.waitForTimeout(250);
  const tuKey = [...docs.entries()].find(([k, v]) => v && v.title === '과외2')[0];
  const tu = (p) => p.$$eval('.sblock[aria-label^="과외2"]', (e) => e.map((x) => x.getAttribute('aria-label').split(', ').slice(1, 3).join(' ')).join(' / '));
  console.log('과외2 처음:', await tu(jm));
  await jm.click('.sblock[aria-label^="과외2"][aria-label*="수요일"]');
  await jm.click('[data-act="ev-move"]');
  console.log('옮길 날 칩:', await jm.$$eval('[data-act="ev-move-day"]', (e) => e.map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '✓' : '')).join(' ')));
  await jm.fill('#ev-ms-0', '19:00'); await jm.fill('#ev-me-0', '20:30');
  await jm.click('[data-act="ev-move-day"]:nth-child(2)'); // 화
  console.log('화 고른 뒤: 버튼', await jm.textContent('[data-act="ev-move-save"]'), '| 시간 그대로', await jm.inputValue('#ev-ms-0'));
  await jm.screenshot({ path: path.join(OUT, 'web-moveday-sheet.png'), fullPage: true });
  await jm.click('[data-act="ev-move-save"]');
  await jm.waitForTimeout(250);
  console.log('수→화:', JSON.stringify(docs.get(tuKey).moved), '| 토스트', await jm.textContent('.toast').catch(() => ''), '| 블록', await tu(jm));
  await jm.click('.sblock[aria-label^="과외2"][aria-label*="금요일"]');
  await jm.click('[data-act="ev-move"]');
  await jm.click('[data-act="ev-move-day"]:nth-child(4)'); // 목
  await jm.click('[data-act="ev-move-save"]');
  await jm.waitForTimeout(250);
  console.log('금→목:', JSON.stringify(docs.get(tuKey).moved), '| 블록', await tu(jm));
  await jm.screenshot({ path: path.join(OUT, 'web-moveday-week.png'), fullPage: true });
  await dj.click('[data-act="sched-week"][data-dir="1"]').catch(() => {});
  await dj.waitForTimeout(150);
  console.log('다진 화면:', await tu(dj));
  const djTu = await dj.$('.sblock[aria-label^="과외2"][aria-label*="화요일"]');
  if (djTu) { await djTu.click(); console.log('다진 보기:', await dj.$$eval('.einfo__rest', (e) => e.map((x) => x.textContent).join(' | '))); await dj.keyboard.press('Escape'); }
  await dj.click('[data-act="sched-thisweek"]').catch(() => {});
  await jm.click('[data-act="sched-week"][data-dir="1"]');
  console.log('그다음 주 과외2:', await tu(jm));
  await jm.click('[data-act="sched-week"][data-dir="-1"]');
  // 화요일로 옮긴 블록을 누르면 원래 날(수) 기준으로 열리고 「원래대로」
  await jm.click('.sblock[aria-label^="과외2"][aria-label*="화요일"]');
  console.log('옮긴 블록 열기:', await jm.textContent('.skipbox__title'), '|', await jm.$$eval('.skipbox__row [data-act]', (e) => e.map((x) => x.textContent).join(' / ')));
  console.log('바꾼 날 목록:', await jm.$$eval('.chip--rest', (e) => e.map((x) => x.textContent).join(', ')));
  await jm.click('.skipbox__row [data-act="ev-unmove"]');
  await jm.waitForTimeout(250);
  console.log('원래대로:', JSON.stringify(docs.get(tuKey).moved), '| 블록', await tu(jm));
  await jm.click('.sblock[aria-label^="과외2"]');
  await jm.click('[data-act="event-delete"]'); await jm.waitForTimeout(450); await jm.click('[data-act="event-delete"]');
  await jm.waitForTimeout(250);
  // (v33) 하루에 여러 번: 다음 주(11/2 주)에 봉사 — 수 08–10 + 18–20 한 일정. 시작하는 주 = 그 주, 앞 주에는 안 보인다
  await jm.click('[data-act="event-add"]');
  console.log('시작하는 주 칸:', await jm.inputValue('#ev-from'), '|', await jm.textContent('#ev-from-note'), '| 모든 주 버튼', !!(await jm.$('[data-act="ev-from"]')));
  await jm.fill('#ev-title', '봉사');
  await jm.click('[data-act="ev-wd"][data-v="2"]');
  await jm.fill('#ev-start', '08:00'); await jm.fill('#ev-end', '10:00');
  await jm.click('[data-act="ev-more-add"]');
  console.log('한 번 더 기본:', await jm.inputValue('#ev-xs-0'), await jm.inputValue('#ev-xe-0'));
  await jm.fill('#ev-xs-0', '09:00'); await jm.fill('#ev-xe-0', '11:00');
  await jm.click('form[data-form="event"] button[type="submit"]');
  console.log('겹치면:', await jm.textContent('#ev-error'));
  await jm.fill('#ev-xs-0', '18:00'); await jm.fill('#ev-xe-0', '20:00');
  await jm.screenshot({ path: path.join(OUT, 'web-more-sheet.png'), fullPage: true });
  await jm.click('form[data-form="event"] button[type="submit"]');
  await jm.waitForTimeout(250);
  const volKey = [...docs.entries()].find(([k, v]) => v && v.title === '봉사')[0];
  const vol = (p) => p.$$eval('.sblock[aria-label^="봉사"]', (e) => e.map((x) => x.getAttribute('aria-label').split(', ')[1]).join(' / '));
  console.log('봉사 저장:', JSON.stringify({ from: docs.get(volKey).from, start: docs.get(volKey).start, more: docs.get(volKey).more }), '| 블록', await vol(jm));
  await jm.screenshot({ path: path.join(OUT, 'web-more-week.png'), fullPage: true });
  await jm.click('[data-act="sched-week"][data-dir="-1"]');
  console.log('앞 주(시작 전) 봉사:', (await vol(jm)) || '(없음)');
  await jm.click('[data-act="sched-week"][data-dir="1"]');
  // 저녁 블록을 눌러도 같은 일정이 열리고, 이날만 시간 바꾸기는 두 시간 다
  await jm.click('.sblock[aria-label^="봉사"][aria-label*="18:00"]');
  console.log('저녁 블록 열기:', await jm.inputValue('#ev-title'), '| 한 번 더 줄', await jm.$$eval('[id^="ev-xs-"]', (e) => e.length));
  await jm.click('[data-act="ev-move"]');
  console.log('이날 시간 줄:', await jm.$$eval('.skipbox .drow:not(.drow--head)', (e) => e.map((x) => x.textContent).join(' / ')), await jm.inputValue('#ev-ms-1'));
  await jm.fill('#ev-ms-1', '19:00'); await jm.fill('#ev-me-1', '21:00');
  await jm.click('[data-act="ev-move-save"]');
  await jm.waitForTimeout(250);
  console.log('봉사 그날만:', JSON.stringify(docs.get(volKey).moved), '| 블록', await vol(jm));
  await jm.click('[data-act="sched-week"][data-dir="1"]');
  console.log('그다음 주 봉사:', await vol(jm));
  // 고치기에서 한 번 더 빼기
  await jm.click('.sblock[aria-label^="봉사"]');
  await jm.click('[data-act="ev-more-del"][data-v="0"]');
  await jm.click('form[data-form="event"] button[type="submit"]');
  await jm.waitForTimeout(250);
  console.log('한 번 더 뺀 뒤:', JSON.stringify(docs.get(volKey).more || null), '| 블록', await vol(jm));
  await jm.click('.sblock[aria-label^="봉사"]');
  await jm.click('[data-act="event-delete"]'); await jm.waitForTimeout(450); await jm.click('[data-act="event-delete"]');
  await jm.waitForTimeout(250);
  await jm.click('[data-act="sched-thisweek"]');

  // 카테고리: 일정 폼의 「편집」 → 둘이 같이 쓰는 목록에서 이름 · 아이콘 바꾸기, 새로 만들기, 지우기
  const bioIcons = (p) => p.$$eval('.sblock[aria-label^="일반생물"] .sblock__ico', (e) => e.map((x) => x.textContent).join(''));
  await jm.click('[data-act="sched-week"][data-dir="1"]'); // 쉬지 않는 다음 주
  await dj.click('[data-act="sched-week"][data-dir="1"]').catch(() => {});
  await jm.click('.sblock[aria-label^="일반생물"]');
  await jm.fill('#ev-title', '일반생물학');                    // 고치던 내용은 카테고리 시트를 다녀와도 남는다
  await jm.click('[data-act="cat-open"]');
  console.log('카테고리 시트:', await jm.textContent('#cat-sheet-title'), '|', await jm.$$eval('.sheet .mitem', (e) => e.map((x) => x.querySelector('.mitem__name').textContent + '(' + x.querySelector('.mitem__status').textContent + ')').join(', ')));
  await jm.click('[data-act="cat-edit"][data-id="class"]');
  await jm.fill('#cat-name', '강의'); await jm.click('[data-act="cat-icon"][data-icon="🎓"]');
  await jm.screenshot({ path: path.join(OUT, 'cat-edit.png') });
  await jm.click('[data-act="cat-save"]'); await jm.waitForTimeout(250);
  console.log('기본 고치기 저장:', JSON.stringify(docs.get('cats/class')), '| 토스트', await jm.textContent('.toast').catch(() => ''));
  await dj.waitForTimeout(150);
  console.log('다진 화면 일반생물 아이콘:', await bioIcons(dj));
  // 같은 이름 · 아이콘 안 고름
  await jm.click('[data-act="cat-new"]');
  await jm.fill('#cat-name', '운동'); await jm.click('[data-act="cat-icon"][data-icon="⚽"]'); await jm.click('[data-act="cat-save"]');
  console.log('같은 이름:', await jm.textContent('#cat-error'));
  await jm.fill('#cat-name', '동아리'); await jm.click('[data-act="cat-icon"][data-icon="⚽"]'); await jm.click('[data-act="cat-icon"][data-icon="⚽"]');
  await jm.press('#cat-name', 'Enter'); await jm.waitForTimeout(250);   // 엔터로 저장 (같은 아이콘 두 번 = 그대로)
  const clubKey = [...docs.keys()].find((k) => k.startsWith('cats/c') && docs.get(k) && docs.get(k).name === '동아리');
  console.log('새 카테고리:', clubKey, JSON.stringify(docs.get(clubKey)), '| 포커스', await jm.evaluate(() => document.activeElement.getAttribute('data-act') + ':' + document.activeElement.getAttribute('data-id')));
  await jm.screenshot({ path: path.join(OUT, 'cat-sheet.png') });
  // (v30) 순서 바꾸기: 동아리를 두 칸 위로 → 바뀐 것만 저장, 끝에선 버튼이 막힘, 짝꿍 · 일정 폼 칩도 같은 순서
  await jm.click('[data-act="cat-sort"]');
  console.log('순서 모드:', await jm.textContent('.mhead__hint'), '| 맨 위 위로 막힘', await jm.$eval('[data-act="cat-move"][data-key="class:-1"]', (e) => e.disabled), '| 새로 만들기 숨김', !(await jm.$('[data-act="cat-new"]')));
  const club = clubKey.slice(5);
  await jm.click(`[data-act="cat-move"][data-key="${club}:-1"]`); await jm.click(`[data-act="cat-move"][data-key="${club}:-1"]`); await jm.waitForTimeout(200);
  console.log('옮긴 뒤:', await jm.$$eval('.sheet .mitem__name', (e) => e.map((x) => x.textContent).join(',')), '| 포커스', await jm.evaluate(() => document.activeElement.getAttribute('data-key')));
  console.log('저장 order:', ['meet', 'etc', club].map((k) => k + '=' + (docs.get('cats/' + k) || {}).order).join(' '), '| 안 바뀐 것 문서 없음', !docs.get('cats/study'));
  await jm.screenshot({ path: path.join(OUT, 'cat-sort.png') });
  await jm.click('[data-act="cat-sort"]');
  await jm.click('.close-btn[data-act="cat-close"]');
  console.log('일정 폼 칩 순서:', await jm.$$eval('[data-act="ev-cat"]', (e) => e.map((x) => x.textContent).join(' ')));
  await jm.click('[data-act="cat-open"]');
  await jm.click('.close-btn[data-act="cat-close"]');
  console.log('일정으로 돌아가기:', await jm.inputValue('#ev-title'), '| 골라진 카테고리', await jm.$$eval('[data-act="ev-cat"][aria-pressed="true"]', (e) => e.map((x) => x.textContent).join()), '| 포커스', await jm.evaluate(() => document.activeElement.getAttribute('data-act')));
  await jm.screenshot({ path: path.join(OUT, 'cat-event-form.png') });
  await jm.click('.sheet [type="submit"]'); await jm.waitForTimeout(250);
  console.log('일정 저장 cat:', docs.get(bioKey).cat === clubKey.slice(5), '| 내 아이콘', await bioIcons(jm), '| 다진', await bioIcons(dj));
  // 기본 카테고리 지우기(표시 남김) · 새로 만든 것 지우기(문서 삭제)
  await jm.click('.sblock[aria-label^="일반생물"]');
  await jm.click('[data-act="cat-open"]');
  await jm.click('[data-act="cat-edit"][data-id="meet"]');
  await jm.click('[data-act="cat-delete"]'); await jm.waitForTimeout(450); await jm.click('[data-act="cat-delete"]'); await jm.waitForTimeout(250);
  console.log('기본(약속) 지우기:', JSON.stringify(docs.get('cats/meet')));
  await jm.click(`[data-act="cat-edit"][data-id="${clubKey.slice(5)}"]`);
  await jm.click('[data-act="cat-delete"]');
  console.log('지우기 안내:', await jm.textContent('.cnote').catch(() => '(없음)'));
  await jm.waitForTimeout(450); await jm.click('[data-act="cat-delete"]'); await jm.waitForTimeout(250);
  console.log('동아리 지우기: 문서', docs.get(clubKey) == null, '| 목록', await jm.$$eval('.sheet .mitem__name', (e) => e.map((x) => x.textContent).join(',')));
  await jm.keyboard.press('Escape'); // 시트 → 일정 폼
  console.log('Esc 뒤 일정 폼 칩:', await jm.$$eval('[data-act="ev-cat"]', (e) => e.map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' ')));
  await jm.keyboard.press('Escape');
  await dj.waitForTimeout(150);
  console.log('지운 뒤 아이콘: 나', JSON.stringify(await bioIcons(jm)), '| 다진', JSON.stringify(await bioIcons(dj)), '| 저장된 cat 그대로', docs.get(bioKey).cat === clubKey.slice(5));
  await jm.click('[data-act="sched-thisweek"]');
  await dj.click('[data-act="sched-thisweek"]').catch(() => {});

  // 오늘 표시 (중립색) · 지금 선
  const todayLook = await jm.evaluate(() => { const d = document.querySelector('.sday.is-today .sday__date'), c = document.querySelector('.scol.is-today'); return getComputedStyle(d).backgroundColor + ' | 칸 ' + getComputedStyle(c).backgroundColor + ' | 지금 선 ' + !!c.querySelector('.snow--week'); });
  console.log('오늘 표시:', todayLook);
  // 쉬는 날 정리: 「쉬는 날」 칩으로 되돌린다 (시트는 열린 채로)
  await jm.click('.slist__item--skipped');
  while (await jm.$('.chip--rest')) { await jm.click('.chip--rest'); await jm.waitForTimeout(200); }
  console.log('칩으로 되돌린 뒤:', JSON.stringify(docs.get(bioKey).skip || null), '| 시트 열림', !!(await jm.$('#event-sheet-title')), '| 블록', await bioCount(jm));
  await jm.keyboard.press('Escape');
  // (점검 8) 알림으로 열면(?tab=routine) 그 탭으로, 주소는 깔끔하게
  await jm.goto(URL + '?tab=routine');
  await jm.waitForSelector('[data-act="tab"][aria-current="page"]');
  console.log('?tab=routine 으로 열기:', await jm.getAttribute('[data-act="tab"][aria-current="page"]', 'data-tab'), '| 주소', await jm.evaluate(() => location.search || '(없음)'));
  await dj.click('[data-act="tab"][data-tab="routine"]');

  // 4-2) 알림: 켜기 → 기기 저장 · 기본 설정(밤 9시) → 설정 바꾸기 → 테스트 → 끄기
  const jmUid = accounts.get('junmin@example.com').uid;
  const jp = await open(browser, '준민(알림)', { push: true, user: { uid: jmUid, email: 'junmin@example.com', emailVerified: true } });
  await toAll(jp);
  console.log('종 버튼(켜기 전):', await jp.getAttribute('[data-act="open-notify"]', 'aria-label'));
  await jp.click('[data-act="open-notify"]');
  await jp.waitForSelector('#notify-title');
  console.log('알림 시트:', await jp.textContent('#notify-title'), '| 켜기 버튼:', await jp.textContent('[data-act="push-on"]'));
  await jp.click('[data-act="push-on"]');
  await jp.waitForSelector('.nbox--on', { timeout: 3000 });
  await jp.waitForTimeout(200);
  console.log('켠 뒤:', await jp.textContent('.nbox--on .nbox__title'), '|', await jp.textContent('.nbox__info'), '| 허용 창:', await jp.evaluate(() => window.__asked));
  const devKeys = [...docs.keys()].filter((k) => k.startsWith('users/' + jmUid + '/devices/'));
  console.log('기기 저장:', devKeys.length, docs.get(devKeys[0]) && docs.get(devKeys[0]).token, '| 기본 설정:', JSON.stringify(docs.get('users/' + jmUid).notify));
  await jp.click('[data-act="pref-partner"]');
  await jp.waitForTimeout(150);
  await jp.selectOption('#nt-remind', '22:30');
  await jp.waitForTimeout(150);
  await jp.click('[data-act="pref-hide"]');
  await jp.waitForTimeout(150);
  console.log('설정 바꿈:', JSON.stringify(docs.get('users/' + jmUid).notify), '| 스위치:', await jp.getAttribute('[data-act="pref-partner"]', 'aria-checked'), await jp.inputValue('#nt-remind'));
  // 일요일 돌아보기 (v37): 처음엔 켜짐, 끄면 weekly:false 만 남고, 다시 켜면 칸이 빠진다 (옛 규칙에서도 저장되게)
  // 일요일 돌아보기 (v37): 처음엔 켜짐. users.weekly 에 따로 저장 — 옛 앱이 notify 를 통째로 저장해도 남는다
  assert.strictEqual(await jp.getAttribute('[data-act="pref-weekly"]', 'aria-checked'), 'true', '돌아보기 알림 처음 켜짐');
  await jp.click('[data-act="pref-weekly"]'); await jp.waitForTimeout(150);
  assert.strictEqual(docs.get('users/' + jmUid).weekly, false, '끄면 users.weekly=false');
  { const d = Object.assign({}, docs.get('users/' + jmUid), { notify: { partner: true, remindAt: null, hide: false } }); docs.set('users/' + jmUid, d); await pushAll(['users/' + jmUid]); await jp.waitForTimeout(150); }
  assert.strictEqual(await jp.getAttribute('[data-act="pref-weekly"]', 'aria-checked'), 'false', '옛 앱이 notify 를 덮어써도 꺼진 채');
  await jp.click('[data-act="pref-weekly"]'); await jp.waitForTimeout(150);
  assert.strictEqual(docs.get('users/' + jmUid).weekly, true, '다시 켬');
  console.log('돌아보기 알림 켬/끔: users.weekly 저장 확인');
  // (v38) 함께 할 일 알림: 짝꿍 알림이 꺼져 있으면 막힘, 켜져 있으면 users.todoNotify 로 따로 저장
  {
    const partnerOn = (await jp.getAttribute('[data-act="pref-partner"]', 'aria-checked')) === 'true';
    console.log('함께 할 일 스위치(짝꿍 알림 ' + (partnerOn ? '켬' : '끔') + '):', await jp.getAttribute('[data-act="pref-todo"]', 'aria-checked'), '| 막힘:', await jp.$eval('[data-act="pref-todo"]', (e) => e.disabled));
    if (!partnerOn) { await jp.click('[data-act="pref-partner"]'); await jp.waitForTimeout(150); }
    assert.strictEqual(await jp.getAttribute('[data-act="pref-todo"]', 'aria-checked'), 'true', '함께 할 일 알림 처음 켜짐');
    await jp.click('[data-act="pref-todo"]'); await jp.waitForTimeout(150);
    assert.strictEqual(docs.get('users/' + jmUid).todoNotify, false, '끄면 users.todoNotify=false');
    assert.strictEqual(docs.get('users/' + jmUid).weekly, true, 'weekly 는 그대로');
    await jp.click('[data-act="pref-todo"]'); await jp.waitForTimeout(150);
    assert.strictEqual(docs.get('users/' + jmUid).todoNotify, true, '다시 켬');
    if (!partnerOn) { await jp.click('[data-act="pref-partner"]'); await jp.waitForTimeout(150); }
    console.log('함께 할 일 알림 켬/끔: users.todoNotify 저장 확인');
  }
  await jp.click('[data-act="push-test"]');
  await jp.waitForTimeout(200);
  console.log('테스트 요청:', [...docs.keys()].filter((k) => k.startsWith('users/' + jmUid + '/pings/')).length, '|', await jp.textContent('.nbox__info'));
  await jp.screenshot({ path: path.join(OUT, 'web-notify.png') });
  await jp.click('[data-act="push-off"]');
  await jp.waitForTimeout(200);
  console.log('끈 뒤:', await jp.textContent('[data-act="push-on"]'), '| 남은 기기:', [...docs.keys()].filter((k) => k.startsWith('users/' + jmUid + '/devices/')).length);
  await jp.keyboard.press('Escape');
  console.log('Esc로 닫힘:', !(await jp.$('#notify-title')), '| 종:', await jp.getAttribute('[data-act="open-notify"]', 'aria-label'));
  await jp.close();

  // 4-3) 아이폰 사파리 탭에서는 홈 화면 앱으로 열라고 안내
  const ip = await open(browser, '아이폰 사파리', { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', user: { uid: accounts.get('dajin@example.com').uid, email: 'dajin@example.com', emailVerified: true } });
  await openSet(ip, 'open-notify');
  console.log('아이폰 사파리 탭:', await ip.textContent('.nbox__title'));
  await ip.close();

  // 4-4) 테마: 처음엔 기본(밝은 화면 → Soft Pastel), 🎨에서 고르면 바로 바뀌고 새로 열어도 그대로. 짝꿍 기기는 그대로.
  const THEME_IDS = ['soft-pastel', 'cosmic-dream', 'ocean-breeze', 'forest-diary', 'vintage-film', 'blue-hour', 'golden-hour', 'sakura-dream', 'midnight-noir', 'arctic-frost', 'chocolate-noir', 'roast-nuts', 'winter-knit', 'harvest'];
  const themeOf = (p) => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await toAll(jm);
  console.log('테마 처음:', await themeOf(jm), '| 계절 칩 없음:', (await jm.$$('.season-chip')).length === 0, '| 🎨:', await jm.getAttribute('[data-act="open-theme"]', 'aria-label'));
  await jm.click('[data-act="open-theme"]');
  console.log('테마 시트:', await jm.textContent('#theme-title'), '| 카드:', (await jm.$$('.tpick')).length, '| 포커스:', await jm.evaluate(() => document.activeElement.getAttribute('data-v')),
    '| 선택 표시:', await jm.getAttribute('.tpick.is-on', 'data-v'), await jm.getAttribute('.tpick.is-on', 'aria-pressed'));
  await jm.screenshot({ path: path.join(OUT, 'theme-sheet-soft-pastel.png') });
  // 카드마다 제 테마 색으로 칠해졌는지 (카드 바탕 = 그 테마의 바탕색)
  console.log('카드 바탕:', (await jm.$$eval('.tpick', (els) => els.map((e) => e.getAttribute('data-v') + '=' + getComputedStyle(e).backgroundColor))).join(' '));
  for (const id of THEME_IDS) {
    await jm.click(`.tpick[data-v="${id}"]`);
    await jm.waitForTimeout(380);
    const st = await jm.evaluate(() => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('danjjakkung.theme'),
      on: document.querySelector('.tpick.is-on') && document.querySelector('.tpick.is-on').getAttribute('data-v'),
      focus: document.activeElement && document.activeElement.getAttribute('data-v'),
      bg: getComputedStyle(document.body).backgroundColor, meta: document.querySelector('meta[name="theme-color"]').content, vbg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      sheet: getComputedStyle(document.querySelector('.sheet')).backgroundColor, theming: document.documentElement.classList.contains('is-theming') }));
    console.log('고름', id, '→', st.t, '| 저장', st.saved, '| 표시', st.on, '| 포커스', st.focus, '| 바탕', st.bg, '| 위 띠', st.meta === st.vbg, '| 시트', st.sheet, '| 전환 끝', !st.theming);
    if (['cosmic-dream', 'ocean-breeze', 'golden-hour', 'midnight-noir', 'harvest'].includes(id)) await jm.screenshot({ path: path.join(OUT, `theme-sheet-${id}.png`) });
  }
  await jm.keyboard.press('Escape');
  console.log('Esc로 닫힘:', (await jm.$$('.sheet')).length === 0, '| 포커스 🎨:', await jm.evaluate(() => document.activeElement.getAttribute('data-act')));
  // 화면마다 14개 테마로 찍어 둔다 (하드코딩 색 · 대비 눈으로 점검)
  for (const id of THEME_IDS) {
    await jm.evaluate((v) => { localStorage.setItem('danjjakkung.theme', v); RT.themes.apply(v); }, id);
    for (const tab of ['routine', 'todo', 'look', 'all', 'schedule']) {
      await jm.click(`[data-act="tab"][data-tab="${tab}"]`);
      await jm.waitForTimeout(120);
      await jm.screenshot({ path: path.join(OUT, `theme-${id}-${tab}.png`), fullPage: true });
      if (tab === 'look') { // v54 R1: 달 보기 카드 · 띠
        await jm.click('[data-act="rv-mode"][data-v="month"]'); await jm.waitForTimeout(120);
        for (const v of ['card', 'strip']) { await jm.click(`[data-act="rv-view"][data-v="${v}"]`); await jm.waitForTimeout(80); await jm.screenshot({ path: path.join(OUT, `theme-${id}-month-${v}.png`), fullPage: true }); }
        await jm.click('[data-act="rv-mode"][data-v="week"]');
      }
      if (tab === 'all') { // v54 R2: 다녀온 곳 시트
        await jm.click('[data-act="all-map"]'); await jm.waitForSelector('#km .rg'); await jm.click('[data-act="map-seg"][data-v="been"]');
        await jm.click('.mrow__main[data-v="52190"]'); await jm.waitForSelector('.mvlist'); await jm.waitForTimeout(80);
        await jm.screenshot({ path: path.join(OUT, `theme-${id}-map-been.png`) });
        await jm.keyboard.press('Escape'); await jm.click('[data-act="map-close"]'); await jm.waitForSelector('.all');
      }
    }
    // 요일 목록 카드: 화(매주 · 한 번) · 토(함께 · 한 번)
    for (const [i, name] of [[1, 'tue'], [5, 'sat']]) {
      await (await jm.$$('.sday'))[i].click();
      await jm.waitForTimeout(120);
      await jm.evaluate(() => { const l = document.querySelector('.slist'); window.scrollTo(0, l.getBoundingClientRect().top + window.scrollY - 80); });
      await jm.waitForTimeout(60);
      await (await jm.$('.slist')).screenshot({ path: path.join(OUT, `theme-${id}-list-${name}.png`) });
    }
    await jm.click('.sday.is-today');
    await jm.click('[data-act="tab"][data-tab="routine"]');
    await jm.click('.cell.is-today');
    await jm.waitForTimeout(150);
    await jm.screenshot({ path: path.join(OUT, `theme-${id}-daysheet.png`) });
    await jm.keyboard.press('Escape');
  }
  // 파스텔에서 켜진 스위치 · 지금 선 · 채운 버튼이 보이는지 (눈으로 확인용 사진)
  await jm.evaluate(() => { localStorage.setItem('danjjakkung.theme', 'soft-pastel'); RT.themes.apply('soft-pastel'); });
  await openSet(jm, 'open-notify');
  await jm.waitForTimeout(150);
  await jm.screenshot({ path: path.join(OUT, 'theme-soft-pastel-notify.png') });
  await jm.keyboard.press('Escape');
  await jm.click('[data-act="tab"][data-tab="schedule"]');
  await jm.click('[data-act="sched-mode"][data-mode="day"]').catch(() => {});
  await jm.waitForTimeout(150);
  await jm.screenshot({ path: path.join(OUT, 'theme-soft-pastel-day.png'), fullPage: true });
  await jm.click('[data-act="tab"][data-tab="routine"]');
  // 바꿀 때 실제로 스르륵 전환되는지 (선택 표시를 먼저 그린 뒤 색을 바꾼다)
  await openSet(jm, 'open-theme');
  await jm.click('.tpick[data-v="cosmic-dream"]');
  const mid = await jm.evaluate(() => ({ cls: document.documentElement.classList.contains('is-theming'), tr: getComputedStyle(document.querySelector('.sheet')).transitionDuration }));
  await jm.waitForTimeout(400);
  console.log('전환 중:', mid.cls, mid.tr, '| 끝난 뒤:', await jm.evaluate(() => document.documentElement.classList.contains('is-theming')));
  await jm.keyboard.press('Escape');
  await jm.evaluate(() => { localStorage.setItem('danjjakkung.theme', 'midnight-noir'); });
  await jm.reload();
  const early = await jm.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await toAll(jm);
  console.log('새로 열어도:', early, '| 로그인 그대로:', !!(await jm.$('[data-act="open-account"]')), '| 다진 기기:', await themeOf(dj));
  await jm.evaluate(() => localStorage.setItem('danjjakkung.theme', 'no-such-theme'));
  await jm.reload(); await jm.waitForSelector('.title');
  console.log('모르는 테마 값이면 기본:', await themeOf(jm));
  // 4-5) 나 · 상대 색: 테마마다 따로, 내 계정에 저장(다른 기기도 같게), 상대 화면은 그대로
  const vars = (p) => p.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--her', '--her-ink', '--me', '--me-ink'].map((k) => s.getPropertyValue(k).trim()).join(' '); });
  const notifyBefore = JSON.stringify((docs.get('users/' + jmUid) || {}).notify);
  await openSet(jm, 'open-theme');
  await jm.waitForSelector('.tcolors');
  console.log('사람 색 줄:', await jm.$$eval('.tcolors__who', (a) => a.map((x) => x.textContent)), '| 후보:', (await jm.$$('.cpick')).length, '| 기본 값:', await vars(jm));
  console.log('함께 색 후보는 못 고름:', await jm.$$eval('.cpick.is-both', (a) => a.map((x) => x.dataset.who + x.dataset.v + (x.disabled ? ' 잠김' : ' 열림')).join(' ')));
  await jm.click('.cpick[data-who="self"][data-v="#9FD3B5"]');
  await jm.waitForTimeout(100);
  await jm.click('.cpick[data-who="partner"][data-v="#F4A7A3"]');
  await jm.waitForTimeout(150);
  await jm.screenshot({ path: path.join(OUT, 'theme-colors-soft-pastel.png') });
  console.log('고른 뒤 준민:', await vars(jm), '| 저장:', JSON.stringify(docs.get('users/' + jmUid).colors), '| 알림 설정 그대로:', JSON.stringify(docs.get('users/' + jmUid).notify) === notifyBefore);
  console.log('다진 화면은 그대로:', await vars(dj));
  // 상대 색을 내 색으로 → 서로 바뀜
  await jm.click('.cpick[data-who="self"][data-v="#F4A7A3"]');
  await jm.waitForTimeout(150);
  console.log('서로 바꾸기:', JSON.stringify(docs.get('users/' + jmUid).colors['soft-pastel']), '| 표시(나=a, 상대=b):', await jm.$$eval('.cpick[aria-pressed="true"]', (a) => a.map((x) => x.dataset.who + x.dataset.v).join(' ')));
  // 다른 테마로 가면 그 테마 기본색, 거기서 고른 색은 따로
  await jm.click('.tpick[data-v="ocean-breeze"]');
  await jm.waitForTimeout(350);
  console.log('Ocean으로:', await vars(jm), '| 기본으로 버튼 없음:', !(await jm.$('[data-act="reset-colors"]')));
  await jm.click('.cpick[data-who="self"][data-v="#B49AD8"]');
  await jm.waitForTimeout(150);
  await jm.screenshot({ path: path.join(OUT, 'theme-colors-ocean-breeze.png') });
  await jm.click('.tpick[data-v="soft-pastel"]');
  await jm.waitForTimeout(350);
  console.log('Soft로 돌아오면 고른 색 그대로:', await vars(jm));
  // 내 다른 기기: 같은 계정이면 같은 색 (테마는 기기마다)
  const jm2 = await open(browser, '준민 노트북', { user: { uid: jmUid, email: 'junmin@example.com', emailVerified: true } });
  await toAll(jm2);
  await jm2.evaluate(() => { localStorage.setItem('danjjakkung.theme', 'ocean-breeze'); RT.themes.apply('ocean-breeze'); });
  console.log('다른 기기(Ocean):', await vars(jm2));
  // 다른 기기에서 바꾸면 이 기기도 바로 바뀐다
  await jm2.click('[data-act="open-theme"]');
  await jm2.click('.tpick[data-v="soft-pastel"]');
  await jm2.waitForTimeout(350);
  await jm2.click('[data-act="reset-colors"]');
  await jm2.waitForTimeout(150);
  console.log('기본으로(다른 기기) → 이 기기:', await vars(jm), '| 저장:', JSON.stringify(docs.get('users/' + jmUid).colors));
  // 새로 열 때 깜빡임 없이: 그리기 전부터 지난번 색
  await jm.click('.tpick[data-v="ocean-breeze"]');
  await jm.waitForTimeout(350);
  await jm.keyboard.press('Escape');
  await jm.reload();
  console.log('새로 열자마자:', await vars(jm));
  await jm2.close();
  // 다진도 자기 화면에서 따로 고른다 (준민 화면에는 영향 없음)
  await openSet(dj, 'open-theme');
  await dj.waitForSelector('.tcolors');
  console.log('다진 사람 색 줄:', await dj.$$eval('.tcolors__who', (a) => a.map((x) => x.textContent)));
  await dj.click('.cpick[data-who="self"][data-v="#8EC5E8"]');
  await dj.waitForTimeout(150);
  console.log('다진 고른 뒤:', await vars(dj), '| 준민 그대로:', await vars(jm));
  await dj.keyboard.press('Escape');
  // 저장이 막힌 브라우저: 고른 테마가 표시 · 머리말 · 다크 모드 변화에 흔들리지 않는다
  const bl = await open(browser, '저장 막힘', { user: { uid: accounts.get('dajin@example.com').uid, email: 'dajin@example.com', emailVerified: true } });
  await toAll(bl);
  await bl.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('blocked'); }; });
  await bl.click('[data-act="open-theme"]');
  await bl.click('.tpick[data-v="vintage-film"]');
  await bl.waitForTimeout(350);
  await bl.emulateMedia({ colorScheme: 'dark' });
  await bl.waitForTimeout(350);
  console.log('저장 막힘:', await themeOf(bl), '| 표시', await bl.getAttribute('.tpick.is-on', 'data-v'), '| 🎨', await bl.getAttribute('[data-act="open-theme"]', 'aria-label'));
  await bl.close();
  // 휴대폰이 다크 모드이고 아직 안 골랐으면 Cosmic Dream
  const dk = await open(browser, '다크 모드', { ctx: await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', serviceWorkers: 'block', timezoneId: 'Asia/Seoul' }) });
  console.log('다크 모드 기본:', await themeOf(dk), '| 로그인 화면 바탕:', await dk.evaluate(() => getComputedStyle(document.body).backgroundColor));
  await dk.screenshot({ path: path.join(OUT, 'theme-dark-login.png') });
  await dk.close();

  // 5) 초대 안 된 계정
  const x = await open(browser, '모르는 사람');
  await x.click('[data-act="auth-mode"][data-id="signup"]');
  await x.fill('#au-email', 'stranger@example.com');
  await x.fill('#au-pass', 'pass0000');
  await x.click('form[data-form="auth"] button[type="submit"]');
  await x.waitForSelector('#verify-title');
  console.log('가입 직후(인증 전):', await x.textContent('#verify-title'));
  await x.click('[data-act="verify-check"]');
  await x.waitForTimeout(200);
  console.log('인증 안 하고 누르면:', await x.textContent('.rform__error').catch(() => '(없음)'));
  accounts.get('stranger@example.com').verified = true;
  await x.click('[data-act="verify-check"]');
  await x.waitForTimeout(300);
  console.log('모르는 계정(인증 후):', await x.textContent('.notice__title').catch(() => '(없음)'));

  // 6) 로그아웃 → 다시 로그인하면 이름 그대로
  await openSet(jm, 'open-account'); await jm.waitForSelector('#account-title');
  await Promise.all([jm.waitForNavigation(), jm.click('.sheet [data-act="sign-out"]')]);
  await jm.waitForSelector('#auth-title');
  await jm.fill('#au-email', 'junmin@example.com');
  await jm.fill('#au-pass', 'pass1234');
  await jm.click('form[data-form="auth"] button[type="submit"]');
  await toAll(jm); // 마지막에 본 탭(「전체」)으로 열림
  console.log('다시 로그인:', await jm.textContent('[data-act="open-account"] .arow__ds'));
  await jm.click('[data-act="tab"][data-tab="routine"]');
  await jm.waitForSelector('[data-act="open-manage"]');

  // 7) 앱처럼: 서비스 워커가 파일을 저장해서 인터넷이 끊겨도 열린다
  const swCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const sw = await swCtx.newPage();
  await sw.goto(URL);
  await sw.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 8000 }).catch(() => {});
  if (!(await sw.evaluate(() => !!navigator.serviceWorker.controller))) { await sw.reload(); await sw.waitForTimeout(800); }
  console.log('서비스 워커 작동:', await sw.evaluate(() => !!navigator.serviceWorker.controller));
  await swCtx.setOffline(true);
  await sw.reload();
  await sw.waitForSelector('.title', { timeout: 5000 }).catch(() => {});
  console.log('오프라인에서 열림:', await sw.textContent('.title').catch(() => '(안 열림)'));
  const mf = await (await fetch(URL + 'manifest.webmanifest').catch(() => null));
  await swCtx.close();

  await browser.close();
  server.kill();
})();
