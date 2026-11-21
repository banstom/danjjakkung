// node --test tests/question-app.test.js — 교환 쪽지 화면 상태 (js/app-question.js) · 그리기 (js/view-question.js) · 규칙 조각
// 지키는 것: 단짝 쪽지는 내 쪽지 없이 구독 · 그리기 어디에도 안 나옴 / 이름은 question-text.js 한 곳 / 「단짝이 된 날 = 1일」 셈이 저장소와 같음
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require('../js/question-text.js'); require('../js/question.js'); require('../js/view-question.js'); require('../js/app-question.js');
const RT = globalThis.RT;
const ROOT = path.join(__dirname, '..');
const J = 'u-junmin', D = 'u-danjjak';

function fakeStore(day) {
  const calls = [];
  const s = {
    calls,
    watchQDay: (date, next) => { calls.push(['day', date]); setImmediate(() => next(day ? Object.assign({ date }, day) : null, false)); return () => {}; },
    watchAnswer: (date, uid, next) => { calls.push(['answer', date, uid]); setImmediate(() => next({ text: uid === D ? '단짝의 비밀 쪽지' : '내 쪽지', at: 1 })); return () => {}; },
    watchOurs: (next) => { setImmediate(() => next([])); return () => {}; },
    loadQDays: () => Promise.resolve([]), createQDay: () => Promise.resolve(true)
  };
  return s;
}
function host(store, now) {
  return { store: () => store, render: () => {}, toast: () => {}, me: () => J, partner: () => D, nameOf: (u) => (u === J ? '준민' : '다진'), slotOf: (u) => (u === J ? 'me' : 'her'),
    since: () => '2026-02-14', focus: () => {}, kung: { ready: () => true, send: () => {} }, now: () => now };
}
const NOW = Date.parse('2026-11-20T21:00:00+09:00');
const tick = () => new Promise((r) => setImmediate(r));

test('QA1 단짝만 남김(잠김): 단짝 쪽지를 구독하지 않고, 화면 값 · HTML 어디에도 글이 없음', async () => {
  const st = fakeStore({ q: 'us-007', text: '우리 둘만 아는 말이 있다면요?', src: 'base', done: { [D]: NOW - 3600000 }, likes: {}, skipped: [] });
  global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(require('../data/questions.json')) });
  global.document = { getElementById: () => null, querySelector: () => null };
  const c = RT.appQuestion.create(host(st, NOW));
  c.tick(); await tick(); c.open(); await tick(); await tick();
  assert.ok(!st.calls.some((x) => x[0] === 'answer' && x[2] === D), '단짝 쪽지 구독 안 함');
  const m = c._screenModel();
  assert.equal(m.state, 'theirs');
  assert.ok(!('text' in m.theirs), '모델에 글 칸 자체가 없음');
  const html = c.screenHtml();
  assert.match(html, /오후 8:00에 접어 둔 쪽지/);
  assert.match(html, /내 쪽지를 남기면 펴져요/);
  assert.ok(!html.includes('단짝의 비밀 쪽지'));
  assert.match(RT.viewQuestion.entry(c.entryModel()), /단짝이 남겼어요/);
});

test('QA2 둘 다 남김: 그때 단짝 쪽지를 구독해서 펼침 · 마음에 남아요 버튼', async () => {
  const st = fakeStore({ q: 'us-007', text: '질문?', src: 'base', done: { [D]: NOW - 3600000, [J]: NOW - 60000 }, likes: {}, skipped: [] });
  const c = RT.appQuestion.create(host(st, NOW));
  c.tick(); await tick(); c.open(); await tick(); await tick();
  assert.ok(st.calls.some((x) => x[0] === 'answer' && x[2] === D));
  const html = c.screenHtml();
  assert.match(html, /단짝의 비밀 쪽지/); assert.match(html, /마음에 남아요/); assert.match(html, /data-act="q-edit"/);
});

test('QA3 둘 다 아직: 다른 질문 버튼 · 첫날이면 「첫 쪽지」 꼬리표 + 이렇게 써요', async () => {
  const st = fakeStore({ q: 'first', text: '첫 쪽지예요! 요즘 가장 자주 하는 생각은요?', src: 'date', done: {}, likes: {}, skipped: [] });
  const c = RT.appQuestion.create(host(st, NOW));
  c.tick(); await tick(); c.open(); await tick();
  const html = c.screenHtml();
  assert.match(html, /data-act="q-swap"/); assert.match(html, /첫 쪽지<\/span>/); assert.match(html, /이렇게 써요/);
  assert.match(html, /단짝에게 쪽지를 써요/);
});

test('QA4 우리가 낸 질문인 날은 다른 질문 없음 + 「준민이 낸 질문」', async () => {
  const st = fakeStore({ q: 'o-1', text: '우리 질문?', src: 'ours', by: J, done: {}, likes: {}, skipped: [] });
  const c = RT.appQuestion.create(host(st, NOW));
  c.tick(); await tick(); c.open(); await tick();
  const html = c.screenHtml();
  assert.ok(!html.includes('data-act="q-swap"')); assert.match(html, /준민이 낸 질문/);
});

test('QA5 「단짝이 된 지 N일」 셈은 저장소 기념일(js/anniv.js)과 같음 (Q-K1)', () => {
  require('../js/dates.js'); const A = require('../js/anniv.js'); const Dt = globalThis.RT.dates;
  for (const d of ['2026-02-14', '2026-11-19', '2026-11-30', '2027-02-14']) {
    assert.equal(RT.question.ddayCount('2026-02-14', d), A.dayCount(Dt.parse('2026-02-14'), Dt.parse(d)), d);
  }
});

test('QA6 이름 「교환 쪽지」는 question-text.js 한 곳에만 (화면 · 서버 코드에 글자로 없음)', () => {
  const files = ['js/view-question.js', 'js/app-question.js', 'js/question.js', 'js/view-all.js', 'js/view.js', 'functions/index.js', 'functions/question-job.js', 'js/app.js'];
  for (const f of files) assert.ok(!fs.readFileSync(path.join(ROOT, f), 'utf8').includes('교환 쪽지\''), f);
  for (const f of ['js/view-question.js', 'js/app-question.js']) assert.ok(!/'교환 쪽지'/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
});

test('QA7 규칙: qdays · a/{uid}(get 은 내 쪽지가 있을 때만, list 거부) · ourQuestions · users 의 qRemind/qPartner', () => {
  const r = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  assert.ok(r.includes('match /qdays/{date}')); assert.ok(r.includes('match /a/{uid}')); assert.ok(r.includes('match /ourQuestions/{id}'));
  assert.ok(r.includes('allow get: if isMember() && (me() == uid || exists(answerPath(me())));'));
  assert.ok(r.includes('allow list: if false;'));
  assert.ok(r.includes("'qRemind', 'qPartner'"));
  assert.ok(!r.includes('eatMember()'), '저장소 isMember() 를 씀');
});

test('QA8 색은 토큰만 (styles/question.css 에 # 색 · rgb 없음)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles/question.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css)); assert.ok(!/rgba?\(/.test(css));
});
