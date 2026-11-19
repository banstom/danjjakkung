/* 단짝 영수증 · 한 줄 읽기 (docs/ledger/spec.md 3절) — AI 없이 앱 코드로만.
   예: "저녁 42000 내가" · "ktx 5.98만 단짝" · "숙소 12만 반반" · "내가 7만 단짝 5만 숙소" · "어제 카페 9800"
   띄어쓰기로 낱말을 나눈 뒤 날짜 → 금액 → 누가 순서로 낱말을 가져가고, 남은 낱말이 「무엇」.
   화면 쪽 사람은 'me'(적는 사람) / 'partner'. uid 로 바꾸는 일은 저장 직전 한 곳에서만. */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var L = NODE ? require('./ledger-sum.js') : root.RT.ledgerSum;

  var AMOUNT_MAX = 100000000; // 1억 원 미만만

  // ── 금액 낱말 ── 낱말 전체가 금액 모양일 때만 ("천안"은 금액이 아님)
  var KO_DIGIT = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
  var KO_SMALL = { 십: 10, 백: 100, 천: 1000 };
  // 숫자(소수 가능) + 단위 묶음: 12만5천, 5.98만, 42,000
  var NUM_RE = /^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(?:(\d+(?:\.\d+)?)천)?(\d{1,3}(?:,\d{3})+|\d+)?원?$/;

  function digitForm(tok) {
    var m = NUM_RE.exec(tok);
    if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined && m[4] === undefined)) return null;
    var v = 0;
    if (m[1] !== undefined) v += Number(m[1]) * 100000000;
    if (m[2] !== undefined) v += Number(m[2]) * 10000;
    if (m[3] !== undefined) v += Number(m[3]) * 1000;
    if (m[4] !== undefined) v += Number(m[4].replace(/,/g, ''));
    return Math.round(v);
  }

  // 한글 수: 오만, 만오천, 삼천오백원, 십만, 이십만
  function koreanForm(tok) {
    var t = tok.replace(/원$/, '');
    if (!t || !/^[일이삼사오육칠팔구십백천만]+$/.test(t)) return null;
    if (!/[십백천만]/.test(t)) return null; // "이" "오" 같은 한 글자는 금액 아님
    var total = 0, section = 0, digit = 0;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (KO_DIGIT[ch] !== undefined) {
        if (digit) return null; // "오오"
        digit = KO_DIGIT[ch];
      } else if (KO_SMALL[ch] !== undefined) {
        section += (digit || 1) * KO_SMALL[ch];
        digit = 0;
      } else if (ch === '만') {
        section += digit;
        total += (section || 1) * 10000;
        section = 0; digit = 0;
      }
    }
    return total + section + digit;
  }

  /** 낱말 하나 → 금액(원) 또는 null. 단위 없는 맨 숫자는 100 이상만 */
  function amountOf(tok) {
    if (!tok) return null;
    var t = String(tok).replace(/₩/g, '');
    var v = digitForm(t);
    if (v === null) v = koreanForm(t);
    if (v === null || !isFinite(v) || v <= 0) return null;
    if (/^\d+$/.test(t) && v < 100) return null;
    return v;
  }

  // ── 누가 ── 조사(이 · 가 · 이가 · 는 · 은 · 님)는 떼고 본다
  var ME = ['내가', '나', '내', '제가', '저', '나가', '내돈'];
  var PARTNER = ['단짝', '너', '니가', '네가', '자기', '자기가'];
  var BOTH = ['반반', '나눠', '나눔', '나눠서', '둘이', '같이', '더치', '더치페이', 'n빵', '엔빵', '1/n'];
  var JOSA = /(이가|님이|님|이|가|는|은|이는)$/;

  /** 낱말(소문자) → 'me' | 'partner' | 'both' | null. who = { meName, partnerName } */
  function payerOf(tok, who) {
    var meName = who.meName ? String(who.meName).toLowerCase() : '';
    var partnerName = who.partnerName ? String(who.partnerName).toLowerCase() : '';
    if (BOTH.indexOf(tok) >= 0) return 'both';
    if (ME.indexOf(tok) >= 0) return 'me';
    if (PARTNER.indexOf(tok) >= 0) return 'partner';
    // 이름 자체가 '이'로 끝날 수 있어서(예: 수이) 이름과 똑같으면 조사를 떼지 않는다
    var base = (tok === meName || tok === partnerName) ? tok : tok.replace(JOSA, '');
    if (ME.indexOf(base) >= 0) return 'me';
    if (PARTNER.indexOf(base) >= 0) return 'partner';
    if (meName && base === meName) return 'me';
    if (partnerName && base === partnerName) return 'partner';
    return null;
  }

  // ── 분류 ── 낱말 목록으로만, 위에서부터 먼저 맞는 것 (카페 → 식사: "브런치 카페"는 카페, 숙소 → 교통: "호텔 셔틀"은 숙소)
  var WORDS = [
    ['cafe', ['카페', '커피', '라떼', '아메리카노', '디저트', '케이크', '빙수', '마카롱', '베이커리', '빵집', '스벅', '스타벅스', '투썸', '이디야']],
    ['stay', ['숙소', '호텔', '모텔', '펜션', '에어비앤비', '에어비엔비', '게하', '게스트하우스', '리조트', '캠핑장', '글램핑', '한옥스테이']],
    ['move', ['ktx', 'srt', '기차', '열차', '버스', '택시', '지하철', '주유', '기름', '톨게이트', '통행료', '하이패스', '주차', '비행기', '항공', '렌트', '렌터카', '쏘카', '배편', '페리', '카카오t']],
    ['play', ['영화', '전시', '공연', '콘서트', '뮤지컬', '놀이공원', '롯데월드', '에버랜드', '입장', '입장료', '티켓', '방탈출', '노래방', '코인노래방', '볼링', '오락실', '케이블카', '체험', '수족관', '아쿠아리움', '미술관', '박물관']],
    ['shop', ['장보기', '마트', '편의점', '이마트', '홈플러스', '롯데마트', '코스트코', '쿠팡', '컬리', '시장', '다이소']],
    ['meal', ['저녁', '점심', '아침', '밥', '식사', '브런치', '야식', '고기', '삼겹살', '갈비', '치킨', '피자', '회', '물회', '횟집', '국밥', '라멘', '라면', '초밥', '스시', '파스타', '떡볶이', '분식', '술', '맥주', '소주', '와인', '이자카야', '버거', '햄버거', '배달', '족발', '보쌈', '곱창', '냉면', '칼국수', '김밥', '마라탕', '샤브샤브', '오마카세', '닭갈비', '쌀국수', '돈까스', '돈가스']]
  ];

  /** → { cat, guessed }. guessed=false 면 낱말을 못 찾아 '기타'.
      한 글자 낱말(밥 · 회 · 술)은 낱말 전체가 같을 때만 ("회사" "미술관"에 걸리지 않게) */
  function guessCategory(text) {
    var t = String(text).toLowerCase();
    var toks = t.split(/\s+/).filter(Boolean);
    function hit(w) { return w.length === 1 ? toks.indexOf(w) >= 0 : t.indexOf(w) >= 0; }
    for (var i = 0; i < WORDS.length; i++) {
      if (WORDS[i][1].some(hit)) return { cat: WORDS[i][0], guessed: true };
    }
    return { cat: 'etc', guessed: false };
  }

  // ── 몫 나누기 ──
  /** 반반: 홀수면 남는 1원은 적는 사람(me) 쪽 */
  function splitHalf(amount) {
    var partner = Math.floor(amount / 2);
    return { me: amount - partner, partner: partner };
  }
  /** 몫 칸 한쪽을 고치면 다른 쪽 = 합계 − 고친 값 (0 ~ 합계로 자름) */
  function rebalance(amount, edited, value) {
    var v = Math.max(0, Math.min(amount, Math.round(Number(value) || 0)));
    return edited === 'me' ? { me: v, partner: amount - v } : { me: amount - v, partner: v };
  }
  /** 저장 직전 정리: 합 = amount 여야 함. 한쪽이 0이면 그 사람이 다 낸 것으로 */
  function normalizeShares(amount, shares) {
    if (!shares) return { paidBy: null, shares: null };
    if (shares.me + shares.partner !== amount || shares.me < 0 || shares.partner < 0) throw new Error('shares-mismatch');
    if (shares.partner === 0) return { paidBy: 'me', shares: null };
    if (shares.me === 0) return { paidBy: 'partner', shares: null };
    return { paidBy: 'both', shares: shares };
  }

  // ── 날짜 낱말 ── 오늘 · 어제 · 그제 · 그저께 · N일(오늘보다 뒤면 지난달) · M/D · M.D
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateOf(tok, today) {
    var base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (tok === '오늘') return ymd(base);
    if (tok === '어제') { base.setDate(base.getDate() - 1); return ymd(base); }
    if (tok === '그제' || tok === '그저께') { base.setDate(base.getDate() - 2); return ymd(base); }
    var m = /^(\d{1,2})일$/.exec(tok);
    if (m) {
      var d = Number(m[1]);
      if (d < 1 || d > 31) return null;
      var t = new Date(base.getFullYear(), base.getMonth(), d);
      if (t.getMonth() !== base.getMonth()) return null;
      if (t > base) t = new Date(base.getFullYear(), base.getMonth() - 1, d); // 지난달 그날
      if (t.getDate() !== d) return null;
      return ymd(t);
    }
    m = /^(\d{1,2})[/.](\d{1,2})\.?$/.exec(tok);
    if (m) {
      var u = new Date(base.getFullYear(), Number(m[1]) - 1, Number(m[2]));
      if (u.getMonth() !== Number(m[1]) - 1) return null;
      if (u > base) u.setFullYear(u.getFullYear() - 1);
      return ymd(u);
    }
    return null;
  }

  /**
   * 한 줄 → 읽은 값.
   * @param line 적은 한 줄
   * @param who { meName, partnerName, today?: Date } — meName = 지금 적는 사람
   */
  function parseLine(line, who) {
    var today = who.today || new Date();
    var raw = String(line == null ? '' : line).trim();
    var toks = raw.split(/\s+/).filter(Boolean);
    var low = toks.map(function (t) { return t.toLowerCase(); });
    var used = toks.map(function () { return false; });

    // 1) 날짜 (처음 나온 것)
    var date = ymd(today), dateGuessed = true;
    low.forEach(function (t, i) {
      if (!dateGuessed) return;
      var d = dateOf(t, today);
      if (d) { date = d; dateGuessed = false; used[i] = true; }
    });

    // 2) 금액 낱말 — "12만 5천"처럼 띄어 쓴 것은 붙여서
    var amounts = []; // { i, end, v }
    for (var i = 0; i < low.length; i++) {
      if (used[i]) continue;
      var v = amountOf(low[i]);
      if (v === null) continue;
      used[i] = true;
      if (/만$/.test(low[i]) && i + 1 < low.length && !used[i + 1]) {
        var next = amountOf(low[i + 1]);
        if (next !== null && next < 10000 && /[천백]원?$|^\d+원?$/.test(low[i + 1])) {
          used[i + 1] = true;
          amounts.push({ i: i, end: i + 1, v: v + next });
          i++;
          continue;
        }
      }
      amounts.push({ i: i, end: i, v: v });
    }

    // 3) 누가
    var payers = []; // { i, p }
    low.forEach(function (t, j) {
      if (used[j]) return;
      var p = payerOf(t, who);
      if (p) { payers.push({ i: j, p: p }); used[j] = true; }
    });

    // 4) 각자 몫 — 사람이 금액 바로 앞("내가 7만 단짝 5만")을 먼저, 안 되면 바로 뒤("7만 내가 5만 단짝")
    var amount = null, payer = null, shares = null;
    if (amounts.length >= 2) {
      var own = {};
      ['before', 'after'].some(function (side) {
        own = {};
        amounts.forEach(function (a) {
          var at = side === 'before' ? a.i - 1 : a.end + 1;
          var hitP = payers.filter(function (x) { return x.i === at; })[0];
          if (hitP && hitP.p !== 'both' && own[hitP.p] === undefined) own[hitP.p] = a.v;
        });
        return own.me !== undefined && own.partner !== undefined;
      });
      if (own.me !== undefined && own.partner !== undefined) {
        payer = 'both';
        shares = { me: own.me, partner: own.partner };
        amount = own.me + own.partner;
      }
    }
    if (amount === null && amounts.length) amount = amounts[amounts.length - 1].v; // 여러 개면 마지막 것

    var payerGuessed = false;
    if (!payer) {
      var named = payers.map(function (x) { return x.p; });
      if (named.indexOf('both') >= 0 || (named.indexOf('me') >= 0 && named.indexOf('partner') >= 0)) payer = 'both';
      else if (named.length) payer = named[named.length - 1];
      else { payer = 'me'; payerGuessed = true; } // 아무도 안 적으면 적는 사람
    }
    if (payer === 'both' && !shares && amount !== null) shares = splitHalf(amount);

    // 5) 무엇 · 분류
    var what = toks.filter(function (_, k) { return !used[k]; }).join(' ').replace(/[,.·]+$/, '');
    var g = guessCategory(what || raw);

    var error = null;
    if (amount === null) error = 'no-amount';
    else if (amount >= AMOUNT_MAX) error = 'too-big';

    return {
      ok: error === null, error: error,
      date: date, dateGuessed: dateGuessed,
      amount: amount,
      payer: payer, payerGuessed: payerGuessed,
      shares: shares,
      what: what || L.CAT_LABEL[g.cat],
      cat: g.cat, catGuessed: g.guessed,
      raw: raw
    };
  }

  var api = { AMOUNT_MAX: AMOUNT_MAX, amountOf: amountOf, payerOf: payerOf, guessCategory: guessCategory, splitHalf: splitHalf, rebalance: rebalance, normalizeShares: normalizeShares, parseLine: parseLine };
  root.RT = root.RT || {};
  root.RT.ledgerParse = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
