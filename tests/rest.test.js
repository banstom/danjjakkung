// node --test tests/  — v38 루틴 쉬기: 기간 정리 · 연속 유지 · 모두 해낸 날 · 다시 시작
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const S = require('../js/streak.js');
const M = require('../js/model.js');

const day = (m, d) => D.fromYMD(2026, m, d);
const key = (m, d) => D.toKey(day(m, d));

test('streak: 쉬는 날은 세지도 끊지도 않는다', () => {
  // 11/1~3 함, 4~6 쉼, 7 함, 8 오늘(아직)
  const done = [day(11, 1), day(11, 2), day(11, 3), day(11, 7)];
  const s = S.summary({ start: day(11, 1), today: day(11, 8), isDone: (d) => done.includes(d), isRest: (d) => d >= day(11, 4) && d <= day(11, 6) });
  assert.equal(s.streak, 4);
  assert.equal(s.best, 4);
  assert.equal(s.restCount, 3);
  assert.equal(s.lastMiss, null);
  assert.equal(s.count, 4);
  // 오늘 쉬는 날이면 todayRest, 연속은 어제까지 그대로
  const r = S.summary({ start: day(11, 1), today: day(11, 5), isDone: (d) => done.includes(d), isRest: (d) => d >= day(11, 4) });
  assert.equal(r.todayRest, true);
  assert.equal(r.todayDone, false);
  assert.equal(r.streak, 3);
});

test('restFrom: 이상한 값은 빼고, 시작일 앞은 자르고, 겹치거나 붙은 기간은 합친다', () => {
  const list = M.restFrom([
    { from: key(11, 10), to: key(11, 12) },
    { from: key(11, 13), to: key(11, 14) },   // 붙음 → 합침
    { from: 'nope' },
    { from: key(11, 20), to: key(11, 19) },   // 끝이 앞 → 뺌
    { from: key(10, 1), to: key(10, 3) },     // 시작일 앞 → 뺌
    { from: key(11, 25), to: null }
  ], day(11, 1));
  assert.deepEqual(list, [{ from: day(11, 10), to: day(11, 14) }, { from: day(11, 25), to: null }]);
  // 열린 기간 뒤 기간은 그 안에 들어감
  assert.deepEqual(M.restFrom([{ from: key(11, 5), to: null }, { from: key(11, 9), to: key(11, 10) }], day(11, 1)), [{ from: day(11, 5), to: null }]);
});

const people = [{ key: 'her', name: '다진' }, { key: 'me', name: '준민' }];
function cfg(rest) {
  return {
    people,
    routines: [
      { key: 'run', icon: '🏃', name: '달리기', owner: 'me', start: key(11, 1), end: null, order: 1, rest },
      { key: 'read', icon: '📖', name: '독서', owner: 'her', start: key(11, 1), end: null, order: 0 }
    ]
  };
}
const checksFor = (keys) => Object.fromEntries(keys.map((k) => [k, true]));

test('모두 해낸 날: 루틴이 전부 쉬는 사람은 빼고 판단, 둘 다 쉬면 rest', () => {
  const rs = M.routinesFrom(cfg([{ from: key(11, 5), to: key(11, 7) }]));
  const checks = checksFor(['read|' + key(11, 6)]);
  const isDone = (r, d) => M.activeOn(r, d) && !!checks[r.key + '|' + D.toKey(d)];
  assert.equal(M.dayLevel(rs, ['her', 'me'], day(11, 6), isDone).level, 'full'); // 준민은 쉬는 중 → 다진만 다 하면 모두
  assert.equal(M.dayLevel(rs, ['her', 'me'], day(11, 8), isDone).level, 'none');
  assert.equal(M.dayLevel(rs.filter((r) => r.owner === 'me'), ['me'], day(11, 6), isDone).level, 'rest');
  assert.equal(M.activeOn(rs[1], day(11, 6)), false); // run (order 1)
  assert.equal(M.restingOn(rs[1], day(11, 6)), true);
});

test('루틴 탭: 쉬는 중 카드 · 꿍 남은 개수 · 달력 칸 · 시트 줄', () => {
  const rest = [{ from: key(11, 10), to: null }];
  const checks = checksFor(['run|' + key(11, 9)]);
  const m = M.build({ config: cfg(rest), checks, today: day(11, 12), filter: 'all', page: 0, sheetDay: day(11, 12), me: 'me' });
  const run = m.cards.find((c) => c.key === 'run');
  assert.equal(run.rest, '🌿 쉬는 중 · 3일째');
  assert.equal(run.canWake, true);
  assert.match(run.streakLabel, /쉬는 동안/);
  assert.equal(run.streakValue, '1일'); // 11/9 했고 10일부터 쉬는 중 → 연속 1일 그대로
  const row = m.sheet.rows.find((r) => r.key === 'run');
  assert.equal(row.rest, true);
  assert.equal(row.button, '쉬어요');
  // 다진이 보는 화면: 꿍 대상(준민)이 전부 쉬면 칸 없음
  const her = M.build({ config: cfg(rest), checks, today: day(11, 12), filter: 'all', page: 0, me: 'her' });
  assert.equal(her.kung, null);
  const mine = M.build({ config: cfg(rest), checks, today: day(11, 12), filter: 'me', page: 0, me: 'me' });
  assert.equal(mine.grid.cells.find((c) => c.day === day(11, 11)).level, 'rest');
  assert.ok(mine.grid.legend.some((l) => l.level === 'rest'));
});

test('restPlan: 기본 · 오늘 이미 체크했으면 내일부터 · 날짜 검사', () => {
  const r = M.routinesFrom(cfg([])).find((x) => x.key === 'run');
  const t = day(11, 12);
  assert.deepEqual(M.restPlan({ from: 'today', until: 'open' }, r, t, false), { from: t, to: null, error: '' });
  assert.deepEqual(M.restPlan({ from: 'today', until: '7' }, r, t, true), { from: t + 1, to: t + 7, error: '' });
  assert.equal(M.restPlan({ from: 'tomorrow', until: 'date', untilDate: key(11, 12) }, r, t, false).error, '끝나는 날이 쉬기 시작하는 날보다 앞이에요');
  assert.equal(M.restPlan({ from: 'date', fromDate: key(11, 20), until: 'date', untilDate: key(11, 22) }, r, t, false).to, day(11, 22));
});

test('restAdd · restWake: 다시 시작하면 쉬는 기간은 어제까지, 오늘 · 앞으로 시작한 기간은 지움', () => {
  const t = day(11, 12);
  const list = M.restAdd([{ from: key(11, 2), to: key(11, 3) }], day(11, 8), null);
  assert.deepEqual(list, [{ from: key(11, 2), to: key(11, 3) }, { from: key(11, 8), to: null }]);
  assert.deepEqual(M.restWake(list, t), [{ from: key(11, 2), to: key(11, 3) }, { from: key(11, 8), to: key(11, 11) }]);
  assert.deepEqual(M.restWake([{ from: key(11, 12), to: null }], t), []);
  assert.deepEqual(M.restWake([{ from: key(11, 20), to: key(11, 25) }], t), []); // 예약 취소
});

test('내 루틴 시트: 쉬는 중 · 예약 상태와 버튼', () => {
  const now = M.build({ config: cfg([{ from: key(11, 10), to: key(11, 20) }]), checks: {}, today: day(11, 12), me: 'me', manage: { open: true, form: null } });
  const it = now.manage.current.find((x) => x.key === 'run');
  assert.equal(it.status, '🌿 쉬는 중 · 11월 20일까지');
  assert.equal(it.wake, '다시 시작');
  const soon = M.build({ config: cfg([{ from: key(11, 15), to: null }]), checks: {}, today: day(11, 12), me: 'me', manage: { open: true, form: null } });
  const it2 = soon.manage.current.find((x) => x.key === 'run');
  assert.match(it2.status, /11월 15일부터 쉬어요/);
  assert.equal(it2.wake, '쉬기 취소');
  const form = M.build({ config: cfg([]), checks: { ['run|' + key(11, 12)]: true }, today: day(11, 12), me: 'me',
    manage: { open: true, form: { key: 'run', name: '달리기', icon: '🏃', start: key(11, 1), rest: { from: 'today', until: 'open' } } } });
  assert.equal(form.manage.form.canRest, true);
  assert.equal(form.manage.form.rest.checkedToday, true);
  assert.equal(form.manage.form.rest.note, '11월 13일부터 다시 시작할 때까지 쉬어요');
});

test('(v39) 루틴 카드는 사람별로 모은다: 전체면 두 묶음 · 칩 순서 · 한 사람 필터면 묶음 표시 없음', () => {
  const c = cfg([]);
  c.routines.push({ key: 'gym', icon: '🏋️', name: '헬스', owner: 'me', start: key(11, 1), end: null, order: 2 });
  c.routines.push({ key: 'yoga', icon: '🧘', name: '요가', owner: 'her', start: key(11, 1), end: null, order: 3 });
  const m = M.build({ config: c, checks: {}, today: day(11, 12), filter: 'all', page: 0, me: 'me' });
  assert.equal(m.grouped, true);
  assert.deepEqual(m.groups.map((g) => [g.person, g.mine, g.cards.map((x) => x.key).join(',')]), [['her', false, 'read,yoga'], ['me', true, 'run,gym']]);
  assert.deepEqual(m.chips.slice(1).map((x) => x.id), m.groups.map((g) => g.person));
  const one = M.build({ config: c, checks: {}, today: day(11, 12), filter: 'me', page: 0, me: 'me' });
  assert.equal(one.grouped, false);
  assert.deepEqual(one.cards.map((x) => x.key), ['run', 'gym']);
});
