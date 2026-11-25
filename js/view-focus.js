/* 집중 F1 — 그리기만 (docs/focus/spec.md 2 ~ 6절, 목업 design/mockups/chosen/focus/). 값은 app-focus.js 가 만든다. 글은 focus-text.js 에서만.
   1초마다 바뀌는 숫자는 data-fc="…" 칸에 app-focus.js 가 글자만 바꿔 넣는다(다시 그리지 않음). */
(function (root) {
  'use strict';
  var F = root.RT.focus, T = root.RT.focusText.T;
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(size, d, fill) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="' + (fill ? 'none' : 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var I = {
    play: '<path d="M8 5.5v13l11-6.5z"/>', stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
    down: '<path d="M6 9l6 6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };

  // ── 집중 탭 (2) ──
  function head(m) {
    return '<header class="top fc-head"><div class="top__text"><p class="caption">' + esc(m.date) + '</p><div class="top__row"><h1 class="title">' + esc(T.title) + '</h1></div></div>' +
      '<button type="button" class="fc-mode" data-act="fc-settings" aria-label="' + esc(T.modeAria(m.strict)) + '">' + esc(T.setBtn) + '</button></header>';
  }
  function todayCard(m) {
    var t = m.today, me = m.me, on = me.state === 'run' || me.state === 'pause' || me.state === 'away';
    var kick = on ? '<span class="fc-today__kick fc-today__kick--on">' + esc(T.nowKick(me.subj)) + '</span><span class="fc-today__right" data-fc="nowR">' + esc(T.nowRight(me.runMs)) + '</span>'
      : '<span class="fc-today__kick">' + esc(T.todayKick) + '</span><span class="fc-today__right">' + esc(t.compare ? (t.compare.kind === 'more' ? T.more(t.compare.diff) : T.less(t.compare.yest)) : '') + '</span>';
    var zero = !t.me && !on;
    var chips = '';
    if (t.both) chips += '<span class="fc-chip fc-chip--both">' + esc(T.chipBoth(t.both, t.nowBoth)) + '</span>';
    if (t.her) chips += '<span class="fc-chip"><span class="fc-dot fc-dot--' + esc(m.herSlot) + '" aria-hidden="true"></span>' + esc(T.chipHer(m.herName, t.her)) + '</span>';
    var tip = m.first ? '<p class="fc-tip"><b>' + esc(T.firstTip) + '</b> ' + esc(T.firstTip2(m.herName)) + '</p>' : '';
    return tip + '<section class="card fc-card fc-today' + (on ? ' is-on' : '') + '">' +
      '<button type="button" class="fc-today__btn" data-act="fc-log" aria-label="' + esc(T.todayAria(t.me) + ' · ' + T.logTitle) + '">' +
      '<span class="fc-today__top">' + kick + '</span>' +
      '<span class="fc-big' + (zero ? ' is-zero' : '') + '" data-fc="today">' + esc(F.hms(t.me)) + '</span></button>' +
      (zero ? '<p class="fc-today__zero">' + esc(T.zero) + '</p>' : '') +
      (chips ? '<div class="fc-chips">' + chips + '</div>' : '') +
      (on ? '<div class="fc-today__acts"><button type="button" class="fc-btn is-sub" data-act="fc-open">' + esc(T.openScreen) + '</button><button type="button" class="fc-btn" data-act="fc-end">' + esc(T.end) + '</button></div>' : '') +
      '</section>';
  }
  function herLine(h) {
    if (!h || h.state == null) return '';
    if (h.state === 'run') return '<span class="fc-dot fc-dot--' + esc(h.slot) + ' fc-dot--ring" aria-hidden="true"></span>' + esc(h.together ? T.herTogether(h.together) : T.herRun(h.runMs)) + ' · ' + esc(h.strict ? T.strictTag : T.looseTag);
    if (h.state === 'pause') return esc(T.herPause(h.runMs));
    if (h.state === 'away') return esc(T.herAway);
    return esc(h.today ? T.herRest(h.today) : T.herNone);
  }
  function herBtn(h) {
    if (!h || !h.btn) return '';
    if (h.btn === 'sent') return '<button type="button" class="fc-btn is-off" disabled aria-disabled="true">' + esc(T.sent) + '</button>';
    return h.btn === 'join' ? '<button type="button" class="fc-btn" data-act="fc-join">' + esc(T.join) + '</button>'
      : '<button type="button" class="fc-btn is-sub" data-act="fc-call">' + esc(T.call) + '</button>';
  }
  function partnerCard(m) {
    var h = m.her; if (!h) return '';
    return '<section class="card fc-card fc-pcard' + (h.state === 'away' ? ' is-away' : '') + '" aria-label="' + esc(m.herName) + '">' +
      '<span class="fc-avatar fc-avatar--' + esc(h.slot) + '" aria-hidden="true">' + esc(Array.from(m.herName || '?')[0]) + '</span>' +
      '<span class="fc-pcard__tx"><span class="fc-pcard__name">' + esc(m.herName + (h.subj && (h.state === 'run' || h.state === 'pause') ? ' · ' + h.subj : '')) + '</span>' +
      '<span class="fc-pcard__st" data-fc="herSt">' + herLine(h) + '</span></span>' + herBtn(h) + '</section>';
  }
  function subjects(m) {
    var rows = m.subjects.map(function (s) {
      var ic = s.icon ? '<span class="fc-row__ic" aria-hidden="true">' + esc(s.icon) + '</span>' : '';
      var sub = s.active ? '<span class="fc-row__sub fc-row__sub--on" data-fc="rowNow">' + esc(T.subjNow(s.activeLabel, s.activeMs)) + '</span>'
        : s.labels ? '<span class="fc-row__sub">' + esc(s.labels) + '</span>' : '';
      return '<li class="fc-row' + (s.active ? ' is-active' : '') + '"><span class="fc-row__bar" aria-hidden="true"></span>' +
        '<span class="fc-row__tx"><span class="fc-row__name">' + ic + esc(s.name) + '</span>' + sub + '</span>' +
        '<span class="fc-row__t">' + esc(F.hm(s.todayMs)) + '</span>' +
        (s.active ? '<button type="button" class="fc-play is-on" data-act="fc-end" aria-label="' + esc(T.stopAria(s.name)) + '">' + svg(16, I.stop, true) + '</button>'
          : '<button type="button" class="fc-play" data-act="fc-play" data-v="' + esc(s.id) + '" aria-label="' + esc(T.playAria(s.name)) + '">' + svg(16, I.play, true) + '</button>') + '</li>';
    }).join('');
    return '<h2 class="asec">' + esc(T.subjHead) + '</h2><section class="card fc-list"><ul class="fc-rows">' + rows + '</ul>' +
      '<div class="fc-list__foot">' + (m.moreCount ? '<button type="button" class="fc-link fc-link--row" data-act="fc-subj" aria-label="' + esc(T.subjMore(m.moreCount)) + '"><span>' + esc(T.subjMoreL) + '</span><span class="fc-link__n">' + esc(T.subjMoreN(m.moreCount)) + ' ›</span></button>' : '') +
      '<button type="button" class="fc-link" data-act="fc-subj" data-v="label">' + esc(T.subjLabelStart) + '</button></div></section>';
  }
  function weekCard(m) {
    var w = m.week;
    if (w.empty) return '<section class="card fc-card fc-week"><h2 class="fc-week__t">' + esc(T.week) + '</h2><p class="fc-week__empty">' + esc(T.weekEmpty) + '</p></section>';
    var cols = w.days.map(function (d, i) {
      function bar(slot, h, bh) {
        var px = Math.round(h * 72), bpx = Math.round(bh * 72);
        if (!px) return '<span class="fc-bar fc-bar--zero"></span>';
        return '<span class="fc-bar fc-bar--' + slot + '" style="height:' + px + 'px">' + (bpx ? '<span class="fc-bar__both" style="height:' + Math.min(px, bpx) + 'px"></span>' : '') + '</span>';
      }
      return '<button type="button" class="fc-wcol' + (d.today ? ' is-today' : '') + (d.future ? ' is-future' : '') + (i === w.pick ? ' is-pick' : '') + '" data-act="fc-wday" data-v="' + i + '"' + (d.future ? ' disabled' : '') + ' aria-label="' + esc(T.dows[i]) + '">' +
        '<span class="fc-wcol__bars">' + bar('me', d.meH, d.bothH) + bar('her', d.herH, d.bothH) + '</span><span class="fc-wcol__d">' + esc(T.dows[i]) + '</span></button>';
    }).join('');
    var p = w.days[w.pick] || w.days[0];
    return '<section class="card fc-card fc-week"><div class="fc-week__head"><h2 class="fc-week__t">' + esc(T.week) + '</h2><span class="fc-legend">' +
      '<span><i class="fc-legend__me"></i>' + esc(T.legMe) + '</span><span><i class="fc-legend__her"></i>' + esc(m.herName) + '</span><span><i class="fc-legend__both"></i>' + esc(T.legBoth) + '</span></span></div>' +
      '<div class="fc-wgrid" role="img" aria-label="' + esc(T.weekAria(w.days.map(function (d, i) { return { dow: T.dows[i], me: d.me, her: d.her }; }), m.herName)) + '">' + cols + '</div>' +
      '<p class="fc-week__line">' + esc(T.weekLine(p.today ? T.weekToday : T.dows[w.pick], p.me, m.herName, p.her, p.both)) + '</p>' + weekSubj(w.subjects) + '</section>';
  }
  function weekSubj(list) {
    if (!list || !list.length) return '';
    return '<div class="fc-wsub"><h3 class="fc-wsub__t">' + esc(T.weekSubjHead) + '</h3><ul class="fc-wsub__list">' + list.map(function (x) {
      return '<li class="fc-wsub__row"><span class="fc-wsub__tx"><span class="fc-wsub__name">' + (x.icon ? '<span class="fc-row__ic" aria-hidden="true">' + esc(x.icon) + '</span>' : '') + esc(x.name) + '</span>' +
        (x.labels ? '<span class="fc-wsub__labs">' + esc(x.labels) + '</span>' : '') + '</span><span class="fc-wsub__ms">' + esc(F.hm(x.ms)) + '</span></li>';
    }).join('') + '</ul></div>';
  }
  function tab(m) {
    if (m.error) return head(m) + '<section class="card notice" role="status"><p class="notice__body">' + esc(m.error) + '</p></section>';
    return '<div class="fc-tab">' + head(m) + todayCard(m) + partnerCard(m) + subjects(m) + weekCard(m) + '</div>';
  }

  // ── 집중 화면 (3) ──
  var R = 132, C = 2 * Math.PI * R; // 288px 링 (굵기 12) — 반지름은 viewBox 288 기준
  function ring(m) {
    if (m.pixelRing) return '<div class="fc-ring fc-ring--px" aria-hidden="true">' + m.pixelRing + '</div>';
    var p = m.state === 'run' || m.state === 'pause' || m.state === 'away' ? m.progress : 0;
    var still = m.state !== 'run';
    var ang = p * 2 * Math.PI - Math.PI / 2, ex = 144 + R * Math.cos(ang), ey = 144 + R * Math.sin(ang);
    return '<svg class="fc-ring" viewBox="0 0 288 288" aria-hidden="true"><circle class="fc-ring__track" cx="144" cy="144" r="' + R + '"/>' +
      '<circle class="fc-ring__bar' + (still ? ' is-still' : '') + '" data-fc="ring" cx="144" cy="144" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - p)).toFixed(1) + '" transform="rotate(-90 144 144)"/>' +
      (still ? '' : '<circle class="fc-ring__tip" data-fc="tip" cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="7"/>') + '</svg>';
  }
  function screen(m) {
    if (m.done) return doneScreen(m);
    var away = m.state === 'away', paused = m.state === 'pause';
    var badge = m.badge ? '<span class="fc-badge fc-badge--' + esc(m.badge.kind) + '" data-fc="badge">' + esc(m.badge.kind === 'both' ? T.badgeBoth(m.badge.ms) : T.badgePause(m.badge.ms)) + '</span>' : '<span class="fc-badge fc-badge--none"></span>';
    var note = away ? '<div class="fc-away"><p class="fc-away__t">' + esc(T.awayTitle) + '</p><p class="fc-away__b">' + esc(T.awayBody(m.awayMs)) + '</p></div>'
      : '<p class="fc-note">' + esc(paused ? T.pauseNote : m.wake === false ? T.noWake : T.wake) + '</p>';
    var h = m.her, pc = '';
    if (h) {
      var line = h.state === 'run' ? (h.together ? T.herTogether(h.together) : T.herRun(h.runMs)) : h.state === 'pause' ? T.herPause(h.runMs) : h.state === 'away' ? T.herAway : '';
      pc = '<section class="card fc-pcard fc-pcard--screen">' +
        '<span class="fc-avatar fc-avatar--' + esc(h.slot) + '" aria-hidden="true">' + esc(Array.from(m.herName || '?')[0]) + '</span>' +
        '<span class="fc-pcard__tx"><span class="fc-pcard__name">' + esc(h.state === 'run' || h.state === 'pause' ? T.pRun(m.herName, h.subj || '') : T.pRest(m.herName, h.today || 0)) + '</span>' +
        (line ? '<span class="fc-pcard__st" data-fc="herSt2">' + (h.state === 'run' ? '<span class="fc-dot fc-dot--' + esc(h.slot) + '" aria-hidden="true"></span>' : '') + esc(line) + '</span>' : '') + '</span>' +
        (h.state === 'run' || h.state === 'pause' ? '<span class="fc-time fc-pcard__t" data-fc="herT">' + esc(F.hm(h.runMs)) + '</span>' : herBtn(h)) + '</section>';
    }
    var acts = away ? '<button type="button" class="fc-btn is-sub" data-act="fc-end">' + esc(T.endHere) + '</button><button type="button" class="fc-btn" data-act="fc-resume">' + esc(T.resume) + '</button>'
      : paused ? '<button type="button" class="fc-btn is-sub" data-act="fc-end">' + esc(T.end) + '</button><button type="button" class="fc-btn" data-act="fc-resume">' + esc(T.resume) + '</button>'
      : '<button type="button" class="fc-btn is-sub" data-act="fc-pause">' + esc(T.pause) + '</button><button type="button" class="fc-btn" data-act="fc-end">' + esc(T.end) + '</button>';
    return '<div class="fc-screen' + (m.s3 ? ' has-s3' : '') + '" role="region" aria-label="' + esc(T.title) + '">' +
      '<div class="fc-top"><button type="button" class="fc-down" data-act="fc-down" aria-label="' + esc(T.down) + '">' + svg(24, I.down) + '</button>' +
      '<span class="fc-subject"><span class="fc-dot fc-dot--' + esc(m.meSlot) + '" aria-hidden="true"></span>' + esc(m.subj) + '</span>' +
      '<span class="fc-top__mode">' + esc(m.strict ? T.modeStrictBtn : T.modeLoose) + '</span></div>' +
      '<div class="fc-badge-row">' + badge + '</div>' +
      '<div class="fc-ringbox">' + ring(m) + '<div class="fc-ringbox__in"><span class="fc-time fc-time--big' + (m.state !== 'run' ? ' is-still' : '') + '" data-fc="run">' + esc(F.hms(m.runMs)) + '</span>' +
      '<span class="fc-ringbox__sum" data-fc="sum">' + esc(T.todaySum(m.todayMs)) + '</span></div></div>' +
      note + (m.s3 ? '<div class="fc-s3 is-focus' + (m.state === 'run' && !m.reduceMotion ? ' is-running' : ' is-still') + '" aria-hidden="true">' + m.s3 + '</div>' : '<div class="fc-grow"></div>') +
      pc + '<div class="fc-acts">' + acts + '</div></div>';
  }
  function doneScreen(m) {
    var d = m.done;
    var art = d.s3 ? '<div class="fc-s3 fc-s3--done" aria-hidden="true">' + d.s3 + '</div>' : '<span class="fc-donecheck" aria-hidden="true">' + svg(48, I.check) + '</span>';
    var a = d.both ? '<div class="fc-stat"><span class="fc-stat__k">' + esc(T.doneBoth(m.herName)) + '</span><span class="fc-stat__v">' + esc(F.hm(d.both)) + '</span></div>'
      : '<div class="fc-stat"><span class="fc-stat__k">' + esc(T.doneHerWeek(m.herName)) + '</span><span class="fc-stat__v">' + esc(F.hm(d.herWeek)) + '</span></div>';
    return '<div class="fc-screen fc-screen--done" role="region" aria-label="' + esc(T.doneTitle(d.today)) + '">' + art +
      '<h2 class="fc-done__t">' + esc(T.doneTitle(d.today)) + '</h2><p class="fc-done__s">' + esc(T.doneThis(d.subj, d.thisMs)) + '</p>' +
      '<div class="fc-stats">' + a + '<div class="fc-stat"><span class="fc-stat__k">' + esc(T.doneMeWeek) + '</span><span class="fc-stat__v">' + esc(F.hm(d.meWeek)) + '</span></div></div>' +
      '<div class="fc-grow"></div>' + (d.logId ? '<button type="button" class="fc-link fc-link--center" data-act="fc-edit" data-v="' + esc(d.logId) + '">' + esc(T.editTime) + '</button>' : '') +
      '<div class="fc-acts fc-acts--one"><button type="button" class="fc-btn" data-act="fc-done-ok">' + esc(T.ok) + '</button></div></div>';
  }

  // ── 시트 (4) ──
  function sheetWrap(id, body, entering, closeAct) {
    return '<div class="sheet-layer"><button type="button" class="scrim" data-act="' + (closeAct || 'fc-sheet-close') + '" aria-label="' + esc(T.close) + '"></button>' +
      '<section class="sheet sheet--tall fc-sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '"><span class="grabber" aria-hidden="true"></span>' + body + '</section></div>';
  }
  function subjSheet(s, entering) {
    var cats = s.cats.map(function (c) {
      return '<button type="button" class="fc-cat" data-act="fc-pick" data-v="' + esc(c.id) + '" aria-pressed="' + (c.picked ? 'true' : 'false') + '">' + (c.icon ? '<span class="fc-cat__ic" aria-hidden="true">' + esc(c.icon) + '</span>' : '') + '<span>' + esc(c.name) + '</span></button>';
    }).join('');
    var chips = s.labels.map(function (l) { return '<button type="button" class="chip fc-lchip" data-act="fc-lchip" data-v="' + esc(l) + '" aria-pressed="' + (l === s.label ? 'true' : 'false') + '">' + esc(l) + '</button>'; }).join('');
    return sheetWrap('fc-subj-t', '<h2 class="sheet__title" id="fc-subj-t">' + esc(T.subjTitle) + '</h2><p class="sheet__sub">' + esc(T.subjSub) + '</p>' +
      '<div class="fc-cats">' + cats + '</div>' + (s.more ? '<button type="button" class="fc-link" data-act="fc-catmore">' + esc(T.subjMoreCats(s.more)) + '</button>' : '') +
      '<label class="fc-lab" for="fc-label">' + esc(T.labelHead) + '</label><div class="fc-inrow"><input id="fc-label" class="field__input" type="text" maxlength="8" autocomplete="off" value="' + esc(s.label) + '"><span class="fc-count" id="fc-label-n">' + esc(T.labelCount(Array.from(s.label || '').length)) + '</span></div>' +
      (chips ? '<div class="fc-lchips">' + chips + '</div>' : '') +
      '<button type="button" class="solid-btn fc-sheet__go" data-act="fc-start"' + (s.cat ? '' : ' disabled') + '>' + esc(s.mode === 'change' ? T.changeBtn : T.startBtn(s.subj)) + '</button>', entering);
  }
  function settingsSheet(s, entering) {
    return sheetWrap('fc-set-t', '<h2 class="sheet__title" id="fc-set-t">' + esc(T.setTitle) + '</h2><p class="sheet__sub">' + esc(T.setSub(s.herName)) + '</p>' +
      '<h3 class="fc-lab fc-set__h fc-set__h--first">' + esc(T.modeHead) + '</h3>' +
      '<div class="seg fc-seg" role="group"><button type="button" class="seg__btn" data-act="fc-mode" data-v="loose" aria-pressed="' + (!s.strict) + '"' + (s.busy ? ' disabled' : '') + '>' + esc(T.modeLoose) + '</button>' +
      '<button type="button" class="seg__btn" data-act="fc-mode" data-v="strict" aria-pressed="' + (!!s.strict) + '"' + (s.busy ? ' disabled' : '') + '>' + esc(T.modeStrictBtn) + '</button></div>' +
      '<p class="fc-explain">' + esc(s.strict ? T.setStrict : T.setLoose) + '</p>' +
      '<p class="fc-small">' + esc(T.setNote(s.herName)) + '</p>' + (s.busy ? '<p class="fc-small">' + esc(T.setBusy) + '</p>' : '') +
      ((s.cats || []).length ? '<h3 class="fc-lab fc-set__h" id="fc-catvis-h">' + esc(T.catVisHead) + '</h3><p class="fc-small">' + esc(T.catVisSub) + '</p>' +
        '<div class="fc-lchips fc-catvis" role="group" aria-labelledby="fc-catvis-h">' + s.cats.map(function (c) {
          return '<button type="button" class="chip fc-cchip" data-act="fc-catvis" data-v="' + esc(c.id) + '" aria-pressed="' + (c.on ? 'true' : 'false') + '">' + (c.icon ? '<span aria-hidden="true">' + esc(c.icon) + '</span> ' : '') + esc(c.name) + '</button>';
        }).join('') + '</div>' : '') +
      '<button type="button" class="close-btn" data-act="fc-sheet-close">' + esc(T.close) + '</button>', entering);
  }
  function stillSheet(s, entering) {
    return sheetWrap('fc-still-t', '<h2 class="sheet__title" id="fc-still-t">' + esc(T.stillTitle) + '</h2><p class="sheet__sub">' + esc(T.stillBody(s.start)) + '</p>' +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="fc-end">' + esc(T.endHere) + '</button><button type="button" class="solid-btn" data-act="fc-still-yes">' + esc(T.stillYes) + '</button></div>', entering, 'fc-still-yes');
  }
  function endSheet(s, entering) {
    var chips = s.chips.map(function (c) { return '<button type="button" class="chip" data-act="fc-endpick" data-v="' + c.t + '" aria-pressed="' + (c.picked ? 'true' : 'false') + '">' + esc(c.label) + '</button>'; }).join('');
    return sheetWrap('fc-endt', '<h2 class="sheet__title" id="fc-endt">' + esc(T.endTitle(s.start)) + '</h2><p class="sheet__sub">' + esc(T.endBody) + '</p>' +
      '<div class="fc-lchips">' + chips + '</div><label class="fc-lab" for="fc-endtime">' + esc(T.endPick) + '</label><input id="fc-endtime" class="field__input" type="datetime-local" min="' + esc(s.min) + '" max="' + esc(s.max) + '" value="' + esc(s.value) + '">' +
      '<button type="button" class="solid-btn fc-sheet__go" data-act="fc-endsave">' + esc(T.endSave(s.ms)) + '</button><button type="button" class="text-btn fc-link--center" data-act="fc-endskip">' + esc(T.endSkip) + '</button>', entering, 'fc-noop');
  }
  function logSheet(s, entering) {
    var rows = s.rows.length ? s.rows.map(function (r) {
      return '<li><button type="button" class="fc-logrow" data-act="fc-edit" data-v="' + esc(r.id) + '"><span class="fc-logrow__t">' + esc(T.logRow(r.start, r.end)) + '</span><span class="fc-logrow__s">' + esc(r.subj) + '</span><span class="fc-logrow__m">' + esc(F.hm(r.ms)) + '</span></button></li>';
    }).join('') : '<li class="fc-small">' + esc(T.logEmpty) + '</li>';
    return sheetWrap('fc-log-t', '<h2 class="sheet__title" id="fc-log-t">' + esc(T.logTitle) + '</h2><ul class="fc-logs">' + rows + '</ul><button type="button" class="close-btn" data-act="fc-sheet-close">' + esc(T.close) + '</button>', entering);
  }
  function editSheet(s, entering) {
    if (s.confirmDel) return sheetWrap('fc-del-t', '<h2 class="sheet__title" id="fc-del-t">' + esc(T.delAsk(s.ms)) + '</h2><div class="rform__actions"><button type="button" class="ghost-btn" data-act="fc-delno">' + esc(T.keep) + '</button><button type="button" class="solid-btn" data-act="fc-delyes">' + esc(T.del) + '</button></div>', entering);
    var err = s.err ? '<p class="fc-err" role="status">' + esc(s.err) + '</p>' : '';
    return sheetWrap('fc-edit-t', '<h2 class="sheet__title" id="fc-edit-t">' + esc(T.editTitle) + '</h2><p class="sheet__sub">' + esc(T.editSub(s.subj)) + '</p>' +
      '<div class="fc-times"><label class="fc-lab" for="fc-es">' + esc(T.editStart) + '<input id="fc-es" class="field__input" type="time" value="' + esc(s.startVal) + '"></label>' +
      '<label class="fc-lab" for="fc-ee">' + esc(T.editEnd) + '<input id="fc-ee" class="field__input" type="time" value="' + esc(s.endVal) + '"></label></div>' +
      '<button type="button" class="fc-link" data-act="fc-edit-subj">' + esc(T.editSubj) + ' · ' + esc(s.subj) + ' ' + svg(14, I.chev) + '</button>' +
      '<p class="fc-small">' + esc(T.editNote) + '</p>' + err +
      '<button type="button" class="solid-btn fc-sheet__go" data-act="fc-editsave"' + (s.err ? ' disabled' : '') + '>' + esc(T.editSave(s.ms)) + '</button>' +
      '<button type="button" class="text-btn fc-del" data-act="fc-del">' + esc(T.editDel) + '</button>', entering);
  }

  // ── 띠 (6-1) ──
  function bandHtml(b) {
    if (!b) return '';
    var left = b.kind === 'partner' ? T.bandPartner(b.name, b.cat, b.ms) : b.kind === 'me' ? T.bandMe(b.subj, b.ms) : b.kind === 'both' ? T.bandBoth(b.ms) : T.bandPause(b.ms);
    var cls = b.kind === 'partner' ? '' : b.kind === 'both' ? ' is-both' : ' is-me';
    return '<button type="button" class="fc-band' + cls + '" data-act="fc-band" data-v="' + esc(b.kind) + '"><span class="fc-band__l" data-fc="band">' + esc(left) + '</span>' +
      '<span class="fc-band__r">' + esc(b.kind === 'partner' ? T.bandJoin : T.bandSee) + '</span></button>';
  }

  var api = { tab: tab, screen: screen, subjSheet: subjSheet, settingsSheet: settingsSheet, stillSheet: stillSheet, endSheet: endSheet, logSheet: logSheet, editSheet: editSheet, band: bandHtml, RING_C: C, RING_R: R };
  root.RT = root.RT || {};
  root.RT.viewFocus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
