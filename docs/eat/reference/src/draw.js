// 쿠키 깨기: 통 안(state 'jar')에서 n개를 균등하게 무작위로.
// 「다시 뽑기」는 이번에 이미 본 쿠키(exclude)를 빼고 뽑고, 모자라면 본 것도 섞어서 채운다.
export const MIN_N = 1;
export const MAX_N = 3;

export function clampN(n) {
  const k = Math.floor(Number(n));
  if (!Number.isFinite(k)) return MIN_N;
  return Math.min(MAX_N, Math.max(MIN_N, k));
}

/** who: 'all' | 'me' | 'partner' */
export function candidates(cookies, uid, who = 'all') {
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
export function draw({ cookies, uid, n, who = 'all', exclude = [], rng = Math.random }) {
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
export function canDraw(cookies, uid, who, todayState) {
  return !todayState && candidates(cookies, uid, who).length > 0;
}
