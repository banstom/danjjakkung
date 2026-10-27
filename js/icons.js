/* 루틴 아이콘 — 토스페이스로 보이는 16개만 고를 수 있다 (fonts/의 잘라 둔 글꼴과 같은 목록). */
(function (root) {
  'use strict';
  var ROUTINE_ICONS = ['🦵', '🎾', '🏃', '💪', '🧘', '🚴', '🏊', '⚽', '📚', '📝', '💧', '🥗', '😴', '🧹', '🎸', '🌱'];
  var api = { ROUTINE_ICONS: ROUTINE_ICONS, isAllowed: function (e) { return ROUTINE_ICONS.indexOf(e) >= 0; } };
  root.RT = root.RT || {};
  root.RT.icons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
