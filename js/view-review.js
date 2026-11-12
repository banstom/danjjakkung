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
  var CELL_TEXT = { full: '함', none: '안 함', pre: '시작 전', future: '아직', rest: '쉼' };

  function stat(label, value, clean) {
    return '<div class="stat' + (clean ? ' stat--clean' : '') + '"><span class="stat__label">' + esc(label) + '</span><span class="stat__value">' + esc(value) + '</span></div>';
  }

  function head(m) {
    var unit = m.mode === 'week' ? '주' : '달';
    return '<div class="plan__bar"><div class="seg" role="group" aria-label="돌아볼 기간">' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="week" aria-pressed="' + (m.mode === 'week') + '">주</button>' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="month" aria-pressed="' + (m.mode === 'month') + '">월</button></div></div>' +
      '<section class="card rv-us" aria-label="' + esc(m.title) + '"' + (m.loading ? ' aria-busy="true"' : '') + '>' +
      '<div class="grid-head">' +
      '<button type="button" class="icon-btn" data-act="rv-page" data-dir="1" aria-label="이전 ' + unit + '"' + (m.canPrev ? '' : ' disabled') + '>' + CHEVRON.prev + '</button>' +
      '<span class="grid-title"><span class="grid-range">' + esc(m.label) + '</span>' +
      (m.page > 0 ? '<button type="button" class="mini-btn" data-act="rv-now">이번 ' + unit + '</button>' : '') + '</span>' +
      '<button type="button" class="icon-btn" data-act="rv-page" data-dir="-1" aria-label="다음 ' + unit + '"' + (m.canNext ? '' : ' disabled') + '>' + CHEVRON.next + '</button>' +
      '</div>' +
      '<h2 class="rv-title">' + esc(m.title) + '</h2>' +
      // 끝낸 일 · 꿍은 기간을 넘길 때마다 새로 불러온다 — 불러오는 동안은 앞 기간 값(대개 0)이 잠깐 보이지 않게 「–」
      '<div class="rv-quad">' + stat('모두 해낸 날', m.us.allDays + '일', true) + stat('함께 끝낸 일', m.loading ? '–' : m.us.togetherDone + '개') +
      (m.us.kungs === null ? '' : stat('꿍 주고받음', m.loading ? '–' : m.us.kungs + '번')) + stat('함께 일정', m.us.togetherTime) + '</div></section>';
  }

  function cells(list, both, name) {
    return list.map(function (c, i) {
      var cls = c === 'full' ? (both ? 'rv-cell--both' : 'lv-full') : c === 'none' ? 'lv-none' : c === 'pre' ? 'rv-cell--pre' : c === 'rest' ? 'lv-rest' : 'rv-cell--future';
      return '<span class="rv-cell ' + cls + '" role="img" aria-label="' + esc(name + ' ' + ['월', '화', '수', '목', '금', '토', '일'][i] + ' ' + CELL_TEXT[c]) + '"></span>';
    }).join('');
  }

  function routineCard(rt) {
    if (!rt.groups.length) return '';
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

  function kungCard(k) {
    if (!k) return ''; // 꿍을 불러오지 못했으면(규칙이 아직 없는 등) 칸을 숨긴다
    return '<section class="card both" aria-label="꿍 돌아보기"><div class="both__text"><span class="both__title">💞 꿍 주고받음</span>' +
      '<span class="both__hint">' + (k.n ? '꿍 받은 날 루틴을 끝까지 해낸 날 ' + k.rescued + '번' : '이 기간에 주고받은 꿍이 없어요') + '</span></div>' +
      '<span class="both__value">' + k.n + '번</span></section>';
  }

  /** m: review.build 결과 + { loading, error } */
  function tab(m) {
    var out = head(m);
    if (m.error) return out + '<section class="card notice" role="status"><p class="notice__body">' + esc(m.error) + '</p>' +
      '<button type="button" class="small-btn" data-act="rv-retry">다시 불러오기</button></section>';
    if (m.empty && !m.loading) return out + '<section class="card notice" role="status"><h2 class="notice__title">아직 돌아볼 기록이 없어요</h2>' +
      '<p class="notice__body">루틴을 체크하거나 할 일을 끝내면 여기에 모여요.</p></section>';
    var quest = m.quest && RT.view ? '<section class="card quest quest--review" aria-label="이 주 퀘스트"><span class="quest__head"><span class="quest__title">' +
      (m.page === 0 ? '이번 주 퀘스트' : '이 주 퀘스트') + '</span><span class="quest__hint">' + (m.quest.allDone ? '보너스까지 성공!' : m.quest.done ? '퀘스트 성공 · 토마토 +5' : m.page === 0 ? '일요일까지 둘이 함께' : '이 주는 아쉬웠어요') + '</span></span>' +
      RT.view.questBody(m.quest) + '</section>' : '';
    return out + quest + routineCard(m.routine) + (m.loading ? '<section class="card " aria-busy="true"><p class="muted">끝낸 일과 꿍을 불러오는 중…</p></section>' : todoCard(m.todos) + kungCard(m.kung));
  }

  var api = { tab: tab };
  root.RT = root.RT || {};
  root.RT.viewReview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
