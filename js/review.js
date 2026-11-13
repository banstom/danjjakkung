/* 돌아보기 계산 — 한 주(월~일) 또는 한 달 동안 "우리가 함께 해낸 것". 화면 없음.
   이미 저장된 기록만 쓴다 (저장 모양을 바꾸지 않는다):
     routines · checks → 루틴 × 요일, 모두 해낸 날 (모두 = 루틴 탭 달력의 「모두」와 같은 규칙, model.dayLevel)
     todos(done, doneAt, doneBy, scope, ui) → 끝낸 일 · 끝낼 때 평면 어느 칸이었나 (끝낸 사람이 놓은 자리)
     kungs(from, to, date) → 주고받은 꿍 · 꿍 받은 날 루틴을 끝까지 해낸 날
     events → 함께 일정 시간 (지난 날만 — 이번 주는 오늘까지)
   주는 월요일에 시작한다 (시간표와 같음). */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var D = NODE ? require('./dates') : root.RT.dates;
  var M = NODE ? require('./model') : root.RT.model;
  var S = NODE ? require('./schedule') : root.RT.schedule;
  var U = NODE ? require('./uni') : root.RT.uni;

  var QUADS = [
    { key: 'plan', label: '계획할 일' }, { key: 'now', label: '지금 할 일' },
    { key: 'later', label: '나중에' }, { key: 'quick', label: '빨리 쳐낼 일' }
  ];
  // 다음 · 이전으로 넘겨 볼 수 있는 가장 앞 (기록이 하나도 없을 때)
  var FIRST_DAY = D.fromYMD(2026, 10, 1);

  /** 기간: mode 'week' → page 주 전(0 = 이번 주), 'month' → page 달 전. { from, to(포함), days, label } */
  function rangeOf(mode, today, page) {
    page = Math.max(0, page | 0);
    if (mode === 'month') {
      var t = D.parts(today), mi = t.y * 12 + (t.m - 1) - page, y = Math.floor(mi / 12), m = mi % 12 + 1;
      var from = D.fromYMD(y, m, 1), to = D.fromYMD(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1;
      return { mode: mode, page: page, from: from, to: to, days: to - from + 1, label: y + '년 ' + m + '월', title: page === 0 ? '이번 달 우리' : page === 1 ? '지난달 우리' : m + '월의 우리' };
    }
    var mon = S.monStart(today) - 7 * page;
    return { mode: 'week', page: page, from: mon, to: mon + 6, days: 7, label: D.label(mon) + ' – ' + D.label(mon + 6), title: page === 0 ? '이번 주 우리' : page === 1 ? '지난주 우리' : D.label(mon) + ' 주의 우리' };
  }

  /** 끝낼 때 평면 칸: 끝낸 사람이 놓은 자리 → 없으면 다른 사람 자리 → 없으면 null(평면에 안 놓음) */
  function quadOf(t) {
    var ui = U.cleanUi(t.ui), p = (t.doneBy && ui[t.doneBy]) || ui[Object.keys(ui).sort()[0]];
    return p ? U.quadrant(p.u, p.i) : null;
  }

  /** 일정 시간 합 (until: 그 분까지만 — 오늘은 지금까지 지난 만큼만) */
  function minutes(list, until) {
    return list.reduce(function (n, e) { return n + Math.max(0, Math.min(S.toMin(e.end), until) - S.toMin(e.start)); }, 0);
  }

  /** 끝낸 일 합치기: 지금 듣고 있는 할 일(live)이 언제나 이긴다 — 기간 안에 끝냈다가 되돌린 일이 불러 둔 옛 사본으로 남지 않게.
      loaded 는 탭을 열 때 불러온 「기간 안에 끝낸 일」. live 에 없는 id 만 더한다. */
  function mergeTodos(live, loaded) {
    var ids = {};
    (live || []).forEach(function (t) { if (t && t.id) ids[t.id] = true; });
    return (live || []).concat((loaded || []).filter(function (t) { return t && t.id && !ids[t.id]; }));
  }

  /** 시간 글자: 0 → '0시간', 90 → '1시간 30분', 30 → '30분' */
  function hoursText(min) {
    var h = Math.floor(min / 60), m = min % 60;
    if (!h && m) return m + '분';
    return h + '시간' + (m ? ' ' + m + '분' : '');
  }

  /**
   * o: { mode, page, today, config: { people, routines }, checks: { '<루틴>|<날짜>': true },
   *      persons: [{ key, name, slot }] (화면 순서 — 루틴 탭과 같음), todos: 할 일 문서들(기간 안에 끝낸 것 포함),
   *      kungs: [{ from, to, date }] | null(불러오지 못함 → 꿍 칸 없음), events: schedule.fromDocs 목록, nowMin: 지금 시각(분) }
   */
  function build(o) {
    var today = o.today, r = rangeOf(o.mode, today, o.page);
    var last = Math.min(r.to, today); // 지난 날까지만 센다 (앞으로 올 날은 빈칸)
    var routines = M.routinesFrom(o.config);
    var checks = o.checks || {};
    var isDone = function (rt, day) { return M.activeOn(rt, day) && day <= today && !!checks[rt.key + '|' + D.toKey(day)]; };
    var persons = (o.persons || []).slice(0, 2);
    var keys = persons.map(function (p) { return p.key; });
    var firstStart = routines.length ? Math.min.apply(null, routines.map(function (x) { return x.start; })) : today;
    var earliest = Math.min(firstStart, FIRST_DAY);

    // ── 루틴 ──
    var days = [];
    for (var d = r.from; d <= r.to; d++) days.push(d);
    var cellsDone = 0, cellsAll = 0;
    var groups = persons.map(function (p) {
      var mine = routines.filter(function (x) { return x.owner === p.key && x.start <= r.to && (x.end === null || x.end >= r.from); });
      return { key: p.key, name: p.name, slot: p.slot, rows: mine.map(function (x) {
        var done = 0, active = 0;
        var cells = days.map(function (day) {
          if (day > today) return 'future';
          if (M.restingOn(x, day)) return 'rest';
          if (!M.activeOn(x, day)) return 'pre';
          active++;
          if (isDone(x, day)) { done++; return 'full'; }
          return 'none';
        });
        cellsDone += done; cellsAll += active;
        return { key: x.key, icon: x.icon, name: x.name, cells: cells, done: done, active: active };
      }) };
    }).filter(function (g) { return g.rows.length; });
    var allCells = days.map(function (day) {
      if (day > today) return 'future';
      var lv = M.dayLevel(routines, keys, day, isDone);
      return lv.level === 'pre' || lv.level === 'rest' ? lv.level : lv.step; // v41: 달력과 같은 5단계 (none · s1 · s2 · s3 · full)
    });
    var allDays = allCells.filter(function (c) { return c === 'full'; }).length;

    // ── 끝낸 일 ──
    var seen = {};
    var done = (o.todos || []).filter(function (t) {
      if (!t || t.done !== true || !t.doneAt || seen[t.id]) return false;
      var day = D.dayOfIso(t.doneAt);
      if (isNaN(day) || day < r.from || day > last) return false;
      seen[t.id] = true;
      return true;
    });
    var quad = { plan: 0, now: 0, later: 0, quick: 0 }, unplaced = 0;
    done.forEach(function (t) { var q = quadOf(t); if (q) quad[q]++; else unplaced++; });
    var together = done.filter(function (t) { return t.scope === 'together'; }).length;
    var byWho = [{ key: 'together', name: '함께', slot: 'both', n: together }].concat(persons.map(function (p) {
      return { key: p.key, name: p.name, slot: p.slot, n: done.filter(function (t) { return t.scope === p.key; }).length };
    }));
    var maxWho = Math.max.apply(null, byWho.map(function (b) { return b.n; }).concat([1]));
    byWho.forEach(function (b) { b.pct = Math.round(b.n / maxWho * 100); });

    // ── 꿍 ──
    var kungOk = o.kungs !== null;
    var kungs = (o.kungs || []).filter(function (k) {
      var day = D.parse(k && k.date);
      return !isNaN(day) && day >= r.from && day <= last && keys.indexOf(k.from) >= 0;
    });
    // 꿍 받은 날, 받은 사람이 그날 자기 루틴을 모두 해낸 날
    var rescued = kungs.filter(function (k) {
      var day = D.parse(k.date);
      var theirs = routines.filter(function (x) { return x.owner === k.to && M.activeOn(x, day); });
      return theirs.length > 0 && theirs.every(function (x) { return isDone(x, day); });
    }).length;

    // ── 함께 일정 ──
    var togetherMin = 0;
    var nowMin = typeof o.nowMin === 'number' ? o.nowMin : 24 * 60;
    for (var e = r.from; e <= last; e++) togetherMin += minutes(S.on(o.events || [], e).filter(function (ev) { return ev.owner === 'both'; }), e === today ? nowMin : 24 * 60);

    var hasAny = cellsAll > 0 || done.length > 0 || kungs.length > 0 || togetherMin > 0;
    return {
      mode: r.mode, page: r.page, label: r.label, title: r.title,
      canPrev: r.from > earliest, canNext: r.page > 0,
      us: { allDays: allDays, togetherDone: together, kungs: kungOk ? kungs.length : null, togetherTime: hoursText(togetherMin), togetherMin: togetherMin },
      routine: { week: r.mode === 'week', dows: r.mode === 'week' ? ['월', '화', '수', '목', '금', '토', '일'] : [], groups: groups, all: allCells, done: cellsDone, total: cellsAll,
        hasRest: allCells.indexOf('rest') >= 0 || groups.some(function (g) { return g.rows.some(function (x) { return x.cells.indexOf('rest') >= 0; }); }) },
      todos: { total: done.length, quads: QUADS.map(function (q) { return { key: q.key, label: q.label, n: quad[q.key] }; }), plan: quad.plan, unplaced: unplaced, byWho: byWho },
      kung: kungOk ? { n: kungs.length, rescued: rescued } : null,
      empty: !hasAny
    };
  }

  var api = { rangeOf: rangeOf, quadOf: quadOf, hoursText: hoursText, mergeTodos: mergeTodos, build: build, QUADS: QUADS, FIRST_DAY: FIRST_DAY };
  root.RT = root.RT || {};
  root.RT.review = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
