/* 단짝 지도 (v48) — 함께 다녀온 곳 · 가고 싶은 곳 값 계산. 화면은 view-map.js, 상태 · 저장은 app.js · store.js.
   저장 places/{시군구코드} = { code, wishRank: number|null, wishNote, wishedAt, wishedBy, stars: { uid: 1..5 },
     visits: [{ id, date: 'YYYY-MM-DD', note, createdAt, createdBy }], updatedAt, updatedBy }
   단짝과 함께 다녀온 곳만 칠한다 (나 · 단짝 · 함께로 나누지 않음). 다녀온 날은 단짝이 된 날(couple/main.start)부터. */
(function (root) {
  'use strict';
  var NOTE_MAX = 100, VISITS_MAX = 100;
  var CODE_RE = /^\d{5}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function cleanNote(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX); }

  /** 저장된 문서 하나 → { code, visits(날짜 순), wishRank, wishNote, stars } | null */
  function fromDoc(code, doc) {
    if (!CODE_RE.test(code) || !doc) return null;
    var visits = (Array.isArray(doc.visits) ? doc.visits : []).filter(function (v) {
      return v && typeof v.date === 'string' && DATE_RE.test(v.date);
    }).map(function (v) {
      return { id: String(v.id || ''), date: v.date, note: typeof v.note === 'string' ? v.note : '', createdAt: v.createdAt || null, createdBy: v.createdBy || null };
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; });
    var stars = {};
    if (doc.stars && typeof doc.stars === 'object') Object.keys(doc.stars).forEach(function (u) { var s = doc.stars[u]; if (s >= 1 && s <= 5 && Math.round(s) === s) stars[u] = s; });
    return { code: code, visits: visits, wishRank: typeof doc.wishRank === 'number' && isFinite(doc.wishRank) ? doc.wishRank : null,
      wishNote: typeof doc.wishNote === 'string' ? doc.wishNote : '', stars: stars };
  }

  /** docs: { code: doc } → { code: place } */
  function fromDocs(docs) {
    var out = {};
    Object.keys(docs || {}).forEach(function (c) { var p = fromDoc(c, docs[c]); if (p) out[c] = p; });
    return out;
  }

  /** 칠하는 모양: '' (빈 곳) | 'v' (함께 다녀온 곳) | 'w' (가고 싶은 곳, 빗금) | 'vw' (다녀온 곳을 또 가고 싶은 곳으로) */
  function paint(p) {
    if (!p) return '';
    var v = p.visits.length > 0, w = p.wishRank !== null;
    return v && w ? 'vw' : v ? 'v' : w ? 'w' : '';
  }

  function counts(places) {
    var visited = 0, wished = 0;
    Object.keys(places).forEach(function (c) { var p = places[c]; if (p.visits.length) visited++; if (p.wishRank !== null) wished++; });
    return { visited: visited, wished: wished };
  }

  /** 함께 다녀온 곳이 있는 시·도 코드 목록 (시군구코드 앞 두 자리) */
  function visitedSidos(places) {
    var set = {};
    Object.keys(places).forEach(function (c) { if (places[c].visits.length) set[c.slice(0, 2)] = true; });
    return Object.keys(set).sort();
  }

  /** 다녀온 날 검사 → 오류 글 | ''. startKey = 단짝이 된 날(없으면 null), todayKey = 오늘 */
  function validateVisit(date, startKey, todayKey) {
    if (!DATE_RE.test(String(date || ''))) return '다녀온 날을 골라 주세요';
    if (date > todayKey) return '오늘이나 지난 날을 골라 주세요';
    if (startKey && date < startKey) return '단짝이 된 날(' + startKey + ')부터 고를 수 있어요';
    return '';
  }

  /** 방문 하나 더한 visits 배열 (오래된 순, 최대 VISITS_MAX — 넘치면 가장 오래된 것부터 뺌) */
  function withVisit(visits, v) {
    var out = (visits || []).concat([v]).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out.slice(Math.max(0, out.length - VISITS_MAX));
  }

  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; }
  /** 방문 하나 빼기 (v49 — 실수로 두 번 적은 기록 지우기) */
  function withoutVisit(visits, id) { return (visits || []).filter(function (v) { return v.id !== id; }); }
  /** 방문 하나 고치기 (날짜 · 메모) → 다시 날짜 순 */
  function withEdited(visits, id, date, note) {
    return (visits || []).map(function (v) { return v.id === id ? Object.assign({}, v, { date: date, note: note }) : v; }).sort(byDate);
  }

  // ── M3 (v50): 가고 싶은 곳 순위 · 다녀온 곳 별점 ──
  var GAP = 1000, MIN_GAP = 1e-6;

  /** 가고 싶은 곳 목록 (순위 키 → 같은 키면 코드 순 — 두 기기가 같은 키를 넣어도 번호가 겹치지 않게) */
  function wishList(places) {
    return Object.keys(places).map(function (c) { return places[c]; }).filter(function (p) { return p.wishRank !== null; })
      .sort(function (a, b) { return a.wishRank - b.wishRank || (a.code < b.code ? -1 : 1); });
  }

  /** list(키 순, 옮길 곳은 뺀 목록)의 idx 자리(0 = 맨 앞)에 넣을 키. { key, rebalance } — 간격이 너무 좁으면 rebalance */
  function keyAt(list, idx) {
    var prev = idx > 0 ? list[idx - 1].wishRank : null, next = idx < list.length ? list[idx].wishRank : null;
    var key = prev === null && next === null ? GAP : prev === null ? next - GAP : next === null ? prev + GAP : (prev + next) / 2;
    return { key: key, rebalance: prev !== null && next !== null && (next - prev < MIN_GAP * 2 || key <= prev || key >= next) };
  }

  /** 코드 순서대로 1000, 2000, … 다시 매기기 → { code: key } */
  function rebalance(codes) {
    var out = {}; codes.forEach(function (c, i) { out[c] = (i + 1) * GAP; }); return out;
  }

  /** 별점 평균 (둘이 각자, 한 사람만 매겼으면 그 점수) → number | null */
  function avgStars(p) {
    var vs = Object.keys(p.stars || {}).map(function (u) { return p.stars[u]; });
    return vs.length ? vs.reduce(function (a, b) { return a + b; }, 0) / vs.length : null;
  }

  /** 다녀온 곳 목록. sort: 'stars'(평균 → 횟수 → 최근, 안 매긴 곳은 뒤) | 'recent' | 'many' */
  function visitedList(places, sort) {
    var list = Object.keys(places).map(function (c) { return places[c]; }).filter(function (p) { return p.visits.length > 0; }).map(function (p) {
      return { code: p.code, place: p, count: p.visits.length, last: p.visits[p.visits.length - 1].date, avg: avgStars(p) };
    });
    function recent(a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : (a.code < b.code ? -1 : 1); }
    function many(a, b) { return b.count - a.count || recent(a, b); }
    list.sort(sort === 'recent' ? recent : sort === 'many' ? many : function (a, b) {
      if (a.avg === null || b.avg === null) return a.avg === null && b.avg === null ? many(a, b) : a.avg === null ? 1 : -1;
      return b.avg - a.avg || many(a, b);
    });
    return list;
  }

  /** 다녀온 곳 별점 순위 (1부터) | null (별점 없음) */
  function starRank(places, code) {
    var l = visitedList(places, 'stars'), i = l.map(function (x) { return x.code; }).indexOf(code);
    return i >= 0 && l[i].avg !== null ? i + 1 : null;
  }

  /** 반올림한 별 개수 (평균 4.5 → 5) */
  function starFill(avg) { return avg === null ? 0 : Math.min(5, Math.max(0, Math.round(avg))); }
  function avgText(avg) { return avg === null ? '' : (Math.round(avg * 10) / 10).toString(); }

  /** 지역 이름: 「전북 남원시」 (시·도 짧은 이름 + 시군구). map = 지도 데이터 */
  function fullName(map, code) {
    var r = regionOf(map, code);
    if (!r) return code;
    var g = (map.groups || []).filter(function (x) { return x.code === r.s; })[0];
    return (g ? g.short + ' ' : '') + r.n;
  }
  function regionOf(map, code) {
    if (!map) return null;
    if (!map._byCode) { map._byCode = {}; map.regions.forEach(function (r) { map._byCode[r.c] = r; }); }
    return map._byCode[code] || null;
  }

  /** 지역 찾기: 이름 일부(빈칸 무시)로. 시·도 이름(「전북」, 「전라북도」)도 맞춰 봄. 최대 n개 */
  function search(map, q, n) {
    var s = String(q || '').replace(/\s+/g, '');
    if (!s || !map) return [];
    var out = [];
    map.regions.forEach(function (r) {
      var g = (map.groups || []).filter(function (x) { return x.code === r.s; })[0] || { name: '', short: '' };
      var hay = (g.short + r.n).replace(/\s+/g, ''), hay2 = (g.name + r.n).replace(/\s+/g, '');
      var score = r.n.indexOf(s) === 0 ? 0 : r.n.indexOf(s) >= 0 ? 1 : hay.indexOf(s) >= 0 || hay2.indexOf(s) >= 0 ? 2 : -1;
      if (score >= 0) out.push({ code: r.c, name: (g.short ? g.short + ' ' : '') + r.n, score: score });
    });
    out.sort(function (a, b) { return a.score - b.score || (a.name < b.name ? -1 : 1); });
    return out.slice(0, n || 20);
  }

  /** 날짜 글: '2025-12-24' → 2025년 12월 24일 (올해면 연도 빼기) */
  function dateText(key, todayKey) {
    var y = key.slice(0, 4), m = +key.slice(5, 7), d = +key.slice(8, 10);
    return (todayKey && todayKey.slice(0, 4) === y ? '' : y + '년 ') + m + '월 ' + d + '일';
  }

  var api = { NOTE_MAX: NOTE_MAX, VISITS_MAX: VISITS_MAX, cleanNote: cleanNote, fromDoc: fromDoc, fromDocs: fromDocs, paint: paint, counts: counts,
    visitedSidos: visitedSidos, validateVisit: validateVisit, withVisit: withVisit, withoutVisit: withoutVisit, withEdited: withEdited, GAP: GAP, wishList: wishList, keyAt: keyAt, rebalance: rebalance, avgStars: avgStars, visitedList: visitedList, starRank: starRank, starFill: starFill, avgText: avgText, fullName: fullName, regionOf: regionOf, search: search, dateText: dateText };
  root.RT = root.RT || {};
  root.RT.places = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
