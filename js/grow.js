/* 함께 키우기 (v41) — 🍅 토마토. 화면 없음, 저장 없음: 체크 · 끝낸 할 일 · 퀘스트에서 그때그때 점수를 다시 센다.
   하루 점수: 모두 해낸 날 +3 / 아니면 자기 루틴을 다 한 사람이 있으면 +1 / 함께 끝낸 할 일 하나에 +1 (하루 최대 6점)
   주마다: 퀘스트 성공 +5, 보너스 성공 +2
   단계: 씨앗 0 → 새싹 10 → 줄기 · 잎 30 → 노란 꽃 60 → 초록 토마토 100 → 빨간 토마토 160 → 200점이면 수확하고 새 씨앗부터
   줄거나 죽지 않는다. 사흘 내리 0점이면(쉬는 날 빼고) 「목말라 보여요」 표정만. */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var D = NODE ? require('./dates') : root.RT.dates;
  var M = NODE ? require('./model') : root.RT.model;

  // v41 배포일부터 0점 (그 전 기록은 세지 않는다)
  var START = D.fromYMD(2026, 11, 12);
  var CYCLE = 200;
  var DAY_MAX = 6, QUEST_PTS = 5, BONUS_PTS = 2;
  var STAGES = [
    { min: 0, key: 'seed', name: '씨앗', line: '흙 속에서 준비하고 있어요' },
    { min: 10, key: 'sprout', name: '새싹', line: '새싹이 올라왔어요' },
    { min: 30, key: 'leaf', name: '줄기 · 잎', line: '줄기가 자라고 잎이 났어요' },
    { min: 60, key: 'flower', name: '노란 꽃', line: '노란 꽃이 피었어요' },
    { min: 100, key: 'green', name: '초록 토마토', line: '초록 토마토가 열렸어요' },
    { min: 160, key: 'red', name: '빨간 토마토', line: '빨갛게 익었어요! 곧 수확해요' }
  ];

  function stageOf(score) {
    var s = 0;
    for (var i = 0; i < STAGES.length; i++) if (score >= STAGES[i].min) s = i;
    return s;
  }

  /**
   * o: { routines(model.routinesFrom), checks, persons: [사람 키], todos: 할 일 문서(끝낸 것 포함), today,
   *      quests: [{ mon, done, allDone }] (지난주 · 이번 주 퀘스트 결과 — 시작 전 주는 빼고 줌), start? (테스트용) }
   */
  function build(o) {
    var start = typeof o.start === 'number' ? o.start : api.START; // api.START 는 브라우저 테스트가 앞당겨 볼 수 있게 그때그때 읽는다
    var today = o.today, routines = o.routines || [], checks = o.checks || {}, persons = o.persons || [];
    var isDone = function (r, day) { return M.activeOn(r, day) && day <= today && !!checks[r.key + '|' + D.toKey(day)]; };
    var together = {}; // 날 → 함께 끝낸 일 수
    var seen = {};
    (o.todos || []).forEach(function (t) {
      if (!t || t.done !== true || t.scope !== 'together' || !t.doneAt || seen[t.id]) return;
      seen[t.id] = true;
      var d = D.dayOfIso(t.doneAt);
      if (!isNaN(d)) together[d] = (together[d] || 0) + 1;
    });
    var days = [], total = 0, weekPts = 0, mon = today - ((D.parts(today).w + 6) % 7);
    for (var d = start; d <= today; d++) {
      var lv = M.dayLevel(routines, persons, d, isDone);
      var pts = 0, why = [];
      if (lv.level === 'full') { pts += 3; why.push('모두 해낸 날 +3'); }
      else if (lv.level !== 'rest' && lv.level !== 'pre') {
        var any = persons.some(function (p) {
          var mine = routines.filter(function (r) { return r.owner === p && M.activeOn(r, d); });
          return mine.length && mine.every(function (r) { return isDone(r, d); });
        });
        if (any) { pts += 1; why.push('한 사람 다 함 +1'); }
      }
      if (together[d]) { pts += together[d]; why.push('함께 끝낸 일 +' + together[d]); }
      pts = Math.min(DAY_MAX, pts);
      days.push({ day: d, pts: pts, rest: lv.level === 'rest', why: why });
      total += pts;
      if (d >= mon) weekPts += pts;
    }
    var questPts = 0;
    (o.quests || []).forEach(function (q) {
      if (q.mon + 6 < start) return;
      var p = (q.done ? QUEST_PTS : 0) + (q.allDone ? BONUS_PTS : 0);
      questPts += p;
      if (q.mon === mon) weekPts += p;
    });
    total += questPts;
    var harvested = Math.floor(total / CYCLE), score = total % CYCLE;
    var si = stageOf(score), next = STAGES[si + 1];
    // 목마름: 어제까지 사흘(쉬는 날은 건너뜀) 내리 0점
    var dry = 0, checked = 0;
    for (var k = days.length - 2; k >= 0 && checked < 3; k--) {
      if (days[k].rest) continue;
      checked++;
      if (days[k].pts === 0) dry++; else break;
    }
    var todayPts = days.length ? days[days.length - 1].pts : 0;
    var lastWeek = [];
    for (var j = Math.max(0, days.length - 7); j < days.length; j++) lastWeek.push(days[j]);
    return {
      started: today >= start, total: total, harvested: harvested, score: score, stage: si, stageKey: STAGES[si].key, stageName: STAGES[si].name, line: STAGES[si].line,
      next: next ? { name: next.name, need: next.min - score } : { name: '수확', need: CYCLE - score },
      pct: next ? Math.round((score - STAGES[si].min) / (next.min - STAGES[si].min) * 100) : Math.round((score - STAGES[si].min) / (CYCLE - STAGES[si].min) * 100),
      todayPts: todayPts, weekPts: weekPts, questPts: questPts, thirsty: dry >= 3 && todayPts === 0,
      week: lastWeek
    };
  }

  var api;
  api = { START: START, CYCLE: CYCLE, STAGES: STAGES, DAY_MAX: DAY_MAX, QUEST_PTS: QUEST_PTS, BONUS_PTS: BONUS_PTS, stageOf: stageOf, build: build };
  root.RT = root.RT || {};
  root.RT.grow = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
