/* 집중 F1 (docs/focus/spec.md) — 계산만. 화면 · 저장 · 글은 다른 모듈 (view-focus.js · app-focus.js · focus-text.js).
   시간은 모두 ms. 하루 = 서울 새벽 5시 ~ 다음 날 새벽 5시, 주 = 월요일 새벽 5시부터 (spec 7-2).
   집중 한 번 = 「달린 구간」 [[시작, 끝], …] — 잠깐 쉬기 · 자리 비움은 구간 사이 빈틈. 함께 시간 = 두 사람 구간이 겹친 길이 (spec 5 · tests C4). */
(function (root) {
  'use strict';
  var H = 3600000, M = 60000, KST = 9 * H, DAY0 = 5; // 서울(UTC+9, 서머타임 없음) · 하루 시작 5시
  var LONG_ASK = 3 * H, AUTO_STOP = 6 * H, PAUSE_END = 30 * M, MIN_SAVE = M, STRICT_GRACE = 5000, CALL_GAP = 30 * M;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  /** ms → 그 시각이 속한 「집중 하루」 'YYYY-MM-DD' (새벽 5시 전은 전날) */
  function dayKey(ms) {
    var d = new Date(ms + KST - DAY0 * H);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  /** 'YYYY-MM-DD' → 그날 새벽 5시(서울) ms */
  function dayStart(key) {
    var p = String(key).split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2], DAY0) - KST;
  }
  function addDays(key, n) { return dayKey(dayStart(key) + n * 24 * H + H); }
  /** 그 하루가 속한 주의 월요일 'YYYY-MM-DD' */
  function weekStart(key) {
    var w = (new Date(dayStart(key) + KST).getUTCDay() + 6) % 7; // 0 = 월
    return addDays(key, -w);
  }
  function weekdayOf(key) { return (new Date(dayStart(key) + KST).getUTCDay() + 6) % 7; }

  // ── 구간 계산 ──
  /** 정렬 · 겹친 구간 합치기 · 빈 구간 버리기 */
  function norm(segs) {
    var a = (segs || []).filter(function (s) { return s && s[1] > s[0]; }).map(function (s) { return [s[0], s[1]]; }).sort(function (x, y) { return x[0] - y[0]; });
    var out = [];
    a.forEach(function (s) { var l = out[out.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else out.push(s); });
    return out;
  }
  function sum(segs) { return norm(segs).reduce(function (t, s) { return t + s[1] - s[0]; }, 0); }
  function clip(segs, from, to) {
    return norm(segs).map(function (s) { return [Math.max(s[0], from), Math.min(s[1], to)]; }).filter(function (s) { return s[1] > s[0]; });
  }
  /** 두 사람 구간의 겹친 길이 (tests C4) */
  function overlap(a, b) {
    a = norm(a); b = norm(b);
    var i = 0, j = 0, t = 0;
    while (i < a.length && j < b.length) {
      var s = Math.max(a[i][0], b[j][0]), e = Math.min(a[i][1], b[j][1]);
      if (e > s) t += e - s;
      if (a[i][1] < b[j][1]) i++; else j++;
    }
    return t;
  }
  /** 구간을 새벽 5시에서 나눠 하루별로 { 'YYYY-MM-DD': [[s, e], …] } (tests C2) */
  function byDay(segs) {
    var out = {};
    norm(segs).forEach(function (s) {
      var a = s[0];
      while (a < s[1]) {
        var k = dayKey(a), next = dayStart(k) + 24 * H, b = Math.min(s[1], next);
        (out[k] = out[k] || []).push([a, b]);
        a = b;
      }
    });
    return out;
  }

  // ── 지금 상태 문서 (focus/{uid}) ──
  /** 문서 → 지금 상태. 6시간이 지난 집중은 짝꿍 화면에서 「쉬는 중」으로 (서버가 닫기 전이어도) */
  function live(doc, now) {
    if (!doc || !doc.state || doc.state === 'idle' || !doc.start) return { state: 'idle', segs: [], runMs: 0 };
    var segs = (doc.segs || []).slice();
    var cap = doc.start + AUTO_STOP;
    if (doc.state === 'run' && doc.segStart) segs.push([doc.segStart, Math.min(now, cap)]);
    segs = clip(segs, doc.start, cap);
    var stale = now >= cap;
    return { state: stale ? 'stale' : doc.state, segs: segs, runMs: sum(segs), start: doc.start, segStart: doc.state === 'run' ? doc.segStart : null,
      pauseAt: doc.pauseAt || null, cat: doc.cat || null, label: doc.label || null, strict: !!doc.strict };
  }
  /** 짝꿍에게 보이는 상태 (자리 비움은 「잠깐 자리 비움」 하나 — 횟수 · 시간 없음, spec 1 · tests C10) */
  function shownState(lv) { return !lv || lv.state === 'stale' ? 'idle' : lv.state; }

  /** 오늘(집중 하루) 합계 — logs: [{ by, segs }], lives: { uid: live } */
  function totals(logs, lives, me, partner, now) {
    var today = dayKey(now), yest = addDays(today, -1);
    function segsOf(uid, key) {
      var all = [];
      (logs || []).forEach(function (l) { if (l.by === uid && l.day === key) all = all.concat(l.segs || []); });
      var lv = lives && lives[uid];
      if (lv && lv.segs && lv.segs.length) { var d = byDay(lv.segs)[key]; if (d) all = all.concat(d); }
      return norm(all);
    }
    var mine = segsOf(me, today), hers = partner ? segsOf(partner, today) : [];
    return { day: today, me: sum(mine), her: sum(hers), both: overlap(mine, hers), yesterday: sum(segsOf(me, yest)), mineSegs: mine, herSegs: hers };
  }
  /** 이번 주 7칸 (월~일) — 나 · 짝꿍 · 함께 */
  function week(logs, lives, me, partner, now) {
    var ws = weekStart(dayKey(now)), today = dayKey(now), out = [];
    for (var i = 0; i < 7; i++) {
      var k = addDays(ws, i);
      var t = k > today ? null : totals(logs, lives, me, partner, k === today ? now : dayStart(k) + H);
      out.push({ day: k, idx: i, me: t ? t.me : 0, her: t ? t.her : 0, both: t ? t.both : 0, future: k > today, today: k === today });
    }
    var max = Math.max.apply(null, out.map(function (d) { return Math.max(d.me, d.her); }).concat([1]));
    out.forEach(function (d) { d.meH = d.me / max; d.herH = d.her / max; d.bothH = d.both / max; });
    return { days: out, max: max, weekMe: out.reduce(function (t, d) { return t + d.me; }, 0), weekHer: out.reduce(function (t, d) { return t + d.her; }, 0) };
  }

  // ── 숫자 꼴 (spec 7-1, tests C1) ──
  function hms(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
  function hm(ms) { var m = Math.max(0, Math.floor(ms / M)); return Math.floor(m / 60) + ':' + pad(m % 60); }
  /** 짝꿍 상태 · 띠: 60분 미만 「48분」, 넘으면 H:MM → { min } 또는 { hm } */
  function mins(ms) { var m = Math.max(0, Math.floor(ms / M)); return m < 60 ? { min: m } : { hm: hm(ms) }; }
  function clock(ms) { var d = new Date(ms + KST); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  /** 어제 비교 (spec 7-4, tests C5): 'more' (+분) · 'less' (어제 H:MM) · null (어제 0) */
  function compare(today, yest) {
    if (!yest) return null;
    if (today > yest) return { kind: 'more', diff: today - yest };
    return { kind: 'less', yest: yest };
  }

  // ── 짝꿍 카드 버튼 · 띠 · 점 (tests C6 · C7 · C8) ──
  /** herState: idle | run | pause | away | null(아직 모름) */
  function partnerButton(herState, callAt, now) {
    if (herState === 'run') return 'join';
    if (herState === 'idle') return callAt && now - callAt < CALL_GAP ? 'sent' : 'call';
    return null;
  }
  function band(meState, herState) {
    var meOn = meState === 'run', herOn = herState === 'run';
    if (meOn && herOn) return 'both';
    if (meOn) return 'me';
    if (meState === 'pause' || meState === 'away') return 'mepause';
    if (herOn) return 'partner';
    return null;
  }
  function dot(meState, herState, onFocus) {
    if (onFocus) return [];
    var s = [];
    if (meState === 'run') s.push('me');
    if (herState === 'run') s.push('her');
    return s;
  }
  /** 둘이 지금 함께 달리는 중이면 함께가 된 시각 */
  function togetherSince(meLv, herLv) {
    if (!meLv || !herLv || meLv.state !== 'run' || herLv.state !== 'run' || !meLv.segStart || !herLv.segStart) return null;
    return Math.max(meLv.segStart, herLv.segStart);
  }

  // ── 과목 ──
  /** 최근 쓴 순 카테고리 id (기록 · 지금 · 이 기기 최근) → 나머지는 카테고리 순서 */
  function recentCats(cats, logs, me, extra) {
    var seen = {}, order = [];
    (extra || []).concat((logs || []).filter(function (l) { return l.by === me; }).sort(function (a, b) { return b.end - a.end; }).map(function (l) { return l.cat; }))
      .forEach(function (c) { if (c && !seen[c] && cats.some(function (x) { return x.id === c; })) { seen[c] = true; order.push(c); } });
    cats.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = true; order.push(c.id); } });
    return order;
  }
  function recentLabels(logs, me, cat, extra) {
    var out = [];
    (extra || []).concat((logs || []).filter(function (l) { return l.by === me && l.cat === cat && l.label; }).sort(function (a, b) { return b.end - a.end; }).map(function (l) { return l.label; }))
      .forEach(function (x) { if (x && out.indexOf(x) < 0 && out.length < 5) out.push(x); });
    return out;
  }
  function cleanLabel(s) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return Array.from(s).slice(0, 8).join(''); }

  // ── 기록 고치기 검사 (spec 4-5, tests C13) ──
  /** → null(괜찮음) | { err: 'order' | 'future' | 'short' | 'overlap', with: [s, e] } */
  function checkEdit(start, end, others, now) {
    if (!(end > start)) return { err: 'order' };
    if (end > now + M) return { err: 'future' };
    if (end - start < MIN_SAVE) return { err: 'short' };
    for (var i = 0; i < (others || []).length; i++) { var o = others[i]; if (o[0] < end && start < o[1]) return { err: 'overlap', with: o }; }
    return null;
  }

  // ── 집중에 보일 카테고리 · 이번 주 과목별 ──
  /** 처음 값: 기본 운동 · 약속, 이름에 아래 낱말이 있으면 숨김. prefs[id]가 있으면 그게 우선 (true = 숨김) */
  var HIDE_IDS = { exercise: true, meet: true };
  var HIDE_RE = /운동|약속|병원|진료|식사|밥|데이트|헬스|미용/;
  function catHidden(cat, prefs) {
    if (prefs && Object.prototype.hasOwnProperty.call(prefs, cat.id)) return !!prefs[cat.id];
    return !!HIDE_IDS[cat.id] || HIDE_RE.test(String(cat.name || ''));
  }
  /** 다 숨기면 전부 보여 줌 (시작할 곳이 없어지지 않게) */
  function visibleCats(cats, prefs) {
    var v = (cats || []).filter(function (c) { return !catHidden(c, prefs); });
    return v.length ? v : (cats || []).slice();
  }
  /** 이번 주(월 05시~) 나의 카테고리별 · 이름별 합계 → [{ cat, ms, labels: [{ label, ms }] }] 큰 순 */
  function weekSubjects(logs, lv, me, now, onlyDay) {
    var ws = weekStart(dayKey(now)), by = {};
    function inRange(k) { return onlyDay ? k === onlyDay : k >= ws; }
    function add(cat, label, ms) {
      if (!(ms > 0)) return;
      var k = cat || '', o = by[k] || (by[k] = { cat: cat || null, ms: 0, lab: {} });
      o.ms += ms; if (label) o.lab[label] = (o.lab[label] || 0) + ms;
    }
    (logs || []).forEach(function (l) { if (l.by === me && inRange(l.day)) add(l.cat, l.label, l.ms != null ? l.ms : sum(l.segs || [])); });
    if (lv && lv.segs && lv.segs.length) { var d = byDay(lv.segs); Object.keys(d).forEach(function (k) { if (inRange(k)) add(lv.cat, lv.label, sum(d[k])); }); }
    return Object.keys(by).map(function (k) {
      var o = by[k];
      return { cat: o.cat, ms: o.ms, labels: Object.keys(o.lab).map(function (n) { return { label: n, ms: o.lab[n] }; }).sort(function (a, b) { return b.ms - a.ms; }) };
    }).sort(function (a, b) { return b.ms - a.ms; });
  }

  /** 기간 요약 (돌아보기 F3): logs 는 이미 기간 안 것 → { me, her, both, top: [{ cat, ms }] (나, 큰 순 3개) } */
  function rangeSummary(logs, me, partner) {
    var mine = [], hers = [], me$ = 0, her$ = 0, byCat = {};
    (logs || []).forEach(function (l) {
      var ms = l.ms != null ? l.ms : sum(l.segs || []);
      if (l.by === me) { me$ += ms; mine = mine.concat(l.segs || []); byCat[l.cat || ''] = (byCat[l.cat || ''] || 0) + ms; }
      else if (l.by === partner) { her$ += ms; hers = hers.concat(l.segs || []); }
    });
    var top = Object.keys(byCat).map(function (c) { return { cat: c || null, ms: byCat[c] }; }).sort(function (a, b) { return b.ms - a.ms; }).slice(0, 3);
    return { me: me$, her: her$, both: overlap(mine, hers), top: top };
  }

  // ── 서버가 대신 끝내기 (F2) · 루틴 자동 체크 (F3) ──
  var SERVER_GRACE = 30 * M; // 앱이 먼저 처리할 틈 (6시간 · 쉬기 30분 뒤 이만큼 더 지나면 서버가)
  /** 서버가 이 집중을 끝내야 하면 끝 시각, 아니면 null */
  function autoCloseAt(doc, now) {
    if (!doc || !doc.start || !doc.state || doc.state === 'idle') return null;
    if (doc.state === 'pause' && doc.pauseAt && now - doc.pauseAt >= PAUSE_END + SERVER_GRACE / 3) return doc.pauseAt;
    var cap = doc.start + AUTO_STOP;
    if (now >= cap + SERVER_GRACE) return doc.state === 'pause' && doc.pauseAt ? Math.min(doc.pauseAt, cap) : cap;
    return null;
  }
  /** 3시간째 집중 중인지 (서버 알림) */
  function longRun(doc, now) { return !!doc && doc.state === 'run' && !!doc.start && now - doc.start >= LONG_ASK && now < doc.start + AUTO_STOP; }
  /** 집중 문서를 endAt 에서 끝낸 기록들 (하루 05시로 나눔, 1분 미만 버림) */
  function sessionLogs(doc, endAt, by) {
    var cap = doc.start + AUTO_STOP, segs = (doc.segs || []).slice();
    if (doc.state === 'run' && doc.segStart) segs.push([doc.segStart, endAt]);
    segs = clip(segs, doc.start, Math.min(endAt, cap));
    var parts = byDay(segs);
    return Object.keys(parts).sort().map(function (k) {
      var ss = parts[k];
      return { by: by, cat: doc.cat || null, label: doc.label || null, day: k, start: ss[0][0], end: ss[ss.length - 1][1], ms: sum(ss), segs: ss, strict: !!doc.strict };
    }).filter(function (l) { return l.ms >= MIN_SAVE; });
  }
  /** 그날(집중 하루) 나의 카테고리별 합계 { cat: ms, '*': 전체 } — 진행 중 포함 */
  function dayByCat(logs, lv, me, day) {
    var out = { '*': 0 };
    function add(c, ms) { if (!(ms > 0)) return; out[c || ''] = (out[c || ''] || 0) + ms; out['*'] += ms; }
    (logs || []).forEach(function (l) { if (l.by === me && l.day === day) add(l.cat, l.ms != null ? l.ms : sum(l.segs || [])); });
    if (lv && lv.segs && lv.segs.length) { var d = byDay(lv.segs)[day]; if (d) add(lv.cat, sum(d)); }
    return out;
  }
  /** 루틴의 집중 목표 { cat: id|null(아무 집중), min } 를 채웠는지 */
  function routineMet(goal, byCat) {
    if (!goal || !(goal.min > 0)) return false;
    var ms = goal.cat ? byCat[goal.cat] || 0 : byCat['*'] || 0;
    return ms >= goal.min * M;
  }
  /** 하루 목표 진행: goalMin(분) → { goal, ms, ratio(0~1), done } 또는 null */
  function goalProgress(goalMin, ms) {
    if (!(goalMin > 0)) return null;
    var g = goalMin * M;
    return { goal: g, ms: ms, ratio: Math.min(1, ms / g), done: ms >= g };
  }

  var api = { H: H, M: M, LONG_ASK: LONG_ASK, AUTO_STOP: AUTO_STOP, PAUSE_END: PAUSE_END, MIN_SAVE: MIN_SAVE, STRICT_GRACE: STRICT_GRACE, CALL_GAP: CALL_GAP,
    dayKey: dayKey, dayStart: dayStart, addDays: addDays, weekStart: weekStart, weekdayOf: weekdayOf,
    norm: norm, sum: sum, clip: clip, overlap: overlap, byDay: byDay, live: live, shownState: shownState, totals: totals, week: week,
    hms: hms, hm: hm, mins: mins, clock: clock, compare: compare, partnerButton: partnerButton, band: band, dot: dot, togetherSince: togetherSince,
    recentCats: recentCats, recentLabels: recentLabels, cleanLabel: cleanLabel, checkEdit: checkEdit,
    catHidden: catHidden, visibleCats: visibleCats, weekSubjects: weekSubjects,
    rangeSummary: rangeSummary, SERVER_GRACE: SERVER_GRACE, autoCloseAt: autoCloseAt, longRun: longRun, sessionLogs: sessionLogs, dayByCat: dayByCat, routineMet: routineMet, goalProgress: goalProgress };
  root.RT = root.RT || {};
  root.RT.focus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
