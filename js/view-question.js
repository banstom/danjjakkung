/* 교환 쪽지 (docs/question) — 화면 그리기만. 값은 js/app-question.js 가 만든다. 문구는 js/question-text.js 그대로.
   목업 design/mockups/chosen/question/ (C 쪽지 나란히 + 쪽지 모양 5 「작게 접은 쪽지」 · 입구 E1).
   잠긴 단짝 쪽지는 글을 받지 않는다 — 모델에 글이 없으면 그릴 수도 없다 (theirs 상태엔 text 칸 자체가 없음). */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var QT = NODE ? require('./question-text.js') : root.RT.questionText;
  var T = QT.T;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(d, size) {
    size = size || 24;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var I = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    swap: '<path d="M20 11a8 8 0 00-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>'
  };
  function dot(slot, filled) { return '<span class="qz-dot qz-dot--' + esc(slot) + (filled ? '' : ' is-empty') + '" aria-hidden="true"></span>'; }

  // ── 입구 E1 (전체 탭 우리 기능 칸) ──
  /** m = { text, state, meSlot, herSlot, off } */
  function entry(m) {
    var st = { none: T.stateNone, mine: T.stateMine, theirs: T.stateTheirs, both: T.stateBoth }[m.state] || T.stateNone;
    var mineOn = m.state === 'mine' || m.state === 'both', herOn = m.state === 'theirs' || m.state === 'both';
    var text = m.off ? '저장 규칙 배포 뒤에 열려요' : (m.text || '오늘 질문을 펼쳐 봐요');
    return '<button type="button" class="card afeat__card qz-entry" data-act="q-open" aria-label="' + esc(T.name + ' · ' + text + ' · ' + st) + '">' +
      '<span class="qz-entry__head"><span class="afeat__nm">' + esc(T.name) + '</span><span class="qz-minifold qz-who--' + esc(m.herSlot) + '" aria-hidden="true"></span></span>' +
      '<span class="qz-entry__q">' + esc(text) + '</span>' +
      (m.off ? '' : '<span class="qz-entry__st">' + dot(m.meSlot, mineOn) + dot(m.herSlot, herOn) + '<span>' + esc(st) + '</span></span>') + '</button>';
  }

  // ── 쪽지 화면 (F01~F10 · F14 · F15) ──
  function qcard(d) {
    var tags = (d.tags || []).map(function (t) { return '<span class="qz-tag">' + esc(t) + '</span>'; }).join('');
    return '<div class="qz-qn"><p class="qz-kick">' + esc(d.dateLabel) + tags + '</p>' +
      '<p class="qz-qtext">' + esc(d.text) + '</p>' +
      (d.canSwap ? '<div class="qz-qfoot"><button type="button" class="qz-tbtn" data-act="q-swap">' + svg(I.swap, 18) + esc(T.swap) + '</button></div>' : '') + '</div>';
  }
  function head(slot, label, sub) {
    return '<div class="qz-nhead"><b>' + dot(slot, true) + esc(label) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  }
  /** 내 쪽지 칸: 쓰기(처음 · 고치기) 또는 남긴 글 */
  function mineNote(m) {
    var me = m.mine;
    if (me.writing) {
      var n = [].concat(Array.from(me.draft || '')).length;
      return '<div class="qz-n qz-n--me">' + head(m.meSlot, T.mine, me.editing ? me.timeLabel : T.toPartner) +
        '<textarea id="q-text" class="qz-nta" maxlength="300" aria-label="' + esc(T.mine) + '" placeholder="' + esc(T.answerPlaceholder) + '"' + (me.error ? ' aria-invalid="true" aria-describedby="q-err"' : '') + '>' + esc(me.draft || '') + '</textarea>' +
        (me.error ? '<p id="q-err" class="qz-err" role="alert">' + esc(me.error) + '</p>' : '') +
        '<div class="qz-nfoot"><span id="q-count" class="qz-count">' + n + ' / 300</span>' +
        (me.editing ? '<button type="button" class="qz-tbtn qz-tbtn--sub" data-act="q-edit-cancel">취소</button>' : '') +
        '<button type="button" class="qz-save" data-act="q-save"' + (me.saving || !String(me.draft || '').trim() ? ' disabled' : '') + (me.saving ? ' aria-busy="true"' : '') + '>' + esc(T.answerSave) + '</button></div></div>';
    }
    return '<div class="qz-n qz-n--me">' + head(m.meSlot, T.mine, me.timeLabel + (me.edited ? ' · ' + T.edited : '')) +
      '<p class="qz-ntext">' + (me.text == null ? '<span class="qz-loading">불러오는 중…</span>' : esc(me.text)) + '</p>' +
      '<div class="qz-nfoot"><button type="button" class="qz-tbtn qz-tbtn--sub" data-act="q-edit">' + svg(I.pen, 18) + esc(T.answerEdit) + '</button></div></div>';
  }
  /** 단짝 칸: 빈 자리 · 접힌 쪽지 · 펴진 쪽지. 접힌 쪽지에는 글 칸이 없다 */
  function herNote(m) {
    var h = m.theirs;
    if (m.state === 'none' || m.state === 'mine') {
      return '<div class="qz-wait">' + head(m.herSlot, T.theirs, T.partnerWaiting) +
        (m.state === 'mine' && m.nudge ? '<button type="button" class="qz-btn2" data-act="q-kung">' + esc(T.nudgeKung) + '</button>' : '') + '</div>';
    }
    if (m.state === 'theirs') {
      return '<div class="qz-folded"><div class="qz-tiny qz-who--' + esc(m.herSlot) + '" aria-hidden="true"><b>단짝이</b></div>' +
        '<div class="qz-nlock">' + svg(I.lock, 20) + '<span>' + esc(T.partnerFolded(h.timeLabel)) + '</span><small>' + esc(T.partnerLocked) + '</small></div></div>';
    }
    return '<div class="qz-n qz-n--her">' + head(m.herSlot, T.theirs, h.timeLabel + (h.edited ? ' · ' + T.edited : '')) +
      '<p class="qz-ntext">' + (h.text == null ? '<span class="qz-loading">펼치는 중…</span>' : esc(h.text)) + '</p>' +
      '<div class="qz-nfoot"><button type="button" class="qz-pill" data-act="q-like" aria-pressed="' + !!h.liked + '">' + svg(I.heart, 16) + esc(T.like) + '</button></div></div>';
  }
  /** m = { day, state, mine, theirs, meSlot, herSlot, nudge, first, past, loading, error } */
  function screen(m) {
    var bar = '<div class="mbar"><button type="button" class="mbar__btn" data-act="q-close" aria-label="' + (m.past ? '지난 쪽지로 돌아가기' : '전체로 돌아가기') + '">' + svg(I.back) + '</button>' +
      '<h1 class="mbar__title">' + esc(T.name) + '</h1>' +
      (m.past ? '' : '<button type="button" class="mbar__btn" data-act="q-past" aria-label="' + esc(T.pastTitle) + '">' + svg(I.clock) + '</button>' +
        '<button type="button" class="mbar__btn qz-plus" data-act="q-add" aria-label="' + esc(T.addTitle) + '">' + svg(I.plus) + '</button>') + '</div>';
    if (m.error) return '<div class="mscreen qz">' + bar + '<div class="card qz-empty"><p class="muted">' + esc(m.error) + '</p></div></div>';
    if (!m.day) return '<div class="mscreen qz">' + bar + '<div class="card qz-empty" aria-busy="true"><p class="muted">오늘 질문을 펼치는 중…</p></div></div>';
    var how = m.first ? '<div class="qz-how"><b>' + esc(T.howTitle) + '</b>' + T.how.map(esc).join('<br>') + '</div>' : '';
    var tint = m.state === 'mine' && !m.past ? '<p class="qz-tint">' + esc(T.nudgeAfter) + '</p>' : '';
    return '<div class="mscreen qz">' + bar + qcard(m.day) +
      '<div class="qz-grid">' + mineNote(m) + herNote(m) + '</div>' + tint + how + '</div>';
  }

  // ── 다른 질문 확인 (F06) ──
  function swapSheet(entering) {
    return '<div class="sheet-layer"><button type="button" class="scrim" data-act="q-swap-no" aria-label="닫기"></button>' +
      '<section class="sheet qz-sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="q-swap-t">' +
      '<span class="grabber" aria-hidden="true"></span><div class="sheet__head"><h2 id="q-swap-t" class="sheet__title">' + esc(T.swapTitle) + '</h2></div>' +
      '<p class="sheet__sub">' + esc(T.swapSub) + '</p><div class="rform__actions"><button type="button" class="ghost-btn" data-act="q-swap-no">' + esc(T.swapKeep) + '</button>' +
      '<button type="button" class="solid-btn" data-act="q-swap-yes">' + esc(T.swapConfirm) + '</button></div></section></div>';
  }

  // ── 질문 넣기 · 고치기 (F07) ──
  /** f = { text, ask, error, saving, id(고치기면) } */
  function addSheet(f, entering) {
    var n = Array.from(f.text || '').length;
    return '<div class="sheet-layer"><button type="button" class="scrim" data-act="q-add-close" aria-label="닫기"></button>' +
      '<section class="sheet qz-sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="q-add-t">' +
      '<span class="grabber" aria-hidden="true"></span><div class="sheet__head"><h2 id="q-add-t" class="sheet__title">' + esc(f.id ? '질문 고치기' : T.addTitle) + '</h2>' +
      (f.id ? '<button type="button" class="text-btn text-btn--warn" data-act="q-ours-del">지우기</button>' : '') + '</div>' +
      '<p class="sheet__sub">' + esc(T.addSub) + '</p>' +
      '<textarea id="q-qtext" class="field__input field__input--memo qz-qta" maxlength="60" rows="2" aria-label="질문" placeholder="예: 요즘 제일 자주 흥얼거리는 노래는?"' + (f.error ? ' aria-invalid="true" aria-describedby="q-add-err"' : '') + '>' + esc(f.text || '') + '</textarea>' +
      '<p class="qz-qcount"><span id="q-qcount">' + n + '</span> / 60</p>' +
      (f.error ? '<p id="q-add-err" class="qz-err" role="alert">' + esc(f.error) + '</p>' : '') +
      '<p class="field__label">' + esc(T.addWhen) + '</p><div class="seg seg--full" role="group" aria-label="' + esc(T.addWhen) + '">' +
      '<button type="button" class="seg__btn" data-act="q-add-ask" data-v="ask" aria-pressed="' + !!f.ask + '">' + esc(T.addAsk) + '</button>' +
      '<button type="button" class="seg__btn" data-act="q-add-ask" data-v="mix" aria-pressed="' + !f.ask + '">' + esc(T.addMix) + '</button></div>' +
      '<p class="qz-hint">' + esc(f.ask ? T.addAskSub : T.addMixSub) + '</p>' +
      '<button type="button" class="solid-btn solid-btn--full" data-act="q-add-save"' + (f.saving ? ' disabled aria-busy="true"' : '') + '>' + esc(f.id ? '고치기' : T.addSave) + '</button>' +
      (f.id ? '' : '<button type="button" class="qz-seelist" data-act="q-ours">' + esc(T.addSeeList) + ' ' + svg(I.next, 16) + '</button>') + '</section></div>';
  }

  // ── 지난 쪽지 (F11) ──
  /** m = { title, canPrev, canNext, summary, rows: [{ date, d, w, text, sub, me, her, late, liked }], meSlot, herSlot, loading, error } */
  function past(m) {
    var bar = '<div class="mbar"><button type="button" class="mbar__btn" data-act="q-past-close" aria-label="교환 쪽지로 돌아가기">' + svg(I.back) + '</button><h1 class="mbar__title">' + esc(T.pastTitle) + '</h1></div>' +
      '<div class="lg-mnav"><button type="button" class="mbar__btn" data-act="q-past-month" data-dir="-1" aria-label="지난달"' + (m.canPrev ? '' : ' disabled') + '>' + svg(I.back, 20) + '</button>' +
      '<b aria-live="polite">' + esc(m.title) + '</b><button type="button" class="mbar__btn" data-act="q-past-month" data-dir="1" aria-label="다음 달"' + (m.canNext ? '' : ' disabled') + '>' + svg(I.next, 20) + '</button></div>';
    var body;
    if (m.error) body = '<div class="card qz-empty"><p class="muted">' + esc(m.error) + '</p></div>';
    else if (m.loading) body = '<div class="card qz-empty" aria-busy="true"><p class="muted">불러오는 중…</p></div>';
    else if (!m.rows.length) body = '<div class="card qz-empty"><p class="muted">이 달에는 질문이 없어요</p></div>';
    else body = '<p class="qz-tint qz-tint--top">' + esc(m.summary) + '</p><div class="card qz-list">' + m.rows.map(function (r) {
      var right = r.late ? '<span class="qz-late">' + esc(T.lateAnswer) + '</span>' : '<span class="qz-dots">' + dot(m.meSlot, r.me) + dot(m.herSlot, r.her) + '</span>';
      var subs = (r.liked ? '<span class="qz-heart">' + svg(I.heart, 18) + '</span>' : '') + (r.sub ? '<span>' + esc(r.sub) + '</span>' : '');
      return '<button type="button" class="qz-hrow" data-act="q-past-day" data-v="' + esc(r.date) + '" aria-label="' + esc(r.d + '일 ' + r.text + (r.late ? ' · ' + T.lateAnswer : '')) + '">' +
        '<span class="qz-hd"><b>' + esc(r.d) + '</b><small>' + esc(r.w) + '</small></span>' +
        '<span class="qz-hq"><span class="qz-hq__t">' + esc(r.text) + '</span>' + (subs ? '<span class="qz-hq__s">' + subs + '</span>' : '') + '</span>' + right + '</button>';
    }).join('') + '</div>';
    return '<div class="mscreen qz">' + bar + body + '</div>';
  }

  // ── 우리가 넣은 질문 (F12) ──
  /** m = { waiting: [{ id, text|null, hidden, slot, line, editable }], shown: [{ text, slot, line }] } */
  function ours(m) {
    var bar = '<div class="mbar"><button type="button" class="mbar__btn" data-act="q-ours-close" aria-label="돌아가기">' + svg(I.back) + '</button><h1 class="mbar__title">' + esc(T.oursTitle) + '</h1></div>';
    function row(r) {
      var t = r.hidden ? '<span class="qz-orow__t qz-orow__t--lock">' + svg(I.lock, 18) + esc(T.oursHidden) + '</span>' : '<span class="qz-orow__t">' + esc(r.text) + '</span>';
      var inner = '<span class="qz-orow__tx">' + t + '<span class="qz-orow__s">' + dot(r.slot, true) + esc(r.line) + '</span></span>';
      return r.editable ? '<button type="button" class="qz-orow" data-act="q-ours-edit" data-v="' + esc(r.id) + '" aria-label="' + esc(r.text + ' · 고치기') + '">' + inner + '<span class="qz-orow__pen">' + svg(I.pen, 20) + '</span></button>'
        : '<div class="qz-orow">' + inner + '</div>';
    }
    var w = m.waiting.length ? '<h2 class="asec">' + esc(T.oursWaiting) + '</h2><div class="card qz-list">' + m.waiting.map(row).join('') + '</div>' : '';
    var s = m.shown.length ? '<h2 class="asec">' + esc(T.oursShown) + '</h2><div class="card qz-list">' + m.shown.map(row).join('') + '</div>' : '';
    var empty = !w && !s ? '<div class="card qz-empty"><p class="muted">아직 넣은 질문이 없어요</p></div>' : '';
    return '<div class="mscreen qz">' + bar + w + s + empty + '<button type="button" class="solid-btn solid-btn--full qz-oadd" data-act="q-add">' + esc(T.addTitle) + '</button></div>';
  }

  var api = { entry: entry, screen: screen, swapSheet: swapSheet, addSheet: addSheet, past: past, ours: ours };
  root.RT = root.RT || {};
  root.RT.viewQuestion = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
