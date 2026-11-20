/* 단짝 영수증 · 한 달 요약 (docs/ledger/spec.md 5절) — 합계 · 사람별 금액과 % · 요약 한 줄 · 분류별 합계
   화면(단짝 영수증 · 전체 탭 카드)과 서버(월말결산 카드 9)가 함께 쓴다.
   ※ functions/ledger-sum.js 는 이 파일의 사본이다 (서버 함수는 functions 폴더만 올라가서).
     이 파일을 고치면 그대로 복사할 것 — tests/ledger.test.js 가 두 파일이 같은지 확인한다.
   spends: [{ date, amount, paidBy: uid | 'both', shares?: { uid: number }, cat }] */
(function (root) {
  'use strict';

  /** 분류 — 칩 순서(화면): 식사 · 카페 · 교통 · 숙소 · 놀거리 · 장보기 · 기타 */
  var CATS = ['meal', 'cafe', 'move', 'stay', 'play', 'shop', 'etc'];
  var CAT_LABEL = { meal: '식사', cafe: '카페', move: '교통', stay: '숙소', play: '놀거리', shop: '장보기', etc: '기타' };

  /** 정수에 쉼표 (기기 글꼴 · 언어 설정과 상관없이 같게) */
  function comma(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /** "446,200원" */
  function won(v) { return comma(v) + '원'; }
  /** "22.1만 원" — 1만 원 이상은 만 단위 소수 한 자리(.0 은 뺌), 아래는 "8,000원" */
  function manWon(v) {
    if (v < 10000) return won(v);
    var tenth = Math.round(v / 1000); // 0.1만 단위
    var whole = Math.floor(tenth / 10);
    var dec = tenth % 10;
    return comma(whole) + (dec ? '.' + dec : '') + '만 원';
  }

  /** 받침이 있으면 '이', 없으면 '가' (숫자 · 영문 끝은 '이') */
  function iGa(name) {
    var ch = String(name).charCodeAt(String(name).length - 1);
    if (ch >= 0xac00 && ch <= 0xd7a3) return (ch - 0xac00) % 28 === 0 ? '가' : '이';
    return '이';
  }

  /** 기록 하나에서 사람별로 낸 돈 */
  function paidByPerson(spend, uids) {
    var out = {};
    uids.forEach(function (u) { out[u] = 0; });
    if (spend.paidBy === 'both') {
      uids.forEach(function (u) { out[u] += (spend.shares && spend.shares[u]) || 0; });
    } else if (out[spend.paidBy] !== undefined) {
      out[spend.paidBy] += spend.amount;
    }
    return out;
  }

  /** 두 사람 % — 반올림하고 합은 늘 100. 합계 0이면 null */
  function percents(a, b) {
    var t = a + b;
    if (t === 0) return null;
    var pa = Math.round(a / t * 100);
    return [pa, 100 - pa];
  }

  /** 직접 만든 분류 (spendCats) 아이디 모양 */
  var CUSTOM_RE = /^c[a-z0-9]{2,23}$/;
  /** 분류 순서: 기본 6개 → 직접 만든 분류 → 기타. extra = [{ id, label }] */
  function catOrder(extra) {
    return CATS.slice(0, -1).concat((extra || []).map(function (c) { return c.id; })).concat(['etc']);
  }
  function catLabels(extra) {
    var out = {};
    CATS.forEach(function (c) { out[c] = CAT_LABEL[c]; });
    (extra || []).forEach(function (c) { out[c.id] = c.label; });
    return out;
  }
  /** 기록의 분류 → 지금 있는 분류 (지운 분류 · 모르는 값은 기타) */
  function catOf(cat, extra) { return catLabels(extra)[cat] ? cat : 'etc'; }

  /**
   * @param spends 그 달 기록
   * @param people { me: {uid, name}, partner: {uid, name} } — me = 화면을 보는 사람(왼쪽)
   * @param extra  직접 만든 분류 [{ id, label }] (없으면 기본 7개만)
   */
  function monthSummary(spends, people, extra) {
    var ua = people.me.uid, ub = people.partner.uid;
    var a = 0, b = 0, total = 0;
    var order = catOrder(extra), labels = catLabels(extra);
    var byCat = {};
    order.forEach(function (c) { byCat[c] = 0; });
    spends.forEach(function (s) {
      total += s.amount;
      var p = paidByPerson(s, [ua, ub]);
      a += p[ua]; b += p[ub];
      byCat[catOf(s.cat, extra)] += s.amount;
    });
    var pct = percents(a, b);
    var diff = a - b;
    var line;
    if (total === 0) line = '아직 이번 달 기록이 없어요';
    else if (diff === 0) line = '이번 달은 똑같이 냈어요';
    else {
      var who = diff > 0 ? people.me.name : people.partner.name;
      line = '이번 달은 ' + who + iGa(who) + ' ' + won(Math.abs(diff)) + ' 더 냈어요';
    }
    var cats = order.filter(function (c) { return byCat[c] > 0; })
      .sort(function (x, y) { return byCat[y] - byCat[x] || order.indexOf(x) - order.indexOf(y); })
      .map(function (c) { return { cat: c, label: labels[c], amount: byCat[c], text: labels[c] + ' ' + manWon(byCat[c]) }; });
    return {
      total: total, totalText: won(total),
      me: { amount: a, pct: pct ? pct[0] : 0, text: manWon(a) },
      partner: { amount: b, pct: pct ? pct[1] : 0, text: manWon(b) },
      diff: diff, line: line, cats: cats,
      topCat: cats.length ? cats[0].cat : null
    };
  }

  var api = { CATS: CATS, CAT_LABEL: CAT_LABEL, CUSTOM_RE: CUSTOM_RE, catOrder: catOrder, catLabels: catLabels, catOf: catOf, comma: comma, won: won, manWon: manWon, iGa: iGa, paidByPerson: paidByPerson, percents: percents, monthSummary: monthSummary };
  root.RT = root.RT || {};
  root.RT.ledgerSum = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
