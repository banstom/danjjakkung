/* 화면 그리기 — 「돌아보기」 탭 (목업 design/mockups/01-review 시안 A). 값은 js/review.js, 상태는 app.js. */
(function (root) {
  'use strict';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var CHEVRON = {
    prev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
  };
  var CELL_TEXT = { full: '함', none: '안 함', pre: '시작 전', future: '아직', rest: '쉼', s1: '조금 함', s2: '절반쯤 함', s3: '거의 다 함' };

  function stat(label, value, clean) {
    return '<div class="stat' + (clean ? ' stat--clean' : '') + '"><span class="stat__label">' + esc(label) + '</span><span class="stat__value">' + esc(value) + '</span></div>';
  }

  function head(m) {
    var unit = m.mode === 'week' ? '주' : '달';
    // 결산(R3): 「주 · 달 · 결산」 세 칸 — 결산 칸 화면은 js/view-recap.js
    return '<div class="plan__bar"><div class="seg seg--3" role="group" aria-label="돌아볼 기간">' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="week" aria-pressed="' + (m.mode === 'week') + '">주</button>' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="month" aria-pressed="' + (m.mode === 'month') + '">달</button>' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="recap" aria-pressed="false">결산</button></div></div>' +
      '<section class="card rv-us" aria-label="' + esc(m.title) + '"' + (m.loading ? ' aria-busy="true"' : '') + '>' +
      '<div class="grid-head">' +
      '<button type="button" class="icon-btn" data-act="rv-page" data-dir="1" aria-label="이전 ' + unit + '"' + (m.canPrev ? '' : ' disabled') + '>' + CHEVRON.prev + '</button>' +
      '<span class="grid-title"><span class="grid-range">' + esc(m.label) + '</span>' +
      (m.page > 0 ? '<button type="button" class="mini-btn" data-act="rv-now">이번 ' + unit + '</button>' : '') + '</span>' +
      '<button type="button" class="icon-btn" data-act="rv-page" data-dir="-1" aria-label="다음 ' + unit + '"' + (m.canNext ? '' : ' disabled') + '>' + CHEVRON.next + '</button>' +
      (m.mode === 'month' && m.monthView ? viewSwitch(m.monthView) : '') +
      '</div>' +
      '<h2 class="rv-title">' + esc(m.title) + '</h2>' +
      // 끝낸 일 · 꿍은 기간을 넘길 때마다 새로 불러온다 — 불러오는 동안은 앞 기간 값(대개 0)이 잠깐 보이지 않게 「–」
      '<div class="rv-quad">' + stat('모두 해낸 날', m.us.allDays + '일', true) + stat('함께 끝낸 일', m.loading ? '–' : m.us.togetherDone + '개') +
      (m.us.kungs === null ? '' : stat('꿍 주고받음', m.loading ? '–' : m.us.kungs + '번')) + stat('함께 일정', m.us.togetherTime) + '</div></section>';
  }

  function cells(list, both, name) {
    return list.map(function (c, i) {
      var cls = c === 'full' ? (both ? 'rv-cell--both' : 'lv-full') : c === 'none' ? 'lv-none' : c === 'pre' ? 'rv-cell--pre' : c === 'rest' ? 'lv-rest' : /^s[123]$/.test(c) ? 'lv-' + c : 'rv-cell--future';
      return '<span class="rv-cell ' + cls + '" role="img" aria-label="' + esc(name + ' ' + ['월', '화', '수', '목', '금', '토', '일'][i] + ' ' + CELL_TEXT[c]) + '"></span>';
    }).join('');
  }

  // ── v54 R1: 달 보기 = 루틴마다 한 달 (A 카드 · B 띠). 목업 design/mockups/chosen/R1-A-카드 · R1-B-띠 ──
  var ICON_CARD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>';
  var ICON_STRIP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var DOWS = ['월', '화', '수', '목', '금', '토', '일'];
  function viewSwitch(v) {
    return '<span class="rv-vsw" role="group" aria-label="달 보기 모양">' +
      '<button type="button" class="rv-vsw__btn" data-act="rv-view" data-v="card" aria-label="카드로 보기" aria-pressed="' + (v === 'card') + '">' + ICON_CARD + '</button>' +
      '<button type="button" class="rv-vsw__btn" data-act="rv-view" data-v="strip" aria-label="띠로 보기" aria-pressed="' + (v === 'strip') + '">' + ICON_STRIP + '</button></span>';
  }
  /** 칸 하나. c = { n, st, today }, slot = 루틴 주인 색(me | her) | null(「모두」), nums = 숫자 보이기 */
  function dcell(c, slot, nums) {
    var st = c.st === 'done' ? 'rv-d--' + (slot || 'me') : c.st === 'miss' || c.st === 'none' ? 'rv-d--miss' : c.st === 'full' ? 'rv-d--full' : c.st === 'half' ? 'rv-d--half' : c.st === 'rest' ? 'rv-d--rest' : 'rv-d--fut';
    return '<span class="rv-d ' + st + (c.today ? ' rv-d--today' : '') + '">' + (nums ? '<span class="rv-d__n">' + c.n + '</span>' : '') + '</span>';
  }
  function cal(cells, lead, slot, cls, label, dows) {
    var out = '<div class="rv-cal ' + cls + '" role="img" aria-label="' + esc(label) + '">';
    if (dows) out += DOWS.map(function (d) { return '<span class="rv-cal__dow" aria-hidden="true">' + d + '</span>'; }).join('');
    for (var i = 0; i < lead; i++) out += '<span class="rv-d rv-d--blank" aria-hidden="true"></span>';
    return out + cells.map(function (c) { return dcell(c, slot, true); }).join('') + '</div>';
  }
  function rowLabel(r, month) { return r.name + ' ' + month + ': 해야 했던 ' + r.due + '일 중 ' + r.done + '일 해냄' + (r.due ? ' (' + r.pct + '%)' : ''); }
  function monthCard(rt, mm, label) {
    var mo = rt.month;
    var all = '<section class="card rv-mall" aria-label="모두"><div class="rv-mall__head"><h2 class="rv-title">모두</h2><span class="rv-sub">둘 다 해낸 날 <b>' + mo.bothDays + '일</b> / 지난 날 ' + mo.pastDays + '일</span></div>' +
      cal(mo.all, mo.lead, null, 'rv-cal--big', '모두 ' + label + ': 지난 ' + mo.pastDays + '일 중 둘 다 해낸 날 ' + mo.bothDays + '일', true) +
      '<div class="legend rv-lg"><span class="legend__item"><span class="swatch rv-d--full"></span>둘 다 해냄</span><span class="legend__item"><span class="swatch rv-d--half"></span>한 사람만</span><span class="legend__item"><span class="swatch rv-d--miss"></span>둘 다 못 함</span></div></section>';
    var people = mo.groups.map(function (g) {
      return '<h3 class="rv-mwho"><span class="dot dot--' + esc(g.slot) + '"></span>' + esc(g.name) + '</h3><div class="rv-mgrid">' + g.rows.map(function (r) {
        return '<section class="card rv-mcard" aria-label="' + esc(r.name) + '"><h4 class="rv-mcard__name">' + esc(r.name) + '</h4>' +
          cal(r.cells, mo.lead, g.slot, 'rv-cal--sm', rowLabel(r, label), false) +
          '<p class="rv-mcard__stat" aria-hidden="true">✓ ' + r.done + '/' + r.due + ' · ' + r.pct + '%</p></section>';
      }).join('') + '</div>';
    }).join('');
    return all + people + legendMonth();
  }
  function legendMonth() {
    return '<div class="legend rv-lg rv-lg--foot"><span class="legend__item"><span class="swatch rv-d--me"></span>해냄(사람 색)</span><span class="legend__item"><span class="swatch rv-d--miss"></span>못 함</span>' +
      '<span class="legend__item"><span class="swatch rv-d--rest"></span>쉬는 날 · 만들기 전</span><span class="legend__item"><span class="swatch rv-d--fut"></span>오늘 이후</span></div>';
  }
  function monthStrip(rt, mm, label) {
    var mo = rt.month, n = mo.all.length;
    var scale = '<div class="rv-strip rv-strip--scale" style="--n:' + n + '" aria-hidden="true">' + mo.all.map(function (c) { return '<span>' + (c.mon || c.n === 1 ? c.n : '') + '</span>'; }).join('') + '</div>';
    function strip(cells, slot) { return '<div class="rv-strip" style="--n:' + n + '" aria-hidden="true">' + cells.map(function (c) { return dcell(c, slot, false); }).join('') + '</div>'; }
    var rows = '<div class="rv-srow rv-srow--all" role="img" aria-label="' + esc('모두 ' + label + ': 둘 다 해낸 날 ' + mo.bothDays + '일') + '"><span class="rv-srow__head"><b class="rv-srow__name">모두</b><span class="rv-srow__n">둘 다 ' + mo.bothDays + '일</span></span>' + strip(mo.all, null) + '</div>';
    mo.groups.forEach(function (g) {
      g.rows.forEach(function (r) {
        rows += '<button type="button" class="rv-srow" data-act="rv-row" data-v="' + esc(r.key) + '" aria-label="' + esc(rowLabel(r, label) + ' · 한 달 달력 보기') + '">' +
          '<span class="rv-srow__head"><span class="dot dot--' + esc(g.slot) + '"></span><b class="rv-srow__name">' + esc(r.name) + '</b><span class="rv-srow__n">' + r.done + '/' + r.due + ' · ' + r.pct + '%</span></span>' + strip(r.cells, g.slot) + '</button>';
      });
    });
    return '<section class="card rv-sbox" aria-label="루틴 한 달">' + scale + rows + '</section>' +
      '<div class="legend rv-lg rv-lg--foot"><span class="legend__item"><span class="swatch rv-d--me"></span>' + esc(mm.meName || '나') + '</span><span class="legend__item"><span class="swatch rv-d--her"></span>' + esc(mm.partnerName || '단짝') + '</span>' +
      '<span class="legend__item"><span class="swatch rv-d--full"></span>모두</span><span class="legend__item"><span class="swatch rv-d--miss"></span>못 함</span><span class="legend__item"><span class="swatch rv-d--rest"></span>쉬는 날</span></div>' +
      '<p class="rv-note rv-note--sub">숫자는 월요일 · 줄을 누르면 그 루틴의 한 달 달력</p>';
  }
  /** 띠 줄을 누르면: 그 루틴의 한 달 달력 (A 의 작은 카드를 크게). s = { row, lead, label } */
  function rowSheet(s, entering) {
    var r = s.row;
    return '<div class="sheet-layer"><button type="button" class="scrim" data-act="rv-row-close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="rvrow-title"><span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="rvrow-title" class="sheet__title"><span class="dot dot--' + esc(r.slot) + '"></span> ' + esc(r.name) + '</h2></div>' +
      '<p class="sheet__sub">' + esc(s.label) + '</p>' +
      cal(r.cells, s.lead, r.slot, 'rv-cal--big', rowLabel(r, s.label), true) +
      '<p class="rv-mcard__stat rv-mcard__stat--big" aria-hidden="true">✓ ' + r.done + '/' + r.due + ' · ' + r.pct + '%</p>' + legendMonth() +
      '<button type="button" class="close-btn" data-act="rv-row-close">닫기</button></section></div>';
  }

  function routineCard(rt, mm) {
    if (!rt.groups.length) return '';
    if (rt.month && mm && mm.monthView) return mm.monthView === 'strip' ? monthStrip(rt, mm, mm.label) : monthCard(rt, mm, mm.label);
    var body;
    if (rt.week) {
      body = '<div class="rv-grid"><span></span>' + rt.dows.map(function (d) { return '<span class="dow">' + d + '</span>'; }).join('');
      rt.groups.forEach(function (g) {
        body += '<div class="rv-who"><span class="dot dot--' + esc(g.slot) + '"></span>' + esc(g.name) + '</div>';
        g.rows.forEach(function (r) {
          body += '<span class="rv-name"><span class="emoji-tile rv-tile" aria-hidden="true">' + esc(r.icon) + '</span><span class="rv-name__text">' + esc(r.name) + '</span></span>' + cells(r.cells, false, r.name);
        });
      });
      body += '<div class="rv-sep"></div><span class="rv-name rv-name--both"><span class="emoji-tile rv-tile" aria-hidden="true">🎉</span><span class="rv-name__text">모두 해낸 날</span></span>' + cells(rt.all, true, '모두 해낸 날') + '</div>' +
        '<div class="grid-foot"><span class="legend"><span class="legend__item"><span class="swatch lv-none"></span>안 함</span><span class="legend__item"><span class="swatch lv-full"></span>함</span>' +
        '<span class="legend__item"><span class="swatch lv-s1"></span><span class="swatch lv-s2"></span><span class="swatch lv-s3"></span>일부</span>' +
        '<span class="legend__item"><span class="swatch rv-cell--both"></span>모두</span>' +
        (rt.hasRest ? '<span class="legend__item"><span class="swatch lv-rest"></span>쉼</span>' : '') + '<span class="legend__item"><span class="swatch rv-cell--pre"></span>시작 전 · 아직</span></span></div>';
    } else {
      body = '<div class="rv-bars">';
      rt.groups.forEach(function (g) {
        body += '<div class="rv-who"><span class="dot dot--' + esc(g.slot) + '"></span>' + esc(g.name) + '</div>';
        g.rows.forEach(function (r) {
          var pct = r.active ? Math.round(r.done / r.active * 100) : 0;
          body += '<div class="rv-bar rv-bar--routine"><span class="rv-name"><span class="emoji-tile rv-tile" aria-hidden="true">' + esc(r.icon) + '</span><span class="rv-name__text">' + esc(r.name) + '</span></span>' +
            '<span class="rv-bar__track"><span class="rv-bar__fill lv-full" style="width:' + pct + '%"></span></span><span class="rv-bar__n">' + r.done + '/' + r.active + '</span></div>';
        });
      });
      body += '</div>';
    }
    return '<section class="card" aria-label="루틴 돌아보기"><div class="rv-head"><h2 class="rv-title">루틴</h2><span class="rv-sub">달성 ' + rt.done + ' / ' + rt.total + '칸</span></div>' + body + '</section>';
  }

  function todoCard(t) {
    var quads = t.quads.map(function (q) {
      return '<div class="mini-plane__q' + (q.key === 'plan' && q.n > 0 ? ' is-key' : '') + '"><span class="mini-plane__label">' + esc(q.label) + '</span><span class="mini-plane__n">' + q.n + '</span></div>';
    }).join('');
    var note = t.plan > 0 ? '<p class="rv-note">📌 <b>급해지기 전에</b> 끝낸 중요한 일이 ' + t.plan + '개예요</p>' : '';
    var bars = t.byWho.map(function (b) {
      return '<div class="rv-bar"><span>' + esc(b.name) + '</span><span class="rv-bar__track"><span class="rv-bar__fill rv-fill--' + esc(b.slot) + '" style="width:' + b.pct + '%"></span></span><span class="rv-bar__n">' + b.n + '</span></div>';
    }).join('');
    return '<section class="card" aria-label="끝낸 일 돌아보기"><div class="rv-head"><h2 class="rv-title">끝낸 일</h2><span class="rv-sub">' + t.total + '개 · 끝낼 때 평면 자리</span></div>' +
      (t.total ? '<div class="mini-plane">' + quads + '</div>' + note +
        (t.unplaced ? '<p class="rv-note rv-note--sub">평면에 안 놓고 끝낸 일 ' + t.unplaced + '개</p>' : '') +
        '<div class="rv-bars">' + bars + '</div>'
        : '<p class="muted">이 기간에 끝낸 일이 없어요</p>') + '</section>';
  }

  function focusCard(f) {
    if (!f || !RT.focus) return '';
    var hm = RT.focus.hm;
    var top = f.top.length ? ' · 많이 한 과목 ' + f.top.map(function (t) { return (t.icon ? t.icon + ' ' : '') + t.name + ' ' + hm(t.ms); }).join(', ') : '';
    return '<section class="card both" aria-label="집중 돌아보기"><div class="both__text"><span class="both__title">⏱️ 함께 집중</span>' +
      '<span class="both__hint">나 ' + esc(hm(f.me)) + ' · ' + esc(f.herName) + ' ' + esc(hm(f.her)) + esc(top) + '</span></div>' +
      '<span class="both__value">' + esc(hm(f.both)) + '</span></section>';
  }
  function kungCard(k) {
    if (!k) return ''; // 꿍을 불러오지 못했으면(규칙이 아직 없는 등) 칸을 숨긴다
    return '<section class="card both" aria-label="꿍 돌아보기"><div class="both__text"><span class="both__title">💞 꿍 주고받음</span>' +
      '<span class="both__hint">' + (k.n ? '꿍 받은 날 루틴을 끝까지 해낸 날 ' + k.rescued + '번' : '이 기간에 주고받은 꿍이 없어요') + '</span></div>' +
      '<span class="both__value">' + k.n + '번</span></section>';
  }

  // ── 우리 기념일 (v46) ──
  /** 돌아보기 맨 위 카드. a = anniv.build 결과 | { unset: true } | null(규칙이 아직 없는 등 → 숨김) */
  function annivCard(a) {
    if (!a) return '';
    if (a.unset) return '<button type="button" class="card anniv anniv--empty" data-act="open-anniv">' +
      '<span class="anniv__icon" aria-hidden="true">💞</span><span class="anniv__text"><span class="anniv__title">우리가 시작한 날을 정해 볼까요?</span>' +
      '<span class="anniv__hint">단짝이 된 지 며칠째인지 · 다가오는 100일 · 주년을 둘이 같이 봐요</span></span></button>';
    if (a.future) return '<button type="button" class="card anniv" data-act="open-anniv"><span class="anniv__icon" aria-hidden="true">💞</span><span class="anniv__text">' +
      '<span class="anniv__title">' + esc(a.startText) + '부터 시작해요</span><span class="anniv__hint">' + esc(a.dText) + '</span></span></button>';
    var nx = a.next[0];
    return '<button type="button" class="card anniv" data-act="open-anniv" aria-label="' + esc(a.line + (a.today ? ' · 오늘은 ' + a.today : nx ? ' · 다음 ' + nx.name + ' ' + nx.d : '') + ' · 기념일 보기') + '">' +
      '<span class="anniv__icon" aria-hidden="true">' + (a.today ? '🎉' : '💞') + '</span><span class="anniv__text">' +
      '<span class="anniv__title">' + esc(a.label) + ' <b>' + esc(a.countText) + '</b>일</span>' +
      '<span class="anniv__hint">' + (a.today ? '오늘은 ' + esc(a.today) + '이에요 🎉' : nx ? '다음 ' + esc(nx.name) + ' · ' + esc(nx.d) : '') + '</span></span>' +
      '<span class="anniv__since">' + esc(a.startText) + '부터</span></button>';
  }

  /** 기념일 시트. s = { view: anniv.build 결과 | null, edit: null | { label, custom, start, presets, max, saving, error, errorFresh }, by, entering } */
  function annivSheet(s, entering) {
    var v = s.view, f = s.edit, body;
    if (f) {
      var chips = f.presets.map(function (p) {
        return '<button type="button" class="chip" data-act="anniv-label" data-v="' + esc(p) + '" aria-pressed="' + (!f.custom && f.label === p) + '">' + esc(p) + '</button>';
      }).join('') + '<button type="button" class="chip" data-act="anniv-label" data-v="" aria-pressed="' + !!f.custom + '">✎ 직접</button>';
      body = '<div class="rform anniv-form" role="group" aria-labelledby="anniv-form-title">' +
        '<span id="anniv-form-title" class="rform__title">' + (v ? '기념일 고치기' : '우리가 시작한 날') + '</span>' +
        '<div class="field"><span class="field__label" id="an-label-title">관계 이름 · 「' + esc(f.custom ? (f.label || '…') : f.label) + ' ' + esc(f.sample) + '일」처럼 보여요</span>' +
        '<div class="chips" role="group" aria-labelledby="an-label-title">' + chips + '</div>' +
        (f.custom ? '<input id="an-label" class="field__input" type="text" maxlength="' + f.max + '" autocomplete="off" enterkeyhint="done" placeholder="예: 연애한 지" value="' + esc(f.label) + '" aria-label="관계 이름 (' + f.max + '자까지)">' : '') + '</div>' +
        '<label class="field"><span class="field__label">시작한 날 · 이 날이 1일이에요</span><input id="an-start" class="field__input" type="date" max="' + esc(f.maxDate) + '" value="' + esc(f.start) + '"></label>' +
        '<p class="anniv-form__note">둘이 같이 보는 값이에요 · 누가 바꿔도 두 폰 모두 바뀌어요</p>' +
        (f.error ? '<p class="rform__error"' + (f.errorFresh ? ' role="alert"' : '') + '>' + esc(f.error) + '</p>' : '') +
        '<div class="rform__actions">' +
        '<button type="button" class="ghost-btn" data-act="' + (v ? 'anniv-cancel' : 'close-anniv') + '">' + (v ? '돌아가기' : '닫기') + '</button>' +
        '<button type="button" class="solid-btn" data-act="anniv-save"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? '저장 중…' : '저장') + '</button></div></div>';
    } else if (v && v.future) {
      body = '<div class="abig"><p class="abig__count">' + esc(v.dText) + '</p><p class="abig__since">' + esc(v.startText) + '부터 시작해요</p></div>';
    } else if (v) {
      body = '<div class="abig"><p class="abig__label">' + esc(v.label) + '</p><p class="abig__count">' + esc(v.countText) + '<span>일</span></p>' +
        '<p class="abig__since">' + esc(v.startText) + '부터' + (v.years ? ' · ' + v.years + '년 넘게' : '') + '</p>' +
        (v.today ? '<p class="abig__today" role="status">🎉 오늘은 ' + esc(v.today) + '이에요</p>' : '') + '</div>' +
        '<h3 class="gsub">다가오는 기념일</h3><ul class="alist">' + v.next.map(function (m) {
          return '<li class="' + (m.kind === 'year' ? 'is-year' : '') + '"><span class="alist__name">' + esc(m.name) + '</span><span class="alist__date">' + esc(m.date) + '</span><span class="alist__d">' + esc(m.d) + '</span></li>';
        }).join('') + '</ul>' +
        (v.past.length ? '<h3 class="gsub">지나온 기념일</h3><ul class="alist alist--past">' + v.past.map(function (m) {
          return '<li><span class="alist__name">' + esc(m.name) + '</span><span class="alist__date">' + esc(m.date) + '</span><span class="alist__d"></span></li>';
        }).join('') + '</ul>' : '') +
        '<p class="anniv-form__note">시작한 날이 1일 · 100일 단위와 해마다 같은 날을 챙겨요</p>';
    }
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="close-anniv" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="anniv-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<div class="sheet__head"><h2 id="anniv-title" class="sheet__title">우리 기념일</h2>' +
      (v && !f ? '<button type="button" class="mini-btn" data-act="anniv-edit">고치기</button>' : '') + '</div>' +
      body +
      (v && !f && s.box && root.RT && root.RT.viewAvatar ? root.RT.viewAvatar.picker(s.box) : '') + // v52 박스 모양
      (v && !f && s.by ? '<p class="anniv__by">' + esc(s.by) + '</p>' : '') +
      (!f ? '<button type="button" class="close-btn" data-act="close-anniv">닫기</button>' : '') +
      '</section></div>';
  }

  /** m: review.build 결과 + { loading, error, anniv } */
  function tab(m) {
    var out = head(m); // v51: 기념일은 「전체」의 「우리 둘」 박스로 (돌아보기 카드 뺌)
    if (m.error) return out + '<section class="card notice" role="status"><p class="notice__body">' + esc(m.error) + '</p>' +
      '<button type="button" class="small-btn" data-act="rv-retry">다시 불러오기</button></section>';
    if (m.empty && !m.loading) return out + '<section class="card notice" role="status"><h2 class="notice__title">아직 돌아볼 기록이 없어요</h2>' +
      '<p class="notice__body">루틴을 체크하거나 할 일을 끝내면 여기에 모여요.</p></section>';
    var quest = m.quest && RT.view ? '<section class="card quest quest--review" aria-label="이 주 퀘스트"><span class="quest__head"><span class="quest__title">' +
      (m.page === 0 ? '이번 주 퀘스트' : '이 주 퀘스트') + '</span><span class="quest__hint">' + (m.quest.allDone ? '보너스까지 성공!' : m.quest.done ? '퀘스트 성공 · 토마토 +5' : m.page === 0 ? '일요일까지 둘이 함께' : '이 주는 아쉬웠어요') + '</span></span>' +
      RT.view.questBody(m.quest) + '</section>' : '';
    return out + quest + routineCard(m.routine, m) + (m.loading ? '<section class="card " aria-busy="true"><p class="muted">끝낸 일과 꿍을 불러오는 중…</p></section>' : focusCard(m.focus) + todoCard(m.todos) + kungCard(m.kung));
  }

  var api = { tab: tab, annivCard: annivCard, annivSheet: annivSheet, rowSheet: rowSheet, viewSwitch: viewSwitch };
  root.RT = root.RT || {};
  root.RT.viewReview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
