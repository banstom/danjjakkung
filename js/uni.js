/* u&I — 할 일을 급한 정도(u, 가로) × 중요한 정도(i, 세로) 평면에 놓는 계산. 화면 없음.
   위치는 사람마다 todos/<id>.ui[<uid>] = { u, i, at } — 사용자가 놓은 값(raw 0~1)만 저장하고,
   화면 좌표는 그릴 때마다 계산한다: 적을 땐 놓은 자리 그대로, 많아질수록 순위대로 고르게. */
(function (root) {
  'use strict';

  var SHORT = 7; // 블록 이름 글자 수

  /** 섞는 비율: 1개면 놓은 자리 그대로(1), 많아질수록 순위 쪽으로 */
  function weight(n) { return n <= 1 ? 1 : 1 / (1 + (n - 1) / 3); }

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /**
   * 한 축 화면 좌표.
   * items: [{ id, raw, createdAt }] → { <id>: { pos: 0~1, rank: 0부터 (작은 쪽부터) } }
   * 같은 raw 는 먼저 만든 것이 앞.
   */
  function axis(items) {
    var n = items.length, w = weight(n), out = {};
    var sorted = items.slice().sort(function (a, b) {
      return a.raw - b.raw || cmp(a.createdAt || '', b.createdAt || '') || cmp(a.id, b.id);
    });
    sorted.forEach(function (it, k) {
      out[it.id] = { pos: w * clamp(it.raw) + (1 - w) * (k + 0.5) / n, rank: k };
    });
    return out;
  }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /**
   * 평면에 올릴 할 일 → 좌표 · 순위.
   * tasks: [{ id, createdAt, place: { u, i } }]
   * → [{ id, x, y, urgentRank, importantRank, n }]  (Rank: 1 = 가장 급함 · 가장 중요함)
   */
  function layout(tasks) {
    var n = tasks.length;
    var X = axis(tasks.map(function (t) { return { id: t.id, raw: t.place.u, createdAt: t.createdAt }; }));
    var Y = axis(tasks.map(function (t) { return { id: t.id, raw: t.place.i, createdAt: t.createdAt }; }));
    return tasks.map(function (t) {
      return { id: t.id, x: X[t.id].pos, y: Y[t.id].pos, urgentRank: n - X[t.id].rank, importantRank: n - Y[t.id].rank, n: n };
    });
  }

  /**
   * 축 놓기 화면의 선: 다른 할 일들 → 선 위 자리 (작은 값부터).
   * others: [{ id, raw, createdAt, ... }] → [{ ...그대로, pos }]
   */
  function line(others) {
    var A = axis(others);
    return others.slice().sort(function (a, b) { return A[a.id].pos - A[b.id].pos; })
      .map(function (o) { return Object.assign({}, o, { pos: A[o.id].pos }); });
  }

  /** 선 위 화면 자리 p 의 바로 아래(L) · 위(R) 이웃 (line() 결과에서). 없으면 null */
  function neighbors(p, ln) {
    var lo = null, hi = null;
    for (var k = 0; k < ln.length; k++) {
      if (ln[k].pos <= p) lo = ln[k]; else { hi = ln[k]; break; }
    }
    return { below: lo, above: hi };
  }

  /**
   * 놓은 화면 자리 p → 저장할 raw.
   * 이웃 둘의 화면 좌표 사이에서 p 가 차지하는 비율을 두 이웃의 raw 사이에 그대로 쓴다. 끝에서는 0 · 1 쪽으로.
   */
  function rawFrom(p, ln) {
    p = clamp(p);
    if (!ln.length) return p;
    var nb = neighbors(p, ln), L = nb.below, R = nb.above;
    var l = L ? { pos: L.pos, raw: clamp(L.raw) } : { pos: 0, raw: 0 };
    var r = R ? { pos: R.pos, raw: clamp(R.raw) } : { pos: 1, raw: 1 };
    if (r.pos - l.pos <= 1e-9) return clamp(l.raw);
    return clamp(l.raw + (r.raw - l.raw) * (p - l.pos) / (r.pos - l.pos));
  }

  /** 줄 세운 다른 할 일 사이 k 번째 틈(0 = 맨 아래, n = 맨 위)의 화면 자리 */
  function slotPos(k, ln) {
    var n = ln.length;
    if (!n) return 0.5;
    var lo = k <= 0 ? 0 : ln[k - 1].pos, hi = k >= n ? 1 : ln[k].pos;
    return (lo + hi) / 2;
  }
  /** 화면 자리 p 가 몇 번째 틈인지 */
  function slotOf(p, ln) {
    var k = 0;
    while (k < ln.length && ln[k].pos <= p) k++;
    return k;
  }

  // ── 위치 추천 받기: 이진 삽입 ──
  /** 최대 질문 수 */
  function maxAsk(n) { return n <= 0 ? 0 : Math.ceil(Math.log2(n + 1)); }
  function askStart(n) { return { lo: 0, hi: n, step: 1, at: null }; }
  /** 지금 비교할 할 일의 순서 (ln 에서), 다 물었으면 -1 */
  function askPivot(s) { return askDone(s) ? -1 : Math.floor((s.lo + s.hi) / 2); }
  function askDone(s) { return s.at !== null || s.lo >= s.hi; }
  /**
   * 답: 'yes'(새 할 일이 더 큼) · 'no'(더 작음) · 'same'(비슷함 → 바로 옆)
   * → 다음 상태
   */
  function askAnswer(s, ans) {
    var mid = askPivot(s);
    if (mid < 0) return s;
    if (ans === 'same') return { lo: s.lo, hi: s.hi, step: s.step, at: mid + 1 };
    if (ans === 'yes') return { lo: mid + 1, hi: s.hi, step: s.step + 1, at: null };
    return { lo: s.lo, hi: mid, step: s.step + 1, at: null };
  }
  /** 끝났을 때 들어갈 틈 (0 = 맨 아래) */
  function askSlot(s) { return s.at !== null ? s.at : s.lo; }

  /**
   * 「A보다 급하고 B보다 덜 급해요」
   * words: { more: '급하고', less: '덜 급해요', top: '가장 급해요', bottom: '가장 덜 급해요' } (축마다)
   */
  var WORDS = {
    u: { more: '급하고', moreEnd: '급해요', less: '덜 급해요', top: '지금 할 일 중 가장 급해요', bottom: '지금 할 일 중 가장 덜 급해요', ask: '더 급해요?' },
    i: { more: '중요하고', moreEnd: '중요해요', less: '덜 중요해요', top: '지금 할 일 중 가장 중요해요', bottom: '지금 할 일 중 가장 덜 중요해요', ask: '더 중요해요?' }
  };
  function describe(p, ln, ax) {
    var W = WORDS[ax] || WORDS.u;
    if (!ln.length) return '';
    var nb = neighbors(p, ln);
    if (!nb.below) return W.bottom;
    if (!nb.above) return W.top;
    return { below: nb.below.title, above: nb.above.title, more: W.more, less: W.less };
  }

  function short(title) {
    var s = String(title || '');
    var chars = Array.from(s);
    return chars.length > SHORT ? chars.slice(0, SHORT).join('') + '…' : s;
  }

  /** 저장된 위치를 믿을 수 있는 값만 */
  function cleanPlace(v) {
    if (!v || typeof v !== 'object') return null;
    var u = Number(v.u), i = Number(v.i);
    if (!isFinite(u) || !isFinite(i) || u < 0 || u > 1 || i < 0 || i > 1) return null;
    return { u: u, i: i, at: typeof v.at === 'string' ? v.at : '' };
  }
  function cleanUi(ui) {
    var out = {};
    if (!ui || typeof ui !== 'object') return out;
    Object.keys(ui).forEach(function (k) { var p = cleanPlace(ui[k]); if (p) out[k] = p; });
    return out;
  }

  /** 사분면: 'now'(급함 · 중요) · 'plan'(중요) · 'quick'(급함) · 'later' */
  function quadrant(x, y) { return y >= 0.5 ? (x >= 0.5 ? 'now' : 'plan') : (x >= 0.5 ? 'quick' : 'later'); }

  var api = { SHORT: SHORT, WORDS: WORDS, weight: weight, axis: axis, layout: layout, line: line, neighbors: neighbors, rawFrom: rawFrom, slotPos: slotPos, slotOf: slotOf,
    maxAsk: maxAsk, askStart: askStart, askPivot: askPivot, askDone: askDone, askAnswer: askAnswer, askSlot: askSlot, describe: describe, short: short,
    cleanPlace: cleanPlace, cleanUi: cleanUi, quadrant: quadrant };
  root.RT = root.RT || {};
  root.RT.uni = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
