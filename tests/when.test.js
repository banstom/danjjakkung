// node --test tests/  — v41 달력 비율 5단계 · 언제 할지 · 어제 놓침
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const M = require('../js/model.js');
const N = require('../functions/notify.js');

const day = (m, d) => D.fromYMD(2026, m, d);
const key = (m, d) => D.toKey(day(m, d));
const people = { her: '다진', me: '준민' };
const R = (k, owner, extra) => Object.assign({ key: k, icon: '⭐', name: k, owner, start: key(11, 1), end: null, order: 0 }, extra || {});

test('stepOf: 0% · 1–33% · 34–66% · 67–99% · 100%(모두 해낸 날만 full)', () => {
  assert.equal(M.stepOf('none', 0, 9), 'none');
  assert.equal(M.stepOf('half', 1, 9), 's1');
  assert.equal(M.stepOf('half', 3, 9), 's1');
  assert.equal(M.stepOf('half', 4, 9), 's2');
  assert.equal(M.stepOf('half', 5, 9), 's2');
  assert.equal(M.stepOf('half', 6, 9), 's3'); // 67%
  assert.equal(M.stepOf('half', 7, 9), 's3');
  assert.equal(M.stepOf('half', 8, 9), 's3');
  assert.equal(M.stepOf('full', 9, 9), 'full');
  assert.equal(M.stepOf('half', 2, 2), 's3'); // 비율은 100%여도 루틴 없는 사람이 있어 「모두」가 아닌 날
});

test('달력 칸 · 시트 요약: 둘이 합쳐 비율, 사람별 n/m', () => {
  const config = { people, routines: [R('a', 'me', { order: 0 }), R('b', 'me', { order: 1 }), R('c', 'her', { order: 2 }), R('d', 'her', { order: 3 })] };
  const checks = { ['a|' + key(11, 10)]: true, ['b|' + key(11, 10)]: true, ['c|' + key(11, 10)]: true };
  const m = M.build({ config, checks, today: day(11, 12), filter: 'all', page: 0, sheetDay: day(11, 10), me: 'me' });
  const cell = m.grid.cells.find((c) => c.day === day(11, 10));
  assert.equal(cell.level, 's3'); // 3/4 = 75%
  assert.equal(m.grid.cells.find((c) => c.day === day(11, 11)).level, 'none');
  assert.equal(m.sheet.summary, '둘이 합쳐 3 / 4개 (75%) · 준민 2/2 · 다진 1/2'); // 사람 칩 순서
  assert.equal(m.sheet.full, false);
});

test('whenFrom · whenText · whenSave: 문장 · 시각 둘 다 / 하나만 / 둘 다 없으면 언제든', () => {
  assert.equal(M.whenFrom(null), null);
  assert.equal(M.whenFrom({ cue: '  ', at: '25:00' }), null);
  assert.deepEqual(M.whenFrom({ cue: '일어나자마자', at: '07:30', remind: true }), { cue: '일어나자마자', at: '07:30', remind: true });
  assert.deepEqual(M.whenFrom({ cue: '자기 전에', remind: true }), { cue: '자기 전에' }); // 시각 없으면 알림 없음
  assert.equal(M.whenText(M.whenFrom({ cue: '일어나자마자', at: '07:30' })), '☀️ 일어나자마자 · 07:30');
  assert.equal(M.whenText(M.whenFrom({ at: '21:00' })), '🌙 21:00');
  assert.equal(M.whenText(M.whenFrom({ cue: '수업 끝나고' })), '🌤️ 수업 끝나고');
  assert.equal(M.whenText(null), '언제든');
  assert.equal(M.whenSave({ mode: 'any', cue: '아침', at: '07:00' }), null);
  assert.equal(M.whenSave({ mode: 'set', cue: '', at: '' }), null);
  assert.deepEqual(M.whenEdit({ at: '06:00', remind: true }), { mode: 'set', cue: '', at: '06:00', remind: true });
  assert.equal(M.validateRoutine({ name: '독서', icon: '📚', start: key(11, 1), when: { mode: 'set', cue: 'x'.repeat(21) } }), '「언제」 문장은 20자까지 쓸 수 있어요');
});

test('카드 순서: 어제 놓친 것 → 시각 순 → 문장만 → 언제든 (같은 자리는 원래 순서), 어제 놓침 표시', () => {
  const config = {
    people,
    routines: [
      R('any1', 'me', { order: 0 }),
      R('night', 'me', { order: 1, when: { at: '22:00' } }),
      R('cue', 'me', { order: 2, when: { cue: '수업 끝나고' } }),
      R('morning', 'me', { order: 3, when: { cue: '일어나자마자', at: '07:00' } }),
      R('miss', 'me', { order: 4, when: { at: '06:00' } }),
      R('rest', 'me', { order: 5, rest: [{ from: key(11, 11), to: null }] })
    ]
  };
  // 어제(11/11) 한 것: any1 · night · cue · morning, 안 한 것: miss / rest 는 쉬는 중
  const checks = Object.fromEntries(['any1', 'night', 'cue', 'morning'].map((k) => [k + '|' + key(11, 11), true]));
  const m = M.build({ config, checks, today: day(11, 12), filter: 'me', page: 0, me: 'me' });
  assert.deepEqual(m.cards.map((c) => c.key), ['miss', 'morning', 'night', 'cue', 'any1', 'rest']);
  assert.equal(m.cards[0].missed, true);
  assert.equal(m.cards.find((c) => c.key === 'rest').missed, false);
  assert.equal(m.missedMine, 1);
  // 오늘 해 버리면 놓침 표시는 사라진다
  const m2 = M.build({ config, checks: Object.assign({ ['miss|' + key(11, 12)]: true }, checks), today: day(11, 12), filter: 'me', page: 0, me: 'me' });
  assert.equal(m2.missedMine, 0);
  assert.equal(m2.cards[0].key, 'miss'); // 06:00 이 가장 이른 시각
  // 짝꿍 화면에서는 배너 숫자에 안 들어감
  assert.equal(M.build({ config, checks, today: day(11, 12), filter: 'all', page: 0, me: 'her' }).missedMine, 0);
});

test('서버: whenOf · dueAt(그 시각부터 45분 안) · 아침 8시 · 문구 · 설정', () => {
  assert.deepEqual(N.whenOf({ when: { at: '07:30', remind: true, cue: ' 일어나자마자 ' } }), { cue: '일어나자마자', at: '07:30', remind: true });
  assert.equal(N.whenOf({ when: { at: '7:30' } }), null);
  assert.equal(N.dueAt('07:30', '07:30'), true);
  assert.equal(N.dueAt('07:20', '07:30'), true);
  assert.equal(N.dueAt('07:30', '08:14'), true);
  assert.equal(N.dueAt('07:30', '08:15'), false);
  assert.equal(N.dueAt('07:30', '07:15'), false);
  assert.equal(N.dueMorning('08:00'), true);
  assert.equal(N.dueMorning('09:00'), false);
  assert.equal(N.atMessage({ r: { icon: '📚', name: '독서', when: { cue: '자기 전에', at: '23:00' } } }).body, '📚 자기 전에 · 독서 할 시간이에요');
  assert.equal(N.atMessage({ r: { name: '독서' }, hide: true }).body, '⏰ 정해 둔 루틴 할 시간이에요');
  assert.equal(N.missMessage({ missed: [] }), null);
  assert.equal(N.missMessage({ missed: [{ name: '독서' }, { name: '달리기' }] }).body, '🌅 어제 못 한 루틴이 2개 있어요 · 독서, 달리기 · 오늘은 꼭! 💪');
  assert.equal(N.prefsOf({ missNotify: false }).miss, false);
  assert.equal(N.prefsOf(null).miss, true);
  // 앱과 서버가 같은 규칙으로 「언제」를 읽는다
  for (const w of [{ cue: 'a', at: '00:00', remind: true }, { at: '12:61' }, { cue: '', at: '' }, { cue: 'x'.repeat(30) }, null, { remind: true }]) {
    const a = M.whenFrom(w), s = N.whenOf({ when: w });
    assert.deepEqual(a ? { cue: a.cue || '', at: a.at || '', remind: !!a.remind } : null, s, JSON.stringify(w));
  }
});

test('(v42) 칸 시트: 진행 중인 루틴만, 사람별로 묶음 (사람 칩 순서 · n/m)', () => {
  const config = { people, routines: [
    R('a', 'me', { order: 0 }), R('b', 'her', { order: 1 }), R('c', 'me', { order: 2 }),
    R('late', 'her', { order: 3, start: key(11, 20) }),                       // 시작 전
    R('nap', 'her', { order: 4, rest: [{ from: key(11, 10), to: null }] }),   // 쉬는 중
    R('old', 'me', { order: 5, end: key(11, 5) })                             // 그만둔 뒤
  ] };
  const checks = { ['a|' + key(11, 12)]: true };
  const m = M.build({ config, checks, today: day(11, 12), filter: 'all', page: 0, sheetDay: day(11, 12), me: 'me' });
  assert.deepEqual(m.sheet.rows.map((r) => r.key).sort(), ['a', 'b', 'c']);
  assert.deepEqual(m.sheet.groups.map((g) => [g.name, g.mine, g.count, g.rows.map((r) => r.key).join(',')]), [['준민', true, '1/2', 'a,c'], ['다진', false, '0/1', 'b']]);
});
