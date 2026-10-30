const test = require('node:test');
const assert = require('node:assert');
const N = require('./notify');

test('한국 시간: UTC 15:10 = 다음 날 00:10', () => {
  assert.deepStrictEqual(N.kstParts(new Date('2026-10-27T15:10:00Z')), { dateKey: '2026-10-28', hhmm: '00:10' });
  assert.deepStrictEqual(N.kstParts(new Date('2026-10-27T12:00:00Z')), { dateKey: '2026-10-27', hhmm: '21:00' });
});
test('설정 기본값', () => {
  assert.deepStrictEqual(N.prefsOf(null), { partner: true, remindAt: null, hide: false });
  assert.deepStrictEqual(N.prefsOf({ notify: { partner: false, remindAt: '21:30', hide: true } }), { partner: false, remindAt: '21:30', hide: true });
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
