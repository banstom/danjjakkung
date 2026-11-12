/* 주간 공동 퀘스트 (v40) — 둘이 함께 채우는 한 주 목표. 화면 없음, 저장 없음.
   주마다 숫자 몇 개(주간 숫자)만 받아서 그 주의 퀘스트 1개 + 보너스 1개와 진행을 돌려준다.
     · 주간 숫자: { allDays, togetherDone, kungs(null = 불러오지 못함), togetherMin, nowDone } — 돌아보기 계산(review.build)에서 꺼낸다
     · 고르기: 주 번호로 정한다 → 두 폰에서 같다. 그 주에 할 수 있는 것만 (꿍 기록을 못 읽으면 꿍 빼고, 함께 일정 · 평면을 안 쓰면 빼고)
     · 목표: 지난 4주 평균 + 1 (보너스는 + 2). 기록이 없으면 기본값. 실패하면 평균이 내려가 다음 주 목표도 내려간다
   주는 월요일에 시작한다 (시간표 · 돌아보기와 같음). */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var D = NODE ? require('./dates') : root.RT.dates;

  // 주 번호 0 = 2026-10-26 (월) 주 — 단짝꿍 시간표가 시작한 주
  var EPOCH = D.fromYMD(2026, 10, 26);

  var METRICS = [
    { key: 'allDays', label: '모두 해낸 날', unit: '일', base: [3, 4], max: 7, icon: '🌟' },
    { key: 'togetherDone', label: '함께 끝낸 일', unit: '개', base: [2, 3], max: 30, icon: '🤝' },
    { key: 'kungs', label: '꿍 주고받기', unit: '번', base: [3, 4], max: 14, icon: '💌' },
    { key: 'togetherHours', label: '함께 일정', unit: '시간', base: [2, 3], max: 40, icon: '💞' },
    { key: 'nowDone', label: '「지금 할 일」 쳐내기', unit: '개', base: [2, 3], max: 30, icon: '⚡' }
  ];

  function weekIndex(mon) { return Math.floor((mon - EPOCH) / 7); }

  /** 돌아보기 계산 결과(review.build, 주 보기) → 주간 숫자 */
  function statsOf(rm) {
    var now = rm.todos.quads.filter(function (q) { return q.key === 'now'; })[0];
    return {
      allDays: rm.us.allDays, togetherDone: rm.us.togetherDone, kungs: rm.us.kungs,
      togetherMin: rm.us.togetherMin || 0, nowDone: now ? now.n : 0
    };
  }

  function valueOf(key, s) {
    if (!s) return null;
    if (key === 'togetherHours') return (s.togetherMin || 0) / 60;
    var v = s[key];
    return typeof v === 'number' ? v : null;
  }

  /** 그 주에 할 수 있는 퀘스트: 꿍은 기록을 읽을 수 있을 때, 함께 일정 · 「지금 할 일」은 지난 5주 안에 한 번이라도 있었을 때 */
  function usable(weeks) {
    return METRICS.filter(function (mt) {
      if (mt.key === 'allDays' || mt.key === 'togetherDone') return true;
      if (mt.key === 'kungs') return !!weeks[0] && weeks[0].kungs !== null;
      return weeks.some(function (s) { return (valueOf(mt.key, s) || 0) > 0; });
    });
  }

  /** 목표: 지난 주(최대 4주) 평균을 올림해서 + 1 (보너스 + 2). 기록이 없으면 기본값. 1 ~ max */
  function targetOf(mt, prev, bonus) {
    var vals = prev.map(function (s) { return valueOf(mt.key, s); }).filter(function (v) { return v !== null; });
    var t = vals.length ? Math.ceil(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) + (bonus ? 2 : 1) : mt.base[bonus ? 1 : 0];
    return Math.max(1, Math.min(mt.max, t));
  }

  function fmt(v, unit) {
    if (unit === '시간') { var r = Math.floor(v * 10) / 10; return (r % 1 ? r.toFixed(1) : String(r)); }
    return String(Math.floor(v));
  }

  function item(mt, target, value) {
    var v = value === null ? 0 : value;
    return {
      key: mt.key, icon: mt.icon, label: mt.label, unit: mt.unit, target: target,
      value: v, text: mt.label + ' ' + target + mt.unit, progress: fmt(Math.min(v, target), mt.unit) + '/' + target,
      pct: Math.min(100, Math.round(v / target * 100)), done: v >= target
    };
  }

  /**
   * o: { mon: 그 주 월요일, weeks: [그 주, 1주 전, 2주 전, 3주 전, 4주 전] 주간 숫자 (없는 주는 null) }
   * → { week, main, bonus, done(퀘스트 성공), allDone(보너스까지) }
   */
  function build(o) {
    var weeks = o.weeks || [];
    var cur = weeks[0] || null, prev = weeks.slice(1, 5).filter(Boolean);
    var list = usable(weeks);
    var w = weekIndex(o.mon), n = list.length;
    var main = list[((w % n) + n) % n];
    var rest = list.filter(function (mt) { return mt !== main; });
    var bonus = rest[((Math.floor(w / n) + w) % rest.length + rest.length) % rest.length];
    var a = item(main, targetOf(main, prev, false), valueOf(main.key, cur));
    var b = item(bonus, targetOf(bonus, prev, true), valueOf(bonus.key, cur));
    return { week: w, mon: o.mon, main: a, bonus: b, done: a.done, allDone: a.done && b.done };
  }

  var api = { EPOCH: EPOCH, METRICS: METRICS, weekIndex: weekIndex, statsOf: statsOf, usable: usable, targetOf: targetOf, build: build };
  root.RT = root.RT || {};
  root.RT.quest = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
