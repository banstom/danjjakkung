/* 며칠차 · 연속 · 쉰 날 계산 — 화면과 저장소를 모르는 순수 함수만 둔다.
   모든 날짜는 day number(정수). isDone(day)는 그 날 했는지 true/false. */
(function (root) {
  'use strict';

  /**
   * 루틴 하나의 요약.
   * - dayN: 시작일을 1일차로 센 오늘의 차수 (쉰 날도 센다)
   * - streak: 오늘 했으면 오늘까지, 아직 안 했으면 어제까지 끊기지 않고 이어진 날 수
   * - lastMiss: 오늘 이전에 마지막으로 쉰 날 (없으면 null)
   */
  function summary(o) {
    var start = o.start, today = o.today, isDone = o.isDone;
    if (!(today >= start)) {
      return { started: false, daysUntil: start - today, dayN: 0, count: 0, todayDone: false, streak: 0, best: 0, lastMiss: null, missCount: 0 };
    }
    var count = 0, best = 0, run = 0, lastMiss = null, missCount = 0;
    for (var d = start; d <= today; d++) {
      if (isDone(d)) {
        count++; run++;
        if (run > best) best = run;
      } else {
        run = 0;
        if (d < today) { lastMiss = d; missCount++; }
      }
    }
    var todayDone = !!isDone(today);
    var streak = 0;
    for (var e = todayDone ? today : today - 1; e >= start && isDone(e); e--) streak++;
    return { started: true, daysUntil: 0, dayN: today - start + 1, count: count, todayDone: todayDone, streak: streak, best: best, lastMiss: lastMiss, missCount: missCount };
  }

  /** 여러 루틴을 "모두 한 날"로 묶은 요약. 모든 루틴이 시작된 날부터 센다. */
  function together(o) {
    var start = Math.max.apply(null, o.starts);
    return summary({ start: start, today: o.today, isDone: o.allDone });
  }

  /** 그리드 칸 단계: 'pre'(시작 전) · 'none'(안 함) · 'half'(일부) · 'full'(전부). */
  function level(activeCount, doneCount) {
    if (activeCount === 0) return 'pre';
    if (doneCount === 0) return 'none';
    return doneCount >= activeCount ? 'full' : 'half';
  }

  var api = { summary: summary, together: together, level: level };
  root.RT = root.RT || {};
  root.RT.streak = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
