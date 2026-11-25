/* 「전체」 탭 (v47) — 우리 둘 카드 · 단짝 기능(단짝 지도 · 교환 쪽지 · eat(쿠키) 기능 · 단짝 영수증, 2×2) · 설정 목록, 그리고 계정 시트.
   목업 design/mockups/chosen/01-전체-탭.html (B 카드형). 값은 app.js 의 allModel() 이 만든다. */
(function (root) {
  'use strict';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(size, d) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var ICON = {
    bell: '<path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.8-1.7 0-1-.8-1.4-.8-2.3 0-1 .8-1.6 1.8-1.6H17a4 4 0 004-4c0-4.6-4-8.4-9-8.4z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>'
  };

  // 단짝 지도 미리보기: 한국 모양으로 늘어놓은 작은 칸 (8px 간격 · 6px 칸). 정확한 지도가 아니라 모양만 (사용자 결정)
  var TILES = [[4,0],[5,0],[3,1],[4,1],[5,1],[6,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],
    [3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[8,6],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],
    [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[3,10],[4,10],[4,12]];

  // 칸마다 가까운 시·도 (scripts/map-simplify.py 로 만든 지도의 지역 가운데 점에서 계산, 세종 한 칸은 손으로)
  var TILE_SIDO = ['51','51','41','41','51','51','28','11','41','41','51','51','44','41','41','43','43','51','44','36','43','47','47','47','44','30','43','47','47','47',
    '44','52','52','52','47','47','47','52','52','52','52','48','27','47','31','12','12','12','12','48','48','48','26','12','12','12','48','48','48','12','12','50'];
  /** 함께 다녀온 시·도 → 칠할 칸 번호 */
  function tilesFor(sidos) {
    var set = {}; (sidos || []).forEach(function (s) { set[s] = true; });
    var out = []; TILE_SIDO.forEach(function (s, i) { if (set[s]) out.push(i); });
    return out;
  }
  /** on: 칠할 칸 번호 목록 */
  function mapPreview(on) {
    var set = {}; (on || []).forEach(function (i) { set[i] = true; });
    return '<span class="amap" aria-hidden="true">' + TILES.map(function (t, i) {
      return '<span class="amap__tile' + (set[i] ? ' is-on' : '') + '" style="left:' + (t[0] * 8) + 'px;top:' + (t[1] * 8) + 'px"></span>';
    }).join('') + '</span>';
  }

  function row(act, icon, name, desc, value, label) {
    return '<button type="button" class="arow" data-act="' + act + '"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' +
      '<span class="arow__ic">' + svg(20, ICON[icon]) + '</span>' +
      '<span class="arow__tx"><span class="arow__nm">' + esc(name) + '</span>' + (desc ? '<span class="arow__ds">' + esc(desc) + '</span>' : '') + '</span>' +
      (value ? '<span class="arow__vl">' + esc(value) + '</span>' : '') +
      '<span class="arow__chev">' + svg(18, ICON.chev) + '</span></button>';
  }

  // FT1 (docs/focus/tabs.md 2절): 돌아보기 카드 — 이번 주 5단계 띠 · [주] [달] [결산] · 아래 한 줄
  var DOWS = ['월', '화', '수', '목', '금', '토', '일'];
  var CELL = { full: '모두 해냄', s3: '거의 다 함', s2: '반쯤 함', s1: '조금 함', none: '안 함', rest: '쉬는 날', pre: '루틴 없음', future: '아직' };
  function lookCard(l) {
    if (!l) return '';
    var cells = (l.cells && l.cells.length === 7 ? l.cells : ['future', 'future', 'future', 'future', 'future', 'future', 'future']).map(function (c, i) {
      var cls = c === 'full' ? 'lv-full' : c === 'none' ? 'lv-none' : c === 'pre' ? 'alook__c--pre' : c === 'rest' ? 'lv-rest' : /^s[123]$/.test(c) ? 'lv-' + c : 'alook__c--future';
      return '<span class="alook__d"><span class="alook__c ' + cls + (i === l.todayIdx ? ' alook__c--today' : '') + '"></span><span class="alook__dow">' + DOWS[i] + '</span></span>';
    }).join('');
    var label = '이번 주 우리 · ' + DOWS.map(function (d, i) { return d + ' ' + CELL[(l.cells || [])[i] || 'future']; }).join(', ');
    var seg = function (v, t, extra) { return '<button type="button" class="alook__seg" data-act="open-look" data-v="' + v + '">' + t + (extra || '') + '</button>'; };
    var foot = l.fresh ? '<button type="button" class="alook__line alook__line--btn" data-act="rc-open" data-v="' + esc(l.fresh.key) + '">' + esc(l.fresh.text) + ' ›</button>'
      : '<p class="alook__line">' + esc(l.line) + '</p>';
    var yq = l.yq ? '<button type="button" class="alook__line alook__line--btn" data-act="' + esc(l.yq.act) + '" data-v="' + esc(l.yq.year) + '"><span aria-hidden="true">💌</span> 짝꿍과의 연말 문답 ›</button>' : '';
    return '<h2 class="asec">돌아보기</h2><section class="card alook" aria-label="돌아보기">' +
      '<button type="button" class="alook__top" data-act="open-look" data-v="week" aria-label="' + esc(label + ' · 모두 해낸 날 ' + (l.allDays || 0) + '일 · 돌아보기 열기') + '">' +
      '<span class="alook__head"><span class="alook__title">이번 주 우리</span><span class="alook__sub">모두 해낸 날 ' + esc(l.allDays || 0) + '일</span></span>' +
      '<span class="alook__strip" aria-hidden="true">' + cells + '</span></button>' +
      '<div class="alook__segs">' + seg('week', '주') + seg('month', '달') + seg('recap', '결산', l.fresh ? '<span class="alook__new">새로</span>' : '') + '</div>' +
      foot + yq + '</section>';
  }

  /** m = { us(우리 둘 박스 — view-avatar.js), map: { count, ready, tiles }, diet, notify: '켜짐' | '꺼짐' | '', theme, meName } */
  function tab(m) {
    // v51: 「우리 둘」 박스 — 왼쪽 · 오른쪽 사진(또는 사람 색) + 가운데 디데이 · 다음 기념일 (view-avatar.js)
    var us = m.us && root.RT && root.RT.viewAvatar ? root.RT.viewAvatar.box(m.us) : '';
    var map = m.map || {};
    var feats = '<h2 class="asec">단짝 기능</h2><div class="afeat">' +
      '<button type="button" class="card afeat__card" data-act="all-map" aria-label="' + esc('단짝 지도' + (map.ready ? ' · 함께 ' + (map.count || 0) + '곳' : ' · 준비 중')) + '">' +
      '<span class="afeat__nm">단짝 지도</span>' + mapPreview(map.tiles) +
      (map.ready ? '<span class="afeat__ds">함께 ' + esc(map.count || 0) + '곳</span>' : '<span class="abadge">준비 중</span>') + '</button>' +
      // 11-21: 단짝 식탁 자리 → 교환 쪽지 (docs/question E1) · eat(쿠키) 기능 (docs/eat 12) · 단짝 영수증 — 2×2
      (m.question && root.RT && root.RT.viewQuestion ? root.RT.viewQuestion.entry(m.question) : '') +
      (m.eat && root.RT && root.RT.viewEat ? root.RT.viewEat.entry(m.eat) : '') +
      (m.ledger && root.RT && root.RT.viewLedger ? root.RT.viewLedger.entryCard(m.ledger, true) : '') + '</div>';
    // 단짝 영수증 (docs/ledger L11) — 기능 그리드 아래 가로 꽉 찬 카드
    var set = '<h2 class="asec">설정</h2><div class="alist">' +
      // 예전 머리말처럼 쓸 수 없을 땐 줄을 숨긴다 (알림 모듈 · 테마 모듈이 없을 때)
      (m.notify ? row('open-notify', 'bell', '알림', '', m.notify, '알림 설정 (' + m.notify + ')') : '') +
      (m.theme ? row('open-theme', 'palette', '테마', '', m.theme, '테마 (지금: ' + m.theme + ')') : '') +
      row('open-account', 'user', '계정', m.meName ? m.meName + ' 님으로 접속' : '', '', '계정' + (m.meName ? ' · ' + m.meName + ' 님으로 접속' : '')) +
      '</div>';
    return '<div class="all">' + us + lookCard(m.look) + feats + set + '</div>';
  }

  /** 계정 시트 — 접속한 사람 · 이메일 + 로그아웃. a = { meName, email } */
  function accountSheet(a, entering) {
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close-account" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="account-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<h2 id="account-title" class="sheet__title">계정</h2>' +
      '<p class="sheet__sub">' + esc((a.meName ? a.meName + ' 님으로 접속' : '접속 중') + (a.email ? ' · ' + a.email : '')) + '</p>' +
      '<button type="button" class="acct__out" data-act="sign-out">로그아웃</button>' +
      '<button type="button" class="close-btn" data-act="close-account">닫기</button>' +
      '</section></div>';
  }

  var api = { lookCard: lookCard, tab: tab, accountSheet: accountSheet, mapPreview: mapPreview, tilesFor: tilesFor, TILES: TILES, TILE_SIDO: TILE_SIDO };
  root.RT = root.RT || {};
  root.RT.viewAll = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
