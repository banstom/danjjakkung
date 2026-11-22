/* eat(쿠키) 기능 (docs/eat) — 화면 그리기만. 값은 js/app-eat.js 가 만든다. 글은 js/eat-text.js 그대로, 쿠키 그림은 js/eat-cookie-svg.js.
   목업 design/mockups/chosen/eat/ (01~15 · art · name). 비밀 줄(단짝 쿠키가 통 안)은 모델에 음식 · 가게 · 메모가 없어서 그릴 수도 없다. */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var ET = NODE ? require('./eat-text.js') : root.RT.eatText;
  var EC = NODE ? require('./eat-cookie-svg.js') : root.RT.eatCookie;
  var T = ET.T;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(d, size) {
    size = size || 24;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var I = {
    back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0112 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>', next: '<path d="M9 5l7 7-7 7"/>',
    redo: '<path d="M20 11a8 8 0 00-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>', check: '<path d="M5 12l5 5 9-10"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
  };
  function ck(who, open, size, cls, style) {
    var h = EC.cookieSvg({ who: who === 'partner' ? 'partner' : 'me', open: !!open, size: size || null });
    if (cls || style) h = h.replace('<span class="', '<span' + (style ? ' style="' + style + '"' : '') + ' class="' + (cls ? cls + ' ' : ''));
    return h;
  }
  function dot(slot) { return '<span class="dot dot--' + esc(slot) + ' ek-dot" aria-hidden="true"></span>'; }

  // ── 입구 (전체 탭 칸 12) ──
  /** m = { total, todayFood, newCount, off } */
  /** 입구 그림: 도트 테마는 테마 그림(s2 — 먹거리 둘), 그 밖엔 쿠키 */
  function entryArt() {
    var t = root.RT && root.RT.themes && root.RT.themes.artHtml ? root.RT.themes.artHtml('s2', 'afeat__art') : '';
    return t || ck('me', true, 44);
  }
  function entry(m) {
    var line = m.off ? '저장 규칙 배포 뒤에 열려요' : m.todayFood ? T.entryToday(m.todayFood) : T.entrySub;
    return '<button type="button" class="card afeat__card ek-entry" data-act="ek-open" aria-label="' + esc(T.name + ' · ' + line + (m.off ? '' : ' · ' + T.entryCount(m.total) + (m.newCount ? ' · ' + T.entryNew(m.newCount) : ''))) + '">' +
      '<span class="ek-entry__head"><span class="afeat__nm">' + esc(T.name) + '</span>' + entryArt() + '</span>' +
      '<span class="ek-entry__line' + (m.todayFood ? ' is-today' : '') + '">' + esc(line) + '</span>' +
      (m.off ? '' : '<span class="ek-entry__st">' + esc(T.entryCount(m.total)) + (m.newCount ? '<span class="ek-new">' + esc(T.entryNew(m.newCount)) + '</span>' : '') + '</span>') + '</button>';
  }

  // ── 유리병 ── (쿠키는 정해진 13자리에, 넘치면 개수만)
  var SPOTS = [[8, 4, -8], [66, 2, 6], [124, 4, -4], [180, 6, 10], [34, 38, 12], [94, 36, -10], [152, 40, 4], [6, 72, -6], [64, 70, 8], [122, 74, -12], [180, 72, 6], [90, 106, -4], [148, 106, 8]];
  /** j = { total, whos: ['me'|'partner', …] (아래부터), fresh: 0~12 | -1, small } */
  function jar(j) {
    var body = j.whos.slice(0, SPOTS.length).map(function (w, i) {
      var p = SPOTS[i];
      return ck(w, false, null, i === j.fresh ? 'is-fresh' : '', 'left:' + p[0] + 'px;bottom:' + p[1] + 'px;transform:rotate(' + p[2] + 'deg)');
    }).join('');
    var label = j.total ? '<div class="ek-jar__label"><b>' + j.total + '</b><span>개</span></div>' : '<div class="ek-jar__label ek-jar__label--empty"><span>' + esc(T.jarEmpty) + '</span></div>';
    return '<div class="ek-jar' + (j.small ? ' ek-jar--sm' : '') + '" role="img" aria-label="' + esc('쿠키 통, 쿠키 ' + j.total + '개') + '"><div class="ek-jar__lid"></div><div class="ek-jar__neck"></div><div class="ek-jar__body">' + body + '</div>' + label + '</div>';
  }
  function jarLine(s, meSlot, herSlot) {
    if (!s.total) return '';
    return '<p class="ek-jarline">' + dot(meSlot) + esc(T.jarMine(s.mine)) + dot(herSlot) + esc(T.jarPartner(s.partner)) + (s.oldestAgo ? '<span>' + esc(T.jarOldest(s.oldestAgo)) + '</span>' : '') + '</p>';
  }
  function bar(title, back, extra) {
    return '<div class="mbar"><button type="button" class="mbar__btn" data-act="' + back[0] + '" aria-label="' + esc(back[1]) + '">' + svg(back[2] || I.back) + '</button><h1 class="mbar__title">' + esc(title) + '</h1>' + (extra || '') + '</div>';
  }

  // ── 쿠키 통 (01 · 08 · 11) ──
  /** m = { summary, jar, meSlot, herSlot, n, who, canDraw, today: null | { kick, food, sub, memo, canKung }, empty } */
  function jarScreen(m) {
    var head = bar(T.name, ['ek-close', '전체로 돌아가기'], m.empty ? '' : '<button type="button" class="mbar__btn" data-act="ek-list" aria-label="' + esc(T.listButtonLabel) + '">' + svg(I.list) + '</button>');
    if (m.empty) {
      return '<div class="mscreen ek">' + head + jar(m.jar) + '<div class="ek-steps">' + T.emptySteps.map(function (s, i) {
        return '<div class="ek-step"><b>' + (i + 1) + '</b><span>' + esc(s) + '</span></div>';
      }).join('') + '</div><div class="ek-actions"><button type="button" class="solid-btn ek-grow" data-act="ek-add">' + svg(I.plus, 20) + esc(T.firstCookie) + '</button></div></div>';
    }
    var today = '';
    if (m.today) {
      var t = m.today;
      today = '<div class="ek-today"><p class="ek-today__kick">' + esc(t.kick) + '</p><p class="ek-today__food">' + esc(t.food) + '</p>' +
        '<p class="ek-today__sub">' + esc(t.sub) + '</p>' + (t.place ? '<p class="ek-slip__maps ek-today__maps">' + mapLinks(t.place) + '</p>' : '') + (t.memo ? '<p class="ek-today__memo">' + esc(t.memo) + '</p>' : '') +
        '<div class="ek-today__btns"><button type="button" class="ghost-btn ek-btn" data-act="ek-kung"' + (t.canKung ? '' : ' disabled') + '>' + svg(I.send, 18) + esc(T.kungButton) + '</button>' +
        '<button type="button" class="solid-btn ek-btn" data-act="ek-ate">' + svg(I.check, 18) + esc(T.ateButton) + '</button></div>' +
        '<button type="button" class="ek-tbtn" data-act="ek-return">' + svg(I.undo, 18) + esc(T.returnButton) + '</button></div>';
    }
    var controls = m.today ? '<p class="ek-hint">' + esc(T.todayLockHint) + '</p>' :
      '<p class="field__label ek-sec">' + esc(T.howMany) + '</p><div class="seg seg--full" role="group" aria-label="' + esc(T.howMany) + '">' + [1, 2, 3].map(function (k) {
        return '<button type="button" class="seg__btn" data-act="ek-n" data-v="' + k + '" aria-pressed="' + (m.n === k) + '">' + esc(T.countOption(k)) + '</button>';
      }).join('') + '</div><div class="ek-chips" role="group" aria-label="누구 쿠키">' + [['all', T.whoAll], ['me', T.whoMine], ['partner', T.whoPartner]].map(function (x) {
        return '<button type="button" class="ek-pill" data-act="ek-who" data-v="' + x[0] + '" aria-pressed="' + (m.who === x[0]) + '">' + esc(x[1]) + '</button>';
      }).join('') + '</div>';
    return '<div class="mscreen ek">' + head + today + jar(m.jar) + jarLine(m.summary, m.meSlot, m.herSlot) + controls +
      '<div class="ek-actions"><button type="button" class="ghost-btn ek-add" data-act="ek-add">' + svg(I.plus, 20) + esc(T.addButton) + '</button>' +
      '<button type="button" class="solid-btn ek-grow" data-act="ek-crack"' + (m.canDraw ? '' : ' disabled') + '>' + esc(m.today ? T.crackButtonToday : T.crackButton(m.n)) + '</button></div></div>';
  }

  // ── 쿠키 넣기 · 고치기 (02) ──
  /** f = { edit, written, food, place, memo, error, saving, confirmOut } */
  function writeScreen(f) {
    var memoN = Array.from(f.memo || '').length;
    var place = f.place ? '<div class="ek-placebox">' + svg(I.pin, 20) + '<b>' + esc(f.place.name) + (f.place.kakaoId ? '<small>' + esc(T.placeKakaoTag) + '</small>' : '') + '</b>' +
      '<button type="button" class="mbar__btn" data-act="ek-place-clear" aria-label="음식점 지우기">' + svg(I.x, 20) + '</button></div>'
      : '<button type="button" class="ek-placebox ek-placebox--empty" data-act="ek-place">' + svg(I.pin, 20) + '<span>' + esc(T.placeSheetTitle) + '</span></button>';
    return '<div class="mscreen ek">' + bar(f.edit ? '쿠키 고치기' : T.writeTitle, ['ek-write-close', '닫기', I.x],
      f.edit ? '<button type="button" class="text-btn text-btn--warn" data-act="ek-out">' + (f.confirmOut ? '한 번 더 누르면 빼요' : '빼기') + '</button>' : '') +
      '<div class="ek-form">' +
      '<div class="ek-stamp">' + dot(f.slot || 'me') + esc(T.written(f.written)) + (f.edited ? ' · ' + esc(T.edited) : '') + '</div>' +
      '<label class="ek-fld"><span>' + esc(T.foodLabel) + '</span><input id="ek-food" class="field__input ek-food" type="text" maxlength="20" autocomplete="off" enterkeyhint="next" value="' + esc(f.food || '') + '"' + (f.error ? ' aria-invalid="true" aria-describedby="ek-err"' : '') + '></label>' +
      '<div class="ek-fld"><span>' + esc(T.placeLabel) + '<small>' + esc(T.placeOptional) + '</small></span>' + place + '</div>' +
      '<label class="ek-fld"><span>' + esc(T.memoLabel) + '</span><textarea id="ek-memo" class="field__input field__input--memo" maxlength="100" rows="3">' + esc(f.memo || '') + '</textarea><em id="ek-memo-n" class="ek-count">' + esc(T.memoCount(memoN, 100)) + '</em></label>' +
      (f.error ? '<p id="ek-err" class="ek-err" role="alert">' + esc(f.error) + '</p>' : '') +
      '</div><p class="ek-hint ek-hint--c">' + esc(T.secretHint) + '</p>' +
      '<div class="ek-actions"><button type="button" class="solid-btn ek-grow" data-act="ek-write-save"' + (f.saving || !String(f.food || '').trim() ? ' disabled' : '') + (f.saving ? ' aria-busy="true"' : '') + '>' + esc(f.edit ? '고치기' : T.foldButton) + '</button></div></div>';
  }
  /** 음식점 시트 (03) — E5(카카오 검색) 전에는 「이름만 적기」만. p = { q } */
  /** p = { q, items: null | [{ kakaoId, url, name, kind, area }], loading, error, pick: null | { i, name } } */
  function placeSheet(p, entering) {
    var head = '<div class="sheet-layer"><button type="button" class="scrim" data-act="ek-place-close" aria-label="닫기"></button>' +
      '<section class="sheet ek-sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="ek-place-t">' +
      '<span class="grabber" aria-hidden="true"></span><div class="sheet__head"><h2 id="ek-place-t" class="sheet__title">' + esc(T.placeSheetTitle) + '</h2></div>';
    if (p.pick && p.items && p.items[p.pick.i]) {
      var it = p.items[p.pick.i];
      return head + '<div class="ek-res ek-res--picked">' + svg(I.pin, 20) + '<span class="ek-res__tx"><b>' + esc(it.name) + '</b><span>' + esc([it.kind, it.area].filter(Boolean).join(' · ')) + '</span></span></div>' +
        '<label class="ek-fld" for="ek-place-nm"><span>' + esc(T.placeNameLabel) + '<small>' + esc(T.placeNameHint) + '</small></span>' +
        '<input id="ek-place-nm" class="field__input" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" value="' + esc(p.pick.name || '') + '"></label>' +
        '<div class="ek-sheet__btns"><button type="button" class="ghost-btn" data-act="ek-place-back">' + esc(T.placeBack) + '</button>' +
        '<button type="button" class="solid-btn" data-act="ek-place-ok">' + esc(T.placeOk) + '</button></div></section></div>';
    }
    return head + (p.search ? '<p class="ek-sub">' + esc(T.placeSheetSub) + '</p>' : '') +
      '<div class="ek-search">' + (p.search ? svg(I.search, 20) : '') +
      '<input id="ek-place-q" class="field__input" type="text" maxlength="40" autocomplete="off" enterkeyhint="search" aria-label="음식점 이름" placeholder="음식점 이름" value="' + esc(p.q || '') + '"></div>' +
      '<div id="ek-place-res" aria-live="polite">' + placeRows(p) + '</div></section></div>';
  }
  function hilite(name, q) {
    var i = q ? name.indexOf(q) : -1;
    if (i < 0) return esc(name);
    return esc(name.slice(0, i)) + '<em>' + esc(q) + '</em>' + esc(name.slice(i + q.length));
  }
  /** p = 문자열(검색어) 또는 시트 상태 */
  function placeRows(p) {
    if (typeof p === 'string') p = { q: p };
    var q = String(p.q || '').trim();
    if (!q) return '<p class="ek-hint">' + esc(p.search ? T.placeSheetSub : T.placeNameOnlySub) + '</p>';
    var rows = '';
    if (p.loading && !(p.items && p.items.length)) rows += '<p class="ek-hint">' + esc(T.placeSearching) + '</p>';
    else if (p.error) rows += '<p class="ek-hint ek-hint--warn">' + esc(p.error) + '</p>';
    else if (p.items && !p.items.length) rows += '<p class="ek-hint">' + esc(T.placeNone) + '</p>';
    (p.items || []).forEach(function (it, i) {
      rows += '<button type="button" class="ek-res" data-act="ek-place-pick" data-v="' + i + '">' + svg(I.pin, 20) + '<span class="ek-res__tx"><b>' + hilite(it.name, q) + '</b><span>' + esc([it.kind, it.area].filter(Boolean).join(' · ')) + '</span></span>' + svg(I.next, 18) + '</button>';
    });
    return rows + '<button type="button" class="ek-res" data-act="ek-place-name">' + svg(p.search ? I.pen : I.pin, 20) + '<span class="ek-res__tx"><b>' + esc(T.placeNameOnly(q)) + '</b><span>' + esc(T.placeNameOnlySub) + '</span></span></button>';
  }

  // ── 깨는 중 (05) ──
  /** m = { n, opened } */
  function crackScreen(m) {
    var cookies = '';
    for (var i = 0; i < m.n; i++) cookies += ck(i % 2 ? 'partner' : 'me', i < m.opened, null, 'ek-crack__ck' + (i < m.opened ? ' is-open' : ''));
    return '<div class="mscreen ek ek-cracking" data-act="ek-crack-skip">' + bar(T.crackingTitle, ['ek-pick-close', '쿠키 통으로 돌아가기']) +
      '<div class="ek-crackrow" aria-hidden="true">' + cookies + '</div><div class="ek-cracknote" aria-live="polite"><b>' + esc(T.crackingFirst) + '</b><span>' + esc(T.crackingSub(m.n)) + '</span></div></div>';
  }

  // ── 펼친 쪽지 · 고르기 (06 · 07) ──
  /** s = { id, mine, slot, ago, food, place: null | { name, sigungu?, url? }, memo, written } */
  function mapLink(label, url) { return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + svg(I.next, 14) + '</a>'; }
  /** 가게 이름 → 카카오맵(장소면 그 장소, 아니면 검색) · 네이버 지도(검색) */
  function mapLinks(pl) {
    return mapLink(T.kakaoLink, pl.url || ('https://map.kakao.com/?q=' + encodeURIComponent(pl.name))) + mapLink(T.naverLink, 'https://map.naver.com/p/search/' + encodeURIComponent(pl.name));
  }
  function slip(s, cls) {
    var place = s.place ? '<div class="ek-slip__place">' + svg(I.pin, 18) + '<span>' + esc(s.place.name) + '</span>' + (s.place.area ? '<small>' + esc(s.place.area) + '</small>' : '') +
      (/compact/.test(cls || '') ? '' : '<span class="ek-slip__maps">' + mapLinks(s.place) + '</span>') + '</div>'
      : '<div class="ek-slip__place is-none">' + svg(I.pin, 18) + '<span>' + esc(T.noPlace) + '</span></div>';
    return '<div class="ek-slip' + (cls ? ' ' + cls : '') + '"><div class="ek-slip__head">' + dot(s.slot) + esc(s.mine ? T.slipMine : T.slipPartner) + '<span class="ek-sp"></span>' + esc(s.ago) + '</div>' +
      '<p class="ek-slip__food">' + esc(s.food) + '</p>' + place + (s.memo ? '<p class="ek-slip__memo">' + esc(s.memo) + '</p>' : '') +
      '<p class="ek-slip__foot">' + esc(T.written(s.written)) + '</p></div>';
  }
  /** m = { n, slips, picked, single: { sub } | null, busy } */
  function pickScreen(m) {
    var head = bar(m.single ? T.name : T.resultTitle(m.slips.length), ['ek-pick-close', '쿠키 통으로 돌아가기']);
    var chosen = m.slips.filter(function (s) { return s.id === m.picked; })[0];
    var body;
    if (m.single) {
      var s0 = m.slips[0];
      body = '<p class="ek-caption">' + esc(m.single.sub) + '</p>' + slip(s0, 'ek-slip--big');
      chosen = s0;
    } else {
      body = '<p class="ek-caption">' + esc(T.resultSub) + '</p><div class="ek-slist">' + m.slips.map(function (s) {
        var on = s.id === m.picked;
        return '<button type="button" class="ek-pick" data-act="ek-pick" data-v="' + esc(s.id) + '" aria-pressed="' + on + '" aria-label="' + esc(s.food + (on ? ' · 고름' : '')) + '"><span class="ek-ring">' + (on ? svg(I.check, 16) : '') + '</span>' + slip(s, 'ek-slip--compact') + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="mscreen ek">' + head + body + '<div class="ek-actions"><button type="button" class="ghost-btn ek-add" data-act="ek-redraw"' + (m.busy ? ' disabled' : '') + '>' + svg(I.redo, 20) + esc(T.redraw) + '</button>' +
      '<button type="button" class="solid-btn ek-grow" data-act="ek-choose"' + (chosen && !m.busy ? '' : ' disabled') + '>' + esc(chosen ? T.pickFood(chosen.food) : T.pickNone) + '</button></div></div>';
  }

  // ── 먹었어요 (09) · 별점만 (먹은 뒤) ──
  /** a = { food, stars, note, together, again, saving, rateOnly, error } */
  function ateSheet(a, entering) {
    var stars = '<div class="ek-stars" role="group" aria-label="내 별점">' + [1, 2, 3, 4, 5].map(function (k) {
      return '<button type="button" class="ek-star' + (k <= a.stars ? ' is-on' : '') + '" data-act="ek-star" data-v="' + k + '" aria-pressed="' + (a.stars === k) + '" aria-label="별 ' + k + '개">' + svg(I.star, 28) + '</button>';
    }).join('') + '</div>';
    function sw(act, on, title, sub) {
      return '<div class="nrow"><div class="nrow__text"><span class="nrow__title" id="' + act + '-l">' + esc(title) + '</span><span class="nrow__desc">' + esc(sub) + '</span></div>' +
        '<button type="button" class="switch" role="switch" aria-checked="' + !!on + '" aria-labelledby="' + act + '-l" data-act="' + act + '"><span class="switch__knob"></span></button></div>';
    }
    return '<div class="sheet-layer"><button type="button" class="scrim" data-act="ek-ate-close" aria-label="닫기"></button>' +
      '<section class="sheet ek-sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="ek-ate-t">' +
      '<span class="grabber" aria-hidden="true"></span><div class="sheet__head"><h2 id="ek-ate-t" class="sheet__title">' + esc(T.ateTitle(a.food)) + '</h2></div>' +
      '<p class="sheet__sub">' + esc(T.ateSub) + '</p>' + stars +
      '<label class="ek-fld"><span>' + esc(T.oneLine) + '</span><input id="ek-note" class="field__input" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" value="' + esc(a.note || '') + '"></label>' +
      (a.rateOnly ? '' : '<div class="nlist ek-sw">' + sw('ek-together', a.together, T.together, T.togetherSub) + sw('ek-again', a.again, T.again, T.againSub) + '</div>') +
      (a.error ? '<p class="ek-err" role="alert">' + esc(a.error) + '</p>' : '') +
      '<button type="button" class="solid-btn solid-btn--full ek-save" data-act="ek-ate-save"' + (a.stars && !a.saving ? '' : ' disabled') + '>' + esc(T.save) + '</button></section></div>';
  }
  /** 짝꿍 지도 칠하기 물음 (7절) */
  function paintSheet(p, entering) {
    return '<div class="sheet-layer"><button type="button" class="scrim" data-act="ek-paint-no" aria-label="닫기"></button>' +
      '<section class="sheet ek-sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="ek-paint-t">' +
      '<span class="grabber" aria-hidden="true"></span><div class="sheet__head"><h2 id="ek-paint-t" class="sheet__title">' + esc(T.paintAsk(p.area)) + '</h2></div>' +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="ek-paint-no">괜찮아요</button><button type="button" class="solid-btn" data-act="ek-paint-yes"' + (p.busy ? ' disabled' : '') + '>칠하기</button></div></section></div>';
  }

  // ── 넣어 둔 쿠키 (10) ──
  /** m = { tab, counts, rows: listRows 결과 + slot } */
  function listScreen(m) {
    var seg = '<div class="seg seg--full ek-tabs" role="group" aria-label="보기"><button type="button" class="seg__btn" data-act="ek-tab" data-v="jar" aria-pressed="' + (m.tab === 'jar') + '">' + esc(T.tabJar(m.counts.jar)) + '</button>' +
      '<button type="button" class="seg__btn" data-act="ek-tab" data-v="eaten" aria-pressed="' + (m.tab === 'eaten') + '">' + esc(T.tabEaten(m.counts.eaten)) + '</button></div>';
    var rows = m.rows.map(function (r) {
      var art = ck(r.mine ? 'me' : 'partner', true, 40);
      if (r.secret) return '<div class="ek-krow">' + art + '<span class="ek-krow__tx"><b class="is-secret">' + esc(T.secretName) + '</b><span>' + esc(T.secretSub) + '</span></span><span class="ek-krow__d">' + esc(r.date) + '</span></div>';
      var sub = r.again ? T.againTag + (r.avg != null ? ' · ' + T.lastStars(r.avg) : '') : [r.place || T.noPlaceShort, r.memo].filter(Boolean).join(' · ');
      if (m.tab === 'eaten') sub = (r.avg != null ? '★' + r.avg + ' · ' : '') + (r.place || T.noPlaceShort) + (r.memo ? ' · ' + r.memo : '');
      var inner = art + '<span class="ek-krow__tx"><b>' + esc(r.food) + '</b><span>' + esc(sub) + '</span></span><span class="ek-krow__d">' + esc(r.date) + '</span>';
      var act = m.tab === 'jar' ? (r.editable ? 'ek-edit' : null) : 'ek-rate';
      return act ? '<button type="button" class="ek-krow" data-act="' + act + '" data-v="' + esc(r.id) + '">' + inner + svg(I.next, 18) + '</button>' : '<div class="ek-krow">' + inner + '</div>';
    }).join('');
    return '<div class="mscreen ek">' + bar(T.listTitle, ['ek-list-close', '뒤로']) + seg +
      (rows ? '<div class="card ek-list">' + rows + '</div>' : '<div class="card ek-list ek-list--empty"><p class="muted">' + (m.tab === 'jar' ? esc(T.jarEmpty) : '아직 먹은 쿠키가 없어요') + '</p></div>') +
      '<p class="ek-hint">' + esc(T.listHint) + '</p></div>';
  }

  var api = { entry: entry, jarScreen: jarScreen, writeScreen: writeScreen, placeSheet: placeSheet, placeRows: placeRows, crackScreen: crackScreen, pickScreen: pickScreen, ateSheet: ateSheet, paintSheet: paintSheet, listScreen: listScreen, slip: slip, jar: jar };
  root.RT = root.RT || {};
  root.RT.viewEat = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
