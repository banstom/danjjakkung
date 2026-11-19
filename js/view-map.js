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
    else if (m.seg === 'wish') body = wishTab(m.wish);
    else if (m.seg === 'been') body = beenTab(m.been);
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

  /** 지역 시트. s = app.js mapSheetModel() — mode: 'view' | 'record' | 'needstart'. v54: 다녀온 곳 = 요약 카드 + 접힌 방문 목록(C) */
  function sheet(s, entering) {
    var p = s.place, visited = p && p.visits.length > 0, body;
    var head = '<div class="sheet__head"><h2 id="mapsheet-title" class="sheet__title">' + esc(s.name) + '</h2>' +
      (visited ? '<span class="mchip mchip--both mchip--sm">함께 ' + p.visits.length + '번</span>' : '') + '</div>';
    if (s.mode === 'needstart') {
      body = head + '<p class="sheet__sub">먼저 단짝이 된 날을 정해 주세요</p>' +
        '<p class="mnote">단짝 지도는 단짝이 된 날부터 함께 다녀온 곳을 칠해요. 기념일에서 그날을 정하면 바로 기록할 수 있어요.</p>' +
        '<div class="mbtns mbtns--col"><button type="button" class="mbtn mbtn--solid" data-act="open-anniv">기념일 정하기</button>' +
        '<button type="button" class="mbtn" data-act="map-visit-cancel">돌아가기</button></div>';
    } else if (s.mode === 'record') {
      body = recordSheet(s);
    } else if (visited) {
      body = head + '<p class="sheet__sub">' + (s.summary && s.summary.rankNo ? '다녀온 곳 별점 ' + s.summary.rankNo + '위 · ' : '') + '마지막 ' + esc(s.lastText) +
        (s.wishNo ? ' · 또 가고 싶은 곳 ' + s.wishNo + '위' : '') + '</p>' +
        summaryCard(s.summary) +
        '<div class="mbtns mbtns--wrap"><button type="button" class="mbtn mbtn--solid" data-act="map-visit">또 다녀왔어요</button>' +
        (s.wishNo ? '<button type="button" class="mbtn" data-act="map-rank">순위 바꾸기</button>' : '<button type="button" class="mbtn" data-act="map-wish">또 가고 싶어요</button>') + '</div>' +
        (s.wishNo ? '<div class="mdel"><button type="button" class="text-btn" data-act="map-unwish">가고 싶은 곳에서 빼기</button></div>' : '') +
        visitList(s);
    } else if (s.wishNo) {
      body = '<div class="mwhead"><span class="mrankno mrankno--big" aria-hidden="true">' + s.wishNo + '</span><div class="mwhead__tx">' +
        '<h2 id="mapsheet-title" class="sheet__title">' + esc(s.name) + '</h2>' +
        '<p class="sheet__sub mwhead__sub">가고 싶은 곳 ' + s.wishNo + '위' + (p.wishNote ? ' · ' + esc(p.wishNote) : '') + '</p></div></div>' +
        '<div class="mbtns"><button type="button" class="mbtn mbtn--solid" data-act="map-visit">함께 다녀왔어요</button>' +
        '<button type="button" class="mbtn" data-act="map-rank">순위 바꾸기</button></div>' +
        '<div class="mdel"><button type="button" class="text-btn" data-act="map-unwish">가고 싶은 곳에서 빼기</button></div>';
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

  var STAR = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>';
  function stars(n, size) {
    var out = ''; for (var i = 1; i <= 5; i++) out += '<span class="mstar' + (i <= n ? ' is-on' : '') + (size ? ' mstar--' + size : '') + '">' + STAR + '</span>';
    return out;
  }
  function dot(slot) { return '<span class="mdot mdot--' + esc(slot || 'me') + '" aria-hidden="true"></span>'; }
  /** v54 요약 카드: 큰 평균 + 별 5개 + 「별점 n개 평균」 | 오른쪽에 사람별 평균 · 매긴 횟수.
      sm = { avgText, fill, count, me: { slot, name, avgText, n }, partner } */
  function summaryCard(sm) {
    if (!sm) return '';
    if (!sm.count) return '<div class="msum msum--empty"><p class="msum__none">아직 별점이 없어요</p><p class="mnote">방문 기록에서 각자 별점과 한 줄을 남길 수 있어요</p></div>';
    function row(w) {
      if (!w) return '';
      return '<li class="msum__who">' + dot(w.slot) + '<span class="msum__nm">' + esc(w.name) + '</span>' +
        '<span class="msum__v">' + (w.n ? '<b>' + esc(w.avgText) + '</b><span class="msum__n"> · ' + w.n + '번</span>' : '<span class="msum__n">—</span>') + '</span></li>';
    }
    return '<div class="msum"><div class="msum__big"><span class="msum__avg">' + esc(sm.avgText) + '</span>' +
      '<span class="msum__stars" role="img" aria-label="' + esc('평균 별점 ' + sm.avgText) + '">' + stars(sm.fill, 'sm') + '</span>' +
      '<span class="msum__cap">별점 ' + sm.count + '개 평균</span></div>' +
      '<ul class="msum__people">' + row(sm.me) + row(sm.partner) + '</ul></div>';
  }
  /** 접힌 줄의 「● ★5」 (없으면 「● —」) */
  function chipStar(slot, name, e) {
    var n = e && e.stars;
    return '<span class="mvchip">' + dot(slot) + (n ? '<span aria-hidden="true">★</span>' + n : '—') + '<span class="sr-only">' + esc(name + ' ' + (n ? '별 ' + n + '개' : '별점 없음')) + '</span></span>';
  }
  /** 방문 기록 목록 (C · 접힌 목록). 최근 방문부터, 펼치면 사람별 한 줄 */
  function visitList(s) {
    return '<h3 class="mvhead">방문 기록</h3><ul class="mvlist">' + s.visitsView.map(function (v) {
      var id = esc(v.id);
      var row = '<button type="button" class="mvrow" data-act="map-visit-toggle" data-v="' + id + '" aria-expanded="' + v.open + '" aria-controls="mv-' + id + '">' +
        '<span class="mvrow__when"><b>' + esc(v.date) + '</b><span class="mvrow__nth"> · ' + v.nth + '번째</span></span>' +
        '<span class="mvrow__chips">' + chipStar(s.meSlot, s.meName, v.me) + (s.hasPartner ? chipStar(s.partnerSlot, s.partnerName, v.partner) : '') + '</span>' +
        '<svg class="mvrow__chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>';
      var body = '';
      if (v.open) {
        var mine = v.me, mineTx = mine && mine.note ? esc(mine.note) : mine && mine.stars ? '<span class="mvnote__add">＋ 한 줄 남기기</span>' : '<span class="mvnote__add">＋ 별점 · 한 줄 남기기</span>';
        body = '<div class="mvbody" id="mv-' + id + '">' +
          '<button type="button" class="mvnote mvnote--mine" data-act="map-entry" data-v="' + id + '" aria-label="' + esc(v.date + ' 내 기록 ' + (mine ? '고치기' : '남기기')) + '">' + dot(s.meSlot) + '<b class="mvnote__who">' + esc(s.meName) + '</b><span class="mvnote__tx">' + mineTx + '</span></button>' +
          (s.hasPartner ? '<div class="mvnote">' + dot(s.partnerSlot) + '<b class="mvnote__who">' + esc(s.partnerName) + '</b><span class="mvnote__tx' + (v.partner && v.partner.note ? '' : ' mvnote__tx--sub') + '">' +
            (v.partner ? (v.partner.note ? esc(v.partner.note) : '한 줄은 안 남겼어요') : '아직 안 남겼어요') + '</span></div>' : '') +
          // v56: 펼친 줄에서 바로 지우기 (두 번 눌러야 — 두 사람 기록이 함께 사라지므로)
          '<div class="mvdel"><button type="button" class="text-btn' + (s.confirmDel === v.id ? ' text-btn--warn' : '') + '" data-act="map-visit-del" data-v="' + id + '"' + (s.deleting ? ' disabled' : '') + '>' +
          (s.confirmDel === v.id ? '한 번 더 누르면 이 방문과 두 사람 기록을 모두 지워요' : '이 방문 지우기') + '</button></div></div>';
      }
      return '<li class="mvitem">' + row + body + '</li>';
    }).join('') + '</ul><p class="mnote">줄을 누르면 메모가 펼쳐져요 · 내 칸을 누르면 별점과 한 줄을 남기거나 고쳐요 · 잘못 적은 방문은 펼친 줄 아래에서 지워요</p>';
  }
  /** 기록 남기기 시트 (또 다녀왔어요 · 함께 다녀왔어요 · 내 기록 고치기 공통) */
  function recordSheet(s) {
    var f = s.form, editing = !!f.vid, starsHtml = '';
    for (var i = 1; i <= 5; i++) starsHtml += '<button type="button" class="mrec__star' + (i <= (f.stars || 0) ? ' is-on' : '') + '" data-act="map-rec-star" data-v="' + i + '" role="radio" aria-checked="' + (f.stars === i) + '" aria-label="별 ' + i + '개">' + STAR + '</button>';
    var title = esc(s.name) + ' · ' + (editing ? f.nth + '번째 방문' : (s.place && s.place.visits.length ? '또 다녀왔어요' : '함께 다녀왔어요'));
    return '<div class="sheet__head"><h2 id="mapsheet-title" class="sheet__title">' + title + '</h2></div>' +
      '<p class="sheet__sub">' + (editing ? esc(s.dateText) + ' · ' : f.nth + '번째 방문 · ') + '내 별점과 메모만 남겨요. 단짝은 자기 칸을 따로 채워요</p>' +
      '<div class="mform">' +
      (editing ? '' : '<label class="field"><span class="field__label">다녀온 날</span><input id="mp-date" class="field__input" type="date"' + (s.startKey ? ' min="' + esc(s.startKey) + '"' : '') + ' max="' + esc(s.todayKey) + '" value="' + esc(f.date) + '"></label>' +
        (s.startText ? '<p class="mnote">다녀온 날은 단짝이 된 날(' + esc(s.startText) + ')부터 고를 수 있어요</p>' : '')) +
      '<div class="field"><span class="field__label" id="mrec-label">' + dot(s.meSlot) + '내 별점</span>' +
      '<div class="mrec__stars" role="radiogroup" aria-labelledby="mrec-label">' + starsHtml + '</div><p class="mnote">같은 별을 다시 누르면 지워져요 · 별점은 선택이에요</p></div>' +
      '<label class="field"><span class="field__label">한 줄 메모 (선택)</span><input id="mp-note" class="field__input" type="text" maxlength="' + s.noteMax + '" autocomplete="off" enterkeyhint="done" placeholder="예: 익선동 붕어빵 또 먹으러 가자" value="' + esc(f.note) + '"></label>' +
      (editing || !s.hasPartner ? '' : '<p class="mrec__nudge">' + dot(s.partnerSlot) + '저장하면 단짝에게 「별점을 남겨 주세요」 알림이 가요</p>') +
      (f.error ? '<p class="rform__error"' + (f.errorFresh ? ' role="alert"' : '') + '>' + esc(f.error) + '</p>' : '') +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="map-visit-cancel">돌아가기</button>' +
      '<button type="button" class="solid-btn" data-act="map-visit-save"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : '저장') + '</button></div>' +
      // 방문 지우기는 확인을 받은 뒤 (두 사람 기록이 함께 사라지므로)
      (editing ? '<div class="mdel"><button type="button" class="text-btn' + (f.confirmDelete ? ' text-btn--warn' : '') + '" data-act="map-visit-delete"' + (f.saving ? ' disabled' : '') + '>' +
        (f.confirmDelete ? '한 번 더 누르면 이 방문과 두 사람 기록을 모두 지워요' : '방문 지우기') + '</button></div>' : '') + '</div>';
  }

  /** 가고 싶은 곳 칸. w = { rows: [{ code, no, name, note, again }] } */
  function wishTab(w) {
    var rows = w.rows;
    return '<div class="mlisthead"><h2 class="mlisthead__t">다음에 함께 갈 곳 ' + rows.length + '</h2>' + (rows.length > 1 ? '<span class="mlisthead__hint">끌어서 순위 바꾸기</span>' : '') + '</div>' +
      (rows.length ? '<ol class="mlist mlist--wish" id="mwish">' + rows.map(function (r) {
        return '<li class="mrow" data-code="' + esc(r.code) + '"><button type="button" class="mrow__main" data-act="map-open" data-v="' + esc(r.code) + '">' +
          '<span class="mrankno" aria-hidden="true">' + r.no + '</span><span class="mrow__tx"><span class="mrow__nm">' + esc(r.name) +
          (r.again ? '<span class="mchip mchip--both mchip--xs">또 가기</span>' : '') + '</span>' + (r.note ? '<span class="mrow__ds">' + esc(r.note) + '</span>' : '') + '</span>' +
          '<span class="sr-only">' + r.no + '위</span></button>' +
          '<span class="mrow__grip" data-grip="' + esc(r.code) + '" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg></span></li>';
      }).join('') + '</ol>' : '<section class="card notice"><p class="notice__body">아직 가고 싶은 곳이 없어요. 지도에서 지역을 누르거나 아래 버튼으로 담아 보세요.</p></section>') +
      '<button type="button" class="madd" data-act="map-wish-add">＋ 가고 싶은 곳 더하기</button>' +
      '<p class="mnote">함께 다녀오면 이 목록에서 빠지고 지도에 색이 칠해져요</p>';
  }

  var SORTS = [['stars', '별점 순'], ['recent', '최근 순'], ['many', '많이 간 순']];
  /** 다녀온 곳 칸. b = { sort, rows: [{ code, name, count, lastText, fill }] } */
  function beenTab(b) {
    return '<div class="msort" role="group" aria-label="정렬">' + SORTS.map(function (x) {
      return '<button type="button" class="msort__btn" data-act="map-sort" data-v="' + x[0] + '" aria-pressed="' + (b.sort === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>' +
      (b.rows.length ? '<ul class="mlist">' + b.rows.map(function (r) {
        return '<li class="mrow"><button type="button" class="mrow__main" data-act="map-open" data-v="' + esc(r.code) + '" aria-label="' + esc(r.name + ' · ' + r.count + '번 · 별 ' + (r.fill || '없음')) + '">' +
          '<span class="mrow__tx"><span class="mrow__nm">' + esc(r.name) + '</span><span class="mrow__ds">' + r.count + '번 · 마지막 ' + esc(r.lastText) + '</span></span>' +
          '<span class="mrow__stars">' + stars(r.fill, 'sm') + '</span></button></li>';
      }).join('') + '</ul><p class="mnote">함께 다녀온 곳 ' + b.rows.length + '곳</p>' : '<section class="card notice"><p class="notice__body">아직 함께 다녀온 곳이 없어요. 지도에서 지역을 눌러 기록해 보세요.</p></section>');
  }

  /** 순위 고르기 화면 (A · 목록에 끼워 넣기). r = { name, rows: [{ code, name, isNew }], idx, note, saving, change } */
  function rankScreen(r, entering) {
    var n = r.rows.length;
    return '<div class="sheet-layer sheet-layer--full">' +
      '<section class="sheet mrank' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mrank-title">' +
      '<div class="mbar"><button type="button" class="mbar__btn" data-act="map-rank-close" aria-label="돌아가기"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + BACK + '</svg></button>' +
      '<h2 id="mrank-title" class="mbar__title">' + (r.change ? '몇 위로 옮길까요' : '몇 위로 담을까요') + '</h2></div>' +
      '<p class="mrank__sub"><b>' + esc(r.name) + '</b>을(를) 원하는 자리로 옮겨 주세요</p>' +
      '<ol class="mlist mlist--rank" id="mrank">' + r.rows.map(function (x, i) {
        if (x.isNew) return '<li class="mrow mrow--new" data-code="' + esc(x.code) + '"><span class="mrankno mrankno--on" aria-hidden="true">' + (i + 1) + '</span>' +
          '<span class="mrow__tx" data-grip="' + esc(x.code) + '"><span class="mrow__nm">' + esc(x.name) + '</span><span class="mrow__ds">' + (r.change ? '지금 고르는 곳' : '새로 담는 곳') + '</span></span>' +
          '<button type="button" class="mrow__mv" data-act="map-rank-move" data-v="-1" aria-label="한 칸 위로"' + (i === 0 ? ' disabled' : '') + '><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>' +
          '<button type="button" class="mrow__mv" data-act="map-rank-move" data-v="1" aria-label="한 칸 아래로"' + (i === n - 1 ? ' disabled' : '') + '><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></li>';
        return '<li class="mrow mrow--ro"><span class="mrankno" aria-hidden="true">' + (i + 1) + '</span><span class="mrow__tx"><span class="mrow__nm">' + esc(x.name) + '</span></span></li>';
      }).join('') + '</ol>' +
      '<label class="field mrank__note"><span class="field__label">메모 (선택)</span><input id="mp-wnote" class="field__input" type="text" maxlength="100" autocomplete="off" enterkeyhint="done" placeholder="예: 벚꽃 필 때, 1박 2일" value="' + esc(r.note) + '"></label>' +
      (r.error ? '<p class="rform__error" role="alert">' + esc(r.error) + '</p>' : '') +
      '<button type="button" class="mbtn mbtn--solid mrank__go" data-act="map-rank-save"' + (r.saving ? ' disabled' : '') + '>' + (r.saving ? '저장 중…' : (r.idx + 1) + '위로 ' + (r.change ? '옮기기' : '담기')) + '</button>' +
      '</section></div>';
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

  var api = { HOME: HOME, mapSvg: mapSvg, screen: screen, sheet: sheet, findSheet: findSheet, findResults: findResults, wishTab: wishTab, beenTab: beenTab, rankScreen: rankScreen, summaryCard: summaryCard, visitList: visitList, recordSheet: recordSheet };
  root.RT = root.RT || {};
  root.RT.viewMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
