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
  // 여러 개 고르는 칩 (요일)
  function multiRow(act, items, on, label) {
    return '<div class="pick-row" role="group" aria-label="' + esc(label) + '">' + items.map(function (it) {
      return '<button type="button" class="pick" data-act="' + act + '" data-v="' + esc(it[0]) + '" aria-pressed="' + (on.indexOf(it[0]) >= 0) + '">' + esc(it[1]) + '</button>';
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
    var w = b.full && opts.compact ? 100 : 50 / b.cols, left = b.full && opts.compact ? 0 : b.lane * 50 + w * b.col;
    var showIco = b.icon && !(opts.compact && b.e - b.s < 50); // 주 보기에서 짧은 일정은 이름이 먼저
    var label = (showIco ? '<span class="sblock__ico" aria-hidden="true">' + esc(b.icon) + '</span>' : '') + '<span class="sblock__name">' + esc(opts.compact && b.short ? b.short : b.title) + '</span>'; // 주 보기는 표시할 이름
    return '<button type="button" class="sblock sblock--' + b.slot + (b.weekly ? '' : ' sblock--once') + (opts.compact ? ' sblock--compact' : '') + (b.dup ? ' sblock--dup' : '') + (b.full && opts.compact ? ' sblock--full' : '') + '" data-act="event-open" data-id="' + esc(b.id) + '" data-at="' + esc(b.id + '@' + (b.dayIdx || 0)) + '"' + (typeof b.day === 'number' ? ' data-day="' + b.day + '"' : '') +
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
    var hpx = (H.to - H.from) / 60 * 40; // 1시간 40px (글자가 들어가게)
    var heads = w.days.map(function (d) {
      return '<button type="button" class="sday' + (d.isToday ? ' is-today' : '') + (d.picked ? ' is-picked' : '') + '" data-act="sched-day" data-day="' + d.day + '" aria-pressed="' + !!d.picked + '" aria-label="' + d.date + '일 ' + d.wd + '요일 일정 목록 보기">' +
        '<span class="sday__wd">' + d.wd + '</span><span class="sday__date">' + d.date + '</span></button>';
    }).join('');
    var cols = w.days.map(function (d, i) {
      // 오늘 칸에는 지금 선 (사람 · 함께 색이 아닌 글자색)
      var nowLine = w.now && w.now.idx === i && w.now.min >= H.from && w.now.min <= H.to ? '<span class="snow snow--week" style="top:' + pct((w.now.min - H.from) / (H.to - H.from) * 100) + '" aria-hidden="true"></span>' : '';
      return '<div class="scol' + (d.isToday ? ' is-today' : '') + (d.picked ? ' is-picked' : '') + '">' + w.blocks.filter(function (b) { return b.dayIdx === i; }).map(function (b) {
        return blockHtml(b, H, { compact: true, dayLabel: d.wd + '요일' });
      }).join('') + nowLine + '</div>';
    }).join('');
    return '<section class="card scard" aria-label="한 주 시간표">' +
      '<div class="grid-head">' +
      '<button type="button" class="icon-btn" data-act="sched-week" data-dir="-1" aria-label="지난주">‹</button>' +
      '<span class="grid-title"><span class="grid-range">' + esc(w.range) + '</span>' + (w.isThisWeek ? '' : '<button type="button" class="mini-btn" data-act="sched-thisweek">이번 주</button>') + '</span>' +
      '<button type="button" class="icon-btn" data-act="sched-week" data-dir="1" aria-label="다음 주">›</button></div>' +
      '<div class="sweek"><span></span>' + heads + '</div>' +
      '<div class="sweek sweek--body" style="height:' + hpx + 'px"><div class="shours">' + hourLines(H, true, false) + '</div>' +
      '<div class="scols">' + hourLines(H, false) + cols + '</div></div>' +
      '</section>' + legend(s.people, s.hasBoth) + pickList(w.pick) + '<p class="muted shint">요일을 누르면 아래에 그날 일정이 나와요 · 일정을 누르면 자세히</p>';
  }
  // 고른 요일 목록: 두 사람 일정을 시간 순서로 (왼쪽 색 막대 = 사람, 함께는 강조 카드)
  function pickList(p) {
    if (!p) return '';
    var rows = p.items.map(function (it) {
      return '<button type="button" class="slist__item slist__item--' + it.slot + (it.weekly ? '' : ' slist__item--once') + (it.skipped ? ' slist__item--skipped' : '') + '" data-act="event-open" data-id="' + esc(it.id) + '" data-at="' + esc(it.id + '@list') + '" data-day="' + it.day + '"' +
        ' aria-label="' + esc(it.title + ', ' + it.time + ', ' + it.who + (it.catName ? ', ' + it.catName : '') + (it.weekly ? ', 매주' : ', 한 번') + (it.skipped ? ', 이날은 쉬어요' : '')) + '">' +
        (it.slot === 'both' ? '' : '<span class="slist__bar" aria-hidden="true"></span>') +
        (it.icon ? '<span class="slist__ico" aria-hidden="true">' + esc(it.icon) + '</span>' : '') +
        '<span class="slist__title">' + esc(it.title) + (it.skipped ? ' <span class="tag tag--rest">쉬어요</span>' : '') + '</span><span class="slist__who">' + esc(it.who) + '</span>' +
        '<span class="slist__time">' + esc(it.time) + '</span></button>';
    }).join('');
    return '<section class="card slist" aria-label="' + esc(p.title) + ' 일정">' +
      '<div class="slist__head"><span class="slist__title-day">' + esc(p.title) + (p.isToday ? ' <span class="tag">오늘</span>' : '') + '</span>' +
      '<button type="button" class="mini-btn" data-act="sched-open-day" data-day="' + p.day + '">크게 보기</button></div>' +
      (rows || '<p class="tempty">이날은 일정이 없어요</p>') + '</section>';
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
      '</section>' + restList(d.skipped);
  }
  // 일 보기 아래: 이날 쉬는 매주 일정 (눌러서 되돌릴 수 있게)
  function restList(list) {
    if (!list || !list.length) return '';
    return '<section class="card slist" aria-label="이날 쉬는 일정"><div class="slist__head"><span class="slist__title-day">이날 쉬는 일정</span></div>' + list.map(function (it) {
      return '<button type="button" class="slist__item slist__item--skipped" data-act="event-open" data-id="' + esc(it.id) + '" data-at="' + esc(it.id + '@rest') + '" data-day="' + it.day + '" aria-label="' + esc(it.title + ', ' + it.time + ', 이날은 쉬어요') + '">' +
        '<span class="slist__title">' + esc(it.title) + ' <span class="tag tag--rest">쉬어요</span></span><span class="slist__time">' + esc(it.time) + '</span></button>';
    }).join('') + '</section>';
  }
  function scheduleTab(s) {
    if (s.error) return notice('시간표를 불러오지 못했어요', s.error);
    return '<div class="plan"><div class="plan__bar">' + seg(s.mode) +
      '<button type="button" class="chip chip--manage" data-act="event-add">＋ 일정</button></div>' +
      (s.mode === 'week' ? weekView(s) : dayView(s)) + '</div>';
  }

  var WD = [['0', '월'], ['1', '화'], ['2', '수'], ['3', '목'], ['4', '금'], ['5', '토'], ['6', '일']];
  // 시간: 요일이 여럿이면 「모두 같은 시간 | 요일마다 다르게」, 요일마다면 요일별 시작 · 끝 줄
  function timeFields(f) {
    var days = f.weekly ? (f.weekdays || []) : [];
    var multi = days.length > 1, per = multi && f.perDay;
    var mode = multi ? '<div class="field"><span class="field__label">시간</span>' + chipRow('ev-timemode', [['same', '모두 같은 시간'], ['per', '요일마다 다르게']], per ? 'per' : 'same', '시간') + '</div>' : '';
    if (!per) {
      return mode + '<div class="ftime"><label class="field"><span class="field__label">시작</span><input id="ev-start" class="field__input" type="time" step="300" value="' + esc(f.start) + '"></label>' +
        '<label class="field"><span class="field__label">끝</span><input id="ev-end" class="field__input" type="time" step="300" value="' + esc(f.end) + '"></label></div>';
    }
    var NAMES = ['월', '화', '수', '목', '금', '토', '일'];
    return mode + '<div class="drows" role="group" aria-label="요일마다 시간"><div class="drow drow--head" aria-hidden="true"><span></span><span>시작</span><span>끝</span></div>' +
      days.map(function (w) {
        var t = (f.times || {})[w] || { start: f.start, end: f.end };
        return '<div class="drow"><b class="drow__day">' + NAMES[w] + '</b>' +
          '<input id="ev-ts-' + w + '" class="field__input" type="time" step="300" aria-label="' + NAMES[w] + '요일 시작" value="' + esc(t.start) + '">' +
          '<input id="ev-te-' + w + '" class="field__input" type="time" step="300" aria-label="' + NAMES[w] + '요일 끝" value="' + esc(t.end) + '"></div>';
      }).join('') + '</div>';
  }
  // 매주 일정: 누른 날만(또는 그 주만) 쉬기 · 쉬는 날 목록 — 누르면 바로 저장
  function skipBox(k) {
    if (!k || (!k.occ && !k.list.length)) return '';
    var dis = k.busy ? ' disabled' : '', o = k.occ, out = '<section class="skipbox" aria-label="쉬는 날">';
    if (o) {
      out += '<p class="skipbox__title">' + esc(o.label) + (o.skipped ? ' · 쉬는 날' : '') + '</p>';
      out += o.skipped
        ? '<div class="skipbox__row"><button type="button" class="ghost-btn" data-act="ev-unskip" data-v="' + esc(o.key) + '"' + dis + '>이날 다시 하기</button></div>'
        : '<div class="skipbox__row"><button type="button" class="ghost-btn" data-act="ev-skip" data-v="' + esc(o.key) + '"' + dis + '>🌿 이날만 쉬기</button>' +
          (o.weekKey && !o.weekSkipped ? '<button type="button" class="ghost-btn" data-act="ev-skip" data-v="' + esc(o.weekKey) + '"' + dis + '>이번 주 모두 쉬기</button>' : '') + '</div>';
      out += '<p class="skipbox__hint">휴강처럼 그날만 시간표에서 빠져요 · 매주 일정은 그대로</p>';
    }
    if (k.list.length) {
      out += '<div class="skipbox__list"><span class="field__label">쉬는 날 <span class="field__hint">· 누르면 다시 해요</span></span><div class="chips chips--wrap">' + k.list.map(function (x) {
        return '<button type="button" class="chip chip--rest' + (x.past ? ' is-past' : '') + '" data-act="ev-unskip" data-v="' + esc(x.key) + '" aria-label="' + esc(x.label + ' 다시 하기') + '"' + dis + '>' + esc(x.label) + ' ✕</button>';
      }).join('') + '</div></div>';
    }
    return out + '</section>';
  }
  // 일정 폼의 카테고리 칩 + 맨 끝 「편집」(카테고리 시트로)
  function catRow(cats, current) {
    return '<div class="pick-row" role="group" aria-label="카테고리">' + cats.map(function (c) {
      return '<button type="button" class="pick" data-act="ev-cat" data-v="' + esc(c.id) + '" aria-pressed="' + (c.id === current) + '">' + esc(c.icon + ' ' + c.name) + '</button>';
    }).join('') + '<button type="button" class="pick pick--edit" data-act="cat-open" aria-label="카테고리 추가 · 고치기">✎ 편집</button></div>';
  }
  // 「카테고리」 시트 — 둘이 같이 쓰는 목록, 추가 · 이름 · 아이콘 바꾸기 · 지우기
  function catForm(f, icons) {
    var grid = icons.map(function (ic) {
      return '<button type="button" class="icon-pick" data-act="cat-icon" data-icon="' + esc(ic) + '" aria-pressed="' + (ic === f.icon) + '" aria-label="아이콘 ' + esc(ic) + '">' + esc(ic) + '</button>';
    }).join('');
    var dis = f.saving ? ' disabled' : '';
    return '<div class="rform" role="group" aria-labelledby="cat-form-title">' +
      '<span id="cat-form-title" class="rform__title">' + (f.id ? '카테고리 고치기' : '새 카테고리') + '</span>' +
      '<div class="cpreview" aria-hidden="true"><span class="emoji-tile emoji-tile--lg">' + esc(f.icon || '·') + '</span><span class="cpreview__name">' + esc(String(f.name || '').trim() || '이름') + '</span></div>' +
      '<label class="field"><span class="field__label">이름 <span class="field__hint">· ' + f.max + '자까지</span></span>' +
      '<input id="cat-name" class="field__input" type="text" maxlength="' + f.max + '" autocomplete="off" enterkeyhint="done" placeholder="예: 동아리" value="' + esc(f.name) + '"' +
      (f.error ? ' aria-invalid="true" aria-describedby="cat-error"' : '') + '></label>' +
      '<div class="field"><span class="field__label" id="cat-icon-label">아이콘</span><div class="icon-grid" role="group" aria-labelledby="cat-icon-label">' + grid + '</div></div>' +
      errorLine('cat-error', f) +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="cat-cancel">취소</button>' +
      '<button type="button" class="solid-btn" data-act="cat-save"' + dis + '>' + (f.saving ? '저장 중…' : f.id ? '저장' : '추가하기') + '</button></div>' +
      (f.id ? '<div class="rform__more"><button type="button" class="text-btn text-btn--warn" data-act="cat-delete"' + dis + '>' + (f.confirmDelete ? '한 번 더 누르면 삭제돼요' : '삭제') + '</button></div>' +
        (f.confirmDelete && f.uses ? '<p class="muted cnote">이 카테고리를 쓰는 일정 ' + f.uses + '개는 카테고리 없이 보여요</p>' : '') : '') +
      '</div>';
  }
  function catSheet(m, entering) {
    if (!m) return '';
    var list = m.list.length ? m.list.map(function (c) {
      return '<div class="mitem' + (m.edit && m.edit.id === c.id ? ' is-editing' : '') + '"><span class="emoji-tile" aria-hidden="true">' + esc(c.icon) + '</span>' +
        '<div class="mitem__text"><span class="mitem__name">' + esc(c.name) + '</span><span class="mitem__status">' + (c.uses ? '일정 ' + c.uses + '개' : '아직 쓰는 일정 없음') + '</span></div>' +
        (m.edit && m.edit.id === c.id ? '' : '<button type="button" class="small-btn" data-act="cat-edit" data-id="' + esc(c.id) + '" aria-label="' + esc(c.name) + ' 수정">수정</button>') + '</div>';
    }).join('') : '<p class="muted">카테고리가 없어요. 새로 만들어 보세요</p>';
    var inner = (m.error ? '<p class="rform__error" role="alert">' + esc(m.error) + '</p>' : '') +
      '<div class="mlist">' + list + '</div>' +
      (m.edit ? catForm(m.edit, m.icons) : (m.full ? '<p class="muted">카테고리는 ' + m.max + '개까지 만들 수 있어요</p>' : '<button type="button" class="add-btn" data-act="cat-new">＋ 새 카테고리</button>')) +
      '<button type="button" class="close-btn" data-act="cat-close">' + (m.hasBack ? '일정으로 돌아가기' : '닫기') + '</button>';
    return sheetShell('cat-sheet-title', '카테고리', '둘이 같이 쓰는 목록이에요 · 바꾸면 짝꿍 화면에도 바뀌어요', inner, 'cat-close', entering);
  }
  function eventSheet(f, entering) {
    if (!f) return '';
    if (f.mode === 'view') {
      var info = '<div class="einfo"><p class="einfo__title"><span class="dot dot--' + f.slot + '"></span>' + esc(f.title) + '</p>' +
        '<p class="einfo__line">' + esc(f.whenText) + '</p><p class="einfo__line">' + esc(f.whoText) + '</p>' +
        (f.skipText ? '<p class="einfo__line einfo__rest">🌿 ' + esc(f.skipText) + '</p>' : '') + '</div>' +
        (f.canEdit ? '<button type="button" class="solid-btn solid-btn--full" data-act="event-edit">수정하기</button>' : '<p class="muted">' + esc(f.lockText) + '</p>') +
        '<button type="button" class="close-btn" data-act="event-cancel">닫기</button>';
      return sheetShell('event-sheet-title', '일정', '', info, 'event-cancel', entering);
    }
    var inner = skipBox(f.skipInfo) + '<form class="pform" data-form="event" novalidate>' +
      '<label class="field"><span class="field__label">일정 이름</span><input id="ev-title" class="field__input" type="text" maxlength="20" autocomplete="off" enterkeyhint="done" placeholder="예: 일반생물 수업" value="' + esc(f.title) + '"' + (f.error ? ' aria-invalid="true" aria-describedby="ev-error"' : '') + '></label>' +
      '<label class="field"><span class="field__label">표시할 이름 <span class="field__hint">· 주 보기 칸에 보여요 · 비워 두면 일정 이름 그대로</span></span><input id="ev-short" class="field__input" type="text" maxlength="' + RT.schedule.SHORT_MAX + '" autocomplete="off" enterkeyhint="done" placeholder="예: 4디리" value="' + esc(f.short || '') + '"></label>' +
      '<div class="field"><span class="field__label">누구</span>' + (f.lockOwner ? '<p class="muted">함께 일정 · 둘 다 고칠 수 있어요</p>' : chipRow('ev-owner', [['me', '나'], ['both', '함께']], f.owner, '누구 일정')) + '</div>' +
      '<div class="field"><span class="field__label">카테고리</span>' + catRow(f.cats || RT.schedule.CATS, f.cat) + '</div>' +
      '<div class="field"><span class="field__label">반복</span>' + chipRow('ev-repeat', [['weekly', '매주'], ['once', '한 번']], f.weekly ? 'weekly' : 'once', '반복') + '</div>' +
      (f.weekly ? '<div class="field"><span class="field__label">요일 <span class="field__hint">· 여러 개 고를 수 있어요</span></span>' +
        multiRow('ev-wd', WD.map(function (w) { return [Number(w[0]), w[1]]; }), f.weekdays || [], '요일 (여러 개 고를 수 있어요)') + '</div>'
        : '<label class="field"><span class="field__label">날짜</span><input id="ev-date" class="field__input" type="date" value="' + esc(f.date) + '"></label>') +
      timeFields(f) +
      errorLine('ev-error', f) +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="event-cancel">취소</button>' +
      '<button type="submit" class="solid-btn"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : f.mode === 'edit' ? '저장' : '추가하기') + '</button></div>' +
      '</form>' +
      (f.mode === 'edit' ? '<div class="rform__more"><button type="button" class="text-btn text-btn--warn" data-act="event-delete"' + (f.saving ? ' disabled' : '') + '>' + (f.confirmDelete ? '한 번 더 누르면 삭제돼요' : '삭제') + '</button></div>' : '');
    return sheetShell('event-sheet-title', f.mode === 'edit' ? '일정 고치기' : '일정 추가', '짝꿍도 볼 수 있어요. 고치는 건 나(함께 일정은 둘 다)만', inner, 'event-cancel', entering);
  }

  var api = { tabbar: tabbar, todoTab: todoTab, todoSheet: todoSheet, scheduleTab: scheduleTab, eventSheet: eventSheet, catSheet: catSheet };
  root.RT = root.RT || {};
  root.RT.viewPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
