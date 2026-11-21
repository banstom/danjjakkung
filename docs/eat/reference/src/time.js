// 하루 기준은 서울 자정. 기기 시간대와 상관없이 같은 답이 나와야 한다.
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ms → 서울 기준 { y, m, d, hh, mm } */
export function seoulParts(ms) {
  const t = new Date(ms + SEOUL_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes() };
}

/** 서울 날짜 문자열 'YYYY-MM-DD' */
export function seoulDate(ms) {
  const { y, m, d } = seoulParts(ms);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 서울 날짜 기준으로 later가 earlier보다 며칠 뒤인지 (같은 날 0) */
export function dayDiff(earlierMs, laterMs) {
  const a = Math.floor((earlierMs + SEOUL_OFFSET_MS) / DAY_MS);
  const b = Math.floor((laterMs + SEOUL_OFFSET_MS) / DAY_MS);
  return b - a;
}
