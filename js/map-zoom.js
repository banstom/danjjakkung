/* 단짝 지도 확대 · 끌기 (v48) — 버튼 · 휠 · 두 손가락. SVG viewBox 만 바꾼다 (다시 그리지 않음).
   viewBox 는 늘 처음 자리(HOME)와 같은 가로세로 비율, 가운데가 HOME 밖으로 나가지 않게. */
(function (root) {
  'use strict';
  var MIN_W = 70; // 가장 크게 = 처음의 12배쯤 (서울 구도 누를 수 있게)

  function clamp(vb, home) {
    if (vb.w >= home.w) return { x: home.x, y: home.y, w: home.w, h: home.h }; // 가장 작게 = 처음 자리 그대로
    var r = home.h / home.w;
    var w = Math.max(MIN_W, vb.w), h = w * r;
    var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    cx = Math.max(home.x, Math.min(home.x + home.w, cx));
    cy = Math.max(home.y, Math.min(home.y + home.h, cy));
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }

  /** k 배 확대 (k < 1 이면 축소). fx, fy = 기준점(화면 안 비율 0~1) — 그 점은 제자리 */
  function zoomAt(vb, k, fx, fy, home) {
    var nw = vb.w / k, nh = vb.h / k;
    return clamp({ x: vb.x + (vb.w - nw) * fx, y: vb.y + (vb.h - nh) * fy, w: nw, h: nh }, home);
  }

  /** 화면 px 만큼 끌기 → 새 viewBox. cw = SVG 화면 폭(px) */
  function panBy(vb, dxPx, dyPx, cw, home) {
    var s = vb.w / cw;
    return clamp({ x: vb.x - dxPx * s, y: vb.y - dyPx * s, w: vb.w, h: vb.h }, home);
  }

  /** 지역 가운데로 (지금보다 작게 보고 있으면 w 까지 확대) */
  function focusOn(vb, x, y, w, home) {
    var nw = Math.min(vb.w, w), nh = nw * home.h / home.w;
    return clamp({ x: x - nw / 2, y: y - nh / 2, w: nw, h: nh }, home);
  }

  function setBox(el, vb) { el.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].map(function (n) { return Math.round(n * 10) / 10; }).join(' ')); }

  /** el = <svg>, o = { get(): vb, set(vb), home, onMoved() } — 끌거나 확대한 뒤 바로 오는 click 은 막는다 */
  function attach(el, o) {
    var pts = {}, start = null, moved = false, blockUntil = 0;
    o.busy = function () { return Object.keys(pts).length > 0; }; // 손가락이 닿아 있는 동안 app.js 는 다시 그리기를 미룬다
    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }
    function rect() { return el.getBoundingClientRect(); }
    function apply(vb) { o.set(vb); setBox(el, vb); }
    function begin() {
      var l = list(), r = rect();
      if (l.length === 1) start = { kind: 'pan', x: l[0].x, y: l[0].y, vb: o.get() };
      else if (l.length >= 2) {
        var d = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y) || 1;
        start = { kind: 'pinch', d: d, fx: ((l[0].x + l[1].x) / 2 - r.left) / r.width, fy: ((l[0].y + l[1].y) / 2 - r.top) / r.height, vb: o.get() };
      }
    }
    el.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (list().length === 1) moved = false;
      begin();
    });
    el.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId] || !start) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var l = list(), r = rect();
      if (start.kind === 'pan' && l.length === 1) {
        var dx = l[0].x - start.x, dy = l[0].y - start.y;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        if (!moved) { moved = true; try { el.setPointerCapture(e.pointerId); } catch (x) {} }
        apply(panBy(start.vb, dx, dy, r.width, o.home));
      } else if (start.kind === 'pinch' && l.length >= 2) {
        moved = true;
        var d = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y) || 1;
        apply(zoomAt(start.vb, d / start.d, start.fx, start.fy, o.home));
      }
    });
    function end(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      if (moved) { blockUntil = Date.now() + 350; if (o.onMoved) o.onMoved(); }
      if (list().length) begin(); else start = null;
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', function (e) { if (Date.now() < blockUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
    el.addEventListener('wheel', function (e) {
      if (!e.deltaY) return; // 가로 스크롤은 무시
      e.preventDefault();
      var r = rect();
      // 트랙패드처럼 작은 값이 잇달아 와도 부드럽게: 움직인 만큼 비례해서 (한 번에 최대 1.25배)
      var k = Math.max(0.8, Math.min(1.25, Math.exp(-e.deltaY * 0.002)));
      apply(zoomAt(o.get(), k, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, o.home));
    }, { passive: false });
  }

  var api = { MIN_W: MIN_W, clamp: clamp, zoomAt: zoomAt, panBy: panBy, focusOn: focusOn, setBox: setBox, attach: attach };
  root.RT = root.RT || {};
  root.RT.mapZoom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
