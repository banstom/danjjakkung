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
  var UNIT_RE = '(' + UNITS.join('|') + '|원|칼로리|kcal)';
  var KNUM = { '한': 1, '하나': 1, '두': 2, '둘': 2, '세': 3, '셋': 3, '네': 4, '넷': 4, '다섯': 5, '반': 0.5 };
  // 식품표(100g 기준)를 개수로 적었을 때 1개 무게 — 흔한 것만. 없으면 「모르는 단위」로 정리 대기
  var EACH_G = { '달걀': 50, '바나나': 120, '사과': 200, '귤': 80, '고구마': 130, '감자': 150, '토마토': 150, '키위': 90, '오렌지': 200, '복숭아': 200, '배': 400, '방울토마토': 15, '딸기': 15 }; // 식품표 이름의 어느 토막이든 (토마토_방울토마토_생것)
  var SPOON_G = { '스푼': 10, '큰술': 10, '작은술': 5, '꼬집': 0.5, '컵': 200 };
  var DEFAULT_UNITS = { '공기': { g: 210, set: 'default' } }; // tests.md T1 시작 상태 (사용자가 정하면 그 값)
  // 흔히 부르는 이름 → 식품표 이름 (사용자: 「햇반 어떤 음식이에요?」 같은 질문은 하지 말 것)
  var ALIAS = { '계란': '달걀', '밥': '쌀밥', '공기밥': '쌀밥', '흰밥': '쌀밥', '흰쌀밥': '쌀밥', '햇반': '쌀밥', '즉석밥': '쌀밥', '오뎅': '어묵', '오뎅국': '어묵국',
    '김치': '배추김치', '삶은계란': '달걀_삶은것', '삶은달걀': '달걀_삶은것', '구운계란': '달걀_삶은것', '계란후라이': '달걀후라이', '계란프라이': '달걀후라이', '달걀프라이': '달걀후라이',
    '닭가슴살': '닭고기_가슴(껍질 제거)_삶은것', '아메리카노': '커피_아메리카노', '커피': '커피_아메리카노', '치킨': '닭튀김_간편조리세트_후라이드치킨', '후라이드치킨': '닭튀김_간편조리세트_후라이드치킨',
    '닭국': '닭곰탕', '닭백숙': '닭백숙', '계란국': '달걀국', '쇠고기무국': '소고기 무국', '소고기무국': '소고기 무국', '북엇국': '무 북어국', '북어국': '무 북어국', '만둣국': '만두국', '떡만둣국': '떡만두국',
    '김': '김구이_조미김', '조미김': '김구이_조미김', '구운김': '김구이_조미김', '김자반': '김구이_조미김' };
  // 식품표 이름으로 정한 1개 무게 (제품 · 포장 단위)
  var EACH_BY_NAME = { '쌀밥': 210, '닭고기_가슴(껍질 제거)_삶은것': 100, '우유': 200, '김구이_조미김': 5 }; // 조미김 1봉 ≈ 5g
  var SHEET_G = { '김구이_조미김': 2 }; // 김 1장

  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

  /** 시각 꺼내기: "08:20" · "0820" · "1815" · "16시15분" · "9시" → "HH:MM" */
  function takeTime(s) {
    // 4자리는 시각일 수도 양일 수도 — 바로 뒤에 단위가 붙으면 양 ("닭가슴살 1000g", 점검 AI)
    var m = /(^|[^\d])(\d{1,2}):(\d{2})(?!\d)/.exec(s) || new RegExp('(^|[^\\d./])(\\d{2})(\\d{2})(?![\\d./]|\\s*' + UNIT_RE + ')').exec(s);
    if (m && +m[2] < 24 && +m[3] < 60) return { at: pad(m[2]) + ':' + m[3], rest: s.replace(m[0], m[1] + ' ') };
    var k = /(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*반)?/.exec(s);
    if (k && +k[1] < 24) return { at: pad(k[1]) + ':' + (k[2] ? pad(k[2]) : /반/.test(k[0]) ? '30' : '00'), rest: s.replace(k[0], ' ') };
    return null;
  }
  function pad(n) { return ('0' + (+n)).slice(-2); }

  /** "브라우니 3조각" · "바나나2개" · "밥 1.5공기" · "브라우니 9조각/16조각" · "사과 한 개" · "특 간계밥" */
  var NUM = '(\\d+/\\d+|\\d+(?:\\.\\d+)?|한|하나|두|둘|세|셋|네|넷|다섯|반)';
  var ITEM_UNIT = '(' + UNITS.join('|') + ')';
  function parseItem(raw) {
    var s = raw.replace(/^[\s\-·•*]+/, '').trim();
    var line = { raw: s, name: s, amount: null, unit: null, portion: null, complex: false };
    if (!s) return null;
    if (/[:+()（）]|->|→/.test(s)) { line.complex = true; return line; } // 재료 · 기준을 함께 적은 줄 → AI
    var pm = new RegExp('^(.*?)\\s*' + NUM + '\\s*' + ITEM_UNIT + '\\s*/\\s*(\\d+)\\s*' + ITEM_UNIT + '?\\s*$').exec(s);
    if (pm) {
      var a = numOf(pm[2]);
      line.name = pm[1].trim(); line.amount = a; line.unit = pm[3]; line.portion = [a, +pm[4]];
      return line;
    }
    var m = new RegExp('^(.*?)\\s*' + NUM + '\\s*' + ITEM_UNIT + '\\s*$').exec(s);
    if (m && m[1].trim()) { line.name = m[1].trim(); line.amount = numOf(m[2]); line.unit = m[3]; return line; }
    var only = new RegExp('^(.*?)\\s*(\\d+(?:\\.\\d+)?)\\s*$').exec(s); // "사과 2"
    if (only && only[1].trim()) { line.name = only[1].trim(); line.amount = +only[2]; return line; }
    if (/\d/.test(s)) line.complex = true; // 숫자가 가운데 있는 문장 ("계란 3개 들어간 간계밥") → AI
    return line;
  }
  function numOf(x) { if (KNUM[x] != null) return KNUM[x]; var f = /^(\d+)\/(\d+)$/.exec(x); return f ? (+f[2] ? +f[1] / +f[2] : NaN) : +x; }

  /** 적은 글 → 끼니 하나. 날짜 줄("11.17." · "2026.11.17")은 date 로, 두 번째 끼니가 보이면 more 에 개수 (앱이 「한 끼씩」 안내) */
  function parse(text, nowAt) {
    var out = { date: null, at: null, kind: 'meal', label: null, lines: [], more: 0 };
    var started = false, headed = false; // headed = 이 끼니의 시각 · 끼니 이름을 이미 적음
    String(text || '').split(/\r?\n/).forEach(function (row) {
      var s = row.trim(); if (!s) return;
      var d = /^(?:(\d{4})\s*[.\/-]\s*)?(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*\.?$/.exec(s);
      if (d && (d[1] || /\.$/.test(s) || /[\/-]/.test(s)) && +d[2] >= 1 && +d[2] <= 12 && +d[3] >= 1 && +d[3] <= 31) { out.date = [d[1] ? +d[1] : null, +d[2], +d[3]]; return; }
      var head = s, t = takeTime(head), lab = null;
      var lm = /(아침|점심|저녁|식사|브런치|간식|야식)/.exec(t ? t.rest : head);
      if ((t || lm) && started && headed && (t ? t.at !== out.at : true) && (t || (lm && /^\s*[-·•*]?\s*(아침|점심|저녁|식사|브런치|간식|야식)\s*[:：]?\s*$/.test(head)))) { out.more++; return; } // 두 번째 끼니
      if (out.more) return;
      if (t && !out.at) { out.at = t.at; head = t.rest; headed = true; }
      if (lm && !out.label && out.kind === 'meal' && (t || /^\s*(아침|점심|저녁|식사|브런치|간식|야식)/.test(head) || /(간식|야식)으로/.test(head))) {
        lab = lm[1]; out.label = lab === '식사' ? null : lab; out.kind = LABELS[lab]; headed = true;
        head = head.replace(lm[0], ' ');
      }
      if (t || lab) head = head.replace(/^\s*(에|에는|으로|로)?\s*[:：]?\s*/, '').replace(/\s*(에|으로)\s*(먹었어|먹었다|먹음)?\s*$/, '').replace(/^\s*[:：]\s*/, '').trim(); // 「2230에 식사:」 의 남은 토막만 (이름 앞 글자는 안 건드림 — 로제떡볶이)
      head = head.replace(/\s*(간식|야식)?(으로)?\s*(먹었어|먹었다|먹음)\s*$/, '').trim();
      if (!head) return;
      head.split(/\s*\/\s*(?!\d)/).forEach(function (part) { var it = parseItem(part); if (it) { out.lines.push(it); started = true; } });
    });
    if (!out.at) out.at = nowAt || null;
    return out;
  }

  /** 식품표 한 번 정리: 이름 → 줄들 */
  function index(json) {
    if (!json || !json.items) return null;
    var by = {}, first = {}, seg = {};
    json.items.forEach(function (r) {
      var e = { name: r[0], kind: r[1], base: r[2], kcal: r[3], carb: r[4], protein: r[5], fat: r[6], serve: r[7] };
      var k = norm(r[0]); (by[k] = by[k] || []).push(e);
      var f = norm(r[0].split('_')[0]); (first[f] = first[f] || []).push(e);
      if (r[1] === 'r' && /_생것$/.test(r[0])) r[0].split('_').slice(1, -1).forEach(function (x) { var k2 = norm(x); (seg[k2] = seg[k2] || []).push(e); }); // 「토마토_방울토마토_생것」 → 방울토마토
    });
    return { by: by, first: first, seg: seg, size: json.items.length };
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
    // 「된장국」처럼 이름 뒤에 _재료가 붙은 것만 있으면 가장 기본에 가까운 것(토막이 적고 g 기준)으로 — 사용자: 흔한 음식을 못 알아보면 안 됨
    var fam2 = (tab.first[q] || []).filter(function (e) { return e.kind === 'd'; });
    if (fam2.length) return fam2.slice().sort(function (x, y) { return x.name.split('_').length - y.name.split('_').length || (x.base === 'g' ? 0 : 1) - (y.base === 'g' ? 0 : 1) || x.name.length - y.name.length; })[0];
    var sg = (tab.seg && tab.seg[q]) || [];
    if (sg.length === 1 || (sg.length > 1 && sg.every(function (e) { return e.name.split('_')[0] === sg[0].name.split('_')[0]; }) && sg.filter(function (e) { return e.name.split('_').length === 3; }).length === 1))
      return sg.length === 1 ? sg[0] : sg.filter(function (e) { return e.name.split('_').length === 3; })[0];
    return null;
  }

  /** 식품표 후보 (AI 에 보내 고르게 함 — 사용자: 「군밤도 몰라」). 같은 이름 · 끝 글자가 이름(군밤 → 밤) · 앞부분 · 토막 순.
      n 개까지 { name } 의 이름 배열 */
  function candidates(tab, name, n) {
    if (!tab || !tab.by) return [];
    var raw = String(name || '').replace(/\(.*?\)|[0-9.]+\s*(개|g|ml|인분|그릇|공기|봉지|스쿱|조각)?/g, ' ').trim();
    var q = norm(ALIAS[raw] || raw); if (!q) return [];
    var mk = q + '|' + (n || 6); tab._cmemo = tab._cmemo || {}; if (tab._cmemo[mk]) return tab._cmemo[mk].slice();
    if (!tab._rows) { // 한 번만: 이름 토막을 미리 (점검 AI: 이름마다 2만 줄을 다시 쪼개 휴대폰에서 멈춤)
      var rs = {}; tab._rows = [];
      Object.keys(tab.by).forEach(function (k) { tab.by[k].forEach(function (e) { if (!rs[e.name]) { rs[e.name] = 1; tab._rows.push({ e: e, segs: e.name.split('_').map(norm), full: norm(e.name), odd: /[()\s]/.test(e.name) }); } }); });
    }
    var hit = findTable(tab, raw), out = [];
    tab._rows.forEach(function (row) {
      {
        var e = row.e, segs = row.segs, f = segs[0], sc = 0;
        if (f === q) sc = 100;
        else if (q.length > f.length && q.slice(-f.length) === f && (f.length >= 2 || q.length <= 3)) sc = 70; // 군밤 → 밤 · 찹쌀떡 → 떡
        else if (f.indexOf(q) === 0) sc = 60;
        else if (q.length >= 2 && (f.indexOf(q) >= 0 || (f.length >= 2 && q.indexOf(f) >= 0))) sc = 50;
        else if (q.length >= 2 && segs.slice(1).some(function (x) { return x === q || (x.length >= 2 && (x.indexOf(q) >= 0 || q.indexOf(x) >= 0)); })) sc = 45;
        if (!sc) return;
        if (segs.slice(1).some(function (x) { return x === q || (q.length >= 2 && x.indexOf(q) >= 0); })) sc += 8; // 떡_찹쌀떡
        if (/(구운|볶은|삶은|찐)것$/.test(e.name) && /^(군|구운)/.test(q) && /구운것$/.test(e.name)) sc += 10; // 군밤 → 구운것
        if (row.full === q) sc += 30;
        if (row.odd) sc -= 3; // 가게 · 제품 이름이 붙은 줄은 뒤로
        out.push({ e: e, sc: sc - segs.length - e.name.length / 100 - (e.kind === 'd' && e.base === 'ml' ? 2 : 0) });
      }
    });
    out.sort(function (a, b) { return b.sc - a.sc; });
    var names = out.slice(0, n || 6).map(function (x) { return x.e.name; });
    if (hit && names.indexOf(hit.name) < 0) names.unshift(hit.name);
    tab._cmemo[mk] = names.slice(0, n || 6);
    return tab._cmemo[mk].slice();
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
    // 일부만 적었을 때: 3글자 이상이고, 이름의 앞부분이거나 절반 이상일 때만 (점검 AI: 「우유」가 내 식품 「매일 저지방우유」로, 「프로틴」이 「임팩트웨이프로틴」으로 잡힘)
    var part = keys.filter(function (k) { var n = norm(k); return q.length >= 3 && (n.indexOf(q) === 0 || (q.length * 2 >= n.length && n.indexOf(q) >= 0)); });
    return part.length === 1 ? part[0] : null;
  }

  /** 줄 하나 → 계산할 항목 (못 하면 이유) */
  function matchLine(line, ctx, foodsMap) {
    if (line.complex) return { reason: 'complex' };
    if (line.amount != null && !(line.amount > 0 && line.amount <= (line.unit === 'g' || line.unit === 'ml' ? 5000 : line.unit === 'kg' ? 5 : 100))) return { reason: 'amount' }; // 0 · 99999개 같은 건 계산 안 함
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
      var f = ctx.foods[fk], part = f.src === 'user' && ['kcal', 'carb', 'protein', 'fat'].some(function (k) { return (f.user || []).indexOf(k) < 0; });
      var r0 = matchFood(line, f, fk);
      if (r0.calc && part) { r0.est = '내 식품 · 일부 AI 추정'; r0.ai = true; } // 알려 준 칸 말고는 처음에 AI 가 추정한 값
      return r0;
    }
    return matchTable(line, ctx, foodsMap);
  }
  function matchFood(line, f, fk) {
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
  function matchTable(line, ctx, foodsMap) {
    var e = findTable(ctx.table, line.name);
    if (!e) return { reason: 'unknown' };
    var gq = gramsFor(e, line, ctx.units);
    if (gq == null) return { reason: 'unit', table: e.name };
    var key = 'kr:' + e.name + ':' + e.base;
    foodsMap[key] = { unit: '100' + e.base, unitG: 100, kcal: e.kcal, carb: e.carb, protein: e.protein, fat: e.fat };
    return { ref: { kind: 'table', key: e.name, base: e.base }, calc: { food: key, grams: gq.g }, grams: gq.g, est: gq.est || null, defaultUnit: gq.dflt || null };
  }
  /** 식품표 줄의 양 → g(ml 기준 줄이면 ml). est = 기본값 · 1인분 · 숟가락처럼 어림한 양 */
  function gramsFor(e, line, units) {
    var a = line.amount == null ? 1 : line.amount, u = line.unit;
    if (u === 'g' || u === 'ml') return { g: a };
    if (u === 'kg') return { g: a * 1000 };
    var mine = u && units && units[u];
    if (mine && (mine.g || mine.ml)) return { g: a * (mine.g || mine.ml) };
    if (u && DEFAULT_UNITS[u]) return { g: a * DEFAULT_UNITS[u].g, est: u + ' 기본값 ' + DEFAULT_UNITS[u].g + 'g', dflt: u };
    if (!u && e.name === '쌀밥') return { g: a * DEFAULT_UNITS['공기'].g, est: '공기 기본값 ' + DEFAULT_UNITS['공기'].g + 'g', dflt: '공기' }; // 양 없는 밥 = 한 공기
    if (u === '장' && SHEET_G[e.name]) return { g: a * SHEET_G[e.name], est: '1장 ≈ ' + SHEET_G[e.name] + 'g' };
    if (SPOON_G[u]) return { g: a * SPOON_G[u], est: u + ' ≈ ' + SPOON_G[u] + 'g' };
    var each = EACH_BY_NAME[e.name] || null; if (each == null) e.name.split('_').reverse().forEach(function (seg) { if (each == null && EACH_G[seg]) each = EACH_G[seg]; }); // 뒤 토막이 더 구체적 (토마토_방울토마토)
    if (each && (!u || u === '개' || u === '알' || u === '팩' || u === '봉지')) return { g: a * each, est: '1' + (u || '개') + ' ≈ ' + each + 'g' }; // 1개 무게가 정해진 건 1인분보다 먼저 (삶은계란 2개 = 100g)
    if (e.kind === 'd' && e.serve && (!u || u === '그릇' || u === '인분' || u === '접시' || u === '잔' || u === '개' || u === '줄')) return { g: a * e.serve, est: '1인분 ' + e.serve + e.base + ' (식품표)' };
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
      items.push({ raw: line.raw, name: line.name, amount: line.amount, unit: line.unit, ref: m.ref, calc: m.calc, total: total, est: m.est || null, ai: !!m.ai, defaultUnit: m.defaultUnit || null });
    });
    var sum = { kcal: 0, carb: 0, protein: 0, fat: 0 };
    items.forEach(function (it) { C.KEYS.forEach(function (k) { sum[k] += it.total[k]; }); });
    return { date: parsed.date, more: parsed.more || 0, at: parsed.at, kind: parsed.kind, label: parsed.label, items: items, pending: pending, total: sum, foods: foodsMap };
  }

  var api = { DEFAULT_UNITS: DEFAULT_UNITS, candidates: candidates, findFood: findFood, gramsFor: gramsFor, parse: parse, parseItem: parseItem, takeTime: takeTime, index: index, findTable: findTable, match: match, EACH_G: EACH_G, ALIAS: ALIAS };
  root.RT = root.RT || {};
  root.RT.dietMatch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
