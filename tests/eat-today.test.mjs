// 출출 쿠키 시험 (참조 reference/test/today.test.js 그대로 — import 줄만 저장소 모듈로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import E_today from '../js/eat.js';
const { pick, returnToJar, autoReturnDue, todayKick, eat, rate, avgStars, NOTE_MAX } = E_today;
import { ME, HER, NOW, seoul, jarCookies } from './fixtures/eat/fixtures.mjs';

const kimchi = () => jarCookies().find((c) => c.id === 'c-kimchi');
const katsu = () => jarCookies().find((c) => c.id === 'c-katsu');

test('P1 고르기 → 쿠키는 today, eatState/today에 하나', () => {
  const r = pick({ cookie: kimchi(), todayState: null, uid: ME, drawId: 'd1', nowMs: NOW });
  assert.equal(r.ok, true);
  assert.deepEqual(r.cookiePatch, { state: 'today', pick: { by: ME, at: NOW, drawId: 'd1' } });
  assert.deepEqual(r.state, { eatId: 'c-kimchi', by: ME, at: NOW });
});

test('P2 단짝이 먼저 골랐으면 taken (「단짝이 방금 골랐어요」), 통 밖 쿠키는 못 고름', () => {
  assert.equal(pick({ cookie: kimchi(), todayState: { eatId: 'c-katsu', by: HER, at: NOW }, uid: ME, nowMs: NOW }).error, 'taken');
  assert.equal(pick({ cookie: { ...kimchi(), state: 'eaten' }, todayState: null, uid: ME, nowMs: NOW }).error, 'not-in-jar');
});

test('P3 돌려놓기 → jar, pick 지움, eatState 비움', () => {
  const st = { eatId: 'c-kimchi', by: ME, at: NOW };
  const r = returnToJar({ cookie: { ...kimchi(), state: 'today' }, todayState: st });
  assert.deepEqual(r.cookiePatch, { state: 'jar', pick: null });
  assert.equal(r.state, null);
  assert.equal(returnToJar({ cookie: { ...katsu(), state: 'today' }, todayState: st }).ok, false);
});

test('P4 자동 돌려놓기는 서울 날짜로 3일째부터', () => {
  assert.equal(autoReturnDue({ at: seoul(2026, 11, 18, 23, 59) }, seoul(2026, 11, 21, 0, 1)), true);
  assert.equal(autoReturnDue({ at: seoul(2026, 11, 19, 0, 0) }, seoul(2026, 11, 21, 23, 59)), false);
  assert.equal(autoReturnDue(null, NOW), false);
  assert.equal(todayKick({ at: seoul(2026, 11, 21, 12, 0) }, NOW), 'today');
  assert.equal(todayKick({ at: seoul(2026, 11, 20, 23, 0) }, NOW), 'yesterday');
  assert.equal(todayKick({ at: seoul(2026, 11, 19, 9, 0) }, NOW), 'dayBefore');
});

test('P5 먹었어요: 내 칸에만 별점 · 한 줄, eaten, eatState 비움', () => {
  const st = { eatId: 'c-kimchi', by: ME, at: NOW };
  const r = eat({ cookie: { ...kimchi(), state: 'today' }, todayState: st, uid: ME, stars: 4, note: '계란말이가 찌개보다 맛있었음', together: true, nowMs: NOW });
  assert.equal(r.ok, true);
  assert.deepEqual(r.cookiePatch, {
    state: 'eaten', eaten: { at: NOW, by: ME, together: true },
    [`stars.${ME}`]: 4, [`notes.${ME}`]: '계란말이가 찌개보다 맛있었음',
  });
  assert.equal(r.state, null);
  assert.equal(r.againDoc, null);
  assert.ok(!Object.keys(r.cookiePatch).some((k) => k.includes(HER)));
});

test('P6 별점은 1~5 정수, 한 줄 40자', () => {
  const base = { cookie: { ...kimchi(), state: 'today' }, todayState: { eatId: 'c-kimchi', by: ME, at: NOW }, uid: ME, nowMs: NOW };
  assert.equal(eat({ ...base, stars: 0 }).error, 'stars');
  assert.equal(eat({ ...base, stars: 4.5 }).error, 'stars');
  assert.equal(eat({ ...base, stars: 5, note: '가'.repeat(NOTE_MAX + 1) }).error, 'note-long');
  assert.equal(eat({ ...base, stars: 5, note: '가'.repeat(NOTE_MAX) }).ok, true);
});

test('P7 또 먹고 싶어요: 같은 내용 새 쿠키, 누른 사람 것으로, from 연결, 지금 시각', () => {
  const st = { eatId: 'c-kimchi', by: ME, at: NOW };
  const r = eat({ cookie: { ...kimchi(), state: 'today' }, todayState: st, uid: ME, stars: 5, again: true, nowMs: NOW });
  assert.deepEqual(r.againDoc, { food: '김치찌개', memo: '추운 날엔 무조건. 계란말이도 같이 시키자', by: ME, at: NOW, state: 'jar', from: 'c-kimchi' });
  const k = eat({ cookie: { ...katsu(), state: 'today' }, todayState: { eatId: 'c-katsu', by: ME, at: NOW }, uid: HER, stars: 3, again: true, nowMs: NOW });
  assert.deepEqual(k.againDoc.place, katsu().place);
  assert.equal(k.againDoc.by, HER);
});

test('P8 먹은 뒤 단짝이 별점 남기기 · 평균', () => {
  const eaten = { ...kimchi(), state: 'eaten', stars: { [ME]: 4 } };
  const r = rate({ cookie: eaten, uid: HER, stars: 5 });
  assert.deepEqual(r.cookiePatch, { [`stars.${HER}`]: 5 });
  assert.equal(rate({ cookie: kimchi(), uid: HER, stars: 5 }).error, 'not-eaten');
  assert.equal(avgStars({ stars: { [ME]: 4, [HER]: 5 } }), 4.5);
  assert.equal(avgStars({ stars: {} }), null);
  assert.equal(avgStars({}), null);
});
