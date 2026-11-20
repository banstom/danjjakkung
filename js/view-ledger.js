/* 화면 그리기 — 단짝 영수증 (docs/ledger/spec.md 2절, 목업 design/mockups/chosen/ledger L1~L11).
   screenModel / entryModel: 기록 → 화면 값 (순수, 시험용) · screen / entryCard / sheet / parsed: 그리기.
   사람: 화면을 보는 사람이 늘 왼쪽. 색은 사람 색 칸(slotOf → 'me' | 'her'). */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var L = NODE ? require('./ledger-sum.js') : root.RT.ledgerSum;
  var F = NODE ? require('./ledger-form.js') : root.RT.ledgerForm;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(d, size) {
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var BACK = '<path d="M15 5l-7 7 7 7"/>', NEXT = '<path d="M9 5l7 7-7 7"/>', PLUS = '<path d="M12 5v14M5 12h14"/>';
  var CAL = '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>';
  var DOW = '일월화수목금토';

  /** 'YYYY-MM-DD' → 「11월 18일 (수)」 */
  function dayLabel(s) {
    var p = String(s).split('-').map(Number);
    return p[1] + '월 ' + p[2] + '일 (' + DOW[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] + ')';
  }
  function monthTitle(m) { return Number(m.slice(0, 4)) + '년 ' + Number(m.slice(5, 7)) + '월'; }
  function shiftMonth(m, n) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n;
    y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    return y + '-' + (mo < 9 ? '0' : '') + (mo + 1);
  }
  /** 몫 작은 글씨: 1만 원 이상 「6만」(만 원의 「원」 없이), 아래 「8,000원」 */
  function shortWon(v) { var s = L.manWon(v); return s.replace(/만 원$/, '만'); }

  /**
   * 기록 → 목록 화면 값.
   * ctx = { month, nowMonth, minMonth, viewer, partner, names: { uid: 이름 }, slotOf(uid), cat (보는 분류 또는 null), loading, error }
   */
  function screenModel(spends, ctx) {
    var me = { uid: ctx.viewer, name: ctx.names[ctx.viewer] || '나' };
    var pt = { uid: ctx.partner, name: ctx.names[ctx.partner] || '단짝' };
    var extra = ctx.cats || [], labels = L.catLabels(extra);
    var s = L.monthSummary(spends, { me: me, partner: pt }, extra);
    var list = ctx.cat ? spends.filter(function (x) { return L.catOf(x.cat, extra) === ctx.cat; }) : spends;
    list = list.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (String(a.createdAt) < String(b.createdAt) ? 1 : -1); });
    var days = [];
    list.forEach(function (x) {
      var d = days[days.length - 1];
      if (!d || d.date !== x.date) { d = { date: x.date, label: dayLabel(x.date), rows: [] }; days.push(d); }
      var cat = labels[L.catOf(x.cat, extra)];
      var row = { id: x.id, what: x.what, amount: L.won(x.amount) };
      if (x.paidBy === 'both' && x.shares) {
        var a = x.shares[me.uid] || 0, b = x.shares[pt.uid] || 0, pc = L.percents(a, b) || [50, 50];
        row.split = [{ slot: ctx.slotOf(me.uid), pct: pc[0] }, { slot: ctx.slotOf(pt.uid), pct: pc[1] }];
        row.ds = cat + ' · 둘이 나눔';
        row.sub = shortWon(a) + ' · ' + shortWon(b);
      } else {
        row.slot = ctx.slotOf(x.paidBy);
        row.ds = cat + ' · ' + (ctx.names[x.paidBy] || '짝꿍');
      }
      row.label = x.what + ', ' + row.amount + ', ' + row.ds + (row.sub ? ', ' + row.sub : '');
      d.rows.push(row);
    });
    var filt = null;
    if (ctx.cat) {
      var tot = list.reduce(function (n, x) { return n + x.amount; }, 0);
      filt = { label: (labels[ctx.cat] || '기타') + '만', total: L.won(tot), count: list.length + '건' };
    }
    return {
      month: ctx.month, title: monthTitle(ctx.month),
      canPrev: !ctx.minMonth || ctx.month > ctx.minMonth, canNext: ctx.month < ctx.nowMonth,
      isNow: ctx.month === ctx.nowMonth,
      sum: {
        label: ctx.month === ctx.nowMonth ? '이번 달 함께 쓴 돈' : Number(ctx.month.slice(5, 7)) + '월 함께 쓴 돈',
        total: s.totalText, empty: s.total === 0, line: s.total === 0 ? (ctx.month === ctx.nowMonth ? '아직 이번 달 기록이 없어요' : '이 달에는 기록이 없어요') : s.line,
        people: [{ slot: ctx.slotOf(me.uid), name: me.name, pct: s.me.pct, text: s.me.text }, { slot: ctx.slotOf(pt.uid), name: pt.name, pct: s.partner.pct, text: s.partner.text }]
      },
      chips: s.cats.map(function (c) { return { cat: c.cat, text: c.text, on: ctx.cat === c.cat }; }),
      filter: filt, days: days, empty: spends.length === 0,
      loading: !!ctx.loading, error: ctx.error || '', art: ctx.art || ''
    };
  }

  /** 전체 탭 입구 카드 (L11) — 이번 달 구독 그대로 */
  function entryModel(spends, ctx) {
    var me = { uid: ctx.viewer, name: ctx.names[ctx.viewer] || '나' };
    var pt = { uid: ctx.partner, name: ctx.names[ctx.partner] || '단짝' };
    var s = L.monthSummary(spends || [], { me: me, partner: pt });
    var line;
    if (!s.total) line = '이번 달 기록이 없어요';
    else {
      var tail = s.diff === 0 ? '똑같이 냈어요' : (s.diff > 0 ? me.name + L.iGa(me.name) : pt.name + L.iGa(pt.name)) + ' ' + L.won(Math.abs(s.diff)) + ' 더';
      line = me.name + ' ' + s.me.pct + '% · ' + pt.name + ' ' + s.partner.pct + '% · ' + tail;
    }
    return { month: Number(ctx.month.slice(5, 7)) + '월', total: s.totalText, empty: !s.total, off: !!ctx.off,
      ratio: s.total ? [{ slot: ctx.slotOf(me.uid), pct: s.me.pct }, { slot: ctx.slotOf(pt.uid), pct: s.partner.pct }] : [], line: ctx.off ? '저장 규칙 배포 뒤에 보여요' : line };
  }

  function ratio(parts, cls) {
    return '<div class="lg-ratio' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + parts.map(function (p) { return '<span class="bg--' + esc(p.slot) + '" style="width:' + p.pct + '%"></span>'; }).join('') + '</div>';
  }

  function entryCard(m) {
    return '<button type="button" class="card lg-entry" data-act="all-ledger" aria-label="' + esc('단짝 영수증 · ' + m.month + ' ' + m.total + ' · ' + m.line) + '">' +
      '<span class="lg-entry__head"><span class="afeat__nm">단짝 영수증</span><span class="lg-entry__mo">' + esc(m.month) + '</span></span>' +
      '<span class="lg-entry__total">' + esc(m.total) + '</span>' + (m.ratio.length ? ratio(m.ratio, 'lg-ratio--thin') : '') +
      '<span class="lg-entry__line">' + esc(m.line) + '</span></button>';
  }

  function screen(m) {
    var s = m.sum;
    var sum = '<div class="card lg-sum"><p class="lg-sum__k">' + esc(s.label) + '</p><p class="lg-sum__total">' + esc(s.total) + '</p>' +
      (s.empty ? '' : ratio(s.people) + '<div class="lg-who">' +
        '<span>' + dot(s.people[0].slot) + '<b>' + esc(s.people[0].name + ' ' + s.people[0].pct + '%') + '</b><small>(' + esc(s.people[0].text) + ')</small></span>' +
        '<span><b>' + esc(s.people[1].name + ' ' + s.people[1].pct + '%') + '</b><small>(' + esc(s.people[1].text) + ')</small>' + dot(s.people[1].slot) + '</span></div>') +
      '<p class="lg-tint">' + esc(s.line) + '</p></div>';
    var chips = m.chips.length ? '<div class="lg-chips" role="group" aria-label="분류별 합계 · 누르면 그 분류만">' + m.chips.map(function (c) {
      return '<button type="button" class="lg-chip" data-act="lg-cat" data-v="' + esc(c.cat) + '" aria-pressed="' + c.on + '">' + esc(c.text) + '</button>';
    }).join('') + '</div>' : '';
    var filt = m.filter ? '<div class="lg-filter"><span><b>' + esc(m.filter.label) + '</b> · ' + esc(m.filter.total) + ' · ' + esc(m.filter.count) + '</span><button type="button" class="text-btn" data-act="lg-cat-clear">모두 보기</button></div>' : '';
    var body;
    if (m.error) body = '<div class="card lg-empty"><p class="muted">' + esc(m.error) + '</p></div>';
    else if (m.loading && m.empty) body = '<div class="card lg-empty" aria-busy="true"><p class="muted">불러오는 중…</p></div>';
    else if (m.empty) body = (m.art ? '<div class="lg-art">' + m.art + '</div>' : '') + '<div class="card lg-empty"><p class="lg-empty__t">함께 쓴 돈을 한 줄로 적어 봐요</p>' +
      '<p class="lg-empty__ex">저녁 42000 내가<br>ktx 5.98만 단짝<br>숙소 12만 반반</p>' +
      '<button type="button" class="lg-firstbtn" data-act="lg-add">첫 줄 적기</button><p class="lg-empty__note">함께 쓴 돈만 적어요 · 선물이나 각자 쓴 돈은 넣지 않아요</p></div>';
    else body = m.days.map(function (d) {
      return '<h3 class="lg-dh">' + esc(d.label) + '</h3><div class="card lg-list">' + d.rows.map(function (r) {
        var mark = r.split ? '<span class="lg-split" aria-hidden="true"><span class="bg--' + esc(r.split[0].slot) + '"></span><span class="bg--' + esc(r.split[1].slot) + '"></span></span>' : dot(r.slot);
        return '<button type="button" class="lg-row" data-act="lg-row" data-v="' + esc(r.id) + '" aria-label="' + esc(r.label + ' · 눌러서 고치기') + '">' + mark +
          '<span class="lg-row__tx"><span class="lg-row__nm">' + esc(r.what) + '</span><span class="lg-row__ds">' + esc(r.ds) + '</span>' + (r.split ? ratio(r.split, 'lg-ratio--mini') : '') + '</span>' +
          '<span class="lg-row__am">' + esc(r.amount) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span></button>';
      }).join('') + '</div>';
    }).join('');
    return '<div class="mscreen lg">' +
      '<div class="mbar"><button type="button" class="mbar__btn" data-act="lg-close" aria-label="전체로 돌아가기">' + svg(BACK) + '</button><h1 class="mbar__title">단짝 영수증</h1></div>' +
      '<div class="lg-mnav"><button type="button" class="mbar__btn" data-act="lg-month" data-dir="-1" aria-label="지난달"' + (m.canPrev ? '' : ' disabled') + '>' + svg(BACK, 20) + '</button>' +
      '<b aria-live="polite">' + esc(m.title) + '</b><button type="button" class="mbar__btn" data-act="lg-month" data-dir="1" aria-label="다음 달"' + (m.canNext ? '' : ' disabled') + '>' + svg(NEXT, 20) + '</button></div>' +
      sum + chips + filt + body +
      '<button type="button" class="lg-fab" data-act="lg-add" aria-label="한 줄 적기">' + svg(PLUS, 26) + '</button></div>';
  }
  function dot(slot) { return '<span class="dot dot--' + esc(slot) + '" aria-hidden="true"></span>'; }

  // ── 시트 ──
  /** 입력칸 아래 (한 줄을 고칠 때마다 이 부분만 다시 그린다 — 입력칸을 다시 그리면 한글 조합이 깨져서). ctx = { names: {me, partner}, slots: {me, partner}, todayKey } */
  function parsed(f, ctx) {
    var msg = F.messages(f, ctx.names);
    var d = f.date;
    var dateTxt = (d === ctx.todayKey ? '오늘 · ' : '') + dayLabel(d);
    var datePill = '<label class="lg-pill">' + svg(CAL, 16) + '<span>' + esc(dateTxt) + '</span><input id="lg-date" class="lg-pill__in" type="date" value="' + esc(d) + '" max="' + esc(ctx.todayKey) + '" aria-label="쓴 날 (' + esc(dateTxt) + ')"></label>';
    var who = '<p class="field__label">누가 냈나요</p><div class="seg seg--payer' + (f.ask.payer && msg.payer ? ' is-ask' : '') + '" role="group" aria-label="누가 냈나요"' + (msg.payer ? ' aria-describedby="lg-ask-payer"' : '') + '>' +
      [['me', ctx.names.me], ['partner', ctx.names.partner], ['both', '둘이 나눔']].map(function (x) {
        return '<button type="button" class="seg__btn" data-act="lg-payer" data-v="' + x[0] + '" aria-pressed="' + (f.payer === x[0]) + '">' + esc(x[1]) + '</button>';
      }).join('') + '</div>' + (msg.payer ? '<p id="lg-ask-payer" class="lg-hint lg-hint--ask">' + esc(msg.payer) + '</p>' : '');
    var box = '';
    if (f.amount !== null && f.mode === 'add') {
      if (f.payer === 'both' && f.shares) box = shareBox(f, ctx, true);
      else box = '<div class="lg-pv"><div class="lg-pv__top"><span>' + esc(f.what || labels0(f, ctx)) + '</span><span>' + esc(L.won(f.amount)) + '</span></div></div>';
    } else if (f.mode === 'edit' && f.payer === 'both' && f.shares) box = shareBox(f, ctx, false);
    var extra = ctx.cats || [], labels = L.catLabels(extra), mine = {};
    extra.forEach(function (c) { mine[c.id] = true; });
    var cats = '<div class="lg-cathead"><p class="field__label">분류</p>' + (extra.length ? '<button type="button" class="text-btn lg-catedit" data-act="lg-cat-edit" aria-pressed="' + !!f.catEdit + '">' + (f.catEdit ? '완료' : '편집') + '</button>' : '') + '</div>' +
      '<div class="pick-row" role="group" aria-label="분류"' + (msg.cat ? ' aria-describedby="lg-ask-cat"' : '') + '>' + L.catOrder(extra).map(function (c) {
        if (f.catEdit && mine[c]) return '<button type="button" class="pick pick--del" data-act="lg-cat-del" data-v="' + esc(c) + '" aria-label="' + esc(labels[c] + ' 분류 지우기') + '">' + esc(labels[c]) + ' ×</button>';
        return '<button type="button" class="pick' + (c === 'etc' && f.ask.cat && msg.cat && f.cat === 'etc' ? ' pick--ask' : '') + '" data-act="lg-catpick" data-v="' + esc(c) + '" aria-pressed="' + (f.cat === c) + '"' + (f.catEdit ? ' disabled' : '') + '>' + esc(labels[c]) + '</button>';
      }).join('') +
      (!f.catNew && !f.catEdit && extra.length < 12 ? '<button type="button" class="pick pick--edit" data-act="lg-cat-new">＋ 분류</button>' : '') + '</div>' +
      (f.catNew ? '<div class="lg-catnew"><input id="lg-cat-name" class="field__input" type="text" maxlength="8" autocomplete="off" enterkeyhint="done" placeholder="새 분류 이름 (8자까지)" value="' + esc(f.catNew.name) + '" aria-label="새 분류 이름"' +
        (f.catNew.error ? ' aria-invalid="true" aria-describedby="lg-cat-err"' : '') + '><button type="button" class="solid-btn lg-catnew__add" data-act="lg-cat-add"' + (f.catNew.busy ? ' disabled' : '') + '>추가</button><button type="button" class="ghost-btn lg-catnew__no" data-act="lg-cat-new-cancel">취소</button></div>' +
        (f.catNew.error ? '<p id="lg-cat-err" class="lg-hint lg-hint--err">' + esc(f.catNew.error) + '</p>' : '') : '') +
      (f.catEdit ? '<p class="lg-hint">직접 만든 분류만 지울 수 있어요 · 지운 분류의 기록은 기타로 보여요</p>' : '') +
      (msg.cat ? '<p id="lg-ask-cat" class="lg-hint lg-hint--ask">' + esc(msg.cat) + '</p>' : '');
    var raw = f.mode === 'edit' && f.raw ? '<p class="lg-hint">적은 한 줄: 「' + esc(f.raw) + '」</p>' : '';
    var save = '<button type="button" class="lg-save" data-act="lg-save"' + (F.canSave(f) ? '' : ' disabled') + (f.saving ? ' aria-busy="true"' : '') + '>' + (f.saving ? '저장 중…' : '저장') + '</button>';
    return (f.mode === 'add' ? '<div class="lg-pills">' + datePill + '</div>' : '') + who + box + cats + raw + save;
  }
  function labels0(f, ctx) { return L.catLabels(ctx.cats)[f.cat] || '기타'; }
  function shareBox(f, ctx, top) {
    var pc = L.percents(f.shares.me, f.shares.partner) || [50, 50];
    var msg = F.messages(f, ctx.names);
    return '<div class="lg-pv">' + (top ? '<div class="lg-pv__top"><span>' + esc(f.what || labels0(f, ctx)) + '</span><span>' + esc(L.won(f.amount)) + '</span></div>' : '') +
      '<div id="lg-sh-bar">' + ratio([{ slot: ctx.slots.me, pct: pc[0] }, { slot: ctx.slots.partner, pct: pc[1] }], 'lg-ratio--box') + '</div>' +
      '<div class="lg-shares">' + [['me', ctx.names.me, ctx.slots.me], ['partner', ctx.names.partner, ctx.slots.partner]].map(function (x) {
        return '<label class="lg-share"><span>' + dot(x[2]) + esc(x[1]) + '</span><input id="lg-sh-' + x[0] + '" class="field__input" type="text" inputmode="numeric" autocomplete="off" value="' + esc(L.comma(f.shares[x[0]])) + '" aria-label="' + esc(x[1] + ' 몫 (원)') + '"></label>';
      }).join('') + '</div><p class="lg-hint">' + esc(msg.split || '한쪽을 고치면 다른 쪽이 나머지로 맞춰져요') + '</p></div>';
  }

  /** f = ledger-form 값. ctx = parsed 와 같음 + meta 문구 */
  function sheet(f, ctx, entering) {
    var msg = F.messages(f, ctx.names);
    var head, top;
    if (f.mode === 'add') {
      head = '<div class="sheet__head"><h2 id="lg-sheet-title" class="sheet__title">한 줄 적기</h2></div><p class="sheet__sub">평소 말투로 · 저녁 42000 내가 · 숙소 12만 반반</p>';
      top = '<label class="field"><span class="field__label">무엇을 얼마에, 누가</span><input id="lg-line" class="field__input lg-line' + (msg.error ? ' is-err' : '') + '" type="text" maxlength="80" autocomplete="off" enterkeyhint="done" placeholder="예: 저녁 42000 내가" value="' + esc(f.line) + '"' +
        (msg.error ? ' aria-invalid="true"' : '') + ' aria-describedby="lg-line-err"></label><p id="lg-line-err" class="lg-hint lg-hint--err" aria-live="polite">' + esc(msg.error || '') + '</p>';
    } else {
      head = '<div class="sheet__head"><h2 id="lg-sheet-title" class="sheet__title">기록 고치기</h2><button type="button" class="text-btn text-btn--warn lg-del" data-act="lg-del">지우기</button></div>' +
        (f.meta ? '<p class="sheet__sub">' + esc(f.meta) + '</p>' : '');
      top = '<label class="field"><span class="field__label">무엇</span><input id="lg-what" class="field__input" type="text" maxlength="40" autocomplete="off" value="' + esc(f.what) + '"></label>' +
        '<div class="lg-two"><label class="field"><span class="field__label">금액</span><input id="lg-amount" class="field__input' + (msg.error ? ' is-err' : '') + '" type="text" inputmode="numeric" autocomplete="off" value="' + esc(f.amount !== null ? L.comma(f.amount) : '') + '"' + (msg.error ? ' aria-invalid="true"' : '') + ' aria-describedby="lg-line-err"></label>' +
        '<label class="field"><span class="field__label">날짜</span><span class="lg-pill lg-pill--wide">' + svg(CAL, 16) + '<span>' + esc(dayLabel(f.date)) + '</span><input id="lg-date" class="lg-pill__in" type="date" value="' + esc(f.date) + '" max="' + esc(ctx.todayKey) + '" aria-label="쓴 날 (' + esc(dayLabel(f.date)) + ')"></span></label></div>' +
        '<p id="lg-line-err" class="lg-hint lg-hint--err" aria-live="polite">' + esc(msg.error || '') + '</p>';
    }
    var confirm = f.confirmDelete ? '<div class="lg-confirm" role="alertdialog" aria-modal="true" aria-labelledby="lg-cf-t" aria-describedby="lg-cf-d"><div class="lg-confirm__box">' +
      '<h3 id="lg-cf-t">이 기록을 지울까요?</h3><p id="lg-cf-d">' + esc(ctx.names.partner) + ' 화면에서도 함께 사라져요.</p>' +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="lg-del-no">그대로 두기</button><button type="button" class="solid-btn lg-del-yes" data-act="lg-del-yes">지우기</button></div></div></div>' : '';
    return '<div class="sheet-layer"><button type="button" class="scrim" data-act="lg-cancel" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall lg-sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="lg-sheet-title">' +
      '<span class="grabber" aria-hidden="true"></span>' + head + top + '<div id="lg-parsed" class="lg-parsed">' + parsed(f, ctx) + '</div></section>' + confirm + '</div>';
  }

  var api = { dayLabel: dayLabel, monthTitle: monthTitle, shiftMonth: shiftMonth, screenModel: screenModel, entryModel: entryModel, screen: screen, entryCard: entryCard, sheet: sheet, parsed: parsed, ratio: ratio };
  root.RT = root.RT || {};
  root.RT.viewLedger = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
