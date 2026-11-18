// node --test tests/diet.test.js — 단짝 식탁 D1: 시험 B(계산) · G1~G5(목표) · P1(규칙). 값은 docs/diet/fixtures 그대로, ±0.1
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../js/diet-calc.js');
const G = require('../js/diet-goal.js');
const A = require('../js/diet-ask.js');

const FX = path.join(__dirname, '..', 'docs', 'diet', 'fixtures');
const FOODS = JSON.parse(fs.readFileSync(path.join(FX, 'foods.json'), 'utf8')).foods;
const DAY = JSON.parse(fs.readFileSync(path.join(FX, 'day-2026-11-17.json'), 'utf8'));
const GOALS = JSON.parse(fs.readFileSync(path.join(FX, 'goal-cases.json'), 'utf8'));
const near = (a, b, msg, tol = 0.1) => assert.ok(Math.abs(a - b) <= tol + 1e-9, `${msg}: ${a} ≠ ${b}`);
const arr = (t) => [t.kcal, t.carb, t.protein, t.fat];
const nearAll = (got, want, msg) => want.forEach((w, i) => near(got[i], w, msg + ' ' + ['kcal', '탄', '단', '지'][i]));
const recipe = (name) => DAY.recipes.find((r) => r.recipe === name);

test('B · 레시피: 브라우니 전체 · 3/16(T5) · 특 간계밥', () => {
  nearAll(arr(C.recipeTotal(FOODS, recipe('셀프메이드 브라우니'), [16, 16])), DAY.recipeExpect['셀프메이드 브라우니 전체'], '브라우니 전체');
  nearAll(arr(C.recipeTotal(FOODS, recipe('셀프메이드 브라우니'), [3, 16])), DAY.recipeExpect['브라우니 3/16 (T5)'], '브라우니 3/16');
  nearAll(arr(C.recipeTotal(FOODS, recipe('특 간계밥'), [1, 1])), DAY.recipeExpect['특 간계밥 (T2)'], '특 간계밥');
  // 9/16 (tests.md T1 표)
  nearAll(arr(C.recipeTotal(FOODS, recipe('셀프메이드 브라우니'), [9, 16])), [313.4, 37.2, 10.0, 15.9], '브라우니 9/16');
});

test('B · 끼니 합계 T1 · T2 · T4 · T6 · T7 (extras · 레시피 몫 · overrides · 보충제 0 · g 로 적은 양)', () => {
  for (const m of DAY.meals) nearAll(arr(C.mealTotal(FOODS, DAY.recipes, m)), m.expect, m.id);
});

test('B · 하루 합계 · 16:15까지 · 18:15까지', () => {
  const upto = (id) => DAY.meals.slice(0, DAY.meals.findIndex((m) => m.id === id) + 1);
  nearAll(arr(C.dayTotal(FOODS, DAY.recipes, upto('T4'))), [2584.4, 348.6, 112.2, 86.5], '16:15까지');
  nearAll(arr(C.dayTotal(FOODS, DAY.recipes, upto('T6'))), [3542.4, 490.0, 145.8, 114.0], '18:15까지');
  nearAll(arr(C.dayTotal(FOODS, DAY.recipes, DAY.meals)), DAY.dayExpect, '하루');
});

test('B · 공복 시간: 끼니 사이 · 전날 마지막 → 아침 · 표기', () => {
  assert.deepEqual(C.fastingGaps(DAY.meals), DAY.fastingMin);
  assert.deepEqual(C.fastingGaps([{ at: '16:15' }, { at: '08:20' }, { at: '12:40' }]), [260, 215], '순서가 섞여도 시각 순');
  assert.equal(C.gapMin('22:30', '08:20'), 590, '전날 22:30 → 아침 08:20');
  assert.equal(C.fmtGap(260), '4시간 20분'); assert.equal(C.fmtGap(120), '2시간'); assert.equal(C.fmtGap(45), '45분');
});

test('B · 탄단지 kcal 비율: 점심 = 탄 59% · 단 16% · 지 25% (plan.md 말풍선 예)', () => {
  const lunch = C.mealTotal(FOODS, DAY.recipes, DAY.meals.find((m) => m.id === 'T2'));
  assert.deepEqual(C.macroPctRounded(lunch), { carb: 59, protein: 16, fat: 25 });
  const p = C.macroPct(lunch); near(p.carb + p.protein + p.fat, 100, '합 100');
  assert.deepEqual(C.macroPctRounded({ kcal: 0, carb: 0, protein: 0, fat: 0 }), { carb: 0, protein: 0, fat: 0 });
});

test('B · 보충제는 영양 합계 0 · 식품표에 없으면 알림', () => {
  assert.deepEqual(arr(C.foodTotal(FOODS, { food: '크레아틴', qty: 1 })), [0, 0, 0, 0]);
  assert.throws(() => C.foodTotal(FOODS, { food: '없는 음식', qty: 1 }), /식품표에 없음/);
  near(C.foodTotal(FOODS, { food: '파베글라스 설탕무첨가 다크 루미에르 초코칩', qty: 0.4, unit: '100g', grams: 40 }).kcal, 191.2, '40g = 100g의 0.4');
});

test('B · 질문 고르기: 폭 80 이상만, 큰 순서로 최대 3개 (T1+T2 → 밥 · 초콜릿 · 기름, 오뎅국 안 물음 / T7 → 밥 · 찌개)', () => {
  const t12 = [
    { path: '아침/셀프메이드 브라우니/무당초콜릿', what: 'product_and_grams', kcalRange: [0, 300] },
    { path: '아침/달걀스크램블', what: 'cooking_oil', kcalRange: [0, 135] },
    { path: '점심/특 간계밥/밥', what: 'unit_size', kcalRange: [790, 1180] },
    { path: '점심/오뎅국', what: 'amount', kcalRange: [90, 150] },
    { path: '점심/갓김치', what: 'amount', kcalRange: [10, 30] }
  ];
  assert.deepEqual(A.pick(t12).map((u) => u.path.split('/').pop()), ['밥', '무당초콜릿', '달걀스크램블']);
  const t7 = [{ path: '22:30/밥', what: 'unit_size', kcalRange: [470, 710] }, { path: '22:30/김치꽁치찌개', what: 'amount', kcalRange: [150, 300] }, { path: '22:30/멸치볶음', kcalRange: [60, 100] }];
  assert.deepEqual(A.pick(t7).map((u) => u.path.split('/').pop()), ['밥', '김치꽁치찌개']);
  assert.deepEqual(A.pick([{ kcalRange: [0, 80] }]).length, 1, '딱 80 이면 물음 (80 이상)');
  assert.deepEqual(A.pick([{ kcalRange: [0, 79] }, {}, null]), []);
  assert.equal(A.pick(Array.from({ length: 6 }, (_, i) => ({ kcalRange: [0, 100 + i] }))).length, 3, '최대 3개');
});

test('G1~G4 · 목표 계산 (fixtures 그대로)', () => {
  for (const c of GOALS.cases.filter((x) => x.in)) {
    const r = G.targets(c.in);
    for (const k of Object.keys(c.out)) {
      if (k === 'proteinCapped') assert.equal(r.proteinCapped, c.out[k], c.id + ' 단백질 20% 상한');
      else near(r[k], c.out[k], c.id + ' ' + k);
    }
  }
  assert.deepEqual(G.ACTIVITY, GOALS.activity, '활동 계수 표');
});

test('G5 · 감량 칼로리가 기초대사량보다 낮게 계산되면 K = BMR + 안내', () => {
  const b = { sex: 'm', age: 30, heightCm: 170, weightKg: 140, activity: 'none', goal: 'cut' };
  const raw = G.tdee(b) - b.weightKg * 5.5;
  assert.ok(raw < G.bmr(b), '시험 조건: 그대로면 BMR 아래');
  const r = G.targets(b);
  near(r.kcal, G.bmr(b), 'K = BMR', 1e-9);
  assert.equal(r.kcalRaised, true);
  assert.match(r.notes.join(' '), /감량 속도를 늦췄어요/);
  assert.equal(G.targets({ sex: 'm', age: 25, heightCm: 175, weightKg: 70, activity: 'w3_5', goal: 'cut' }).kcalRaised, false);
});

test('G · 범위 안내: 탄수 100g 아래 · 비율 밖이면 한 줄 (막지 않음)', () => {
  assert.deepEqual(G.targets({ sex: 'm', age: 25, heightCm: 175, weightKg: 70, activity: 'w3_5', goal: 'keep' }).notes, [], '예시는 안내 없음');
  const n = G.notesFor({ kcal: 1200, carb: 60, protein: 120, fat: 50 });
  assert.ok(n.some((x) => /100g/.test(x)) && n.some((x) => /단백질 비율/.test(x)));
});

test('G · 목표 대비 문구 (goal-cases statusRules · goals.md 6절)', () => {
  const R = GOALS.statusRules;
  for (const k of R.fill) { const [g, key] = k.includes('.') ? k.split('.') : ['keep', k]; assert.equal(G.kindOf(g, key), 'fill', k); }
  for (const k of R.limit) { const [g, key] = k.includes('.') ? k.split('.') : ['bulk', k]; assert.equal(G.kindOf(g, key), 'limit', k); }
  assert.equal(G.status('bulk', 'protein', 150, 140).text, '달성 ✓ +10');
  assert.equal(G.status('bulk', 'protein', 100, 140).text, '40 남음');
  assert.equal(G.status('cut', 'kcal', 2400, 2209.3).text, '191 많음');
  assert.equal(G.status('cut', 'kcal', 2000, 2209.3).text, '209 남음');
  assert.equal(G.status('keep', 'carb', 400, 374.4).text, '26 많음', '유지 탄수 = 넘지 말아야 (가정)');
  assert.equal(G.status('bulk', 'fat', 90, 79.3).text, '11 많음');
});

test('G · 다시 맞추기: 3주가 안 되면 제안 없음 · 70kg 벌크업 주 0.1kg → +200kcal (goals.md 7절 예)', () => {
  assert.equal(G.retune('bulk', [{ date: '2026-11-01', kg: 70 }, { date: '2026-11-15', kg: 70.2 }]), null, '2주');
  const r = G.retune('bulk', [{ date: '2026-10-25', kg: 69.7 }, { date: '2026-11-01', kg: 69.8 }, { date: '2026-11-15', kg: 70.0 }]);
  near(r.perWeek, 0.1, '주당 변화', 1e-9);
  assert.equal(r.kcal, 200);
  assert.equal(G.retune('cut', [{ date: '2026-10-25', kg: 70 }, { date: '2026-11-15', kg: 70 }]).kcal, -400, '감량인데 그대로면 내리기 제안 (−0.35kg/주 × 1100 ≈ −385 → −400)');
  near(G.clampKcal(1000, { sex: 'm', age: 25, heightCm: 175, weightKg: 70 }), 1673.75, '바꾼 뒤에도 BMR 아래로 안 내려감');
});

test('G · 안내 문구는 goals.md 8절과 글자 그대로', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'diet', 'goals.md'), 'utf8');
  const quote = /> \*\*참고용 추천이에요\.\*\* (.+)\n/.exec(md)[1];
  assert.equal(G.NOTICE, '참고용 추천이에요. ' + quote);
});

test('P1 · 규칙: 몸 정보 · 체중 기록은 본인만, 목표 숫자는 둘 다 읽음', () => {
  const r = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const priv = r.slice(r.indexOf('match /private/{uid}'), r.indexOf('function validGoal'));
  assert.match(priv, /allow read, delete: if isMember\(\) && request\.auth\.uid == uid;/);
  assert.match(priv, /match \/weights\/\{date\} \{\s*allow read, delete: if isMember\(\) && request\.auth\.uid == uid;/);
  assert.doesNotMatch(priv, /allow read: if isMember\(\);/, '단짝이 읽을 수 있는 줄 없음');
  const goals = r.slice(r.indexOf('match /goals/{uid}'), r.indexOf('// ── 알림 ──'));
  assert.match(goals, /allow read: if isMember\(\);/, '목표는 둘 다');
  assert.match(goals, /allow create, update: if isMember\(\) && request\.auth\.uid == uid/, '고치는 건 본인만');
  // 몸 정보 칸 이름이 목표 문서에 들어갈 수 없음
  assert.doesNotMatch(r.slice(r.indexOf('function validGoal'), r.indexOf('match /goals/{uid}')), /weightKg|heightCm|age|sex/);
});
