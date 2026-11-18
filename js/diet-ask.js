/* 단짝 식탁 질문 고르기 (D1) — docs/diet/tests.md 2절.
   AI 가 낸 모르는 것(unknowns) 중 칼로리 범위 폭이 80kcal 이상인 것만, 폭이 큰 순서로 최대 3개.
   이미 답한 것(사용자가 정한 단위 · 레시피에 있는 재료)은 AI 에게 그 정보를 주므로 여기 오지 않는다.
   kcalRange 는 AI 가 낸 대략의 범위로, **물을지 정하는 데만** 쓴다 — 합계 · 목표 계산에 절대 쓰지 않는다 (숫자는 식품표에서). */
(function (root) {
  'use strict';
  var MIN_WIDTH = 80, MAX_ASK = 3;
  function width(u) {
    var r = u && u.kcalRange;
    if (!r || r.length !== 2) return 0;
    var a = Number(r[0]), b = Number(r[1]);
    return isFinite(a) && isFinite(b) ? Math.abs(b - a) : 0;
  }
  /** unknowns → 물을 것 (폭 큰 순, 같으면 원래 순서) */
  function pick(unknowns) {
    return (unknowns || []).map(function (u, i) { return { u: u, w: width(u), i: i }; })
      .filter(function (x) { return x.w >= MIN_WIDTH; })
      .sort(function (a, b) { return b.w - a.w || a.i - b.i; })
      .slice(0, MAX_ASK).map(function (x) { return x.u; });
  }
  var api = { MIN_WIDTH: MIN_WIDTH, MAX_ASK: MAX_ASK, width: width, pick: pick };
  root.RT = root.RT || {};
  root.RT.dietAsk = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
