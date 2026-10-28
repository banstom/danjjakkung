/* 테마 — 목록 · 고른 테마 저장 · 화면에 적용.
   색 값은 styles/tokens.css 의 [data-theme="<id>"] 블록에만 있다. 여기는 이름과 저장만.
   고른 테마는 이 기기에 저장한다 (localStorage). 로그인 · 기록 · 알림 설정과는 따로라 서로 영향이 없다.
   <head>에서 CSS 바로 뒤에 불러서, 첫 화면부터 고른 색으로 그린다 (깜빡임 없이).

   나 · 상대 색: 테마마다 따로 고른다 (테마를 바꾸면 그 테마에서 고른 색, 안 골랐으면 그 테마 기본색).
   고른 색은 내 계정(users 문서의 colors)에 저장돼 내 모든 기기에서 같고, 내 화면에만 쓰인다.
   화면에는 자리(slot) 색 --her(첫째 사람) · --me(둘째 사람)를 <html>에 덮어써서 칠한다. 글자색(--*-ink)은 자동.
   첫 화면 깜빡임이 없게 마지막으로 쓴 색을 이 기기에도 적어 둔다 (COLOR_KEY). */
(function (root) {
  'use strict';
  var THEMES = [
    { id: 'soft-pastel', name: 'Soft Pastel', ko: '소프트 파스텔', desc: '포근하고 귀여운 파스텔', dark: false },
    { id: 'cosmic-dream', name: 'Cosmic Dream', ko: '코즈믹 드림', desc: '깊은 우주와 성운 · 어두운 화면', dark: true },
    { id: 'ocean-breeze', name: 'Ocean Breeze', ko: '오션 브리즈', desc: '맑은 바다, 청량한 휴식', dark: false },
    { id: 'forest-diary', name: 'Forest Diary', ko: '포레스트 다이어리', desc: '숲과 이끼, 차분한 초록', dark: false },
    { id: 'vintage-film', name: 'Vintage Film', ko: '빈티지 필름', desc: '오래된 사진첩, 따뜻한 추억', dark: false },
    { id: 'blue-hour', name: 'Blue Hour', ko: '블루 아워', desc: '해 진 직후의 고요한 하늘', dark: false },
    { id: 'golden-hour', name: 'Golden Hour', ko: '골든 아워', desc: '따뜻한 노을과 황금빛 햇살', dark: false },
    { id: 'sakura-dream', name: 'Sakura Dream', ko: '사쿠라 드림', desc: '부드러운 벚꽃과 봄의 설렘', dark: false },
    { id: 'midnight-noir', name: 'Midnight Noir', ko: '미드나잇 누아르', desc: '깊은 밤과 도시의 세련미', dark: true },
    { id: 'arctic-frost', name: 'Arctic Frost', ko: '아크틱 프로스트', desc: '얼음과 서리의 맑은 색감', dark: false },
    { id: 'chocolate-noir', name: 'Chocolate Noir', ko: '초콜릿 누아르', desc: '다크 초콜릿과 크리미한 브라운', dark: false },
    { id: 'roast-nuts', name: 'Roast Nuts', ko: '로스트 너츠', desc: '구운 견과류와 달콤한 황금빛', dark: false },
    { id: 'winter-knit', name: 'Winter Knit', ko: '윈터 니트', desc: '포근한 니트와 부드러운 겨울', dark: false },
    { id: 'harvest', name: 'Harvest', ko: '하베스트', desc: '황금빛 들판과 차분한 가을', dark: false }
  ];
  var KEY = 'danjjakkung.theme';
  var COLOR_KEY = 'danjjakkung.colors';
  // 테마마다 고를 수 있는 사람 색 8개. 앞의 둘은 그 테마 기본색(--her, --me 와 같다).
  // ink: 색 위 글자 후보(어두운 쪽) — 흰색과 견줘 더 잘 보이는 쪽을 쓴다 (4.5:1 이상은 tests/themes.test.js 가 확인).
  var PALETTES = {
    'soft-pastel': { ink: '#2A2730', colors: ['#E59BBA', '#A9A2EE', '#F4A7A3', '#F5C58A', '#E8D27A', '#9FD3B5', '#8EC5E8', '#C7A4E0'] },
    'cosmic-dream': { ink: '#101426', colors: ['#6CD8E8', '#A891F0', '#F08BC4', '#FFB86B', '#F5E27A', '#7EE0A8', '#7FA8FF', '#FF8A8A'] },
    'ocean-breeze': { ink: '#0B2530', colors: ['#399DA8', '#7FC5C0', '#F2A48C', '#F4C977', '#9EC97F', '#6FA8DC', '#B49AD8', '#E88FA6'] },
    'forest-diary': { ink: '#1A2119', colors: ['#82966A', '#AEBD92', '#C99A6B', '#D9B85C', '#8FAFB8', '#C48A8A', '#A89BC2', '#7FA08A'] },
    'vintage-film': { ink: '#211E19', colors: ['#874F4D', '#C9AA66', '#6B7052', '#57707F', '#B97A5A', '#A88BA0', '#8FA38A', '#D49A7A'] },
    'blue-hour': { ink: '#161C35', colors: ['#7F8CBF', '#A6AEE3', '#E8A3B4', '#F2BE8C', '#8FC1D4', '#B79CD9', '#9DC4A8', '#5D6AA3'] },
    'golden-hour': { ink: '#2B1A10', colors: ['#C96F62', '#F2B880', '#E89A5B', '#F2D27A', '#9DBF8E', '#8FB5D0', '#C49AC0', '#E8A0A0'] },
    'sakura-dream': { ink: '#2E2328', colors: ['#E6A0B4', '#A7BDA5', '#C9A8E0', '#F4B8A0', '#EDD58A', '#9FC8DC', '#D98AA0', '#B8D4A8'] },
    'midnight-noir': { ink: '#15161D', colors: ['#D88A98', '#A9ABBA', '#E0B07A', '#6FAFD6', '#6CC584', '#C08AE0', '#E8D48A', '#F0A07A'] },
    'arctic-frost': { ink: '#14222C', colors: ['#778FA8', '#B9DDE8', '#C8B8E0', '#A8D4C4', '#E8B8C4', '#E8D49A', '#9BB0C8', '#8FC0D8'] },
    'chocolate-noir': { ink: '#2A1D18', colors: ['#765447', '#D8B99B', '#C49A78', '#C98F7A', '#8A9A70', '#E0C080', '#9AA8C0', '#9A4A2A'] },
    'roast-nuts': { ink: '#2E2116', colors: ['#C98A5B', '#F4C95D', '#E8D77D', '#D6AC83', '#A8C27A', '#E8A07A', '#9FC0D0', '#D99A9A'] },
    'winter-knit': { ink: '#26282C', colors: ['#E8B6C5', '#B2DCD6', '#DCC9BC', '#A8C0D8', '#C8B8D8', '#E8C89A', '#B8C8A8', '#D0A0A0'] },
    'harvest': { ink: '#24230F', colors: ['#EAB45B', '#B5B581', '#D9925B', '#F1E2A1', '#C9A27A', '#A8C0A0', '#C98A7A', '#9DB4C8'] }
  };
  var COLOR_NAMES = {}; // 화면 읽기 프로그램용 짧은 이름
  [['#E59BBA','장밋빛'],['#A9A2EE','라벤더'],['#F4A7A3','코랄'],['#F5C58A','살구'],['#E8D27A','버터'],['#9FD3B5','민트'],['#8EC5E8','하늘'],['#C7A4E0','라일락'],
   ['#6CD8E8','시안'],['#A891F0','보라'],['#F08BC4','분홍'],['#FFB86B','주황'],['#F5E27A','노랑'],['#7EE0A8','초록'],['#7FA8FF','파랑'],['#FF8A8A','다홍'],
   ['#399DA8','청록'],['#7FC5C0','물빛'],['#F2A48C','코랄'],['#F4C977','모래'],['#9EC97F','해초'],['#6FA8DC','하늘'],['#B49AD8','라일락'],['#E88FA6','분홍'],
   ['#82966A','이끼'],['#AEBD92','세이지'],['#C99A6B','나무'],['#D9B85C','겨자'],['#8FAFB8','시냇물'],['#C48A8A','산딸기'],['#A89BC2','제비꽃'],['#7FA08A','솔잎'],
   ['#874F4D','버건디'],['#C9AA66','황토'],['#6B7052','올리브'],['#57707F','바랜 청색'],['#B97A5A','벽돌'],['#A88BA0','모브'],['#8FA38A','세이지'],['#D49A7A','살구'],
   ['#7F8CBF','페리윙클'],['#A6AEE3','연보라'],['#E8A3B4','노을 분홍'],['#F2BE8C','노을 주황'],['#8FC1D4','하늘'],['#B79CD9','보라'],['#9DC4A8','민트'],['#5D6AA3','남색'],
   ['#C96F62','노을 장밋빛'],['#F2B880','살구'],['#E89A5B','노을 주황'],['#F2D27A','햇살'],['#9DBF8E','풀빛'],['#8FB5D0','저녁 하늘'],['#C49AC0','모브'],['#E8A0A0','복숭아'],
   ['#E6A0B4','벚꽃'],['#A7BDA5','세이지'],['#C9A8E0','라일락'],['#F4B8A0','살구'],['#EDD58A','개나리'],['#9FC8DC','봄 하늘'],['#D98AA0','로즈'],['#B8D4A8','새잎'],
   ['#D88A98','로즈'],['#A9ABBA','은빛'],['#E0B07A','샴페인'],['#6FAFD6','네온 파랑'],['#6CC584','네온 초록'],['#C08AE0','라일락'],['#E8D48A','가로등'],['#F0A07A','네온 주황'],
   ['#778FA8','서리 청색'],['#B9DDE8','얼음'],['#C8B8E0','라벤더'],['#A8D4C4','빙하 민트'],['#E8B8C4','새벽 분홍'],['#E8D49A','겨울 햇살'],['#9BB0C8','회청'],['#8FC0D8','호수'],
   ['#765447','모카'],['#D8B99B','라테'],['#C49A78','카페오레'],['#C98F7A','로즈 브라운'],['#8A9A70','피스타치오'],['#E0C080','캐러멜 크림'],['#9AA8C0','블루베리'],['#9A4A2A','시나몬'],
   ['#C98A5B','아몬드'],['#F4C95D','꿀'],['#E8D77D','보리'],['#D6AC83','캐러멜'],['#A8C27A','피스타치오'],['#E8A07A','살구'],['#9FC0D0','하늘'],['#D99A9A','대추'],
   ['#E8B6C5','더스티 핑크'],['#B2DCD6','민트'],['#DCC9BC','오트밀'],['#A8C0D8','겨울 하늘'],['#C8B8D8','라벤더'],['#E8C89A','캐멀'],['#B8C8A8','세이지'],['#D0A0A0','로즈 브라운'],
   ['#EAB45B','머스터드'],['#B5B581','올리브'],['#D9925B','호박'],['#F1E2A1','밀짚'],['#C9A27A','볏단'],['#A8C0A0','세이지'],['#C98A7A','사과'],['#9DB4C8','가을 하늘']
  ].forEach(function (p) { COLOR_NAMES[p[0]] = p[1]; });
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
    if (html.getAttribute('data-theme') === t.id) { paintPeople(doc, t.id); syncMeta(doc); return; }
    var smooth = opts && opts.smooth;
    if (smooth) html.classList.add('is-theming');
    html.setAttribute('data-theme', t.id);
    paintPeople(doc, t.id);
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

  // ── 나 · 상대 색 ──
  function lum(h) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function palette(id) { var p = PALETTES[id]; return p ? p.colors.slice() : []; }
  /** 테마 기본 자리 색: her = 첫째 사람, me = 둘째 사람 */
  function slotDefaults(id) { var c = palette(id); return { her: c[0], me: c[1] }; }
  /** 색 위 글자색: 어두운 글자와 흰 글자 중 더 잘 보이는 쪽 */
  function inkFor(id, hex) {
    var dark = (PALETTES[id] || PALETTES[LIGHT_DEFAULT]).ink;
    return contrast(hex, dark) >= contrast(hex, '#FFFFFF') ? dark : '#FFFFFF';
  }
  function colorName(hex) { return COLOR_NAMES[hex] || hex; }

  /** 저장된 colors를 믿을 수 있는 모양으로: 아는 테마 · 그 테마 후보 색만, 나 · 상대가 같은 색이면 버린다 */
  function cleanColors(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(PALETTES).forEach(function (id) {
      var p = raw[id];
      if (!p || typeof p !== 'object') return;
      var list = PALETTES[id].colors, pair = {};
      ['self', 'partner'].forEach(function (k) {
        var v = typeof p[k] === 'string' ? p[k].toUpperCase() : null;
        if (v && list.indexOf(v) >= 0) pair[k] = v;
      });
      if (pair.self && pair.self === pair.partner) return;
      if (pair.self || pair.partner) out[id] = pair;
    });
    return out;
  }

  /** 이 테마에서 내 화면의 나 · 상대 색 (안 고른 쪽은 그 사람 자리의 기본색) */
  function pairFor(id, colors, selfSlot) {
    var d = slotDefaults(id), mine = (cleanColors(colors)[id]) || {};
    var partnerSlot = selfSlot === 'her' ? 'me' : 'her';
    var self = mine.self || d[selfSlot], partner = mine.partner || d[partnerSlot];
    // 한쪽만 고른 색이 다른 쪽 기본색과 같으면, 다른 쪽은 남은 기본색으로 비킨다
    if (self === partner) { if (mine.self) partner = d[selfSlot]; else self = d[partnerSlot]; }
    return { self: self, partner: partner };
  }

  /** 테마 하나의 색을 바꾼 새 colors (기본색과 같으면 그 칸을 비운다). self와 partner가 같아지면 상대를 내 이전 색으로 바꾼다. */
  function withPick(colors, id, selfSlot, who, hex) {
    var all = cleanColors(colors), list = palette(id);
    hex = String(hex || '').toUpperCase();
    if (!byId(id) || list.indexOf(hex) < 0 || (who !== 'self' && who !== 'partner')) return all;
    var now = pairFor(id, all, selfSlot), next = { self: now.self, partner: now.partner };
    var other = who === 'self' ? 'partner' : 'self';
    if (next[other] === hex) next[other] = now[who]; // 서로 바꾸기
    next[who] = hex;
    var d = slotDefaults(id), partnerSlot = selfSlot === 'her' ? 'me' : 'her', pair = {};
    if (next.self !== d[selfSlot]) pair.self = next.self;
    if (next.partner !== d[partnerSlot]) pair.partner = next.partner;
    if (pair.self || pair.partner) all[id] = pair; else delete all[id];
    return all;
  }
  function withReset(colors, id) { var all = cleanColors(colors); delete all[id]; return all; }

  // 지금 칠하는 기준 — 처음엔 이 기기에 적어 둔 값 (계정 값이 오면 setPeople로 바뀐다)
  var people = (function () {
    try {
      var v = JSON.parse((root.localStorage && root.localStorage.getItem(COLOR_KEY)) || 'null');
      if (v && (v.slot === 'her' || v.slot === 'me')) return { slot: v.slot, colors: cleanColors(v.colors) };
    } catch (e) {}
    return { slot: null, colors: {} };
  })();
  var VARS = ['--her', '--her-ink', '--me', '--me-ink'];
  function paintPeople(doc, id) {
    var style = doc.documentElement.style;
    var mine = people.slot && people.colors[id];
    if (!mine) { VARS.forEach(function (k) { style.removeProperty(k); }); return; }
    var pair = pairFor(id, people.colors, people.slot), partnerSlot = people.slot === 'her' ? 'me' : 'her';
    var slots = {}; slots[people.slot] = pair.self; slots[partnerSlot] = pair.partner;
    ['her', 'me'].forEach(function (s) {
      style.setProperty('--' + s, slots[s]);
      style.setProperty('--' + s + '-ink', inkFor(id, slots[s]));
    });
  }
  /** 계정의 색이 오거나 바뀌면: 저장하고 지금 테마로 다시 칠한다. selfSlot = 내 자리('her' | 'me'). */
  function setPeople(selfSlot, colors) {
    var next = { slot: selfSlot === 'her' || selfSlot === 'me' ? selfSlot : null, colors: cleanColors(colors) };
    var same = JSON.stringify(next) === JSON.stringify(people);
    people = next;
    if (!same) { try { root.localStorage.setItem(COLOR_KEY, JSON.stringify(people)); } catch (e) {} }
    if (root.document && root.document.documentElement) paintPeople(root.document, current());
  }
  function forget() { setPeople(null, {}); try { root.localStorage.removeItem(COLOR_KEY); } catch (e) {} }

  var api = { THEMES: THEMES, KEY: KEY, COLOR_KEY: COLOR_KEY, PALETTES: PALETTES, byId: byId, current: current, chosen: chosen, defaultId: defaultId, apply: apply, save: save, choose: choose, syncMeta: syncMeta,
    palette: palette, slotDefaults: slotDefaults, inkFor: inkFor, contrast: contrast, colorName: colorName, cleanColors: cleanColors, pairFor: pairFor, withPick: withPick, withReset: withReset, setPeople: setPeople, forget: forget };
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
