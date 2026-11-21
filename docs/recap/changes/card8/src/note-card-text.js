// 결산 카드 8 「교환 쪽지」 — 화면 글 (참조 구현, 2026-11-21)
// 결산의 text.js에 합칠 때 글자 그대로 옮겨 주세요. 기능 이름은 교환 쪽지 text.js의 NAME을 받아요.
// 사람 이름(label)은 화면을 보는 사람 기준: 나 = 내 이름, 상대 = 「단짝」 (결산 다른 카드와 같음)

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-11-15' → '11월 15일 (일)' */
export function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${WEEK[w]})`;
}

/** 카드 2와 같은 비교 칩 규칙 */
export function diffChip(diff) {
  if (diff === null || diff === undefined) return null;
  if (diff > 0) return `지난달보다 +${diff}일`;
  if (diff < 0) return `지난달보다 −${-diff}일`; // U+2212, 빨강 없이
  return '지난달과 같아요';
}

export function makeNoteCardText(name = '교환 쪽지') {
  return {
    kick: (kind) => (kind === 'year' ? `${name} · 올해` : name),
    big: (card) => ({ num: String(card.bothDays), unit: '일' }),
    lead: (card) => {
      const lines = ['둘 다 쪽지를 남긴 날이에요.'];
      if (card.streak >= 2) lines.push(`가장 길게는 ${card.streak}일 연속`);
      return lines;
    },
    /** 연말 칸 (카드 2 연말의 「가장 잘 해낸 달」 칸과 같은 모양) */
    bestMonth: (card) =>
      card.bestMonth
        ? { month: `${card.bestMonth.month}월`, label: '가장 많이 주고받은 달', sub: `${card.bestMonth.days}일 둘 다 남겼어요` }
        : null,
    chip: (card, kind) => (kind === 'month' ? diffChip(card.prevDiff) : null),
    likedHead: (card) => `마음에 남은 쪽지 ${card.likedCount}장`,
    /** 쪽지 한 장 머리: 「준민의 마음에 남은 쪽지 · 11월 15일 (일)」 */
    likedItem: (item, labelOf) => `${labelOf(item.likedBy)}의 마음에 남은 쪽지 · ${dateLabel(item.date)}`,
    /** 쪽지 글 앞 작성자: 「단짝의 쪽지」 */
    likedAuthor: (item, labelOf) => `${labelOf(item.author)}의 쪽지`,
    tileLabel: '쪽지를 주고받은 날',
  };
}
