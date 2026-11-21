// 출출 쿠키 시험 (참조 reference/test/jar.test.js 그대로 — import 줄만 저장소 모듈로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import E_jar from '../js/eat.js';
const { isSecret, jarSummary, newPartnerCount, listRows, tabCounts } = E_jar;
import E_mapAsk from '../js/eat.js';
const { paintAsk } = E_mapAsk;
import EC from '../js/eat-cookie-svg.js';
const { cookieSvg } = EC;
import { ME, HER, NOW, seoul, jarCookies, eatenCookies } from './fixtures/eat/fixtures.mjs';

const all = () => [...jarCookies(), ...eatenCookies()];

test('J1 통 줄: 12개 · 나 7 · 단짝 5 · 가장 오래된 쿠키 14일 전 (목업 숫자)', () => {
  assert.deepEqual(jarSummary(all(), ME, NOW), { total: 12, mine: 7, partner: 5, oldestAgo: '14일 전', oldestDays: 14 });
  assert.deepEqual(jarSummary([], ME, NOW), { total: 0, mine: 0, partner: 0, oldestAgo: null, oldestDays: null });
});

test('J2 비밀: 단짝 쿠키가 통 안에 있을 때만', () => {
  const [mara] = jarCookies().filter((c) => c.id === 'c-mara');
  assert.equal(isSecret(mara, ME), true);
  assert.equal(isSecret(mara, HER), false);
  assert.equal(isSecret({ ...mara, state: 'today' }, ME), false);
  assert.equal(isSecret({ ...mara, state: 'eaten' }, ME), false);
});

test('J3 목록: 비밀 줄에는 음식 · 가게 · 메모가 아예 없음, 최근 순', () => {
  const rows = listRows(all(), ME, 'jar', NOW);
  assert.equal(rows.length, 12);
  assert.equal(rows[0].id, 'c-tteokkochi');
  const secret = rows.filter((r) => r.secret);
  assert.equal(secret.length, 5);
  for (const r of secret) assert.deepEqual(Object.keys(r).sort(), ['date', 'id', 'mine', 'secret']);
  const tteok = rows.find((r) => r.id === 'c-tteok');
  assert.equal(tteok.again, true);
  assert.equal(tteok.editable, true);
  assert.equal(rows.find((r) => r.id === 'c-sushi').date, '11월 19일');
});

test('J4 먹은 것 탭: 먹은 순, 별점 평균, 고치기 없음', () => {
  const rows = listRows(all(), ME, 'eaten', NOW);
  assert.deepEqual(rows.map((r) => r.id), ['c-old-ramen', 'c-old-tteok']);
  assert.equal(rows[1].avg, 4.5);
  assert.equal(rows[1].secret, false);
  assert.ok(rows.every((r) => !r.editable));
  assert.deepEqual(tabCounts(all()), { jar: 12, eaten: 2 });
});

test('J5 입구 「단짝 +n」: 마지막으로 연 뒤 단짝이 넣은 통 안 쿠키', () => {
  assert.equal(newPartnerCount(all(), ME, seoul(2026, 11, 18, 0, 0)), 2);
  assert.equal(newPartnerCount(all(), ME, NOW), 0);
  assert.equal(newPartnerCount(all(), ME, null), 5);
});

test('J6 지도 칠하기 물음: 함께 + 카카오 장소 + 코드 + 아직 안 칠함', () => {
  const [katsu] = jarCookies().filter((c) => c.id === 'c-katsu');
  assert.equal(paintAsk({ cookie: katsu, together: true, paintedSigungu: new Set() }), '11440');
  assert.equal(paintAsk({ cookie: katsu, together: false, paintedSigungu: new Set() }), null);
  assert.equal(paintAsk({ cookie: katsu, together: true, paintedSigungu: new Set(['11440']) }), null);
  assert.equal(paintAsk({ cookie: { ...katsu, place: { name: '카츠 하루' } }, together: true, paintedSigungu: new Set() }), null);
  assert.equal(paintAsk({ cookie: { food: '라멘' }, together: true, paintedSigungu: new Set() }), null);
});

test('J7 쿠키 그림: 색 값 없이 토큰 클래스만, 단짝 띠 · 깨진 쿠키 · 크기', () => {
  const whole = cookieSvg();
  const her = cookieSvg({ who: 'partner', open: true, size: 40 });
  assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(whole + her));
  assert.ok(whole.includes('viewBox="0 0 120 84"') && !whole.includes(' her'));
  assert.ok(her.includes('class="ck kk kk-sticker her open"'));
  assert.ok(her.includes('viewBox="0 -14 120 102"'));
  assert.ok(her.includes('--s: 40px'));
  assert.ok(whole.includes('aria-hidden="true"'));
});
