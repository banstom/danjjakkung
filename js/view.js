/* 화면 그리기 — model.js가 만든 값을 HTML 부품으로 바꾼다. 부품마다 함수 하나. */
(function (root) {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var TITLE = '단짝꿍';

  var CHECK_SVG = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var CHEVRON = {
    prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
  };

  // 머리말 (v47, 1안 「칩만 남기기」): 날짜 · 제목 · 「단짝이 된 지 N일」 칩.
  //  접속 · 로그아웃 · 🔔 · 🎨 은 「전체」 탭 설정으로 옮겼다. 「전체」 탭은 제목 「전체」, 칩 없음(우리 둘 카드에 있음)
  function header(h) {
    if (h.hidden) return '';
    // FT1 (docs/focus/tabs.md 3절): 전체 탭에서 연 돌아보기 화면 — ‹ 뒤로 + 제목, 날짜 · 칩 없음
    if (h.back) return '<header class="top top--back"><button type="button" class="top__back" data-act="look-back" aria-label="' + esc(h.back.label || '뒤로') + '">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<h1 class="title title--back">' + esc(h.back.title) + '</h1></header>';
    return '<header class="top">' +
      '<div class="top__text"><p class="caption">' + esc(h.date) +
      (h.canRepick ? ' · ' + esc(h.meName) + ' <button type="button" class="link-btn" data-act="repick">바꾸기</button>' : '') + '</p>' +
      '<div class="top__row"><h1 class="title">' + esc(h.title || TITLE) + '</h1>' +
      (h.dday ? '<button type="button" class="dday" data-act="open-anniv" aria-label="' + esc(h.dday.text + (h.dday.today ? ' · 오늘은 ' + h.dday.today : '') + ' · 기념일 보기') + '">' +
        '<span aria-hidden="true">' + (h.dday.today ? '🎉' : '💞') + '</span>' + esc(h.dday.text) + '</button>' : '') +
      '</div></div>' +
      // 도트 테마 그림 S1: 칩이 없는 머리말(「전체」 탭) 오른쪽 — 그림이 있는 테마에서만
      (!h.dday && root.RT && root.RT.themes ? root.RT.themes.artHtml('s1', 'top__art') : '') +
      '</header>';
  }

  // 「알림」 시트 — 이 기기 알림 켜기/끄기 + 내 알림 설정(모든 기기 공통)
  var SUPPORT_TEXT = {
    'standalone-needed': ['홈 화면 앱에서 켤 수 있어요', '사파리 공유 버튼 › 「홈 화면에 추가」로 설치한 뒤, 홈 화면의 단짝꿍 아이콘으로 열어 주세요.'],
    unsupported: ['이 브라우저에서는 알림을 받을 수 없어요', '안드로이드는 크롬, 아이폰은 홈 화면에 추가한 단짝꿍 앱에서 켤 수 있어요.'],
    denied: ['알림이 막혀 있어요', '휴대폰 설정 › 알림에서 단짝꿍(또는 브라우저)을 허용한 뒤 다시 열어 주세요.']
  };
  function switchRow(act, on, title, desc, disabled) {
    return '<div class="nrow"><div class="nrow__text"><span class="nrow__title" id="' + act + '-label">' + esc(title) + '</span><span class="nrow__desc">' + esc(desc) + '</span></div>' +
      '<button type="button" class="switch" role="switch" aria-checked="' + !!on + '" aria-labelledby="' + act + '-label" data-act="' + act + '"' + (disabled ? ' disabled' : '') + '><span class="switch__knob"></span></button></div>';
  }
  /** 교환 쪽지 알림 두 줄 (docs/question F13) — 문구는 question-text.js 그대로, 이름 묶음 */
  function qNotifyRows(p, off) {
    var QT = root.RT && root.RT.questionText;
    if (!QT) return '';
    var T = QT.T;
    return '<h3 class="mgroup">' + esc(T.name) + '</h3><div class="nlist">' +
      switchRow('pref-qremind', p.qRemind !== false, T.settingRemind, T.settingRemindSub, off) +
      switchRow('pref-qpartner', p.qPartner !== false, T.settingPartner, '', off) + '</div>';
  }
  function notifySheet(n, entering) {
    if (!n) return '';
    var dev;
    if (SUPPORT_TEXT[n.support]) {
      dev = '<div class="nbox"><p class="nbox__title">' + esc(SUPPORT_TEXT[n.support][0]) + '</p><p class="nbox__body">' + esc(SUPPORT_TEXT[n.support][1]) + '</p></div>';
    } else if (n.on) {
      dev = '<div class="nbox nbox--on"><p class="nbox__title">✅ 이 기기에서 알림을 받고 있어요</p>' +
        '<div class="nbox__actions"><button type="button" class="small-btn" data-act="push-test"' + (n.busy ? ' disabled' : '') + '>테스트 알림 보내기</button>' +
        '<button type="button" class="text-btn" data-act="push-off"' + (n.busy ? ' disabled' : '') + '>이 기기 알림 끄기</button></div></div>';
    } else {
      dev = '<button type="button" class="solid-btn solid-btn--full" data-act="push-on"' + (n.busy ? ' disabled' : '') + '>' + (n.busy ? '켜는 중…' : '🔔 이 기기에서 알림 켜기') + '</button>';
    }
    var p = n.prefs || { partner: true, remindAt: null, hide: false, weekly: true };
    var off = !n.prefsReady;
    var opts = '<option value=""' + (!p.remindAt ? ' selected' : '') + '>끄기</option>' + n.times.map(function (t) {
      return '<option value="' + t + '"' + (p.remindAt === t ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close-notify" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="notify-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="notify-title" class="sheet__title">알림</h2></div>' +
      '<p class="sheet__sub">짝꿍이 체크하거나, 내가 깜빡했을 때 휴대폰으로 알려 줘요</p>' +
      dev +
      (n.error ? '<p class="rform__error"' + (n.errorFresh ? ' role="alert"' : '') + '>' + esc(n.error) + '</p>' : '') +
      (n.info ? '<p class="nbox__info" role="status">' + esc(n.info) + '</p>' : '') +
      '<h3 class="mgroup">받을 알림</h3>' +
      '<div class="nlist">' +
      switchRow('pref-partner', p.partner, '짝꿍 완료 알림', '짝꿍이 루틴을 체크하면 바로 알려 줘요', off) +
      '<div class="nrow"><div class="nrow__text"><label class="nrow__title" for="nt-remind">저녁 미완료 알림</label><span class="nrow__desc">이 시간까지 내 루틴을 체크하지 않았으면 알려 줘요</span></div>' +
      '<select id="nt-remind" class="nselect"' + (off ? ' disabled' : '') + '>' + opts + '</select></div>' +
      switchRow('pref-miss', p.miss !== false, '아침에 어제 놓친 루틴 알려 주기', '어제 못 한 내 루틴이 있으면 아침 8시에 알려 줘요 · 이틀 연속은 안 놓치게', off) +
      switchRow('pref-todo', p.todo !== false && p.partner, '함께 할 일 알림', '짝꿍이 함께 할 일을 추가하거나 끝내면 알려 줘요' + (p.partner ? '' : ' · 짝꿍 알림을 켜야 와요'), off || !p.partner) +
      switchRow('pref-map', p.map !== false, '단짝 지도 별점 알림', '짝꿍이 함께 다녀온 곳을 기록하면 「별점을 남겨 주세요」 하고 알려 줘요', off) +
      switchRow('pref-weekly', p.weekly !== false, '일요일 저녁 돌아보기', '밤 9시에 이번 주 함께 해낸 것을 알려 줘요 · 누르면 돌아보기', off) +
      switchRow('pref-recap', p.recap !== false, '매달 1일 결산 알림', '아침 9시에 지난달 결산이 나오면 알려 줘요 · 누르면 결산 카드', off) +
      switchRow('pref-hide', p.hide, '잠금 화면에서 루틴 이름 숨기기', '「새 기록이 있어요」처럼만 보여요 · 함께 할 일 이름도 숨겨요', off) +
      '</div>' + qNotifyRows(p, off) +
      '<p class="muted nfoot">설정은 내 모든 기기에 같이 적용돼요.</p>' +
      '<button type="button" class="close-btn" data-act="close-notify">닫기</button>' +
      '</section></div>';
  }

  // 테마 시트 위쪽: 지금 테마에서 쓸 나 · 상대 색. 테마마다 따로, 내 계정에 저장(내 화면에만 쓰인다).
  // 색 값은 js/themes.js 의 후보에서만 온다.
  function personColors(c) {
    if (!c) return '';
    var other = { self: c.rows[1].label, partner: '나' };
    return '<section class="tcolors" aria-labelledby="tcolors-title">' +
      '<div class="tcolors__head"><h3 id="tcolors-title" class="tcolors__title">' + esc(c.themeName) + ' · 사람 색</h3>' +
      (c.custom ? '<button type="button" class="link-btn" data-act="reset-colors">기본 색으로</button>' : '') + '</div>' +
      '<p class="tcolors__sub">테마마다 따로 골라요 · 내 화면에만 보이고, 내 모든 기기에 같이 저장돼요</p>' +
      c.rows.map(function (r) {
        var cur = r.options.filter(function (o) { return o.on; })[0];
        return '<div class="tcolors__row">' +
          '<span class="tcolors__who" style="background:' + esc(r.value) + ';color:' + esc(cur ? cur.ink : '') + '">' + esc(r.label) + '</span>' +
          '<div class="cpicks" role="group" aria-label="' + esc(r.label + ' 색') + '">' + r.options.map(function (o) {
            var label = o.name + (o.both ? ' — 함께 일정 색이라 고를 수 없어요' : o.on ? ', 고른 색' : o.taken ? ' — ' + other[r.who] + ' 색, 누르면 서로 바뀌어요' : '');
            return '<button type="button" class="cpick' + (o.taken ? ' is-taken' : '') + (o.both ? ' is-both' : '') + '" data-act="pick-color" data-who="' + r.who + '" data-v="' + esc(o.hex) + '" data-key="' + r.who + o.hex + '"' +
              ' style="background:' + esc(o.hex) + ';color:' + esc(o.ink) + '" aria-pressed="' + o.on + '" aria-label="' + esc(label) + '"' + (c.loading || o.both ? ' disabled' : '') + '>' +
              (o.both ? '<span class="cpick__tag" aria-hidden="true">함께</span>' : o.on ? CHECK_SVG : o.taken ? '<span class="cpick__tag" aria-hidden="true">' + esc(other[r.who].charAt(0)) + '</span>' : '') + '</button>';
          }).join('') + '</div></div>';
      }).join('') +
      '</section>';
  }

  // 「테마」 시트 (11/19 겨울 업데이트 → 11/23 C안, docs/themes-sheet/spec.md — 제목은 v53 결정대로 「테마」)
  // 위에서부터 낮 · 밤 / 「○월에 어울리는 테마」 카드 2장 / 「모든 테마」 묶음 목록(한 번에 한 묶음 펼침) / 글씨체 / 사람 색.
  // 카드 미리보기는 CSS 만: 그 테마의 지금 판(낮 · 밤) 색을 data-theme 으로 받는다. 누르면 바로 바뀌고 저장 버튼은 없다.
  // 묶음 · 이번 달 표는 js/themes.js 한 곳에 (t.groups · t.monthly 로 받음).
  var MODE_LABEL = { auto: '자동', light: '낮', dark: '밤' };
  function themeCard(th, t, where) {
    var on = th.id === t.current;
    var tags = (on ? ['<span class="ttag ttag--on">사용 중</span>'] : []).concat(th.modes ? ['<span class="ttag">낮·밤</span>'] : [])
      .concat((th.tags || []).map(function (x) { return '<span class="ttag">' + esc(x) + '</span>'; }))
      .concat(th.modes ? [] : ['<span class="ttag">' + (th.dark ? '어둡게' : '밝게') + '</span>']);
    return '<button type="button" class="tpick' + (on ? ' is-on' : '') + '" data-act="pick-theme" data-v="' + esc(th.id) + '" data-key="' + esc(where + ':' + th.id) + '" aria-pressed="' + on + '" aria-label="' + esc(th.ko + (th.name !== th.ko ? ' (' + th.name + ')' : '') + ' — ' + th.desc + (th.modes ? ', 낮·밤' : '') + (on ? ', 사용 중' : '')) + '">' +
      '<span class="tprev' + (th.skin ? ' tprev--' + th.skin : '') + '" data-theme="' + esc(th.board) + '" aria-hidden="true"><span class="tprev__card"><i class="tprev__bar"></i><i class="tprev__bar tprev__bar--sub"></i></span></span>' +
      '<span class="tpick__name">' + esc(th.ko) + '</span>' +
      '<span class="tpick__tags">' + tags.join('') + '</span>' +
      '</button>';
  }
  /** 묶음 줄의 테마 이름 나열 — 기본 묶음은 앞 두 개 + 「외 N」 */
  function groupNames(g) {
    var names = g.themes.map(function (th) { return th.ko; });
    if (g.id === 'basic' && names.length > 2) return names.slice(0, 2).join(' · ') + ' 외 ' + (names.length - 2);
    return names.join(' · ');
  }
  function groupRow(g, open) {
    return '<button type="button" class="tgl__row" data-act="theme-group" data-v="' + esc(g.id) + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="tg-' + esc(g.id) + '"' : '') +
      ' aria-label="' + esc(g.name + ' · ' + g.themes.length + '개 — ' + g.themes.map(function (th) { return th.ko; }).join(', ') + (open ? ', 펼침' : '')) + '">' +
      '<span class="tgl__nm"><span class="tgl__title">' + esc(g.name) + ' · ' + g.themes.length + '</span><small class="tgl__names">' + esc(groupNames(g)) + '</small></span>' +
      '<span class="tgl__strip" aria-hidden="true">' + g.themes.slice(0, 5).map(function (th) { return '<i data-theme="' + esc(th.day) + '"></i>'; }).join('') + '</span>' +
      '<span class="tgl__arrow" aria-hidden="true">' + (open ? '⌄' : '›') + '</span></button>';
  }
  /** 「모든 테마」: 줄을 상자에 담다가 펼친 줄 바로 아래에서 상자를 끊고 그 묶음 카드를 2열로 */
  function groupList(t) {
    var out = '', rows = '';
    function flush() { if (rows) out += '<div class="tgl">' + rows + '</div>'; rows = ''; }
    t.groups.forEach(function (g) {
      var open = g.id === t.open;
      rows += groupRow(g, open);
      if (open) {
        flush();
        out += '<div class="tgrid tgl__cards" id="tg-' + esc(g.id) + '" role="group" aria-label="' + esc(g.name + ' 테마') + '">' + g.themes.map(function (th) { return themeCard(th, t, 'g'); }).join('') + '</div>';
      }
    });
    flush();
    return out;
  }
  function themeSheet(t, entering) {
    if (!t) return '';
    var modeSec = t.hasModes ?
      '<section class="tset" aria-labelledby="tmode-title"><h3 id="tmode-title" class="tset__sec">낮 · 밤</h3>' +
      '<div class="seg seg--full" role="group" aria-label="낮 · 밤 고르기">' + ['auto', 'light', 'dark'].map(function (m) {
        return '<button type="button" class="seg__btn" data-act="theme-mode" data-v="' + m + '" aria-pressed="' + (t.mode === m) + '">' + MODE_LABEL[m] + '</button>';
      }).join('') + '</div>' +
      '<p class="tset__hint" aria-live="polite">' + (t.mode === 'auto' ? '지금은 ' + (t.night ? '밤' : '낮') + '이에요 · 휴대폰 설정을 따라요' : '늘 ' + (t.mode === 'dark' ? '밤' : '낮') + '으로 보여요') + '</p></section>' : '';
    var monthSec = t.monthly && t.monthly.length ?
      '<section class="tset tset--month" aria-labelledby="tmonth-title"><h3 id="tmonth-title" class="tset__sec">' + esc(t.month) + '월에 어울리는 테마</h3>' +
      '<div class="tgrid" role="group" aria-label="' + esc(t.month) + '월에 어울리는 테마">' + t.monthly.map(function (th) { return themeCard(th, t, 'm'); }).join('') + '</div></section>' : '';
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close-theme" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="theme-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="theme-title" class="sheet__title">테마</h2></div>' +
      '<p class="sheet__sub">고르면 바로 바뀌어요 · 테마와 낮·밤은 이 기기에 저장돼요</p>' +
      modeSec + monthSec +
      '<section class="tset" aria-labelledby="tpick-title"><h3 id="tpick-title" class="tset__sec">모든 테마</h3>' +
      (t.hasModes ? '' : '<p class="tset__hint">이 테마는 한 가지 밝기만 있어서 낮·밤 고르기가 없어요</p>') +
      groupList(t) + '</section>' +
      // 글씨체 (v61) — 도트 테마에서만: 도트 글씨가 읽기 불편하면 글자만 기본 글꼴로
      (t.pixel ? '<section class="tset" aria-labelledby="tfont-title"><h3 id="tfont-title" class="tset__sec">글씨체</h3>' +
        '<div class="seg seg--full" role="group" aria-label="글씨체 고르기">' + [['pixel', '도트'], ['plain', '기본']].map(function (f) {
          return '<button type="button" class="seg__btn" data-act="theme-font" data-v="' + f[0] + '" aria-pressed="' + (t.font === f[0]) + '">' + f[1] + '</button>';
        }).join('') + '</div>' +
        '<p class="tset__hint">' + (t.font === 'plain' ? '글자만 기본 글꼴로 · 테두리와 그림은 도트 그대로' : '그림과 어울리는 도트 글씨') + '</p></section>' : '') +
      (t.colors ? '<section class="tset" aria-labelledby="tcolor-sec"><h3 id="tcolor-sec" class="tset__sec">사람 색</h3>' + personColors(t.colors) + '</section>' : '') +
      '<button type="button" class="close-btn" data-act="close-theme">닫기</button>' +
      '</section></div>';
  }

  // 꿍 보내기 — 짝꿍에게 하루 한 번 응원 알림
  // ── 함께 키우기 · 주간 퀘스트 (v40 · v41) ──
  function tomatoSvg(g, size) {
    return RT.tomato ? RT.tomato.svg(g.stageKey, { size: size, thirsty: g.thirsty, label: '우리 토마토 · ' + g.stageName }) : '';
  }
  function growCard(g) {
    if (!g) return '';
    var sub = g.thirsty ? '목말라 보여요 · 오늘 루틴을 해 볼까요?' : g.line;
    return '<button type="button" class="card grow" data-act="open-grow" aria-label="우리 토마토 자세히 · ' + esc(g.stageName) + ', ' + esc(g.score) + '점">' +
      '<span class="grow__pic">' + tomatoSvg(g, 64) + '</span>' +
      '<span class="grow__body"><span class="grow__title">우리 토마토 <b>' + esc(g.stageName) + '</b>' + (g.harvested ? '<span class="grow__harvest">🍅 ' + esc(g.harvested) + '</span>' : '') + '</span>' +
      '<span class="grow__sub">' + esc(sub) + '</span>' +
      '<span class="grow__bar" aria-hidden="true"><span style="width:' + Math.max(4, g.pct) + '%"></span></span>' +
      '<span class="grow__next">' + esc(g.next.name) + '까지 ' + esc(g.next.need) + '점' + (g.todayPts ? ' · 오늘 +' + esc(g.todayPts) : '') + '</span></span>' +
      '</button>';
  }
  function questRow(it, bonus) {
    return '<div class="qrow' + (it.done ? ' qrow--done' : '') + (bonus ? ' qrow--bonus' : '') + '">' +
      '<span class="qrow__label">' + (bonus ? '<span class="qrow__tag">보너스</span>' : '') + esc(it.icon + ' ' + it.text) + '</span>' +
      '<span class="qrow__val">' + (it.done ? '성공 🎉' : esc(it.progress)) + '</span>' +
      '<span class="qrow__bar" aria-hidden="true"><span style="width:' + Math.max(3, it.pct) + '%"></span></span></div>';
  }
  function questBody(q) {
    return questRow(q.main, false) + questRow(q.bonus, true);
  }
  function questCard(q) {
    if (!q) return '';
    return '<button type="button" class="card quest" data-act="open-quest" aria-label="이번 주 퀘스트 · ' + esc(q.main.text) + ' ' + (q.main.done ? '성공' : esc(q.main.progress)) + ', 돌아보기에서 보기">' +
      '<span class="quest__head"><span class="quest__title">이번 주 퀘스트</span><span class="quest__hint">둘이 함께 채워요 · 성공하면 토마토 +5</span></span>' +
      questBody(q) + '</button>';
  }
  function growSheet(g, entering) {
    var stages = RT.grow ? RT.grow.STAGES : [];
    var bars = g.week.map(function (d) {
      var h = Math.round(d.pts / (RT.grow ? RT.grow.DAY_MAX : 6) * 100);
      return '<span class="gweek__day' + (d.rest ? ' gweek__day--rest' : '') + '"><span class="gweek__bar"><span style="height:' + Math.max(d.pts ? 8 : 0, h) + '%"></span></span>' +
        '<span class="gweek__n">' + (d.rest ? '쉼' : '+' + d.pts) + '</span><span class="gweek__dow">' + esc(['일', '월', '화', '수', '목', '금', '토'][RT.dates.parts(d.day).w]) + '</span></span>';
    }).join('');
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close-grow" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="grow-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="grow-title" class="sheet__title">우리 토마토</h2></div>' +
      '<div class="gbig">' + tomatoSvg(g, 168) +
      '<p class="gbig__stage">' + esc(g.stageName) + ' · ' + esc(g.score) + '점</p><p class="gbig__line">' + esc(g.thirsty ? '목말라 보여요 · 둘 중 한 명이라도 오늘 루틴을 다 하면 다시 자라요' : g.line) + '</p>' +
      '<span class="grow__bar grow__bar--big" aria-hidden="true"><span style="width:' + Math.max(4, g.pct) + '%"></span></span>' +
      '<p class="gbig__next">' + esc(g.next.name) + '까지 ' + esc(g.next.need) + '점 남았어요</p></div>' +
      '<div class="gstats"><span><b>' + esc(g.todayPts) + '</b>오늘</span><span><b>' + esc(g.weekPts) + '</b>이번 주</span><span><b>' + esc(g.harvested) + '</b>수확한 토마토</span></div>' +
      '<h3 class="gsub">최근 7일</h3><div class="gweek">' + bars + '</div>' +
      '<h3 class="gsub">단계</h3><ol class="gstages">' + stages.map(function (s, i) {
        return '<li class="' + (i < g.stage ? 'is-past' : i === g.stage ? 'is-now' : '') + '"><span>' + esc(s.name) + '</span><span>' + esc(s.min) + '점</span></li>';
      }).join('') + '<li><span>수확 → 새 씨앗</span><span>' + esc(RT.grow ? RT.grow.CYCLE : 200) + '점</span></li></ol>' +
      '<h3 class="gsub">이렇게 자라요</h3><ul class="grules">' +
      '<li>둘 다 루틴을 모두 해낸 날 <b>+3</b></li><li>한 사람이라도 자기 루틴을 다 한 날 <b>+1</b></li><li>함께 할 일 하나 끝낼 때마다 <b>+1</b></li>' +
      '<li>이번 주 퀘스트 성공 <b>+5</b> · 보너스 <b>+2</b></li><li>하루 최대 6점 · 안 해도 줄거나 시들지 않아요 · 쉬는 날은 그대로</li></ul>' +
      '<button type="button" class="close-btn" data-act="close-grow">닫기</button>' +
      '</section></div>';
  }

  function kungBar(k) {
    if (!k) return '';
    var text, btn = '';
    if (k.status === 'done') text = esc(k.toName) + ' 님은 오늘 루틴을 다 했어요 🎉';
    else {
      text = esc(k.toName) + ' 님 오늘 루틴 ' + esc(k.remaining) + '개 남았어요';
      btn = k.status === 'sent'
        ? '<button type="button" class="small-btn kung__btn" disabled>오늘 보냈어요</button>'
        : '<button type="button" class="small-btn kung__btn" data-act="send-kung">💌 꿍 보내기</button>';
    }
    return '<section class="card kung" aria-label="꿍 보내기"><span class="kung__text">' + text + '</span>' + btn + '</section>';
  }

  function chips(list, canManage) {
    return '<div class="chip-row"><div class="chips" role="group" aria-label="누구 기록을 볼까요">' + list.map(function (c) {
      return '<button type="button" class="chip" data-act="filter" data-id="' + esc(c.id) + '" aria-pressed="' + c.on + '">' + esc(c.label) + '</button>';
    }).join('') + '</div>' +
      (canManage ? '<button type="button" class="chip chip--manage" data-act="open-manage">＋ 내 루틴</button>' : '') +
      '</div>';
  }

  // 「내 루틴」 시트 — 목록, 추가 · 고치기 칸
  // 쉬기 칸 (v38) — 루틴 고치기 안에서 「🌿 쉬기」를 누르면 이 칸으로 바뀐다
  function restPanel(f) {
    var r = f.rest;
    function chipsOf(list, act, label) {
      return '<div class="chips rest__chips" role="group" aria-label="' + esc(label) + '">' + list.map(function (o) {
        return '<button type="button" class="chip" data-act="' + act + '" data-v="' + esc(o.v) + '" aria-pressed="' + !!o.on + '"' + (o.off ? ' disabled' : '') + '>' + esc(o.label) + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="rform rest" role="group" aria-labelledby="rest-title">' +
      '<span id="rest-title" class="rform__title">🌿 ' + esc(f.name) + ' 쉬기</span>' +
      '<p class="rest__sub">부상이나 사정으로 당분간 못 할 때 · 쉬는 날은 체크 칸이 없고 연속 기록도 끊기지 않아요</p>' +
      '<div class="field"><span class="field__label">언제부터</span>' + chipsOf(r.fromOpts, 'rest-from', '언제부터') +
      (r.from === 'date' ? '<input id="rs-from" class="field__input" type="date" value="' + esc(r.fromDate) + '" aria-label="쉬기 시작하는 날">' : '') +
      (r.checkedToday ? '<span class="rest__hint">오늘은 이미 체크해서 내일부터 쉴 수 있어요</span>' : '') + '</div>' +
      '<div class="field"><span class="field__label">언제까지</span>' + chipsOf(r.untilOpts, 'rest-until', '언제까지') +
      (r.until === 'date' ? '<input id="rs-until" class="field__input" type="date" value="' + esc(r.untilDate) + '" aria-label="마지막으로 쉬는 날 (이 날 포함)">' : '') + '</div>' +
      (r.note ? '<p class="rest__note" role="status">' + esc(r.note) + '</p>' : '') +
      (r.error ? '<p class="rform__error"' + (r.errorFresh ? ' role="alert"' : '') + '>' + esc(r.error) + '</p>' : '') +
      '<div class="rform__actions">' +
      '<button type="button" class="ghost-btn" data-act="rest-cancel">돌아가기</button>' +
      '<button type="button" class="solid-btn" data-act="rest-save"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : '🌿 쉬기') + '</button>' +
      '</div></div>';
  }

  // 「종류」 (v44) — 아이콘으로 자동, 바꾸면 그 종류로 묶임
  function kindField(k) {
    if (!k) return '';
    return '<div class="field"><span class="field__label" id="rt-kind-label">종류</span><div class="chips kind__chips" role="group" aria-labelledby="rt-kind-label">' +
      k.opts.map(function (o) {
        return '<button type="button" class="chip chip--sm" data-act="pick-kind" data-v="' + esc(o.v) + '" aria-pressed="' + o.on + '">' + esc(o.label) + (o.auto ? ' <small>자동</small>' : '') + '</button>';
      }).join('') + '</div><span class="when__sub kind__hint">' + (k.picked ? '직접 골랐어요 · 「자동」을 누르면 아이콘대로' : '아이콘대로 골라졌어요 · 바꿀 수 있어요') + '</span></div>';
  }

  // 「언제 할까요?」 (v41) — 무엇 다음에(문장) · 시각 둘 다 가능, 둘 다 비우면 언제든
  function whenField(w) {
    if (!w) return '';
    var out = '<div class="field when"><span class="field__label" id="rt-when-label">언제 할까요?</span>' +
      '<div class="seg" role="group" aria-labelledby="rt-when-label">' +
      '<button type="button" class="seg__btn" data-act="when-mode" data-v="set" aria-pressed="' + (w.mode === 'set') + '">정해 둘래요</button>' +
      '<button type="button" class="seg__btn" data-act="when-mode" data-v="any" aria-pressed="' + (w.mode === 'any') + '">언제든</button></div>';
    if (w.mode === 'set') {
      out += '<label class="when__row"><span class="when__sub">무엇 다음에</span>' +
        '<input id="rt-cue" class="field__input" type="text" maxlength="' + w.cueMax + '" autocomplete="off" placeholder="예: 일어나자마자" value="' + esc(w.cue) + '"></label>' +
        '<div class="chips when__chips" role="group" aria-label="예시">' + w.cues.map(function (c) {
          return '<button type="button" class="chip chip--sm" data-act="when-cue" data-v="' + esc(c.v) + '" aria-pressed="' + c.on + '">' + esc(c.v) + '</button>';
        }).join('') + '</div>' +
        '<label class="when__row"><span class="when__sub">몇 시에</span><span class="when__time"><input id="rt-at" class="field__input" type="time" value="' + esc(w.at) + '">' +
        (w.at ? '<button type="button" class="text-btn" data-act="when-clear-at">시각 지우기</button>' : '') + '</span></label>' +
        (w.at ? switchRow('when-remind', w.remind, '이 시각에 알려 주기', '아직 안 했으면 ' + w.at + '쯤 알림이 와요 (최대 15분 늦을 수 있어요)', false) : '') +
        '<p class="when__preview">카드에는 「' + esc(w.preview) + '」로 보여요</p>';
    }
    return out + '</div>';
  }

  function routineForm(f) {
    if (f.rest) return restPanel(f);
    function pick(ic) {
      return '<button type="button" class="icon-pick" data-act="pick-icon" data-icon="' + esc(ic.e) + '" aria-pressed="' + ic.on + '" aria-label="아이콘 ' + esc(ic.e) + '">' + esc(ic.e) + '</button>';
    }
    // v43: 묶음별 (운동 · 공부 · 일 · 건강 · 식사 · 생활 · 마음 · 취미)
    var icons = f.iconGroups && f.iconGroups.length ? f.iconGroups.map(function (g) {
      return '<span class="icon-group">' + esc(g.name) + '</span>' + g.icons.map(pick).join('');
    }).join('') : f.icons.map(pick).join('');
    return '<div class="rform" role="group" aria-labelledby="rform-title">' +
      '<span id="rform-title" class="rform__title">' + (f.mode === 'edit' ? '루틴 고치기' : '새 루틴') + '</span>' +
      '<label class="field"><span class="field__label">이름</span>' +
      '<input id="rt-name" class="field__input" type="text" maxlength="20" autocomplete="off" placeholder="예: 독서 20분" value="' + esc(f.name) + '"' +
      (f.error ? ' aria-invalid="true" aria-describedby="rt-error"' : '') + '></label>' +
      '<div class="field"><span class="field__label" id="rt-icon-label">아이콘</span><div class="icon-grid" role="group" aria-labelledby="rt-icon-label">' + icons + '</div></div>' +
      '<label class="field"><span class="field__label">시작일</span>' +
      '<input id="rt-start" class="field__input" type="date" value="' + esc(f.start) + '"' + (f.error ? ' aria-describedby="rt-error"' : '') + '></label>' +
      kindField(f.kind) +
      whenField(f.when) +
      // 새로 생긴 안내만 소리 내어 읽게 한다 (다시 그릴 때마다 반복하지 않도록)
      (f.error ? '<p id="rt-error" class="rform__error"' + (f.errorFresh ? ' role="alert"' : '') + '>' + esc(f.error) + '</p>' : '') +
      '<div class="rform__actions">' +
      '<button type="button" class="ghost-btn" data-act="cancel-form">취소</button>' +
      '<button type="button" class="solid-btn" data-act="save-routine"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : f.confirmStart ? '그래도 저장' : f.mode === 'edit' ? '저장' : '루틴 추가하기') + '</button>' +
      '</div>' +
      (f.mode === 'edit' && (f.canStop || f.canDelete || f.canRest) ? '<div class="rform__more">' +
        (f.canRest ? '<button type="button" class="text-btn" data-act="rest-open"' + (f.saving ? ' disabled' : '') + '>🌿 당분간 쉬기</button>' : '') +
        (f.canStop ? '<button type="button" class="text-btn" data-act="stop-routine"' + (f.saving ? ' disabled' : '') + '>오늘까지 하고 그만하기</button>' : '') +
        (f.canDelete ? '<button type="button" class="text-btn text-btn--warn" data-act="delete-routine"' + (f.saving ? ' disabled' : '') + '>' + (f.confirmDelete ? '한 번 더 누르면 삭제돼요' : '삭제') + '</button>' : '') +
        '</div>' : '') +
      '</div>';
  }

  function manageSheet(mg, meName, entering) {
    if (!mg) return '';
    function item(it, ended) {
      return '<div class="mitem' + (ended ? ' mitem--ended' : '') + (it.resting ? ' mitem--rest' : '') + '">' +
        '<span class="emoji-tile" aria-hidden="true">' + esc(it.icon) + '</span>' +
        '<div class="mitem__text"><span class="mitem__name">' + esc(it.name) + '</span><span class="mitem__status">' + esc(it.status) + '</span></div>' +
        (ended
          ? '<button type="button" class="small-btn" data-act="resume-routine" data-key="' + esc(it.key) + '">다시 하기</button>'
          : (it.wake && !it.editing ? '<button type="button" class="small-btn" data-act="wake-routine" data-key="' + esc(it.key) + '" aria-label="' + esc(it.name + ' ' + it.wake) + '">' + esc(it.wake) + '</button>' : '') +
            (it.editing ? '' : '<button type="button" class="small-btn" data-act="edit-routine" data-key="' + esc(it.key) + '" aria-label="' + esc(it.name) + ' 수정">수정</button>')) +
        '</div>';
    }
    var f = mg.form;
    function moveItem(it, i) {
      return '<div class="mitem mitem--order"><span class="mitem__no">' + (i + 1) + '</span><span class="emoji-tile" aria-hidden="true">' + esc(it.icon) + '</span>' +
        '<div class="mitem__text"><span class="mitem__name">' + esc(it.name) + '</span></div>' +
        '<button type="button" class="small-btn" data-act="rt-move" data-key="' + esc(it.key) + '" data-dir="-1" aria-label="' + esc(it.name) + ' 위로"' + (it.first ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="small-btn" data-act="rt-move" data-key="' + esc(it.key) + '" data-dir="1" aria-label="' + esc(it.name) + ' 아래로"' + (it.last ? ' disabled' : '') + '>↓</button></div>';
    }
    var list = !mg.current.length ? '<p class="muted">아직 내 루틴이 없어요</p>'
      : mg.reorder ? mg.current.map(moveItem).join('') : mg.current.map(function (it) { return item(it, false); }).join('');
    var orderBar = mg.reorder ? '<div class="morder"><span>↑↓ 를 누르면 바로 저장돼요 · 「종류」 · 「내 순서」 보기에 이 순서대로 보여요</span><button type="button" class="small-btn" data-act="rt-order-done">완료</button></div>'
      : mg.canReorder ? '<div class="morder morder--off"><button type="button" class="text-btn" data-act="rt-order">↕ 순서 바꾸기</button></div>' : '';
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close-manage" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="manage-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="manage-title" class="sheet__title">내 루틴</h2></div>' +
      '<p class="sheet__sub">' + esc(meName) + ' 님 루틴만 여기서 추가하고 바꿀 수 있어요</p>' +
      orderBar + '<div class="mlist">' + list + '</div>' +
      (mg.reorder ? '' : f ? routineForm(f) : '<button type="button" class="add-btn" data-act="new-routine">＋ 새 루틴</button>') +
      (mg.ended.length ? '<h3 class="mgroup">그만한 루틴</h3><div class="mlist">' + mg.ended.map(function (it) { return item(it, true); }).join('') + '</div>' : '') +
      '<button type="button" class="close-btn" data-act="close-manage">닫기</button>' +
      '</section></div>';
  }

  function grid(g) {
    var dows = ['일', '월', '화', '수', '목', '금', '토'].map(function (d) { return '<span class="dow">' + d + '</span>'; }).join('');
    var cells = g.cells.map(function (c) {
      if (c.out) return '<span class="cell lv-out" aria-hidden="true"></span>';
      return '<button type="button" class="cell lv-' + c.level + (c.today ? ' is-today" aria-current="date' : '') + '" data-act="day" data-day="' + c.day + '"' +
        (c.disabled ? ' disabled' : '') + ' aria-label="' + esc(c.aria) + '">' + esc(c.label) + '</button>';
    }).join('');
    // 옅은 세 칸은 붙여서 한 덩어리로 (적게 → 많이)
    var legend = g.legend.map(function (l) {
      var sw = '<span class="swatch lv-' + l.level + '"></span>';
      return /^s[12]$/.test(l.level) ? sw : /^s3$/.test(l.level) ? sw + '<span class="legend__label">' + esc(l.label) + '</span></span>' :
        l.level === 'none' && g.legend.length > 2 ? '<span class="legend__item">' + sw + esc(l.label) + '</span><span class="legend__item legend__ramp">' :
        '<span class="legend__item">' + sw + esc(l.label) + '</span>';
    }).join('');
    return '<section class="card grid-card" aria-label="달성 그리드">' +
      '<div class="grid-head">' +
      '<button type="button" class="icon-btn" data-act="page" data-dir="1" aria-label="이전 달"' + (g.canPrev ? '' : ' disabled') + '>' + CHEVRON.prev + '</button>' +
      '<span class="grid-title"><span class="grid-range">' + esc(g.range) + '</span>' +
      (g.isThisMonth ? '' : '<button type="button" class="mini-btn" data-act="this-month">이번 달</button>') + '</span>' +
      '<button type="button" class="icon-btn" data-act="page" data-dir="-1" aria-label="다음 달"' + (g.canNext ? '' : ' disabled') + '>' + CHEVRON.next + '</button>' +
      '</div>' +
      '<div class="week">' + dows + '</div>' +
      '<div class="week cells">' + cells + '</div>' +
      '<div class="grid-foot"><span class="hint-strong">칸을 누르면 그날 기록이 열려요</span><span class="legend">' + legend + '</span></div>' +
      '</section>';
  }

  function picker(people) {
    return '<section class="card notice picker" aria-label="누구로 체크할까요">' +
      '<h2 class="notice__title">누구로 체크할까요?</h2>' +
      '<p class="notice__body">이 기기에서 한 번만 고르면 돼요. 내 루틴만 체크할 수 있어요.</p>' +
      '<div class="chips picker__row">' + people.map(function (p) {
        return '<button type="button" class="chip" data-act="pick-me" data-id="' + esc(p.person) + '">' + esc(p.name) + '</button>';
      }).join('') + '</div></section>';
  }

  // 사람별로 모은 루틴 카드 (v39) — 「전체」에서 두 사람이면 이름 머리말, 한 사람만 보일 땐 카드만
  // v44: 보기 기준 (시간대 · 종류 · 내 순서) — 사람 묶음 안에서 한 번 더 나눈다
  function viewSwitch(m) {
    if (!m.views) return '';
    return '<div class="rview"><span class="rview__label" id="rview-label">묶어 보기</span><div class="seg" role="group" aria-labelledby="rview-label">' + m.views.map(function (o) {
      return '<button type="button" class="seg__btn" data-act="routine-view" data-v="' + esc(o.v) + '" aria-pressed="' + o.on + '">' + esc(o.label) + '</button>';
    }).join('') + '</div></div>';
  }
  function subBlocks(g, view) {
    return (g.subs || [{ id: 'all', label: '', cards: g.cards }]).map(function (s) {
      return '<div class="rsub" data-sub="' + esc(g.person + ':' + s.id) + '"' + (g.mine ? ' data-mine="1"' : '') + '>' +
        (view !== 'manual' && s.label ? '<h3 class="rsub__head">' + esc(s.label) + '<span>' + esc(s.cards.length) + '</span></h3>' : '') +
        s.cards.map(routineCard).join('') + '</div>';
    }).join('');
  }
  function routineGroups(m) {
    var hint = !m.groups.some(function (g) { return g.mine; }) ? ''
      : m.view === 'time' ? '<p class="rview__hint">시간대 보기는 정해 둔 시각 순서예요 · 순서를 바꾸려면 「종류」나 「내 순서」</p>'
      : '<p class="rview__hint">내 루틴 카드를 꾹 눌러 끌면 순서를 바꿀 수 있어요</p>';
    if (!m.grouped) return viewSwitch(m) + hint + m.groups.map(function (g) { return subBlocks(g, m.view); }).join('');
    return viewSwitch(m) + hint + m.groups.map(function (g) {
      return '<section class="rgroup" aria-label="' + esc(g.name) + ' 루틴">' +
        '<h2 class="rgroup__head"><span class="dot rgroup__dot dot--' + g.dot + '" aria-hidden="true"></span>' + esc(g.name) + (g.mine ? ' <span class="rgroup__me">나</span>' : '') +
        '<span class="rgroup__count">루틴 ' + g.cards.length + '개</span></h2>' +
        subBlocks(g, m.view) + '</section>';
    }).join('');
  }

  function routineCard(k) {
    return '<section class="card routine' + (k.rest ? ' routine--rest' : '') + (k.missed ? ' routine--missed' : '') + '" data-rkey="' + esc(k.key) + '" aria-label="' + esc(k.name) + ' 기록' + (k.rest ? ', 쉬는 중' : '') + (k.missed ? ', 어제 놓침' : '') + '">' +
      '<div class="routine__head">' +
      '<span class="emoji-tile" aria-hidden="true">' + esc(k.icon) + '</span>' +
      '<div class="routine__names"><span class="routine__name">' + esc(k.name) + (k.missed ? '<span class="miss-tag">어제 놓침</span>' : '') + '</span>' +
      '<span class="routine__who"><span class="dot dot--' + esc(k.dot) + '"></span>' + esc(k.who) + ' · ' + esc(k.startText) + '</span>' +
      (k.rest ? '' : '<span class="routine__when' + (k.whenSet ? '' : ' routine__when--any') + '">' + esc(k.when) + '</span>') + '</div>' +
      (k.count ? '<span class="routine__count">달성 ' + esc(k.count) + '</span>' : '') +
      '</div>' +
      '<div class="stats">' +
      '<div class="stat"><span class="stat__label">' + esc(k.dayLabel) + '</span><span class="stat__value">' + esc(k.dayValue) + '</span></div>' +
      '<div class="stat' + (k.clean ? ' stat--clean' : '') + '"><span class="stat__label">' + esc(k.streakLabel) + '</span><span class="stat__value">' + (k.started ? '🔥 ' : '') + esc(k.streakValue) + '</span></div>' +
      '</div>' +
      '<p class="routine__hint">' + esc(k.hint) + '</p>' +
      (k.rest || k.restSoon ? '<div class="routine__rest"><span>' + esc(k.rest || k.restSoon) + '</span>' +
        (k.canWake ? '<button type="button" class="small-btn" data-act="wake-routine" data-key="' + esc(k.key) + '">' + (k.rest ? '다시 시작' : '쉬기 취소') + '</button>' : '') + '</div>' : '') +
      '</section>';
  }

  function both(b) {
    if (!b) return '';
    return '<section class="card both" aria-label="모두 해낸 날 연속">' +
      '<div class="both__text"><span class="both__title">모두 해낸 날 연속</span><span class="both__hint">' + esc(b.hint) + '</span></div>' +
      '<span class="both__value">' + esc(b.value) + '</span></section>';
  }

  function sheet(s, entering) {
    if (!s) return '';
    function row(r) {
      return '<div class="row">' +
        '<span class="emoji-tile emoji-tile--lg" aria-hidden="true">' + esc(r.icon) + '</span>' +
        '<div class="row__text"><span class="row__name">' + esc(r.name) + ' <span class="row__who">· ' + esc(r.who) + '</span></span>' +
        '<span class="row__meta' + (s.isToday && !r.pre ? ' row__meta--today' : '') + '">' + esc(r.meta) + '</span>' +
        (r.by ? '<span class="row__by">' + esc(r.by) + '</span>' : '') + '</div>' +
        '<button type="button" class="pill-btn' + (r.done ? ' is-done' : '') + (!s.isToday && !r.done ? ' is-past' : '') + (r.locked && !r.pre ? ' is-locked' : '') + '" data-act="toggle" data-key="' + esc(r.key) + '"' +
        (r.pre ? ' disabled' : r.locked ? ' aria-disabled="true"' : ' aria-pressed="' + r.done + '"') +
        ' aria-label="' + esc(r.name + ' ' + r.button + (r.locked && !r.pre ? ', ' + r.who + ' 님만 체크할 수 있어요' : '')) + '">' +
        (r.done ? CHECK_SVG : '') + '<span>' + esc(r.button) + '</span></button>' +
        '</div>';
    }
    // v42: 사람별 묶음 (두 사람이면 머리말, 사람 칩 순서)
    var rows = s.groups && s.groups.length > 1 ? s.groups.map(function (g) {
      return '<div class="sgroup" role="group" aria-label="' + esc(g.name) + ' 루틴 ' + esc(g.count) + '">' +
        '<h3 class="sgroup__head"><span class="dot rgroup__dot dot--' + g.dot + '" aria-hidden="true"></span>' + esc(g.name) + (g.mine ? ' <span class="rgroup__me">나</span>' : '') +
        '<span class="rgroup__count">' + esc(g.count) + '</span></h3>' + g.rows.map(row).join('') + '</div>';
    }).join('') : s.rows.map(row).join('');
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="sheet-title" class="sheet__title">' + esc(s.title) + '</h2>' + (s.isToday ? '<span class="tag">오늘</span>' : '') + '</div>' +
      '<p class="day-sum' + (s.full ? ' day-sum--full' : '') + '">' + esc(s.summary) + (s.full ? ' ✓' : '') + '</p>' +
      '<p class="sheet__sub">' + esc(s.sub) + '</p>' +
      '<div class="rows">' + rows + '</div>' +
      '<button type="button" class="close-btn" data-act="close">닫기</button>' +
      '</section></div>';
  }

  function skeleton() {
    return '<div class="skeleton" aria-label="기록을 불러오는 중" role="status">' +
      '<span class="sk sk--chips"></span><span class="sk sk--grid"></span><span class="sk sk--card"></span><span class="sk sk--card"></span></div>';
  }

  function notice(title, body) {
    return '<section class="card notice" role="status"><h2 class="notice__title">' + esc(title) + '</h2><p class="notice__body">' + esc(body) + '</p></section>';
  }

  function toast(text) {
    return text ? '<div class="toast" role="status">' + esc(text) + '</div>' : '';
  }

  // ── 웹판 전용 화면: 로그인 · 이름 정하기 · 초대 안 된 계정 ──
  function authScreen(a) {
    var signup = a.mode === 'signup', reset = a.mode === 'reset';
    var title = signup ? '처음이라면 계정 만들기' : reset ? '비밀번호 다시 만들기' : '로그인';
    return '<form class="card auth" data-form="auth" aria-labelledby="auth-title" novalidate>' +
      '<h2 id="auth-title" class="notice__title">' + title + '</h2>' +
      '<p class="notice__body">' + (reset ? '가입한 이메일로 비밀번호를 바꾸는 링크를 보내 드려요.' : '초대된 두 사람만 들어올 수 있어요. 한 번 로그인하면 이 기기에서는 계속 유지돼요.') + '</p>' +
      '<label class="field"><span class="field__label">이메일</span><input id="au-email" name="email" class="field__input" type="email" autocomplete="username" inputmode="email" autocapitalize="off" value="' + esc(a.email) + '"></label>' +
      (reset ? '' : '<label class="field"><span class="field__label">비밀번호' + (signup ? ' (6자 이상)' : '') + '</span><input id="au-pass" name="password" class="field__input" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" value="' + esc(a.password) + '"></label>') +
      (a.error ? '<p id="au-error" class="rform__error"' + (a.errorFresh ? ' role="alert"' : '') + '>' + esc(a.error) + '</p>' : '') +
      (a.info ? '<p class="auth__info" role="status">' + esc(a.info) + '</p>' : '') +
      '<button type="submit" class="solid-btn solid-btn--full"' + (a.busy ? ' disabled' : '') + '>' + (a.busy ? '잠시만요…' : signup ? '계정 만들기' : reset ? '링크 보내기' : '로그인') + '</button>' +
      '<div class="auth__links">' +
      (signup || reset ? '<button type="button" class="text-btn" data-act="auth-mode" data-id="login">로그인으로 돌아가기</button>'
        : '<button type="button" class="text-btn" data-act="auth-mode" data-id="signup">처음이에요 (계정 만들기)</button><button type="button" class="text-btn" data-act="auth-mode" data-id="reset">비밀번호를 잊었어요</button>') +
      '</div></form>';
  }
  function setupScreen(s) {
    return '<form class="card auth" data-form="setup" aria-labelledby="setup-title" novalidate>' +
      '<h2 id="setup-title" class="notice__title">반가워요! 이름을 알려 주세요</h2>' +
      '<p class="notice__body">짝꿍에게 보일 이름이에요. 나중에 바꿀 수 없으니 정확히 적어 주세요.</p>' +
      '<label class="field"><span class="field__label">이름</span><input id="me-name" class="field__input" type="text" maxlength="10" autocomplete="nickname" value="' + esc(s.name) + '"></label>' +
      (s.error ? '<p id="setup-error" class="rform__error"' + (s.errorFresh ? ' role="alert"' : '') + '>' + esc(s.error) + '</p>' : '') +
      '<button type="submit" class="solid-btn solid-btn--full"' + (s.busy ? ' disabled' : '') + '>' + (s.busy ? '잠시만요…' : '시작하기') + '</button>' +
      '<div class="auth__links"><button type="button" class="text-btn" data-act="sign-out">다른 계정으로 로그인</button></div>' +
      '</form>';
  }
  function verifyScreen(v, email) {
    return '<section class="card auth" aria-labelledby="verify-title">' +
      '<h2 id="verify-title" class="notice__title">메일함을 확인해 주세요</h2>' +
      '<p class="notice__body">' + esc(email) + ' 로 인증 메일을 보냈어요. 메일의 링크를 누른 뒤 아래 버튼을 눌러 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.</p>' +
      (v.error ? '<p class="rform__error"' + (v.errorFresh ? ' role="alert"' : '') + '>' + esc(v.error) + '</p>' : '') +
      (v.info ? '<p class="auth__info" role="status">' + esc(v.info) + '</p>' : '') +
      '<button type="button" class="solid-btn solid-btn--full" data-act="verify-check"' + (v.busy ? ' disabled' : '') + '>' + (v.busy ? '확인하는 중…' : '인증했어요') + '</button>' +
      '<div class="auth__links"><button type="button" class="text-btn" data-act="verify-resend">메일 다시 보내기</button>' +
      '<button type="button" class="text-btn" data-act="sign-out">다른 계정으로 로그인</button></div>' +
      '</section>';
  }

  /** 결산 표지 (S4 자리 부품) — 월말 · 연말결산 화면이 생기면 첫 장으로 쓴다. 아직 어디서도 부르지 않음.
      c = { kind: 'month' | 'year', year, month } → 「2026년 11월 · 이번 달의 단짝꿍」 / 「2026년 · 이번 해의 단짝꿍」 */
  function recapCover(c) {
    var art = root.RT && root.RT.themes ? root.RT.themes.artHtml('s4') : '';
    var when = c.kind === 'year' ? c.year + '년' : c.year + '년 ' + c.month + '월';
    return '<section class="card recap-cover">' + art + '<div class="recap-cover__tx"><p class="recap-cover__when">' + esc(when) + '</p>' +
      '<h2 class="recap-cover__title">' + (c.kind === 'year' ? '이번 해의 단짝꿍' : '이번 달의 단짝꿍') + '</h2>' +
      '<button type="button" class="solid-btn" data-act="recap-next">넘겨 보기 ▶</button></div></section>';
  }

  /** status: 'loading' | 'nodb' | 'ready' | 'login' | 'setup' | 'denied' | 'unconfigured' */
  function page(status, m, toastText, opts) {
    var out = header(m.header);
    opts = opts || {};
    if (status === 'login') return out + authScreen(opts.auth) + toast(toastText);
    if (status === 'setup') return out + setupScreen(opts.setup) + toast(toastText);
    if (status === 'verify') return out + verifyScreen(opts.verify, opts.email) + toast(toastText);
    if (status === 'denied') return out + notice('초대되지 않은 계정이에요', (opts.email || '이 계정') + '은(는) 단짝꿍에 들어올 수 없어요. 다른 계정으로 로그인해 주세요.') +
      '<button type="button" class="add-btn" data-act="sign-out">로그아웃</button>' + toast(toastText);
    if (status === 'unconfigured') return out + notice('아직 연결 설정이 비어 있어요', 'js/firebase-config.js에 Firebase 설정을 넣어야 해요.');
    if (status === 'loading') out += skeleton() + (opts.web ? '<div class="auth__links auth__links--center"><button type="button" class="text-btn" data-act="sign-out">로그아웃</button></div>' : '');
    else if (status === 'nodb') {
      out += opts.web
        ? notice('기록을 불러오지 못했어요', '인터넷 연결을 확인한 뒤 다시 시도해 주세요.') +
          '<button type="button" class="add-btn" data-act="retry">다시 시도</button>' +
          '<div class="auth__links auth__links--center"><button type="button" class="text-btn" data-act="sign-out">로그아웃</button></div>'
        : notice('기록 저장소에 연결할 수 없어요', 'claude.ai나 Claude 앱에서 이 페이지를 열면 기록을 불러와요.');
    }
    else if (opts.tab && opts.tab !== 'routine') {
      out += opts.tabHtml || ''; // 시간표 · 할 일 탭 (view-plan.js)
    }
    else if (m.empty) {
      out += (m.needsPick ? picker(m.people) : '') + notice('아직 등록된 루틴이 없어요', '「＋ 내 루틴」에서 첫 루틴을 추가해 보세요.') +
        (m.canManage ? '<button type="button" class="add-btn" data-act="open-manage">＋ 내 루틴</button>' : '');
    } else {
      out += (m.needsPick ? picker(m.people) : '') + chips(m.chips, m.canManage) + growCard(m.grow) + grid(m.grid) + kungBar(m.kung) + questCard(m.quest) +
        (m.missedMine ? '<p class="miss-banner" role="status">어제 못 한 루틴이 ' + esc(m.missedMine) + '개 있어요 · 오늘은 꼭! 💪</p>' : '') +
        (m.emptyFilter ? '<p class="muted muted--card">지금 하고 있는 루틴이 없어요</p>' : routineGroups(m)) + both(m.both);
    }
    if (status === 'ready') {
      out += opts.grow ? growSheet(opts.grow, opts.sheetEntering)
        : opts.notify ? notifySheet(opts.notify, opts.sheetEntering)
        : opts.theme ? themeSheet(opts.theme, opts.sheetEntering)
        : opts.sheetHtml ? opts.sheetHtml
        : opts.tab && opts.tab !== 'routine' ? ''
        : m.manage ? manageSheet(m.manage, m.header.meName, opts && opts.sheetEntering) : (!m.empty ? sheet(m.sheet, opts && opts.sheetEntering) : '');
      if (opts.tabbarHtml) out += opts.tabbarHtml;
    }
    out += toast(toastText);
    return out;
  }

  var api = { questBody: questBody, page: page, esc: esc, TITLE: TITLE, recapCover: recapCover, themeSheet: themeSheet };
  root.RT = root.RT || {};
  root.RT.view = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
