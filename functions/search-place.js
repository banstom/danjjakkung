/* 출출 쿠키 E5 · 음식점 찾기 — 카카오 로컬 「키워드로 장소 검색」(음식점 FD6 · 카페 CE7).
   docs/eat/spec.md 6절. 서버만 키를 안다(Secret Manager KAKAO_REST_KEY).
   돌려주는 것은 보여 줄 후보뿐: { kakaoId, url, name, kind, area } — 앱은 장소 ID · place_url · 사용자가 확인한 이름만 저장한다.
   시·군·구 코드는 데브톡 답이 오기 전까지 내지 않는다(SIGUNGU_ON = false). */
'use strict';

const LIMITS = { perDay: 100, queryMax: 40, size: 15, show: 15 };
const SIGUNGU_ON = false;
const CATS = ['FD6', 'CE7'];
const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_URL = /^https?:\/\/place\.map\.kakao\.com\/(\d+)$/;

function cleanQuery(q) {
  return String(q == null ? '' : q).replace(/\s+/g, ' ').trim();
}
/** 잘못된 입력이면 사람에게 보일 문장, 괜찮으면 null */
function badInput(d) {
  if (!d || typeof d !== 'object') return '검색어가 없어요';
  const q = cleanQuery(d.q);
  if (!q) return '검색어가 없어요';
  if ([...q].length > LIMITS.queryMax) return '검색어는 40자까지예요';
  return null;
}
/** 「음식점 > 한식 > 칼국수」 → 「칼국수」 */
function kindOf(category) {
  const parts = String(category || '').split('>').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}
/** 「서울 성북구 성북동 1-2」 → 「서울 성북구」 (보여 주기만, 저장하지 않음) */
function areaOf(address) {
  const p = String(address || '').trim().split(/\s+/).filter(Boolean);
  return p.slice(0, 2).join(' ');
}
/** 카카오 문서 하나 → 후보 하나 (모양이 이상하면 null) */
function shapeDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const id = String(doc.id || '');
  if (!/^\d{1,20}$/.test(id)) return null;
  const m = KAKAO_URL.exec(String(doc.place_url || ''));
  if (!m || m[1] !== id) return null;
  const name = cleanQuery(doc.place_name).slice(0, 60);
  if (!name) return null;
  return { kakaoId: id, url: 'https://place.map.kakao.com/' + id, name, kind: kindOf(doc.category_name), area: areaOf(doc.road_address_name || doc.address_name) };
}
/** 두 분류의 결과를 카카오 순서를 살려 번갈아 합치고, 같은 장소는 한 번만 */
function mergeResults(lists, max) {
  const out = []; const seen = new Set();
  const qs = lists.map((l) => (Array.isArray(l) ? l.slice() : []));
  while (out.length < max && qs.some((l) => l.length)) {
    for (const l of qs) {
      if (!l.length || out.length >= max) continue;
      const s = shapeDoc(l.shift());
      if (s && !seen.has(s.kakaoId)) { seen.add(s.kakaoId); out.push(s); }
    }
  }
  return out;
}
/** 카카오에 묻기. fetchFn 은 시험에서 바꿔 끼운다 */
async function searchKakao(key, q, fetchFn) {
  const f = fetchFn || fetch;
  const one = async (cat) => {
    const url = ENDPOINT + '?' + new URLSearchParams({ query: q, category_group_code: cat, size: String(LIMITS.size) });
    const res = await f(url, { headers: { Authorization: 'KakaoAK ' + key } });
    if (!res.ok) { const e = new Error('kakao ' + res.status); e.status = res.status; throw e; }
    const j = await res.json();
    return (j && j.documents) || [];
  };
  const lists = await Promise.all(CATS.map(one));
  return mergeResults(lists, LIMITS.show);
}
/** 하루 횟수 문서 id (서울 날짜) */
function useKey(uid, now) {
  const d = new Date((now || new Date()).getTime() + 9 * 3600 * 1000);
  return uid + '_' + d.toISOString().slice(0, 10);
}

module.exports = { LIMITS, SIGUNGU_ON, CATS, cleanQuery, badInput, kindOf, areaOf, shapeDoc, mergeResults, searchKakao, useKey };
