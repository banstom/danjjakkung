/* 화면 그리기 — 아래 탭 · 할 일 탭 · 시간표 탭과 그 시트들. 부품마다 함수 하나.
   값 계산은 todos.js · schedule.js, 상태는 app.js 가 맡는다. */
(function (root) {
  'use strict';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(n) { return (Math.round(n * 1000) / 1000) + '%'; }

  // ── 아래 탭 ──
  var TABS = [
    { id: 'routine', label: '루틴', d: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>' },
    { id: 'schedule', label: '시간표', d: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' },
    { id: 'todo', label: '할 일', d: '<path d="M4 7l2 2 3.5-3.5M4 15l2 2 3.5-3.5M13 8h7M13 16h7"/>' }
  ];
  function tabbar(active) {
    return '<nav class="tabbar" aria-label="화면 이동">' + TABS.map(function (t) {
      var on = t.id === active;
      return '<button type="button" class="tabbar__btn" data-act="tab" data-tab="' + t.id + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t.d + '</svg>' +
        '<span>' + t.label + '</span></button>';
    }).join('') + '</nav>';
  }

  function notice(title, body) {
    return '<section class="card notice" role="status"><h2 class="notice__title">' + esc(title) + '</h2><p class="notice__body">' + esc(body) + '</p></section>';
  }

  // ── 할 일 ──
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function todoRow(r, mini) {
    var box = '<button type="button" class="tcheck tcheck--' + r.slot + '" role="checkbox" aria-checked="' + r.done + '" data-act="todo-toggle" data-id="' + esc(r.id) + '"' +
      (r.canCheck ? '' : ' aria-disabled="true"') + ' aria-label="' + esc(r.title + (r.canCheck ? '' : ', ' + r.lockText)) + '">' + (r.done ? CHECK : '') + '</button>';
    var text = '<span class="trow__title">' + esc(r.title) + '</span>' + (r.meta ? '<span class="trow__meta' + (r.over ? ' trow__meta--over' : '') + '">' + esc(r.meta) + '</span>' : '');
    var body = r.canEdit
      ? '<button type="button" class="trow__text" data-act="todo-edit" data-id="' + esc(r.id) + '" aria-label="' + esc(r.title) + ' 고치기">' + text + '</button>'
      : '<span class="trow__text">' + text + '</span>';
    return '<div class="trow' + (mini ? ' trow--mini' : '') + (r.done ? ' is-done' : '') + '">' + box + body + '</div>';
  }
  function sectionFoot(s, mini) {
    var out = '';
    if (s.moreCount) out += '<button type="button" class="more-btn" data-act="todo-more" data-key="' + esc(s.key) + '" aria-expanded="false">' + (mini ? s.moreCount + '개 더 ⌄' : '남은 ' + s.moreCount + '개 더 보기 ⌄') + '</button>';
    else if (s.canCollapse) out += '<button type="button" class="more-btn" data-act="todo-more" data-key="' + esc(s.key) + '" aria-expanded="true">접기 ⌃</button>';
    if (s.doneCount) out += '<button type="button" class="more-btn more-btn--quiet" data-act="todo-donelist" data-key="' + esc(s.key) + '" aria-expanded="' + !!s.showDone + '">' + (s.showDone ? '완료 숨기기 ⌃' : '완료 ' + s.doneCount + '개 ⌄') + '</button>';
    return out ? '<div class="tfoot' + (mini ? ' tfoot--mini' : '') + '">' + out + '</div>' : '';
  }
  function todoTab(t) {
    if (t.error) return notice('할 일을 불러오지 못했어요', t.error);
    var g = t.together;
    var tog = '<section class="tcard tcard--together" aria-labelledby="t-together">' +
      '<div class="tcard__head"><h2 id="t-together" class="tcard__title">함께 할 일</h2><span class="tcard__count">' + esc(g.count) + '</span></div>' +
      (g.open.length ? g.open.map(function (r) { return todoRow(r, false); }).join('') : (g.done.length ? '' : '<p class="tempty">둘이 같이 할 일을 적어 두세요. 둘 다 체크할 수 있어요</p>')) +
      g.done.map(function (r) { return todoRow(r, false); }).join('') +
      sectionFoot(g, false) +
      '<button type="button" class="add-line" data-act="todo-add" data-key="together">＋ 함께 할 일</button></section>';
    var cols = t.people.map(function (p) {
      return '<section class="tcard tcard--col" aria-labelledby="t-' + esc(p.key) + '">' +
        '<div class="tcard__head"><h2 id="t-' + esc(p.key) + '" class="tcard__name"><span class="dot dot--' + p.slot + '"></span>' + esc(p.name) + (p.mine ? ' (나)' : '') + '</h2><span class="tcard__count">' + esc(p.count) + '</span></div>' +
        (p.open.length ? p.open.map(function (r) { return todoRow(r, true); }).join('') : (p.done.length ? '' : '<p class="tempty tempty--mini">' + (p.mine ? '아직 없어요' : '남은 일이 없어요') + '</p>')) +
        p.done.map(function (r) { return todoRow(r, true); }).join('') +
        sectionFoot(p, true) +
        (p.mine ? '<button type="button" class="add-line add-line--mini" data-act="todo-add" data-key="' + esc(p.key) + '">＋ 추가</button>' : '') +
        '</section>';
    }).join('');
    return '<div class="plan">' + tog + '<div class="tcols">' + cols + '</div></div>';
  }

  var DUE_CHOICES = [['none', '없음'], ['today', '오늘'], ['tomorrow', '내일'], ['week', '이번 주'], ['date', '날짜']];
  function sheetShell(id, title, sub, inner, closeAct, entering) {
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="' + closeAct + '" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="' + id + '" class="sheet__title">' + esc(title) + '</h2></div>' +
      (sub ? '<p class="sheet__sub">' + esc(sub) + '</p>' : '') + inner + '</section></div>';
  }
  function chipRow(act, items, current, label) {
    return '<div class="pick-row" role="group" aria-label="' + esc(label) + '">' + items.map(function (it) {
      return '<button type="button" class="pick" data-act="' + act + '" data-v="' + esc(it[0]) + '" aria-pressed="' + (String(it[0]) === String(current)) + '">' + esc(it[1]) + '</button>';
    }).join('') + '</div>';
  }
  function errorLine(id, f) {
    return f.error ? '<p id="' + id + '" class="rform__error"' + (f.errorFresh ? ' role="alert"' : '') + '>' + esc(f.error) + '</p>' : '';
  }
  function todoSheet(f, entering) {
    if (!f) return '';
    var inner = '<form class="pform" data-form="todo" novalidate>' +
      '<label class="field"><span class="field__label">할 일</span><input id="td-title" class="field__input" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="예: 주말 장보기" value="' + esc(f.title) + '"' + (f.error ? ' aria-invalid="true" aria-describedby="td-error"' : '') + '></label>' +
      '<div class="field"><span class="field__label" id="td-due-label">기한</span>' + chipRow('todo-due', DUE_CHOICES, f.choice, '기한') + '</div>' +
      (f.choice === 'date' ? '<label class="field"><span class="field__label">날짜</span><input id="td-date" class="field__input" type="date" value="' + esc(f.date) + '"></label>' : '') +
      errorLine('td-error', f) +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="todo-cancel">취소</button>' +
      '<button type="submit" class="solid-btn"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : f.mode === 'edit' ? '저장' : '추가하기') + '</button></div>' +
      '</form>' +
      (f.mode === 'edit' ? '<div class="rform__more"><button type="button" class="text-btn text-btn--warn" data-act="todo-delete"' + (f.saving ? ' disabled' : '') + '>' + (f.confirmDelete ? '한 번 더 누르면 삭제돼요' : '삭제') + '</button></div>' : '');
    return sheetShell('todo-sheet-title', f.mode === 'edit' ? '할 일 고치기' : (f.scope === 'together' ? '함께 할 일 추가' : '내 할 일 추가'),
      f.scope === 'together' ? '둘 다 보고 체크할 수 있어요' : '짝꿍도 볼 수 있지만 체크는 나만 해요', inner, 'todo-cancel', entering);
  }

  // ── 시간표 ──
  function seg(mode) {
    return '<div class="seg" role="group" aria-label="보기">' +
      '<button type="button" class="seg__btn" data-act="sched-mode" data-mode="week" aria-pressed="' + (mode === 'week') + '">주</button>' +
      '<button type="button" class="seg__btn" data-act="sched-mode" data-mode="day" aria-pressed="' + (mode === 'day') + '">일</button></div>';
  }
  function legend(people, hasBoth) {
    return '<div class="slegend">' + people.map(function (p) {
      return '<span class="slegend__item"><span class="dot dot--' + p.slot + '"></span>' + esc(p.name) + (p.me ? ' (나)' : '') + '</span>';
    }).join('') + (hasBoth ? '<span class="slegend__item"><span class="swatch-both" aria-hidden="true"></span>함께</span>' : '') +
      '<span class="slegend__item"><span class="swatch-once" aria-hidden="true"></span>한 번</span></div>';
  }
  function blockHtml(b, H, opts) {
    var span = H.to - H.from;
    var top = pct((b.s - H.from) / span * 100), h = pct((b.e - b.s) / span * 100);
    var w = 50 / b.cols, left = b.lane * 50 + w * b.col;
    var label = esc(b.title);
    return '<button type="button" class="sblock sblock--' + b.slot + (b.weekly ? '' : ' sblock--once') + (opts.compact ? ' sblock--compact' : '') + (b.dup ? ' sblock--dup' : '') + '" data-act="event-open" data-id="' + esc(b.id) + '"' +
      (b.dup ? ' tabindex="-1" aria-hidden="true"' : '') +
      ' style="top:' + top + ';height:' + h + ';left:calc(' + pct(left) + ' + 1px);width:calc(' + pct(w) + ' - 2px)"' +
      ' aria-label="' + esc(b.title + ', ' + b.time + (opts.dayLabel ? ', ' + opts.dayLabel : '') + (b.weekly ? ', 매주' : ', 한 번')) + '">' +
      '<span class="sblock__title">' + label + '</span>' + (opts.compact ? '' : '<span class="sblock__time">' + esc(b.time) + '</span>') + '</button>';
  }
  function hourLines(H, withLabels, labelFull) {
    var out = '', span = H.to - H.from;
    for (var m = H.from; m <= H.to; m += 60) {
      var y = pct((m - H.from) / span * 100);
      out += '<span class="sline" style="top:' + y + '" aria-hidden="true"></span>';
      if (withLabels && ((m / 60) % 2 === 1 || labelFull) && m < H.to) out += '<span class="shour" style="top:' + y + '" aria-hidden="true">' + (labelFull ? (m / 60) + ':00' : m / 60) + '</span>';
    }
    return out;
  }
  function weekView(s) {
    var w = s.week, H = w.hours;
    var hpx = (H.to - H.from) / 60 * 30;
    var heads = w.days.map(function (d) {
      return '<button type="button" class="sday' + (d.isToday ? ' is-today' : '') + '" data-act="sched-day" data-day="' + d.day + '" aria-label="' + d.date + '일 ' + d.wd + '요일 크게 보기">' +
        '<span class="sday__wd">' + d.wd + '</span><span class="sday__date">' + d.date + '</span></button>';
    }).join('');
    var cols = w.days.map(function (d, i) {
      return '<div class="scol' + (d.isToday ? ' is-today' : '') + '">' + w.blocks.filter(function (b) { return b.dayIdx === i; }).map(function (b) {
        return blockHtml(b, H, { compact: true, dayLabel: d.wd + '요일' });
      }).join('') + '</div>';
    }).join('');
    return '<section class="card scard" aria-label="한 주 시간표">' +
      '<div class="grid-head">' +
      '<button type="button" class="icon-btn" data-act="sched-week" data-dir="-1" aria-label="지난주">‹</button>' +
      '<span class="grid-title"><span class="grid-range">' + esc(w.range) + '</span>' + (w.isThisWeek ? '' : '<button type="button" class="mini-btn" data-act="sched-thisweek">이번 주</button>') + '</span>' +
      '<button type="button" class="icon-btn" data-act="sched-week" data-dir="1" aria-label="다음 주">›</button></div>' +
      '<div class="sweek"><span></span>' + heads + '</div>' +
      '<div class="sweek sweek--body" style="height:' + hpx + 'px"><div class="shours">' + hourLines(H, true, false) + '</div>' +
      '<div class="scols">' + hourLines(H, false) + cols + '</div></div>' +
      '</section>' + legend(s.people, s.hasBoth) + '<p class="muted shint">요일을 누르면 그날을 크게 봐요 · 일정을 누르면 자세히</p>';
  }
  function dayView(s) {
    var d = s.day, H = d.hours;
    var hpx = (H.to - H.from) / 60 * 40;
    var strip = '<div class="sstrip" role="group" aria-label="요일">' + d.strip.map(function (x) {
      return '<button type="button" class="sstrip__btn' + (x.isToday ? ' is-today' : '') + '" data-act="sched-day" data-day="' + x.day + '" aria-pressed="' + x.on + '"><span>' + x.wd + '</span><b>' + x.date + '</b></button>';
    }).join('') + '</div>';
    var status = d.status ? '<section class="card sstatus" aria-label="지금"><span class="sstatus__now">지금 ' + esc(s.nowText) + '</span>' + d.status.map(function (p) {
      return '<span class="sstatus__row"><span class="dot dot--' + p.slot + '"></span><b>' + esc(p.name) + '</b> · ' + esc(p.text) + '</span>';
    }).join('') + '</section>' : '';
    var nowLine = d.now !== null && d.now >= H.from && d.now <= H.to ? '<span class="snow" style="top:' + pct((d.now - H.from) / (H.to - H.from) * 100) + '" aria-hidden="true"></span>' : '';
    var lanesHead = '<div class="slanes-head"><span></span>' + s.people.map(function (p) {
      return '<span><span class="dot dot--' + p.slot + '"></span>' + esc(p.name) + (p.me ? ' (나)' : '') + '</span>';
    }).join('') + '</div>';
    return strip + status +
      '<section class="card scard" aria-label="' + esc(d.title) + ' 시간표">' +
      '<div class="scard__title">' + esc(d.title) + '</div>' + lanesHead +
      (d.empty ? '<p class="tempty">이날은 일정이 없어요</p>' :
        '<div class="sday-body" style="height:' + hpx + 'px"><div class="shours shours--day">' + hourLines(H, true, true) + '</div>' +
        '<div class="scols scols--day">' + hourLines(H, false) + d.blocks.map(function (b) { return blockHtml(b, H, { compact: false }); }).join('') + nowLine + '</div></div>') +
      '</section>';
  }
  function scheduleTab(s) {
    if (s.error) return notice('시간표를 불러오지 못했어요', s.error);
    return '<div class="plan"><div class="plan__bar">' + seg(s.mode) +
      '<button type="button" class="chip chip--manage" data-act="event-add">＋ 일정</button></div>' +
      (s.mode === 'week' ? weekView(s) : dayView(s)) + '</div>';
  }

  var WD = [['0', '월'], ['1', '화'], ['2', '수'], ['3', '목'], ['4', '금'], ['5', '토'], ['6', '일']];
  function eventSheet(f, entering) {
    if (!f) return '';
    if (f.mode === 'view') {
      var info = '<div class="einfo"><p class="einfo__title"><span class="dot dot--' + f.slot + '"></span>' + esc(f.title) + '</p>' +
        '<p class="einfo__line">' + esc(f.whenText) + '</p><p class="einfo__line">' + esc(f.whoText) + '</p></div>' +
        (f.canEdit ? '<button type="button" class="solid-btn solid-btn--full" data-act="event-edit">수정하기</button>' : '<p class="muted">' + esc(f.lockText) + '</p>') +
        '<button type="button" class="close-btn" data-act="event-cancel">닫기</button>';
      return sheetShell('event-sheet-title', '일정', '', info, 'event-cancel', entering);
    }
    var inner = '<form class="pform" data-form="event" novalidate>' +
      '<label class="field"><span class="field__label">일정 이름</span><input id="ev-title" class="field__input" type="text" maxlength="20" autocomplete="off" enterkeyhint="done" placeholder="예: 일반생물 수업" value="' + esc(f.title) + '"' + (f.error ? ' aria-invalid="true" aria-describedby="ev-error"' : '') + '></label>' +
      '<div class="field"><span class="field__label">누구</span>' + (f.lockOwner ? '<p class="muted">함께 일정 · 둘 다 고칠 수 있어요</p>' : chipRow('ev-owner', [['me', '나'], ['both', '함께']], f.owner, '누구 일정')) + '</div>' +
      '<div class="field"><span class="field__label">반복</span>' + chipRow('ev-repeat', [['weekly', '매주'], ['once', '한 번']], f.weekly ? 'weekly' : 'once', '반복') + '</div>' +
      (f.weekly ? '<div class="field"><span class="field__label">요일</span>' + chipRow('ev-wd', WD, f.weekday, '요일') + '</div>'
        : '<label class="field"><span class="field__label">날짜</span><input id="ev-date" class="field__input" type="date" value="' + esc(f.date) + '"></label>') +
      '<div class="ftime"><label class="field"><span class="field__label">시작</span><input id="ev-start" class="field__input" type="time" step="300" value="' + esc(f.start) + '"></label>' +
      '<label class="field"><span class="field__label">끝</span><input id="ev-end" class="field__input" type="time" step="300" value="' + esc(f.end) + '"></label></div>' +
      errorLine('ev-error', f) +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="event-cancel">취소</button>' +
      '<button type="submit" class="solid-btn"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : f.mode === 'edit' ? '저장' : '추가하기') + '</button></div>' +
      '</form>' +
      (f.mode === 'edit' ? '<div class="rform__more"><button type="button" class="text-btn text-btn--warn" data-act="event-delete"' + (f.saving ? ' disabled' : '') + '>' + (f.confirmDelete ? '한 번 더 누르면 삭제돼요' : '삭제') + '</button></div>' : '');
    return sheetShell('event-sheet-title', f.mode === 'edit' ? '일정 고치기' : '일정 추가', '짝꿍도 볼 수 있어요. 고치는 건 나(함께 일정은 둘 다)만', inner, 'event-cancel', entering);
  }

  var api = { tabbar: tabbar, todoTab: todoTab, todoSheet: todoSheet, scheduleTab: scheduleTab, eventSheet: eventSheet };
  root.RT = root.RT || {};
  root.RT.viewPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
