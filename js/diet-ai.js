/* 단짝 식탁 · AI 정리 결과 → 앱 계산 (D4 연결). AI(parseMeal)는 구조 · 짝짓기 · 모르는 것만 내고, 숫자는 여기서 식품표로 계산한다.
   - fromAi(result, ctx) → { meals: [{ at, kind, label, items, pending, total }], questions: [{ path, what, label, ask }] }
   - stateText(ctx)      → AI 에 보내는 「상태」 글 (저장된 레시피 · 내 식품 · 내 단위 — 몸 정보 · 목표는 넣지 않는다)
   ctx = { table: diet-match index, units: { 공기: { g } }, foods, recipes } */
(function (root) {
  'use strict';
  var RTx = root.RT || {};
  var C = RTx.dietCalc || (typeof require === 'function' ? require('./diet-calc.js') : null);
  var M = RTx.dietMatch || (typeof require === 'function' ? require('./diet-match.js') : null);
  var A = RTx.dietAsk || (typeof require === 'function' ? require('./diet-ask.js') : null);
  var KEYS = ['kcal', 'carb', 'protein', 'fat'];
  function zero() { return { kcal: 0, carb: 0, protein: 0, fat: 0 }; }
  function addTo(a, b, k) { KEYS.forEach(function (x) { a[x] += (b[x] || 0) * (k == null ? 1 : k); }); return a; }

  /** 식품표 줄 하나로 계산 (재료 · 단일 음식). 못 하면 null */
  function tableItem(it, ctx) {
    var key = it.match && it.match.key, e = (key && M.findTable(ctx.table, key)) || M.findTable(ctx.table, it.name);
    if (!e) return null;
    var g = it.grams > 0 ? { g: it.grams } : M.gramsFor(e, { amount: it.amount, unit: it.unit }, ctx.units || {});
    if (!g || !(g.g > 0) || g.g > 5000) return null;
    var t = addTo(zero(), e, g.g / 100);
    return { total: t, grams: g.g, est: g.est || null, dflt: g.dflt || null, ref: { kind: 'table', key: e.name, base: e.base } };
  }

  function convert(it, ctx) {
    var kind = it.match && it.match.kind;
    var out = { raw: it.name, name: it.name, amount: it.amount == null ? null : it.amount, unit: it.unit || null };
    if (kind === 'supplement') return Object.assign(out, { ref: { kind: 'supplement', key: (it.match && it.match.key) || it.name }, calc: {}, total: zero(), est: null });
    if (kind === 'new_recipe' || (it.ingredients && it.ingredients.length && kind !== 'table')) {
      var sum = zero(), miss = [], ests = [];
      (it.ingredients || []).forEach(function (x) {
        var r = tableItem(x, ctx);
        if (!r) miss.push(x.name); else { addTo(sum, r.total); if (r.est) ests.push(x.name); }
      });
      if (!it.ingredients || !it.ingredients.length || miss.length) return { pending: { raw: it.name + (miss.length ? ' (' + miss.join(' · ') + ')' : ''), name: it.name, reason: miss.length ? 'ingredient' : 'recipe' } };
      var p = it.portion && it.portion.den ? it.portion.num / it.portion.den : 1;
      return Object.assign(out, { ref: { kind: 'new_recipe', key: it.name }, calc: { portion: it.portion ? [it.portion.num, it.portion.den] : null }, total: addTo(zero(), sum, p),
        est: ests.length ? '어림한 재료: ' + ests.join(' · ') : null, ingredients: (it.ingredients || []).map(function (x) { return x.name; }) });
    }
    if (kind === 'table' || !kind) {
      var r = tableItem(it, ctx);
      if (!r) return { pending: { raw: it.name + (it.amount != null ? ' ' + it.amount + (it.unit || '') : ''), name: it.name, reason: 'unknown' } };
      // 함께 넣은 재료(스크램블 기름 등)
      var extra = [];
      (it.ingredients || []).forEach(function (x) { var rx = tableItem(x, ctx); if (rx) { addTo(r.total, rx.total); extra.push(x.name); } });
      return Object.assign(out, { ref: r.ref, calc: { grams: r.grams }, total: r.total, est: r.est, defaultUnit: r.dflt, extras: extra });
    }
    // 처음 보는 제품 · 저장 안 된 레시피는 등록 화면(D6) 뒤에 — 지금은 정리 대기
    return { pending: { raw: it.name + (it.amount != null ? ' ' + it.amount + (it.unit || '') : ''), name: it.name, reason: kind === 'new_product' ? 'product' : 'food' } };
  }

  var WHAT = { amount: '얼마나 먹었나요?', unit_size: '한 번에 얼마쯤이에요? (예: 햇반 1.5개 · 300g)', product: '어떤 제품이에요?', product_and_grams: '어떤 제품이고 몇 g쯤이에요?', grams: '몇 g쯤이에요?', cooking_oil: '기름을 썼나요? 어떤 기름을 얼마나?', oil: '기름을 썼나요? 어떤 기름을 얼마나?' };
  function question(u) {
    var seg = String(u.path || '').split('/').filter(Boolean), label = seg[seg.length - 1] || '이 음식';
    if (/^\d{1,2}:\d{2}$/.test(label) && seg.length > 1) label = seg[1];
    return { path: u.path, what: u.what, label: label, ask: WHAT[u.what] || (/oil|기름/.test(u.what) ? WHAT.oil : '조금 더 알려 주세요') };
  }

  function fromAi(res, ctx) {
    var meals = ((res && res.meals) || []).map(function (m) {
      var items = [], pending = [];
      (m.items || []).forEach(function (it) { var c = convert(it, ctx); if (c.pending) pending.push(c.pending); else items.push(c); });
      var total = zero(); items.forEach(function (i) { addTo(total, i.total); });
      return { at: m.at, kind: m.kind === 'snack' ? 'snack' : 'meal', label: m.label || null, items: items, pending: pending, total: total };
    }).filter(function (m) { return m.items.length || m.pending.length; });
    return { meals: meals, questions: A.pick((res && res.unknowns) || []).map(question) };
  }

  /** AI 에 보내는 상태 — 지금은 저장된 레시피 · 내 식품이 없고(D6) 내 단위는 기본값 */
  function stateText(ctx) {
    var u = ctx && ctx.units ? Object.keys(ctx.units).map(function (k) { return k + ' ' + ctx.units[k].g + 'g(사용자가 정함)'; }) : [];
    return '저장된 레시피 · 내 식품 없음. 내 단위: ' + (u.length ? u.join(', ') : '모두 기본값 (공기 210g 등)') + '.';
  }

  var api = { fromAi: fromAi, convert: convert, question: question, stateText: stateText };
  root.RT = root.RT || {};
  root.RT.dietAi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
