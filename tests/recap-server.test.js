// node --test tests/recap-server.test.js — 결산 서버 (docs/recap/tests.md B 묶음 F1~F6을 가짜 저장소로) + 읽기 모듈
// 진짜 Firestore · 규칙(F7)은 Cloud Shell 에서: bash scripts/emu-recap.sh (functions/emu/recap.emu.js — 같은 장면)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RD = require('../functions/recap-read.js');
const RJ = require('../functions/recap-job.js');
const R = require('../functions/recap.js');
const { cardText } = require('../js/recap-text.js');
const { fakeDb, seedFromFixture } = require('./fake-db.js');

const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/recap-' + n + '.json'), 'utf8'));
const kst = (s) => new Date(s + '+09:00');
const card = (r, id) => r.cards.find((c) => c.id === id);

test('읽기 → 계산: 시험 자료를 저장소 문서로 펼쳐도 목업 숫자 그대로 (함께 일정 시간만 빼고)', async () => {
  const db = fakeDb();
  seedFromFixture(db, load('2026-10'));
  seedFromFixture(db, load('2026-11'));
  const out = await RJ.runMonthly(db, kst('2026-12-01T03:00:00'));
  const r = out['2026-11'];
  assert.ok(r);
  assert.deepEqual(r.cards.map((c) => c.id), ['cover', 'together', 'routines', 'todos', 'kungs', 'time', 'places', 'meals', 'spends', 'final']);
  assert.equal(cardText(card(r, 'cover'), r, 'jm').sub, '단짝이 된 지 290일');
  assert.deepEqual([card(r, 'together').fullDays, card(r, 'together').longestStreak, card(r, 'together').diffPrev], [15, 4, 2]);
  assert.deepEqual(cardText(card(r, 'routines'), r, 'jm').rows.map((x) => [x.routine, x.pct, x.sub, x.cmp]), [['영어 단어 30개', 85, '11/13일', '−15%p'], ['감사 일기', 86, '18/21일', null]]);
  assert.deepEqual([card(r, 'todos').total, card(r, 'todos').shared, card(r, 'todos').diffPrev], [23, 8, 11]);
  assert.deepEqual([card(r, 'kungs').total, card(r, 'kungs').byPerson.jm, card(r, 'kungs').byPerson.dj], [153, 84, 69]);
  assert.deepEqual(cardText(card(r, 'places'), r, 'jm').more, ['새로 칠한 곳 2곳 · 강릉시 · 속초시']);
  assert.deepEqual(card(r, 'meals'), { id: 'meals', sharedMeals: 18, goalDays: { jm: 12, dj: 15 } });
  assert.equal(cardText(card(r, 'spends'), r, 'jm').bigText, '446,200원');
  assert.ok(!JSON.stringify(r).match(/weight|kcal|체중|칼로리|body/));
  assert.equal(db.count('recaps'), 1);
});

test('F1 서울 시각 경계: 11-30 23:59 기록은 11월, 12-01 00:00 은 빠짐', async () => {
  const db = fakeDb();
  db.put('members/a', { name: '준민' }); db.put('members/b', { name: '단짝' });
  db.put('couple/main', { start: '2026-01-01' });
  db.put('kungs/2026-11-30_a', { from: 'a', to: 'b', date: '2026-11-30' });
  db.put('kungs/2026-12-01_a', { from: 'a', to: 'b', date: '2026-12-01' });
  db.put('todos/t1', { scope: 'together', done: true, doneBy: 'a', doneAt: kst('2026-11-30T23:59:00').toISOString() });
  db.put('todos/t2', { scope: 'together', done: true, doneBy: 'a', doneAt: kst('2026-12-01T00:00:00').toISOString() });
  const r = await RJ.buildOne(db, { kind: 'month', key: '2026-11' }, new Date());
  assert.equal(card(r, 'kungs').total, 1);
  assert.equal(card(r, 'todos').total, 1);
});

test('F2 같은 달을 두 번 돌려도 문서 하나 · 숫자 같음', async () => {
  const db = fakeDb();
  seedFromFixture(db, load('2026-11'));
  const a = (await RJ.runMonthly(db, kst('2026-12-01T03:00:00')))['2026-11'];
  const b = (await RJ.runMonthly(db, kst('2026-12-01T03:05:00')))['2026-11'];
  assert.equal(db.count('recaps'), 1);
  assert.deepEqual(a.cards, b.cards);
});

test('F3 결산 뒤 기록을 고쳐도 recaps 문서는 그대로 (다시 계산하지 않음)', async () => {
  const db = fakeDb();
  seedFromFixture(db, load('2026-11'));
  await RJ.runMonthly(db, kst('2026-12-01T03:00:00'));
  const before = JSON.stringify(db.get('recaps/2026-11'));
  db.put('kungs/2026-11-29_dj', { from: 'dj', to: 'jm', date: '2026-11-29' });
  await RJ.runNotify(db, kst('2026-12-01T09:00:00'), { send: async () => {}, once: async () => true, appUrl: 'x/' });
  assert.equal(JSON.stringify(db.get('recaps/2026-11')), before);
});

test('F4 단짝이 된 달보다 이른 달은 만들지 않음 · 단짝이 된 달은 비교 없음', async () => {
  const db = fakeDb();
  seedFromFixture(db, load('2026-11'));
  db.put('couple/main', { start: '2026-11-10' });
  assert.equal((await RJ.runMonthly(db, kst('2026-11-01T03:00:00')))['2026-10'], null);
  assert.equal(db.get('recaps/2026-10'), undefined);
  const r = (await RJ.runMonthly(db, kst('2026-12-01T03:00:00')))['2026-11'];
  assert.equal(card(r, 'together').diffPrev, null);
  assert.equal(card(r, 'kungs').diffPrev, null);
  assert.equal(cardText(card(r, 'cover'), r, 'jm').sub, '단짝이 된 지 21일');
});

test('F5 1월 1일: recaps/2026 과 recaps/2026-12 둘 다, 알림은 연말 하나', async () => {
  const db = fakeDb();
  seedFromFixture(db, load('2026-11'));
  const out = await RJ.runMonthly(db, kst('2027-01-01T03:00:00'));
  assert.deepEqual(Object.keys(out).sort(), ['2026', '2026-12']);
  assert.ok(db.get('recaps/2026') && db.get('recaps/2026-12'));
  assert.equal(card(out['2026'], 'cover').title, '이번 해의 단짝꿍');
  const sent = [];
  await RJ.runNotify(db, kst('2027-01-01T09:00:00'), { send: async (uid, msg, kind, tag, link) => sent.push([uid, msg.title, tag, link]), once: async () => true, appUrl: 'https://app/' });
  assert.deepEqual(sent.map((s) => s[1]), ['2026년의 단짝꿍이 나왔어요', '2026년의 단짝꿍이 나왔어요']);
  assert.ok(sent.every((s) => s[2] === 'recap-2026' && s[3] === 'https://app/?tab=look&recap=2026'));
});

test('F6 users.recap=false 면 안 보냄 · 같은 결산 알림은 한 번만 · 결산이 없으면 아무에게도', async () => {
  const db = fakeDb();
  seedFromFixture(db, load('2026-11'));
  const sent = [];
  const done = new Set();
  const deps = { send: async (uid) => sent.push(uid), once: async (id) => (done.has(id) ? false : (done.add(id), true)), appUrl: 'x/' };
  await RJ.runNotify(db, kst('2026-12-01T09:00:00'), deps);
  assert.deepEqual(sent, []); // 아직 결산 없음
  await RJ.runMonthly(db, kst('2026-12-01T03:00:00'));
  db.put('users/dj', { recap: false });
  await RJ.runNotify(db, kst('2026-12-01T09:00:00'), deps);
  await RJ.runNotify(db, kst('2026-12-01T09:00:00'), deps); // 두 번 돌아도
  assert.deepEqual(sent, ['jm']);
});

test('읽기: 매주 함께 일정은 앱 규칙대로 펼침 (쉬는 날 빠짐 · 시작 전 빠짐 · 각자 일정 빠짐)', () => {
  const ev = { id: 'e1', owner: 'both', title: '같이 운동', weekly: true, weekday: 0, start: '19:00', end: '20:30', from: '2026-11-09', skip: ['2026-11-16'] };
  const mine = { id: 'e2', owner: 'jm', title: '수업', weekly: true, weekday: 0, start: '10:00', end: '12:00', from: '2026-11-01' };
  const once = { id: 'e3', owner: 'both', title: '영화', weekly: false, date: '2026-11-21', start: '14:00', end: '16:00' };
  const inp = RD.toInput({ members: [{ id: 'jm', name: '준민' }, { id: 'dj', name: '단짝' }], events: [ev, mine, once] }, { kind: 'month', key: '2026-11' });
  // 월요일 9 · 23 · 30 (2 · 16 은 시작 전 · 쉬는 날) + 21일 영화
  assert.deepEqual(inp.events.map((e) => e.start), ['2026-11-09T19:00', '2026-11-21T14:00', '2026-11-23T19:00', '2026-11-30T19:00']);
  assert.equal(R.sharedMinutes({ kind: 'month', key: '2026-11' }, inp.events), 90 * 3 + 120);
});

test('읽기: 식탁 — 함께 끼니는 하루 두 사람 중 많은 쪽, 목표 맞춘 날 = 칼로리 90~110% (가정), 몸 정보 안 읽음', () => {
  const meal = (kcal, together) => ({ at: '12:00', together, total: { kcal, carb: 0, protein: 0, fat: 0 } });
  const inp = RD.toInput({
    members: [{ id: 'jm', name: '준민' }, { id: 'dj', name: '단짝' }],
    goals: [{ id: 'jm', kcal: 2000 }, { id: 'dj', kcal: 1600 }],
    meals: [
      { id: 'jm_2026-11-03', uid: 'jm', date: '2026-11-03', meals: [meal(900, true), meal(1000, false)] }, // 1900 → 맞춤
      { id: 'dj_2026-11-03', uid: 'dj', date: '2026-11-03', meals: [meal(700, true), meal(700, true)] },   // 1400 → 87.5% 아님, 함께 2
      { id: 'dj_2026-11-04', uid: 'dj', date: '2026-11-04', meals: [meal(1760, false)] },                // 110% → 맞춤
      { id: 'jm_2026-12-01', uid: 'jm', date: '2026-12-01', meals: [meal(2000, true)] }                  // 기간 밖
    ]
  }, { kind: 'month', key: '2026-11' });
  assert.equal(inp.meals.length, 2);
  assert.deepEqual(inp.goalDays, { jm: ['2026-11-03'], dj: ['2026-11-04'] });
});

test('읽기: 지역 이름 · 끝낸 일 날짜 · 체크는 done 만', () => {
  assert.equal(RD.regionName('11200'), '성동구');
  assert.equal(RD.regionName('51150'), '강릉시');
  assert.equal(RD.kstDay('2026-11-30T15:00:00.000Z'), '2026-12-01');
  const inp = RD.toInput({ members: [], checks: [{ id: 'r_2026-11-02', routine: 'r', date: '2026-11-02', done: true }, { id: 'x', routine: 'r', date: '2026-11-03', done: false }] }, { kind: 'month', key: '2026-11' });
  assert.deepEqual(inp.checks, [{ key: 'r', date: '2026-11-02' }]);
});

test('단짝이 된 날을 안 정했으면 표지에서 「단짝이 된 지」 줄만 빠짐', () => {
  const r = R.computeRecap({ period: { kind: 'month', key: '2026-11' }, people: [{ uid: 'a', name: 'A' }, { uid: 'b', name: 'B' }], coupleSince: null, routines: [], checks: [], todos: [], kungs: [], events: [], places: [], meals: [], goalDays: {}, spends: [] });
  assert.equal(cardText(r.cards[0], r, 'a').sub, null);
});

test('알림 문구 · 대상 기간', () => {
  assert.deepEqual(RJ.recapMessage({ kind: 'month', key: '2026-11' }), { title: '11월의 단짝꿍이 나왔어요', body: '한 장씩 넘겨 보세요' });
  assert.deepEqual(RJ.targetsFor(kst('2026-12-01T09:00:00')), { month: { kind: 'month', key: '2026-11' }, year: null });
  assert.deepEqual(RJ.targetsFor(new Date('2026-12-31T15:00:00Z')).year, { kind: 'year', key: '2026' }); // UTC 12-31 = 서울 1월 1일
});
