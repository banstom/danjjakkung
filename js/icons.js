/* 루틴 아이콘 (v43: 16개 → 묶음 5개 · 52개) — 토스페이스로 보이는 것만 고를 수 있다 (fonts/의 잘라 둔 글꼴과 같은 목록).
   예전 16개는 모두 그대로 들어 있다 (이미 고른 루틴이 깨지지 않게). 새로 넣으면 scripts/tossface-subset.py USED 에도 더하고 다시 돌린다. */
(function (root) {
  'use strict';
  var GROUPS = [
    { key: 'move', name: '운동', icons: ['🦵', '🎾', '🏃', '💪', '🧘', '🚴', '🏊', '⚽', '🏀', '🏸', '🥊', '🧗', '🚶', '🤸'] },
    { key: 'study', name: '공부 · 일', icons: ['📚', '📝', '📖', '💻', '🧠', '🎓', '🌐', '💼', '📈', '🔬'] },
    { key: 'health', name: '건강 · 식사', icons: ['💧', '🥗', '🍎', '🥛', '💊', '🦷', '🍳', '☕', '😴', '🚭'] },
    { key: 'life', name: '생활', icons: ['🧹', '🧺', '🛁', '🪴', '🌱', '🐶', '💰', '📵'] },
    { key: 'mind', name: '마음 · 취미', icons: ['🎸', '🎹', '🎨', '📷', '🎧', '🧩', '🙏', '😊', '📓', '🌅'] }
  ];
  var ROUTINE_ICONS = [];
  GROUPS.forEach(function (g) { g.icons.forEach(function (e) { if (ROUTINE_ICONS.indexOf(e) < 0) ROUTINE_ICONS.push(e); }); });
  /** 아이콘 → 종류 키 (v44 자동 분류). 목록에 없으면 null */
  function kindOf(e) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].icons.indexOf(e) >= 0) return GROUPS[i].key;
    return null;
  }
  var KIND_KEYS = GROUPS.map(function (g) { return g.key; });
  var api = { GROUPS: GROUPS, ROUTINE_ICONS: ROUTINE_ICONS, KIND_KEYS: KIND_KEYS, kindOf: kindOf, isAllowed: function (e) { return ROUTINE_ICONS.indexOf(e) >= 0; } };
  root.RT = root.RT || {};
  root.RT.icons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
