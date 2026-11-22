// 출출 쿠키 E5 · 음식점 찾기 서버 조각 (functions/search-place.js)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const SP = require('./search-place');

const doc = (id, name, cat, addr, url) => ({ id: String(id), place_name: name, category_name: cat, address_name: addr, road_address_name: '', place_url: url || 'http://place.map.kakao.com/' + id });

test('SP1 입력 검사 · 정리', () => {
  assert.strictEqual(SP.badInput(null), '검색어가 없어요');
  assert.strictEqual(SP.badInput({ q: '   ' }), '검색어가 없어요');
  assert.strictEqual(SP.badInput({ q: '가'.repeat(41) }), '검색어는 40자까지예요');
  assert.strictEqual(SP.badInput({ q: ' 솔뫼  칼국수 ' }), null);
  assert.strictEqual(SP.cleanQuery(' 솔뫼  칼국수 '), '솔뫼 칼국수');
});

test('SP2 후보 모양: 분류 끝 · 지역 둘 · https 주소 · 이상한 문서는 버림', () => {
  assert.deepStrictEqual(SP.shapeDoc(doc(123, '솔뫼 마을', '음식점 > 한식 > 칼국수', '서울 성북구 성북동 1-2')),
    { kakaoId: '123', url: 'https://place.map.kakao.com/123', name: '솔뫼 마을', kind: '칼국수', area: '서울 성북구' });
  assert.strictEqual(SP.shapeDoc(doc('abc', 'x', '', '')), null);
  assert.strictEqual(SP.shapeDoc(doc(1, 'x', '', '', 'https://evil.example/1')), null);
  assert.strictEqual(SP.shapeDoc(doc(1, 'x', '', '', 'http://place.map.kakao.com/2')), null, 'id와 주소가 다르면 버림');
  assert.strictEqual(SP.shapeDoc(doc(1, '  ', '', '')), null);
  assert.ok(!('sigungu' in SP.shapeDoc(doc(5, 'a', '', '서울 성북구'))), '시·군·구 코드는 내지 않음 (데브톡 답 전)');
  assert.strictEqual(SP.SIGUNGU_ON, false);
});

test('SP3 음식점 · 카페 번갈아 합치기, 같은 장소 한 번, 최대 개수', () => {
  const fd = [doc(1, 'a', '', ''), doc(2, 'b', '', ''), doc(3, 'c', '', '')];
  const ce = [doc(9, 'z', '', ''), doc(2, 'b', '', '')];
  assert.deepStrictEqual(SP.mergeResults([fd, ce], 15).map((x) => x.kakaoId), ['1', '9', '2', '3']);
  assert.strictEqual(SP.mergeResults([fd, ce], 2).length, 2);
});

test('SP4 카카오 묻기: 분류 둘 · KakaoAK 키 · 실패면 던짐', async () => {
  const calls = [];
  const fake = async (url, opt) => {
    calls.push({ url, auth: opt.headers.Authorization });
    const cat = new URL(url).searchParams.get('category_group_code');
    return { ok: true, json: async () => ({ documents: cat === 'FD6' ? [doc(1, '칼국수집', '음식점 > 한식', '서울 성북구')] : [doc(2, '카페', '음식점 > 카페', '경기 고양시 일산동구')] }) };
  };
  const out = await SP.searchKakao('K', '솔뫼', fake);
  assert.deepStrictEqual(calls.map((c) => new URL(c.url).searchParams.get('category_group_code')).sort(), ['CE7', 'FD6']);
  assert.ok(calls.every((c) => c.auth === 'KakaoAK K' && new URL(c.url).searchParams.get('query') === '솔뫼'));
  assert.deepStrictEqual(out.map((x) => [x.kakaoId, x.area]), [['1', '서울 성북구'], ['2', '경기 고양시']]);
  await assert.rejects(SP.searchKakao('K', 'x', async () => ({ ok: false, status: 401 })), /kakao 401/);
});

test('SP5 하루 횟수 키는 서울 날짜', () => {
  assert.strictEqual(SP.useKey('u1', new Date('2026-11-22T15:30:00Z')), 'u1_2026-11-23');
  assert.strictEqual(SP.useKey('u1', new Date('2026-11-22T14:59:00Z')), 'u1_2026-11-22');
  assert.strictEqual(SP.LIMITS.perDay, 100);
});
