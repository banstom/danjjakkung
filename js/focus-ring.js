/* 집중 화면 진행 링 — 도트 테마용 픽셀 계단 원 (docs/focus/pixel-skin-focus.css 끝 알고리즘, tests B7).
   격자 한 칸 4px · 지름 248px(62칸) · 가운데 31 · 링 3칸(rIn 27 ~ rOut 30) · 안팎 외곽선 한 칸씩.
   색은 CSS 클래스로만 (fr-o = --ol 외곽선 · fr-p = --focus-ring 진행 · fr-t = --focus-track 바탕 · fr-s = 멈춤 --faint) — 여기엔 색 값을 쓰지 않는다 */
(function (root) {
  'use strict';
  var N = 62, CELL = 4, C = N / 2, R_IN = C - 4, R_OUT = C - 1;
  /** progress 0 ~ 1 → { o: [[x, y]], p: [...], t: [...] } (진행 칸은 12시부터 시계 방향) */
  function cells(progress) {
    var p = Math.max(0, Math.min(1, progress || 0)), out = { o: [], p: [], t: [] };
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var dx = x + 0.5 - C, dy = y + 0.5 - C, r = Math.sqrt(dx * dx + dy * dy);
      if ((r >= R_IN - 1 && r < R_IN) || (r >= R_OUT && r < R_OUT + 1)) { out.o.push([x, y]); continue; }
      if (r >= R_IN && r < R_OUT) {
        var ang = Math.atan2(dx, -dy); if (ang < 0) ang += 2 * Math.PI; // 12시 = 0, 시계 방향
        (ang < p * 2 * Math.PI ? out.p : out.t).push([x, y]);
      }
    }
    return out;
  }
  function path(list) { return list.map(function (c) { return 'M' + c[0] * CELL + ' ' + c[1] * CELL + 'h4v4h-4z'; }).join(''); }
  /** <svg> 한 장 — 칸마다 rect 대신 색마다 path 하나 */
  function svg(progress, still) {
    var c = cells(progress);
    return '<svg class="fc-ring fc-ring--pixel" viewBox="0 0 ' + N * CELL + ' ' + N * CELL + '" shape-rendering="crispEdges" aria-hidden="true">' +
      '<path class="fr-t" d="' + path(c.t) + '"/><path class="' + (still ? 'fr-s' : 'fr-p') + '" d="' + path(c.p) + '"/><path class="fr-o" d="' + path(c.o) + '"/></svg>';
  }
  var api = { cells: cells, svg: svg, N: N };
  root.RT = root.RT || {};
  root.RT.focusRing = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
