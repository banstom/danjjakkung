import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput, newCookie, editCookie, removeCookie, len, FOOD_MAX, MEMO_MAX } from '../src/cookie.js';
import { ME, HER, NOW, seoul } from './fixtures.js';

const kakao = { name: '솔뫼 마을', kakaoId: '27531028', url: 'https://place.map.kakao.com/27531028', sigungu: '11290' };

test('C1 사용자 예시 그대로 넣기 (칼국수 · 솔뫼 마을 · 메모)', () => {
  const r = newCookie({ food: '칼국수', place: kakao, memo: '뭔가 오늘따라 시원한 칼국수가 먹고싶네' }, ME, seoul(2026, 11, 21, 9, 21));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, {
    food: '칼국수', place: kakao, memo: '뭔가 오늘따라 시원한 칼국수가 먹고싶네',
    by: ME, at: seoul(2026, 11, 21, 9, 21), state: 'jar',
  });
});

test('C2 앞뒤 공백 · 겹친 공백 정리, 빈 메모는 안 저장, 가게 없으면 place 키도 없음', () => {
  const r = newCookie({ food: '  김치   찌개 ', memo: '   ' }, ME, NOW);
  assert.equal(r.value.food, '김치 찌개');
  assert.ok(!('memo' in r.value));
  assert.ok(!('place' in r.value));
});

test('C3 음식은 1~20자 (글자 수는 이모지도 한 글자)', () => {
  assert.deepEqual(normalizeInput({ food: '   ' }).errors, ['food-empty']);
  assert.equal(normalizeInput({ food: '가'.repeat(FOOD_MAX) }).ok, true);
  assert.deepEqual(normalizeInput({ food: '가'.repeat(FOOD_MAX + 1) }).errors, ['food-long']);
  assert.equal(len('🍜라멘'), 3);
});

test('C4 메모 100자까지', () => {
  assert.equal(normalizeInput({ food: '라멘', memo: '가'.repeat(MEMO_MAX) }).ok, true);
  assert.deepEqual(normalizeInput({ food: '라멘', memo: '가'.repeat(MEMO_MAX + 1) }).errors, ['memo-long']);
});

test('C5 가게: 이름만 · 카카오 장소, 잘못된 주소 · id · 시군구 코드는 막음', () => {
  assert.deepEqual(normalizeInput({ food: '칼국수', place: { name: '솔뫼' } }).value.place, { name: '솔뫼' });
  assert.deepEqual(normalizeInput({ food: '칼국수', place: kakao }).value.place, kakao);
  assert.ok(normalizeInput({ food: '칼국수', place: { ...kakao, url: 'http://place.map.kakao.com/27531028' } }).errors.includes('place-url'));
  assert.ok(normalizeInput({ food: '칼국수', place: { ...kakao, url: 'https://evil.example/27531028' } }).errors.includes('place-url'));
  assert.ok(normalizeInput({ food: '칼국수', place: { ...kakao, kakaoId: 'abc' } }).errors.includes('place-id'));
  assert.ok(normalizeInput({ food: '칼국수', place: { ...kakao, sigungu: '1129' } }).errors.includes('place-sigungu'));
  assert.ok(normalizeInput({ food: '칼국수', place: { name: ' ' } }).errors.includes('place-empty'));
});

test('C6 고치기: 적은 사람만, 통 안에 있을 때만, 작성 시각은 그대로', () => {
  const c = { id: 'x', by: ME, food: '칼국수', at: seoul(2026, 11, 21, 9, 21), state: 'jar' };
  assert.deepEqual(editCookie(c, { food: '바지락 칼국수' }, HER, NOW).errors, ['not-author']);
  assert.deepEqual(editCookie({ ...c, state: 'today' }, { food: '바지락 칼국수' }, ME, NOW).errors, ['not-in-jar']);
  const r = editCookie(c, { food: '바지락 칼국수' }, ME, NOW);
  assert.equal(r.value.food, '바지락 칼국수');
  assert.equal(r.value.editedAt, NOW);
  assert.ok(!('at' in r.value));
});

test('C7 빼기는 지우지 않고 state out, 적은 사람만', () => {
  const c = { id: 'x', by: ME, food: '칼국수', at: NOW, state: 'jar' };
  assert.deepEqual(removeCookie(c, ME).value, { state: 'out' });
  assert.equal(removeCookie(c, HER).ok, false);
});
