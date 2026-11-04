// node --test tests/review.test.js — 돌아보기(주 · 달) 계산
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const R = require('../js/review.js');
const S = require('../js/schedule.js');

const JUN = 'uidjun', DAJIN = 'uiddajin';
const day = (m, d) => D.fromYMD(2026, m, d);
const today = day(11, 3); // 화요일
const persons = [{ key: DAJIN, name: '다진', slot: 'her' }, { key: JUN, name: '준민', slot: 'me' }];
const routine = (key, owner, who, start, extra) => Object.assign({ key, icon: '🏃', name: key, who, owner, start, end: null, order: 0 }, extra || {});
const routines = [routine('squat', DAJIN, '다진', '2026-10-18'), routine('run', JUN, '준민', '2026-10-18'), routine('water', JUN, '준민', '2026-10-29')];
const ck = (...pairs) => Object.fromEntries(pairs.map((p) => [p, true]));
// 지난주 10/26(월) ~ 11/1(일)
const checks = ck('squat|2026-10-26', 'run|2026-10-26', 'squat|2026-10-27', 'squat|2026-10-31', 'run|2026-10-31', 'water|2026-10-31', 'water|2026-11-01', 'run|2026-11-02');
const at = (m, d, h) => new Date(2026, m - 1, d, h || 12).toISOString();
const todo = (id, scope, doneBy, doneAt, ui) => ({ id, title: id, scope, done: !!doneAt, doneBy, doneAt, ui: ui || {} });
const base = (over) => Object.assign({ mode: 'week', page: 1, today, config: { people: { [JUN]: '준민', [DAJIN]: '다진' }, routines }, checks, persons, todos: [], kungs: [], events: [] }, over || {});

test('기간: 주는 월요일부터, 이번 주 · 지난주 · 그 전 이름', () => {
  const w0 = R.rangeOf('week', today, 0), w1 = R.rangeOf('week', today, 1), w2 = R.rangeOf('week', today, 2);
  assert.equal(D.toKey(w0.from), '2026-11-02');
  assert.equal(D.toKey(w1.from), '2026-10-26');
  assert.equal(D.toKey(w1.to), '2026-11-01');
  assert.deepEqual([w0.title, w1.title, w2.title], ['이번 주 우리', '지난주 우리', '10월 19일 주의 우리']);
  assert.equal(w1.label, '10월 26일 – 11월 1일');
  const m1 = R.rangeOf('month', today, 1);
  assert.deepEqual([D.toKey(m1.from), D.toKey(m1.to), m1.title, m1.days], ['2026-10-01', '2026-10-31', '지난달 우리', 31]);
  assert.equal(R.rangeOf('month', day(1, 15), 1).label, '2025년 12월'); // 해 넘김
});

test('루틴 × 요일: 사람별로 묶고, 시작 전은 pre, 모두 해낸 날은 루틴 탭 「모두」 규칙', () => {
  const m = R.build(base());
  assert.deepEqual(m.routine.groups.map((g) => [g.name, g.rows.map((r) => r.key)]), [['다진', ['squat']], ['준민', ['run', 'water']]]);
  const water = m.routine.groups[1].rows[1];
  assert.deepEqual(water.cells, ['pre', 'pre', 'pre', 'none', 'none', 'full', 'full']);
  // 모두: 10/26(둘 다 — water 시작 전), 10/31(셋 다). 11/1은 다진이 안 해서 아님
  assert.deepEqual(m.routine.all, ['full', 'none', 'none', 'none', 'none', 'full', 'none']);
  assert.equal(m.us.allDays, 2);
  assert.equal(m.routine.done, 8 - 1); // 지난주 칸만 (11/2 run 은 이번 주)
  assert.equal(m.routine.total, 7 + 7 + 4);
});

test('이번 주: 오늘 뒤는 future, 오늘까지만 센다', () => {
  const m = R.build(base({ page: 0 }));
  assert.deepEqual(m.routine.groups[0].rows[0].cells, ['none', 'none', 'future', 'future', 'future', 'future', 'future']);
  assert.equal(m.routine.total, 2 * 3);
  assert.equal(m.canNext, false);
  assert.equal(m.canPrev, true);
});

test('끝낸 일: 기간 안 · 끝낸 사람이 놓은 평면 칸 · 같은 일은 한 번만', () => {
  const todos = [
    todo('a', 'together', JUN, at(10, 27), { [JUN]: { u: 0.2, i: 0.9 }, [DAJIN]: { u: 0.9, i: 0.9 } }), // 준민 자리 → 계획할 일
    todo('b', DAJIN, DAJIN, at(10, 28), { [DAJIN]: { u: 0.8, i: 0.7 } }), // 지금 할 일
    todo('c', DAJIN, DAJIN, at(11, 1, 23), { [DAJIN]: { u: 0.9, i: 0.1 } }), // 빨리 쳐낼 일 (일요일 밤)
    todo('d', JUN, JUN, at(10, 30)), // 평면에 안 놓음
    todo('e', JUN, JUN, at(11, 2)), // 이번 주 → 빠짐
    todo('f', JUN, null, null), // 아직 안 끝냄
    todo('a', 'together', JUN, at(10, 27), {}) // 같은 문서가 두 번 와도 한 번
  ];
  const t = R.build(base({ todos })).todos;
  assert.equal(t.total, 4);
  assert.deepEqual(t.quads.map((q) => [q.key, q.n]), [['plan', 1], ['now', 1], ['later', 0], ['quick', 1]]);
  assert.equal(t.unplaced, 1);
  assert.deepEqual(t.byWho.map((b) => [b.name, b.n, b.slot]), [['함께', 1, 'both'], ['다진', 2, 'her'], ['준민', 1, 'me']]);
  assert.equal(t.byWho[1].pct, 100);
  assert.equal(R.build(base({ todos })).us.togetherDone, 1);
});

test('꿍: 기간 안만, 받은 날 받은 사람이 루틴을 모두 해냈으면 「끝까지 해낸 날」', () => {
  const kungs = [
    { from: JUN, to: DAJIN, date: '2026-10-27' }, // 다진 10/27 squat 함 → 해냄
    { from: DAJIN, to: JUN, date: '2026-10-28' }, // 준민 10/28 run 안 함
    { from: JUN, to: DAJIN, date: '2026-11-02' }, // 이번 주 → 빠짐
    { from: 'stranger', to: JUN, date: '2026-10-29' } // 모르는 사람 → 빠짐
  ];
  const m = R.build(base({ kungs }));
  assert.deepEqual([m.us.kungs, m.kung.n, m.kung.rescued], [2, 2, 1]);
});

test('함께 일정: 쉬는 날은 빼고, 이번 주는 오늘까지만', () => {
  const docs = [
    { id: 'e1', owner: 'both', title: '테니스', weekly: true, weekday: 5, start: '10:00', end: '12:00', from: '2026-10-19' }, // 토 2시간
    { id: 'e2', owner: 'both', title: '저녁', weekly: false, date: '2026-10-28', start: '18:00', end: '19:30' },
    { id: 'e3', owner: JUN, title: '수업', weekly: true, weekday: 0, start: '09:00', end: '12:00', from: '2026-10-19' }, // 내 일정 → 빠짐
    { id: 'e4', owner: 'both', title: '산책', weekly: true, weekday: 1, start: '20:00', end: '21:00', from: '2026-10-19', skip: ['2026-10-27'] } // 이번 주 화(오늘) 1시간, 지난주는 쉼
  ];
  const events = S.fromDocs(docs);
  const last = R.build(base({ events }));
  assert.equal(last.us.togetherMin, 120 + 90);
  assert.equal(last.us.togetherTime, '3시간 30분');
  assert.equal(R.build(base({ events, page: 0 })).us.togetherMin, 60);
  assert.deepEqual([R.hoursText(0), R.hoursText(30), R.hoursText(120)], ['0시간', '30분', '2시간']);
});

test('기록이 하나도 없는 주는 empty', () => {
  assert.equal(R.build(base({ config: { people: {}, routines: [] }, checks: {} })).empty, true);
  assert.equal(R.build(base()).empty, false);
});

test('달 보기: 칸 대신 루틴마다 n / m, 모두 해낸 날은 그 달 전체', () => {
  const m = R.build(base({ mode: 'month', page: 1 }));
  assert.equal(m.routine.week, false);
  const squat = m.routine.groups[0].rows[0];
  assert.deepEqual([squat.done, squat.active], [3, 14]); // 10/18~10/31
  assert.equal(m.us.allDays, 2);
});

test('넘겨 보기 끝: 이번 주는 다음이 막히고, 가장 앞은 첫 루틴 시작 또는 2026-10-01', () => {
  const cfg = (start) => ({ people: {}, routines: [routine('a', JUN, '준민', start)] });
  // 2026-10-01(목)이 든 주(9/28 월)는 이전이 막힘
  const first = R.build(base({ config: cfg('2026-10-18'), page: 5 })); // 9/28 주
  assert.equal(D.toKey(R.rangeOf('week', today, 5).from), '2026-09-28');
  assert.equal(first.canPrev, false);
  assert.equal(R.build(base({ config: cfg('2026-10-18'), page: 4 })).canPrev, true);
  // 더 앞에 시작한 루틴이 있으면 그만큼 더 넘겨 볼 수 있다
  assert.equal(R.build(base({ config: cfg('2026-09-01'), page: 5 })).canPrev, true);
  assert.equal(R.build(base({ config: cfg('2026-09-01'), page: 10 })).canPrev, false); // 8/24 주
  assert.equal(R.build(base({ mode: 'month', page: 1, config: cfg('2026-10-18') })).canPrev, false); // 10월이 처음
  assert.equal(R.build(base({ mode: 'month', page: 0 })).canNext, false);
});

test('회귀(점검 AI): 탭을 연 채 짝꿍이 끝낸 일을 되돌리면 바로 빠진다 — 지금 듣고 있는 할 일이 이긴다', () => {
  const loaded = [todo('a', 'together', JUN, at(10, 27)), todo('b', DAJIN, DAJIN, at(10, 28))];
  const live = [Object.assign(todo('a', 'together', null, null), { done: false })];
  const merged = R.mergeTodos(live, loaded);
  assert.deepEqual(merged.map((t) => [t.id, t.done]), [['a', false], ['b', true]]);
  const m = R.build(base({ todos: merged }));
  assert.equal(m.todos.total, 1);
  assert.equal(m.us.togetherDone, 0);
});

test('회귀(점검 AI): 꿍을 불러오지 못하면 숫자 대신 칸을 숨긴다 (0번으로 보이지 않게)', () => {
  const m = R.build(base({ kungs: null }));
  assert.equal(m.kung, null);
  assert.equal(m.us.kungs, null);
});

test('회귀(점검 AI): 오늘 함께 일정은 지금까지 지난 만큼만', () => {
  const events = S.fromDocs([{ id: 'e', owner: 'both', title: '산책', weekly: false, date: '2026-11-03', start: '20:00', end: '21:00' }]);
  assert.equal(R.build(base({ page: 0, events, nowMin: 19 * 60 })).us.togetherMin, 0);
  assert.equal(R.build(base({ page: 0, events, nowMin: 20 * 60 + 30 })).us.togetherMin, 30);
  assert.equal(R.build(base({ page: 0, events, nowMin: 23 * 60 })).us.togetherMin, 60);
});

test('회귀(점검 AI): 서버의 「모두 해낸 날」(functions/notify.js)이 앱 규칙(model.dayLevel)과 늘 같다', () => {
  const N = require('../functions/notify.js');
  const M = require('../js/model.js');
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const dates = [0, 1, 2, 3, 4, 5, 6].map((i) => D.toKey(day(10, 26) + i));
  for (let round = 0; round < 300; round++) {
    const rs = [];
    const n = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const start = D.toKey(day(10, 20) + Math.floor(rnd() * 12));
      const endRoll = rnd();
      const end = endRoll < 0.6 ? null : D.toKey(day(10, 18) + Math.floor(rnd() * 16)); // 시작보다 앞인 그만둔 날도 섞는다
      rs.push({ key: 'r' + k, icon: '🏃', name: 'r' + k, who: '', owner: rnd() < 0.5 ? JUN : DAJIN, start, end, order: k });
    }
    if (rnd() < 0.1) rs.push({ key: 'bad key', owner: JUN, start: '2026-10-26' }); // 이상한 키는 둘 다 뺀다
    const done = new Set();
    rs.forEach((r) => dates.forEach((d) => { if (rnd() < 0.6) done.add(r.key + '|' + d); }));
    const persons = [DAJIN, JUN];
    const server = N.allDoneDays({ routines: rs, done, persons, dates });
    const clean = M.routinesFrom({ routines: rs });
    const isDone = (r, d) => done.has(r.key + '|' + D.toKey(d));
    const client = dates.filter((k) => M.dayLevel(clean, persons, D.parse(k), isDone).level === 'full').length;
    assert.equal(server, client, 'round ' + round + ' ' + JSON.stringify(rs));
  }
});
test('회귀: 기간을 넘겨 불러오는 동안 「함께 끝낸 일」 · 「꿍」은 앞 기간 숫자 대신 「–」', () => {
  const V = require('../js/view-review.js');
  const m = R.build(base({ todos: [todo('a', 'together', JUN, at(10, 28), {})], kungs: [{ from: JUN, to: DAJIN, date: '2026-10-28' }] }));
  const val = (html, label) => (new RegExp(label + '</span><span class="stat__value">([^<]*)<').exec(html) || [])[1];
  const loading = V.tab(Object.assign({}, m, { loading: true, error: '' }));
  assert.equal(val(loading, '함께 끝낸 일'), '–');
  assert.equal(val(loading, '꿍 주고받음'), '–');
  assert.match(loading, /rv-us"[^>]*aria-busy="true"/);
  assert.equal(val(loading, '모두 해낸 날'), m.us.allDays + '일'); // 루틴 · 일정은 이미 듣고 있어 그대로
  const ready = V.tab(Object.assign({}, m, { loading: false, error: '' }));
  assert.equal(val(ready, '함께 끝낸 일'), '1개');
  assert.equal(val(ready, '꿍 주고받음'), '1번');
  assert.doesNotMatch(ready, /aria-busy/);
  // 꿍을 못 불러온 기간은 불러오는 중에도 칸 없음
  assert.equal(val(V.tab(Object.assign({}, m, { us: Object.assign({}, m.us, { kungs: null }), loading: true, error: '' })), '꿍 주고받음'), undefined);
});
