/* 「전체」 탭 (v47) — 우리 둘 카드 · 우리 기능(우리 지도 · 운동·식단) · 설정 목록, 그리고 계정 시트.
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
    run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2.5V21M6.5 12.5l2.5-4 4 1.5 2.5 3 3 .5"/>',
    chev: '<path d="M9 6l6 6-6 6"/>'
  };

  // 우리 지도 미리보기: 한국 모양으로 늘어놓은 작은 칸 (8px 간격 · 6px 칸). 정확한 지도가 아니라 모양만 (사용자 결정)
  var TILES = [[4,0],[5,0],[3,1],[4,1],[5,1],[6,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],
    [3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[8,6],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],
    [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[3,10],[4,10],[4,12]];

  /** on: 칠할 칸 번호 목록 (M2 에서 함께 다녀온 시·도로 채움). 지금은 빈 목록 */
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

  /** m = { dday: '단짝이 된 지 412일' | '', annivOff, map: { count, ready, tiles }, notify: '켜짐' | '꺼짐' | '', theme, meName } */
  function tab(m) {
    var us = '<section class="card aus" aria-label="우리 둘">' +
      '<span class="aus__dots" aria-hidden="true"><span class="aus__dot aus__dot--me"></span><span class="aus__dot aus__dot--her"></span></span>' +
      '<span class="aus__tx"><span class="aus__nm">우리 둘</span>' +
      // 기념일 규칙이 막혀 정할 수 없으면 안내 문구도 없음 (점검 AI)
      (m.dday || !m.annivOff ? '<span class="aus__ds">' + esc(m.dday || '우리가 시작한 날을 정해 볼까요?') + '</span>' : '') + '</span>' +
      (m.annivOff ? '' : '<button type="button" class="aus__btn" data-act="open-anniv">기념일</button>') + '</section>';
    var map = m.map || {};
    var feats = '<h2 class="asec">우리 기능</h2><div class="afeat">' +
      '<button type="button" class="card afeat__card" data-act="all-map" aria-label="' + esc('우리 지도' + (map.ready ? ' · 함께 ' + (map.count || 0) + '곳' : ' · 준비 중')) + '">' +
      '<span class="afeat__nm">우리 지도</span>' + mapPreview(map.tiles) +
      (map.ready ? '<span class="afeat__ds">함께 ' + esc(map.count || 0) + '곳</span>' : '<span class="abadge">준비 중</span>') + '</button>' +
      '<button type="button" class="card afeat__card" data-act="all-diet" aria-label="운동·식단 · 준비 중">' +
      '<span class="afeat__nm">운동·식단</span><span class="afeat__ico">' + svg(36, ICON.run) + '</span>' +
      '<span class="abadge">준비 중</span></button></div>';
    var set = '<h2 class="asec">설정</h2><div class="alist">' +
      // 예전 머리말처럼 쓸 수 없을 땐 줄을 숨긴다 (알림 모듈 · 테마 모듈이 없을 때)
      (m.notify ? row('open-notify', 'bell', '알림', '', m.notify, '알림 설정 (' + m.notify + ')') : '') +
      (m.theme ? row('open-theme', 'palette', '테마·사람 색', '', m.theme, '테마·사람 색 (지금: ' + m.theme + ')') : '') +
      row('open-account', 'user', '계정', m.meName ? m.meName + ' 님으로 접속' : '', '', '계정' + (m.meName ? ' · ' + m.meName + ' 님으로 접속' : '')) +
      '</div>';
    return '<div class="all">' + us + feats + set + '</div>';
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

  var api = { tab: tab, accountSheet: accountSheet, mapPreview: mapPreview, TILES: TILES };
  root.RT = root.RT || {};
  root.RT.viewAll = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
