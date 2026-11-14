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
  var REST_MAX = 30;
  var CUE_MAX = 20;
  var HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  var WHEN_CUES = ['일어나자마자', '아침 먹고 나서', '수업 끝나고', '씻기 전에', '자기 전에'];

  /** 언제 할지 (v41): { cue?: 무엇 다음에(20자), at?: 'HH:MM', remind?: 시각에 알림 } — 둘 다 없으면 null(언제든) */
  function whenFrom(w) {
    if (!w || typeof w !== 'object') return null;
    var cue = typeof w.cue === 'string' ? w.cue.trim().slice(0, CUE_MAX) : '';
    var at = typeof w.at === 'string' && HHMM.test(w.at) ? w.at : '';
    if (!cue && !at) return null;
    var out = {};
    if (cue) out.cue = cue;
    if (at) { out.at = at; if (w.remind === true) out.remind = true; }
    return out;
  }
  /** 카드에 보일 「언제」 — 아이콘은 시각(없으면 문장)으로 아침 · 낮 · 저녁 */
  function whenText(w) {
    if (!w) return '언제든';
    var h = w.at ? parseInt(w.at, 10) : null, c = w.cue || '';
    var icon = h !== null ? (h < 5 ? '🌙' : h < 12 ? '☀️' : h < 18 ? '🌤️' : '🌙')
      : /일어나|아침|출근|등교/.test(c) ? '☀️' : /자기|잠|밤|씻/.test(c) ? '🌙' : /점심|수업|학교|퇴근|하교/.test(c) ? '🌤️' : '📌';
    return icon + ' ' + [c, w.at || ''].filter(Boolean).join(' · ');
  }

  /**
   * 쉬기 기간 정리: [{ from, to|null }] (날짜 문자열) → [{ from, to }] (day number, to = null 은 다시 시작할 때까지).
   * 이상한 값은 빼고, 시작일 앞은 잘라 내고, 겹치거나 붙은 기간은 합친다. 끝이 열린 기간 뒤에 오는 기간은 그 안에 들어간다.
   */
  function restFrom(list, start) {
    if (!Array.isArray(list)) return [];
    var out = list.slice(0, REST_MAX).map(function (p) {
      var f = p ? D.parse(p.from) : NaN;
      var t = p && p.to ? D.parse(p.to) : null;
      if (isNaN(f) || (t !== null && (isNaN(t) || t < f))) return null;
      if (!isNaN(start) && f < start) f = start;
      if (t !== null && t < f) return null;
      return { from: f, to: t };
    }).filter(Boolean).sort(function (a, b) { return a.from - b.from; });
    var merged = [];
    out.forEach(function (p) {
      var last = merged[merged.length - 1];
      if (last && (last.to === null || p.from <= last.to + 1)) {
        if (last.to !== null) last.to = p.to === null ? null : Math.max(last.to, p.to);
      } else merged.push({ from: p.from, to: p.to });
    });
    return merged;
  }

  /** 그날 쉬는 기간 (없으면 null) */
  function restOn(r, day) {
    var list = r.rest || [];
    for (var i = 0; i < list.length; i++) if (list[i].from <= day && (list[i].to === null || day <= list[i].to)) return list[i];
    return null;
  }

  /** 앞으로 쉬기로 해 둔 기간 (오늘 쉬는 중이면 그것, 아니면 가장 가까운 예약, 없으면 null) */
  function restNext(r, day) {
    var cur = restOn(r, day);
    if (cur) return cur;
    var list = r.rest || [];
    for (var i = 0; i < list.length; i++) if (list[i].from > day) return list[i];
    return null;
  }

  /** 루틴 목록 정리. 시작일이 이상하거나 키가 이상한 항목은 뺀다. end: 마지막으로 한 날(그만한 루틴). */
  function routinesFrom(config) {
    var list = config && Array.isArray(config.routines) ? config.routines : [];
    return list.map(function (r, i) {
      var end = r.end ? D.parse(r.end) : NaN;
      return {
        key: String(r.key || ''), icon: String(r.icon || ''), name: String(r.name || '').slice(0, NAME_MAX),
        who: String(r.who || ''), owner: String(r.owner || r.who || ''),
        start: D.parse(r.start), end: isNaN(end) ? null : end,
        order: typeof r.order === 'number' ? r.order : i,
        rest: r.rest, when: whenFrom(r.when)
      };
    }).filter(function (r) {
      return SAFE_ID.test(r.key) && SAFE_ID.test(r.owner) && r.owner !== 'all' && !isNaN(r.start);
    }).map(function (r) {
      // 그만둔 날이 시작일보다 앞서 있으면(두 기기에서 엇갈려 저장된 경우) 시작일 하루만 한 것으로 본다
      if (r.end !== null && r.end < r.start) r.end = r.start;
      r.rest = restFrom(r.rest, r.start);
      return r;
    }).sort(function (a, b) { return a.order - b.order; });
  }

  /** 시작했고 그만두기 전인가 (쉬는 날도 포함). */
  function aliveOn(r, day) { return day >= r.start && (r.end === null || day <= r.end); }
  /** 그날 쉬는가 (시작 후 · 그만두기 전이면서 쉬기 기간 안). */
  function restingOn(r, day) { return aliveOn(r, day) && !!restOn(r, day); }
  /** 그날 하고 있는 루틴인가 (시작 후, 그만두기 전, 쉬는 날 아님). */
  function activeOn(r, day) { return aliveOn(r, day) && !restOn(r, day); }

  /** 쉬기 안내 (오늘 쉬는 중 · 예약) — 없으면 null */
  function restInfo(r, today) {
    if (r.end !== null && r.end < today) return null;
    var p = restNext(r, today);
    if (!p || (r.end !== null && p.from > r.end)) return null;
    if (p.from > today) return { now: false, text: D.label(p.from) + '부터 쉬어요' + (p.to !== null ? ' · ' + D.label(p.to) + '까지' : '') };
    return { now: true, text: '🌿 쉬는 중 · ' + (p.to !== null ? D.label(p.to) + '까지' : (today - p.from + 1) + '일째') };
  }

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
    // 그만한 루틴은 마지막 날까지만 센다. 쉬는 날은 세지도 끊지도 않는다
    var until = r.end !== null ? Math.min(r.end, today) : today;
    return S.summary({ start: r.start, today: until, isDone: function (d) { return isDone(r, d); }, isRest: function (d) { return !!restOn(r, d); } });
  }

  function cardFor(r, names, today, isDone, slots, me) {
    var sum = summaryOf(r, today, isDone);
    var who = names[r.owner] || r.who;
    var ri = restInfo(r, today);
    // 사람 표시 점 색: 먼저 루틴을 만든 사람 = 진한 색, 다음 사람 = 중간 색 (사람 키가 무엇이든)
    // 어제 해야 했는데 안 한 루틴 (v41 — 이틀 연속은 안 놓치기). 쉬는 날 · 시작 전 · 그만둔 뒤는 아님
    var missed = activeOn(r, today - 1) && activeOn(r, today) && !isDone(r, today - 1) && !isDone(r, today);
    var base = { key: r.key, icon: r.icon, name: r.name, who: who, owner: r.owner, dot: slots[r.owner] === 0 ? 'her' : 'me', startText: D.label(r.start) + ' 시작',
      when: whenText(r.when), whenSet: !!r.when, missed: missed,
      rest: ri && ri.now ? ri.text : '', restSoon: ri && !ri.now ? ri.text : '', canWake: !!ri && !!me && r.owner === me };
    if (!sum.started) {
      return Object.assign(base, {
        started: false, count: '', dayLabel: '시작까지', dayValue: 'D-' + sum.daysUntil,
        streakLabel: '연속', streakValue: '—', clean: false,
        hint: D.label(r.start) + '이 1일차예요'
      });
    }
    var st = sum.todayRest ? { label: '연속 · 쉬는 동안 그대로', value: sum.streak + '일' } : streakText(sum);
    var hint;
    if (sum.lastMiss !== null) hint = '최근 못 한 날 ' + D.label(sum.lastMiss) + ' · 최고 연속 ' + sum.best + '일';
    else if (sum.dayN === 1 && !sum.todayDone && !sum.todayRest) hint = '오늘이 1일차예요';
    else hint = '시작부터 하루도 안 빠졌어요 👏';
    if (sum.restCount) hint += ' · 🌿 쉬기 ' + sum.restCount + '일';
    if (r.end === today) hint += ' · 오늘까지 해요';
    return Object.assign(base, {
      started: true, count: sum.count + '/' + (sum.dayN - sum.restCount) + '일',
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
    if (!active.length) return { level: set.some(function (r) { return restingOn(r, day); }) ? 'rest' : 'pre', active: 0, done: 0 };
    var done = active.filter(function (r) { return isDone(r, day); }).length;
    // 그날 참여 중인 사람 = 아직 그만두지 않은 루틴이 있는 사람 (시작 전 루틴도 포함)
    // 단, 그날 하고 있는 루틴이 모두 쉬는 사람은 뺀다 (쉬기)
    var joined = persons.filter(function (p) {
      var mine = set.filter(function (r) { return r.owner === p && (r.end === null || r.end >= day); });
      if (!mine.length) return false;
      var alive = mine.filter(function (r) { return aliveOn(r, day); });
      return !(alive.length && alive.every(function (r) { return restingOn(r, day); }));
    });
    var everyone = joined.every(function (p) {
      var mine = active.filter(function (r) { return r.owner === p; });
      return mine.length > 0 && mine.every(function (r) { return isDone(r, day); });
    });
    var level = everyone ? 'full' : done > 0 ? 'half' : 'none';
    return { level: level, active: active.length, done: done, pct: Math.round(done / active.length * 100), step: stepOf(level, done, active.length) };
  }

  /**
   * 달력 칸 단계 (v41): 둘이 합쳐 한 비율 — 0% · 1–33% · 34–66% · 67–99% · 100%(모두 해낸 날)
   * 'full' 은 dayLevel 의 「모두 해낸 날」과 같은 뜻 (퀘스트 · 토마토와 같음). 비율이 100%라도 루틴이 없는 사람이 있으면 s3
   */
  function stepOf(level, done, active) {
    if (level === 'full') return 'full';
    if (!done) return 'none';
    var pct = done / active * 100;
    return pct <= 33.5 ? 's1' : pct <= 66.5 ? 's2' : 's3';
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
      var lv = future ? 'future' : dl.level === 'pre' || dl.level === 'rest' ? dl.level : dl.step;
      cells.push({
        day: day, level: lv, today: day === today,
        label: String(D.parts(day).d),
        disabled: future || lv === 'pre' || lv === 'rest',
        aria: D.full(day) + (day === today ? ', 오늘' : '') + (future ? '' : lv === 'pre' ? ', 루틴 없음' : lv === 'rest' ? ', 쉬는 날' : ', ' + dl.active + '개 중 ' + dl.done + '개 완료' + (lv === 'full' ? ', 모두 해냄' : ''))
      });
    }
    // 범례: 안 함 · 옅은 → 진한 세 칸(적게 → 많이) · 모두(✓)
    var legend = [{ level: 'none', label: '안 함' }, { level: 's1', label: '' }, { level: 's2', label: '' }, { level: 's3', label: '많이' }, { level: 'full', label: persons.length > 1 ? '모두' : '완료' }];
    if (persons.length === 1 && set.length === 1) legend = [legend[0], legend[4]];
    if (cells.some(function (c) { return c.level === 'rest'; })) legend.push({ level: 'rest', label: '쉼' });
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
    var rest = function (d) { return dayLevel(routines, persons, d, isDone).level === 'rest'; };
    var sum = S.summary({ start: start, today: today, isDone: full, isRest: rest });
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
    // v42: 그날 진행 중인 루틴만 (시작 전 · 쉬는 날 · 그만둔 뒤는 빼고), 사람별로 묶는다
    var rows = active.map(function (r) {
      var mine = !!me && r.owner === me;
      var who = names[r.owner] || r.who;
      if (day < r.start) return { key: r.key, icon: r.icon, name: r.name, who: who, pre: true, mine: mine, locked: true, done: false, meta: D.label(r.start) + '부터 시작', by: '', button: '시작 전' };
      if (restOn(r, day)) return { key: r.key, icon: r.icon, name: r.name, who: who, pre: true, rest: true, mine: mine, locked: true, done: false, meta: '🌿 쉬는 날', by: '', button: '쉬어요' };
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
    // 요약 줄 (v41): 둘이 합쳐 7 / 9개 (78%) · 준민 4/5 · 다진 3/4
    var owners = [];
    active.forEach(function (r) { if (owners.indexOf(r.owner) < 0) owners.push(r.owner); });
    if (persons && persons.length) owners.sort(function (a, b) { return persons.indexOf(a) - persons.indexOf(b); });
    var summary = (owners.length > 1 ? '둘이 합쳐 ' : '') + cnt + ' / ' + active.length + '개 (' + Math.round(cnt / active.length * 100) + '%)' +
      (owners.length > 1 ? owners.map(function (o) {
        var a = active.filter(function (r) { return r.owner === o; });
        return ' · ' + (names[o] || o) + ' ' + a.filter(function (r) { return isDone(r, day); }).length + '/' + a.length;
      }).join('') : '');
    if (isToday && dayLevel(routines, persons, day, isDone).level === 'full') sub = '모두 완료! 오늘도 해냈어요';
    if (!me) sub += ' · 먼저 누구인지 골라 주세요';
    else if (mineActive.length) sub += isToday ? ' · 내 루틴만 체크할 수 있어요' : ' · 내 루틴은 눌러서 고칠 수 있어요';
    var groups = owners.map(function (o) {
      var list = rows.filter(function (x) { return active.some(function (r) { return r.key === x.key && r.owner === o; }); });
      return { person: o, name: names[o] || (list[0] && list[0].who) || '', mine: !!me && o === me, dot: persons && persons.indexOf(o) === 0 ? 'her' : 'me',
        count: list.filter(function (x) { return x.done; }).length + '/' + list.length, rows: list };
    });
    return { day: day, title: D.full(day), isToday: isToday, sub: sub, summary: summary, full: dayLevel(routines, persons, day, isDone).level === 'full', rows: rows, groups: groups };
  }

  /** 「내 루틴」 시트 */
  function manageFor(routines, today, me, manage, checks) {
    if (!manage || !manage.open || !me) return null;
    var mine = routines.filter(function (r) { return r.owner === me; });
    function status(r) {
      if (r.end !== null && r.end < today) return D.label(r.start) + ' ~ ' + D.label(r.end) + ' · 기록은 그리드에 남아 있어요';
      var ri = restInfo(r, today);
      if (ri && ri.now) return ri.text;
      var soon = ri ? ' · ' + ri.text : '';
      if (r.start > today) return D.label(r.start) + ' 시작 · D-' + (r.start - today) + soon;
      return D.label(r.start) + ' 시작 · ' + (today - r.start + 1) + '일차' + (r.end === today ? ' · 오늘까지' : '') + soon;
    }
    function hasChecks(r) {
      for (var id in checks) if (id.indexOf(r.key + '|') === 0) return true;
      return false;
    }
    function hasCheckOn(r, day) { return !!checks[r.key + '|' + D.toKey(day)]; }
    var f = manage.form;
    var item = function (r) {
      var ri = r.end !== null && r.end < today ? null : restInfo(r, today);
      return { key: r.key, icon: r.icon, name: r.name, status: status(r), editing: !!f && f.key === r.key, resting: !!ri && ri.now, wake: ri ? (ri.now ? '다시 시작' : '쉬기 취소') : '' };
    };
    var form = null;
    if (f) {
      var editing = f.key ? mine.filter(function (r) { return r.key === f.key; })[0] : null;
      if (f.key && !editing) return { current: mine.filter(function (r) { return r.end === null || r.end >= today; }).map(item), ended: mine.filter(function (r) { return r.end !== null && r.end < today; }).map(item), form: null, gone: true };
      form = {
        mode: editing ? 'edit' : 'add', key: editing ? editing.key : null,
        name: f.name, icon: f.icon, start: f.start, error: f.error || '', errorFresh: !!f.errorFresh, saving: !!f.saving, confirmDelete: !!f.confirmDelete, confirmStart: !!f.confirmStart,
        icons: ICONS.ROUTINE_ICONS.map(function (e) { return { e: e, on: e === f.icon }; }),
        canStop: !!editing && (editing.end === null || editing.end > today) && editing.start <= today,
        canDelete: !!editing && !hasChecks(editing),
        canRest: !!editing && (editing.end === null || editing.end > today) && !restInfo(editing, today),
        rest: editing && f.rest ? restForm(f.rest, editing, today, hasCheckOn(editing, today)) : null,
        when: whenForm(f.when)
      };
    }
    return {
      current: mine.filter(function (r) { return r.end === null || r.end >= today; }).map(item),
      ended: mine.filter(function (r) { return r.end !== null && r.end < today; }).map(item),
      form: form
    };
  }

  /** 「언제 할까요?」 폼 (v41) */
  function whenForm(w) {
    w = w || { mode: 'any' };
    var cue = w.cue || '';
    return {
      mode: w.mode === 'set' ? 'set' : 'any', cue: cue, at: w.at || '', remind: !!w.remind && !!w.at, cueMax: CUE_MAX,
      cues: WHEN_CUES.map(function (c) { return { v: c, on: c === cue.trim() }; }),
      preview: w.mode === 'set' ? whenText(whenFrom({ cue: cue, at: w.at })) : '언제든'
    };
  }
  /** 폼 → 저장할 when (null = 언제든) */
  function whenSave(w) {
    if (!w || w.mode !== 'set') return null;
    return whenFrom({ cue: w.cue, at: w.at, remind: !!w.remind });
  }
  /** 저장된 when → 폼 */
  function whenEdit(raw) {
    var w = whenFrom(raw);
    return w ? { mode: 'set', cue: w.cue || '', at: w.at || '', remind: !!w.remind } : { mode: 'any', cue: '', at: '', remind: false };
  }

  var REST_UNTIL = [{ v: 'open', label: '다시 시작할 때까지' }, { v: '3', label: '3일' }, { v: '7', label: '1주' }, { v: '14', label: '2주' }, { v: 'date', label: '날짜까지' }];

  /**
   * 쉬기 입력 → 실제 기간. rf: { from: 'today'|'tomorrow'|'date', fromDate, until: 'open'|'3'|'7'|'14'|'date', untilDate }
   * 돌려줌: { from, to(null = 다시 시작할 때까지), error }
   */
  function restPlan(rf, r, today, checkedToday) {
    var earliest = Math.max(r.start, checkedToday ? today + 1 : today);
    var from = rf.from === 'tomorrow' ? today + 1 : rf.from === 'date' ? D.parse(rf.fromDate) : today;
    if (rf.from === 'today' && checkedToday) from = today + 1;
    if (isNaN(from)) return { error: '언제부터 쉴지 골라 주세요' };
    if (from < earliest) from = earliest;
    var to = null;
    if (rf.until === 'date') {
      to = D.parse(rf.untilDate);
      if (isNaN(to)) return { from: from, to: null, error: '언제까지 쉴지 골라 주세요' };
      if (to < from) return { from: from, to: to, error: '끝나는 날이 쉬기 시작하는 날보다 앞이에요' };
    } else if (rf.until !== 'open') to = from + (parseInt(rf.until, 10) || 7) - 1;
    if (r.end !== null && from > r.end) return { from: from, to: to, error: '그만두는 날 뒤에는 쉴 수 없어요' };
    return { from: from, to: to, error: '' };
  }

  function restForm(rf, r, today, checkedToday) {
    var p = restPlan(rf, r, today, checkedToday);
    var note = '';
    if (!p.error) note = D.label(p.from) + '부터 ' + (p.to === null ? '다시 시작할 때까지 쉬어요' : D.label(p.to) + '까지 · ' + (p.to - p.from + 1) + '일 쉬어요');
    return {
      from: rf.from, fromDate: rf.fromDate || D.toKey(today + 1), until: rf.until, untilDate: rf.untilDate || D.toKey(Math.max(p.from || today, today) + 6),
      // 오늘 이미 체크했으면 「오늘」은 막히고 「내일」이 골라진 것으로 보인다 (restPlan 도 내일부터로 계산)
      fromOpts: [{ v: 'today', label: '오늘', off: checkedToday }, { v: 'tomorrow', label: '내일' }, { v: 'date', label: '날짜' }].map(function (o) {
        var cur = rf.from === 'today' && checkedToday ? 'tomorrow' : rf.from;
        return Object.assign(o, { on: cur === o.v });
      }),
      untilOpts: REST_UNTIL.map(function (o) { return { v: o.v, label: o.label, on: rf.until === o.v }; }),
      checkedToday: checkedToday, note: note, error: rf.error || '', errorFresh: !!rf.errorFresh
    };
  }

  /** 저장할 쉬기 목록: 지금 목록에 새 기간을 더한다 (날짜 문자열) */
  function restAdd(raw, from, to) {
    var list = (Array.isArray(raw) ? raw : []).filter(function (p) { return p && typeof p.from === 'string'; }).map(function (p) { return { from: p.from, to: p.to || null }; });
    list.push({ from: D.toKey(from), to: to === null ? null : D.toKey(to) });
    return list.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; }).slice(-REST_MAX);
  }

  /** 다시 시작 / 쉬기 취소: 오늘 쉬는 기간은 어제까지로 줄이고(오늘 시작했으면 지움), 앞으로 예약된 기간은 지운다. 지난 기간은 그대로. */
  function restWake(raw, today) {
    var out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (p) {
      if (!p || typeof p.from !== 'string') return;
      var f = D.parse(p.from), t = p.to ? D.parse(p.to) : null;
      if (isNaN(f)) return;
      if (f >= today) return;                                    // 오늘 · 앞으로 시작하는 기간은 지운다
      if (t === null || t >= today) { out.push({ from: p.from, to: D.toKey(today - 1) }); return; } // 쉬는 중 → 어제까지
      out.push({ from: p.from, to: p.to });
    });
    return out;
  }

  /** 입력한 루틴 확인. 문제가 있으면 한국어 안내, 없으면 ''. */
  function validateRoutine(f) {
    if (f.when && f.when.mode === 'set') {
      if (String(f.when.cue || '').trim().length > CUE_MAX) return '「언제」 문장은 ' + CUE_MAX + '자까지 쓸 수 있어요';
      if (f.when.at && !HHMM.test(f.when.at)) return '시각을 다시 골라 주세요';
    }
    var name = String(f.name || '').trim();
    if (!name) return '루틴 이름을 적어 주세요';
    if (name.length > NAME_MAX) return '이름은 ' + NAME_MAX + '자까지 쓸 수 있어요';
    if (!ICONS.isAllowed(f.icon)) return '아이콘을 골라 주세요';
    if (isNaN(D.parse(f.start))) return '시작일을 골라 주세요';
    return '';
  }

  /**
   * 카드 순서 (v41): 어제 놓친 것 → 「언제」를 정한 것(시각 순, 시각 없이 문장만 정한 것은 그 뒤) → 언제든 → 시작 전.
   * 같은 자리에선 원래 루틴 순서 그대로 (안정 정렬)
   */
  function sortCards(cards, routines, today) {
    var byKey = {};
    routines.forEach(function (r) { byKey[r.key] = r; });
    function rank(c) {
      var r = byKey[c.key];
      if (!r || r.start > today) return [4, ''];
      if (c.missed) return [0, ''];
      if (r.when && r.when.at) return [1, r.when.at];
      if (r.when) return [2, ''];
      return [3, ''];
    }
    return cards.map(function (c, i) { return { c: c, i: i, k: rank(c) }; }).sort(function (a, b) {
      return a.k[0] - b.k[0] || (a.k[1] < b.k[1] ? -1 : a.k[1] > b.k[1] ? 1 : 0) || a.i - b.i;
    }).map(function (x) { return x.c; });
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
    var cards = sortCards(visibleCards.map(function (r) { return cardFor(r, names, today, isDone, slots, state.me || null); }), routines, today);
    // 카드는 사람별로 모은다 (v39) — 순서는 위 사람 칩과 같고, 한 사람 안에서는 루틴 순서 그대로
    var groups = persons.map(function (p) {
      var list = cards.filter(function (c) { return c.owner === p; });
      return { person: p, name: names[p] || (list[0] && list[0].who) || '', dot: slots[p] === 0 ? 'her' : 'me', mine: p === state.me, cards: list };
    }).filter(function (g) { return g.cards.length; });
    return {
      kung: kungFor(state, names, routines, today, isDone),
      header: header,
      empty: false,
      filter: filter,
      chips: chipsFor(routines, names, filter),
      canManage: !!state.me,
      grid: gridFor(set, persons, today, state.page || 0, isDone),
      cards: cards,
      groups: groups,
      // 어제 놓친 내 루틴 (v41): 「어제 못 한 루틴이 n개 있어요 · 오늘은 꼭!」
      missedMine: state.me ? cards.filter(function (c) { return c.missed && c.owner === state.me; }).length : 0,
      grouped: filter === 'all' && groups.length > 1,
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

  var api = { stepOf: stepOf, whenFrom: whenFrom, whenText: whenText, whenSave: whenSave, whenEdit: whenEdit, sortCards: sortCards, WHEN_CUES: WHEN_CUES, build: build, routinesFrom: routinesFrom, validateRoutine: validateRoutine, activeOn: activeOn, aliveOn: aliveOn, restingOn: restingOn, restOn: restOn, restFrom: restFrom, restInfo: restInfo,
    restPlan: restPlan, restAdd: restAdd, restWake: restWake, dayLevel: dayLevel };
  root.RT = RT;
  RT.model = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
