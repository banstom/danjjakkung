/* 테마 — 목록 · 고른 테마 저장 · 화면에 적용.
   색 값은 styles/tokens.css 의 [data-theme="<id>"] 블록에만 있다. 여기는 이름과 저장만.
   고른 테마는 이 기기에 저장한다 (localStorage). 로그인 · 기록 · 알림 설정과는 따로라 서로 영향이 없다.
   <head>에서 CSS 바로 뒤에 불러서, 첫 화면부터 고른 색으로 그린다 (깜빡임 없이). */
(function (root) {
  'use strict';
  var THEMES = [
    { id: 'soft-pastel', name: 'Soft Pastel', ko: '소프트 파스텔', desc: '포근하고 귀여운 파스텔', dark: false },
    { id: 'cosmic-dream', name: 'Cosmic Dream', ko: '코즈믹 드림', desc: '깊은 우주와 성운 · 어두운 화면', dark: true },
    { id: 'ocean-breeze', name: 'Ocean Breeze', ko: '오션 브리즈', desc: '맑은 바다, 청량한 휴식', dark: false },
    { id: 'forest-diary', name: 'Forest Diary', ko: '포레스트 다이어리', desc: '숲과 이끼, 차분한 초록', dark: false },
    { id: 'vintage-film', name: 'Vintage Film', ko: '빈티지 필름', desc: '오래된 사진첩, 따뜻한 추억', dark: false },
    { id: 'blue-hour', name: 'Blue Hour', ko: '블루 아워', desc: '해 진 직후의 고요한 하늘', dark: false }
  ];
  var KEY = 'danjjakkung.theme';
  var LIGHT_DEFAULT = 'soft-pastel';
  var DARK_DEFAULT = 'cosmic-dream';

  function byId(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return null;
  }
  var picked = null; // 이번에 고른 값 (저장이 막힌 브라우저에서도 화면 · 표시가 어긋나지 않게)
  function stored() {
    if (picked) return picked;
    try { var v = root.localStorage && root.localStorage.getItem(KEY); return byId(v) ? v : null; } catch (e) { return null; }
  }
  function prefersDark() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; }
  }
  // 아직 고르지 않았으면: 휴대폰이 다크 모드면 어두운 테마, 아니면 첫 테마
  function defaultId(dark) { return dark ? DARK_DEFAULT : LIGHT_DEFAULT; }
  function current() { return stored() || defaultId(prefersDark()); }
  function chosen() { return !!stored(); }

  // 휴대폰 위쪽 띠 색을 화면 바탕(--bg)과 맞춘다. 변수 값은 전환 효과 중에도 바로 최종값이라 타이밍과 상관없다.
  function syncMeta(doc) {
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (!meta || !root.getComputedStyle) return;
    var bg = root.getComputedStyle(doc.documentElement).getPropertyValue('--bg').trim();
    if (bg && meta.getAttribute('content') !== bg) meta.setAttribute('content', bg);
  }

  function apply(id, opts) {
    var doc = root.document;
    if (!doc) return;
    var t = byId(id) || byId(current());
    var html = doc.documentElement;
    if (html.getAttribute('data-theme') === t.id) { syncMeta(doc); return; }
    var smooth = opts && opts.smooth;
    if (smooth) html.classList.add('is-theming');
    html.setAttribute('data-theme', t.id);
    syncMeta(doc);
    if (smooth) setTimeout(function () { html.classList.remove('is-theming'); }, 320);
  }

  // 고른 값을 저장만 한다 (화면은 apply). 저장이 막힌 브라우저여도 이번에 연 동안은 기억한다.
  function save(id) {
    if (!byId(id)) return false;
    picked = id;
    try { root.localStorage.setItem(KEY, id); } catch (e) {}
    return true;
  }
  // 고르면 저장하고 바로 바꾼다.
  function choose(id) {
    if (!save(id)) return false;
    apply(id, { smooth: true });
    return true;
  }

  var api = { THEMES: THEMES, KEY: KEY, byId: byId, current: current, chosen: chosen, defaultId: defaultId, apply: apply, save: save, choose: choose, syncMeta: syncMeta };
  root.RT = root.RT || {};
  root.RT.themes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // 첫 화면: 저장된 테마(없으면 기본)를 바로 단다. 아직 고르지 않았으면 휴대폰 다크 모드가 바뀔 때 따라간다.
  if (root.document && root.document.documentElement) {
    apply(current());
    try {
      var mq = root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)');
      var follow = function () { if (!chosen()) apply(current(), { smooth: true }); };
      if (mq && mq.addEventListener) mq.addEventListener('change', follow);
      else if (mq && mq.addListener) mq.addListener(follow);
    } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
