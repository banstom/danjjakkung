/* 알림 문구 — 상대가 체크한 기록을 사람이 읽는 한 줄로 만든다. 화면·저장소와 무관한 순수 함수. */
(function (root) {
  'use strict';
  var RT = root.RT || {};
  var D = RT.dates || require('./dates.js');
  var P = RT.people || require('./people.js');

  function routineOf(routines, key) {
    for (var i = 0; i < routines.length; i++) if (routines[i].key === key) return routines[i];
    return null;
  }

  function whenText(item, today) {
    var day = D.parse(item.date);
    return day === today ? '오늘' : D.label(day);
  }

  /**
   * 실시간: 방금 들어온 변경들 중 상대가 '완료'로 남긴 것 → 한 줄 (없으면 '').
   * items: [{ routine, date, done, by, at }]
   */
  function live(items, me, routines, today, names) {
    var theirs = items.filter(function (it) { return it.done && it.by && it.by !== me && routineOf(routines, it.routine); });
    if (!theirs.length) return '';
    var it = theirs[theirs.length - 1];
    var r = routineOf(routines, it.routine);
    var who = (names && names[it.by]) || P.nameOf(routines, it.by) || '상대';
    if (D.parse(it.date) === today) return '🎉 ' + who + ' 님이 ' + r.name + ' 완료!';
    return who + ' 님이 ' + D.label(D.parse(it.date)) + ' ' + r.name + ' 기록을 남겼어요';
  }

  /**
   * 다시 열었을 때: lastSeen(ISO) 이후 상대가 남긴 기록 요약 (없으면 '').
   * meta: { 'squat|2026-10-27': { by, at }, ... }
   */
  function catchUp(meta, me, routines, today, lastSeen, names) {
    if (!lastSeen) return '';
    var since = new Date(lastSeen).getTime();
    if (isNaN(since)) return '';
    var items = Object.keys(meta).map(function (id) {
      var m = meta[id], parts = id.split('|');
      return { routine: parts[0], date: parts[1], by: m.by, at: m.at, t: new Date(m.at).getTime() };
    }).filter(function (it) {
      return it.by && it.by !== me && !isNaN(it.t) && it.t > since && routineOf(routines, it.routine);
    }).sort(function (a, b) { return a.t - b.t; });
    if (!items.length) return '';
    var last = items[items.length - 1];
    var who = (names && names[last.by]) || P.nameOf(routines, last.by) || '상대';
    var r = routineOf(routines, last.routine);
    if (items.length === 1) {
      var when = whenText(last, today);
      return '👏 ' + who + ' 님이 ' + when + (when === '오늘' ? ' ' + D.timeLabel(last.at) + '에 ' : ' ') + r.name + ' 완료했어요';
    }
    return '👏 ' + who + ' 님 새 기록 ' + items.length + '개 · 최근 ' + whenText(last, today) + ' ' + r.name;
  }

  var api = { live: live, catchUp: catchUp };
  RT.news = api;
  root.RT = RT;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
