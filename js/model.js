/* 화면 모델 — 저장된 기록과 오늘 날짜로 "무엇을 보여 줄지"만 계산한다 (HTML은 view.js).
   node에서도 돌아가서 테스트할 수 있다. */
(function (root) {
  'use strict';
  var RT = root.RT || {};
  var D = RT.dates || require('./dates.js');
  var S = RT.streak || require('./streak.js');
  var SEASON = RT.seasons || require('./seasons.js');
  var P = RT.people || require('./people.js');
  var ICONS = RT.icons || require('./icons.js');

  var SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;
  var NAME_MAX = 20;

  /** 루틴 목록 정리. 시작일이 이상하거나 키가 이상한 항목은 뺀다. end: 마지막으로 한 날(그만한 루틴). */
  function routinesFrom(config) {
    var list = config && Array.isArray(config.routines) ? config.routines : [];
    return list.map(function (r, i) {
      var end = r.end ? D.parse(r.end) : NaN;
      return {
        key: String(r.key || ''), icon: String(r.icon || ''), name: String(r.name || '').slice(0, NAME_MAX),
        who: String(r.who || ''), owner: String(r.owner || r.who || ''),
        start: D.parse(r.start), end: isNaN(end) ? null : end,
        order: typeof r.order === 'number' ? r.order : i
      };
    }).filter(function (r) {
      return SAFE_ID.test(r.key) && SAFE_ID.test(r.owner) && r.owner !== 'all' && !isNaN(r.start);
    }).map(function (r) {
      // 그만둔 날이 시작일보다 앞서 있으면(두 기기에서 엇갈려 저장된 경우) 시작일 하루만 한 것으로 본다
      if (r.end !== null && r.end < r.start) r.end = r.start;
      return r;
    }).sort(function (a, b) { return a.order - b.order; });
  }

  /** 그날 하고 있는 루틴인가 (시작 후, 그만두기 전). */
  function activeOn(r, day) { return day >= r.start && (r.end === null || day <= r.end); }

  function doneChecker(checks, today) {
    return function (r, day) {
      if (!activeOn(r, day) || day > today) return false;
      return !!checks[r.key + '|' + D.toKey(day)];
    };
  }

  function chipsFor(routines, names, filter) {
    return [{ id: 'all', label: '전체', on: filter === 'all' }].concat(P.list(routines).map(function (p) {
      return { id: p.person, label: names[p.person] || p.name, on: filter === p.person };
    }));
  }

  function streakText(sum) {
    if (sum.todayDone) return { label: '연속', value: sum.streak + '일차' };
    return { label: '연속 · 오늘 하면 ' + (sum.streak + 1) + '일차', value: sum.streak + '일' };
  }

  function summaryOf(r, today, isDone) {
    // 그만한 루틴은 마지막 날까지만 센다
    var until = r.end !== null ? Math.min(r.end, today) : today;
    return S.summary({ start: r.start, today: until, isDone: function (d) { return isDone(r, d); } });
  }

  function cardFor(r, names, today, isDone, slots) {
    var sum = summaryOf(r, today, isDone);
    var who = names[r.owner] || r.who;
    // 사람 표시 점 색: 먼저 루틴을 만든 사람 = 진한 색, 다음 사람 = 중간 색 (사람 키가 무엇이든)
    var base = { key: r.key, icon: r.icon, name: r.name, who: who, owner: r.owner, dot: slots[r.owner] === 0 ? 'her' : 'me', startText: D.label(r.start) + ' 시작' };
    if (!sum.started) {
      return Object.assign(base, {
        started: false, count: '', dayLabel: '시작까지', dayValue: 'D-' + sum.daysUntil,
        streakLabel: '연속', streakValue: '—', clean: false,
        hint: D.label(r.start) + '이 1일차예요'
      });
    }
    var st = streakText(sum);
    var hint;
    if (sum.lastMiss !== null) hint = '최근 쉰 날 ' + D.label(sum.lastMiss) + ' · 최고 연속 ' + sum.best + '일';
    else if (sum.dayN === 1 && !sum.todayDone) hint = '오늘이 1일차예요';
    else hint = '시작부터 하루도 안 쉬었어요 👏';
    if (r.end === today) hint += ' · 오늘까지 해요';
    return Object.assign(base, {
      started: true, count: sum.count + '/' + sum.dayN + '일',
      dayLabel: '시작', dayValue: sum.dayN + '일차',
      streakLabel: st.label, streakValue: st.value,
      clean: sum.lastMiss === null && sum.streak > 0,
      hint: hint
    });
  }

  /**
   * 하루의 단계. '모두'는 보고 있는 사람 각자가 그날 루틴이 있고, 자기 루틴을 다 한 날만.
   * (한 사람만 루틴이 있던 날 → 그 사람이 다 해도 '일부'. 루틴이 늘고 줄어도 지난 날은 그대로)
   */
  function dayLevel(set, persons, day, isDone) {
    var active = set.filter(function (r) { return activeOn(r, day); });
    if (!active.length) return { level: 'pre', active: 0, done: 0 };
    var done = active.filter(function (r) { return isDone(r, day); }).length;
    // 그날 참여 중인 사람 = 아직 그만두지 않은 루틴이 있는 사람 (시작 전 루틴도 포함)
    var joined = persons.filter(function (p) {
      return set.some(function (r) { return r.owner === p && (r.end === null || r.end >= day); });
    });
    var everyone = joined.every(function (p) {
      var mine = active.filter(function (r) { return r.owner === p; });
      return mine.length > 0 && mine.every(function (r) { return isDone(r, day); });
    });
    return { level: everyone ? 'full' : done > 0 ? 'half' : 'none', active: active.length, done: done };
  }

  var MONTHS_AROUND = 12;

  /** 월 단위 그리드. page 0 = 이번 달, 1 = 지난달, -1 = 다음 달 … */
  function gridFor(set, persons, today, page, isDone) {
    var firstStart = Math.min.apply(null, set.map(function (r) { return r.start; }));
    var t = D.parts(today), f = D.parts(Math.min(firstStart, today));
    // 지난달은 시작한 달보다 12달 앞까지, 앞으로는 12달 뒤까지 넘겨 볼 수 있다
    var maxPage = (t.y - f.y) * 12 + (t.m - f.m) + MONTHS_AROUND;
    var minPage = -MONTHS_AROUND;
    var p = Math.min(Math.max(minPage, page | 0), maxPage);
    var mi = t.y * 12 + (t.m - 1) - p;
    var y = Math.floor(mi / 12), m = mi % 12 + 1;
    var monthFirst = D.fromYMD(y, m, 1);
    var monthLast = D.fromYMD(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1;
    var startWeek = D.weekStart(monthFirst);
    var endWeek = D.weekStart(monthLast);
    var cells = [];
    for (var day = startWeek; day <= endWeek + 6; day++) {
      if (day < monthFirst || day > monthLast) { cells.push({ day: day, level: 'out', out: true }); continue; }
      var future = day > today;
      var dl = dayLevel(set, persons, day, isDone);
      var lv = future ? 'future' : dl.level;
      cells.push({
        day: day, level: lv, today: day === today,
        label: String(D.parts(day).d),
        disabled: future || lv === 'pre',
        aria: D.full(day) + (day === today ? ', 오늘' : '') + (future ? '' : lv === 'pre' ? ', 루틴 없음' : ', ' + dl.active + '개 중 ' + dl.done + '개 완료')
      });
    }
    var legend = persons.length > 1
      ? [{ level: 'none', label: '안 함' }, { level: 'half', label: '일부' }, { level: 'full', label: '모두' }]
      : [{ level: 'none', label: '안 함' }, { level: 'half', label: '일부' }, { level: 'full', label: '완료' }];
    if (persons.length === 1 && set.length === 1) legend = [legend[0], legend[2]];
    return { cells: cells, legend: legend, page: p, canPrev: p < maxPage, canNext: p > minPage, isThisMonth: p === 0, range: y + '년 ' + m + '월' };
  }

  /** 모두 해낸 날 연속 — 두 사람 모두 루틴이 생긴 날부터 센다. */
  function bothFor(routines, persons, today, isDone) {
    if (persons.length < 2) return null;
    var starts = persons.map(function (p) {
      return Math.min.apply(null, routines.filter(function (r) { return r.owner === p; }).map(function (r) { return r.start; }));
    });
    var start = Math.max.apply(null, starts);
    var full = function (d) { return dayLevel(routines, persons, d, isDone).level === 'full'; };
    var sum = S.summary({ start: start, today: today, isDone: full });
    if (!sum.started) return { value: '—', hint: D.label(start) + '부터 세요' };
    var hint = D.label(start) + '부터 · 최고 ' + sum.best + '일';
    if (!sum.todayDone) hint += ' · 오늘 모두 하면 ' + (sum.streak + 1) + '일';
    return { value: sum.streak + '일', hint: hint };
  }

  /** 누가 · 언제 체크했는지 한 줄 (예: '다진 · 오전 9:33 체크'). 시각은 그날이 오늘일 때만. */
  function byText(names, m, isToday) {
    if (!m || !m.by) return '';
    var name = names[m.by];
    if (!name) return '';
    var t = isToday ? D.timeLabel(m.at) : '';
    return name + (t ? ' · ' + t : '') + ' 체크';
  }

  function sheetFor(routines, names, today, day, isDone, me, meta, persons) {
    if (day === null || day === undefined || day > today) return null;
    var isToday = day === today;
    // 그날 이전에 그만둔 루틴은 빼고, 아직 시작 안 한 루틴은 '시작 전'으로 보여 준다
    var shown = routines.filter(function (r) { return r.end === null || r.end >= day; });
    var active = shown.filter(function (r) { return activeOn(r, day); });
    if (!active.length) return null;
    var cnt = active.filter(function (r) { return isDone(r, day); }).length;
    var rows = shown.map(function (r) {
      var mine = !!me && r.owner === me;
      var who = names[r.owner] || r.who;
      if (day < r.start) return { key: r.key, icon: r.icon, name: r.name, who: who, pre: true, mine: mine, locked: true, done: false, meta: D.label(r.start) + '부터 시작', by: '', button: '시작 전' };
      var d = isDone(r, day);
      var nth = day - r.start + 1;
      var metaText = nth + '일차';
      if (isToday) {
        var sum = summaryOf(r, today, isDone);
        metaText += ' · ' + (d ? '연속 ' + sum.streak + '일차' : '하면 연속 ' + (sum.streak + 1) + '일차');
      }
      var button = d ? '완료' : mine ? (isToday ? '체크' : '안 함') : (isToday ? '아직' : '안 함');
      return {
        key: r.key, icon: r.icon, name: r.name, who: who, pre: false, mine: mine, locked: !mine, done: d,
        meta: metaText, by: d ? byText(names, (meta || {})[r.key + '|' + D.toKey(day)], isToday) : '', button: button
      };
    });
    var mineActive = active.filter(function (r) { return r.owner === me; });
    var sub = active.length + '개 중 ' + cnt + '개 완료';
    if (isToday && dayLevel(routines, persons, day, isDone).level === 'full') sub = '모두 완료! 오늘도 해냈어요';
    if (!me) sub += ' · 먼저 누구인지 골라 주세요';
    else if (mineActive.length) sub += isToday ? ' · 내 루틴만 체크할 수 있어요' : ' · 내 루틴은 눌러서 고칠 수 있어요';
    return { day: day, title: D.full(day), isToday: isToday, sub: sub, rows: rows };
  }

  /** 「내 루틴」 시트 */
  function manageFor(routines, today, me, manage, checks) {
    if (!manage || !manage.open || !me) return null;
    var mine = routines.filter(function (r) { return r.owner === me; });
    function status(r) {
      if (r.end !== null && r.end < today) return D.label(r.start) + ' ~ ' + D.label(r.end) + ' · 기록은 그리드에 남아 있어요';
      if (r.start > today) return D.label(r.start) + ' 시작 · D-' + (r.start - today);
      return D.label(r.start) + ' 시작 · ' + (today - r.start + 1) + '일차' + (r.end === today ? ' · 오늘까지' : '');
    }
    function hasChecks(r) {
      for (var id in checks) if (id.indexOf(r.key + '|') === 0) return true;
      return false;
    }
    var f = manage.form;
    var item = function (r) { return { key: r.key, icon: r.icon, name: r.name, status: status(r), editing: !!f && f.key === r.key }; };
    var form = null;
    if (f) {
      var editing = f.key ? mine.filter(function (r) { return r.key === f.key; })[0] : null;
      if (f.key && !editing) return { current: mine.filter(function (r) { return r.end === null || r.end >= today; }).map(item), ended: mine.filter(function (r) { return r.end !== null && r.end < today; }).map(item), form: null, gone: true };
      form = {
        mode: editing ? 'edit' : 'add', key: editing ? editing.key : null,
        name: f.name, icon: f.icon, start: f.start, error: f.error || '', errorFresh: !!f.errorFresh, saving: !!f.saving, confirmDelete: !!f.confirmDelete, confirmStart: !!f.confirmStart,
        icons: ICONS.ROUTINE_ICONS.map(function (e) { return { e: e, on: e === f.icon }; }),
        canStop: !!editing && (editing.end === null || editing.end > today) && editing.start <= today,
        canDelete: !!editing && !hasChecks(editing)
      };
    }
    return {
      current: mine.filter(function (r) { return r.end === null || r.end >= today; }).map(item),
      ended: mine.filter(function (r) { return r.end !== null && r.end < today; }).map(item),
      form: form
    };
  }

  /** 입력한 루틴 확인. 문제가 있으면 한국어 안내, 없으면 ''. */
  function validateRoutine(f) {
    var name = String(f.name || '').trim();
    if (!name) return '루틴 이름을 적어 주세요';
    if (name.length > NAME_MAX) return '이름은 ' + NAME_MAX + '자까지 쓸 수 있어요';
    if (!ICONS.isAllowed(f.icon)) return '아이콘을 골라 주세요';
    if (isNaN(D.parse(f.start))) return '시작일을 골라 주세요';
    return '';
  }

  /**
   * state: { config, checks, meta, me, identity, today, filter, page, sheetDay, manage }
   */
  function build(state) {
    var today = state.today;
    var routines = routinesFrom(state.config);
    var names = P.names(state.config, routines);
    var season = SEASON.seasonOf(D.parts(today).m);
    var header = {
      date: D.full(today), season: season,
      meName: state.me ? names[state.me] || '' : '',
      canRepick: !!state.me && state.identity === 'device'
    };
    var isDone = doneChecker(state.checks || {}, today);
    var manage = manageFor(routines, today, state.me || null, state.manage, state.checks || {});
    var pickPeople = Object.keys(names).map(function (k) { return { person: k, name: names[k] }; });
    if (!routines.length) return { header: header, empty: true, manage: manage, canManage: !!state.me, needsPick: !state.me && state.identity === 'none', people: pickPeople };
    var filter = state.filter || 'all';
    var set = routines.filter(function (r) { return filter === 'all' || r.owner === filter; });
    if (!set.length) { filter = 'all'; set = routines; }
    var allPersons = P.list(routines).map(function (p) { return p.person; });
    var slots = {};
    allPersons.forEach(function (p, i) { slots[p] = i; });
    var persons = filter === 'all' ? allPersons : [filter];
    var visibleCards = set.filter(function (r) { return r.end === null || r.end >= today; });
    var activeToday = routines.filter(function (r) { return activeOn(r, today); });
    return {
      kung: kungFor(state, names, routines, today, isDone),
      header: header,
      empty: false,
      filter: filter,
      chips: chipsFor(routines, names, filter),
      canManage: !!state.me,
      grid: gridFor(set, persons, today, state.page || 0, isDone),
      cards: visibleCards.map(function (r) { return cardFor(r, names, today, isDone, slots); }),
      both: filter === 'all' ? bothFor(routines, persons, today, isDone) : null,
      sheet: sheetFor(routines, names, today, state.sheetDay, isDone, state.me || null, state.meta, allPersons),
      manage: manage,
      people: pickPeople,
      needsPick: !state.me && state.identity === 'none',
      allDoneToday: activeToday.length > 0 && dayLevel(routines, allPersons, today, isDone).level === 'full',
      togetherToday: allPersons.filter(function (p) { return activeToday.some(function (r) { return r.owner === p; }); }).length > 1,
      emptyFilter: visibleCards.length === 0
    };
  }

  /** 꿍 보내기 칸: 짝꿍의 오늘 루틴이 남아 있으면 보낼 수 있고, 오늘 이미 보냈으면 잠긴다 (없으면 null) */
  function kungFor(state, names, routines, today, isDone) {
    if (!state.me || state.kungOff) return null;
    var to = Object.keys(names).filter(function (k) { return k !== state.me; })[0];
    if (!to) return null;
    var theirs = routines.filter(function (r) { return r.owner === to && activeOn(r, today); });
    if (!theirs.length) return null;
    var remaining = theirs.filter(function (r) { return !isDone(r, today); }).length;
    var sent = (state.kungs || []).some(function (k) { return k.from === state.me; });
    return { to: to, toName: names[to], remaining: remaining, total: theirs.length, status: sent ? 'sent' : remaining === 0 ? 'done' : 'ready' };
  }

  var api = { build: build, routinesFrom: routinesFrom, validateRoutine: validateRoutine, activeOn: activeOn };
  root.RT = RT;
  RT.model = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
