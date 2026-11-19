/* 날짜 도우미 — 날짜를 "1970-01-01부터 며칠째"인 정수(day number)로 다룬다.
   시간대 영향을 받지 않도록 계산은 모두 UTC 자정 기준으로 한다. */
(function (root) {
  'use strict';
  var DAY_MS = 86400000;
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function fromYMD(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / DAY_MS); }

  /** 'YYYY-MM-DD' → day number. 형식이 틀리면 NaN. */
  function parse(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));
    if (!m) return NaN;
    var n = fromYMD(+m[1], +m[2], +m[3]);
    var p = parts(n);
    // 2월 30일, 13월 같은 없는 날짜는 거른다
    return (p.y === +m[1] && p.m === +m[2] && p.d === +m[3]) ? n : NaN;
  }

  /** 기기의 현지 날짜(한국이면 한국 날짜) → day number. */
  function fromLocal(date) { return fromYMD(date.getFullYear(), date.getMonth() + 1, date.getDate()); }

  function parts(n) {
    var x = new Date(n * DAY_MS);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), w: x.getUTCDay() };
  }

  function pad(v) { return v < 10 ? '0' + v : String(v); }
  function toKey(n) { var p = parts(n); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  function label(n) { var p = parts(n); return p.m + '월 ' + p.d + '일'; }
  function full(n) { return label(n) + ' ' + DOW[parts(n).w] + '요일'; }
  /** 그 날이 속한 주의 일요일. */
  function weekStart(n) { return n - parts(n).w; }

  /** ISO 시각 → '오전 9:33' (기기 현지 시각). 이상한 값이면 ''. */
  function timeLabel(iso) {
    var t = new Date(iso);
    if (!iso || isNaN(t.getTime())) return '';
    var h = t.getHours();
    return (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + pad(t.getMinutes());
  }
  /** ISO 시각 → 그 시각의 현지 날짜(day number). 이상한 값이면 NaN. */
  function dayOfIso(iso) {
    var t = new Date(iso);
    return (!iso || isNaN(t.getTime())) ? NaN : fromLocal(t);
  }

  var api = { DOW: DOW, fromYMD: fromYMD, parse: parse, fromLocal: fromLocal, parts: parts, toKey: toKey, label: label, full: full, weekStart: weekStart, timeLabel: timeLabel, dayOfIso: dayOfIso };
  root.RT = root.RT || {};
  root.RT.dates = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
