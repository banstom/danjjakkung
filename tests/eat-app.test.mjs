// 출출 쿠키 화면 상태 (js/app-eat.js) · 그리기 (js/view-eat.js) — 비밀 · 오늘 먹을 것 · 입구 · 규칙 조각 · 토큰
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ME, HER, NOW, jarCookies, eatenCookies } from './fixtures/eat/fixtures.mjs';
import '../js/eat.js'; import '../js/eat-text.js'; import '../js/eat-cookie-svg.js'; import '../js/view-eat.js'; import '../js/app-eat.js';
const RT = globalThis.RT;
const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

function store(cookies, today) {
  const calls = [];
  return { calls,
    watchEats: (next) => { setImmediate(() => next(cookies)); return () => {}; },
    watchEatToday: (next) => { setImmediate(() => next(today)); return () => {}; },
    saveUserFields: (...a) => { calls.push(['user', ...a]); return Promise.resolve(); },
    returnEat: (id) => { calls.push(['return', id]); return Promise.resolve({ ok: true }); },
    addDraw: () => Promise.resolve('d1'), updateDraw: () => Promise.resolve() };
}
function host(st, user) {
  return { store: () => st, render: () => {}, toast: () => {}, me: () => ME, partner: () => HER, nameOf: (u) => (u === ME ? '준민' : '다진'), slotOf: (u) => (u === ME ? 'me' : 'her'),
    focus: () => {}, user: () => user || null, now: () => NOW, paintedSigungu: () => new Set(), areaName: () => '성북구', reduceMotion: () => true };
}
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

test('EA1 통: 목업 01 숫자 (12개 · 나 7 · 단짝 5 · 14일 전) · 깨기 버튼 켜짐 · 처음엔 1개 · 모두', async () => {
  const c = RT.appEat.create(host(store([...jarCookies(), ...eatenCookies()], null)));
  c.tick(); await tick(); c.open();
  const html = c.screenHtml();
  assert.match(html, /aria-label="쿠키 통, 쿠키 12개"/); assert.match(html, /나 7/); assert.match(html, /단짝 5/); assert.match(html, /가장 오래된 쿠키 14일 전/);
  assert.match(html, /쿠키 1개 깨기<\/button>/); assert.doesNotMatch(html, /data-act="ek-crack" disabled/);
  assert.equal((html.match(/class="ck kk kk-sticker/g) || []).length, 12);
});

test('EA2 넣어 둔 쿠키 목록: 단짝 쿠키(통 안)는 「단짝의 쿠키 · 깨기 전엔 비밀이에요」, HTML 어디에도 음식 · 메모가 없음', async () => {
  const c = RT.appEat.create(host(store(jarCookies(), null)));
  c.tick(); await tick(); c.open();
  c.act('ek-list', { getAttribute: () => null });
  const html = c.screenHtml();
  for (const ck of jarCookies().filter((x) => x.by === HER)) {
    assert.ok(!html.includes(ck.food), ck.food + ' 가 보이면 안 됨');
    if (ck.memo) assert.ok(!html.includes(ck.memo));
  }
  assert.equal((html.match(/단짝의 쿠키/g) || []).length, 5);
  assert.match(html, /쌀국수/); assert.match(html, /하노이 골목/);
});

test('EA3 입구: 쿠키 12개 · 단짝 +n(연 뒤에 넣은 단짝 쿠키) · 음식 이름은 오늘 먹을 것만', async () => {
  const seen = Date.UTC(2026, 10, 18, 0, 0) - 9 * 3600000; // 11/18 서울 0시
  const c = RT.appEat.create(host(store(jarCookies(), null), { eatSeenAt: seen }));
  c.tick(); await tick();
  const m = c.entryModel();
  assert.deepEqual([m.total, m.newCount, m.todayFood], [12, 2, null]);
  const html = RT.viewEat.entry(m);
  assert.match(html, /배고픈데 못 정하겠으면 깨 보세요/); assert.match(html, /쿠키 12개/); assert.match(html, /단짝 \+2/);
  for (const ck of jarCookies().filter((x) => x.by === HER)) assert.ok(!html.includes(ck.food));
});

test('EA4 오늘 먹을 것: 카드 08 · 깨기 꺼짐 + 안내 · 입구 「오늘은 김치찌개!」', async () => {
  const cookies = jarCookies().map((c) => (c.id === 'c-kimchi' ? { ...c, state: 'today', pick: { by: ME, at: NOW, drawId: null } } : c));
  const today = { eatId: 'c-kimchi', by: ME, at: NOW };
  const c = RT.appEat.create(host(store(cookies, today)));
  c.tick(); await tick(); c.open();
  const html = c.screenHtml();
  assert.match(html, /오늘은 이거!/); assert.match(html, /ek-today__food">김치찌개/); assert.match(html, /단짝이 11월 15일에 적은 쿠키 · 가게는 안 정했어요/);
  assert.match(html, /data-act="ek-crack" disabled>쿠키 깨기/); assert.match(html, /오늘 먹을 걸 정했어요/);
  assert.match(RT.viewEat.entry(c.entryModel()), /오늘은 김치찌개!/);
});

test('EA5 3일째(서울 날짜) 앱을 열면 자동으로 돌려놓기, 이틀째는 그대로', async () => {
  const day = 86400000;
  for (const [ago, want] of [[2 * day, false], [3 * day, true]]) {
    const cookies = jarCookies().map((c) => (c.id === 'c-kimchi' ? { ...c, state: 'today' } : c));
    const st = store(cookies, { eatId: 'c-kimchi', by: ME, at: NOW - ago });
    const c = RT.appEat.create(host(st)); c.tick(); await tick(); await tick();
    assert.equal(st.calls.some((x) => x[0] === 'return'), want, ago / day + '일');
  }
});

test('EA6 빈 통 (11): 세 줄 안내 + 첫 쿠키 넣기', async () => {
  const c = RT.appEat.create(host(store([], null)));
  c.tick(); await tick(); c.open();
  const html = c.screenHtml();
  assert.match(html, /아직 비어 있어요/); assert.match(html, /첫 쿠키 넣기/); assert.equal((html.match(/class="ek-step"/g) || []).length, 3);
});

test('EA7 규칙: eats · eatState · eatDraws · eatPings 가 저장소 isMember() 로, 식 안 주석 없음', () => {
  const r = read('firestore.rules');
  for (const m of ['match /eats/{id}', 'match /eatState/{doc}', 'match /eatDraws/{id}', 'match /eatPings/{id}']) assert.ok(r.includes(m), m);
  assert.ok(!r.includes('eatMember()'));
});

test('EA8 색: eat.css 에 색 값 없음 · --ck-* 는 tokens.css 에 (밝게 · 어둡게) · 그림 SVG 에 색 없음', () => {
  const css = read('styles/eat.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css)); assert.ok(!/rgba?\(/.test(css));
  const tok = read('styles/tokens.css');
  for (const k of ['--ck-hi', '--ck:', '--ck-mid', '--ck-dk', '--ck-ol', '--ck-paper']) assert.ok(tok.includes(k), k);
  assert.match(tok, /\[data-theme="cosmic-dream"\][^{]*\{\s*--ck-hi: #F7DCA6/);
  assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(/i.test(read('js/eat-cookie-svg.js')));
});
