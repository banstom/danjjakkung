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
  assert.deepEqual(m.routine.all, ['full', 's2', 'none', 'none', 'none', 'full', 's1']); // v41: 일부 한 날은 비율 단계
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
      // v38 쉬기: 기간 0~3개 (열린 기간 · 시작일 앞 · 끝이 앞인 이상한 기간도 섞는다)
      const rest = [];
      const nr = Math.floor(rnd() * 4);
      for (let j = 0; j < nr; j++) {
        const f = day(10, 16) + Math.floor(rnd() * 18);
        const roll = rnd();
        rest.push({ from: D.toKey(f), to: roll < 0.3 ? null : D.toKey(f + Math.floor(rnd() * 6) - (roll > 0.92 ? 3 : 0)) });
      }
      rs.push({ key: 'r' + k, icon: '🏃', name: 'r' + k, who: '', owner: rnd() < 0.5 ? JUN : DAJIN, start, end, order: k, rest: nr ? rest : undefined });
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
    // 하루하루 「하고 있는 루틴」도 같다 (저녁 알림 · 꿍 남은 개수)
    clean.forEach((r) => dates.forEach((k) => assert.equal(N.activeOn(N.cleanRoutines(rs).find((x) => x.key === r.key), k), M.activeOn(r, D.parse(k)), 'active ' + round + ' ' + r.key + ' ' + k)));
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

// ── v54 R1: 돌아보기 「달」 — 루틴마다 한 달 (카드 · 띠) ──
test('v54 달: %와 n/m 은 해야 했던 날 기준 — 만들기 전 · 쉬는 날 · 오늘 · 오늘 이후는 뺌', () => {
  const t = day(11, 19); // 목요일
  const rs = [routine('a', JUN, '준민', '2026-11-01'), routine('b', JUN, '준민', '2026-11-10', { rest: [{ from: '2026-11-12', to: '2026-11-13' }] }), routine('c', DAJIN, '다진', '2026-11-01')];
  const cks = {};
  for (let d = 1; d <= 19; d++) { const k = '2026-11-' + String(d).padStart(2, '0'); if (d % 3) cks['a|' + k] = true; cks['c|' + k] = true; if (d >= 10) cks['b|' + k] = true; }
  const m = R.build(base({ mode: 'month', page: 0, today: t, config: { people: {}, routines: rs }, checks: cks }));
  const mo = m.routine.month;
  assert.equal(mo.lead, 6, '11/1 은 일요일 → 앞 빈칸 6 (월요일 시작)');
  assert.equal(mo.count, 3);
  const a = mo.groups[1].rows[0], b = mo.groups[1].rows[1];
  assert.deepEqual([a.done, a.due], [12, 18], '오늘(19일)은 분모에서 뺌');
  assert.equal(a.pct, 67);
  assert.equal(a.cells[18].st, 'done', '오늘 한 것은 색으로 (분모에는 안 들어감)'); assert.equal(a.cells[17].st, 'miss', '18일은 못 함');
  assert.deepEqual([b.done, b.due], [7, 7], '만들기 전 9일 · 쉬는 날 2일 빠짐 (10~18일 중 12·13일 쉼)');
  assert.equal(b.cells[0].st, 'rest', '만들기 전 = 빗금'); assert.equal(b.cells[11].st, 'rest', '쉬는 날 = 빗금');
  assert.equal(b.cells[19].st, 'future'); assert.equal(b.cells[29].st, 'future');
  assert.ok(a.cells[18].today && !a.cells[17].today);
  assert.deepEqual(mo.groups.map((g) => g.slot), ['her', 'me']);
});

test('v54 달: 오늘 한 일은 색으로 보이되 분모에 안 들어감 · 지운 루틴은 지운 날 뒤로 빗금', () => {
  const t = day(11, 19);
  const rs = [routine('a', JUN, '준민', '2026-11-01', { end: '2026-11-10' })];
  const m = R.build(base({ mode: 'month', page: 0, today: t, config: { people: {}, routines: rs }, checks: { 'a|2026-11-19': true, 'a|2026-11-02': true }, persons: [{ key: JUN, name: '준민', slot: 'me' }] }));
  const a = m.routine.month.groups[0].rows[0];
  assert.equal(a.cells[10].st, 'rest', '지운 다음 날부터 빗금'); assert.equal(a.due, 10); assert.equal(a.done, 1);
  const m2 = R.build(base({ mode: 'month', page: 0, today: t, config: { people: {}, routines: [routine('x', JUN, '준민', '2026-11-01')] }, checks: { 'x|2026-11-19': true }, persons: [{ key: JUN, name: '준민', slot: 'me' }] }));
  const x = m2.routine.month.groups[0].rows[0];
  assert.equal(x.cells[18].st, 'done', '오늘 했으면 색'); assert.equal(x.due, 18); assert.equal(x.done, 0);
});

test('v54 달: 「모두」 칸은 루틴 탭 달력(model.dayLevel)과 같은 날 같은 값 · 둘 다 해낸 날 / 지난 날', () => {
  const M = require('../js/model.js');
  const t = day(11, 19);
  const rs = [routine('a', JUN, '준민', '2026-11-01'), routine('c', DAJIN, '다진', '2026-11-01')];
  const cks = { 'a|2026-11-02': true, 'c|2026-11-02': true, 'a|2026-11-03': true, 'c|2026-11-19': true, 'a|2026-11-19': true };
  const m = R.build(base({ mode: 'month', page: 0, today: t, config: { people: {}, routines: rs }, checks: cks }));
  const mo = m.routine.month, set = M.routinesFrom({ routines: rs });
  for (let d = 1; d <= 18; d++) {
    const lv = M.dayLevel(set, [DAJIN, JUN], day(11, d), (r, x) => !!cks[r.key + '|' + D.toKey(x)]).level;
    assert.equal(mo.all[d - 1].st, lv, d + '일');
  }
  assert.equal(mo.all[1].st, 'full'); assert.equal(mo.all[2].st, 'half'); assert.equal(mo.all[3].st, 'none');
  assert.equal(mo.all[18].st, 'full', '오늘 다 했으면 색'); assert.equal(mo.all[19].st, 'future');
  assert.deepEqual([mo.bothDays, mo.pastDays], [1, 18]);
  assert.equal(R.build(base({ mode: 'week', page: 0, today: t, config: { people: {}, routines: rs }, checks: cks })).routine.month, null, '주 보기는 그대로');
});

test('v54 달 보기 모양: 처음엔 루틴 4개 이하 카드 · 5개 이상 띠 · 한 번 고르면 그 값', () => {
  assert.equal(R.monthView(null, 4), 'card');
  assert.equal(R.monthView(null, 5), 'strip');
  assert.equal(R.monthView(undefined, 0), 'card');
  assert.equal(R.monthView('card', 9), 'card');
  assert.equal(R.monthView('strip', 1), 'strip');
  assert.equal(R.monthView('weird', 6), 'strip');
});

test('v54 달 화면: 카드(모두 + 사람별 2칸) · 띠(줄 = 버튼 → 시트) · 전환 버튼 · 규칙', () => {
  const VR = require('../js/view-review.js');
  const fs = require('fs'), path = require('path');
  const t = day(11, 19);
  const rs = [routine('a', JUN, '준민', '2026-11-01'), routine('c', DAJIN, '다진', '2026-11-01')];
  const m = R.build(base({ mode: 'month', page: 0, today: t, config: { people: {}, routines: rs }, checks: { 'a|2026-11-02': true } }));
  const card = VR.tab(Object.assign({}, m, { monthView: 'card', meName: '준민', partnerName: '다진' }));
  assert.match(card, /data-act="rv-view" data-v="card" aria-label="카드로 보기" aria-pressed="true"/);
  assert.match(card, /data-act="rv-view" data-v="strip" aria-label="띠로 보기" aria-pressed="false"/);
  assert.match(card, /<h2 class="rv-title">모두<\/h2><span class="rv-sub">둘 다 해낸 날 <b>0일<\/b> \/ 지난 날 18일/);
  assert.equal((card.match(/class="card rv-mcard"/g) || []).length, 2);
  assert.match(card, /rv-cal--sm[^]*rv-d--blank[^]*rv-d--me/, '1일 앞 빈칸 · 해낸 칸 = 사람 색');
  assert.match(card, /rv-d--fut rv-d--today|rv-d--[a-z]+ rv-d--today/, '오늘 테두리');
  assert.match(card, /✓ 1\/18 · 6%/);
  assert.doesNotMatch(card, /rv-bar__track/, '막대 대신 달력');
  const strip = VR.tab(Object.assign({}, m, { monthView: 'strip', meName: '준민', partnerName: '다진' }));
  assert.match(strip, /data-act="rv-row" data-v="a"[^]*1\/18 · 6%/);
  assert.match(strip, /숫자는 월요일 · 줄을 누르면 그 루틴의 한 달 달력/);
  assert.match(strip, /rv-strip--scale" style="--n:30"/);
  const row = m.routine.month.groups[1].rows[0];
  const sh = VR.rowSheet({ row, lead: m.routine.month.lead, label: m.label });
  assert.match(sh, /role="dialog"[^]*rv-cal--big[^]*rv-cal__dow[^]*✓ 1\/18 · 6%/);
  const week = VR.tab(Object.assign({}, R.build(base()), { monthView: 'card' }));
  assert.doesNotMatch(week, /rv-view/, '주 보기에는 전환 없음');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.match(rules, /request\.resource\.data\.reviewMonthView in \['card', 'strip'\]/);
  assert.match(rules, /request\.resource\.data\.mapNudge is bool/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles/app.css'), 'utf8');
  assert.match(css, /\.rv-cal--big \.rv-d \{ height: 30px;/); assert.match(css, /\.rv-cal--sm \.rv-d \{ height: 18px; font-size: 10px;/); assert.match(css, /\.rv-strip \.rv-d \{ height: 22px;/);
  assert.match(css, /@media \(max-width: 359px\) \{\s*\.rv-cal--sm \.rv-d__n \{ display: none; \}/, '320px 에서는 작은 칸 숫자 빼기');
  const r1 = css.slice(css.indexOf('/* ── v54 돌아보기'));
  assert.doesNotMatch(r1.replace(/\/\*[^]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, '색은 토큰만');
});
