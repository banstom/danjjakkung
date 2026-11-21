/* 결산 카드 8 「교환 쪽지」 — 계산 (docs/recap/changes/2026-11-21-card8-교환쪽지.md, 참조 changes/card8/src/note-card.js 그대로 옮김)
   서버 함수 monthlyRecap 안에서 부르는 순수 함수. Firestore를 직접 읽지 않아요.
   날짜는 모두 'YYYY-MM-DD' 문자열(서울 날짜 = qdays 문서 id). 시각 계산을 하지 않아서 시간대가 끼어들 틈이 없어요. */
'use strict';

const MAX_LIKED = 2;      // 카드에 보여 줄 마음에 남은 쪽지 수 (한 사람에 하나씩)
const MAX_NOTE_LEN = 300; // 쪽지 글 최대 길이 (교환 쪽지 spec과 같음)

/** 기간 안의 날짜인지. period = { kind: 'month', key: '2026-11' } | { kind: 'year', key: '2026' } */
function inPeriod(date, period) {
  return typeof date === 'string' && date.startsWith(period.key + '-');
}

/** 둘 다 쪽지를 남긴 날인지. done = { uid: ts } */
function bothDone(day, members) {
  const done = day && day.done ? day.done : {};
  return members.length === 2 && members.every((m) => Boolean(done[m.uid]));
}

function nextDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

/** 가장 긴 연속(달력 날짜로 이어진 날) */
function longestStreak(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev !== null && nextDate(prev) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

/**
 * 마음에 남은 쪽지 고르기.
 * likes[L] = true 는 L이 그날 상대(작성자 A)의 쪽지를 마음에 담았다는 뜻.
 * - 둘 다 남긴 날의 좋아요만 (교환 쪽지 규칙: 둘 다 남긴 날에만 누를 수 있음 — 데이터가 어긋나도 여기서 한 번 더 거름)
 * - 작성자 쪽지 글이 비어 있으면 그 날은 건너뛰고 그 사람의 다음으로 최근 날
 * - 한 사람(누른 사람)에 가장 최근 하나, 최대 MAX_LIKED, 최근 날짜 순
 */
function pickLiked(days, answers, members) {
  const out = [];
  let count = 0;
  const latest = new Map(); // likedBy -> item
  const sorted = [...days].sort((a, b) => (a.date < b.date ? 1 : -1)); // 최근부터
  for (const day of sorted) {
    if (!bothDone(day, members)) continue;
    const likes = day.likes || {};
    for (const liker of members) {
      if (!likes[liker.uid]) continue;
      const author = members.find((m) => m.uid !== liker.uid);
      const text = answers?.[day.date]?.[author.uid]?.text;
      if (typeof text !== 'string' || text.trim() === '') continue;
      count += 1;
      if (!latest.has(liker.uid)) {
        latest.set(liker.uid, {
          date: day.date,
          q: day.text ?? '',
          text: text.trim().slice(0, MAX_NOTE_LEN),
          author: author.uid,
          likedBy: liker.uid,
        });
      }
    }
  }
  for (const item of latest.values()) out.push(item);
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.likedBy < b.likedBy ? -1 : 1));
  return { likedCount: count, liked: out.slice(0, MAX_LIKED) };
}

/**
 * 카드 8 데이터. 보여 줄 게 없으면 null (카드 건너뜀).
 * @param {object} p
 * @param {{kind:'month'|'year', key:string}} p.period
 * @param {{uid:string}[]} p.members  두 사람
 * @param {{date:string, text?:string, done?:object, likes?:object}[]} p.days  qdays 문서들 (기간 밖 것이 섞여 있어도 됨)
 * @param {Record<string, Record<string, {text:string}>>} p.answers  answers[date][uid] = qdays/{date}/a/{uid}
 * @param {{date:string, done?:object}[] | null} [p.prevDays]  지난달 qdays (월말만). 없거나 빈 배열이면 비교 없음
 */
function computeNoteCard({ period, members, days, answers = {}, prevDays = null }) {
  if (!Array.isArray(members) || members.length !== 2) throw new Error('members must be two people');
  const own = (days || []).filter((d) => inPeriod(d.date, period));
  const bothDates = own.filter((d) => bothDone(d, members)).map((d) => d.date);
  const bothDays = new Set(bothDates).size;
  const { likedCount, liked } = pickLiked(own, answers, members);

  if (bothDays === 0 && likedCount === 0) return null;

  const card = {
    bothDays,
    streak: longestStreak(bothDates),
    likedCount,
    liked,
  };

  if (period.kind === 'month') {
    const prevOwn = (prevDays || []).filter((d) => typeof d.date === 'string');
    card.prevDiff = prevOwn.length === 0 ? null : bothDays - new Set(prevOwn.filter((d) => bothDone(d, members)).map((d) => d.date)).size;
  } else {
    // 연말: 가장 많이 주고받은 달 (같으면 앞선 달)
    const byMonth = new Map();
    for (const d of new Set(bothDates)) {
      const m = Number(d.slice(5, 7));
      byMonth.set(m, (byMonth.get(m) || 0) + 1);
    }
    let bestMonth = null;
    for (const [m, n] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
      if (bestMonth === null || n > bestMonth.days) bestMonth = { month: m, days: n };
    }
    card.bestMonth = bestMonth;
  }
  return card;
}

/** 마무리(카드 10) 타일 — 쪽지 글은 절대 넣지 않음 (이미지로 저장 · 공유되므로) */
function noteTile(card) {
  if (!card || card.bothDays === 0) return null;
  return { value: card.bothDays, unit: '일' };
}

module.exports = { MAX_LIKED, MAX_NOTE_LEN, inPeriod, bothDone, longestStreak, pickLiked, computeNoteCard, noteTile };
