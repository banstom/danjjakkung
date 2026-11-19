// node --test tests/diet-ai.test.js — 단짝 식탁 AI 정리 결과 → 앱 계산 (숫자는 식품표로만)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../js/diet-match.js');
const AI = require('../js/diet-ai.js');
const TAB = M.index(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'foods-kr.json'), 'utf8')));
const T1 = { meals: [{ at: '08:20', kind: 'meal', label: '아침', items: [
  { name: '달걀스크램블', amount: 3, unit: '개', match: { kind: 'table', key: '달걀' }, ingredients: [{ name: '카놀라유', amount: 1, unit: '스푼', match: { kind: 'table', key: '카놀라유' } }] },
  { name: '사과', amount: 1, unit: '개', match: { kind: 'table', key: '사과' } },
  { name: '셀프메이드 브라우니', portion: { num: 9, den: 16 }, match: { kind: 'new_recipe' }, ingredients: [{ name: '바나나', amount: 2, unit: '개', match: { kind: 'table', key: '바나나' } }, { name: '무당초콜릿', amount: 2, unit: '줌', match: { kind: 'new_product' } }] }] },
  { at: '16:15', kind: 'snack', items: [{ name: '바나나', amount: 2, unit: '개', match: { kind: 'table', key: '바나나' } }, { name: '크레아틴', amount: 1, unit: '스쿱', match: { kind: 'supplement', key: '크레아틴' } }] }],
  unknowns: [{ path: '아침/달걀스크램블', what: 'cooking_oil', kcalRange: [0, 120] }, { path: '아침/셀프메이드 브라우니/무당초콜릿', what: 'product_and_grams', kcalRange: [150, 300] }, { path: '아침/사과', what: 'amount', kcalRange: [90, 130] }] };

test('AI 결과 → 끼니 · 숫자는 식품표 · 모르는 재료가 있는 레시피는 정리 대기 · 보충제 0', () => {
  const r = AI.fromAi(T1, { table: TAB });
  assert.equal(r.meals.length, 2);
  const [am, sn] = r.meals;
  assert.deepEqual(am.items.map((i) => i.name), ['달걀스크램블', '사과']);
  const egg = am.items[0], e = TAB.by['달걀_생것'][0];
  assert.ok(Math.abs(egg.total.kcal - (e.kcal * 1.5 + (TAB.by['카놀라유'] ? TAB.by['카놀라유'][0].kcal / 10 : 0))) < 0.5, '달걀 150g + 기름 1스푼');
  assert.deepEqual(egg.extras, TAB.by['카놀라유'] ? ['카놀라유'] : []);
  assert.deepEqual(am.pending.map((x) => x.reason), ['ingredient'], '무당초콜릿(처음 보는 제품)이 있어 브라우니는 정리 대기');
  assert.match(am.pending[0].raw, /무당초콜릿/);
  assert.equal(sn.kind, 'snack'); assert.equal(sn.items.find((i) => i.name === '크레아틴').total.kcal, 0);
  assert.deepEqual(r.questions.map((q) => q.label), ['무당초콜릿', '달걀스크램블'], '폭 80 이상만 · 넓은 순 (사과 40 은 안 물음)');
  assert.match(r.questions[1].ask, /기름/);
});

test('AI 결과: 재료를 다 알면 새 레시피를 몫만큼 · 이상한 양 · 빈 결과', () => {
  const r = AI.fromAi({ meals: [{ at: '09:00', items: [{ name: '바나나빵', portion: { num: 1, den: 4 }, match: { kind: 'new_recipe' }, ingredients: [{ name: '바나나', amount: 2, unit: '개', match: { kind: 'table', key: '바나나' } }, { name: '달걀', amount: 2, unit: '개', match: { kind: 'table', key: '달걀' } }] },
    { name: '사과', amount: 99999, unit: 'g', match: { kind: 'table', key: '사과' } }] }] }, { table: TAB });
  const b = r.meals[0].items[0], ba = TAB.by['바나나_생것'][0], eg = TAB.by['달걀_생것'][0];
  assert.ok(Math.abs(b.total.kcal - (ba.kcal * 2.4 + eg.kcal * 1.0) / 4) < 0.5);
  assert.equal(r.meals[0].pending[0].reason, 'unknown', '5kg 넘는 양은 계산 안 함');
  assert.deepEqual(AI.fromAi(null, { table: TAB }), { meals: [], questions: [] });
  assert.doesNotMatch(AI.stateText({ units: {} }), /체중|키|나이|목표|kcal/, '몸 정보 · 목표는 안 보냄');
});

test('회귀(점검 AI): AI 가 낸 g 은 단위로 못 할 때만 · 추정 · 몫 · 합계 상한 · 음식을 보충제로 붙여도 0 아님 · 빠진 재료 알림', () => {
  const r = AI.fromAi({ meals: [{ at: '09:00', items: [
    { name: '사과', amount: 1, unit: '개', grams: 999, match: { kind: 'table', key: '사과' } },
    { name: '바나나', grams: 300, unit: '송이', amount: 1, match: { kind: 'table', key: '바나나' } },
    { name: '바나나빵', portion: { num: 160, den: 16 }, match: { kind: 'new_recipe' }, ingredients: [{ name: '바나나', amount: 2, unit: '개', match: { kind: 'table', key: '바나나' } }] },
    { name: '사과', amount: 1, unit: '개', match: { kind: 'supplement', key: '사과' } },
    { name: '달걀', amount: 2, unit: '개', match: { kind: 'table', key: '달걀' }, ingredients: [{ name: '이상한기름', amount: 1, unit: '스푼', match: { kind: 'table', key: '이상한기름' } }] }] }] }, { table: TAB });
  const [ap, ba, ap2, eg] = r.meals[0].items;
  assert.equal(ap.calc.grams, 200, '개수로 계산 (AI 의 999g 무시)');
  assert.equal(ba.calc.grams, 300); assert.match(ba.est, /AI가 읽은 양 300g/);
  assert.deepEqual(r.meals[0].pending.map((x) => x.reason), ['amount'], '10배 몫은 계산 안 함');
  assert.ok(ap2.total.kcal > 100, '식품표 음식은 보충제로 붙어도 계산');
  assert.match(eg.est, /빠진 재료: 이상한기름/);
});

test('사용자 요청: 앱이 아는 건 안 물음 — 식품표 반찬의 기름 · 양을 적은 항목의 양 · 햇반 같은 흔한 이름', () => {
  const r = AI.fromAi({ meals: [{ at: '22:30', items: [
    { name: '멸치볶음', match: { kind: 'table', key: '멸치볶음' } },
    { name: '햇반', amount: 1, unit: '개', match: { kind: 'table', key: '햇반' } },
    { name: '달걀스크램블', amount: 3, unit: '개', match: { kind: 'table', key: '달걀' } }] }],
    unknowns: [{ path: '22:30/멸치볶음', what: 'cooking_oil', kcalRange: [20, 110] }, { path: '22:30/햇반', what: 'amount', kcalRange: [200, 400] }, { path: '22:30/달걀스크램블', what: 'cooking_oil', kcalRange: [0, 120] }] }, { table: TAB });
  assert.deepEqual(r.meals[0].pending, [], '햇반 = 쌀밥 1개 210g');
  assert.equal(r.meals[0].items.find((i) => i.name === '햇반').calc.grams, 210);
  assert.deepEqual(r.questions.map((q) => q.label), ['달걀스크램블'], '직접 만든 스크램블의 기름만 물음');
});
