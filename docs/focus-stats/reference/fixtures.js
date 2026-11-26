// 시험 · 목업 자료 (기획 계정). 오늘 = 2026-11-26(목) 15:00, 나 = jun(준민), 짝꿍 = dajin(다진)
(function (root) {
  'use strict';
  var FS = typeof require !== 'undefined' ? require('./focus-stats.js') : root.FS;
  var MIN = 60000;

  var ME = 'jun', HER = 'dajin', HER_NAME = '다진';
  var CATS = {
    study: { name: '공부', emoji: '📝' },
    read: { name: '독서', emoji: '📖' },
    work: { name: '작업', emoji: '💻' },
    cert: { name: '자격증', emoji: '🗂️' },
    lang: { name: '외국어', emoji: '🗣️' }
  };

  // day 의 'HH:MM' (05시 전이면 다음 날 새벽) 에 시작해서 parts 분씩 집중, 사이에 쉬기 rest 분
  function at(day, hm) {
    var h = Number(hm.split(':')[0]), m = Number(hm.split(':')[1]);
    var base = FS.dayStartMs(day) - 5 * 60 * MIN; // 그날 00:00
    if (h < 5) h += 24;
    return base + (h * 60 + m) * MIN;
  }
  var seq = 0;
  function L(by, cat, label, day, hm, parts, rest) {
    var t = at(day, hm), segs = [];
    (Array.isArray(parts) ? parts : [parts]).forEach(function (p, i) {
      if (i) t += (rest || 5) * MIN;
      segs.push([t, t + p * MIN]); t += p * MIN;
    });
    var ms = segs.reduce(function (s, x) { return s + x[1] - x[0]; }, 0);
    return { id: 'f' + (++seq), by: by, cat: cat, label: label, day: day, start: segs[0][0], end: t, ms: ms, segs: segs, strict: false };
  }

  var TODAY = '2026-11-26';
  var NOW = at(TODAY, '15:00');

  // ── 이번 주 (11-23 월 ~ 11-29 일) · 많음 ──
  var weekMany = [
    // 월
    L(ME, 'study', '영단어', '2026-11-23', '07:10', [25, 25]),
    L(ME, 'study', '수학', '2026-11-23', '20:00', [50, 40], 10),
    L(HER, 'cert', '전산회계', '2026-11-23', '19:40', [60, 50], 10),
    // 화
    L(ME, 'study', '영단어', '2026-11-24', '07:05', [30]),
    L(ME, 'read', '소설', '2026-11-24', '22:30', [40]),
    L(HER, 'cert', '전산회계', '2026-11-24', '21:00', [55, 30]),
    // 수 (함께 많이)
    L(ME, 'study', '수학', '2026-11-25', '19:30', [50, 50, 30], 10),
    L(ME, 'work', '기획서', '2026-11-25', '23:40', [35]),
    L(HER, 'cert', '전산회계', '2026-11-25', '19:35', [45, 55], 10),
    L(HER, 'read', '에세이', '2026-11-25', '00:10', [30]), // 목요일 00:10 이지만 05시 전 → 수요일 기록
    // 목 (오늘, 15시까지)
    L(ME, 'study', '영단어', TODAY, '07:00', [25]),
    L(ME, 'lang', '토익 LC', TODAY, '12:20', [40]),
    L(HER, 'cert', '전산회계', TODAY, '12:30', [45])
  ];

  // ── 지난주 (11-16 ~ 11-22) ──
  var prevWeek = [
    L(ME, 'study', '영단어', '2026-11-16', '07:10', [30]),
    L(ME, 'study', '수학', '2026-11-16', '21:00', [60]),
    L(ME, 'study', '영단어', '2026-11-17', '07:10', [25]),
    L(ME, 'read', '소설', '2026-11-18', '22:00', [30]),
    L(ME, 'study', '수학', '2026-11-19', '20:00', [45]),
    L(ME, 'study', '영단어', '2026-11-20', '07:00', [30]),
    L(ME, 'work', '기획서', '2026-11-21', '14:00', [90]),
    L(ME, 'study', '수학', '2026-11-22', '16:00', [60]),
    L(ME, 'study', '수학', '2026-11-17', '21:00', [60]),
    L(ME, 'study', '수학', '2026-11-18', '19:00', [60]),
    L(ME, 'study', '영단어', '2026-11-19', '07:00', [35]),
    L(HER, 'cert', '전산회계', '2026-11-17', '21:10', [50]),
    L(HER, 'cert', '전산회계', '2026-11-18', '19:00', [50]),
    L(HER, 'cert', '전산회계', '2026-11-18', '20:00', [60]),
    L(HER, 'cert', '전산회계', '2026-11-21', '14:30', [70]),
    L(HER, 'cert', '전산회계', '2026-11-20', '20:00', [80])
  ];
  // 그 전: 11-12 ~ 11-15 매일 → 연속은 11-12 부터
  var older = [
    L(ME, 'study', '영단어', '2026-11-12', '07:00', [20]),
    L(ME, 'study', '영단어', '2026-11-13', '07:00', [20]),
    L(ME, 'study', '영단어', '2026-11-14', '07:00', [20]),
    L(ME, 'study', '영단어', '2026-11-15', '07:00', [20]),
    L(HER, 'cert', '전산회계', '2026-11-12', '20:00', [70]),
    L(HER, 'cert', '전산회계', '2026-11-14', '13:00', [90]),
    L(ME, 'work', '기획서', '2026-11-14', '13:10', [80])
  ];

  // ── 이번 주 · 조금 (오늘만) ──
  var weekFew = [
    L(ME, 'study', '영단어', TODAY, '07:00', [25]),
    L(HER, 'cert', '전산회계', TODAY, '07:10', [40])
  ];

  // ── 11월 한 달 (돌아보기 달 · 결산) ──
  function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
  function november() {
    var r = rng(1126), out = [];
    FS.monthDays('2026-11').forEach(function (d) {
      if (d >= '2026-11-12') return; // 12일부터는 위의 실제 자료
      var w = FS.dow(d);
      if (r() < 0.85) out.push(L(ME, r() < 0.6 ? 'study' : 'read', r() < 0.5 ? '수학' : '영단어', d, '20:00', [Math.round(20 + r() * 70), Math.round(r() * 60)].filter(Boolean)));
      if (r() < 0.7) out.push(L(HER, 'cert', '전산회계', d, r() < 0.6 ? '20:10' : '22:00', [Math.round(30 + r() * 60), Math.round(r() * 50)].filter(Boolean)));
      if (w >= 5 && r() < 0.6) out.push(L(ME, 'work', '기획서', d, '14:00', [Math.round(60 + r() * 120)]));
    });
    return out.concat(older, prevWeek, weekMany);
  }

  // ── 10월 (결산 지난달 비교) — 결산 카드에 넣을 값만 ──
  var octCard = { id: 'focus', together: 640 };

  var API = { ME: ME, HER: HER, HER_NAME: HER_NAME, CATS: CATS, TODAY: TODAY, NOW: NOW, L: L, at: at,
    weekMany: weekMany, prevWeek: prevWeek, older: older, weekFew: weekFew, november: november, octCard: octCard };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.FX = API;
})(this);
