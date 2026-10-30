/* 시간표 계산 — 한 주 · 하루 배치, 지금 상태. 화면 없음.
   events/<id> : { owner: <uid> | 'both', title, weekly: bool,
                   매주 · 요일 하나: weekday: 0(월)~6(일)          (예전부터 쓰던 모양)
                   매주 · 요일 여럿: weekday: null, weekdays: [1, 3] (화 · 목 — 한 일정으로 같이 고치고 지운다)
                     요일마다 시간이 다르면 times: { '1': '10:00-11:00', '3': '16:00-17:00' } (start · end 는 첫 요일 시간)
                   short: 주 보기 블록에 보일 짧은 이름 (선택, 없으면 title 그대로 — 예: 4차산업혁명과디지털리터러시 → 4디리)
                   cat: 카테고리 id — 'class' 같은 기본 6개 또는 새로 만든 것 (js/cats.js, 없거나 지운 카테고리면 아이콘 없음)
                   skip: ['YYYY-MM-DD', …] 매주 일정에서 쉬는 날 (휴강 등) — 그날은 시간표에 안 보이고, 고른 요일 목록에만 「쉬어요」로 남는다
                   date: 'YYYY-MM-DD' (한 번일 때), start: 'HH:MM', end: 'HH:MM', createdBy, updatedAt }
   화면 안에서는 언제나 weekdays(정렬된 배열)로 다룬다.
   주는 월요일에 시작한다. 사람 순서(persons)는 루틴 탭과 같아서 두 사람 화면에서 색 · 자리가 같다. */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var D = NODE ? require('./dates') : root.RT.dates;
  var C = NODE ? require('./cats') : root.RT.cats;

  var WD = ['월', '화', '수', '목', '금', '토', '일'];
  // 기본 카테고리 (지금 목록은 fromDocs 에 넘긴다 — 일정마다 catIcon · catName 으로 붙는다)
  var CATS = C.DEFAULTS;
  function catOf(id, list) { return C.find(list || CATS, id); }
  var TITLE_MAX = 20, SHORT_MAX = 10;
  /** 표시할 이름: 비었거나 일정 이름과 같으면 없음(null) */
  function shortOf(title, short) {
    var t = String(short == null ? '' : short).trim();
    return t && t !== String(title || '').trim() ? t : null;
  }
  var HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

  function toMin(s) { var m = HHMM.exec(String(s)); return m ? +m[1] * 60 + +m[2] : NaN; }
  function fmt(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  /** 0=월 … 6=일 */
  function weekdayOf(day) { return (D.parts(day).w + 6) % 7; }
  function monStart(day) { return day - weekdayOf(day); }

  /** 문서의 요일들 → 정렬 · 중복 없는 배열 (예전 weekday 하나짜리도) */
  function weekdaysOf(e) {
    var list = Array.isArray(e && e.weekdays) && e.weekdays.length ? e.weekdays : [e && e.weekday];
    var out = [];
    list.forEach(function (w) { if (typeof w === 'number' && w >= 0 && w <= 6 && w % 1 === 0 && out.indexOf(w) < 0) out.push(w); });
    return out.sort();
  }
  /** [1, 3] → '화 · 목' */
  function wdText(list) { return list.map(function (w) { return WD[w]; }).join(' · '); }

  /** 요일마다 시간 { 1: {start, end}, 3: {...} } — times 에 없거나 이상한 요일은 기본 start · end */
  function timesOf(e, days) {
    var out = {};
    days.forEach(function (w) {
      var v = e.times && typeof e.times === 'object' ? e.times[String(w)] : null;
      var m = typeof v === 'string' ? /^(\d\d:\d\d)-(\d\d:\d\d)$/.exec(v) : null;
      out[w] = m && toMin(m[1]) < toMin(m[2]) ? { start: m[1], end: m[2] } : { start: e.start, end: e.end };
    });
    return out;
  }
  function sameTimes(times, days) {
    return days.every(function (w) { return times[w].start === times[days[0]].start && times[w].end === times[days[0]].end; });
  }
  /** '매주 화 · 목요일 · 10:00–11:00' / '매주 화 10:00–11:00 · 목 16:00–17:00' / '10월 28일 수요일 · 10:00–11:00' */
  function whenText(e) {
    return (e.catIcon ? e.catIcon + ' ' + e.catName + ' · ' : '') + whenOnly(e);
  }
  function whenOnly(e) {
    if (!e.weekly) return D.full(D.parse(e.date)) + ' · ' + e.start + '–' + e.end;
    var since = e.from ? ' · ' + D.label(D.parse(e.from)) + '부터' : '';
    if (!e.perDay) return '매주 ' + wdText(e.weekdays) + '요일 · ' + e.start + '–' + e.end + since;
    return '매주 ' + e.weekdays.map(function (w) { return WD[w] + ' ' + e.times[w].start + '–' + e.times[w].end; }).join(' · ') + since;
  }

  var SKIP_MAX = 60;
  // 화면이 아는 필드 — 이 밖의 필드(더 새 버전 앱이 넣은 것)는 고쳐 저장할 때 그대로 둔다
  var KNOWN = ['id', 'owner', 'title', 'short', 'weekly', 'weekday', 'weekdays', 'times', 'cat', 'skip', 'from', 'date', 'start', 'end', 'createdBy', 'updatedAt'];
  function extraOf(e) {
    var out = null;
    Object.keys(e).forEach(function (k) { if (KNOWN.indexOf(k) < 0) { out = out || {}; out[k] = e[k]; } });
    return out;
  }
  /** 쉬는 날: 맞는 날짜이고 그 일정의 요일인 것만, 정렬 · 중복 없이 */
  function skipsOf(raw, days) {
    var out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (k) {
      var n = D.parse(k);
      if (!isNaN(n) && days.indexOf(weekdayOf(n)) >= 0 && out.indexOf(k) < 0) out.push(k);
    });
    return out.sort();
  }
  /** 쉬는 날 더하기 · 빼기 — 4주보다 오래된 날은 정리하고 최대 SKIP_MAX 개 (최근 것을 남긴다) */
  function withSkip(e, keys, on, today) {
    var list = (e.skip || []).slice();
    keys.forEach(function (k) {
      var at = list.indexOf(k);
      if (on && at < 0) list.push(k);
      if (!on && at >= 0) list.splice(at, 1);
    });
    var old = typeof today === 'number' ? today - 28 : -Infinity;
    list = skipsOf(list, e.weekdays || []).filter(function (k) { return D.parse(k) >= old; });
    return list.slice(Math.max(0, list.length - SKIP_MAX));
  }
  function isSkipped(e, day) { return !!(e.weekly && e.skip && e.skip.indexOf(D.toKey(day)) >= 0); }

  /** cats: 지금 카테고리 목록 (js/cats.js fromDocs, 안 주면 기본 6개) */
  function fromDocs(docs, cats) {
    var catList = cats || CATS;
    return (docs || []).filter(function (e) {
      if (!e || typeof e.id !== 'string' || typeof e.title !== 'string' || !e.title.trim() || typeof e.owner !== 'string') return false;
      var s = toMin(e.start), t = toMin(e.end);
      if (isNaN(s) || isNaN(t) || t <= s) return false;
      return e.weekly === true ? weekdaysOf(e).length > 0 : !isNaN(D.parse(e.date));
    }).map(function (e) {
      var weekly = e.weekly === true, days = weekly ? weekdaysOf(e) : null, times = weekly ? timesOf(e, days) : null;
      var cat = C.isId(e.cat) ? e.cat : null, c = catOf(cat, catList); // 지운 카테고리여도 id 는 남겨 둔다 (아이콘만 없음)
      return { id: e.id, owner: e.owner, title: e.title, short: typeof e.short === 'string' ? shortOf(e.title, e.short) : null, weekly: weekly, weekdays: days, times: times, perDay: weekly ? !sameTimes(times, days) : false,
        cat: cat, catIcon: c ? c.icon : '', catName: c ? c.name : '', skip: weekly ? skipsOf(e.skip, days) : [], from: weekly && typeof e.from === 'string' && !isNaN(D.parse(e.from)) ? e.from : null, date: weekly ? null : e.date, start: e.start, end: e.end, createdBy: e.createdBy || null, extra: extraOf(e) };
    });
  }

  /** 그날 일정 (매주 + 그날 한 번). 쉬는 날로 뺀 매주 일정은 없다 (opts.skipped 면 그것만) */
  function on(events, day, opts) {
    var wd = weekdayOf(day), key = D.toKey(day), want = !!(opts && opts.skipped);
    return events.filter(function (e) { return (e.weekly ? e.weekdays.indexOf(wd) >= 0 && (!e.from || day >= D.parse(e.from)) : e.date === key) && isSkipped(e, day) === want; }).map(function (e) {
      // 요일마다 시간이 다르면 그날 시간으로 (같은 id — 누르면 같은 일정이 열린다)
      return e.weekly && e.perDay ? Object.assign({}, e, { start: e.times[wd].start, end: e.times[wd].end }) : e;
    });
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

  /** 함께 일정은 두 사람 자리에 한 조각씩 넣어, 각자 일정과 겹치면 나란히 놓인다 (가려서 못 누르는 일이 없게).
      두 번째 조각은 dup=true (같은 일정이라 화면 읽기에서는 한 번만 읽는다). */
  function blocksFor(list, persons, me, dayIdx, dayN) {
    var lanes = [[], []];
    list.forEach(function (e) {
      lanesOf(e, persons).forEach(function (lane, k) {
        lanes[lane].push({ id: e.id, title: e.title, short: e.short || null, owner: e.owner, weekly: e.weekly, s: toMin(e.start), e: toMin(e.end), dayIdx: dayIdx, day: dayN, icon: e.catIcon || '',
          lane: lane, slot: e.owner === 'both' ? 'both' : (lane === 0 ? 'her' : 'me'), dup: k > 0,
          editable: !!me && (e.owner === me || e.owner === 'both'), time: e.start + '–' + e.end });
      });
    });
    return packLane(lanes[0]).concat(packLane(lanes[1]));
  }

  /** 주 보기 칸은 좁아서: 다른 사람 일정과 겹치지 않으면 칸 전체 폭을 쓴다 (full).
      함께 일정이 아무와도 안 겹치면 두 조각을 하나로 합친다. */
  function widen(blocks) {
    blocks.forEach(function (b) {
      b.full = b.cols === 1 && !blocks.some(function (x) { return x.lane !== b.lane && x.id !== b.id && x.s < b.e && b.s < x.e; });
    });
    return blocks.filter(function (b) { return !(b.full && b.dup); });
  }

  /** 일 보기: 함께 일정이 양쪽 자리 모두에서 혼자(나란히 놓인 일정 없음)면 두 조각을 하나로 합쳐 두 칸에 걸친다 (full).
      어느 한쪽에서라도 그 사람 일정과 겹치면 지금처럼 양쪽에 한 조각씩 (가려서 못 누르는 일이 없게). */
  function mergeBoth(blocks) {
    var whole = {};
    blocks.forEach(function (b) {
      if (b.owner !== 'both') return;
      whole[b.id] = (whole[b.id] === undefined ? true : whole[b.id]) && b.cols === 1;
    });
    return blocks.filter(function (b) {
      if (b.owner === 'both' && whole[b.id]) { if (b.dup) return false; b.full = true; }
      return true;
    });
  }

  /** '10월 26일 – 11월 1일' */
  function rangeText(weekStart) {
    var p0 = D.parts(weekStart), p6 = D.parts(weekStart + 6);
    return p0.m + '월 ' + p0.d + '일 – ' + (p6.m !== p0.m ? p6.m + '월 ' : '') + p6.d + '일';
  }

  /** 주 보기: weekStart(월요일)부터 7일. opts.pick = 아래 목록에 보일 요일, opts.names = { 사람 키: 이름 } */
  function week(events, persons, me, weekStart, today, opts) {
    opts = opts || {};
    var days = [], all = [];
    var pick = opts.pick >= weekStart && opts.pick <= weekStart + 6 ? opts.pick : (today >= weekStart && today <= weekStart + 6 ? today : weekStart);
    for (var i = 0; i < 7; i++) {
      var day = weekStart + i, list = on(events, day);
      days.push({ day: day, wd: WD[i], date: D.parts(day).d, isToday: day === today, picked: day === pick });
      all = all.concat(widen(blocksFor(list, persons, me, i, day)));
    }
    var pp = D.parts(pick), names = opts.names || {};
    // 고른 요일 목록: 두 사람 일정을 시간 순서로 (색 막대 = 사람, 함께는 강조)
    // 쉬는 날로 뺀 일정도 「쉬어요」로 같이 보인다 (눌러서 되돌릴 수 있게)
    var items = on(events, pick).map(function (e) { return [e, false]; }).concat(on(events, pick, { skipped: true }).map(function (e) { return [e, true]; }))
      .sort(function (a, b) { return toMin(a[0].start) - toMin(b[0].start) || toMin(a[0].end) - toMin(b[0].end); }).map(function (x) {
        var e = x[0], k = persons.indexOf(e.owner);
        return { id: e.id, title: e.title, icon: e.catIcon || '', catName: e.catName || '', time: e.start + '–' + e.end, weekly: e.weekly, skipped: x[1], day: pick,
          slot: e.owner === 'both' ? 'both' : (k === 0 ? 'her' : 'me'), who: e.owner === 'both' ? '함께' : (names[e.owner] || '') };
      });
    return { days: days, blocks: all, hours: hoursFor(all.map(function (b) { return { start: fmt(b.s), end: fmt(b.e) }; })),
      now: today >= weekStart && today <= weekStart + 6 && typeof opts.now === 'number' ? { idx: today - weekStart, min: opts.now } : null,
      range: rangeText(weekStart), isThisWeek: weekStart === monStart(today),
      pick: { day: pick, title: WD[pick - weekStart] + '요일 · ' + pp.m + '월 ' + pp.d + '일', isToday: pick === today, items: items } };
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
    var blocks = mergeBoth(blocksFor(list, persons, me, 0, dayN));
    var skipped = on(events, dayN, { skipped: true }).map(function (e) { return { id: e.id, title: e.title, time: e.start + '–' + e.end, day: dayN }; });
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
    return { day: dayN, title: D.full(dayN), range: rangeText(ws), isThisWeek: ws === monStart(today), isToday: dayN === today, blocks: blocks, hours: hoursFor(list), status: status, now: dayN === today ? nowMin : null, strip: strip, empty: !list.length, skipped: skipped };
  }

  function validate(f) {
    var title = String((f && f.title) || '').trim();
    if (!title) return '일정 이름을 적어 주세요';
    if (title.length > TITLE_MAX) return '일정 이름은 ' + TITLE_MAX + '자까지 쓸 수 있어요';
    if (String(f.short == null ? '' : f.short).trim().length > SHORT_MAX) return '표시할 이름은 ' + SHORT_MAX + '자까지 쓸 수 있어요';
    if (f.weekly ? !weekdaysOf(f).length : isNaN(D.parse(f.date))) return f.weekly ? '요일을 골라 주세요' : '날짜를 골라 주세요';
    var days = f.weekly ? weekdaysOf(f) : [];
    if (f.weekly && f.perDay && days.length > 1) {
      for (var i = 0; i < days.length; i++) {
        var t = (f.times || {})[days[i]] || {}, ts = toMin(t.start), te = toMin(t.end);
        if (isNaN(ts) || isNaN(te)) return WD[days[i]] + '요일 시작 · 끝 시간을 골라 주세요';
        if (te <= ts) return WD[days[i]] + '요일 끝 시간이 시작보다 늦어야 해요';
      }
      return '';
    }
    var s = toMin(f.start), e = toMin(f.end);
    if (isNaN(s) || isNaN(e)) return '시작 · 끝 시간을 골라 주세요';
    if (e <= s) return '끝 시간이 시작보다 늦어야 해요';
    return '';
  }

  var api = { WD: WD, CATS: CATS, catOf: catOf, TITLE_MAX: TITLE_MAX, SHORT_MAX: SHORT_MAX, shortOf: shortOf, toMin: toMin, fmt: fmt, weekdayOf: weekdayOf, weekdaysOf: weekdaysOf, wdText: wdText, whenText: whenText, SKIP_MAX: SKIP_MAX, withSkip: withSkip, isSkipped: isSkipped, sameTimes: sameTimes, monStart: monStart, rangeText: rangeText, mergeBoth: mergeBoth, fromDocs: fromDocs, on: on, packLane: packLane, week: week, day: day, statusOf: statusOf, validate: validate };
  root.RT = root.RT || {};
  root.RT.schedule = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
