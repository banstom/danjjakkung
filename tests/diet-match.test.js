// node --test tests/diet-match.test.js — 단짝 식탁 D3: AI 없이 맞춰 보기 (tests.md T5) · 글 읽기 · 식약처 식품표
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../js/diet-match.js');

const FX = path.join(__dirname, '..', 'docs', 'diet', 'fixtures');
const FOODS = JSON.parse(fs.readFileSync(path.join(FX, 'foods.json'), 'utf8')).foods;
const DAY = JSON.parse(fs.readFileSync(path.join(FX, 'day-2026-11-17.json'), 'utf8'));
const TABLE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'foods-kr.json'), 'utf8'));
const TAB = M.index(TABLE);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= 0.1 + 1e-9, `${msg}: ${a} ≠ ${b}`);
const arr = (t) => [t.kcal, t.carb, t.protein, t.fat];

test('T5 · 저장된 것만이면 앱 코드만 — AI 0번(정리 대기 0) · 브라우니 3/16 · 특 간계밥 = T2', () => {
  const r = M.match(M.parse('아침 09:00\n-브라우니 3조각\n-특 간계밥', '12:00'), { foods: FOODS, recipes: DAY.recipes, table: TAB });
  assert.equal(r.at, '09:00'); assert.equal(r.label, '아침'); assert.equal(r.kind, 'meal');
  assert.equal(r.pending.length, 0, 'AI 를 부를 줄 없음');
  assert.equal(r.items[0].ref.key, '셀프메이드 브라우니', '이름 일부만 같아도 짝지음');
  [104.5, 12.4, 3.3, 5.3].forEach((w, i) => near(arr(r.items[0].total)[i], w, '브라우니 3/16 ' + i));
  near(r.items[1].total.kcal, 1417.0, '특 간계밥');
  assert.deepEqual(r.items[1].calc, { recipeRef: '특 간계밥', portion: [1, 1] });
});

test('D3 글 읽기: 시각 · 끼니 · 양 · 단위 · 몫 · 재료 줄은 AI 로', () => {
  const p = M.parse('11.17.\n아침 08:20\n-달걀스크램블  3개\n-사과 1개\n-셀프메이드 브라우니 9조각/16조각\n:(바나나2개+계란2개)', null);
  assert.deepEqual(p.date, [null, 11, 17]); assert.equal(p.at, '08:20');
  assert.deepEqual(p.lines.slice(0, 3).map((l) => [l.name, l.amount, l.unit]), [['달걀스크램블', 3, '개'], ['사과', 1, '개'], ['셀프메이드 브라우니', 9, '조각']]);
  assert.deepEqual(p.lines[2].portion, [9, 16]);
  assert.equal(p.lines[3].complex, true, '재료 줄은 AI 가 위 항목에 붙임');
  assert.equal(M.parse('1815 저녁 밥 2공기(햇반기준) 계란 3개들어간 간계밥').at, '18:15');
  assert.equal(M.parse('1815 저녁 밥 2공기(햇반기준) 계란 3개들어간 간계밥').lines[0].complex, true, '레시피 양 바꾸기는 AI (T6)');
  const t7 = M.parse('2230에 식사: 밥 1.5공기 / 조기 1개 /김치꽁치찌개 /멸치볶음');
  assert.equal(t7.at, '22:30'); assert.equal(t7.label, null, '「식사」는 라벨 아님'); assert.equal(t7.kind, 'meal');
  assert.deepEqual(t7.lines.map((l) => [l.name, l.amount, l.unit]), [['밥', 1.5, '공기'], ['조기', 1, '개'], ['김치꽁치찌개', null, null], ['멸치볶음', null, null]]);
  const t4 = M.parse('16시15분에 바나나 2개와 마이프로틴 1스쿱(25g) 크레아틴 1스쿱(3g) 간식으로 먹었어');
  assert.equal(t4.at, '16:15'); assert.equal(t4.kind, 'snack');
  assert.equal(M.parse('사과 한 개', '07:05').at, '07:05', '시각이 없으면 지금');
  assert.deepEqual([M.parseItem('사과 한 개').amount, M.parseItem('바나나2개').amount, M.parseItem('반 공기 밥').complex], [1, 2, false]);
  assert.equal(M.takeTime('9시 반').at, '09:30'); assert.equal(M.takeTime('2599'), null);
});

test('D3 회귀(점검 AI): 4자리 양 · 이름 앞 에/로 · 여러 끼니 · 날짜 · 분수 · 엉뚱한 양', () => {
  const p1 = M.parse('닭가슴살 1000g', '12:00');
  assert.equal(p1.at, '12:00'); assert.deepEqual([p1.lines[0].name, p1.lines[0].amount, p1.lines[0].unit], ['닭가슴살', 1000, 'g']);
  const p2 = M.parse('우유 1200ml\n아침 0800', '12:00');
  assert.equal(p2.at, '08:00', '양은 시각이 아님 · 시각 줄이 뒤에 와도 그 끼니 시각'); assert.equal(p2.label, '아침'); assert.equal(p2.more, 0);
  assert.equal(M.parse('로제떡볶이').lines[0].name, '로제떡볶이'); assert.equal(M.parse('에그타르트 1개').lines[0].name, '에그타르트');
  const p3 = M.parse('아침 08:20\n사과 1개\n점심 12:40\n김밥');
  assert.equal(p3.more, 1, '두 번째 끼니는 앱이 「한 끼씩」 안내'); assert.deepEqual(p3.lines.map((l) => l.name), ['사과']);
  assert.deepEqual(M.parse('2026.11.17\n사과 1개').date, [2026, 11, 17]);
  assert.equal(M.parse('1.5').date, null, '「1.5」는 날짜 아님');
  assert.equal(M.parse('사과 1/2개').lines[0].amount, 0.5);
  const big = M.match(M.parse('사과 99999개\n사과 0개'), { table: TAB });
  assert.deepEqual(big.pending.map((x) => x.reason), ['amount', 'amount']);
});

test('D3 회귀(점검 AI): ml 기준 줄은 기준을 남김 · 어림한 양은 추정 표시 · 양 없는 밥 = 한 공기', () => {
  const r = M.match(M.parse('짜장면\n밥\n사과 1개\n참기름 1스푼\n방울토마토 10알'), { table: TAB });
  const by = Object.fromEntries(r.items.map((i) => [i.name, i]));
  assert.equal(by['짜장면'].ref.base, TAB.by['짜장면'].find((e) => e.base === 'g') ? 'g' : 'ml');
  assert.match(by['짜장면'].est, /1인분/);
  assert.equal(by['밥'].calc.grams, 210); assert.equal(by['밥'].defaultUnit, '공기');
  assert.match(by['사과'].est, /1개 ≈ 200g/); assert.match(by['참기름'].est, /스푼/);
  assert.equal(by['방울토마토'] && by['방울토마토'].calc.grams, 150, '토막 어디든 1개 무게');
});

test('D3 식약처 식품표: 음식 · 원재료 2만 개쯤 · 이름 그대로 / 「_생것」 · 1개 무게 · 내 단위 · 1인분', () => {
  assert.ok(TABLE.items.length > 15000 && TABLE.items.length < 30000, '음식 + 원재료 ' + TABLE.items.length);
  assert.deepEqual(TABLE.cols, ['name', 'kind', 'base', 'kcal', 'carb', 'protein', 'fat', 'serve']);
  assert.equal(M.findTable(TAB, '사과').name, '사과_생것');
  assert.equal(M.findTable(TAB, '계란').name, '달걀_생것', '계란 = 달걀');
  assert.equal(M.findTable(TAB, '밥').name, '쌀밥'); assert.equal(M.findTable(TAB, '밥').base, 'g', 'g 기준 우선');
  assert.equal(M.findTable(TAB, '없는음식이름'), null);
  const r = M.match(M.parse('점심 12:40\n-사과 1개\n-계란 2개\n-갓김치\n-밥 1.5공기\n-참기름 1스푼'), { foods: {}, recipes: [], table: TAB, units: {} });
  assert.equal(r.pending.length, 0);
  const g = Object.fromEntries(r.items.map((i) => [i.name, i.calc.grams]));
  assert.deepEqual(g, { 사과: 200, 계란: 100, 갓김치: TAB.by['갓김치'].find((e) => e.base === 'g').serve, 밥: 315, 참기름: 10 });
  assert.equal(r.items.find((i) => i.name === '밥').defaultUnit, '공기', '공기 기본값(210g)을 썼다고 표시 → 질문');
  const mine = M.match(M.parse('밥 1.5공기'), { table: TAB, units: { 공기: { g: 315, set: 'user' } } });
  assert.equal(mine.items[0].calc.grams, 472.5); assert.equal(mine.items[0].defaultUnit, null, '정한 단위면 안 물음');
  const unk = M.match(M.parse('김치꽁치찌개 / 조기 1개 / 우리집 특제 볶음'), { table: TAB });
  assert.deepEqual(unk.pending.map((x) => x.reason), ['unknown', 'unknown', 'unknown'], '모르는 건 정리 대기(AI)');
});

test('D3 내 식품 · 보충제 · 제품 단위', () => {
  const foods = { '파베글라스 설탕무첨가 다크 루미에르 초코칩': FOODS['파베글라스 설탕무첨가 다크 루미에르 초코칩'], 크레아틴: FOODS['크레아틴'], 햇반: FOODS['햇반'] };
  const r = M.match(M.parse('파베글라스 1줌\n크레아틴 1스쿱\n햇반 2개\n햇반 300g'), { foods, table: TAB });
  assert.equal(r.pending.length, 0);
  assert.deepEqual(r.items.map((i) => i.ref.kind), ['food', 'supplement', 'food', 'food'], '크레아틴은 보충제(체크만)');
  assert.equal(r.items[1].total.kcal, 0);
  near(r.items[3].total.kcal, 450, '햇반 300g');
  near(r.items[0].total.kcal, 478 * 0.2, '1줌 = 20g');
  near(r.items[2].total.kcal, 630, '햇반 2개');
});
