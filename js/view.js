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

  function header(h) {
    return '<header class="top">' +
      '<div class="top__text"><p class="caption">' + esc(h.date) + (h.meName ? ' · ' + esc(h.meName) + ' 님으로 접속' : '') +
      (h.canRepick ? ' <button type="button" class="link-btn" data-act="repick">바꾸기</button>' : '') +
      (h.canSignOut ? ' · <button type="button" class="link-btn" data-act="sign-out">로그아웃</button>' : '') + '</p><h1 class="title">' + esc(TITLE) + '</h1></div>' +
      '<div class="top__side">' +
      (h.bell ? '<button type="button" class="bell-btn" data-act="open-notify" aria-label="알림 설정' + (h.bell === 'on' ? ' (켜짐)' : ' (꺼짐)') + '">' + (h.bell === 'on' ? '🔔' : '🔕') + '</button>' : '') +
      '<span class="season-chip">' + esc(h.season.icon + ' ' + h.season.name) + '</span></div>' +
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
    var p = n.prefs || { partner: true, remindAt: null, hide: false };
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
      switchRow('pref-hide', p.hide, '잠금 화면에서 루틴 이름 숨기기', '「새 기록이 있어요」처럼만 보여요', off) +
      '</div>' +
      '<p class="muted nfoot">설정은 내 모든 기기에 같이 적용돼요.</p>' +
      '<button type="button" class="close-btn" data-act="close-notify">닫기</button>' +
      '</section></div>';
  }

  function chips(list, canManage) {
    return '<div class="chip-row"><div class="chips" role="group" aria-label="누구 기록을 볼까요">' + list.map(function (c) {
      return '<button type="button" class="chip" data-act="filter" data-id="' + esc(c.id) + '" aria-pressed="' + c.on + '">' + esc(c.label) + '</button>';
    }).join('') + '</div>' +
      (canManage ? '<button type="button" class="chip chip--manage" data-act="open-manage">＋ 내 루틴</button>' : '') +
      '</div>';
  }

  // 「내 루틴」 시트 — 목록, 추가 · 고치기 칸
  function routineForm(f) {
    var icons = f.icons.map(function (ic) {
      return '<button type="button" class="icon-pick" data-act="pick-icon" data-icon="' + esc(ic.e) + '" aria-pressed="' + ic.on + '" aria-label="아이콘 ' + esc(ic.e) + '">' + esc(ic.e) + '</button>';
    }).join('');
    return '<div class="rform" role="group" aria-labelledby="rform-title">' +
      '<span id="rform-title" class="rform__title">' + (f.mode === 'edit' ? '루틴 고치기' : '새 루틴') + '</span>' +
      '<label class="field"><span class="field__label">이름</span>' +
      '<input id="rt-name" class="field__input" type="text" maxlength="20" autocomplete="off" placeholder="예: 독서 20분" value="' + esc(f.name) + '"' +
      (f.error ? ' aria-invalid="true" aria-describedby="rt-error"' : '') + '></label>' +
      '<div class="field"><span class="field__label" id="rt-icon-label">아이콘</span><div class="icon-grid" role="group" aria-labelledby="rt-icon-label">' + icons + '</div></div>' +
      '<label class="field"><span class="field__label">시작일</span>' +
      '<input id="rt-start" class="field__input" type="date" value="' + esc(f.start) + '"' + (f.error ? ' aria-describedby="rt-error"' : '') + '></label>' +
      // 새로 생긴 안내만 소리 내어 읽게 한다 (다시 그릴 때마다 반복하지 않도록)
      (f.error ? '<p id="rt-error" class="rform__error"' + (f.errorFresh ? ' role="alert"' : '') + '>' + esc(f.error) + '</p>' : '') +
      '<div class="rform__actions">' +
      '<button type="button" class="ghost-btn" data-act="cancel-form">취소</button>' +
      '<button type="button" class="solid-btn" data-act="save-routine"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : f.confirmStart ? '그래도 저장' : f.mode === 'edit' ? '저장' : '루틴 추가하기') + '</button>' +
      '</div>' +
      (f.mode === 'edit' && (f.canStop || f.canDelete) ? '<div class="rform__more">' +
        (f.canStop ? '<button type="button" class="text-btn" data-act="stop-routine"' + (f.saving ? ' disabled' : '') + '>오늘까지 하고 그만하기</button>' : '') +
        (f.canDelete ? '<button type="button" class="text-btn text-btn--warn" data-act="delete-routine"' + (f.saving ? ' disabled' : '') + '>' + (f.confirmDelete ? '한 번 더 누르면 삭제돼요' : '삭제') + '</button>' : '') +
        '</div>' : '') +
      '</div>';
  }

  function manageSheet(mg, meName, entering) {
    if (!mg) return '';
    function item(it, ended) {
      return '<div class="mitem' + (ended ? ' mitem--ended' : '') + '">' +
        '<span class="emoji-tile" aria-hidden="true">' + esc(it.icon) + '</span>' +
        '<div class="mitem__text"><span class="mitem__name">' + esc(it.name) + '</span><span class="mitem__status">' + esc(it.status) + '</span></div>' +
        (ended
          ? '<button type="button" class="small-btn" data-act="resume-routine" data-key="' + esc(it.key) + '">다시 하기</button>'
          : (it.editing ? '' : '<button type="button" class="small-btn" data-act="edit-routine" data-key="' + esc(it.key) + '" aria-label="' + esc(it.name) + ' 수정">수정</button>')) +
        '</div>';
    }
    var f = mg.form;
    var list = mg.current.length ? mg.current.map(function (it) { return item(it, false); }).join('') : '<p class="muted">아직 내 루틴이 없어요</p>';
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close-manage" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="manage-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="manage-title" class="sheet__title">내 루틴</h2></div>' +
      '<p class="sheet__sub">' + esc(meName) + ' 님 루틴만 여기서 추가하고 바꿀 수 있어요</p>' +
      '<div class="mlist">' + list + '</div>' +
      (f ? routineForm(f) : '<button type="button" class="add-btn" data-act="new-routine">＋ 새 루틴</button>') +
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
    var legend = g.legend.map(function (l) { return '<span class="legend__item"><span class="swatch lv-' + l.level + '"></span>' + esc(l.label) + '</span>'; }).join('');
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

  function routineCard(k) {
    return '<section class="card routine" aria-label="' + esc(k.name) + ' 기록">' +
      '<div class="routine__head">' +
      '<span class="emoji-tile" aria-hidden="true">' + esc(k.icon) + '</span>' +
      '<div class="routine__names"><span class="routine__name">' + esc(k.name) + '</span>' +
      '<span class="routine__who"><span class="dot dot--' + esc(k.dot) + '"></span>' + esc(k.who) + ' · ' + esc(k.startText) + '</span></div>' +
      (k.count ? '<span class="routine__count">달성 ' + esc(k.count) + '</span>' : '') +
      '</div>' +
      '<div class="stats">' +
      '<div class="stat"><span class="stat__label">' + esc(k.dayLabel) + '</span><span class="stat__value">' + esc(k.dayValue) + '</span></div>' +
      '<div class="stat' + (k.clean ? ' stat--clean' : '') + '"><span class="stat__label">' + esc(k.streakLabel) + '</span><span class="stat__value">' + (k.started ? '🔥 ' : '') + esc(k.streakValue) + '</span></div>' +
      '</div>' +
      '<p class="routine__hint">' + esc(k.hint) + '</p>' +
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
    var rows = s.rows.map(function (r) {
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
    }).join('');
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="sheet-title" class="sheet__title">' + esc(s.title) + '</h2>' + (s.isToday ? '<span class="tag">오늘</span>' : '') + '</div>' +
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
    else if (m.empty) {
      out += (m.needsPick ? picker(m.people) : '') + notice('아직 등록된 루틴이 없어요', '「＋ 내 루틴」에서 첫 루틴을 추가해 보세요.') +
        (m.canManage ? '<button type="button" class="add-btn" data-act="open-manage">＋ 내 루틴</button>' : '');
    } else {
      out += (m.needsPick ? picker(m.people) : '') + chips(m.chips, m.canManage) + grid(m.grid) +
        (m.emptyFilter ? '<p class="muted muted--card">지금 하고 있는 루틴이 없어요</p>' : m.cards.map(routineCard).join('')) + both(m.both);
    }
    if (status === 'ready') {
      out += opts.notify ? notifySheet(opts.notify, opts.sheetEntering)
        : m.manage ? manageSheet(m.manage, m.header.meName, opts && opts.sheetEntering) : (!m.empty ? sheet(m.sheet, opts && opts.sheetEntering) : '');
    }
    out += toast(toastText);
    return out;
  }

  var api = { page: page, esc: esc, TITLE: TITLE };
  root.RT = root.RT || {};
  root.RT.view = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
