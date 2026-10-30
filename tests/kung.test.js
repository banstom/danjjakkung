// node --test tests/kung.test.js — 꿍 보내기 칸(model.kung) 계산
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const M = require('../js/model.js');

const today = D.fromYMD(2026, 10, 30);
const ME = 'uidjun', HER = 'uiddajin';
const routine = (key, owner, who, extra) => Object.assign({ key, icon: '🏃', name: key, who, owner, start: '2026-10-01', end: null, order: 0 }, extra || {});
const base = (over) => Object.assign({
  config: { people: { [ME]: '준민', [HER]: '다진' }, routines: [routine('a', ME, '준민'), routine('b', HER, '다진'), routine('c', HER, '다진')] },
  checks: {}, meta: {}, me: ME, identity: 'account', today, filter: 'all', page: 0, sheetDay: null, kungs: []
}, over || {});

test('짝꿍 루틴이 남아 있으면 보낼 수 있다 (남은 개수 포함)', () => {
  const k = M.build(base({ checks: { ['b|2026-10-30']: true } })).kung;
  assert.deepEqual(k, { to: HER, toName: '다진', remaining: 1, total: 2, status: 'ready' });
});
test('오늘 이미 보냈으면 잠긴다 (각자 기준 — 짝꿍이 보낸 것은 내 칸에 영향 없음)', () => {
  assert.equal(M.build(base({ kungs: [{ from: ME, to: HER }] })).kung.status, 'sent');
  assert.equal(M.build(base({ kungs: [{ from: HER, to: ME }] })).kung.status, 'ready');
});
test('짝꿍이 다 했으면 보내지 않는다', () => {
  const k = M.build(base({ checks: { ['b|2026-10-30']: true, ['c|2026-10-30']: true } })).kung;
  assert.equal(k.status, 'done');
  assert.equal(k.remaining, 0);
});
test('짝꿍의 오늘 루틴이 없거나 규칙이 막혔으면 칸이 없다', () => {
  const none = base(); none.config.routines = [routine('a', ME, '준민'), routine('b', HER, '다진', { start: '2026-11-05' })];
  assert.equal(M.build(none).kung, null);
  assert.equal(M.build(base({ kungOff: true })).kung, null);
});
