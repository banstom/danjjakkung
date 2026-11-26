// 집중 통계 계산 — 참조 구현 (기획 계정, 2026-11-26)
// 저장소 js/focus.js 에 이미 있는 것(week · weekSubjects · rangeSummary · overlap)과 뜻이 같으면 그것을 쓰고,
// 없는 것만 옮겨 주세요. 뜻이 다르면 고치기 전에 차이를 먼저 알려 주세요.
//
// 입력 모양(참조용으로 맞춘 꼴 — 저장소 모양과 다르면 읽을 때 한 번 바꿔서 넘기기)
//   log = { by, cat, label, day: 'YYYY-MM-DD'(05시 기준), start, end, ms, segs: [[s, e], …], strict }
//   시각은 모두 ms(Unix). segs = 실제로 집중한 구간(쉬기 · 자리 비움 빠짐). ms = segs 길이 합.
(function (root) {
  'use strict';

  var MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  var C = {
    DAY_START_HOUR: 5,          // 하루는 05:00 에 시작
    TZ_OFFSET_MS: 9 * HOUR,     // 서울(UTC+9). 저장소가 기기 시각이면 그쪽을 따르기
    FOCUSED_DAY_MS: 1 * MIN,    // 「집중한 날」 = 그날 합계 1분 이상
    TOGETHER_DAY_MS: 10 * MIN,  // 「함께한 날」 = 그날 함께 10분 이상
    LEVELS_MS: [1 * MIN, 60 * MIN, 120 * MIN, 240 * MIN], // 히트맵 1~4단계 시작점 (한 사람)
    LEVELS_BOTH_MS: [1 * MIN, 30 * MIN, 60 * MIN, 120 * MIN], // 함께 달력(결산) 1~4단계
    SUBJ_LIMIT: 4,              // 과목 줄 수 (넘치면 「그 밖」 한 줄)
    LABEL_LIMIT: 3,             // 과목 줄 안 짧은 이름 수 (넘치면 「외 n개」)
    STREAK_MAX_DAYS: 365        // 연속 날은 1년까지만 거슬러 셈
  };

  // ── 날짜 ──
  function parts(day) { var p = day.split('-'); return [Number(p[0]), Number(p[1]), Number(p[2])]; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function fromUTC(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(day, n) { var p = parts(day); return fromUTC(new Date(Date.UTC(p[0], p[1] - 1, p[2] + n))); }
  function dow(day) { var p = parts(day); return (new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7; } // 0 = 월
  function dayStartMs(day) { var p = parts(day); return Date.UTC(p[0], p[1] - 1, p[2], C.DAY_START_HOUR) - C.TZ_OFFSET_MS; }
  function dayOf(ms) { return fromUTC(new Date(ms + C.TZ_OFFSET_MS - C.DAY_START_HOUR * HOUR)); }
  function weekStart(day) { return addDays(day, -dow(day)); }
  function monthDays(month) { // 'YYYY-MM' → 날짜 문자열 배열
    var p = month.split('-').map(Number), n = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate(), out = [];
    for (var i = 1; i <= n; i++) out.push(month + '-' + pad(i));
    return out;
  }
  function prevMonth(month) { var p = month.split('-').map(Number); var d = new Date(Date.UTC(p[0], p[1] - 2, 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); }

  // ── 구간 ──
  function merge(segs) {
    var s = segs.filter(function (x) { return x[1] > x[0]; }).map(function (x) { return [x[0], x[1]]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    s.forEach(function (x) {
      var last = out[out.length - 1];
      if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]); else out.push(x);
    });
    return out;
  }
  function intersect(a, b) { // 둘 다 merge 된 것
    var out = [], i = 0, j = 0;
    while (i < a.length && j < b.length) {
      var s = Math.max(a[i][0], b[j][0]), e = Math.min(a[i][1], b[j][1]);
      if (e > s) out.push([s, e]);
      if (a[i][1] < b[j][1]) i++; else j++;
    }
    return out;
  }
  function length(segs) { return segs.reduce(function (t, x) { return t + (x[1] - x[0]); }, 0); }
  function clip(segs, from, to) {
    return segs.map(function (x) { return [Math.max(x[0], from), Math.min(x[1], to)]; }).filter(function (x) { return x[1] > x[0]; });
  }
  function segsOf(logs, uid, day) {
    var out = [];
    logs.forEach(function (l) { if (l.by === uid && (!day || l.day === day)) out = out.concat(l.segs || []); });
    return merge(out);
  }

  // ── 날별 합계 ──
  // 한 사람 합계 = ms 합(= segs 합). 함께 = 그날 두 사람 segs 합집합끼리의 교집합.
  function byDay(logs, me, her) {
    var map = {};
    function cell(d) { return map[d] || (map[d] = { me: 0, her: 0, both: 0 }); }
    logs.forEach(function (l) {
      if (l.by === me) cell(l.day).me += l.ms;
      else if (l.by === her) cell(l.day).her += l.ms;
    });
    Object.keys(map).forEach(function (d) {
      if (map[d].me && map[d].her) map[d].both = length(intersect(segsOf(logs, me, d), segsOf(logs, her, d)));
    });
    return map;
  }
  function level(ms, both) {
    var lv = 0;
    (both ? C.LEVELS_BOTH_MS : C.LEVELS_MS).forEach(function (t, i) { if (ms >= t) lv = i + 1; });
    return lv;
  }
  // 막대 눈금 꼭대기: 가장 큰 값(나 · 짝꿍 · 목표)을 1시간 단위로 올림, 적어도 1시간
  function scaleTop(values) {
    var mx = Math.max.apply(null, [0].concat(values));
    return Math.max(HOUR, Math.ceil(mx / HOUR) * HOUR);
  }

  // ── 과목 ──
  function subjects(logs, uid, filterDay) {
    var cats = {}, total = 0;
    logs.forEach(function (l) {
      if (l.by !== uid || (filterDay && l.day !== filterDay)) return;
      total += l.ms;
      var c = cats[l.cat] || (cats[l.cat] = { cat: l.cat, ms: 0, labels: {} });
      c.ms += l.ms;
      var key = l.label || '';
      if (key) c.labels[key] = (c.labels[key] || 0) + l.ms;
    });
    var rows = Object.keys(cats).map(function (k) {
      var c = cats[k];
      var labels = Object.keys(c.labels).map(function (n) { return { label: n, ms: c.labels[n] }; })
        .sort(function (a, b) { return b.ms - a.ms || (a.label < b.label ? -1 : 1); });
      return { cat: c.cat, ms: c.ms, labels: labels.slice(0, C.LABEL_LIMIT), moreLabels: Math.max(0, labels.length - C.LABEL_LIMIT) };
    }).sort(function (a, b) { return b.ms - a.ms || (a.cat < b.cat ? -1 : 1); });
    var shown = rows.length > C.SUBJ_LIMIT ? rows.slice(0, C.SUBJ_LIMIT - 1) : rows;
    var rest = rows.slice(shown.length);
    var other = rest.length ? { cat: null, ms: rest.reduce(function (t, r) { return t + r.ms; }, 0), count: rest.length } : null;
    var top = rows.length ? rows[0].ms : 0;
    return { total: total, top: top, rows: shown, other: other };
  }

  // ── 기록 ──
  function longest(logs, uid, from, to) { // 한 번 집중(로그 하나)의 가장 긴 것. 같으면 먼저 한 것
    var best = null;
    logs.forEach(function (l) {
      if (l.by !== uid || (from && l.day < from) || (to && l.day > to)) return;
      if (!best || l.ms > best.ms || (l.ms === best.ms && l.start < best.start)) best = l;
    });
    return best && { ms: best.ms, day: best.day, cat: best.cat, label: best.label || '' };
  }
  // 연속: 오늘 했으면 오늘까지, 안 했으면 어제까지. 하루라도 빠지면 끊김.
  function streak(dayTotals, today) { // dayTotals = { day: ms } (내 것)
    function did(d) { return (dayTotals[d] || 0) >= C.FOCUSED_DAY_MS; }
    var todayDone = did(today), d = todayDone ? today : addDays(today, -1), n = 0;
    while (did(d) && n < C.STREAK_MAX_DAYS) { n++; d = addDays(d, -1); }
    return { n: n, todayDone: todayDone, reachedDay: addDays(d, 1) };
  }
  // 앱이 가진 기록이 연속의 첫날까지 닿지 않았으면 더 읽어야 함
  function needMoreForStreak(s, loadedFrom) { return s.n > 0 && s.reachedDay <= loadedFrom && s.n < C.STREAK_MAX_DAYS; }

  // ── 집중 탭 · 이번 주 ──
  // opts: { logs(이번 주), prevLogs(지난주), olderLogs(그 전 4주까지, 연속용), me, her, today, now, goalMs, selected }
  function weekView(o) {
    var mon = weekStart(o.today), map = byDay(o.logs, o.me, o.her), days = [], tot = { me: 0, her: 0, both: 0 };
    for (var i = 0; i < 7; i++) {
      var d = addDays(mon, i), c = map[d] || { me: 0, her: 0, both: 0 };
      days.push({ day: d, dow: i, me: c.me, her: c.her, both: c.both, isToday: d === o.today, future: d > o.today });
      tot.me += c.me; tot.her += c.her; tot.both += c.both;
    }
    var goal = o.goalMs > 0 ? o.goalMs : 0;
    var vals = [];
    days.forEach(function (x) { vals.push(x.me, x.her); });
    if (goal) vals.push(goal);

    // 지난주 이맘때: 지난주 월 05:00 ~ (지금 − 7일)까지 내 segs
    var lastMon = addDays(mon, -7), last = length(clip(segsOf(o.prevLogs || [], o.me), dayStartMs(lastMon), o.now - 7 * DAY));
    var diff = tot.me - last;
    var vs = last > 0 && diff >= MIN ? diff : null; // 늘었을 때만, 지난주에 기록이 있을 때만

    // 연속(내 것): 이번 주 + 지난주 + 그 전
    var mine = {};
    [o.logs, o.prevLogs || [], o.olderLogs || []].forEach(function (arr) {
      arr.forEach(function (l) { if (l.by === o.me) mine[l.day] = (mine[l.day] || 0) + l.ms; });
    });
    var st = streak(mine, o.today);

    var sel = o.selected != null ? days[o.selected] : null;
    var focusedDays = days.filter(function (x) { return x.me >= C.FOCUSED_DAY_MS; }).length;
    var best = days.reduce(function (b, x) { return x.me > (b ? b.me : 0) ? x : b; }, null);

    return {
      days: days,
      total: tot,
      empty: tot.me === 0 && tot.her === 0,
      scale: scaleTop(vals),
      goal: goal,
      vsLastWeek: vs,
      selected: sel,
      subjects: subjects(o.logs, o.me, sel ? sel.day : null),
      band: sel ? band(o.logs, sel.day, o.me, o.her) : null,
      tiles: {
        streak: st,
        focusedDays: focusedDays,
        longest: longest(o.logs, o.me),
        goalDays: goal ? days.filter(function (x) { return x.me >= goal; }).length : null,
        bestDay: best && best.me > 0 ? { day: best.day, dow: best.dow, ms: best.me } : null
      }
    };
  }

  // ── 시간대 띠 (그날 05:00 ~ 다음 날 05:00, 0~1 비율) ──
  function band(logs, day, me, her) {
    var s = dayStartMs(day), e = s + DAY;
    function toFrac(segs) { return clip(segs, s, e).map(function (x) { return [(x[0] - s) / DAY, (x[1] - s) / DAY]; }); }
    var a = segsOf(logs, me, day), b = segsOf(logs, her, day);
    return { me: toFrac(a), her: toFrac(b), both: toFrac(intersect(a, b)), ticks: [5, 9, 13, 17, 21, 1, 5] };
  }

  // ── 돌아보기 (주 · 달 공통) ──
  // opts: { logs(기간 전체), me, her, from, to (날짜, 둘 다 포함), today }
  function rangeView(o) {
    var map = byDay(o.logs, o.me, o.her), cells = [], tot = { me: 0, her: 0, both: 0 }, togetherDays = 0;
    var bestT = null, bestMe = null;
    for (var d = o.from; d <= o.to; d = addDays(d, 1)) {
      var c = map[d] || { me: 0, her: 0, both: 0 };
      tot.me += c.me; tot.her += c.her; tot.both += c.both;
      var together = c.both >= C.TOGETHER_DAY_MS;
      if (together) togetherDays++;
      if (c.both > 0 && (!bestT || c.both > bestT.ms)) bestT = { day: d, ms: c.both };
      if (c.me > 0 && (!bestMe || c.me > bestMe.ms)) bestMe = { day: d, ms: c.me };
      cells.push({ day: d, dow: dow(d), me: c.me, her: c.her, both: c.both,
        lvMe: level(c.me), lvHer: level(c.her), together: together,
        isToday: d === o.today, future: o.today ? d > o.today : false });
    }
    return {
      cells: cells,
      lead: cells.length ? dow(o.from) : 0, // 달력 앞 빈 칸 수 (월요일 시작)
      total: tot,
      empty: tot.me === 0 && tot.her === 0,
      togetherDays: togetherDays,
      bestTogether: bestT,
      bestDayMe: bestMe,
      longest: longest(o.logs, o.me, o.from, o.to),
      subjects: subjects(o.logs.filter(function (l) { return l.day >= o.from && l.day <= o.to; }), o.me, null)
    };
  }
  function monthView(o) { var ds = monthDays(o.month); return rangeView({ logs: o.logs, me: o.me, her: o.her, from: ds[0], to: ds[ds.length - 1], today: o.today }); }

  // ── 월 결산 카드 (서버 functions/recap.js 에서) ──
  // uids = [a, b] (결산의 사람 순서 그대로), prev = 지난달 결산의 focus 카드 또는 null
  function recapCard(logs, month, uids, prev) {
    var ds = monthDays(month), from = ds[0], to = ds[ds.length - 1];
    var inMonth = logs.filter(function (l) { return l.day >= from && l.day <= to; });
    var v = rangeView({ logs: inMonth, me: uids[0], her: uids[1], from: from, to: to });
    if (v.empty) return null; // 둘 다 기록 없으면 카드 건너뜀
    var toMin = function (ms) { return Math.floor(ms / MIN); };
    var card = {
      id: 'focus',
      together: toMin(v.total.both),
      people: {},
      togetherDays: v.togetherDays,
      best: v.bestTogether ? { day: v.bestTogether.day, min: toMin(v.bestTogether.ms) } : null,
      days: v.cells.map(function (c) { return toMin(c.both); }), // 날마다 함께(분) — 카드의 작은 달력
      since: inMonth.reduce(function (d, l) { return !d || l.day < d ? l.day : d; }, null), // 그 달 첫 기록 날 (첫 달 안내용)
      prevTogether: prev && typeof prev.together === 'number' ? prev.together : null
    };
    card.people[uids[0]] = toMin(v.total.me);
    card.people[uids[1]] = toMin(v.total.her);
    return card;
  }
  // 연말: 열두 달 focus 카드 → 가장 많이 함께한 달
  function recapYear(cardsByMonth) {
    var best = null, total = 0;
    Object.keys(cardsByMonth).sort().forEach(function (m) {
      var c = cardsByMonth[m]; if (!c) return;
      total += c.together;
      if (!best || c.together > best.together) best = { month: m, together: c.together };
    });
    return best ? { id: 'focus', together: total, bestMonth: best } : null;
  }

  var API = {
    C: C, MIN: MIN, HOUR: HOUR, DAY: DAY,
    addDays: addDays, dow: dow, dayStartMs: dayStartMs, dayOf: dayOf, weekStart: weekStart, monthDays: monthDays, prevMonth: prevMonth,
    merge: merge, intersect: intersect, length: length, clip: clip, segsOf: segsOf,
    byDay: byDay, level: level, scaleTop: scaleTop, subjects: subjects, longest: longest,
    streak: streak, needMoreForStreak: needMoreForStreak,
    weekView: weekView, band: band, rangeView: rangeView, monthView: monthView,
    recapCard: recapCard, recapYear: recapYear
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.FS = API;
})(this);
