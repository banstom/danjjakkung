/* 시간표 계산 — 한 주 · 하루 배치, 지금 상태. 화면 없음.
   events/<id> : { owner: <uid> | 'both', title, weekly: bool, weekday: 0(월)~6(일) (매주일 때),
                   date: 'YYYY-MM-DD' (한 번일 때), start: 'HH:MM', end: 'HH:MM', createdBy, updatedAt }
   주는 월요일에 시작한다. 사람 순서(persons)는 루틴 탭과 같아서 두 사람 화면에서 색 · 자리가 같다. */
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./dates') : root.RT.dates;

  var WD = ['월', '화', '수', '목', '금', '토', '일'];
  var TITLE_MAX = 20;
  var HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

  function toMin(s) { var m = HHMM.exec(String(s)); return m ? +m[1] * 60 + +m[2] : NaN; }
  function fmt(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  /** 0=월 … 6=일 */
  function weekdayOf(day) { return (D.parts(day).w + 6) % 7; }
  function monStart(day) { return day - weekdayOf(day); }

  function fromDocs(docs) {
    return (docs || []).filter(function (e) {
      if (!e || typeof e.id !== 'string' || typeof e.title !== 'string' || !e.title.trim() || typeof e.owner !== 'string') return false;
      var s = toMin(e.start), t = toMin(e.end);
      if (isNaN(s) || isNaN(t) || t <= s) return false;
      return e.weekly === true ? (e.weekday >= 0 && e.weekday <= 6) : !isNaN(D.parse(e.date));
    }).map(function (e) {
      return { id: e.id, owner: e.owner, title: e.title, weekly: e.weekly === true, weekday: e.weekly === true ? e.weekday : null,
        date: e.weekly === true ? null : e.date, start: e.start, end: e.end, createdBy: e.createdBy || null };
    });
  }

  /** 그날 일정 (매주 + 그날 한 번) */
  function on(events, day) {
    var wd = weekdayOf(day), key = D.toKey(day);
    return events.filter(function (e) { return e.weekly ? e.weekday === wd : e.date === key; });
  }

  /** 자리: persons[0] → 0, persons[1] → 1, 함께 → 둘 다 */
  function lanesOf(e, persons) {
    if (e.owner === 'both') return [0, 1];
    var i = persons.indexOf(e.owner);
    return i < 0 ? [] : [i];
  }

  /** 한 자리 안에서 겹치는 일정은 나란히 (col / cols) */
  function packLane(items) {
    items.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var groups = [], cur = null;
    items.forEach(function (it) {
      if (!cur || it.s >= cur.end) { cur = { items: [], end: it.e }; groups.push(cur); }
      cur.items.push(it); cur.end = Math.max(cur.end, it.e);
    });
    groups.forEach(function (g) {
      var colsEnd = [];
      g.items.forEach(function (it) {
        var c = 0;
        while (c < colsEnd.length && colsEnd[c] > it.s) c++;
        colsEnd[c] = it.e; it.col = c;
      });
      g.items.forEach(function (it) { it.cols = colsEnd.length; });
    });
    return items;
  }

  /** 시간 범위: 기본 9~22시, 일정이 더 이르거나 늦으면 넓힌다 */
  function hoursFor(list) {
    var from = 9 * 60, to = 22 * 60;
    list.forEach(function (e) { from = Math.min(from, toMin(e.start)); to = Math.max(to, toMin(e.end)); });
    return { from: Math.floor(from / 60) * 60, to: Math.min(24 * 60, Math.ceil(to / 60) * 60) };
  }

  function blocksFor(list, persons, me, dayIdx) {
    var lanes = [[], [], []]; // 0, 1, 함께
    list.forEach(function (e) {
      var ls = lanesOf(e, persons);
      if (!ls.length) return;
      var b = { id: e.id, title: e.title, owner: e.owner, weekly: e.weekly, s: toMin(e.start), e: toMin(e.end), dayIdx: dayIdx,
        lane: e.owner === 'both' ? 'both' : ls[0], slot: e.owner === 'both' ? 'both' : (ls[0] === 0 ? 'her' : 'me'),
        editable: !!me && (e.owner === me || e.owner === 'both'), time: e.start + '–' + e.end };
      lanes[e.owner === 'both' ? 2 : ls[0]].push(b);
    });
    return packLane(lanes[0]).concat(packLane(lanes[1]), packLane(lanes[2]));
  }

  /** 주 보기: weekStart(월요일)부터 7일 */
  function week(events, persons, me, weekStart, today) {
    var days = [], all = [];
    for (var i = 0; i < 7; i++) {
      var day = weekStart + i, list = on(events, day);
      days.push({ day: day, wd: WD[i], date: D.parts(day).d, isToday: day === today });
      all = all.concat(blocksFor(list, persons, me, i));
    }
    var p0 = D.parts(weekStart), p6 = D.parts(weekStart + 6);
    return { days: days, blocks: all, hours: hoursFor(all.map(function (b) { return { start: fmt(b.s), end: fmt(b.e) }; })),
      range: p0.m + '월 ' + p0.d + '일 – ' + (p6.m !== p0.m ? p6.m + '월 ' : '') + p6.d + '일', isThisWeek: weekStart === monStart(today) };
  }

  /** 지금 상태 한 줄: '지금 화학 · 15:00까지' / '비어 있어요 · 다음 19:00 과외' / '오늘 남은 일정 없어요' */
  function statusOf(list, nowMin) {
    var cur = null, next = null;
    list.forEach(function (e) {
      var s = toMin(e.start), t = toMin(e.end);
      if (s <= nowMin && nowMin < t && (!cur || s > toMin(cur.start))) cur = e;
      if (s > nowMin && (!next || s < toMin(next.start))) next = e;
    });
    if (cur) return { busy: true, text: cur.title + ' · ' + cur.end + '까지' };
    if (next) return { busy: false, text: '비어 있어요 · 다음 ' + next.start + ' ' + next.title };
    return { busy: false, text: '오늘 남은 일정 없어요' };
  }

  /** 일 보기: 그날 두 줄 + (오늘이면) 지금 상태 */
  function day(events, persons, names, me, dayN, today, nowMin) {
    var list = on(events, dayN);
    var blocks = blocksFor(list, persons, me, 0);
    var status = null;
    if (dayN === today) {
      status = persons.map(function (p) {
        var mine = list.filter(function (e) { return e.owner === p || e.owner === 'both'; });
        var st = statusOf(mine, nowMin);
        return { person: p, name: names[p] || '', slot: persons.indexOf(p) === 0 ? 'her' : 'me', busy: st.busy, text: st.text };
      });
    }
    var ws = monStart(dayN), strip = [];
    for (var i = 0; i < 7; i++) strip.push({ day: ws + i, wd: WD[i], date: D.parts(ws + i).d, on: ws + i === dayN, isToday: ws + i === today });
    return { day: dayN, title: D.full(dayN), blocks: blocks, hours: hoursFor(list), status: status, now: dayN === today ? nowMin : null, strip: strip, empty: !list.length };
  }

  function validate(f) {
    var title = String((f && f.title) || '').trim();
    if (!title) return '일정 이름을 적어 주세요';
    if (title.length > TITLE_MAX) return '일정 이름은 ' + TITLE_MAX + '자까지 쓸 수 있어요';
    if (f.weekly ? !(f.weekday >= 0 && f.weekday <= 6) : isNaN(D.parse(f.date))) return f.weekly ? '요일을 골라 주세요' : '날짜를 골라 주세요';
    var s = toMin(f.start), e = toMin(f.end);
    if (isNaN(s) || isNaN(e)) return '시작 · 끝 시간을 골라 주세요';
    if (e <= s) return '끝 시간이 시작보다 늦어야 해요';
    return '';
  }

  var api = { WD: WD, TITLE_MAX: TITLE_MAX, toMin: toMin, fmt: fmt, weekdayOf: weekdayOf, monStart: monStart, fromDocs: fromDocs, on: on, packLane: packLane, week: week, day: day, statusOf: statusOf, validate: validate };
  root.RT = root.RT || {};
  root.RT.schedule = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
