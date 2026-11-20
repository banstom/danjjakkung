/* 단짝 식탁 화면 — ① 목표 고르기 · ② 계산 근거 시트 (D2) · ④ 기록하기 · ⑤ 확인 카드 · 첫 화면 오늘 먹은 것 (D3). 짝꿍 식탁 그래프는 D5.
   목업 design/mockups/chosen/diet/01-goal-set · 02-goal-basis. 값은 diet-goal.js · app.js dietModel() */
(function (root) {
  'use strict';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(d, w) { return '<svg width="' + (w || 24) + '" height="' + (w || 24) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var BACK = '<path d="M15 6l-6 6 6 6"/>', CHEV = '<path d="M9 6l6 6-6 6"/>', LOCK = '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>';
  function comma(n) { return String(Math.round(+(+n || 0).toFixed(2))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  var GOALS = [['cut', '감량', '주 0.5%씩'], ['keep', '유지', '지금 그대로'], ['bulk', '벌크업', '+10%']];
  var ACTS = [['none', '거의 안 함'], ['w1_3', '주 1~3회'], ['w3_5', '주 3~5회'], ['daily', '거의 매일']];
  var ROWS = [['kcal', '칼로리', 'kcal'], ['protein', '단백질', 'g'], ['fat', '지방', 'g'], ['carb', '탄수', 'g']];
  var GOAL_NAME = { cut: '감량', keep: '유지', bulk: '벌크업' };

  function field(id, label, unit, value, max) {
    return '<label class="dfld"><span class="dfld__l">' + label + '</span><span class="dfin"><input id="' + id + '" type="number" inputmode="decimal" min="0" max="' + max + '" step="any" value="' + esc(value) + '" aria-label="' + label + ' (' + unit + ')"><i>' + unit + '</i></span></label>';
  }

  /** 추천 목표 칸 (입력이 바뀌면 이 부분만 다시 그림 — 숫자 칸 입력이 끊기지 않게). r = { ready, skip, values, subs, editing, edited, notes } */
  function reco(r) {
    if (!r.ready && !r.skip) return '<p class="dnote">성별 · 나이 · 키 · 체중 · 운동을 입력하면 목표를 추천해 드릴게요</p>';
    var head = '<h2 class="dsec">' + (r.skip ? '내 목표 · 직접 입력' : '추천 목표 · 눌러서 고칠 수 있어요') + '</h2>';
    return head + '<div class="dlist">' + ROWS.map(function (x) {
      var k = x[0], v = r.values[k], editing = r.skip || r.editing === k;
      return '<div class="drow"><span class="drow__tx"><span class="drow__nm">' + x[1] + '</span>' + (r.subs[k] && !r.skip ? '<span class="drow__ds">' + esc(r.subs[k]) + (r.edited[k] ? ' · 고친 값' : '') + '</span>' : '') + '</span>' +
        (editing ? '<span class="dfin dfin--sm"><input id="dg-e-' + k + '" type="number" inputmode="decimal" min="0" step="any" value="' + (v == null ? '' : esc(Math.round(v))) + '" aria-label="' + x[1] + ' 목표 (' + x[2] + ')"><i>' + x[2] + '</i></span>'
          : '<span class="drow__vl">' + (v == null ? '—' : comma(v) + x[2]) + '</span>') +
        (r.skip ? '' : '<button type="button" class="dedit" data-act="dg-edit" data-v="' + k + '" aria-pressed="' + (r.editing === k) + '">' + (r.editing === k ? '완료' : '고치기') + '</button>') + '</div>';
    }).join('') + '</div>';
  }
  /** 범위 안내 줄 (고친 값을 적는 동안 이 부분만 다시 그림) */
  function notes(r) {
    return r.notes.length ? '<ul class="dnotes">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '';
  }

  /** ① 목표 고르기. m = { goal, sex, age, height, weight, activity, skip, retune, reco, saving, error, first, notice } */
  function goalScreen(m, entering) {
    var body = m.skip ? '' :
      '<div class="dsec dsec--row"><h2 class="dsec__t">입력하면 목표를 추천해 드릴게요</h2><span class="dlock">' + svg(LOCK, 12) + '나만 보기</span></div>' +
      '<div class="card dbody">' +
        '<div class="dbody__row"><span class="dbody__l">성별</span><span class="dseg" role="group" aria-label="성별">' +
          [['m', '남'], ['f', '여']].map(function (x) { return '<button type="button" class="dseg__b" data-act="dg-sex" data-v="' + x[0] + '" aria-pressed="' + (m.sex === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span></div>' +
        '<div class="dbody__grid">' + field('dg-age', '나이', '세', m.age, 120) + field('dg-height', '키', 'cm', m.height, 260) + field('dg-weight', '체중', 'kg', m.weight, 400) + '</div>' +
        '<div class="dbody__l">운동</div><div class="dpicks" role="group" aria-label="운동 빈도">' +
          ACTS.map(function (x) { return '<button type="button" class="dpick" data-act="dg-act" data-v="' + x[0] + '" aria-pressed="' + (m.activity === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '</div>';
    return '<div class="sheet-layer sheet-layer--full">' +
      '<section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dg-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="dg-close" aria-label="돌아가기">' + svg(BACK) + '</button>' +
      '<button type="button" class="dbar__skip" data-act="dg-skip" aria-pressed="' + !!m.skip + '">' + (m.skip ? '추천받기' : '건너뛰고 직접 입력') + '</button></div>' +
      '<p class="caption">식단 · ' + (m.first ? '처음 한 번만' : '내 목표 고치기') + '</p><h2 id="dg-title" class="title">어떤 목표로 먹나요?</h2>' +
      '<div class="dgoals" role="group" aria-label="목표">' + GOALS.map(function (g) {
        return '<button type="button" class="dgoal" data-act="dg-goal" data-v="' + g[0] + '" aria-pressed="' + (m.goal === g[0]) + '"><span class="dgoal__n">' + g[1] + '</span><span class="dgoal__d">' + g[2] + '</span></button>';
      }).join('') + '</div>' +
      body +
      '<div id="dg-reco">' + reco(m.reco) + '</div><div id="dg-notes" aria-live="polite">' + notes(m.reco) + '</div>' +
      '<div class="card dsw"><span class="dsw__tx"><span class="dsw__n" id="dg-retune-l">체중 변화로 목표 다시 맞추기</span><span class="dsw__d">선택 · 켜면 주 1회 체중을 물어봐요</span></span>' +
        '<button type="button" class="switch" role="switch" aria-checked="' + !!m.retune + '" aria-labelledby="dg-retune-l" data-act="dg-retune"><span class="switch__knob"></span></button></div>' +
      '<button type="button" class="dbasis" data-act="dg-basis"><span class="dbasis__tx"><b>이렇게 계산했어요</b><span>Mifflin-St Jeor 식 · 국제스포츠영양학회 · 한국인 영양소 섭취기준</span></span>' + svg(CHEV, 18) + '</button>' +
      disc(m.notice) +
      (m.error ? '<p class="rform__error" role="alert">' + esc(m.error) + '</p>' : '') +
      '<div class="dfoot"><button type="button" class="mbtn mbtn--solid dfoot__go" data-act="dg-start"' + (m.saving ? ' disabled' : '') + '>' + (m.saving ? '저장 중…' : m.first ? '이 목표로 시작' : '이 목표로 바꾸기') + '</button></div>' +
      '</section></div>';
  }

  /** 안내 상자 — goals.md 8절 문구 글자 그대로 (첫 문장만 굵게) */
  function disc(t) { var i = t.indexOf('. ') + 1; return '<div class="ddisc"><b>' + esc(t.slice(0, i)) + '</b> ' + esc(t.slice(i + 1)) + '</div>'; }
  var STEPS = [
    ['기초대사량', 'Mifflin-St Jeor 식 · 성별, 나이, 키, 체중으로 계산. 여러 식을 비교한 연구에서 가장 정확했지만, 실제와 10% 넘게 다른 사람도 있어요', 'Frankenfield 외, 미국영양사협회지 2005'],
    ['하루 소비량', '기초대사량 × 운동 빈도 계수(1.2~1.725). 사람마다 차이가 커요', '널리 쓰는 관례값 · 추정'],
    ['목표 칼로리', '벌크업 +10% · 감량은 주 체중 0.5%씩 줄어드는 만큼 · 유지는 그대로. 기초대사량보다 낮게는 추천하지 않아요', 'Iraki 외 2019 · Helms 외 2014'],
    ['단백질', '체중 × 1.6~2.0g, 칼로리의 20%까지', '국제스포츠영양학회 입장문 2017'],
    ['지방 · 탄수', '지방은 칼로리의 25%, 나머지는 탄수. 세 영양소 모두 일반 성인 기준(탄수 50~65 · 단백질 10~20 · 지방 15~30%) 안으로 맞춰요', '2025 한국인 영양소 섭취기준']
  ];
  /** ② 계산 근거 시트. b = { needAck, notice } */
  function basisSheet(b, entering) {
    return '<div class="sheet-layer sheet-layer--top">' +
      '<button type="button" class="scrim" data-act="dg-basis-close" aria-label="닫기"></button>' +
      '<section class="sheet sheet--tall' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dbasis-title">' +
      '<span class="grabber" aria-hidden="true"></span><h2 id="dbasis-title" class="sheet__title">이렇게 계산했어요</h2>' +
      '<p class="sheet__sub">공식으로 낸 추정값이라 실제와 다를 수 있어요</p>' +
      '<ol class="dsteps">' + STEPS.map(function (s) { return '<li><b>' + s[0] + '</b><span>' + s[1] + '</span><em>' + s[2] + '</em></li>'; }).join('') + '</ol>' +
      disc(b.notice) +
      '<button type="button" class="mbtn mbtn--solid dbasis__ok" data-act="dg-basis-ok">' + (b.needAck ? '확인했어요 · 이 목표로 시작' : '확인했어요') + '</button>' +
      '</section></div>';
  }

  /** 임시 첫 화면 (D2): 내 목표 · 단짝 목표. h = { mine: goal | null, partner: { name, goal } | null } */
  function goalCard(title, g, mine) {
    return '<section class="card dgc"><div class="dgc__head"><h2 class="dgc__t">' + esc(title) + '</h2>' + (g ? '<span class="abadge">' + GOAL_NAME[g.kind] + (g.edited ? ' · 직접 정함' : '') + '</span>' : '') + '</div>' +
      (g ? '<div class="dgc__nums"><span><b>' + comma(g.kcal) + '</b>kcal</span><span>단 <b>' + comma(g.protein) + '</b>g</span><span>지 <b>' + comma(g.fat) + '</b>g</span><span>탄 <b>' + comma(g.carb) + '</b>g</span></div>' : '<p class="dnote">아직 목표를 정하지 않았어요</p>') +
      (mine ? '<button type="button" class="small-btn" data-act="dg-open">목표 고치기</button>' : '') + '</section>';
  }
  var KIND_NAME = { meal: '식사', snack: '간식' };
  function mealName(m) { return m.label || KIND_NAME[m.kind] || '식사'; }
  function grams(n) { return comma(n) + 'g'; }

  var GEAR = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>';
  var PLUS = '<path d="M12 5v14M5 12h14"/>', DOWN = '<path d="M6 9l6 6 6-6"/>';

  /** 목표 대비 요약 (목업 ③). g = { name, who: me|her, goalName, rows: [{ key, label, actual, target, unit, pct, text, tone }] } | { name, who, none } */
  function goalSum(g) {
    if (g.none) return '<section class="card dgs"><div class="dgs__head"><span class="dchip dchip--' + g.who + '">' + esc(g.name) + '</span><span class="dgs__t">' + esc(g.none) + '</span></div>' +
      (g.total ? '<p class="dgs__plain"><b>' + comma(g.total.kcal) + '</b> kcal · 탄 ' + grams(g.total.carb) + ' · 단 ' + grams(g.total.protein) + ' · 지 ' + grams(g.total.fat) + '</p>' : '') + '</section>';
    return '<section class="card dgs" aria-label="' + esc(g.name + ' ' + g.goalName + ' 목표 대비') + '"><div class="dgs__head"><span class="dchip dchip--' + g.who + '">' + esc(g.name) + '</span><span class="dgs__t">' + esc(g.goalName) + ' 목표 대비</span></div>' +
      g.rows.map(function (r) {
        return '<div class="dgs__row"><span class="dgs__l">' + r.label + '</span><span class="dgs__m" aria-hidden="true"><i class="dgs__f dgs__f--' + g.who + '" style="width:' + r.pct + '%"></i></span>' +
          '<span class="dgs__v">' + comma(r.actual) + '<span class="dgs__g"> / ' + comma(r.target) + r.unit + '</span></span><span class="dgs__s dgs__s--' + r.tone + '">' + esc(r.text) + '</span></div>';
      }).join('') + '</section>';
  }

  /** 거울 차트 (목업 ③): 6~24시, 띠 위로 나 · 아래로 단짝, 높이 = 끼니 kcal, 탄수(띠 쪽 진하게) → 단백질 → 지방.
      c = { bars: [{ id, who: me|her, x(%), h(px), kcal, at, carb, pro, fat(%), both, tip, on }], both: [{ x, at }], tip, me, her } */
  function mirror(c) {
    var half = function (who) {
      return c.bars.filter(function (b) { return b.who === who; }).map(function (b) {
        var segs = [['carb', b.carb], ['pro', b.pro], ['fat', b.fat]];
        if (who === 'me') segs = segs.slice().reverse(); // 위 기둥은 아래(띠 쪽)가 탄수
        return '<button type="button" class="dmr__bar dmr__bar--' + who + (b.on ? ' is-on' : '') + '" style="left:' + b.x + '%;height:' + b.h + 'px" data-act="dt-bar" data-v="' + esc(b.id) + '" aria-pressed="' + !!b.on + '" aria-label="' + esc(b.tip) + '">' +
          segs.map(function (x) { return '<i class="dmr__s dmr__s--' + x[0] + '" style="flex:' + Math.max(1, Math.round(x[1])) + ' 1 0"></i>'; }).join('') + '</button>' +
          '<span class="dmr__kc" style="left:' + b.x + '%;' + (who === 'me' ? 'bottom' : 'top') + ':' + (b.h + 2) + 'px" aria-hidden="true">' + comma(b.kcal) + '</span>';
      }).join('');
    };
    var times = function (who) { return c.bars.filter(function (b) { return b.who === who && !b.both; }).map(function (b) { return '<span class="dmr__t" style="left:' + b.x + '%">' + esc(b.at) + '</span>'; }).join(''); };
    var both = c.both.map(function (x) { return '<span class="dmr__bg" style="left:' + x.x + '%"></span>'; }).join('');
    var chips = c.both.map(function (x) { return '<span class="dmr__chip" style="left:' + x.x + '%">' + esc(x.at) + '</span>'; }).join('');
    return '<section class="card dmr" aria-label="시간대별 끼니 차트">' +
      '<p class="dmr__tip" aria-live="polite">' + (c.tip ? esc(c.tip) : '기둥을 누르면 탄수 · 단백질 · 지방 비율이 보여요') + '</p>' +
      '<div class="dmr__box"><div class="dmr__bgs" aria-hidden="true">' + both + '</div>' +
        '<div class="dmr__half dmr__half--me">' + half('me') + '</div>' +
        '<div class="dmr__band" aria-hidden="true"><span class="dmr__ax dmr__ax--l">6시</span><span class="dmr__ax dmr__ax--r">24시</span><div class="dmr__row">' + times('me') + chips + '</div><div class="dmr__row">' + times('her') + '</div></div>' +
        '<div class="dmr__half dmr__half--her">' + half('her') + '</div>' +
      '</div>' +
      '<div class="dmr__lg" aria-hidden="true"><span><i class="dmr__dot dmr__dot--me"></i>위 ' + esc(c.me) + '</span>' + (c.her ? '<span><i class="dmr__dot dmr__dot--her"></i>아래 ' + esc(c.her) + '</span>' : '') + '<span><i class="dmr__sw dmr__s--carb"></i>탄수</span><span><i class="dmr__sw dmr__s--pro"></i>단백질</span><span><i class="dmr__sw dmr__s--fat"></i>지방</span>' + (c.both.length ? '<span><i class="dmr__sw dmr__sw--both"></i>함께 먹음</span>' : '') + '</div>' +
      '</section>';
  }

  /** ③ 짝꿍 식탁 (D5 · 목업 03). 나 = 위 · me 이름표, 단짝 = 아래 · her (보는 사람이 her 칸 사람이면 swap 으로 색만 바꿈). h = { swap, dateLabel, isToday, who: me|her, names: { me, her }, sum: goalSum 모델, chart: mirror 모델 | null, list: { name, mine, rows: [{ gap } | { id, at, name, together, np, carb, pro, fat, kcal }], empty, off } } */
  function home(h) {
    var L = h.list, rows = L.rows.map(function (r) {
      if (r.gap != null) return '<li class="dfast" aria-label="' + esc(r.gap) + '"><span class="dfast__d" aria-hidden="true"></span>' + esc(r.gap) + '</li>';
      var inner = '<span class="dmeal__at">' + esc(r.at || '') + '</span><span class="dmeal__tx"><span class="dmeal__nm">' + esc(r.name) + (r.together ? ' <span class="dchip dchip--both">함께</span>' : '') + (r.np ? ' <span class="dwait">정리 대기 ' + r.np + '</span>' : '') + '</span>' +
        '<span class="dmeal__ds">탄 ' + comma(r.carb) + ' · 단 ' + comma(r.pro) + ' · 지 ' + comma(r.fat) + 'g</span></span><span class="dmeal__vl">' + comma(r.kcal) + '</span>';
      return '<li class="dmeal">' + (L.mine ? '<button type="button" class="dmeal__btn" data-act="dm-open" data-v="' + esc(r.id) + '" aria-label="' + esc((r.at || '') + ' ' + r.name + (r.together ? ', 함께' : '') + (r.np ? ', 정리 대기 ' + r.np + '줄' : '') + ', ' + comma(r.kcal) + 'kcal, 탄수 ' + comma(r.carb) + 'g 단백질 ' + comma(r.pro) + 'g 지방 ' + comma(r.fat) + 'g 열기') + '">' + inner + svg(CHEV, 18) + '</button>' : '<div class="dmeal__btn dmeal__btn--ro">' + inner + '</div>') + '</li>';
    }).join('');
    return '<div class="mscreen dtable' + (h.swap ? ' dtable--swap' : '') + '"><div class="mbar"><button type="button" class="mbar__btn" data-act="diet-close" aria-label="전체로 돌아가기">' + svg(BACK) + '</button><span class="mbar__fill"></span>' +
      '<button type="button" class="mbar__btn" data-act="ds-open" aria-label="식단 설정">' + svg(GEAR, 22) + '</button><button type="button" class="mbar__btn" data-act="dl-open" aria-label="기록하기">' + svg(PLUS) + '</button></div>' +
      '<header class="dtable__head"><button type="button" class="dtable__date" data-act="dt-cal" aria-haspopup="dialog" aria-label="날짜 ' + esc(h.dateLabel) + ', 바꾸기">' + esc(h.dateLabel) + svg(DOWN, 18) + '</button><h1 class="title">단짝 식탁</h1>' +
        (h.isToday ? '' : '<button type="button" class="small-btn dtable__today" data-act="dt-today">오늘로 가기</button>') + '</header>' +
      (h.names.her ? '<div class="dseg dseg--wide dtable__who" role="group" aria-label="누구의 숫자">' + [['me', h.names.me], ['her', h.names.her]].map(function (x) { return '<button type="button" class="dseg__b" data-act="dt-who" data-v="' + x[0] + '" aria-pressed="' + (h.who === x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' : '') +
      goalSum(h.sum) + (h.chart ? mirror(h.chart) : '') +
      '<h2 class="dsec dtable__sec">' + esc(L.name) + '의 끼니</h2>' +
      (L.rows.length ? '<ul class="card dmeals dtable__list">' + rows + '</ul>' : '<p class="dnote">' + esc(L.empty) + '</p>') +
      (L.mine ? '<button type="button" class="mbtn mbtn--solid dtoday__go" data-act="dl-open">기록하기</button>' : '') + '</div>';
  }

  /** ⑥ 식단 설정 (D6 일부): 목표 · 내 식품. s = { mine, partner, nFoods } */
  function settingsScreen(s, entering) {
    return '<div class="sheet-layer sheet-layer--full"><section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="ds-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="ds-close" aria-label="단짝 식탁으로 돌아가기">' + svg(BACK) + '</button></div>' +
      '<h2 id="ds-title" class="title">식단 설정</h2>' +
      goalCard('내 목표 · 단짝도 보는 숫자', s.mine, true) + (s.partner ? goalCard(s.partner.name + ' 님 목표', s.partner.goal, false) : '') +
      '<div class="card ddcard"><button type="button" class="dwhen__row" data-act="df-open"><span class="dwhen__l">내 식품<span class="diswap__d">알려 준 영양 숫자 · 고른 가공식품 · 둘이 함께 써요</span></span><span class="dwhen__v">' + s.nFoods + '개</span>' + svg(CHEV, 18) + '</button></div>' +
      '</section></div>';
  }
  /** ⑦ 내 식품 (D6 일부 · 목업 07). f = { rows: [{ id, name, ds, vl, by, mine }], empty } */
  function foodsScreen(f, entering) {
    return '<div class="sheet-layer sheet-layer--full"><section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="df-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="df-close" aria-label="식단 설정으로 돌아가기">' + svg(BACK) + '</button></div>' +
      '<p class="caption">식단 설정</p><h2 id="df-title" class="title">내 식품</h2>' +
      (f.rows.length ? '<ul class="card dlist ddlist">' + f.rows.map(function (r) {
        return '<li><button type="button" class="ddrow" data-act="df-item" data-v="' + esc(r.id) + '" aria-label="' + esc(r.name + ', ' + r.ds + ', ' + r.vl + ', ' + r.by + ' 등록, 고치기') + '"><span class="drow__tx"><span class="drow__nm">' + esc(r.name) + '</span><span class="drow__ds">' + esc(r.ds) + '</span></span>' +
          '<span class="dfood__r"><span class="drow__vl">' + esc(r.vl) + '</span><span class="dchip dchip--' + r.slot + '">' + esc(r.by) + ' 등록</span></span>' + svg(CHEV, 16) + '</button></li>';
      }).join('') + '</ul>' : '<p class="dnote">' + esc(f.empty) + '</p>') +
      '<p class="dnote dfood__note">기록할 때 이름만 적으면 여기 값으로 계산해요. 한쪽이 고치면 둘 다 바뀌어요. 제품 값은 포장지 영양성분표로 확인해 주세요.</p>' +
      '</section></div>';
  }
  /** 내 식품 하나 고치기 · 지우기. e = { name, unit, unitG, kcal, carb, protein, fat, src, error, del, saving } */
  function foodSheet(e, entering) {
    var fld = function (id, label, v, mode, suf) { return '<div class="dfe__f"><label class="dfe__l" for="' + id + '">' + label + '</label><span class="dfe__w"><input id="' + id + '" class="dfe__in" type="text" inputmode="' + mode + '" autocomplete="off" maxlength="' + (mode === 'text' ? 20 : 8) + '" value="' + esc(v == null ? '' : String(v)) + '">' + (suf ? '<span class="dfe__u">' + suf + '</span>' : '') + '</span></div>'; };
    return '<div class="sheet-layer sheet-layer--top"><button type="button" class="scrim" data-act="dfe-close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dfe-title"><span class="grabber" aria-hidden="true"></span>' +
      '<h2 id="dfe-title" class="sheet__title">' + esc(e.name) + '</h2><p class="sheet__sub">' + esc(e.src) + '</p>' +
      '<div class="dfe">' + fld('dfe-unit', '1단위', e.unit, 'text', '') + fld('dfe-g', '1단위 무게', e.unitG, 'decimal', 'g') + fld('dfe-kcal', '열량', e.kcal, 'decimal', 'kcal') +
        fld('dfe-carb', '탄수', e.carb, 'decimal', 'g') + fld('dfe-protein', '단백질', e.protein, 'decimal', 'g') + fld('dfe-fat', '지방', e.fat, 'decimal', 'g') + '</div>' +
      '<p class="sheet__sub">1단위에 들어 있는 값이에요. 고치면 「알려 준 값」으로 바뀌어요</p>' +
      (e.error ? '<p class="rform__error" role="alert">' + esc(e.error) + '</p>' : '') +
      '<div class="ddfoot difoot"><button type="button" class="mbtn ddfoot__del' + (e.del ? ' is-armed' : '') + '" data-act="dfe-del"' + (e.saving ? ' disabled' : '') + '>' + (e.del ? '정말 지우기' : '지우기') + '</button><button type="button" class="mbtn mbtn--solid ddfoot__go" data-act="dfe-save"' + (e.saving ? ' disabled' : '') + '>저장</button></div>' +
      '</section></div>';
  }

  /** ④ 기록하기 (목업 04). e = { dateLabel, text, together, chips, partnerName, loading, error, whenLabel, fixing: 고치는 끼니 이름 | '' } */
  function logScreen(e, entering) {
    return '<div class="sheet-layer sheet-layer--full">' +
      '<section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dl-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="dl-close" aria-label="돌아가기">' + svg(BACK) + '</button></div>' +
      '<p class="caption">' + esc(e.dateLabel) + '</p><h2 id="dl-title" class="title">' + (e.fixing ? esc(e.fixing) + ' 고치기' : '무엇을 먹었나요?') + '</h2>' +
      (e.fixing ? '<p class="dfixing" role="status">적은 글을 고쳐 다시 정리해요 · 저장하면 이 끼니가 바뀌어요 (새로 늘지 않아요)</p>' : '<p class="dlog__sub">평소 말투로 적으면 정리해 드려요</p>') +
      '<label class="sr-only" for="dl-text">먹은 것</label><textarea id="dl-text" class="dlog__ta" rows="5" maxlength="2000" placeholder="예) 2230에 식사: 밥 1.5공기 / 조기 1개 / 김치꽁치찌개">' + esc(e.text) + '</textarea>' +
      '<p class="dlog__hint">시각을 안 적으면 지금 시각으로 넣어요</p>' +
      (e.fixing ? '' : '<div class="dlist dwhen"><button type="button" class="dwhen__row" data-act="dl-when" aria-haspopup="dialog"><span class="dwhen__l">언제 먹었나요</span><span class="dwhen__v">' + esc(e.whenLabel) + '</span>' + svg(CHEV, 18) + '</button></div>') + // 고칠 때는 날짜를 끼니 상세의 「언제 먹었나요」에서
      (e.chips && e.chips.length ? '<h3 class="dsec">자주 먹는 것 · 누르면 위에 붙어요</h3><div class="dpicks">' + e.chips.map(function (c) { return '<button type="button" class="dpick" data-act="dl-chip" data-v="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') +
      (e.partnerName ? '<h3 class="dsec" id="dl-who-l">누구의 끼니</h3><div class="dseg dseg--wide" role="group" aria-labelledby="dl-who-l">' +
        [['me', '나'], ['both', '단짝과 함께']].map(function (x) { return '<button type="button" class="dseg__b" data-act="dl-who" data-v="' + x[0] + '" aria-pressed="' + ((x[0] === 'both') === !!e.together) + '">' + x[1] + '</button>'; }).join('') + '</div>' : '') +
      '<div id="dl-foot">' + logFoot(e) + '</div>' +
      '</section></div>';
  }
  /** 기록하기 아래쪽(안내 · 버튼) — 식품표를 다 받으면 이 부분만 바꾼다 (적는 글은 그대로) */
  function logFoot(e) {
    return (e.error ? '<p class="rform__error" role="alert">' + esc(e.error) + '</p>' : '') +
      '<div class="dfoot">' + (e.retry ? '<button type="button" class="mbtn mbtn--solid dfoot__go" data-act="dl-retry">식품표 다시 불러오기</button>'
        : '<button type="button" class="mbtn mbtn--solid dfoot__go" data-act="dl-go"' + (e.loading ? ' disabled' : '') + '>' + (e.loading ? '식품표 불러오는 중…' : '정리하기') + '</button>') + '</div>';
  }

  var WAIT_WHY = { complex: '재료를 함께 적은 줄', unknown: '식품표에 없는 음식', unit: '모르는 단위', amount: '양이 이상해요', calc: '계산 못 함', ingredient: '재료 중 모르는 것', recipe: '재료를 몰라요', product: '처음 보는 제품 · 제품 등록이 생기면 채워요', food: '저장된 레시피가 아직 없어요' };
  /** 「제품 찾기」 단추 (AI 추정 · 정리 대기 줄) — 식약처 가공식품에서 골라 바꿈 */
  function findBtn(v, name) { return '<button type="button" class="dfind" data-act="dp-open" data-v="' + esc(v) + '" aria-label="' + esc(name) + ' 제품 찾기">제품 찾기</button>'; }
  function section(m, many, mi) {
    var n = m.items.length + m.pending.length, est = m.pending.length || m.items.some(function (i) { return i.est; });
    var rows = m.items.map(function (i, k) {
      return '<li class="drow"><span class="drow__tx"><span class="drow__nm">' + esc(i.name) + (i.est ? ' <span class="dest">· ' + (i.ai ? 'AI 추정' : '추정') + '</span>' : '') + '</span>' + (i.sub ? '<span class="drow__ds">' + esc(i.sub) + '</span>' : '') +
        (i.find ? findBtn(mi + ':i:' + k, i.name) : '') + '</span><span class="drow__vl">' + comma(i.kcal) + '</span></li>';
    }).concat(m.pending.map(function (x, k) {
      return '<li class="drow drow--wait"><span class="drow__tx"><span class="drow__nm">' + esc(x.raw) + '</span><span class="drow__ds">' + esc(WAIT_WHY[x.reason] || '아직 계산 못 함') + ' · 저장해 두고 나중에 정리해요</span>' +
        (x.find ? findBtn(mi + ':p:' + k, x.raw) : '') + '</span><span class="dwait">정리 대기</span></li>';
    })).join('');
    var head = esc((m.at || '') + ' ' + m.name + ' · ' + n + '가지');
    return '<section class="card dsum">' + (many ? '<h3 class="dsum__t">' + head + '</h3>' : '<h2 id="dc-title" class="dsum__t">' + head + '</h2>') +
        '<p class="dsum__k">' + (est ? '약 ' : '') + '<b>' + comma(m.total.kcal) + '</b> kcal</p>' +
        '<div class="dsum__m"><span>탄수 <b>' + grams(m.total.carb) + '</b></span><span>단백질 <b>' + grams(m.total.protein) + '</b></span><span>지방 <b>' + grams(m.total.fat) + '</b></span></div>' +
        (m.pending.length ? '<p class="dnote">정리 대기 ' + m.pending.length + '줄은 합계에 아직 빠져 있어요</p>' : '') + '</section>' +
      '<ul class="dlist dconf">' + rows + '</ul>';
  }
  function askCard(q, i, n) {
    return '<div class="dask"><p class="dask__n">' + (i + 1) + ' / ' + n + '</p><label class="dask__q" for="dq-' + i + '">' + esc(q.label) + ' · ' + esc(q.ask) + '</label>' +
      '<input id="dq-' + i + '" class="dask__in" type="text" maxlength="80" autocomplete="off" value="' + esc(q.answer || '') + '" placeholder="모르면 비워 두세요"></div>';
  }
  /** 날짜 고르기 시트 (목업 03-1 달력 모양). w = { title, prev, next, quick: [{ key, name, on }], weeks: [[{ key, d, on, today, off } | null]], note } */
  function whenSheet(w, entering) {
    var A = w.act || 'dl-when'; // 끼니 상세에서도 씀 (dd-when: 날짜는 골라 두고 시각과 함께 「바꾸기」)
    var cells = ['월', '화', '수', '목', '금', '토', '일'].map(function (x) { return '<span class="dcal__w" aria-hidden="true">' + x + '</span>'; }).join('') +
      w.cells.map(function (c) {
        if (!c) return '<span></span>';
        return '<button type="button" class="dcal__d' + (c.on ? ' is-on' : '') + (c.today ? ' is-today' : '') + '"' + (c.off ? ' disabled' : ' data-act="' + A + '-pick" data-v="' + esc(c.key) + '"') +
          ' aria-pressed="' + !!c.on + '" aria-label="' + esc(c.label) + (c.today ? ', 오늘' : '') + (c.dot ? ', 기록 있음' : '') + '">' + c.d + (c.dot ? '<i class="dcal__dot" aria-hidden="true"></i>' : '') + '</button>';
      }).join('');
    return '<div class="sheet-layer sheet-layer--top">' +
      '<button type="button" class="scrim" data-act="' + A + '-close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dw-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<h2 id="dw-title" class="sheet__title dwhen__title">' + esc(w.heading || '언제 먹었나요?') + '</h2>' +
      (w.quick ? '<div class="dseg dseg--wide dwhen__quick" role="group" aria-label="빠르게 고르기">' + w.quick.map(function (q) { return '<button type="button" class="dseg__b" data-act="' + A + '-pick" data-v="' + esc(q.key) + '" aria-pressed="' + !!q.on + '">' + esc(q.name) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="dcal__head"><p class="dcal__m" aria-live="polite">' + esc(w.title) + '</p>' +
        '<button type="button" class="mbar__btn" data-act="' + A + '-month" data-v="-1" aria-label="이전 달"' + (w.prev ? '' : ' disabled') + '>' + svg(BACK) + '</button>' +
        '<button type="button" class="mbar__btn" data-act="' + A + '-month" data-v="1" aria-label="다음 달"' + (w.next ? '' : ' disabled') + '>' + svg(CHEV) + '</button></div>' +
      '<div class="dcal">' + cells + '</div>' +
      '<p class="sheet__sub dcal__note">' + esc(w.note || '테두리 = 오늘 · 1년 전까지 고를 수 있어요') + '</p>' + (w.toToday ? '<button type="button" class="mbtn dwtime__go" data-act="' + A + '-pick" data-v="' + esc(w.toToday) + '">오늘로 가기</button>' : '') +
      (w.time != null ? '<div class="dwtime"><label class="dwtime__l" for="dw-time">시각</label><input id="dw-time" class="dwtime__in" type="time" value="' + esc(w.time) + '"></div>' +
        (w.error ? '<p class="rform__error" role="alert">' + esc(w.error) + '</p>' : '') +
        '<button type="button" class="mbtn mbtn--solid dwtime__go" data-act="' + A + '-save"' + (w.saving ? ' disabled' : '') + '>' + (w.saving ? '옮기는 중…' : '바꾸기') + '</button>' : '') +
      '</section></div>';
  }

  /** ⑤ 확인 카드 (목업 05). c = { meals: [{ at, name, total, items: [{ name, sub, kcal, est }], pending }], ai: idle|busy|done|fail, aiNote, questions, together, partnerName, saving, error, dayLabel } */
  function confirmScreen(c, entering) {
    var many = c.meals.length > 1, nAll = c.meals.reduce(function (a, m) { return a + m.items.length + m.pending.length; }, 0);
    var aiBox = c.ai === 'busy' ? '<p class="dai" role="status"><span class="dai__dot" aria-hidden="true"></span>모르는 줄을 AI가 정리하는 중이에요…</p>'
      : c.aiNote ? '<p class="dai dai--' + (c.ai === 'fail' ? 'fail' : 'ok') + '" role="' + (c.ai === 'fail' ? 'alert' : 'status') + '">' + esc(c.aiNote) + '</p>' : '';
    var qs = c.questions && c.questions.length && c.ai !== 'busy' ? '<section class="dasks" aria-labelledby="dq-title"><h3 class="dsec" id="dq-title">' + (c.round > 1 ? '남은 것도 마저 물어볼게요' : '꼭 필요한 것만 물어볼게요 · 한 번 정하면 다음부터 덜 물어요') + '</h3>' +
      c.questions.map(function (q, i) { return askCard(q, i, c.questions.length); }).join('') +
      '<div class="dask__row"><button type="button" class="mbtn mbtn--solid" data-act="dq-send">답하고 다시 정리</button><button type="button" class="mbtn" data-act="dq-skip">건너뛰기</button></div></section>' : '';
    return '<div class="sheet-layer sheet-layer--full">' +
      '<section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dc-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="dl-back" aria-label="고치러 돌아가기">' + svg(BACK) + '</button></div>' +
      '<p class="caption">' + (c.dayLabel ? esc(c.dayLabel) + ' 기록이에요 · 확인하고 저장해요' : '확인하고 저장해요') + '</p>' +
      (many ? '<h2 id="dc-title" class="title">끼니 ' + c.meals.length + '개</h2>' : '') +
      aiBox + c.meals.map(function (m, mi) { return section(m, many, mi); }).join('') + qs +
      (c.together && c.partnerName ? '<p class="dnote">' + esc(c.partnerName) + ' 님과 함께 먹은 끼니로 표시해요</p>' : '') +
      (c.error ? '<p class="rform__error" role="alert">' + esc(c.error) + '</p>' : '') +
      '<div class="dfoot"><button type="button" class="mbtn mbtn--solid dfoot__go" data-act="dl-save"' + (c.saving || !nAll ? ' disabled' : '') + '>' + (c.saving ? '저장 중…' : c.ai === 'busy' ? '기다리지 않고 저장' : many ? '끼니 ' + c.meals.length + '개 저장' : '저장') + '</button></div>' +
      '</section></div>';
  }

  /** 끼니 상세 (목업 ②). d = { title, caption, together, total, est, items: [{ name, sub, kcal, badge }], pending: [{ raw, why, find }], text, whenLabel, del, busy, error, canAi } */
  function mealScreen(d, entering) {
    var rows = d.items.map(function (i, k) {
      return '<li><button type="button" class="ddrow" data-act="dd-item" data-v="' + k + '" aria-label="' + esc(i.name + ', ' + (i.sub ? i.sub + ', ' : '') + comma(i.kcal) + 'kcal' + (i.badge ? ', ' + i.badge : '') + ' 고치기') + '"><span class="drow__tx"><span class="drow__nm">' + esc(i.name) + (i.badge ? ' <span class="ddbadge">' + esc(i.badge) + '</span>' : '') + '</span>' +
        (i.sub ? '<span class="drow__ds">' + esc(i.sub) + '</span>' : '') + '</span><span class="drow__vl">' + comma(i.kcal) + '</span>' + svg(CHEV, 16) + '</button></li>';
    }).concat(d.pending.map(function (x, k) {
      return '<li class="ddwait"><div class="ddwait__top"><span class="drow__tx"><span class="drow__nm">' + esc(x.raw) + '</span><span class="drow__ds">' + esc(x.why) + ' · 아직 계산 못 했어요</span></span><span class="dwait">정리 대기</span></div>' +
        '<div class="ddwait__acts">' + (x.find ? '<button type="button" class="dfind" data-act="dd-pfind" data-v="' + k + '" aria-label="' + esc(x.raw) + ' 제품 찾기">제품 찾기</button>' : '') + (d.canAi ? '<button type="button" class="dfind" data-act="dd-ai" aria-label="' + esc(x.raw) + ' 끼니를 AI로 정리">AI로 정리</button>' : '') + '</div></li>';
    })).join('');
    return '<div class="sheet-layer sheet-layer--full">' +
      '<section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dd-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="dd-close" aria-label="오늘 먹은 것으로 돌아가기">' + svg(BACK) + '</button></div>' +
      '<p class="caption">' + esc(d.caption) + '</p><h2 id="dd-title" class="title">' + esc(d.title) + (d.together ? ' <span class="abadge">함께</span>' : '') + '</h2>' +
      '<section class="card dsum"><p class="dsum__k">' + (d.est ? '약 ' : '') + '<b>' + comma(d.total.kcal) + '</b> kcal</p>' +
        '<div class="dsum__m"><span>탄수 <b>' + grams(d.total.carb) + '</b></span><span>단백질 <b>' + grams(d.total.protein) + '</b></span><span>지방 <b>' + grams(d.total.fat) + '</b></span></div>' +
        (d.pending.length ? '<p class="dsum__n">정리 대기 ' + d.pending.length + '줄은 합계에 아직 빠져 있어요</p>' : '') + '</section>' +
      '<div class="card ddcard"><button type="button" class="dwhen__row" data-act="dd-when" aria-haspopup="dialog"><span class="dwhen__l">언제 먹었나요</span><span class="dwhen__v">' + esc(d.whenLabel) + '</span>' + svg(CHEV, 18) + '</button></div>' +
      (rows ? '<ul class="card dlist ddlist">' + rows + '</ul>' : '') +
      (d.items.length ? '<p class="dnote ddnote">줄을 누르면 그 항목만 고칠 수 있어요</p>' : '') +
      (d.text ? '<section class="ddtext" aria-labelledby="dd-text-l"><h3 class="ddtext__l" id="dd-text-l">처음 적은 글</h3><p class="ddtext__t">' + esc(d.text) + '</p></section>' : '') +
      (d.error ? '<p class="rform__error" role="alert">' + esc(d.error) + '</p>' : '') +
      '<div class="dfoot ddfoot"><button type="button" class="mbtn ddfoot__del' + (d.del ? ' is-armed' : '') + '" data-act="dd-del"' + (d.busy ? ' disabled' : '') + '>' + (d.del ? '정말 지우기' : '지우기') + '</button>' +
        '<button type="button" class="mbtn mbtn--solid ddfoot__go" data-act="dd-text"' + (d.busy ? ' disabled' : '') + '>글로 고치기</button></div>' +
      '</section></div>';
  }
  /** 바꾼 양 미리보기 — 적는 동안 이 부분만 바꿈 (입력칸은 그대로) */
  function itemPrev(p) {
    if (!p) return '<div class="diprev" id="di-prev" aria-live="polite"><p class="diprev__m">양을 숫자로 적어 주세요</p></div>';
    return '<div class="diprev" id="di-prev" aria-live="polite"><p class="diprev__k">' + esc(p.line) + (p.before !== p.after ? ' · <s>' + comma(p.before) + '</s> →' : ' ·') + ' <b>' + comma(p.after) + '</b> kcal</p><p class="diprev__m">' + esc(p.macros) + ' · 끼니 합계 ' + comma(p.meal) + 'kcal</p></div>';
  }
  /** 한 항목만 고치기 (목업 ③). e = { name, src, amount, unit, units: [단위, 'g'] | null, quick, canAmount, preview: { line, before, after, macros, meal } | null, error, del } */
  function itemSheet(e, entering) {
    var amt = e.canAmount ? '<div class="diamt"><label class="diamt__l" for="di-amt">얼마나 먹었나요</label>' +
      '<div class="diamt__row"><button type="button" class="diamt__pm" data-act="di-step" data-v="-1" aria-label="줄이기">−</button>' +
      '<input id="di-amt" class="diamt__in" type="text" inputmode="decimal" autocomplete="off" maxlength="7" value="' + esc(e.amount) + '" aria-describedby="di-prev">' +
      '<button type="button" class="diamt__pm" data-act="di-step" data-v="1" aria-label="늘리기">+</button>' +
      (e.units ? '<div class="dseg diamt__u" role="group" aria-label="단위">' + e.units.map(function (u) { return '<button type="button" class="dseg__b" data-act="di-unit" data-v="' + esc(u) + '" aria-pressed="' + (u === e.unit) + '">' + esc(u) + '</button>'; }).join('') + '</div>' : '<span class="diamt__one">' + esc(e.unit) + '</span>') + '</div>' +
      (e.quick && e.quick.length ? '<div class="diamt__q">' + e.quick.map(function (q) { return '<button type="button" class="diamt__qb" data-act="di-quick" data-v="' + q + '" aria-pressed="' + (String(q) === String(e.amount)) + '" aria-label="' + q + esc(e.unit) + '">' + (q === 0.5 ? '½' : q) + '</button>'; }).join('') + '</div>' : '') + '</div>'
      : '<p class="dnote">이 항목은 양을 여기서 못 바꿔요 · 글로 고치거나 다른 음식으로 바꿔 주세요</p>';
    var p = e.preview;
    return '<div class="sheet-layer sheet-layer--top">' +
      '<button type="button" class="scrim" data-act="di-close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="di-title">' +
      '<span class="grabber" aria-hidden="true"></span><h2 id="di-title" class="sheet__title">' + esc(e.name) + '</h2>' + (e.src ? '<p class="sheet__sub">' + esc(e.src) + '</p>' : '') + amt +
      (e.canAmount ? itemPrev(p) : '') +
      (e.canSwap ? '<button type="button" class="dwhen__row diswap" data-act="di-swap"><span class="dwhen__l">다른 음식으로 바꾸기<span class="diswap__d">식품표 후보 · 식약처 가공식품에서 골라요</span></span>' + svg(CHEV, 16) + '</button>' : '') +
      (e.error ? '<p class="rform__error" role="alert">' + esc(e.error) + '</p>' : '') +
      '<div class="ddfoot difoot"><button type="button" class="mbtn ddfoot__del' + (e.del ? ' is-armed' : '') + '" data-act="di-remove">' + (e.del ? '정말 빼기' : '빼기') + '</button><button type="button" class="mbtn mbtn--solid ddfoot__go" data-act="di-save">저장</button></div>' +
      '<p class="sheet__sub dinote">AI를 부르지 않고 바로 저장해요</p>' +
      '</section></div>';
  }

  /** 제품 찾기 시트 (확인 카드 위). f = { name, q, unit, mode: mass|whole|serve, busy, error, items: [{ name, maker, base, kcal, serve, size }] | null } */
  function findSheet(f, entering) {
    var st = f.busy ? '찾는 중이에요…' : f.error ? f.error : f.items ? (f.items.length ? '식약처 가공식품 ' + f.items.length + '개 · 고르면 내 식품에 저장돼요' : '찾지 못했어요 · 이름을 줄이거나 제조사를 넣어 보세요') : '';
    var list = f.items && f.items.length && !f.busy ? '<ul class="dlist dfind__list">' + f.items.map(function (p, i) {
      // 계산에 쓸 양을 그대로 보여 줌 (점검 AI: 목록은 1회 200ml 인데 1팩 = 900ml 로 계산되던 것)
      var use = f.mode === 'mass' ? '' : f.mode === 'whole' ? (p.size ? '1' + f.unit + ' = 내용량 ' + p.size + p.base : p.serve ? '1' + f.unit + ' = 1회 ' + p.serve + p.base : '양 정보 없음')
        : (p.serve ? '1' + f.unit + ' = 1회 ' + p.serve + p.base : p.size ? '1' + f.unit + ' = 내용량 ' + p.size + p.base : '양 정보 없음');
      var meta = [p.maker, use].filter(Boolean).join(' · ');
      return '<li><button type="button" class="dfind__row" data-act="dp-pick" data-v="' + i + '"><span class="drow__tx"><span class="drow__nm">' + esc(p.name) + '</span>' + (meta ? '<span class="drow__ds">' + esc(meta) + '</span>' : '') + '</span>' +
        '<span class="drow__vl">' + comma(p.kcal) + '<small class="dfind__per"> kcal/100' + p.base + '</small></span></button></li>';
    }).join('') + '</ul>' : '';
    // 식품표 후보 (앱이 가진 식약처 음식 · 원재료 — 바로, 서버 없이). 끼니 상세의 「다른 음식으로 바꾸기」에서만
    var tab = f.table && f.table.length ? '<h3 class="dsec dfind__h">식품표</h3><ul class="dlist dfind__list dfind__list--tab">' + f.table.map(function (e, i) {
      return '<li><button type="button" class="dfind__row" data-act="dp-tpick" data-v="' + i + '"><span class="drow__tx"><span class="drow__nm">' + esc(e.name.replace(/_/g, ' ')) + '</span><span class="drow__ds">' + (e.kind === 'd' ? '음식' : '원재료') + (e.serve ? ' · 1인분 ' + e.serve + e.base : '') + '</span></span>' +
        '<span class="drow__vl">' + comma(e.kcal) + '<small class="dfind__per"> kcal/100' + esc(e.base) + '</small></span></button></li>';
    }).join('') + '</ul>' + (f.items || f.busy || f.error ? '<h3 class="dsec dfind__h">식약처 가공식품</h3>' : '') : '';
    return '<div class="sheet-layer sheet-layer--top">' +
      '<button type="button" class="scrim" data-act="dp-close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dp-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<h2 id="dp-title" class="sheet__title">' + esc(f.title || '제품 찾기') + '</h2>' +
      '<p class="sheet__sub">「' + esc(f.name) + '」을(를) ' + (f.table ? '식품표나 ' : '') + '식약처 가공식품에서 골라요</p>' +
      '<div class="dfind__bar"><label class="sr-only" for="dp-q">찾을 제품 이름</label><input id="dp-q" class="dfind__in" type="search" maxlength="40" autocomplete="off" enterkeyhint="search" value="' + esc(f.q) + '" placeholder="예) 신라면, 농심 새우깡">' +
        '<button type="button" class="mbtn mbtn--solid dfind__go" data-act="dp-go"' + (f.busy ? ' disabled' : '') + '>찾기</button></div>' +
      tab + '<p class="dfind__st' + (f.error ? ' dfind__st--err' : '') + '" role="' + (f.error ? 'alert' : 'status') + '">' + esc(st) + '</p>' + list +
      '</section></div>';
  }

  var api = { settingsScreen: settingsScreen, foodsScreen: foodsScreen, foodSheet: foodSheet, mirror: mirror, goalSum: goalSum, WAIT_WHY: WAIT_WHY, mealScreen: mealScreen, itemSheet: itemSheet, itemPrev: itemPrev, findSheet: findSheet, goalScreen: goalScreen, reco: reco, notes: notes, disc: disc, basisSheet: basisSheet, home: home, logScreen: logScreen, logFoot: logFoot, whenSheet: whenSheet, confirmScreen: confirmScreen, mealName: mealName, GOAL_NAME: GOAL_NAME };
  root.RT = root.RT || {};
  root.RT.viewDiet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
