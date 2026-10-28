/* 시간표 카테고리 — 둘이 같이 쓰는 목록. 화면 없음.
   cats/<id> : { name, icon, order, updatedBy, updatedAt }   이름 · 아이콘을 바꾸거나 새로 만든 카테고리
               { deleted: true, updatedBy, updatedAt }        기본 카테고리를 지운 표시 (새로 만든 것은 문서를 지운다)
   문서가 하나도 없으면 기본 6개 그대로 — 그래서 처음에 따로 만들어 둘 것이 없다.
   일정(events)은 카테고리 id 만 적는다(cat). 지운 카테고리를 쓰던 일정은 아이콘 없이 보인다. */
(function (root) {
  'use strict';

  var DEFAULTS = [
    { id: 'class', name: '수업', icon: '📚' }, { id: 'exercise', name: '운동', icon: '🏃' }, { id: 'study', name: '공부', icon: '📝' },
    { id: 'work', name: '과외·일', icon: '💼' }, { id: 'meet', name: '약속', icon: '💞' }, { id: 'etc', name: '기타', icon: '📌' }
  ];
  // 고를 수 있는 아이콘 — 모두 토스페이스 글꼴 묶음에 들어 있다 (scripts/tossface-subset.py)
  var ICONS = [
    '📚', '📝', '📖', '🎓', '💻', '🧪', '🩺', '🧠',
    '🏃', '🎾', '⚽', '💪', '🧘', '🚴', '🏊', '⛳',
    '💼', '💰', '🍚', '🍜', '☕', '🍻', '🎬', '🎮',
    '🎵', '🎸', '🛒', '🏠', '🧹', '😴', '🚌', '🏥',
    '💊', '🐶', '🎂', '🎉', '💞', '📌', '📅', '⭐'
  ];
  var NAME_MAX = 8, MAX = 16;
  var ID = /^[a-z0-9]{1,24}$/;
  function isId(v) { return typeof v === 'string' && ID.test(v); }
  function isDefault(id) { return DEFAULTS.some(function (c) { return c.id === id; }); }

  /** 문서들 → 화면에 쓸 목록 [{ id, name, icon, isDefault }] (순서대로) */
  function fromDocs(docs) {
    var byId = {};
    DEFAULTS.forEach(function (c, i) { byId[c.id] = { id: c.id, name: c.name, icon: c.icon, order: i, isDefault: true }; });
    (docs || []).forEach(function (d) {
      if (!d || !isId(d.id)) return;
      if (d.deleted === true) { delete byId[d.id]; return; }
      var name = typeof d.name === 'string' ? d.name.trim() : '';
      // 아이콘은 목록 밖의 것도 보여 준다 (더 새 버전 앱이 넣은 것일 수 있어서)
      if (!name || name.length > NAME_MAX || typeof d.icon !== 'string' || !d.icon || d.icon.length > 8) return;
      var base = byId[d.id];
      byId[d.id] = { id: d.id, name: name, icon: d.icon, order: typeof d.order === 'number' && isFinite(d.order) ? d.order : (base ? base.order : 999), isDefault: isDefault(d.id) };
    });
    return Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (a, b) { return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); })
      .map(function (c) { return { id: c.id, name: c.name, icon: c.icon, order: c.order, isDefault: c.isDefault }; });
  }
  function find(list, id) {
    if (!id) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function nextOrder(list) {
    return list.reduce(function (m, c) { return Math.max(m, c.order + 1); }, DEFAULTS.length);
  }
  /** 새 카테고리 id: 'c' + 시간 + 무작위 (영문 소문자 · 숫자만) */
  function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /** 폼 확인: { id(고칠 때), name, icon } — 문제가 없으면 '' */
  function validate(f, list) {
    var name = String((f && f.name) || '').trim();
    if (!name) return '이름을 적어 주세요';
    if (name.length > NAME_MAX) return '이름은 ' + NAME_MAX + '자까지 쓸 수 있어요';
    if (list.some(function (c) { return c.id !== f.id && c.name === name; })) return '같은 이름의 카테고리가 있어요';
    if (!f.icon || (ICONS.indexOf(f.icon) < 0 && !(f.id && find(list, f.id) && find(list, f.id).icon === f.icon))) return '아이콘을 골라 주세요';
    if (!f.id && list.length >= MAX) return '카테고리는 ' + MAX + '개까지 만들 수 있어요';
    return '';
  }
  /** 이 카테고리를 쓰는 일정 수 (지우기 전에 알려 준다) */
  function usage(events, id) {
    return (events || []).filter(function (e) { return e && e.cat === id; }).length;
  }

  var api = { DEFAULTS: DEFAULTS, ICONS: ICONS, NAME_MAX: NAME_MAX, MAX: MAX, isId: isId, isDefault: isDefault, fromDocs: fromDocs, find: find, nextOrder: nextOrder, newId: newId, validate: validate, usage: usage };
  root.RT = root.RT || {};
  root.RT.cats = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
