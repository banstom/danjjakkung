/* 단짝 지도 (v48) — 함께 다녀온 곳 · 가고 싶은 곳 값 계산. 화면은 view-map.js, 상태 · 저장은 app.js · store.js.
   저장 places/{시군구코드} = { code, wishRank: number|null, wishNote, wishedAt, wishedBy,
     visits: [{ id, date: 'YYYY-MM-DD', createdAt, createdBy }],
     entries: { <uid>: { <visitId>: { stars: 1..5 | null, note, at } } },   ← v54: 방문마다 각자 별점 + 한 줄
     updatedAt, updatedBy }
   v54 전에는 지역에 한 번 매기는 stars: { uid: n } 와 visits[].note 가 있었다 — 읽을 땐 entries 로 옮겨 보고(legacyFold),
   저장할 땐 지운다. 한 번에 옮기는 스크립트는 scripts/migrate-place-entries.js.
   entries 를 사람 기준으로 두는 이유: 규칙이 배열 안을 하나씩 못 봐서, visits[] 안에 두면 「자기 것만 고치기」를 못 막는다.
   단짝과 함께 다녀온 곳만 칠한다 (나 · 단짝 · 함께로 나누지 않음). 다녀온 날은 단짝이 된 날(couple/main.start)부터. */
(function (root) {
  'use strict';
  var NOTE_MAX = 100, VISITS_MAX = 100;
  var CODE_RE = /^\d{5}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function cleanNote(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX); }

  function cleanStars(n) { return typeof n === 'number' && n >= 1 && n <= 5 && Math.round(n) === n ? n : null; }
  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; }

  /** v54 옮기기 — 옛 문서(지역 stars · visits[].note) → entries. 순수 함수: 앱이 읽을 때와 옮기기 스크립트가 같이 쓴다.
      옛 stars.<uid> → 가장 최근 방문의 entries.<uid>, 옛 visits[].note → 만든 사람(createdBy)의 칸. 이미 그 칸에 값이 있으면 그대로 둔다.
      돌려주는 값에는 stars 와 visits[].note 가 없다. */
  function legacyFold(doc) {
    var d = Object.assign({}, doc || {});
    var visits = (Array.isArray(d.visits) ? d.visits : []).filter(function (v) { return v && typeof v === 'object'; });
    var entries = {};
    Object.keys(d.entries && typeof d.entries === 'object' ? d.entries : {}).forEach(function (u) {
      var m = d.entries[u]; if (!m || typeof m !== 'object') return;
      entries[u] = {}; Object.keys(m).forEach(function (vid) { if (m[vid] && typeof m[vid] === 'object') entries[u][vid] = Object.assign({}, m[vid]); });
    });
    function slot(u, vid) { entries[u] = entries[u] || {}; return entries[u][vid] = entries[u][vid] || { stars: null, note: '', at: null }; }
    visits.forEach(function (v) {
      var note = typeof v.note === 'string' ? cleanNote(v.note) : '';
      if (note && v.createdBy && v.id) { var e = slot(v.createdBy, v.id); if (!e.note) { e.note = note; e.at = e.at || v.createdAt || null; } }
    });
    var sorted = visits.filter(function (v) { return v.id && DATE_RE.test(String(v.date || '')); }).slice().sort(byDate), last = sorted[sorted.length - 1];
    if (d.stars && typeof d.stars === 'object' && last) Object.keys(d.stars).forEach(function (u) {
      var n = cleanStars(d.stars[u]); if (n === null) return;
      var e = slot(u, last.id); if (cleanStars(e.stars) === null) { e.stars = n; e.at = e.at || null; }
    });
    d.visits = visits.map(function (v) { var o = Object.assign({}, v); delete o.note; return o; });
    d.entries = entries;
    delete d.stars;
    return d;
  }
  /** 옮길 게 남았는지 (스크립트 · 테스트용) */
  function needsFold(doc) {
    return !!(doc && ((doc.stars && typeof doc.stars === 'object') || (Array.isArray(doc.visits) && doc.visits.some(function (v) { return v && 'note' in v; }))));
  }

  /** 저장된 문서 하나 → { code, visits(날짜 순), wishRank, wishNote, entries: { uid: { visitId: { stars|null, note } } } } | null
      entries 는 지금 있는 방문 것만 남긴다 (지운 방문의 기록이 남아 있어도 평균에 안 들어가게) */
  function fromDoc(code, raw) {
    if (!CODE_RE.test(code) || !raw) return null;
    var doc = needsFold(raw) ? legacyFold(raw) : raw;
    var visits = (Array.isArray(doc.visits) ? doc.visits : []).filter(function (v) {
      return v && typeof v.date === 'string' && DATE_RE.test(v.date);
    }).map(function (v) {
      return { id: String(v.id || ''), date: v.date, createdAt: v.createdAt || null, createdBy: v.createdBy || null };
    }).sort(byDate);
    var ids = {}; visits.forEach(function (v) { ids[v.id] = true; });
    var entries = {};
    if (doc.entries && typeof doc.entries === 'object') Object.keys(doc.entries).forEach(function (u) {
      var m = doc.entries[u]; if (!m || typeof m !== 'object') return;
      Object.keys(m).forEach(function (vid) {
        var e = m[vid]; if (!ids[vid] || !e || typeof e !== 'object') return;
        var st = cleanStars(e.stars), note = typeof e.note === 'string' ? e.note : '';
        if (st === null && !note) return;
        (entries[u] = entries[u] || {})[vid] = { stars: st, note: note };
      });
    });
    return { code: code, visits: visits, wishRank: typeof doc.wishRank === 'number' && isFinite(doc.wishRank) ? doc.wishRank : null,
      wishNote: typeof doc.wishNote === 'string' ? doc.wishNote : '', entries: entries };
  }
  /** 한 사람 · 한 방문의 기록 | null */
  function entryOf(p, uid, vid) { return (p && p.entries && p.entries[uid] && p.entries[uid][vid]) || null; }

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

  /** 방문 하나 빼기 (v49 — 실수로 두 번 적은 기록 지우기) */
  function withoutVisit(visits, id) { return (visits || []).filter(function (v) { return v.id !== id; }); }

  // ── v54: 방문마다 각자 별점 + 한 줄. 저장할 새 문서를 만든다(지금 저장된 값 cur → next). app.js 가 트랜잭션 안에서 부른다 ──
  /** 저장할 기록 하나 | null(비었으면 — 칸을 지움) */
  function cleanEntry(stars, note, at) {
    var st = cleanStars(stars), n = cleanNote(note);
    return st === null && !n ? null : { stars: st, note: n, at: at };
  }
  function baseNext(cur) {
    var d = legacyFold(cur || {});
    return Object.assign({}, d, { visits: d.visits.slice(), entries: d.entries });
  }
  /** 내 칸 하나 넣기 · 지우기 (entry = cleanEntry 결과, null 이면 지움). 다른 사람 칸은 건드리지 않는다 */
  function putEntry(entries, uid, vid, entry) {
    var out = Object.assign({}, entries || {}), mine = Object.assign({}, out[uid] || {});
    if (entry) mine[vid] = entry; else delete mine[vid];
    if (Object.keys(mine).length) out[uid] = mine; else delete out[uid];
    return out;
  }
  /** 새 방문 (visit = { id, date, createdAt, createdBy }) + 내 기록(없어도 됨). 100개를 넘으면 가장 오래된 방문과 그 기록을 뺀다 */
  function addVisit(cur, visit, uid, entry) {
    var next = baseNext(cur);
    next.visits = withVisit(next.visits, visit);
    var keep = {}; next.visits.forEach(function (v) { keep[v.id] = true; });
    var ent = {};
    Object.keys(next.entries).forEach(function (u) {
      var m = {}; Object.keys(next.entries[u]).forEach(function (vid) { if (keep[vid]) m[vid] = next.entries[u][vid]; });
      if (Object.keys(m).length) ent[u] = m;
    });
    next.entries = putEntry(ent, uid, visit.id, entry);
    return next;
  }
  /** 내 기록 고치기 */
  function setEntry(cur, uid, vid, entry) {
    var next = baseNext(cur);
    next.entries = putEntry(next.entries, uid, vid, entry);
    return next;
  }
  /** 방문 지우기 — 두 사람 기록도 함께 */
  function removeVisit(cur, vid) {
    var next = baseNext(cur);
    next.visits = withoutVisit(next.visits, vid);
    var ent = {};
    Object.keys(next.entries).forEach(function (u) { var m = Object.assign({}, next.entries[u]); delete m[vid]; if (Object.keys(m).length) ent[u] = m; });
    next.entries = ent;
    return next;
  }
  /** 저장 전 정리: 옛 칸을 지운 모양 (가고 싶은 곳 · 순위만 바꿀 때도 — 규칙이 옛 칸을 받지 않는다) */
  function tidy(cur) { return baseNext(cur); }

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

  /** 모든 별점 (방문 · 사람 구분 없이) → [{ uid, vid, stars }] */
  function allStars(p) {
    var out = [];
    Object.keys((p && p.entries) || {}).forEach(function (u) {
      Object.keys(p.entries[u]).forEach(function (vid) { var st = p.entries[u][vid].stars; if (st) out.push({ uid: u, vid: vid, stars: st }); });
    });
    return out;
  }
  function mean(list) { return list.length ? list.reduce(function (a, b) { return a + b.stars; }, 0) / list.length : null; }
  /** 지역 별점 = 그 지역의 모든 별점 평균 (단순 평균) → number | null */
  function avgStars(p) { return mean(allStars(p)); }
  /** 한 사람의 평균과 매긴 횟수 → { avg: number | null, n } */
  function personStars(p, uid) {
    var l = allStars(p).filter(function (x) { return x.uid === uid; });
    return { avg: mean(l), n: l.length };
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
    visitedSidos: visitedSidos, validateVisit: validateVisit, withVisit: withVisit, withoutVisit: withoutVisit,
    legacyFold: legacyFold, needsFold: needsFold, entryOf: entryOf, cleanEntry: cleanEntry, addVisit: addVisit, setEntry: setEntry, removeVisit: removeVisit, tidy: tidy, allStars: allStars, personStars: personStars, GAP: GAP, wishList: wishList, keyAt: keyAt, rebalance: rebalance, avgStars: avgStars, visitedList: visitedList, starRank: starRank, starFill: starFill, avgText: avgText, fullName: fullName, regionOf: regionOf, search: search, dateText: dateText };
  root.RT = root.RT || {};
  root.RT.places = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
