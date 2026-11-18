/* 단짝 식탁 계산 (D1) — 합계 · 레시피 비율 · 탄단지 kcal 비율 · 공복 시간. AI 없이 앱 코드만.
   문서: docs/diet/plan.md · tests.md (시험 B), 값: docs/diet/fixtures/foods.json 모양
   식품 food = { unit, unitG?, kcal, carb, protein, fat, type? } — 1단위당 값. 단위가 '100g' 이면 unitG 100
   항목 item = { food, qty, unit?, grams?, extras?: [item] } | { recipeRef, portion: [num, den], overrides?: [item] }
   레시피 recipe = { recipe, servings, ingredients: [item] }
   저장은 소수 그대로, 반올림은 화면에서만 (goals.md 9절) */
(function (root) {
  'use strict';
  var KEYS = ['kcal', 'carb', 'protein', 'fat'];

  function zero() { return { kcal: 0, carb: 0, protein: 0, fat: 0 }; }
  function add(a, b, k) { k = k == null ? 1 : k; KEYS.forEach(function (x) { a[x] += (b[x] || 0) * k; }); return a; }

  /** 식품 몇 단위인지: grams 가 있고 1단위 g(unitG)을 알면 grams ÷ unitG, 아니면 qty */
  function unitsOf(food, item) {
    if (item.grams != null && food.unitG) return item.grams / food.unitG;
    return item.qty == null ? 1 : item.qty;
  }

  /** 식품 하나 → 영양 합. 보충제(type supplement)는 0 (먹었는지만 체크) */
  function foodTotal(foods, item) {
    var f = foods[item.food];
    if (!f) throw new Error('식품표에 없음: ' + item.food);
    var out = zero();
    if (f.type === 'supplement') return out;
    return add(out, f, unitsOf(f, item));
  }

  function findRecipe(recipes, name) {
    for (var i = 0; i < recipes.length; i++) if (recipes[i].recipe === name) return recipes[i];
    throw new Error('레시피 없음: ' + name);
  }

  /** 레시피 → 영양 합. overrides = 이번 끼니에만 바꾼 재료(같은 식품이면 바꿈, 없으면 더함). portion = [먹은 몫, 전체 몫] */
  function recipeTotal(foods, recipe, portion, overrides) {
    var ings = recipe.ingredients.map(function (x) { return x; });
    (overrides || []).forEach(function (o) {
      var i = ings.map(function (x) { return x.food; }).indexOf(o.food);
      if (i >= 0) ings[i] = o; else ings.push(o);
    });
    var sum = zero();
    ings.forEach(function (x) { add(sum, foodTotal(foods, x)); });
    var p = portion || [1, 1];
    var k = p[1] ? p[0] / p[1] : 1;
    var out = zero(); return add(out, sum, k);
  }

  /** 항목 하나 → 영양 합 (식품 + 함께 넣은 것(extras, 예: 스크램블 기름) 또는 레시피 몫) */
  function itemTotal(foods, recipes, item) {
    if (item.recipeRef) return recipeTotal(foods, findRecipe(recipes, item.recipeRef), item.portion, item.overrides);
    var out = foodTotal(foods, item);
    (item.extras || []).forEach(function (e) { add(out, foodTotal(foods, e)); });
    return out;
  }

  function mealTotal(foods, recipes, meal) {
    var out = zero();
    (meal.items || []).forEach(function (it) { add(out, itemTotal(foods, recipes, it)); });
    return out;
  }

  function dayTotal(foods, recipes, meals) {
    var out = zero();
    meals.forEach(function (m) { add(out, mealTotal(foods, recipes, m)); });
    return out;
  }

  /** 탄 · 단 · 지 kcal 비율(%) — 탄수 4 · 단백질 4 · 지방 9 로 셈, 셋의 합을 100으로 */
  function macroPct(t) {
    var c = t.carb * 4, p = t.protein * 4, f = t.fat * 9, s = c + p + f;
    if (!s) return { carb: 0, protein: 0, fat: 0 };
    return { carb: c / s * 100, protein: p / s * 100, fat: f / s * 100 };
  }
  /** 화면용 정수 비율 (합이 100이 되게 가장 큰 나머지에 더함) */
  function macroPctRounded(t) {
    var p = macroPct(t), keys = ['carb', 'protein', 'fat'];
    var fl = keys.map(function (k) { return Math.floor(p[k]); });
    var left = (p.carb + p.protein + p.fat > 0 ? 100 : 0) - fl.reduce(function (a, b) { return a + b; }, 0);
    var order = keys.map(function (k, i) { return [p[k] - fl[i], i]; }).sort(function (a, b) { return b[0] - a[0]; });
    for (var j = 0; j < left; j++) fl[order[j % 3][1]]++;
    return { carb: fl[0], protein: fl[1], fat: fl[2] };
  }

  /** 'HH:MM' → 분 */
  function toMin(at) { var m = /^(\d{1,2}):(\d{2})$/.exec(at || ''); return m ? +m[1] * 60 + +m[2] : NaN; }
  /** 두 시각 사이 공복(분). 같은 날이면 b − a, b 가 더 이르면 다음 날로 봄 (전날 마지막 끼니 → 아침) */
  function gapMin(a, b) { var d = toMin(b) - toMin(a); return d < 0 ? d + 1440 : d; }
  /** 끼니들(시각 순으로 정렬해서) 사이 공복 목록 */
  function fastingGaps(meals) {
    var ats = meals.map(function (m) { return m.at; }).sort(function (x, y) { return toMin(x) - toMin(y); });
    var out = []; for (var i = 1; i < ats.length; i++) out.push(gapMin(ats[i - 1], ats[i]));
    return out;
  }
  /** 260 → '4시간 20분', 120 → '2시간', 45 → '45분' */
  function fmtGap(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    return h && m ? h + '시간 ' + m + '분' : h ? h + '시간' : m + '분';
  }

  var api = { KEYS: KEYS, unitsOf: unitsOf, foodTotal: foodTotal, recipeTotal: recipeTotal, itemTotal: itemTotal, mealTotal: mealTotal, dayTotal: dayTotal,
    macroPct: macroPct, macroPctRounded: macroPctRounded, toMin: toMin, gapMin: gapMin, fastingGaps: fastingGaps, fmtGap: fmtGap };
  root.RT = root.RT || {};
  root.RT.dietCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
