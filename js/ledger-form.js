/* 단짝 영수증 · 적기 / 고치기 시트의 값 (docs/ledger/spec.md 2절 L3~L7) — 화면 없이 시험할 수 있게 순수 함수로.
   사람은 'me'(지금 보는 사람) / 'partner'. 저장 문서로 바꾸는 건 ledger-parse.js toDoc 한 곳에서만.
   규칙: 사용자가 아래 칸(누가 · 분류 · 몫 · 날짜)을 직접 고친 뒤 한 줄을 또 고치면, 직접 고친 칸은 덮어쓰지 않는다. */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var P = NODE ? require('./ledger-parse.js') : root.RT.ledgerParse;
  var L = NODE ? require('./ledger-sum.js') : root.RT.ledgerSum;

  /** 새 적기 시트. who = { meName, partnerName, today: Date } */
  function newAdd(who, todayKey) {
    return { mode: 'add', line: '', raw: '', date: todayKey, amount: null, payer: 'me', shares: null, what: '', cat: 'etc',
      touched: {}, ask: { payer: false, cat: false }, error: 'empty', readSplit: false, saving: false, confirmDelete: false };
  }
  /** 고치기 시트. form = ledger-parse fromDoc 결과 */
  function newEdit(id, form, meta) {
    return { mode: 'edit', id: id, line: '', raw: form.raw || '', date: form.date, amount: form.amount, payer: form.payer,
      shares: form.shares, what: form.what, cat: form.cat, touched: { payer: true, cat: true, shares: true, date: true, amount: true, what: true },
      ask: { payer: false, cat: false }, error: null, readSplit: false, saving: false, confirmDelete: false, meta: meta || null };
  }

  /** 한 줄을 고칠 때마다 — 읽은 값으로 아래 칸을 채움 (직접 고친 칸은 그대로) */
  function applyLine(f, line, who) {
    var p = P.parseLine(line, who);
    var t = f.touched;
    f.line = line; f.raw = String(line).trim();
    f.error = String(line).trim() ? p.error : 'empty';
    if (p.amount !== null) f.amount = p.amount;
    else f.amount = null;
    if (!t.what) f.what = p.what;
    if (!t.date) f.date = p.date;
    if (!t.payer) { f.payer = p.payer; f.ask.payer = p.payerGuessed; }
    if (!t.cat) {
      f.cat = p.cat; f.ask.cat = !p.catGuessed;
      var own = customHit(line, who.cats); // 직접 만든 분류 이름이 한 줄에 있으면 그 분류
      if (own) { f.cat = own; f.ask.cat = false; }
    }
    if (f.payer === 'both') {
      if (!t.shares || !f.shares || f.amount === null || f.shares.me + f.shares.partner !== f.amount) {
        f.shares = p.payer === 'both' && p.shares ? p.shares : (f.amount !== null ? P.splitHalf(f.amount) : null);
      }
    } else f.shares = null;
    // 「내가 12000 단짝 11000」처럼 각자 적었으면 안내 (반반과 다를 때)
    var half = p.amount !== null ? P.splitHalf(p.amount) : null;
    f.readSplit = !t.shares && p.payer === 'both' && !!p.shares && !!half && (p.shares.me !== half.me || p.shares.partner !== half.partner);
    return f;
  }

  /** 직접 만든 분류 이름이 한 줄에 있나 (긴 이름부터, 한 글자 이름은 낱말 전체일 때만) */
  function customHit(line, cats) {
    var low = String(line).toLowerCase(), toks = low.split(/\s+/);
    var list = (cats || []).slice().sort(function (a, b) { return b.label.length - a.label.length; });
    for (var i = 0; i < list.length; i++) {
      var w = String(list[i].label).toLowerCase();
      if (w && (w.length === 1 ? toks.indexOf(w) >= 0 : low.indexOf(w) >= 0)) return list[i].id;
    }
    return null;
  }
  /** 새 분류 이름 확인 → 오류 문구 또는 null */
  function catNameError(name, cats) {
    var n = String(name || '').trim();
    if (!n) return '이름을 적어 주세요';
    if (n.length > 8) return '8자까지 적을 수 있어요';
    var all = L.catLabels(cats);
    if (Object.keys(all).some(function (k) { return all[k] === n; })) return '이미 있는 분류예요';
    if ((cats || []).length >= 12) return '분류는 12개까지 더할 수 있어요';
    return null;
  }

  function setPayer(f, payer) {
    f.touched.payer = true; f.ask.payer = false; f.payer = payer;
    if (payer === 'both') { if (!f.shares && f.amount) f.shares = P.splitHalf(f.amount); }
    else { f.shares = null; f.readSplit = false; }
    return f;
  }
  function setCat(f, cat) { f.touched.cat = true; f.ask.cat = false; f.cat = cat; return f; }
  function setDate(f, date) { if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { f.touched.date = true; f.date = date; } return f; }
  /** 몫 한쪽을 고치면 다른 쪽 = 합계 − 고친 값 */
  function setShare(f, side, value) {
    if (!f.amount) return f;
    f.touched.shares = true; f.readSplit = false;
    f.shares = P.rebalance(f.amount, side, value);
    return f;
  }
  /** 고치기 시트의 금액 · 무엇 칸 */
  function setAmount(f, text) {
    f.touched.amount = true;
    var v = P.amountOf(String(text).replace(/\s+/g, ''));
    if (v === null && /^\d{1,2}$/.test(String(text).trim())) v = Number(String(text).trim()); // 고치기 칸은 맨 숫자 그대로 (100 미만도)
    f.amount = v;
    f.error = v === null ? 'no-amount' : v >= P.AMOUNT_MAX ? 'too-big' : null;
    if (f.payer === 'both' && v !== null && v < P.AMOUNT_MAX) {
      f.shares = f.shares && f.shares.me <= v ? P.rebalance(v, 'me', f.shares.me) : P.splitHalf(v);
    }
    return f;
  }
  function setWhat(f, text) { f.touched.what = true; f.what = String(text).slice(0, 40); return f; }

  /** 저장할 수 있나 — 금액만 막는다 (누가 · 분류 확인은 안내만) */
  function canSave(f) { return !f.saving && f.amount !== null && f.amount >= 1 && f.amount < P.AMOUNT_MAX && !f.error; }

  /** 오류 · 안내 문구 */
  function messages(f, names) {
    var out = {};
    if (f.error === 'no-amount' || (f.mode === 'add' && f.error === 'empty' && f.line)) out.error = '금액을 못 찾았어요 · 예: 42000 · 4.2만 · 4만2천';
    else if (f.error === 'too-big') out.error = '1억 원보다 작게 적어 주세요';
    if (f.ask.payer && f.amount !== null) out.payer = '누가 냈는지 안 적혀서 ' + names.me + '(적는 사람)으로 해 뒀어요';
    if (f.ask.cat && f.amount !== null) out.cat = '분류를 못 찾아서 기타로 해 뒀어요 · 눌러서 바꿔요';
    if (f.readSplit && f.shares) out.split = names.me + ' ' + L.comma(f.shares.me) + ' · ' + names.partner + ' ' + L.comma(f.shares.partner) + '을 각자 몫으로 읽었어요';
    return out;
  }

  /** 저장용 화면 값 (ledger-parse toDoc 에 넘김) */
  function toForm(f) {
    return { date: f.date, amount: f.amount, payer: f.payer, shares: f.payer === 'both' ? f.shares : null, what: f.what, cat: f.cat, raw: f.mode === 'add' ? f.raw : f.raw || null };
  }

  var api = { customHit: customHit, catNameError: catNameError, newAdd: newAdd, newEdit: newEdit, applyLine: applyLine, setPayer: setPayer, setCat: setCat, setDate: setDate, setShare: setShare, setAmount: setAmount, setWhat: setWhat, canSave: canSave, messages: messages, toForm: toForm };
  root.RT = root.RT || {};
  root.RT.ledgerForm = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
