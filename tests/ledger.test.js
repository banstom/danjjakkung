// node --test tests/ledger.test.js — 단짝 영수증 계산 (docs/ledger/tests.md A 묶음: 참조 시험 20개 + 저장소 시험)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseLine, amountOf: parseAmountToken, rebalance, normalizeShares, splitHalf } = require('../js/ledger-parse.js');
const { monthSummary, manWon, percents, iGa } = require('../js/ledger-sum.js');

const ROOT = path.join(__dirname, '..');
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/ledger-2026-11.json'), 'utf8'));

const who = { meName: '준민', partnerName: '단짝', today: new Date(2026, 10, 19) }; // 11-19
const p = (s) => parseLine(s, who);

test('P1 금액 모양', () => {
  const cases = {
    '42000': 42000, '42,000': 42000, '42000원': 42000, '42,000원': 42000, '₩42000': 42000,
    '5.98만': 59800, '12만': 120000, '12만원': 120000, '1.5만원': 15000, '3천': 3000, '3천원': 3000,
    '12만5천': 125000, '12만5천원': 125000, '2만3500': 23500,
    '오만원': 50000, '만원': 10000, '만오천': 15000, '삼천오백원': 3500, '이십만': 200000, '십만원': 100000,
  };
  for (const [k, v] of Object.entries(cases)) assert.equal(parseAmountToken(k), v, k);
});

test('P2 금액이 아닌 낱말', () => {
  for (const k of ['천안', '2인', '7번', '3', '99', '오', '이', '만두', '15일', '11/15', 'ktx', '']) {
    assert.equal(parseAmountToken(k), null, k);
  }
});

test('P3 사용 예시 세 가지 (구상 문서)', () => {
  let r = p('저녁 42000 내가');
  assert.deepEqual([r.amount, r.payer, r.what, r.cat], [42000, 'me', '저녁', 'meal']);
  r = p('ktx 5.98만 단짝');
  assert.deepEqual([r.amount, r.payer, r.what, r.cat], [59800, 'partner', 'ktx', 'move']);
  r = p('숙소 12만 반반');
  assert.deepEqual([r.amount, r.payer, r.shares, r.cat], [120000, 'both', { me: 60000, partner: 60000 }, 'stay']);
});

test('P4 누가 — 조사 · 이름 · 생략', () => {
  assert.equal(p('카페 9800 준민이').payer, 'me');
  assert.equal(p('카페 9800 단짝이').payer, 'partner');
  assert.equal(p('카페 9800 단짝이가').payer, 'partner');
  assert.equal(p('카페 9800 제가').payer, 'me');
  assert.equal(p('카페 9800 같이').payer, 'both');
  assert.equal(p('카페 9800 엔빵').payer, 'both');
  const r = p('카페 9800');
  assert.equal(r.payer, 'me');
  assert.equal(r.payerGuessed, true); // 화면에서 '누가'를 한 번 더 보여 줌
});

test('P5 반반 홀수는 적는 사람이 1원 더', () => {
  assert.deepEqual(p('택시 13701 반반').shares, { me: 6851, partner: 6850 });
});

test('P6 각자 몫을 적은 경우', () => {
  let r = p('내가 12000 단짝 11000 배달 치킨');
  assert.deepEqual([r.amount, r.payer, r.shares, r.what, r.cat], [23000, 'both', { me: 12000, partner: 11000 }, '배달 치킨', 'meal']);
  r = p('숙소 준민 7만 단짝 5만');
  assert.deepEqual([r.amount, r.shares], [120000, { me: 70000, partner: 50000 }]);
  r = p('숙소 7만 내가 5만 단짝'); // 금액 뒤에 사람
  assert.deepEqual([r.amount, r.shares], [120000, { me: 70000, partner: 50000 }]);
});

test('P7 띄어 쓴 12만 5천', () => {
  assert.equal(p('펜션 12만 5천 반반').amount, 125000);
  assert.equal(p('펜션 12만 3000 단짝').amount, 123000);
});

test('P8 날짜 낱말', () => {
  assert.equal(p('어제 카페 9800').date, '2026-11-18');
  assert.equal(p('그저께 카페 9800').date, '2026-11-17');
  assert.equal(p('15일 저녁 4만').date, '2026-11-15');
  assert.equal(p('25일 저녁 4만').date, '2026-10-25'); // 오늘보다 뒤면 지난달
  assert.equal(p('11/15 저녁 4만').date, '2026-11-15');
  assert.equal(p('저녁 4만').date, '2026-11-19');
  assert.equal(p('저녁 4만').dateGuessed, true);
});

test('P9 금액이 없거나 너무 큼', () => {
  assert.equal(p('저녁 내가').error, 'no-amount');
  assert.equal(p('').error, 'no-amount');
  assert.equal(p('집 1억').error, 'too-big');
});

test('P10 분류 추측', () => {
  const c = (s) => p(s).cat;
  assert.equal(c('브런치 카페 3만'), 'cafe');
  assert.equal(c('호텔 셔틀 2만'), 'stay');
  assert.equal(c('밥 2만'), 'meal');
  assert.equal(c('회 6만'), 'meal');
  assert.equal(c('회사 근처 2만'), 'etc'); // 한 글자 '회'는 낱말 전체일 때만
  assert.equal(c('미술관 2만'), 'play');
  assert.equal(c('이마트 5만'), 'shop');
  assert.equal(c('KTX 5.98만'), 'move');
  assert.equal(c('선물 3만'), 'etc');
  assert.equal(p('선물 3만').catGuessed, false);
});

test('P11 무엇이 비면 분류 이름', () => {
  assert.equal(p('42000 내가').what, '기타');
});

test('P12 원문은 그대로 남김, 대소문자 유지', () => {
  const r = p('  KTX 5.98만 단짝 ');
  assert.equal(r.raw, 'KTX 5.98만 단짝');
  assert.equal(r.what, 'KTX');
});

test('P13 금액이 여러 개면 마지막 것', () => {
  assert.equal(p('2만 깎아서 저녁 4만').amount, 40000);
});

test('S1 11월 요약 (목업 숫자)', () => {
  const s = monthSummary(fx.spends, fx.people);
  assert.equal(s.total, 446200);
  assert.equal(s.totalText, '446,200원');
  assert.equal(s.me.amount, 221200);
  assert.equal(s.partner.amount, 225000);
  assert.deepEqual([s.me.pct, s.partner.pct], [50, 50]);
  assert.equal(s.me.text, '22.1만 원');
  assert.equal(s.partner.text, '22.5만 원');
  assert.equal(s.line, '이번 달은 단짝이 3,800원 더 냈어요');
  assert.deepEqual(s.cats.map((c) => c.text), ['식사 14.9만 원', '숙소 12만 원', '교통 7.4만 원', '놀거리 5.4만 원', '장보기 2.7만 원', '카페 2.2만 원']);
  assert.equal(s.topCat, 'meal');
});

test('S2 같으면 똑같이, 없으면 빈 문구', () => {
  const ppl = fx.people;
  const eq = [{ amount: 10000, paidBy: 'jm', cat: 'cafe' }, { amount: 10000, paidBy: 'dj', cat: 'cafe' }];
  assert.equal(monthSummary(eq, ppl).line, '이번 달은 똑같이 냈어요');
  const none = monthSummary([], ppl);
  assert.equal(none.line, '아직 이번 달 기록이 없어요');
  assert.deepEqual([none.me.pct, none.partner.pct], [0, 0]);
});

test('S3 내가 더 낸 달 — 받침 따라 이/가', () => {
  const ppl = { me: { uid: 'a', name: '지수' }, partner: { uid: 'b', name: '준민' } };
  const s = monthSummary([{ amount: 32200, paidBy: 'a', cat: 'meal' }], ppl);
  assert.equal(s.line, '이번 달은 지수가 32,200원 더 냈어요');
  assert.equal(iGa('준민'), '이');
  assert.equal(iGa('Alex'), '이');
});

test('S4 % 합은 늘 100', () => {
  assert.deepEqual(percents(1, 2), [33, 67]);
  assert.deepEqual(percents(164000, 132000), [55, 45]);
  assert.deepEqual(percents(1, 199), [1, 99]);
  assert.equal(percents(0, 0), null);
});

test('S5 만 원 표기', () => {
  assert.equal(manWon(8000), '8,000원');
  assert.equal(manWon(120000), '12만 원');
  assert.equal(manWon(164000), '16.4만 원');
  assert.equal(manWon(59800), '6만 원');
  assert.equal(manWon(1234000), '123.4만 원');
});

test('S6 나눔 칸 맞추기', () => {
  assert.deepEqual(rebalance(120000, 'me', 70000), { me: 70000, partner: 50000 });
  assert.deepEqual(rebalance(120000, 'partner', 200000), { me: 0, partner: 120000 });
  assert.deepEqual(rebalance(120000, 'me', -5), { me: 0, partner: 120000 });
  assert.deepEqual(splitHalf(1), { me: 1, partner: 0 });
});

test('S7 저장 직전 나눔 정리', () => {
  assert.deepEqual(normalizeShares(100, { me: 100, partner: 0 }), { paidBy: 'me', shares: null });
  assert.deepEqual(normalizeShares(100, { me: 0, partner: 100 }), { paidBy: 'partner', shares: null });
  assert.deepEqual(normalizeShares(100, { me: 40, partner: 60 }), { paidBy: 'both', shares: { me: 40, partner: 60 } });
  assert.throws(() => normalizeShares(100, { me: 40, partner: 50 }), /shares-mismatch/);
});

// ── 저장소에서 더한 시험 ──
// (서버 사본이 같은지는 tests/shared.test.js)

test('L2 「N일」이 지난달에 없는 날이면 날짜로 읽지 않음 (3월 31일에 「31일」은 그날, 3월 1일에 「30일」은 없음)', () => {
  assert.equal(parseLine('31일 저녁 4만', { meName: '준민', partnerName: '단짝', today: new Date(2027, 2, 31) }).date, '2027-03-31');
  const r = parseLine('30일 저녁 4만', { meName: '준민', partnerName: '단짝', today: new Date(2027, 2, 1) });
  assert.equal(r.date, '2027-03-01');
  assert.equal(r.dateGuessed, true);
});

test('L3 모르는 분류 값은 기타로 더함 (합계가 NaN 이 되지 않게)', () => {
  const s = monthSummary([{ amount: 5000, paidBy: 'jm', cat: 'weird' }, { amount: 3000, paidBy: 'dj' }], fx.people);
  assert.equal(s.total, 8000);
  assert.deepEqual(s.cats.map((c) => c.text), ['기타 8,000원']);
});

test('L4 만 원 표기 — 천만 원대도 쉼표, 반올림해서 딱 떨어지면 .0 없음', () => {
  assert.equal(manWon(12345678), '1,234.6만 원');
  assert.equal(manWon(99960), '10만 원');
  assert.equal(manWon(10000), '1만 원');
});
