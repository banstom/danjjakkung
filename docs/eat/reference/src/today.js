// 오늘 먹을 것: 고르기 · 돌려놓기 · 먹었어요 · 별점 · 자동 돌려놓기.
// 오늘 먹을 것은 둘이 같이 하나만 (eatState/today). 저장은 트랜잭션 하나로 — 여기서는 바꿀 내용만 계산한다.
import { dayDiff } from './time.js';
import { newCookie } from './cookie.js';

export const AUTO_RETURN_DAYS = 3;
export const NOTE_MAX = 40;

/**
 * 고르기. todayState = eatState/today 문서(없으면 null).
 * 이미 다른 쿠키가 골라져 있으면 'taken' → 화면은 「단짝이 방금 골랐어요」
 */
export function pick({ cookie, todayState, uid, drawId = null, nowMs }) {
  if (todayState) return { ok: false, error: todayState.eatId === cookie.id ? 'same' : 'taken' };
  if (cookie.state !== 'jar') return { ok: false, error: 'not-in-jar' };
  return {
    ok: true,
    cookiePatch: { state: 'today', pick: { by: uid, at: nowMs, drawId } },
    state: { eatId: cookie.id, by: uid, at: nowMs },
  };
}

/** 통에 돌려놓기 (직접 · 자동 모두). pick 기록은 지운다 */
export function returnToJar({ cookie, todayState }) {
  if (!todayState || todayState.eatId !== cookie.id || cookie.state !== 'today') return { ok: false, error: 'not-today' };
  return { ok: true, cookiePatch: { state: 'jar', pick: null }, state: null };
}

/** 앱을 열 때: 고른 날부터 3일(서울 날짜)이 지났으면 자동으로 돌려놓기 */
export function autoReturnDue(todayState, nowMs) {
  return !!todayState && dayDiff(todayState.at, nowMs) >= AUTO_RETURN_DAYS;
}

/** 카드 머리 글: 0일 'today' · 1일 'yesterday' · 2일 'dayBefore' */
export function todayKick(todayState, nowMs) {
  const d = dayDiff(todayState.at, nowMs);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : 'dayBefore';
}

function checkStars(stars) {
  return Number.isInteger(stars) && stars >= 1 && stars <= 5;
}

/**
 * 먹었어요. 처음 누른 사람이 state를 'eaten'으로 바꾸고 eatState/today를 비운다.
 * again = 또 먹고 싶어요 → 같은 내용의 새 쿠키(누른 사람이 적은 것으로, from 연결, 작성 시각 = 지금)
 */
export function eat({ cookie, todayState, uid, stars, note = '', together = true, again = false, nowMs }) {
  if (!todayState || todayState.eatId !== cookie.id || cookie.state !== 'today') return { ok: false, error: 'not-today' };
  if (!checkStars(stars)) return { ok: false, error: 'stars' };
  const line = String(note).trim();
  if ([...line].length > NOTE_MAX) return { ok: false, error: 'note-long' };
  const cookiePatch = {
    state: 'eaten',
    eaten: { at: nowMs, by: uid, together: !!together },
    [`stars.${uid}`]: stars,
  };
  if (line) cookiePatch[`notes.${uid}`] = line;
  let againDoc = null;
  if (again) {
    const r = newCookie({ food: cookie.food, place: cookie.place ?? null, memo: cookie.memo ?? '' }, uid, nowMs, cookie.id);
    if (!r.ok) return { ok: false, error: 'again' };
    againDoc = r.value;
  }
  return { ok: true, cookiePatch, state: null, againDoc };
}

/** 먹은 뒤 다른 사람이 별점 남기기 (자기 칸만) */
export function rate({ cookie, uid, stars, note = '' }) {
  if (cookie.state !== 'eaten') return { ok: false, error: 'not-eaten' };
  if (!checkStars(stars)) return { ok: false, error: 'stars' };
  const line = String(note).trim();
  if ([...line].length > NOTE_MAX) return { ok: false, error: 'note-long' };
  const cookiePatch = { [`stars.${uid}`]: stars };
  if (line) cookiePatch[`notes.${uid}`] = line;
  return { ok: true, cookiePatch };
}

/** 별점 평균 (소수 첫째 자리, 매긴 사람만) — 목록의 「지난번 별점 ★4.5」 */
export function avgStars(cookie) {
  const v = Object.values(cookie.stars ?? {}).filter(checkStars);
  if (!v.length) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}
