// 출출 쿠키 시험 (참조 reference/test/draw.test.js 그대로 — import 줄만 저장소 모듈로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import E_draw from '../js/eat.js';
const { draw, clampN, candidates, canDraw } = E_draw;
import { ME, HER, jarCookies, eatenCookies, mulberry32 } from './fixtures/eat/fixtures.mjs';

const all = () => [...jarCookies(), ...eatenCookies()];

test('D1 개수는 1~3으로 맞춤', () => {
  assert.equal(clampN(0), 1);
  assert.equal(clampN(5), 3);
  assert.equal(clampN('2'), 2);
  assert.equal(clampN(NaN), 1);
  assert.equal(clampN(2.7), 2);
});

test('D2 통 안 쿠키만, 서로 다른 n개', () => {
  const ids = draw({ cookies: all(), uid: ME, n: 3, rng: mulberry32(1) });
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  const jarIds = new Set(jarCookies().map((c) => c.id));
  for (const id of ids) assert.ok(jarIds.has(id));
});

test('D3 내 쿠키 / 단짝 쿠키만', () => {
  const byId = Object.fromEntries(all().map((c) => [c.id, c]));
  for (let s = 1; s < 30; s++) {
    for (const id of draw({ cookies: all(), uid: ME, n: 3, who: 'me', rng: mulberry32(s) })) assert.equal(byId[id].by, ME);
    for (const id of draw({ cookies: all(), uid: ME, n: 3, who: 'partner', rng: mulberry32(s) })) assert.equal(byId[id].by, HER);
  }
  assert.equal(candidates(all(), ME, 'partner').length, 5);
});

test('D4 통에 n개보다 적으면 있는 만큼, 없으면 빈 배열', () => {
  const two = jarCookies().slice(0, 2);
  assert.equal(draw({ cookies: two, uid: ME, n: 3, rng: mulberry32(2) }).length, 2);
  assert.deepEqual(draw({ cookies: eatenCookies(), uid: ME, n: 3 }), []);
});

test('D5 다시 뽑기: 방금 본 쿠키는 빼고, 모자라면 본 것으로 채움(새 것이 앞)', () => {
  const cookies = jarCookies();
  for (let s = 1; s < 50; s++) {
    const first = draw({ cookies, uid: ME, n: 3, rng: mulberry32(s) });
    const again = draw({ cookies, uid: ME, n: 3, exclude: first, rng: mulberry32(s + 100) });
    assert.equal(again.filter((id) => first.includes(id)).length, 0);
  }
  const four = cookies.slice(0, 4);
  const seen = four.slice(0, 3).map((c) => c.id);
  const r = draw({ cookies: four, uid: ME, n: 3, exclude: seen, rng: mulberry32(7) });
  assert.equal(r[0], four[3].id);
  assert.equal(r.length, 3);
  assert.equal(new Set(r).size, 3);
});

test('D6 고르게 뽑힘 (12개 중 1개를 12,000번 → 각각 1,000±150)', () => {
  const cookies = jarCookies();
  const rng = mulberry32(42);
  const count = Object.fromEntries(cookies.map((c) => [c.id, 0]));
  for (let i = 0; i < 12000; i++) count[draw({ cookies, uid: ME, n: 1, rng })[0]]++;
  for (const [id, v] of Object.entries(count)) assert.ok(v > 850 && v < 1150, `${id} ${v}`);
});

test('D7 깨기 버튼: 오늘 먹을 것이 있거나 고른 범위가 비면 꺼짐', () => {
  assert.equal(canDraw(jarCookies(), ME, 'all', null), true);
  assert.equal(canDraw(jarCookies(), ME, 'all', { eatId: 'c-kimchi' }), false);
  assert.equal(canDraw(jarCookies().filter((c) => c.by === ME), ME, 'partner', null), false);
});
