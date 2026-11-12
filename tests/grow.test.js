// node --test tests/  — v40 주간 공동 퀘스트 · v41 토마토 키우기
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const M = require('../js/model.js');
const Q = require('../js/quest.js');
const G = require('../js/grow.js');
const T = require('../js/tomato.js');

const day = (m, d) => D.fromYMD(2026, m, d);
const key = (m, d) => D.toKey(day(m, d));
const stats = (o) => Object.assign({ allDays: 0, togetherDone: 0, kungs: 0, togetherMin: 0, nowDone: 0 }, o);

test('퀘스트: 주 번호로 고른다 · 두 폰 같음 · 퀘스트와 보너스는 다른 것', () => {
  const mon = day(11, 9);
  const weeks = [stats({ kungs: 1, togetherMin: 60, nowDone: 1 }), stats({ allDays: 3 }), null, null, null];
  const a = Q.build({ mon, weeks }), b = Q.build({ mon, weeks });
  assert.deepEqual(a, b);
  assert.equal(a.week, 2);
  assert.notEqual(a.main.key, a.bonus.key);
  // 여러 주를 돌면 다섯 가지가 모두 한 번씩은 나온다
  const seen = new Set();
  for (let w = 0; w < 10; w++) seen.add(Q.build({ mon: Q.EPOCH + 7 * w, weeks }).main.key);
  assert.equal(seen.size, 5);
});

test('퀘스트: 못 쓰는 것은 빠진다 (꿍 기록 못 읽음 · 함께 일정 · 평면을 안 씀)', () => {
  const list = Q.usable([stats({ kungs: null }), stats(), null]).map((m) => m.key);
  assert.deepEqual(list, ['allDays', 'togetherDone']);
  const list2 = Q.usable([stats({ kungs: 0 }), stats({ togetherMin: 30 })]).map((m) => m.key);
  assert.deepEqual(list2, ['allDays', 'togetherDone', 'kungs', 'togetherHours']);
});

test('퀘스트 목표: 지난 4주 평균 + 1 (보너스 + 2), 기록 없으면 기본, 최대값', () => {
  const all = Q.METRICS.find((m) => m.key === 'allDays');
  assert.equal(Q.targetOf(all, [stats({ allDays: 2 }), stats({ allDays: 3 }), stats({ allDays: 3 })], false), 4); // 평균 2.67 → 3 + 1
  assert.equal(Q.targetOf(all, [stats({ allDays: 2 }), stats({ allDays: 3 }), stats({ allDays: 3 })], true), 5);
  assert.equal(Q.targetOf(all, [], false), 3);
  assert.equal(Q.targetOf(all, [stats({ allDays: 7 })], true), 7);
  const hrs = Q.METRICS.find((m) => m.key === 'togetherHours');
  assert.equal(Q.targetOf(hrs, [stats({ togetherMin: 90 })], false), 3); // 1.5시간 → 2 + 1
});

test('퀘스트 진행: 값 · 퍼센트 · 성공', () => {
  const mon = Q.EPOCH; // 주 0 → 목록 첫째(allDays)가 퀘스트
  const q = Q.build({ mon, weeks: [stats({ allDays: 4, togetherDone: 1 }), stats({ allDays: 2, togetherDone: 1 })] });
  assert.equal(q.main.key, 'allDays');
  assert.equal(q.main.target, 3);
  assert.equal(q.main.done, true);
  assert.equal(q.main.progress, '3/3');
  assert.equal(q.done, true);
  assert.equal(q.bonus.key, 'togetherDone');
  assert.equal(q.bonus.target, 3);
  assert.equal(q.bonus.pct, 33);
  assert.equal(q.allDone, false);
});

const people = [{ key: 'her', name: '다진' }, { key: 'me', name: '준민' }];
const config = {
  people,
  routines: [
    { key: 'run', icon: '🏃', name: '달리기', owner: 'me', start: key(11, 1), end: null, order: 1 },
    { key: 'read', icon: '📖', name: '독서', owner: 'her', start: key(11, 1), end: null, order: 0, rest: [{ from: key(11, 16), to: key(11, 16) }] }
  ]
};
const routines = M.routinesFrom(config);

test('토마토 점수: 모두 해낸 날 +3 · 한 사람 +1 · 함께 끝낸 일 +1 · 하루 최대 6 · 퀘스트 +5/+2', () => {
  const checks = {
    ['run|' + key(11, 12)]: true, ['read|' + key(11, 12)]: true, // 모두 → 3
    ['run|' + key(11, 13)]: true,                                  // 한 사람 → 1
    ['run|' + key(11, 16)]: true                                   // 다진 쉬는 날 → 준민만 다 해도 모두 → 3
  };
  const todos = [1, 2, 3, 4, 5].map((i) => ({ id: 't' + i, done: true, scope: 'together', doneAt: new Date(2026, 10, 12, 12, i).toISOString() }))
    .concat([{ id: 'x', done: true, scope: 'me', doneAt: new Date(2026, 10, 13, 9).toISOString() }]);
  const g = G.build({ routines, checks, persons: ['her', 'me'], todos, today: day(11, 16), quests: [{ mon: day(11, 9), done: true, allDone: true }, { mon: day(11, 16), done: false, allDone: false }], start: day(11, 12) });
  // 12일 3 + 함께 5 → 최대 6 / 13일 1 / 14 · 15일 0 / 16일 3 / 퀘스트 7
  assert.deepEqual(g.week.map((d) => d.pts), [6, 1, 0, 0, 3]);
  assert.equal(g.total, 17);
  assert.equal(g.questPts, 7);
  assert.equal(g.stage, 1); // 새싹 (10점부터)
  assert.equal(g.stageKey, 'sprout');
  assert.equal(g.next.need, 13);
  assert.equal(g.todayPts, 3);
  assert.equal(g.weekPts, 3); // 이번 주(16일 월요일부터) 3 + 퀘스트 0
  assert.equal(g.thirsty, false);
});

test('토마토: 시작 전 기록은 안 셈 · 사흘 내리 0점이면 목마름 · 200점이면 수확', () => {
  const checks = { ['run|' + key(11, 10)]: true, ['read|' + key(11, 10)]: true };
  const g = G.build({ routines, checks, persons: ['her', 'me'], todos: [], today: day(11, 15), start: day(11, 12) });
  assert.equal(g.total, 0);
  assert.equal(g.stageKey, 'seed');
  assert.equal(g.thirsty, true); // 12 · 13 · 14 모두 0점, 오늘도 0
  assert.equal(G.stageOf(160), 5);
  const many = G.build({ routines, checks: {}, persons: ['her', 'me'], todos: [], today: day(11, 13), start: day(11, 12),
    quests: Array.from({ length: 30 }, (_, i) => ({ mon: day(11, 9) + 7 * i, done: true, allDone: true })) });
  assert.equal(many.total, 210);
  assert.equal(many.harvested, 1);
  assert.equal(many.score, 10);
});

test('토마토 그림: 단계마다 SVG, 목마르면 표시', () => {
  G.STAGES.forEach((s) => assert.match(T.svg(s.key), /^<svg class="tomato"/));
  assert.match(T.svg('leaf', { thirsty: true }), /tomato--thirsty/);
  assert.match(T.svg('red'), /#E5483B/);
});
