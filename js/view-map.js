/* 단짝 지도 화면 (v48) — 목업 design/mockups/chosen/03-우리지도-지도 · 06-시트-안간곳.
   「전체」 탭 안에서 열린다(아래 탭은 그대로). 값은 places.js · app.js mapModel(), 확대 · 끌기는 app.js 가 viewBox 만 바꾼다. */
(function (root) {
  'use strict';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(d) {
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var BACK = '<path d="M15 6l-6 6 6 6"/>', FIND = '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>';
  // 처음 보이는 자리 = 한국 본토 + 제주 (목업과 같은 자리)
  var HOME = { x: 20, y: 140, w: 840, h: 910 };
  var SEGS = [['map', '지도'], ['wish', '가고 싶은 곳'], ['been', '다녀온 곳']];

  /** 지도 SVG. map = 지도 데이터, paint = { code: 'v' | 'w' | 'vw' }, sel = 고른 지역 코드, vb = { x, y, w, h } */
  function mapSvg(map, paint, sel, vb, label) {
    vb = vb || HOME;
    var out = '<svg class="km" id="km" viewBox="' + [vb.x, vb.y, vb.w, vb.h].map(function (n) { return Math.round(n * 10) / 10; }).join(' ') + '" role="img" aria-label="' + esc(label) + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><pattern id="kmhatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" style="fill:var(--empty)"/><line x1="0" y1="0" x2="0" y2="8" style="stroke:var(--accent)" stroke-width="3"/></pattern>' +
      '<pattern id="kmhatch2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" style="fill:var(--both)"/><line x1="0" y1="0" x2="0" y2="8" style="stroke:var(--accent)" stroke-width="3"/></pattern></defs>';
    out += (map.context || []).map(function (c) { return '<path class="cx" d="' + c.d + '"/>'; }).join('');
    var selPath = '';
    out += map.regions.map(function (r) {
      var p = paint[r.c] || '';
      if (r.c === sel) selPath = '<path class="sel" d="' + r.d + '"/>';
      return '<path class="rg' + (p ? ' ' + p : '') + '" data-code="' + r.c + '" d="' + r.d + '"/>';
    }).join('');
    out += '<path class="gb" d="' + map.groupBorder + '"/>' + selPath;
    out += (map.labels || []).map(function (l) { return '<text class="lb" x="' + l.p[0] + '" y="' + l.p[1] + '" text-anchor="middle">' + esc(l.t) + '</text>'; }).join('');
    return out + '</svg>';
  }

  /** m = { status: 'loading' | 'error' | 'ready', seg, counts, paint, sel, vb, map, off } */
  function screen(m) {
    var bar = '<div class="mbar"><button type="button" class="mbar__btn" data-act="map-close" aria-label="전체로 돌아가기">' + svg(BACK) + '</button>' +
      '<h1 class="mbar__title">단짝 지도</h1>' +
      '<button type="button" class="mbar__btn" data-act="map-find" aria-label="지역 찾기"' + (m.status === 'ready' ? '' : ' disabled') + '>' + svg(FIND) + '</button></div>';
    var seg = '<div class="mseg" role="group" aria-label="보기">' + SEGS.map(function (s) {
      return '<button type="button" class="mseg__btn" data-act="map-seg" data-v="' + s[0] + '" aria-pressed="' + (m.seg === s[0]) + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    var body;
    if (m.off) body = '<section class="card notice" role="status"><h2 class="notice__title">단짝 지도를 열 수 없어요</h2><p class="notice__body">저장 규칙이 아직 준비되지 않았어요. 잠시 뒤 다시 열어 주세요.</p></section>';
    else if (m.status === 'error') body = '<section class="card notice" role="status"><h2 class="notice__title">지도를 불러오지 못했어요</h2><p class="notice__body">인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>' +
      '<button type="button" class="small-btn" data-act="map-retry">다시 불러오기</button></section>';
    else if (m.status !== 'ready') body = '<section class="card" aria-busy="true"><p class="muted">지도를 불러오는 중…</p></section>';
    else if (m.seg !== 'map') body = '<section class="card notice" role="status"><h2 class="notice__title">' + (m.seg === 'wish' ? '가고 싶은 곳' : '다녀온 곳') + ' 목록은 곧 열려요</h2>' +
      '<p class="notice__body">지금은 지도에서 지역을 눌러 기록할 수 있어요.</p></section>';
    else {
      var c = m.counts;
      body = '<div class="mlegend"><span class="mchip mchip--both">함께 다녀온 곳 ' + c.visited + '</span>' +
        '<span class="mchip"><span class="mchip__hatch" aria-hidden="true"></span>가고 싶은 곳 ' + c.wished + '</span></div>' +
        // 지도 <svg> 는 app.js 가 한 번만 만들어 이 자리에 붙인다 (다시 그릴 때마다 140KB 를 새로 만들지 않게)
        '<div class="mwrap"><div class="kmslot" id="km-slot"></div>' +
        '<div class="mzoom"><button type="button" class="mzoom__btn" data-act="map-zoom" data-v="1" aria-label="크게">+</button>' +
        '<button type="button" class="mzoom__btn" data-act="map-zoom" data-v="-1" aria-label="작게">−</button></div></div>' +
        '<p class="mhint">지역을 누르면 기록하거나 가고 싶은 곳에 담을 수 있어요</p>' +
        '<p class="mcredit">지도: 통계청 SGIS 행정동 경계(공공누리 1유형)를 가공한 vuski/admdongkor ver20261001 (CC BY 4.0) · 배경 Natural Earth</p>';
    }
    return '<div class="mscreen">' + bar + seg + body + '</div>';
  }

  /** 지역 시트. s = { code, name, place(places.fromDoc | null), startText, mode: 'view' | 'visit', form, visitsView: [{ nth, date, note }], lastText } */
  function sheet(s, entering) {
    var p = s.place, visited = p && p.visits.length > 0, body;
    var head = '<div class="sheet__head"><h2 id="mapsheet-title" class="sheet__title">' + esc(s.name) + '</h2>' +
      (visited ? '<span class="mchip mchip--both mchip--sm">함께 ' + p.visits.length + '번</span>' : '') + '</div>';
    if (s.mode === 'needstart') {
      body = head + '<p class="sheet__sub">먼저 단짝이 된 날을 정해 주세요</p>' +
        '<p class="mnote">단짝 지도는 단짝이 된 날부터 함께 다녀온 곳을 칠해요. 기념일에서 그날을 정하면 바로 기록할 수 있어요.</p>' +
        '<div class="mbtns mbtns--col"><button type="button" class="mbtn mbtn--solid" data-act="open-anniv">기념일 정하기</button>' +
        '<button type="button" class="mbtn" data-act="map-visit-cancel">돌아가기</button></div>';
    } else if (s.mode === 'visit') {
      var f = s.form;
      body = head + '<p class="sheet__sub">' + (visited ? '또 다녀온 날을 적어요' : '함께 다녀온 날을 적어요') + '</p>' +
        '<div class="mform">' +
        '<label class="field"><span class="field__label">다녀온 날</span><input id="mp-date" class="field__input" type="date"' + (s.startKey ? ' min="' + esc(s.startKey) + '"' : '') + ' max="' + esc(s.todayKey) + '" value="' + esc(f.date) + '"></label>' +
        (s.startText ? '<p class="mnote">다녀온 날은 단짝이 된 날(' + esc(s.startText) + ')부터 고를 수 있어요</p>' : '') +
        '<label class="field"><span class="field__label">메모 (선택)</span><input id="mp-note" class="field__input" type="text" maxlength="' + s.noteMax + '" autocomplete="off" enterkeyhint="done" placeholder="예: 한옥마을 야경" value="' + esc(f.note) + '"></label>' +
        (f.error ? '<p class="rform__error"' + (f.errorFresh ? ' role="alert"' : '') + '>' + esc(f.error) + '</p>' : '') +
        '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="map-visit-cancel">돌아가기</button>' +
        '<button type="button" class="solid-btn" data-act="map-visit-save"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : '저장') + '</button></div></div>';
    } else if (visited) {
      body = head + '<p class="sheet__sub">마지막 ' + esc(s.lastText) + '</p>' +
        '<div class="mbtns"><button type="button" class="mbtn mbtn--solid" data-act="map-visit">또 다녀왔어요</button></div>' +
        '<ul class="mvisits">' + s.visitsView.map(function (v) {
          return '<li><span class="mvisits__when">' + esc(v.nth) + ' · ' + esc(v.date) + '</span><span class="mvisits__note">' + esc(v.note || '메모 없음') + '</span></li>';
        }).join('') + '</ul>';
    } else {
      body = head + '<p class="sheet__sub">아직 함께 가 보지 않은 곳</p>' +
        '<div class="mbtns mbtns--col"><button type="button" class="mbtn mbtn--solid" data-act="map-visit">함께 다녀왔어요</button>' +
        '<button type="button" class="mbtn" data-act="map-wish">가고 싶은 곳에 담기</button></div>' +
        (s.startText ? '<p class="mnote">다녀온 날은 단짝이 된 날(' + esc(s.startText) + ')부터 고를 수 있어요</p>' : '');
    }
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="map-unsel" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mapsheet-title">' +
      '<span class="grabber" aria-hidden="true"></span>' + body + '</section></div>';
  }

  /** 찾기 결과만 (입력칸은 그대로 두고 이 부분만 바꿔야 한글 조합 입력이 안 깨진다) */
  function findResults(f) {
    return f.q ? (f.results.length ? '<ul class="mfind">' + f.results.map(function (r) {
      return '<li><button type="button" class="mfind__row" data-act="map-pick" data-v="' + esc(r.code) + '"><span>' + esc(r.name) + '</span>' + (r.been ? '<span class="mchip mchip--both mchip--sm">함께 다녀옴</span>' : '') + '</button></li>';
    }).join('') + '</ul>' : '<p class="muted mfind__none">맞는 지역이 없어요</p>') : '<p class="muted mfind__none">시 · 군 · 구 이름을 적어 보세요</p>';
  }
  /** 지역 찾기 시트. f = { q, results: [{ code, name, been }] } */
  function findSheet(f, entering) {
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="map-find-close" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mapfind-title">' +
      '<span class="grabber" aria-hidden="true"></span><h2 id="mapfind-title" class="sheet__title">지역 찾기</h2>' +
      '<input id="mp-q" class="field__input mfind__q" type="search" autocomplete="off" enterkeyhint="search" placeholder="예: 남원, 해운대, 제주" value="' + esc(f.q) + '" aria-label="지역 이름">' +
      '<div id="mp-results" aria-live="polite">' + findResults(f) + '</div>' +
      '<button type="button" class="close-btn" data-act="map-find-close">닫기</button></section></div>';
  }

  var api = { HOME: HOME, mapSvg: mapSvg, screen: screen, sheet: sheet, findSheet: findSheet, findResults: findResults };
  root.RT = root.RT || {};
  root.RT.viewMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
