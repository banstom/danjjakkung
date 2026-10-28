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
  var db = {
    enablePersistence: function () { return Promise.resolve(); },
    terminate: function () { return Promise.resolve(); },
    clearPersistence: function () { return Promise.resolve(); },
    doc: function (p) {
      return {
        set: function (v) { if (!allowed()) return Promise.reject(denied()); return window.__set(p, JSON.stringify(v), user.uid); },
        delete: function () { if (!allowed()) return Promise.reject(denied()); return window.__set(p, null, user.uid); },
        onSnapshot: function (x, y, z) { var next = typeof x === 'function' ? x : y, err = typeof x === 'function' ? y : z; if (!allowed()) { setTimeout(function () { err && err(denied()); }, 10); return function () {}; }
          var f = function () { next(snapDoc(p)); }; docL.add(f); window.__hello(); return function () { docL.delete(f); }; }
      };
    },
    collection: function (c) {
      return {
        onSnapshot: function (x, y, z) {
          // (x, y, z): 옵션을 먼저 받는 형태도 지원 — 바깥의 c(컬렉션 이름)를 가리지 않게 이름을 다르게 둔다
          var next = typeof x === 'function' ? x : y, err = typeof x === 'function' ? y : z;
          if (!allowed()) { setTimeout(function () { err && err(denied()); }, 10); return function () {}; }
          var f = function (changed) {
            var list = Array.from(local.keys()).filter(function (k) { return k.indexOf(c + '/') === 0; }).sort().map(snapDoc);
            var ch = (changed || []).filter(function (k) { return k.indexOf(c + '/') === 0 && local.has(k); }).map(function (k) { return { type: 'added', doc: snapDoc(k) }; });
            next({ docs: list, size: list.length, empty: !list.length, docChanges: function () { return ch; }, metadata: { fromCache: false } });
          };
          colL.add(f); window.__hello(); return function () { colL.delete(f); };
        }
      };
    }
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
    if (p.startsWith('todos/')) { const old = docs.get(p); const sc = (old || d).scope; if (sc !== 'together' && sc !== uid) throw new Error('permission-denied'); if (d && old && d.scope !== old.scope) throw new Error('permission-denied'); }
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
  console.log('다진 화면 준민 할 일 잠김:', await dj.getAttribute(`.tcard--col:has([data-key="${djUid0}"]) ~ .tcard--col .tcheck, .tcols .tcard--col:nth-child(2) .tcheck`, 'aria-disabled'));
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

  // 4-1b) 시간표 탭: 매주 · 한 번 · 함께 일정, 주 보기 → 일 보기, 남의 일정은 보기만
  async function addEvent(page, title, opts) {
    await page.click('[data-act="event-add"]');
    await page.fill('#ev-title', title);
    if (opts.both) await page.click('[data-act="ev-owner"][data-v="both"]');
    if (opts.once) { await page.click('[data-act="ev-repeat"][data-v="once"]'); await page.fill('#ev-date', opts.once); }
    else await page.click(`[data-act="ev-wd"][data-v="${opts.wd}"]`);
    await page.fill('#ev-start', opts.start); await page.fill('#ev-end', opts.end);
    await page.click('form[data-form="event"] button[type="submit"]');
    await page.waitForTimeout(150);
  }
  await jm.click('[data-act="tab"][data-tab="schedule"]');
  await addEvent(jm, '일반생물', { wd: 1, start: '10:00', end: '12:00' });
  await addEvent(jm, '과외', { wd: 1, start: '19:00', end: '21:30' });
  await jm.click('[data-act="event-add"]');
  await jm.fill('#ev-title', '거꾸로'); await jm.fill('#ev-start', '12:00'); await jm.fill('#ev-end', '11:00');
  await jm.click('form[data-form="event"] button[type="submit"]');
  console.log('끝이 시작보다 빠르면:', await jm.textContent('#ev-error'));
  await jm.keyboard.press('Escape');
  await dj.click('[data-act="tab"][data-tab="schedule"]');
  await addEvent(dj, '수업', { wd: 1, start: '09:00', end: '12:00' });
  await addEvent(dj, '스터디', { once: '2026-10-27', start: '20:30', end: '22:00' });
  await addEvent(dj, '데이트', { both: true, once: '2026-10-31', start: '15:00', end: '19:00' });
  await jm.waitForTimeout(200);
  console.log('주 보기 범위:', await jm.textContent('.grid-range'), '| 블록:', (await jm.$$eval('.sblock', (e) => e.map((x) => x.getAttribute('aria-label')))).join(' / '));
  await jm.screenshot({ path: path.join(OUT, 'web-week.png'), fullPage: true });
  await jm.click('.sblock[aria-label^="수업"]');
  console.log('다진 일정 누르면:', await jm.textContent('.einfo__line'), '|', await jm.textContent('.sheet .muted'));
  await jm.keyboard.press('Escape');
  await jm.click('.sday.is-today');
  console.log('일 보기:', await jm.textContent('.scard__title'), '|', (await jm.$$eval('.sstatus__row', (e) => e.map((x) => x.textContent))).join(' / '));
  await jm.screenshot({ path: path.join(OUT, 'web-day.png'), fullPage: true });
  await jm.click('.sblock[aria-label^="일반생물"]');
  console.log('내 일정 누르면 고치기:', await jm.textContent('#event-sheet-title'), await jm.inputValue('#ev-title'));
  await jm.keyboard.press('Escape');
  await jm.click('[data-act="sched-mode"][data-mode="week"]');
  await jm.click('[data-act="sched-week"][data-dir="1"]');
  console.log('다음 주:', await jm.textContent('.grid-range'), '| 블록', await jm.$$eval('.sblock', (e) => e.length), '| 이번 주 버튼', !!(await jm.$('[data-act="sched-thisweek"]')));
  await jm.click('[data-act="sched-thisweek"]');
  await jm.click('[data-act="tab"][data-tab="routine"]');
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
