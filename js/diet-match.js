/* 단짝 식탁 맞춰 보기 (D3) — 적은 글을 AI 없이 저장된 레시피 · 내 식품 · 식품표로 맞춰 본다.
   문서: docs/diet/plan.md 「AI 처리」 ① · tests.md T5 (저장된 것만이면 AI 0번 · 질문 0개)
   - parse(text, nowAt)  → { date, at, kind, label, lines: [{ raw, name, amount, unit, portion, complex }] }
   - match(parsed, ctx)  → { at, kind, label, items: [...], pending: [줄], total }
       ctx = { foods: { 이름: 식품(1단위 값) }, recipes: [{ recipe, servings, ingredients }], table: index(foods-kr.json) | null, units: { 공기: { g, set } } }
   - 못 맞춘 줄(재료를 함께 적은 줄 · 처음 보는 음식 · 모르는 단위)은 pending → 「정리 대기」로 저장해 두고 AI(D4)가 채움
   숫자는 diet-calc 로만 계산한다. */
(function (root) {
  'use strict';
  var C = root.RT && root.RT.dietCalc ? root.RT.dietCalc : (typeof require === 'function' ? require('./diet-calc.js') : null);

  var LABELS = { '아침': 'meal', '점심': 'meal', '저녁': 'meal', '식사': 'meal', '브런치': 'meal', '간식': 'snack', '야식': 'snack' };
  var UNITS = ['조각', '공기', '그릇', '인분', '접시', '마리', '스쿱', '스푼', '큰술', '작은술', '꼬집', '줌', '장', '컵', '잔', '캔', '봉지', '팩', '줄', '알', '쪽', '개', 'kg', 'ml', 'g'];
  var KNUM = { '한': 1, '하나': 1, '두': 2, '둘': 2, '세': 3, '셋': 3, '네': 4, '넷': 4, '다섯': 5, '반': 0.5 };
  // 식품표(100g 기준)를 개수로 적었을 때 1개 무게 — 흔한 것만. 없으면 「모르는 단위」로 정리 대기
  var EACH_G = { '달걀': 50, '바나나': 120, '사과': 200, '귤': 80, '고구마': 130, '감자': 150, '토마토': 150, '키위': 90, '오렌지': 200, '복숭아': 200, '배': 400, '방울토마토': 15, '딸기': 15 };
  var SPOON_G = { '스푼': 10, '큰술': 10, '작은술': 5, '꼬집': 0.5, '컵': 200 };
  var DEFAULT_UNITS = { '공기': { g: 210, set: 'default' } }; // tests.md T1 시작 상태 (사용자가 정하면 그 값)
  var ALIAS = { '계란': '달걀', '밥': '쌀밥', '공기밥': '쌀밥', '흰밥': '쌀밥', '흰쌀밥': '쌀밥', '오뎅': '어묵', '오뎅국': '어묵국' };

  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

  /** 시각 꺼내기: "08:20" · "0820" · "1815" · "16시15분" · "9시" → "HH:MM" */
  function takeTime(s) {
    var m = /(^|[^\d])(\d{1,2}):(\d{2})(?!\d)/.exec(s) || /(^|[^\d.])(\d{2})(\d{2})(?![\d.])/.exec(s);
    if (m && +m[2] < 24 && +m[3] < 60) return { at: pad(m[2]) + ':' + m[3], rest: s.replace(m[0], m[1] + ' ') };
    var k = /(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*반)?/.exec(s);
    if (k && +k[1] < 24) return { at: pad(k[1]) + ':' + (k[2] ? pad(k[2]) : /반/.test(k[0]) ? '30' : '00'), rest: s.replace(k[0], ' ') };
    return null;
  }
  function pad(n) { return ('0' + (+n)).slice(-2); }

  /** "브라우니 3조각" · "바나나2개" · "밥 1.5공기" · "브라우니 9조각/16조각" · "사과 한 개" · "특 간계밥" */
  var NUM = '(\\d+(?:\\.\\d+)?|한|하나|두|둘|세|셋|네|넷|다섯|반)';
  var UNIT_RE = '(' + UNITS.join('|') + ')';
  function parseItem(raw) {
    var s = raw.replace(/^[\s\-·•*]+/, '').trim();
    var line = { raw: raw.trim(), name: s, amount: null, unit: null, portion: null, complex: false };
    if (!s) return null;
    if (/[:+()（）]|->|→/.test(s)) { line.complex = true; return line; } // 재료 · 기준을 함께 적은 줄 → AI
    var pm = new RegExp('^(.*?)\\s*' + NUM + '\\s*' + UNIT_RE + '\\s*/\\s*(\\d+)\\s*' + UNIT_RE + '?\\s*$').exec(s);
    if (pm) {
      var a = numOf(pm[2]);
      line.name = pm[1].trim(); line.amount = a; line.unit = pm[3]; line.portion = [a, +pm[4]];
      return line;
    }
    var m = new RegExp('^(.*?)\\s*' + NUM + '\\s*' + UNIT_RE + '\\s*$').exec(s);
    if (m && m[1].trim()) { line.name = m[1].trim(); line.amount = numOf(m[2]); line.unit = m[3]; return line; }
    var only = new RegExp('^(.*?)\\s*(\\d+(?:\\.\\d+)?)\\s*$').exec(s); // "사과 2"
    if (only && only[1].trim()) { line.name = only[1].trim(); line.amount = +only[2]; return line; }
    if (/\d/.test(s)) line.complex = true; // 숫자가 가운데 있는 문장 ("계란 3개 들어간 간계밥") → AI
    return line;
  }
  function numOf(x) { return KNUM[x] != null ? KNUM[x] : +x; }

  /** 적은 글 → 끼니 하나 (여러 끼니면 첫 끼니만 맞춰 보고 나머지 줄은 정리 대기) */
  function parse(text, nowAt) {
    var out = { date: null, at: null, kind: 'meal', label: null, lines: [] };
    String(text || '').split(/\r?\n/).forEach(function (row) {
      var s = row.trim(); if (!s) return;
      var d = /^(\d{1,2})\s*[.\/]\s*(\d{1,2})\s*\.?$/.exec(s);
      if (d) { out.date = [+d[1], +d[2]]; return; }
      var head = s, t = takeTime(head);
      if (t && !out.at) { out.at = t.at; head = t.rest; }
      var lab = /(아침|점심|저녁|식사|브런치|간식|야식)/.exec(head);
      if (lab && !out.label) {
        out.label = lab[1] === '식사' ? null : lab[1]; out.kind = LABELS[lab[1]];
        head = head.replace(lab[0], ' ');
      }
      head = head.replace(/^\s*(에|으로|로)?\s*(먹었|먹음)?[^가-힣a-z0-9]*[:：]?\s*/i, '').replace(/(에|으로)\s*(먹었어|먹었다|먹음)\s*$/, '').trim();
      if (!head || (t || lab) && /^(에|에는|은|는)$/.test(head)) return;
      head.split(/\s*\/\s*(?!\d)/).forEach(function (part) { var it = parseItem(part); if (it) out.lines.push(it); });
    });
    if (!out.at) out.at = nowAt || null;
    return out;
  }

  /** 식품표 한 번 정리: 이름 → 줄들 */
  function index(json) {
    if (!json || !json.items) return null;
    var by = {}, first = {};
    json.items.forEach(function (r) {
      var e = { name: r[0], kind: r[1], base: r[2], kcal: r[3], carb: r[4], protein: r[5], fat: r[6], serve: r[7] };
      var k = norm(r[0]); (by[k] = by[k] || []).push(e);
      var f = norm(r[0].split('_')[0]); (first[f] = first[f] || []).push(e);
    });
    return { by: by, first: first, size: json.items.length };
  }

  function pick(list) { // 같은 이름이면 g 기준 · 그다음 줄 하나
    if (!list || !list.length) return null;
    return list.filter(function (e) { return e.base === 'g'; })[0] || list[0];
  }
  /** 식품표에서 찾기: 이름 그대로 → 「이름_생것」 · 이름만 있는 줄 → 없으면 null (여러 갈래면 AI 에 맡김) */
  function findTable(tab, name) {
    if (!tab) return null;
    var q = norm(ALIAS[name.trim()] || name);
    var hit = pick(tab.by[q]);
    if (hit) return hit;
    var fam = tab.first[q] || [];
    var raw = fam.filter(function (e) { return e.kind === 'r' && /_생것$/.test(e.name) && e.name.split('_').length === 2; });
    if (raw.length) return pick(raw);
    return null;
  }

  function findRecipe(recipes, name) {
    var q = norm(name); if (q.length < 2) return null;
    var hits = (recipes || []).filter(function (r) { var k = norm(r.recipe); return k === q || k.indexOf(q) >= 0 || q.indexOf(k) >= 0; });
    var exact = hits.filter(function (r) { return norm(r.recipe) === q; });
    return exact[0] || (hits.length === 1 ? hits[0] : null); // 여러 개가 겹치면 고르지 않음
  }
  function findFood(foods, name) {
    var q = norm(name); if (!foods || q.length < 2) return null;
    var keys = Object.keys(foods);
    var ex = keys.filter(function (k) { return norm(k) === q || (foods[k].aliases || []).some(function (a) { return norm(a) === q; }); });
    if (ex.length) return ex[0];
    var part = keys.filter(function (k) { return norm(k).indexOf(q) >= 0; });
    return part.length === 1 ? part[0] : null;
  }

  /** 줄 하나 → 계산할 항목 (못 하면 이유) */
  function matchLine(line, ctx, foodsMap) {
    if (line.complex) return { reason: 'complex' };
    var r = findRecipe(ctx.recipes, line.name);
    if (r) {
      var serv = r.servings || 1, por;
      if (line.portion) por = line.portion;
      else if (line.amount != null && (line.unit === '조각' || line.unit === '인분' || line.unit === '개' || !line.unit) && serv > 1) por = [line.amount, serv];
      else if (line.amount != null && (line.unit === '인분' || !line.unit)) por = [line.amount * serv, serv];
      else if (line.amount == null) por = [serv, serv];
      else return { reason: 'unit' };
      return { ref: { kind: 'recipe', key: r.recipe }, calc: { recipeRef: r.recipe, portion: por } };
    }
    var fk = findFood(ctx.foods, line.name);
    if (fk) {
      var f = ctx.foods[fk];
      if (f.type === 'supplement') return { ref: { kind: 'supplement', key: fk }, calc: { food: fk, qty: line.amount == null ? 1 : line.amount } };
      if (line.unit === 'g' || line.unit === 'ml' || line.unit === 'kg') {
        var g = line.unit === 'kg' ? line.amount * 1000 : line.amount;
        if (!f.unitG) return { reason: 'unit' };
        return { ref: { kind: 'food', key: fk }, calc: { food: fk, grams: g } };
      }
      var fu = f.foodUnits && line.unit && f.foodUnits[line.unit];
      if (fu && f.unitG) return { ref: { kind: 'food', key: fk }, calc: { food: fk, grams: fu * (line.amount == null ? 1 : line.amount) } };
      if (line.unit && line.unit !== f.unit) return { reason: 'unit' };
      return { ref: { kind: 'food', key: fk }, calc: { food: fk, qty: line.amount == null ? 1 : line.amount } };
    }
    var e = findTable(ctx.table, line.name);
    if (!e) return { reason: 'unknown' };
    var grams = gramsFor(e, line, ctx.units);
    if (grams == null) return { reason: 'unit', table: e.name };
    var key = 'kr:' + e.name + ':' + e.base;
    foodsMap[key] = { unit: '100' + e.base, unitG: 100, kcal: e.kcal, carb: e.carb, protein: e.protein, fat: e.fat };
    var dflt = line.unit && !(ctx.units && ctx.units[line.unit]) && DEFAULT_UNITS[line.unit] ? line.unit : null;
    return { ref: { kind: 'table', key: e.name }, calc: { food: key, grams: grams }, grams: grams, defaultUnit: dflt };
  }
  function gramsFor(e, line, units) {
    var a = line.amount == null ? 1 : line.amount, u = line.unit;
    if (u === 'g' || u === 'ml') return a;
    if (u === 'kg') return a * 1000;
    var mu = u && ((units && units[u]) || DEFAULT_UNITS[u]);
    if (mu && (mu.g || mu.ml)) return a * (mu.g || mu.ml);
    if (SPOON_G[u]) return a * SPOON_G[u];
    if (e.kind === 'd' && e.serve && (!u || u === '그릇' || u === '인분' || u === '접시')) return a * e.serve;
    var each = EACH_G[e.name.split('_')[0]];
    if (each && (!u || u === '개' || u === '알')) return a * each;
    return null;
  }

  function match(parsed, ctx) {
    ctx = ctx || {};
    var foodsMap = Object.assign({}, ctx.foods || {});
    var items = [], pending = [];
    (parsed.lines || []).forEach(function (line) {
      var m = matchLine(line, ctx, foodsMap);
      if (!m.calc) { pending.push({ raw: line.raw, name: line.name, reason: m.reason }); return; }
      var total;
      try { total = C.itemTotal(foodsMap, ctx.recipes || [], m.calc); } catch (err) { pending.push({ raw: line.raw, name: line.name, reason: 'calc' }); return; }
      items.push({ raw: line.raw, name: line.name, amount: line.amount, unit: line.unit, ref: m.ref, calc: m.calc, total: total, defaultUnit: m.defaultUnit || null });
    });
    var sum = { kcal: 0, carb: 0, protein: 0, fat: 0 };
    items.forEach(function (it) { C.KEYS.forEach(function (k) { sum[k] += it.total[k]; }); });
    return { at: parsed.at, kind: parsed.kind, label: parsed.label, items: items, pending: pending, total: sum, foods: foodsMap };
  }

  var api = { DEFAULT_UNITS: DEFAULT_UNITS, parse: parse, parseItem: parseItem, takeTime: takeTime, index: index, findTable: findTable, match: match, EACH_G: EACH_G, ALIAS: ALIAS };
  root.RT = root.RT || {};
  root.RT.dietMatch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
