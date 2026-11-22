/* eat(쿠키) 기능 (코드 이름 eat) — 계산 (docs/eat/spec.md, 참조 구현 reference/src 를 한 파일로 옮김 · 동작 그대로)
   하루 기준은 서울 자정(기기 시간대와 상관없음). 시각은 ms 숫자 — 저장 계층(js/store.js)이 서버 시각 ↔ ms 를 바꿔 넘긴다.
   화면 글은 js/eat-text.js (이름은 NAME 한 곳), 쿠키 그림은 js/eat-cookie-svg.js. */
(function (root) {
  'use strict';

  // ── time.js ──
  // 하루 기준은 서울 자정. 기기 시간대와 상관없이 같은 답이 나와야 한다.
  const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  /** ms → 서울 기준 { y, m, d, hh, mm } */
  function seoulParts(ms) {
    const t = new Date(ms + SEOUL_OFFSET_MS);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes() };
  }

  /** 서울 날짜 문자열 'YYYY-MM-DD' */
  function seoulDate(ms) {
    const { y, m, d } = seoulParts(ms);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  /** 서울 날짜 기준으로 later가 earlier보다 며칠 뒤인지 (같은 날 0) */
  function dayDiff(earlierMs, laterMs) {
    const a = Math.floor((earlierMs + SEOUL_OFFSET_MS) / DAY_MS);
    const b = Math.floor((laterMs + SEOUL_OFFSET_MS) / DAY_MS);
    return b - a;
  }

  // ── format.js ──
  function ampm(hh, mm) {
    const pm = hh >= 12;
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${pm ? '오후' : '오전'} ${h12}:${String(mm).padStart(2, '0')}`;
  }

  /** 쪽지 아래 · 쿠키 넣기 화면: 「2026년 11월 21일 오전 9:21」 (뒤에 「 작성」은 text.js가 붙임) */
  function writtenAt(ms) {
    const { y, m, d, hh, mm } = seoulParts(ms);
    return `${y}년 ${m}월 ${d}일 ${ampm(hh, mm)}`;
  }

  /** 「11월 15일」 */
  function monthDay(ms) {
    const { m, d } = seoulParts(ms);
    return `${m}월 ${d}일`;
  }

  /** 쪽지 머리 · 통 줄: 「오늘」 「어제」 「12일 전」 */
  function ago(ms, nowMs) {
    const n = dayDiff(ms, nowMs);
    if (n <= 0) return '오늘';
    if (n === 1) return '어제';
    return `${n}일 전`;
  }

  /** 넣어 둔 쿠키 목록: 「오늘」 「어제」 「11월 19일」 */
  function listDate(ms, nowMs) {
    const n = dayDiff(ms, nowMs);
    if (n <= 0) return '오늘';
    if (n === 1) return '어제';
    return monthDay(ms);
  }

  // ── josa.js ──
  // 조사 붙이기. 마지막 글자의 받침으로 고른다. 한글이 아니면(숫자 · 영문) 받침 없는 쪽.
  // pair: '을/를' · '이/가' · '은/는' · '과/와' · '으로/로'
  const HANGUL_START = 0xac00;
  const HANGUL_END = 0xd7a3;

  function lastHangul(word) {
    const s = String(word).trim();
    for (let i = s.length - 1; i >= 0; i--) {
      const c = s.charCodeAt(i);
      if (c >= HANGUL_START && c <= HANGUL_END) return c;
      if (/[0-9A-Za-z]/.test(s[i])) return null;
    }
    return null;
  }

  /** 받침 번호 (0 = 없음, 8 = ㄹ) */
  function jong(word) {
    const c = lastHangul(word);
    return c === null ? 0 : (c - HANGUL_START) % 28;
  }

  function josa(word, pair) {
    const [withJong, withoutJong] = pair.split('/');
    const j = jong(word);
    if (pair === '으로/로') return j === 0 || j === 8 ? '로' : '으로';
    return j === 0 ? withoutJong : withJong;
  }

  /** 단어 + 조사 */
  function withJosa(word, pair) {
    return `${word}${josa(word, pair)}`;
  }

  // ── cookie.js ──
  // 쿠키 넣기 · 고치기 · 빼기. 입력 검사와 저장할 문서 모양.
  const FOOD_MAX = 20;
  const MEMO_MAX = 100;
  const PLACE_NAME_MAX = 40;
  const KAKAO_URL = /^https:\/\/place\.map\.kakao\.com\/\d+$/;
  const KAKAO_ID = /^\d{1,20}$/;
  const SIGUNGU = /^\d{5}$/;

  /** 글자 수는 화면에 보이는 글자(코드 포인트) 기준 */
  function len(s) {
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
  function normalizeInput(input) {
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
  function newCookie(input, uid, nowMs, from = null) {
    const r = normalizeInput(input);
    if (!r.ok) return r;
    const doc = { ...r.value, by: uid, at: nowMs, state: 'jar' };
    if (!doc.place) delete doc.place;
    if (from) doc.from = from;
    return { ok: true, value: doc };
  }

  /** 고치기: 적은 사람만, 통 안에 있을 때만. 작성 시각(at)은 그대로, editedAt만 */
  function editCookie(cookie, input, uid, nowMs) {
    if (cookie.by !== uid) return { ok: false, errors: ['not-author'] };
    if (cookie.state !== 'jar') return { ok: false, errors: ['not-in-jar'] };
    const r = normalizeInput(input);
    if (!r.ok) return r;
    const patch = { food: r.value.food, place: r.value.place ?? null, memo: r.value.memo ?? null, editedAt: nowMs };
    return { ok: true, value: patch };
  }

  /** 빼기: 지우지 않고 state 'out' (기록 · 결산이 깨지지 않게) */
  function removeCookie(cookie, uid) {
    if (cookie.by !== uid) return { ok: false, errors: ['not-author'] };
    if (cookie.state !== 'jar') return { ok: false, errors: ['not-in-jar'] };
    return { ok: true, value: { state: 'out' } };
  }

  // ── draw.js ──
  // 쿠키 깨기: 통 안(state 'jar')에서 n개를 균등하게 무작위로.
  // 「다시 뽑기」는 이번에 이미 본 쿠키(exclude)를 빼고 뽑고, 모자라면 본 것도 섞어서 채운다.
  const MIN_N = 1;
  const MAX_N = 3;

  function clampN(n) {
    const k = Math.floor(Number(n));
    if (!Number.isFinite(k)) return MIN_N;
    return Math.min(MAX_N, Math.max(MIN_N, k));
  }

  /** who: 'all' | 'me' | 'partner' */
  function candidates(cookies, uid, who = 'all') {
    return cookies.filter((c) => c.state === 'jar' && (who === 'all' || (who === 'me' ? c.by === uid : c.by !== uid)));
  }

  function pickRandom(list, k, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  /**
   * @param {object} o
   * @param {Array<{id,state,by}>} o.cookies
   * @param {string} o.uid
   * @param {number} o.n          1~3 (밖이면 맞춤)
   * @param {'all'|'me'|'partner'} [o.who]
   * @param {string[]} [o.exclude] 이번 뽑기에서 이미 본 쿠키 id
   * @param {() => number} [o.rng]
   * @returns {string[]} 뽑은 id (보여 줄 순서)
   */
  function draw({ cookies, uid, n, who = 'all', exclude = [], rng = Math.random }) {
    const k = clampN(n);
    const pool = candidates(cookies, uid, who);
    const seen = new Set(exclude);
    const fresh = pool.filter((c) => !seen.has(c.id));
    const first = pickRandom(fresh, k, rng);
    if (first.length >= k) return first.map((c) => c.id);
    const rest = pickRandom(pool.filter((c) => seen.has(c.id)), k - first.length, rng);
    return [...first, ...rest].map((c) => c.id);
  }

  /** 깨기 버튼을 켤지: 고른 범위에 쿠키가 하나라도 있고, 오늘 먹을 것이 없을 때 */
  function canDraw(cookies, uid, who, todayState) {
    return !todayState && candidates(cookies, uid, who).length > 0;
  }

  // ── today.js ──
  // 오늘 먹을 것: 고르기 · 돌려놓기 · 먹었어요 · 별점 · 자동 돌려놓기.
  // 오늘 먹을 것은 둘이 같이 하나만 (eatState/today). 저장은 트랜잭션 하나로 — 여기서는 바꿀 내용만 계산한다.

  const AUTO_RETURN_DAYS = 3;
  const NOTE_MAX = 40;

  /**
   * 고르기. todayState = eatState/today 문서(없으면 null).
   * 이미 다른 쿠키가 골라져 있으면 'taken' → 화면은 「단짝이 방금 골랐어요」
   */
  function pick({ cookie, todayState, uid, drawId = null, nowMs }) {
    if (todayState) return { ok: false, error: todayState.eatId === cookie.id ? 'same' : 'taken' };
    if (cookie.state !== 'jar') return { ok: false, error: 'not-in-jar' };
    return {
      ok: true,
      cookiePatch: { state: 'today', pick: { by: uid, at: nowMs, drawId } },
      state: { eatId: cookie.id, by: uid, at: nowMs },
    };
  }

  /** 통에 돌려놓기 (직접 · 자동 모두). pick 기록은 지운다 */
  function returnToJar({ cookie, todayState }) {
    if (!todayState || todayState.eatId !== cookie.id || cookie.state !== 'today') return { ok: false, error: 'not-today' };
    return { ok: true, cookiePatch: { state: 'jar', pick: null }, state: null };
  }

  /** 앱을 열 때: 고른 날부터 3일(서울 날짜)이 지났으면 자동으로 돌려놓기 */
  function autoReturnDue(todayState, nowMs) {
    return !!todayState && dayDiff(todayState.at, nowMs) >= AUTO_RETURN_DAYS;
  }

  /** 카드 머리 글: 0일 'today' · 1일 'yesterday' · 2일 'dayBefore' */
  function todayKick(todayState, nowMs) {
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
  function eat({ cookie, todayState, uid, stars, note = '', together = true, again = false, nowMs }) {
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
  function rate({ cookie, uid, stars, note = '' }) {
    if (cookie.state !== 'eaten') return { ok: false, error: 'not-eaten' };
    if (!checkStars(stars)) return { ok: false, error: 'stars' };
    const line = String(note).trim();
    if ([...line].length > NOTE_MAX) return { ok: false, error: 'note-long' };
    const cookiePatch = { [`stars.${uid}`]: stars };
    if (line) cookiePatch[`notes.${uid}`] = line;
    return { ok: true, cookiePatch };
  }

  /** 별점 평균 (소수 첫째 자리, 매긴 사람만) — 목록의 「지난번 별점 ★4.5」 */
  function avgStars(cookie) {
    const v = Object.values(cookie.stars ?? {}).filter(checkStars);
    if (!v.length) return null;
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  }

  // ── jar.js ──
  // 통 화면 · 목록 · 입구 칸에 보이는 숫자와 비밀 처리.

  /** 단짝 쿠키는 통 안에 있는 동안 내용이 안 보인다 (한 번 깼다가 돌아온 것도 다시 비밀) */
  function isSecret(cookie, viewer) {
    return cookie.by !== viewer && cookie.state === 'jar';
  }

  /** 통 줄: 「나 7 · 단짝 5 · 가장 오래된 쿠키 14일 전」 */
  function jarSummary(cookies, uid, nowMs) {
    const inJar = cookies.filter((c) => c.state === 'jar');
    const mine = inJar.filter((c) => c.by === uid).length;
    const oldest = inJar.reduce((m, c) => (m === null || c.at < m ? c.at : m), null);
    return {
      total: inJar.length,
      mine,
      partner: inJar.length - mine,
      oldestAgo: oldest === null ? null : ago(oldest, nowMs),
      oldestDays: oldest === null ? null : dayDiff(oldest, nowMs),
    };
  }

  /** 입구 칸 「단짝 +2」: 내가 마지막으로 연 뒤에 단짝이 넣은, 아직 통 안의 쿠키 */
  function newPartnerCount(cookies, uid, seenAtMs) {
    return cookies.filter((c) => c.state === 'jar' && c.by !== uid && c.at > (seenAtMs ?? 0)).length;
  }

  /**
   * 넣어 둔 쿠키 목록. tab 'jar' = 통 안(최근 순), 'eaten' = 먹은 것(먹은 순).
   * 비밀인 줄은 food · place · memo를 아예 넘기지 않는다(화면이 실수로 그리지 않게).
   */
  function listRows(cookies, viewer, tab, nowMs) {
    const rows = cookies
      .filter((c) => (tab === 'jar' ? c.state === 'jar' : c.state === 'eaten'))
      .sort((a, b) => (tab === 'jar' ? b.at - a.at : (b.eaten?.at ?? 0) - (a.eaten?.at ?? 0)));
    return rows.map((c) => {
      const base = { id: c.id, mine: c.by === viewer, date: listDate(tab === 'jar' ? c.at : c.eaten.at, nowMs) };
      if (isSecret(c, viewer)) return { ...base, secret: true };
      return {
        ...base,
        secret: false,
        food: c.food,
        place: c.place?.name ?? null,
        memo: c.memo ?? null,
        again: !!c.from,
        avg: avgStars(c),
        editable: c.by === viewer && c.state === 'jar',
      };
    });
  }

  function tabCounts(cookies) {
    return {
      jar: cookies.filter((c) => c.state === 'jar').length,
      eaten: cookies.filter((c) => c.state === 'eaten').length,
    };
  }

  // ── mapAsk.js ──
  // 먹었어요 뒤 「단짝 지도에 ○○구를 칠할까요?」를 물을지.
  // 조건: 함께 먹음 + 카카오 장소로 고른 가게 + 시·군·구 코드가 있음 + 그 시·군·구가 아직 안 칠해짐.
  // 이름만 적은 가게는 묻지 않는다(어느 시·군·구인지 모름).

  /** @returns {string|null} 물어볼 시·군·구 코드 */
  function paintAsk({ cookie, together, paintedSigungu }) {
    if (!together) return null;
    const code = cookie.place?.kakaoId ? cookie.place.sigungu : null;
    if (!code) return null;
    return paintedSigungu.has(code) ? null : code;
  }

  const api = { seoulParts, seoulDate, dayDiff, writtenAt, monthDay, ago, listDate, jong, josa, withJosa, FOOD_MAX, MEMO_MAX, PLACE_NAME_MAX, len, normalizeInput, newCookie, editCookie, removeCookie, MIN_N, MAX_N, clampN, candidates, draw, canDraw, AUTO_RETURN_DAYS, NOTE_MAX, pick, returnToJar, autoReturnDue, todayKick, eat, rate, avgStars, isSecret, jarSummary, newPartnerCount, listRows, tabCounts, paintAsk };
  root.RT = root.RT || {};
  root.RT.eat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
