// 통 화면 · 목록 · 입구 칸에 보이는 숫자와 비밀 처리.
import { dayDiff } from './time.js';
import { ago, listDate } from './format.js';
import { avgStars } from './today.js';

/** 단짝 쿠키는 통 안에 있는 동안 내용이 안 보인다 (한 번 깼다가 돌아온 것도 다시 비밀) */
export function isSecret(cookie, viewer) {
  return cookie.by !== viewer && cookie.state === 'jar';
}

/** 통 줄: 「나 7 · 단짝 5 · 가장 오래된 쿠키 14일 전」 */
export function jarSummary(cookies, uid, nowMs) {
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
export function newPartnerCount(cookies, uid, seenAtMs) {
  return cookies.filter((c) => c.state === 'jar' && c.by !== uid && c.at > (seenAtMs ?? 0)).length;
}

/**
 * 넣어 둔 쿠키 목록. tab 'jar' = 통 안(최근 순), 'eaten' = 먹은 것(먹은 순).
 * 비밀인 줄은 food · place · memo를 아예 넘기지 않는다(화면이 실수로 그리지 않게).
 */
export function listRows(cookies, viewer, tab, nowMs) {
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

export function tabCounts(cookies) {
  return {
    jar: cookies.filter((c) => c.state === 'jar').length,
    eaten: cookies.filter((c) => c.state === 'eaten').length,
  };
}
