// 쿠키 넣기 · 고치기 · 빼기. 입력 검사와 저장할 문서 모양.
export const FOOD_MAX = 20;
export const MEMO_MAX = 100;
export const PLACE_NAME_MAX = 40;
const KAKAO_URL = /^https:\/\/place\.map\.kakao\.com\/\d+$/;
const KAKAO_ID = /^\d{1,20}$/;
const SIGUNGU = /^\d{5}$/;

/** 글자 수는 화면에 보이는 글자(코드 포인트) 기준 */
export function len(s) {
  return [...String(s ?? '')].length;
}

function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 입력 검사. place는 없음(null) · 이름만 { name } · 카카오 장소 { name, kakaoId, url, sigungu? }.
 * 카카오 장소의 name은 사용자가 확인한 이름(검색 결과를 그대로 저장하지 않음 — spec 6절).
 * @returns {{ ok: true, value } | { ok: false, errors: string[] }}
 */
export function normalizeInput(input) {
  const errors = [];
  const food = clean(input.food);
  const memo = clean(input.memo);
  if (len(food) < 1) errors.push('food-empty');
  if (len(food) > FOOD_MAX) errors.push('food-long');
  if (len(memo) > MEMO_MAX) errors.push('memo-long');

  let place = null;
  if (input.place) {
    const name = clean(input.place.name);
    if (len(name) < 1) errors.push('place-empty');
    if (len(name) > PLACE_NAME_MAX) errors.push('place-long');
    place = { name };
    const { kakaoId, url, sigungu } = input.place;
    if (kakaoId !== undefined || url !== undefined) {
      if (!KAKAO_ID.test(String(kakaoId ?? ''))) errors.push('place-id');
      if (!KAKAO_URL.test(String(url ?? ''))) errors.push('place-url');
      if (sigungu !== undefined && sigungu !== null && !SIGUNGU.test(String(sigungu))) errors.push('place-sigungu');
      place = { name, kakaoId: String(kakaoId), url: String(url) };
      if (sigungu) place.sigungu = String(sigungu);
    }
  }
  if (errors.length) return { ok: false, errors };
  const value = { food, place };
  if (memo) value.memo = memo;
  return { ok: true, value };
}

/** 새 쿠키 문서 (eats/{id}) */
export function newCookie(input, uid, nowMs, from = null) {
  const r = normalizeInput(input);
  if (!r.ok) return r;
  const doc = { ...r.value, by: uid, at: nowMs, state: 'jar' };
  if (!doc.place) delete doc.place;
  if (from) doc.from = from;
  return { ok: true, value: doc };
}

/** 고치기: 적은 사람만, 통 안에 있을 때만. 작성 시각(at)은 그대로, editedAt만 */
export function editCookie(cookie, input, uid, nowMs) {
  if (cookie.by !== uid) return { ok: false, errors: ['not-author'] };
  if (cookie.state !== 'jar') return { ok: false, errors: ['not-in-jar'] };
  const r = normalizeInput(input);
  if (!r.ok) return r;
  const patch = { food: r.value.food, place: r.value.place ?? null, memo: r.value.memo ?? null, editedAt: nowMs };
  return { ok: true, value: patch };
}

/** 빼기: 지우지 않고 state 'out' (기록 · 결산이 깨지지 않게) */
export function removeCookie(cookie, uid) {
  if (cookie.by !== uid) return { ok: false, errors: ['not-author'] };
  if (cookie.state !== 'jar') return { ok: false, errors: ['not-in-jar'] };
  return { ok: true, value: { state: 'out' } };
}
