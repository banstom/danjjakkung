/* 단짝 식탁 · AI 정리 결과 → 앱 계산 (D4 연결). AI(parseMeal)는 구조 · 짝짓기 · 모르는 것을 내고, 숫자는 여기서 식품표 · 내 식품으로 계산한다.
   식품표 · 내 식품에 없을 때만 AI 의 nutrition(사용자가 알려 준 값 · AI 추정)을 쓴다 (11-19 원칙 바꿈 — 「AI 추정」으로 표시)
   - fromAi(result, ctx) → { meals: [{ at, kind, label, items, pending, total }], questions: [{ path, what, label, ask }] }
   - stateText(ctx)      → AI 에 보내는 「상태」 글 (저장된 레시피 · 내 식품 · 내 단위 — 몸 정보 · 목표는 넣지 않는다)
   - tableLine(text, tab, answers) → AI 에 보내는 「식품표」 줄 (적은 이름 → 후보들)
   ctx = { table: diet-match index, units: { 공기: { g } }, foods: { 이름: 내 식품(1단위 값) }, recipes, text: 적은 글 · 답(g 을 사용자가 적었는지 보려고) } */
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
    // 양은 앱이 단위로 계산. 단위로 못 할 때만 AI 가 읽은 g 을 쓰고 「추정」으로 (점검 AI)
    var g = M.gramsFor(e, { amount: it.amount, unit: it.unit }, ctx.units || {});
    var said = it.grams > 0 && ctx.text != null && new RegExp('(^|[^\\d.])' + String(it.grams).replace('.', '\\.') + '\\s*(g|그램|ml)').test(ctx.text);
    if (!g && it.grams > 0) g = { g: it.grams, est: (said ? '적은 양 ' : 'AI 추정 양 ') + Math.round(it.grams) + 'g', ai: !said }; // 글에 없는 g 은 AI 가 어림한 것
    if (!g || !(g.g > 0) || g.g > 3000) return null;
    var t = addTo(zero(), e, g.g / 100);
    return { total: t, grams: g.g, est: g.est || null, ai: !!g.ai, dflt: g.dflt || null, ref: { kind: 'table', key: e.name, base: e.base, dish: e.kind === 'd' } };
  }

  var NAMES = { kcal: '열량', carb: '탄수', protein: '단백질', fat: '지방' };
  function same(a, b) { return String(a || '').replace(/\s+/g, '') === String(b || '').replace(/\s+/g, ''); }
  /** AI 가 낸 영양 숫자(nutrition)로 계산 — 식품표 · 내 식품에 없을 때만. 단위가 안 맞으면 null (정리 대기) */
  function nutItem(it, ctx) {
    var n = it.nutrition; if (!n || !(n.kcal >= 0)) return null;
    var per = n.amount > 0 ? n.amount : 1, a = it.amount == null ? 1 : it.amount, k = null;
    // k = nutrition 값에 곱할 몫. n.grams = amount unit 만큼의 무게 (점검 AI: per 를 또 곱해 2배로 됨)
    var gu = it.unit === 'g' || it.unit === 'ml';
    if (gu && same(n.unit, it.unit)) k = a / per;
    else if (gu && n.grams > 0) k = a / n.grams;
    else if (!n.unit || !it.unit || same(n.unit, it.unit)) k = a / per;
    else if (it.grams > 0 && n.grams > 0) k = it.grams / n.grams;
    if (!(k > 0 && k <= 50)) return null;
    var t = zero(); KEYS.forEach(function (x) { t[x] = (n[x] || 0) * k; });
    if (t.kcal > 5000) return null;
    var user = (n.user || []).filter(function (x) { return NAMES[x]; }), guess = KEYS.filter(function (x) { return user.indexOf(x) < 0; });
    var est = !user.length ? 'AI 추정' : guess.length ? '알려 준 값: ' + user.map(function (x) { return NAMES[x]; }).join(' · ') + ' · 나머지는 AI 추정' : null;
    return { total: t, grams: it.grams > 0 ? it.grams : n.grams > 0 ? n.grams * k : null, est: est, ai: !!guess.length,
      ref: { kind: user.length ? 'user' : 'est', key: it.name }, nut: n };
  }
  /** 내 식품(foods)으로 계산 — 이름이 같을 때만 (AI 가 food 로 짝짓거나, 같은 이름의 제품으로 냈을 때) */
  function foodItem(it, ctx) {
    var foods = ctx.foods || {}, key = it.match && it.match.key, fk = null;
    [key, it.name].forEach(function (x) { if (!fk && x && M.findFood) { var f = M.findFood(foods, x); if (f && (same(f, x) || (it.match && it.match.kind === 'food'))) fk = f; } });
    if (!fk) return null;
    var f = foods[fk], a = it.amount == null ? 1 : it.amount, k = null;
    if ((it.unit === 'g' || it.unit === 'ml') && f.unitG) k = a / f.unitG;
    else if (!it.unit || same(it.unit, f.unit)) k = a;
    else if (it.grams > 0 && f.unitG) k = it.grams / f.unitG;
    if (!(k > 0 && k <= 50)) return null;
    var t = zero(); KEYS.forEach(function (x) { t[x] = (f[x] || 0) * k; });
    var guess = f.src === 'user' ? KEYS.filter(function (x) { return (f.user || []).indexOf(x) < 0; }) : [];
    return { total: t, grams: f.unitG ? f.unitG * k : null, est: guess.length ? '내 식품 · 일부 AI 추정' : null, ai: !!guess.length, ref: { kind: 'food', key: fk } };
  }

  function convert(it, ctx) {
    var kind = it.match && it.match.kind;
    var out = { raw: it.name, name: it.name, amount: it.amount == null ? null : it.amount, unit: it.unit || null };
    var told = it.nutrition && it.nutrition.user && it.nutrition.user.length; // 이번에 새로 알려 준 숫자가 있으면 그게 먼저 (내 식품 고치기)
    var mine = kind !== 'table' && kind !== 'new_recipe' && !told ? foodItem(it, ctx) : null; // 내 식품이 먼저 (알려 준 값 · 고른 제품 — 다시 묻지 않게)
    if (mine) return Object.assign(out, { ref: mine.ref, calc: { grams: mine.grams }, total: mine.total, est: mine.est, ai: mine.ai });
    if (kind === 'supplement' && !(it.nutrition && it.nutrition.user && it.nutrition.user.length) && !M.findTable(ctx.table, (it.match && it.match.key) || it.name)) return Object.assign(out, { ref: { kind: 'supplement', key: (it.match && it.match.key) || it.name }, calc: {}, total: zero(), est: null });
    if (kind === 'new_recipe' || (it.ingredients && it.ingredients.length && kind !== 'table')) {
      var sum = zero(), miss = [], ests = [], aiIng = [];
      (it.ingredients || []).forEach(function (x) {
        var r = tableItem(x, ctx) || foodItem(x, ctx) || nutItem(x, ctx);
        if (!r) miss.push(x.name); else { addTo(sum, r.total); if (r.est) ests.push(x.name); if (r.ai) aiIng.push(x.name); }
      });
      if (!it.ingredients || !it.ingredients.length || miss.length) return { pending: { raw: it.name + (miss.length ? ' (' + miss.join(' · ') + ')' : ''), name: it.name, reason: miss.length ? 'ingredient' : 'recipe' } };
      var p = it.portion && it.portion.den ? it.portion.num / it.portion.den : 1;
      if (!(p > 0 && p <= 4) || (it.portion && it.portion.den > 100) || sum.kcal * p > 5000) return { pending: { raw: it.name, name: it.name, reason: 'amount' } }; // 몫 · 합계가 터무니없으면 계산 안 함
      return Object.assign(out, { ref: { kind: 'new_recipe', key: it.name }, calc: { portion: it.portion ? [it.portion.num, it.portion.den] : null }, total: addTo(zero(), sum, p),
        est: ests.length ? (aiIng.length ? 'AI 추정 재료: ' + aiIng.join(' · ') + (ests.length > aiIng.length ? ' · ' : '') : '') + (ests.length > aiIng.length ? '어림한 재료: ' + ests.filter(function (x) { return aiIng.indexOf(x) < 0; }).join(' · ') : '') : null, ai: !!aiIng.length, ingredients: (it.ingredients || []).map(function (x) { return x.name; }) });
    }
    if (kind === 'table' || !kind || kind === 'supplement') { // 보충제로 붙었어도 식품표 음식이면 계산
      var r = tableItem(it, ctx);
      if (!r) { var nu = nutItem(it, ctx); if (nu) return Object.assign(out, { ref: nu.ref, calc: { grams: nu.grams }, total: nu.total, est: nu.est, ai: nu.ai, nut: nu.nut }); }
      if (!r) return { pending: { raw: it.name + (it.amount != null ? ' ' + it.amount + (it.unit || '') : ''), name: it.name, reason: 'unknown' } };
      // 함께 넣은 재료(스크램블 기름 등)
      var extra = [], lost = [];
      (it.ingredients || []).forEach(function (x) { var rx = tableItem(x, ctx) || foodItem(x, ctx) || nutItem(x, ctx); if (rx) { addTo(r.total, rx.total); extra.push(x.name + (rx.ai ? '(AI 추정)' : '')); } else lost.push(x.name); });
      var est = [r.est, lost.length ? '빠진 재료: ' + lost.join(' · ') : ''].filter(Boolean).join(' · ') || null; // 못 찾은 재료는 조용히 빼지 않고 알림
      return Object.assign(out, { ref: r.ref, calc: { grams: r.grams }, total: r.total, est: est, ai: r.ai, defaultUnit: r.dflt, extras: extra });
    }
    // 처음 보는 제품 · 저장 안 된 레시피: 식품표에 있으면 식품표, 없으면 AI 가 낸 숫자(알려 준 값 · 추정), 그것도 없으면 정리 대기
    var rt = tableItem(it, ctx);
    if (rt && kind !== 'new_product') return Object.assign(out, { ref: rt.ref, calc: { grams: rt.grams }, total: rt.total, est: rt.est, ai: rt.ai, defaultUnit: rt.dflt, extras: [] });
    var nx = nutItem(it, ctx);
    if (nx) return Object.assign(out, { ref: nx.ref, calc: { grams: nx.grams }, total: nx.total, est: nx.est, ai: nx.ai, nut: nx.nut });
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
    // 앱이 이미 아는 것은 묻지 않는다 (사용자: 「멸치볶음 기름을 썼나요」는 왜 묻냐) — 식품표의 음식(반찬 · 요리)은 기름 · 양념이 이미 들어 있고, 계산된 항목의 양도 다시 묻지 않음
    var known = {};
    meals.forEach(function (m) { m.items.forEach(function (i) { known[i.name] = i; }); });
    var unk = ((res && res.unknowns) || []).filter(function (u) {
      var seg = String(u.path || '').split('/').filter(Boolean), it = known[seg[seg.length - 1]] || known[seg[1]];
      if (!it || seg.length > 2 && !known[seg[seg.length - 1]]) return true; // 레시피 재료 등은 그대로
      if (/oil|기름/.test(String(u.what)) && it.ref && it.ref.dish) return false;
      // 열량을 알려 준 것 · 내 식품은 다시 안 물음 (사용자: 「21g 이라고 알려 줘도 물어봄」). 단백질만 알려 줬으면 제품 질문은 남김
      if (it.ref && ((it.ref.kind === 'user' && it.nut && (it.nut.user || []).indexOf('kcal') >= 0) || it.ref.kind === 'food') && u.what !== 'amount') return false;
      if (u.what === 'amount' && it.amount != null) return false;
      if (u.what === 'unit_size' && it.ref && it.ref.kind === 'table' && !it.defaultUnit) return false;
      return true;
    });
    return { meals: meals, questions: A.pick(unk).map(question) };
  }

  /** AI 에 보내는 상태 — 저장된 레시피는 아직 없음(D6). 내 식품은 이름 · 단위만 (숫자는 앱이 가짐) */
  function stateText(ctx) {
    var u = ctx && ctx.units ? Object.keys(ctx.units).map(function (k) { return k + ' ' + ctx.units[k].g + 'g(사용자가 정함)'; }) : [];
    var f = ctx && ctx.foods ? Object.keys(ctx.foods).slice(0, 60).map(function (k) { var x = ctx.foods[k]; return k + '(1' + x.unit + (x.unitG ? ' = ' + x.unitG + 'g' : '') + ')'; }) : [];
    return '저장된 레시피 없음. 내 식품: ' + (f.length ? f.join(', ') : '없음') + '. 내 단위: ' + (u.length ? u.join(', ') : '모두 기본값 (공기 210g 등)') + '.';
  }

  /** 「식품표」 줄: 적은 음식 이름마다 식약처 식품표 후보 (AI 가 정확한 이름을 고르게 — 사용자: 「군밤도 몰라」).
      앱이 이미 맞춘 이름은 그 하나만, 내 식품 이름은 빼고. 답(정정)에 나온 이름도 */
  function tableLine(text, tab, answers, foods) {
    if (!tab || !M.candidates) return '';
    var names = [];
    var take = function (s) {
      String(s || '').split(/\r?\n/).forEach(function (row) {
        var p = M.parse(row, '00:00');
        (p.lines || []).forEach(function (ln) {
          var UNIT = '개|g|ml|kg|인분|그릇|공기|봉지|스쿱|스푼|조각|장|컵|잔|줌|꼬집|큰술|작은술|마리|접시|팩|캔|병|봉|알';
          var body = ln.raw.split(/->|→/)[0].replace(new RegExp('\\d+(?:[./]\\d+)?\\s*(' + UNIT + ')?', 'g'), function (m, u, at, all) {
            var prev = all.charAt(at - 1); // 「비타500」처럼 이름에 붙은 숫자는 남김 (앞이 글자이고 단위가 없을 때)
            return !u && prev && /[가-힣a-zA-Z]/.test(prev) ? m : '|';
          });
          var parts = body.split(/[|:+()（）,]|들어간|넣은/); // 수량 · 재료 기호로 나눠 이름만
          parts.forEach(function (x) {
            var nm = x.replace(/^[\s\-·•*/]+/, '').replace(/\s*(한|두|세|네|반)\s*(개|줌|꼬집|스푼|공기|그릇|봉지|봉|병|컵|잔|조각|스쿱)\s*$/, '').trim();
            nm = nm.replace(/(^|\s)(약간|조금|많이|살짝|반쯤|대충|정도|쯤)(?=\s|$)/g, ' ').replace(/(이야|이에요|예요|이요|야|요|임)$/, '').trim(); // 「김치 약간」 → 김치
            if (/(^|에\s*|\s)(단백질|탄수화물?|지방|칼로리|열량|kcal|기준)(\s|$)/i.test(nm) || /^(단백질|탄수|지방|칼로리|열량|kcal)/i.test(nm)) return; // 「1스쿱에 단백질 21g」 같은 설명 토막 (저지방우유는 남김)
            if (nm.length >= 1 && nm.length <= 30 && names.indexOf(nm) < 0) names.push(nm);
          });
        });
      });
    };
    take(text); (answers || []).forEach(function (a) { take(a.answer); });
    var out = [];
    names.slice(0, 30).forEach(function (nm) {
      if (foods && M.findFood && M.findFood(foods, nm)) return;
      var hit = M.findTable(tab, nm), sq = function (x) { return String(x).replace(/\s+/g, ''); };
      if (hit && (sq(hit.name) === sq(nm) || sq(hit.name) === sq(nm) + '_생것' || M.ALIAS[nm])) { out.push(nm + ' = ' + hit.name); return; } // 앱이 맞춘 것
      var c = M.candidates(tab, nm, hit ? 4 : 6);
      out.push(nm + ' → ' + (c.length ? c.join(' | ') : '(후보 없음)'));
    });
    var line = '';
    for (var i = 0; i < out.length; i++) { if ((line + '; ' + out[i]).length > 3900) break; line += (line ? '; ' : '') + out[i]; }
    return line;
  }

  var api = { fromAi: fromAi, convert: convert, question: question, stateText: stateText, tableLine: tableLine, nutItem: nutItem };
  root.RT = root.RT || {};
  root.RT.dietAi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
