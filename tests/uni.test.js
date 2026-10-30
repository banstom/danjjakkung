// u&I 평면 계산 테스트 — 요청서 3번(좌표) · 이진 삽입
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/uni');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, (msg || '') + ' ' + a + ' ≠ ' + b);

test('섞는 비율: 1개면 놓은 자리 그대로, 4개면 반반', () => {
  assert.strictEqual(U.weight(1), 1);
  near(U.weight(4), 0.5);
  near(U.weight(8), 0.3);
});

test('1개는 놓은 자리, 여러 개는 놓은 값과 순위를 섞는다', () => {
  const one = U.layout([{ id: 'a', createdAt: '1', place: { u: 0.9, i: 0.2 } }]);
  near(one[0].x, 0.9); near(one[0].y, 0.2);
  assert.strictEqual(one[0].urgentRank, 1);
  // 4개: w = 0.5
  const four = U.layout(['a', 'b', 'c', 'd'].map((id, k) => ({ id, createdAt: String(k), place: { u: [0.9, 0.1, 0.5, 0.52][k], i: 0.5 } })));
  const byId = Object.fromEntries(four.map((t) => [t.id, t]));
  near(byId.a.x, 0.5 * 0.9 + 0.5 * 3.5 / 4);
  near(byId.b.x, 0.5 * 0.1 + 0.5 * 0.5 / 4);
  assert.deepStrictEqual(['a', 'd', 'c', 'b'].map((id) => byId[id].urgentRank), [1, 2, 3, 4]);
  // 같은 값이면 먼저 만든 것이 앞(덜 급한 쪽)
  assert.ok(byId.a.y < byId.d.y);
});

test('놓은 화면 자리 → raw: 이웃 사이 비율 그대로, 순서는 지킨다', () => {
  const ln = U.line([{ id: 'a', raw: 0.2, title: 'A' }, { id: 'b', raw: 0.6, title: 'B' }, { id: 'c', raw: 0.9, title: 'C' }]);
  assert.deepStrictEqual(ln.map((o) => o.id), ['a', 'b', 'c']);
  const mid = (ln[0].pos + ln[1].pos) / 2;
  near(U.rawFrom(mid, ln), 0.4);
  near(U.rawFrom(ln[1].pos, ln), 0.6);
  near(U.rawFrom(1, ln), 1);
  near(U.rawFrom(0, ln), 0);
  assert.strictEqual(U.rawFrom(0.3, []), 0.3); // 첫 할 일: 놓은 자리 그대로
  // 새 할 일을 넣고 다시 계산해도 이웃 사이에 남는다
  const r = U.rawFrom(mid, ln);
  const after = U.layout([{ id: 'a', createdAt: '1', place: { u: 0.2, i: 0 } }, { id: 'b', createdAt: '2', place: { u: 0.6, i: 0 } }, { id: 'c', createdAt: '3', place: { u: 0.9, i: 0 } }, { id: 'n', createdAt: '4', place: { u: r, i: 0 } }]);
  assert.deepStrictEqual(after.slice().sort((x, y) => x.x - y.x).map((t) => t.id), ['a', 'n', 'b', 'c']);
});

test('문장: 「A보다 급하고 B보다 덜 급해요」', () => {
  const ln = U.line([{ id: 'a', raw: 0.2, title: 'A' }, { id: 'b', raw: 0.6, title: 'B' }]);
  const d = U.describe((ln[0].pos + ln[1].pos) / 2, ln, 'u');
  assert.deepStrictEqual([d.below, d.above, d.more, d.less], ['A', 'B', '급하고', '덜 급해요']);
  assert.strictEqual(U.describe(0.99, ln, 'i'), '지금 할 일 중 가장 중요해요');
  assert.strictEqual(U.describe(0.01, ln, 'u'), '지금 할 일 중 가장 덜 급해요');
});

test('위치 추천: 많아야 ceil(log2(n+1))번, 틈 자리', () => {
  assert.strictEqual(U.maxAsk(7), 3); assert.strictEqual(U.maxAsk(30), 5); assert.strictEqual(U.maxAsk(1), 1);
  // 7개 중 「네, 아니요, 네」 → 틈 5
  let s = U.askStart(7), asked = 0;
  for (const a of ['yes', 'no', 'yes']) { assert.ok(!U.askDone(s)); s = U.askAnswer(s, a); asked++; }
  assert.ok(U.askDone(s)); assert.strictEqual(U.askSlot(s), 5);
  // 끝까지 「네」면 맨 위, 「아니요」면 맨 아래 — 모든 n 에서 질문 수가 한도 안
  for (let n = 1; n <= 40; n++) for (const a of ['yes', 'no']) {
    let t = U.askStart(n), q = 0;
    while (!U.askDone(t)) { t = U.askAnswer(t, a); q++; }
    assert.ok(q <= U.maxAsk(n), n + ' ' + q);
    assert.strictEqual(U.askSlot(t), a === 'yes' ? n : 0);
  }
  // 「비슷해요」 = 비교한 할 일 바로 위
  const t = U.askAnswer(U.askStart(7), 'same');
  assert.strictEqual(U.askSlot(t), 4);
  const ln = U.line([0.1, 0.3, 0.5].map((raw, k) => ({ id: 'x' + k, raw })));
  near(U.slotPos(0, ln), ln[0].pos / 2); near(U.slotPos(3, ln), (ln[2].pos + 1) / 2);
  assert.strictEqual(U.slotOf(U.slotPos(2, ln), ln), 2);
});

test('블록 이름은 7자에서 자른다', () => {
  assert.strictEqual(U.short('부모님께 전화드리기'), '부모님께 전화…');
  assert.strictEqual(U.short('세차하기'), '세차하기');
});
