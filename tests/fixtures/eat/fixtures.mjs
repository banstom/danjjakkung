// 출출 쿠키 시험 자료 (참조 reference/test/fixtures.js 그대로)
// 시험 기록 — 목업 숫자와 같은 기록 (11월 7~21일, 통 안 나 7 · 단짝 5, 지금 = 11월 21일 오후 5:34)
export const ME = 'u-me';
export const HER = 'u-her';

/** 서울 시각 → ms */
export function seoul(y, m, d, hh = 0, mm = 0) {
  return Date.UTC(y, m - 1, d, hh - 9, mm);
}

export const NOW = seoul(2026, 11, 21, 17, 34);

const kakao = (name, id, sigungu) => ({ name, kakaoId: String(id), url: `https://place.map.kakao.com/${id}`, sigungu });

export function jarCookies() {
  return [
    { id: 'c-pho', by: ME, food: '쌀국수', place: kakao('하노이 골목', 1001, '11290'), memo: '국물 진한 걸로, 고수는 빼고', at: seoul(2026, 11, 7, 13, 12), state: 'jar' },
    { id: 'c-mara', by: HER, food: '마라탕', memo: '단계는 1단계로… 지난번 2단계는 무리였어', at: seoul(2026, 11, 9, 22, 42), state: 'jar' },
    { id: 'c-bibim', by: ME, food: '비빔밥', at: seoul(2026, 11, 10, 12, 0), state: 'jar' },
    { id: 'c-katsu', by: ME, food: '돈가스', place: kakao('카츠 하루', 1002, '11440'), memo: '치즈 말고 등심. 밥 리필 되는 곳!', at: seoul(2026, 11, 12, 12, 5), state: 'jar' },
    { id: 'c-jjamppong', by: HER, food: '짬뽕', at: seoul(2026, 11, 13, 19, 0), state: 'jar' },
    { id: 'c-jjol', by: ME, food: '쫄면', at: seoul(2026, 11, 14, 15, 20), state: 'jar' },
    { id: 'c-kimchi', by: HER, food: '김치찌개', memo: '추운 날엔 무조건. 계란말이도 같이 시키자', at: seoul(2026, 11, 15, 19, 30), state: 'jar' },
    { id: 'c-tteok', by: ME, food: '떡볶이', at: seoul(2026, 11, 16, 18, 0), state: 'jar', from: 'c-old-tteok' },
    { id: 'c-sundae', by: ME, food: '순대국', memo: '비 오는 날', at: seoul(2026, 11, 18, 8, 40), state: 'jar' },
    { id: 'c-sushi', by: HER, food: '초밥', at: seoul(2026, 11, 19, 21, 10), state: 'jar' },
    { id: 'c-gukbap', by: ME, food: '돼지국밥', at: seoul(2026, 11, 20, 11, 30), state: 'jar' },
    { id: 'c-tteokkochi', by: HER, food: '떡꼬치', at: seoul(2026, 11, 20, 22, 0), state: 'jar' },
  ];
}

export function eatenCookies() {
  return [
    { id: 'c-old-tteok', by: HER, food: '떡볶이', at: seoul(2026, 11, 2, 10, 0), state: 'eaten', eaten: { at: seoul(2026, 11, 5, 19, 0), by: ME, together: true }, stars: { [ME]: 4, [HER]: 5 } },
    { id: 'c-old-ramen', by: ME, food: '라멘', at: seoul(2026, 11, 1, 10, 0), state: 'eaten', eaten: { at: seoul(2026, 11, 8, 13, 0), by: ME, together: false }, stars: { [ME]: 3 } },
  ];
}

/** 결정적인 무작위 (시험용) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
