/* 프로필 사진 고르기 (v51) — 올린 사진에서 동그라미로 보일 부분을 고른다. 값 계산만 (화면은 view-avatar.js, 손가락은 app.js).
   보는 칸(view, 정사각형 px) 안에서 사진을 scale 배로 놓고 (x, y) = 사진 왼쪽 위의 칸 안 위치(px).
   언제나 칸이 사진으로 가득 차게(빈틈 없이) 묶는다. 저장은 OUT px 정사각형 JPEG. */
(function (root) {
  'use strict';
  var OUT = 256, QUALITY = 0.85, MAX_ZOOM = 4, MAX_LEN = 120000; // 규칙(avatars)의 글자 수 상한과 같음

  /** 처음 자리: 짧은 변이 칸을 꽉 채우게(cover), 가운데 */
  function cover(iw, ih, view) {
    var s = view / Math.min(iw, ih);
    return { scale: s, min: s, x: (view - iw * s) / 2, y: (view - ih * s) / 2 };
  }
  /** 칸에 빈틈이 생기지 않게 · 확대는 처음의 MAX_ZOOM 배까지 */
  function clamp(st, iw, ih, view) {
    var s = Math.max(st.min, Math.min(st.min * MAX_ZOOM, st.scale));
    var w = iw * s, h = ih * s;
    return { scale: s, min: st.min, x: Math.min(0, Math.max(view - w, st.x)), y: Math.min(0, Math.max(view - h, st.y)) };
  }
  /** 칸 안 (fx, fy) px 를 기준으로 scale 을 k 배 (그 점은 제자리) */
  function zoomAt(st, k, fx, fy, iw, ih, view) {
    var s = st.scale * k;
    return clamp({ scale: s, min: st.min, x: fx - (fx - st.x) * (s / st.scale), y: fy - (fy - st.y) * (s / st.scale) }, iw, ih, view);
  }
  /** 저장할 사진 범위 (원본 사진 좌표) */
  function source(st, view) {
    return { sx: -st.x / st.scale, sy: -st.y / st.scale, size: view / st.scale };
  }

  var api = { OUT: OUT, QUALITY: QUALITY, MAX_ZOOM: MAX_ZOOM, MAX_LEN: MAX_LEN, cover: cover, clamp: clamp, zoomAt: zoomAt, source: source };
  root.RT = root.RT || {};
  root.RT.avatarCrop = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
