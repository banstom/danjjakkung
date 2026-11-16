/* 우리 기념일 (v46) — 두 사람이 어떤 관계를 시작한 지 며칠째인지, 다가오는 · 지난 기념일.
   저장 couple/main = { start: 'YYYY-MM-DD', label: '사귄 지', updatedBy, updatedAt } — 둘이 같은 값, 둘 다 고칠 수 있다.
   세는 법: 시작한 날 = 1일 (한국 커플식). 100일 = 시작일 + 99일.
   기념일: 100일 단위(100 · 200 · … · 1000 · …) + 해마다 같은 날(1주년 · 2주년 …). 2월 29일에 시작했으면 평년엔 2월 28일. */
(function (root) {
  'use strict';
  var D = root.RT && root.RT.dates ? root.RT.dates : (typeof require === 'function' ? require('./dates.js') : null);

  var LABEL_MAX = 8;
  var PRESETS = ['사귄 지', '만난 지', '함께한 지', '결혼한 지'];
  var DEFAULT_LABEL = '사귄 지';
  var MIN_YEAR = 1950;

  function cleanLabel(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

  /** 저장된 값 → { start(day number), startKey, label, updatedBy, updatedAt } | null (없거나 이상하면 null) */
  function fromDoc(doc) {
    if (!doc || typeof doc.start !== 'string') return null;
    var n = D.parse(doc.start);
    if (isNaN(n)) return null;
    var label = cleanLabel(doc.label);
    if (!label || label.length > LABEL_MAX) label = DEFAULT_LABEL;
    return { start: n, startKey: doc.start, label: label, updatedBy: typeof doc.updatedBy === 'string' ? doc.updatedBy : null, updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : null };
  }

  /** 오늘이 며칠째 (시작한 날 = 1일). 시작 전이면 0 이하. */
  function dayCount(start, today) { return today - start + 1; }

  /** 시작일에서 k년 뒤 같은 날 (2월 29일 → 평년엔 2월 28일) */
  function yearsAfter(start, k) {
    var p = D.parts(start), y = p.y + k;
    var n = D.fromYMD(y, p.m, p.d);
    if (D.parts(n).m !== p.m) n = D.fromYMD(y, p.m + 1, 0); // 그 달의 마지막 날
    return n;
  }

  function comma(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function hundredName(n) { return comma(n) + '일'; }

  /** [from, to] 날짜 안의 기념일을 날짜 순으로 [{ day, name, kind: 'days' | 'year', n }] — 같은 날이면 주년을 앞에 */
  function between(start, from, to) {
    var out = [];
    if (to < from) return out;
    // 100일 단위: day = start + n − 1
    var n0 = Math.max(1, Math.ceil((from - start + 1) / 100));
    for (var n = n0; ; n++) {
      var d = start + n * 100 - 1;
      if (d > to) break;
      if (d >= from) out.push({ day: d, name: hundredName(n * 100), kind: 'days', n: n * 100 });
    }
    var p0 = D.parts(start), k0 = Math.max(1, D.parts(from).y - p0.y - 1);
    for (var k = k0; ; k++) {
      var y = yearsAfter(start, k);
      if (y > to) break;
      if (y >= from) out.push({ day: y, name: k + '주년', kind: 'year', n: k });
    }
    out.sort(function (a, b) { return a.day - b.day || (a.kind === 'year' ? -1 : 1); });
    return out;
  }

  /** 오늘부터 앞으로 n개 (오늘 것 포함) */
  function upcoming(start, today, n) {
    var from = Math.max(today, start), out = [], span = 400;
    while (out.length < n && span < 400 * 50) {
      out = between(start, from, from + span);
      span *= 2;
    }
    return out.slice(0, n);
  }

  /** 어제까지 지난 것 중 최근 n개 (최근 것부터) */
  function past(start, today, n) {
    var to = today - 1;
    if (to < start) return [];
    var span = 400, out = [];
    while (out.length < n && span < 400 * 50) {
      out = between(start, Math.max(start, to - span), to);
      if (to - span <= start) break;
      span *= 2;
    }
    return out.slice(-n).reverse();
  }

  /** D-day 글자: 0 → '오늘', 1 → 'D-1' */
  function dLabel(d, today) { var g = d - today; return g === 0 ? '오늘' : g > 0 ? 'D-' + g : 'D+' + (-g); }

  function fullDate(n) { var p = D.parts(n); return p.y + '년 ' + p.m + '월 ' + p.d + '일'; }

  /** 화면에 쓸 값. a = fromDoc 결과 */
  function build(a, today) {
    if (!a) return null;
    var count = dayCount(a.start, today);
    if (count < 1) return { future: true, label: a.label, startText: fullDate(a.start), dText: dLabel(a.start, today) };
    var next = upcoming(a.start, today, 4).map(function (m) { return { name: m.name, kind: m.kind, date: fullDate(m.day) + ' ' + D.DOW[D.parts(m.day).w], d: dLabel(m.day, today), today: m.day === today }; });
    var todayOne = next.filter(function (m) { return m.today; })[0] || null;
    var yrs = 0; while (yearsAfter(a.start, yrs + 1) <= today) yrs++;
    return {
      label: a.label, count: count, countText: comma(count),
      line: a.label + ' ' + comma(count) + '일',
      startText: fullDate(a.start), years: yrs,
      today: todayOne ? todayOne.name : null,
      next: next.filter(function (m) { return !m.today; }).slice(0, 3),
      past: past(a.start, today, 3).map(function (m) { return { name: m.name, date: fullDate(m.day) }; })
    };
  }

  /** 폼 검사 → 오류 글 | '' */
  function validate(f, today) {
    var label = cleanLabel(f.label);
    if (!label) return '관계 이름을 적어 주세요';
    if (label.length > LABEL_MAX) return '관계 이름은 ' + LABEL_MAX + '자까지예요';
    var n = D.parse(f.start);
    if (isNaN(n)) return '시작한 날을 골라 주세요';
    if (D.parts(n).y < MIN_YEAR) return MIN_YEAR + '년 뒤의 날을 골라 주세요';
    if (n > today) return '오늘이나 지난 날을 골라 주세요';
    return '';
  }

  var api = { LABEL_MAX: LABEL_MAX, PRESETS: PRESETS, DEFAULT_LABEL: DEFAULT_LABEL, cleanLabel: cleanLabel, fromDoc: fromDoc, dayCount: dayCount, yearsAfter: yearsAfter,
    between: between, upcoming: upcoming, past: past, dLabel: dLabel, fullDate: fullDate, build: build, validate: validate };
  root.RT = root.RT || {};
  root.RT.anniv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
