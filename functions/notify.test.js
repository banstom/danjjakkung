const test = require('node:test');
const assert = require('node:assert');
const N = require('./notify');

test('한국 시간: UTC 15:10 = 다음 날 00:10', () => {
  assert.deepStrictEqual(N.kstParts(new Date('2026-10-27T15:10:00Z')), { dateKey: '2026-10-28', hhmm: '00:10' });
  assert.deepStrictEqual(N.kstParts(new Date('2026-10-27T12:00:00Z')), { dateKey: '2026-10-27', hhmm: '21:00' });
});
test('설정 기본값', () => {
  assert.deepStrictEqual(N.prefsOf(null), { partner: true, remindAt: null, hide: false, weekly: true, todo: true, miss: true });
  assert.deepStrictEqual(N.prefsOf({ notify: { partner: false, remindAt: '21:30', hide: true } }), { partner: false, remindAt: '21:30', hide: true, weekly: true, todo: true, miss: true });
});
test('짝꿍 체크 문구: 오늘 · 어제만, 숨김', () => {
  const r = { name: '스쿼트 100개' };
  assert.strictEqual(N.checkMessage({ who: '다진', routine: r, date: '2026-10-27', today: '2026-10-27' }).body, '🎉 다진 님이 스쿼트 100개 완료!');
  assert.strictEqual(N.checkMessage({ who: '다진', routine: r, date: '2026-10-26', today: '2026-10-27' }).body, '다진 님이 어제 스쿼트 100개 기록을 남겼어요');
  assert.strictEqual(N.checkMessage({ who: '다진', routine: r, date: '2026-10-18', today: '2026-10-27' }), null);
  assert.strictEqual(N.checkMessage({ who: '다진', routine: r, date: '2026-10-27', today: '2026-10-27', hide: true }).body, '💌 다진 님이 새 기록을 남겼어요');
  assert.strictEqual(N.checkMessage({ who: '준민', routine: r, date: '2026-10-31', today: '2026-11-01' }).body, '준민 님이 어제 스쿼트 100개 기록을 남겼어요');
});
test('저녁 알림 시간', () => {
  assert.ok(N.dueRemind('21:00', '21:00'));
  assert.ok(N.dueRemind('21:00', '23:30'));
  assert.ok(!N.dueRemind('21:00', '20:30'));
  assert.ok(!N.dueRemind(null, '23:30'));
  assert.ok(!N.dueRemind('9:00', '23:30'));
});
test('하고 있는 루틴만', () => {
  assert.ok(N.activeOn({ start: '2026-10-18', end: null }, '2026-10-27'));
  assert.ok(!N.activeOn({ start: '2026-10-28', end: null }, '2026-10-27'));
  assert.ok(!N.activeOn({ start: '2026-10-01', end: '2026-10-20' }, '2026-10-27'));
  assert.ok(N.activeOn({ start: '2026-10-01', end: '2026-10-27' }, '2026-10-27'));
});
test('저녁 알림 문구', () => {
  assert.strictEqual(N.remindMessage({ missing: [] }), null);
  assert.strictEqual(N.remindMessage({ missing: [{ icon: '🎾', name: '테니스 연습' }] }).body, '🎾 오늘 테니스 연습 아직이에요');
  assert.strictEqual(N.remindMessage({ missing: [{ name: 'A' }, { name: 'B' }] }).body, '⏰ 오늘 루틴 2개가 아직이에요 · A, B');
  assert.strictEqual(N.remindMessage({ missing: [{ name: 'A' }], hide: true }).body, '⏰ 오늘 기록이 아직 남아 있어요');
});
test('꿍 보내기 문구: 남은 개수', () => {
  assert.strictEqual(N.kungMessage({ who: '준민', remaining: 2 }).body, '💌 준민 님이 꿍을 보냈어요 · 오늘 루틴 2개 남았어요');
  assert.strictEqual(N.kungMessage({ who: '준민', remaining: 0 }).body, '💌 준민 님이 꿍을 보냈어요');
  assert.strictEqual(N.kungMessage({ who: '다진' }).body, '💌 다진 님이 꿍을 보냈어요');
});
test('함께 할 일 알림 (v38): 문구 · 숨기기 · 설정 기본은 켬', () => {
  assert.strictEqual(N.todoMessage({ type: 'add', who: '준민', title: ' 장보기 ' }).body, '📝 준민 님이 함께 할 일을 추가했어요 · 장보기');
  assert.strictEqual(N.todoMessage({ type: 'done', who: '다진', title: '장보기' }).body, '✅ 다진 님이 함께 할 일을 끝냈어요 · 장보기');
  assert.strictEqual(N.todoMessage({ type: 'done', who: '다진', title: '장보기', hide: true }).body, '✅ 다진 님이 함께 할 일을 끝냈어요');
  assert.strictEqual(N.todoMessage({ type: 'add', who: '준민', title: '' }).body, '📝 준민 님이 함께 할 일을 추가했어요');
  assert.strictEqual(N.prefsOf({ todoNotify: false }).todo, false);
  assert.strictEqual(N.prefsOf({ notify: { partner: true } }).todo, true);
});
test('쉬기 (v38): 쉬는 날은 하고 있는 루틴이 아니다 (저녁 알림 · 꿍)', () => {
  const r = { key: 'run', owner: 'jm', start: '2026-11-01', end: null, rest: [{ from: '2026-11-05', to: '2026-11-07' }, { from: '2026-11-20', to: null }, { from: 'x' }] };
  assert.strictEqual(N.activeOn(r, '2026-11-04'), true);
  assert.strictEqual(N.activeOn(r, '2026-11-06'), false);
  assert.strictEqual(N.activeOn(r, '2026-11-08'), true);
  assert.strictEqual(N.activeOn(r, '2026-12-25'), false);
  assert.strictEqual(N.activeOn(Object.assign({}, r, { rest: 'nope' }), '2026-11-06'), true);
});
test('일요일 돌아보기: 설정 기본은 켬, 끈 사람만 꺼짐', () => {
  assert.strictEqual(N.prefsOf(null).weekly, true);
  assert.strictEqual(N.prefsOf({ notify: { partner: true, hide: false } }).weekly, true);
  assert.strictEqual(N.prefsOf({ weekly: false, notify: { partner: true } }).weekly, false);
  assert.strictEqual(N.prefsOf({ notify: { weekly: false } }).weekly, true); // notify 안의 값은 보지 않는다 (옛 앱이 덮어쓰는 곳)
});
test('일요일 돌아보기: 모두 해낸 날은 앱 달력의 「모두」와 같은 규칙', () => {
  const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
  const routines = [
    { key: 'squat', owner: 'dj', start: '2026-10-18' },
    { key: 'run', owner: 'jm', start: '2026-10-18' },
    { key: 'water', owner: 'jm', start: '2026-10-29' },
    { key: 'old', owner: 'jm', start: '2026-10-01', end: '2026-10-27' }
  ];
  const done = new Set(['squat|2026-10-26', 'run|2026-10-26', 'old|2026-10-26', 'squat|2026-10-27', 'run|2026-10-27',
    'squat|2026-10-31', 'run|2026-10-31', 'water|2026-10-31', 'run|2026-11-01', 'water|2026-11-01']);
  // 10/26 모두 · 10/27 old 안 함 → 아님 · 10/31 모두 · 11/1 다진 안 함 → 아님
  assert.strictEqual(N.allDoneDays({ routines, done, persons: ['dj', 'jm'], dates }), 2);
  // 한 사람만 루틴이 있는 날은 그 사람이 다 하면 모두 (그날 참여 중인 사람 기준)
  assert.strictEqual(N.allDoneDays({ routines: [routines[0]], done, persons: ['dj', 'jm'], dates }), 3);
  assert.strictEqual(N.allDoneDays({ routines: [], done, persons: ['dj', 'jm'], dates }), 0);
});
test('일요일 돌아보기 문구', () => {
  assert.strictEqual(N.weeklyMessage({ allDays: 2, together: 3 }).body, '🎉 이번 주 우리 · 모두 해낸 날 2일 · 함께 끝낸 일 3개 · 한 주를 돌아볼까요?');
  assert.strictEqual(N.weeklyMessage({ allDays: 0, together: 1 }).body, '🎉 이번 주 우리 · 함께 끝낸 일 1개 · 한 주를 돌아볼까요?');
  assert.strictEqual(N.weeklyMessage({ allDays: 0, together: 0 }).body, '📅 이번 주도 수고했어요 · 한 주를 돌아볼까요?');
});
