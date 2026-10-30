// node tests/web.js <shots-dir>
// 사이트판을 http로 띄우고, Firebase 대신 가짜(메모리) 로그인 · 저장소를 끼워서 두 사람 흐름을 확인한다.
const { chromium } = require('playwright');
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
          var f = function () { next(snapDoc(p)); }; docL.add(f); window.__hello(); return function () { docL.delete(f); }; }
      };
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
  const browser = await chromium.launch();

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
  await jp.waitForSelector('[data-act="open-notify"]');
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
  await ip.waitForSelector('[data-act="open-notify"]');
  await ip.click('[data-act="open-notify"]');
  console.log('아이폰 사파리 탭:', await ip.textContent('.nbox__title'));
  await ip.close();

  // 4-4) 테마: 처음엔 기본(밝은 화면 → Soft Pastel), 🎨에서 고르면 바로 바뀌고 새로 열어도 그대로. 짝꿍 기기는 그대로.
  const THEME_IDS = ['soft-pastel', 'cosmic-dream', 'ocean-breeze', 'forest-diary', 'vintage-film', 'blue-hour', 'golden-hour', 'sakura-dream', 'midnight-noir', 'arctic-frost', 'chocolate-noir', 'roast-nuts', 'winter-knit', 'harvest'];
  const themeOf = (p) => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await jm.click('[data-act="tab"][data-tab="routine"]');
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
    for (const tab of ['routine', 'todo', 'schedule']) {
      await jm.click(`[data-act="tab"][data-tab="${tab}"]`);
      await jm.waitForTimeout(120);
      await jm.screenshot({ path: path.join(OUT, `theme-${id}-${tab}.png`), fullPage: true });
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
  await jm.click('[data-act="open-notify"]');
  await jm.waitForTimeout(150);
  await jm.screenshot({ path: path.join(OUT, 'theme-soft-pastel-notify.png') });
  await jm.keyboard.press('Escape');
  await jm.click('[data-act="tab"][data-tab="schedule"]');
  await jm.click('[data-act="sched-mode"][data-mode="day"]').catch(() => {});
  await jm.waitForTimeout(150);
  await jm.screenshot({ path: path.join(OUT, 'theme-soft-pastel-day.png'), fullPage: true });
  await jm.click('[data-act="tab"][data-tab="routine"]');
  // 바꿀 때 실제로 스르륵 전환되는지 (선택 표시를 먼저 그린 뒤 색을 바꾼다)
  await jm.click('[data-act="open-theme"]');
  await jm.click('.tpick[data-v="cosmic-dream"]');
  const mid = await jm.evaluate(() => ({ cls: document.documentElement.classList.contains('is-theming'), tr: getComputedStyle(document.querySelector('.sheet')).transitionDuration }));
  await jm.waitForTimeout(400);
  console.log('전환 중:', mid.cls, mid.tr, '| 끝난 뒤:', await jm.evaluate(() => document.documentElement.classList.contains('is-theming')));
  await jm.keyboard.press('Escape');
  await jm.evaluate(() => { localStorage.setItem('danjjakkung.theme', 'midnight-noir'); });
  await jm.reload();
  const early = await jm.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await jm.waitForSelector('[data-act="open-theme"]');
  console.log('새로 열어도:', early, '| 로그인 그대로:', !!(await jm.$('[data-act="sign-out"]')), '| 다진 기기:', await themeOf(dj));
  await jm.evaluate(() => localStorage.setItem('danjjakkung.theme', 'no-such-theme'));
  await jm.reload(); await jm.waitForSelector('.title');
  console.log('모르는 테마 값이면 기본:', await themeOf(jm));
  // 4-5) 나 · 상대 색: 테마마다 따로, 내 계정에 저장(다른 기기도 같게), 상대 화면은 그대로
  const vars = (p) => p.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--her', '--her-ink', '--me', '--me-ink'].map((k) => s.getPropertyValue(k).trim()).join(' '); });
  const notifyBefore = JSON.stringify((docs.get('users/' + jmUid) || {}).notify);
  await jm.click('[data-act="open-theme"]');
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
  await jm2.waitForSelector('[data-act="open-theme"]');
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
  await dj.click('[data-act="open-theme"]');
  await dj.waitForSelector('.tcolors');
  console.log('다진 사람 색 줄:', await dj.$$eval('.tcolors__who', (a) => a.map((x) => x.textContent)));
  await dj.click('.cpick[data-who="self"][data-v="#8EC5E8"]');
  await dj.waitForTimeout(150);
  console.log('다진 고른 뒤:', await vars(dj), '| 준민 그대로:', await vars(jm));
  await dj.keyboard.press('Escape');
  // 저장이 막힌 브라우저: 고른 테마가 표시 · 머리말 · 다크 모드 변화에 흔들리지 않는다
  const bl = await open(browser, '저장 막힘', { user: { uid: accounts.get('dajin@example.com').uid, email: 'dajin@example.com', emailVerified: true } });
  await bl.waitForSelector('[data-act="open-theme"]');
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
  await Promise.all([jm.waitForNavigation(), jm.click('[data-act="sign-out"]')]);
  await jm.waitForSelector('#auth-title');
  await jm.fill('#au-email', 'junmin@example.com');
  await jm.fill('#au-pass', 'pass1234');
  await jm.click('form[data-form="auth"] button[type="submit"]');
  await jm.waitForSelector('[data-act="open-manage"]');
  console.log('다시 로그인:', await jm.textContent('.caption'));

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
