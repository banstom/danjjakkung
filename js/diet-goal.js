/* 단짝 식탁 목표 계산 (D1) — docs/diet/goals.md 2 · 5 · 6 · 7절 그대로.
   몸 정보는 본인 기기에서만 계산하고(private/{uid}), 저장은 목표 숫자만(goals/{uid}). 숫자는 소수 그대로, 반올림은 화면에서만 */
(function (root) {
  'use strict';
  var ACTIVITY = { none: 1.2, w1_3: 1.375, w3_5: 1.55, daily: 1.725 };
  var PROTEIN_PER_KG = { bulk: 2.0, keep: 1.6, cut: 2.0 };
  var RANGE = { carb: [50, 65], protein: [10, 20], fat: [15, 30] }; // 2025 한국인 영양소 섭취기준 에너지적정비율
  var CARB_MIN_G = 100, KCAL_PER_KG = 7700;

  /** ① 기초대사량 (Mifflin-St Jeor) */
  function bmr(b) { return 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + (b.sex === 'f' ? -161 : 5); }
  /** ② 하루 소비량 */
  function tdee(b) { return bmr(b) * (ACTIVITY[b.activity] || ACTIVITY.none); }

  /** 탄단지 g → 범위 밖 안내 (빨강 안 씀, 막지 않음) */
  function notesFor(t) {
    var notes = [], s = t.carb * 4 + t.protein * 4 + t.fat * 9;
    if (t.carb < CARB_MIN_G) notes.push('탄수가 하루 100g보다 적어요');
    if (s > 0) {
      var pct = { carb: t.carb * 4 / s * 100, protein: t.protein * 4 / s * 100, fat: t.fat * 9 / s * 100 };
      var name = { carb: '탄수', protein: '단백질', fat: '지방' };
      Object.keys(RANGE).forEach(function (k) {
        var r = RANGE[k], v = Math.round(pct[k] * 10) / 10;
        if (v < r[0] || v > r[1]) notes.push(name[k] + ' 비율이 권장 범위(' + r[0] + '~' + r[1] + '%) 밖이에요');
      });
    }
    return notes;
  }

  /** 추천 목표. b = { sex: 'm'|'f', age, heightCm, weightKg, activity, goal: 'cut'|'keep'|'bulk' } */
  function targets(b) {
    var B = bmr(b), T = tdee(b), K;
    if (b.goal === 'bulk') K = T * 1.10;
    else if (b.goal === 'cut') K = T - b.weightKg * 0.005 * KCAL_PER_KG / 7;
    else K = T;
    var raised = false;
    if (K < B) { K = B; raised = true; }                      // ③ 기초대사량 아래로 내려가지 않음
    var pByKg = b.weightKg * (PROTEIN_PER_KG[b.goal] || 1.6), pCap = K * 0.20 / 4;
    var protein = Math.min(pByKg, pCap);                       // ④ 한국인 기준 상한 20%
    var fat = Math.max(K * 0.25 / 9, b.weightKg * 0.5);        // ⑤
    var carb = (K - protein * 4 - fat * 9) / 4;                // ⑥ 나머지
    var out = { bmr: B, tdee: T, kcal: K, protein: protein, fat: fat, carb: carb, proteinCapped: pCap < pByKg, kcalRaised: raised };
    out.notes = (raised ? ['감량 속도를 늦췄어요 (기초대사량보다 낮게 먹지 않게)'] : []).concat(notesFor(out));
    return out;
  }

  /** 6절: 채워야 하는 목표 / 넘지 말아야 할 목표 */
  var LIMIT = { fat: true, 'cut.kcal': true, 'cut.carb': true, 'keep.kcal': true, 'keep.carb': true }; // 유지 칼로리 · 탄수 = 넘지 말아야 (가정 — 사용자 확인 필요)
  function kindOf(goal, key) { return LIMIT[key] || LIMIT[goal + '.' + key] ? 'limit' : 'fill'; }
  /** 목표 대비 문구. → { kind, over, n, text } (n 은 화면용 정수) */
  function status(goal, key, actual, target) {
    var kind = kindOf(goal, key), diff = actual - target, n = Math.round(Math.abs(diff)), over = diff > 0;
    var text = kind === 'fill' ? (over || diff === 0 ? '달성 ✓ +' + n : n + ' 남음') : (over ? n + ' 많음' : n + ' 남음');
    return { kind: kind, over: over, n: n, text: text };
  }

  /** 7절: 체중으로 다시 맞추기 제안. weights = [{ date: 'YYYY-MM-DD', kg }] (최근 것들), 3주가 안 되면 null.
      → { perWeek, target, kcal(50 단위, +면 올리기) } */
  function retune(goal, weights) {
    var w = (weights || []).filter(function (x) { return x && typeof x.kg === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(x.date); })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (w.length < 2) return null;
    var days = (Date.parse(w[w.length - 1].date) - Date.parse(w[0].date)) / 86400000;
    if (days < 21) return null;
    var cut = w.filter(function (x) { return (Date.parse(w[w.length - 1].date) - Date.parse(x.date)) / 86400000 <= 21; });
    var first = cut[0], last = cut[cut.length - 1], weeks = (Date.parse(last.date) - Date.parse(first.date)) / 86400000 / 7;
    if (weeks <= 0) return null;
    var perWeek = (last.kg - first.kg) / weeks;
    var rate = goal === 'cut' ? -0.005 : goal === 'bulk' ? 0.00375 : 0;
    var target = last.kg * rate;
    var kcal = Math.round((target - perWeek) * KCAL_PER_KG / 7 / 50) * 50;
    return { perWeek: perWeek, target: target, kcal: kcal };
  }

  /** 5절 안전장치: 바꾼 칼로리가 기초대사량 아래면 올림 (몸 정보를 알 때만) */
  function clampKcal(kcal, body) { return body ? Math.max(kcal, bmr(body)) : kcal; }

  var NOTICE = '참고용 추천이에요. 의학적 진단·처방이 아니어서 효력이 없어요. 정확한 목표는 의사나 임상영양사 같은 전문가와 상의해 주세요. 질환이 있거나 임신 중이거나 성장기라면 꼭 전문가와 상의해 주세요. 숫자는 언제든 직접 고칠 수 있어요.';

  var api = { ACTIVITY: ACTIVITY, RANGE: RANGE, NOTICE: NOTICE, bmr: bmr, tdee: tdee, targets: targets, notesFor: notesFor, kindOf: kindOf, status: status, retune: retune, clampKcal: clampKcal };
  root.RT = root.RT || {};
  root.RT.dietGoal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
