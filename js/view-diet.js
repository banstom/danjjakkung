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

  /** 첫 화면: 내 목표 · 단짝 목표 · 오늘 먹은 것 (짝꿍 식탁 그래프는 D5). h = { mine, partner, today: { meals, total, goal, delId }, partnerToday: { name, total, n } | null } */
  function home(h) {
    var t = h.today || { meals: [], total: null };
    var list = t.meals.length ? '<ul class="dmeals">' + t.meals.map(function (m) {
      var del = h.today.delId === m.id;
      return '<li class="dmeal"><span class="dmeal__at">' + esc(m.at || '') + '</span><span class="dmeal__tx"><span class="dmeal__nm">' + esc(mealName(m)) + (m.together ? ' <span class="abadge">함께</span>' : '') + (m.pending && m.pending.length ? ' <span class="dwait">정리 대기 ' + m.pending.length + '</span>' : '') + '</span>' +
        '<span class="dmeal__ds">' + esc((m.items || []).map(function (i) { return i.name; }).concat((m.pending || []).map(function (x) { return x.raw; })).join(' · ')) + '</span></span>' +
        '<span class="dmeal__vl">' + comma(m.total ? m.total.kcal : 0) + '</span>' +
        '<button type="button" class="dmeal__del' + (del ? ' is-armed' : '') + '" data-act="dm-del" data-v="' + esc(m.id) + '" aria-label="' + esc((m.at || '') + ' ' + mealName(m) + (del ? ' 정말 지우기' : ' 지우기')) + '">' + (del ? '지우기' : '×') + '</button></li>';
    }).join('') + '</ul>' : '<p class="dnote">' + (t.off ? '기록을 불러오지 못했어요 · 저장 규칙 배포 전이거나 연결이 끊겼어요' : '아직 오늘 기록이 없어요') + '</p>';
    var sum = t.total ? '<p class="dtoday__sum"><b>' + comma(t.total.kcal) + '</b> kcal' + (t.goal ? ' / ' + comma(t.goal.kcal) : '') + ' · 탄 ' + grams(t.total.carb) + ' · 단 ' + grams(t.total.protein) + ' · 지 ' + grams(t.total.fat) + '</p>' : '';
    var pt = h.partnerToday ? '<p class="dnote">' + esc(h.partnerToday.name) + ' 님 오늘 ' + (h.partnerToday.n ? comma(h.partnerToday.total.kcal) + 'kcal · ' + h.partnerToday.n + '끼' : '아직 기록 없음') + '</p>' : '';
    return '<div class="mscreen"><div class="mbar"><button type="button" class="mbar__btn" data-act="diet-close" aria-label="전체로 돌아가기">' + svg(BACK) + '</button><h1 class="mbar__title">단짝 식탁</h1></div>' +
      '<section class="card dtoday"><div class="dgc__head"><h2 class="dgc__t">오늘 먹은 것</h2></div>' + sum + list + pt +
      '<button type="button" class="mbtn mbtn--solid dtoday__go" data-act="dl-open">기록하기</button></section>' +
      goalCard('내 목표', h.mine, true) + (h.partner ? goalCard(h.partner.name + ' 님 목표', h.partner.goal, false) : '') + '</div>';
  }

  /** ④ 기록하기 (목업 04). e = { dateLabel, text, together, chips, partnerName, loading, error, whenLabel } */
  function logScreen(e, entering) {
    return '<div class="sheet-layer sheet-layer--full">' +
      '<section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dl-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="dl-close" aria-label="돌아가기">' + svg(BACK) + '</button></div>' +
      '<p class="caption">' + esc(e.dateLabel) + '</p><h2 id="dl-title" class="title">무엇을 먹었나요?</h2>' +
      '<p class="dlog__sub">평소 말투로 적으면 정리해 드려요</p>' +
      '<label class="sr-only" for="dl-text">먹은 것</label><textarea id="dl-text" class="dlog__ta" rows="5" maxlength="2000" placeholder="예) 2230에 식사: 밥 1.5공기 / 조기 1개 / 김치꽁치찌개">' + esc(e.text) + '</textarea>' +
      '<p class="dlog__hint">시각을 안 적으면 지금 시각으로 넣어요</p>' +
      '<div class="dlist dwhen"><button type="button" class="dwhen__row" data-act="dl-when" aria-haspopup="dialog"><span class="dwhen__l">언제 먹었나요</span><span class="dwhen__v">' + esc(e.whenLabel) + '</span>' + svg(CHEV, 18) + '</button></div>' +
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
  function section(m, many) {
    var n = m.items.length + m.pending.length, est = m.pending.length || m.items.some(function (i) { return i.est; });
    var rows = m.items.map(function (i) {
      return '<li class="drow"><span class="drow__tx"><span class="drow__nm">' + esc(i.name) + (i.est ? ' <span class="dest">· 추정</span>' : '') + '</span>' + (i.sub ? '<span class="drow__ds">' + esc(i.sub) + '</span>' : '') + '</span><span class="drow__vl">' + comma(i.kcal) + '</span></li>';
    }).concat(m.pending.map(function (x) {
      return '<li class="drow drow--wait"><span class="drow__tx"><span class="drow__nm">' + esc(x.raw) + '</span><span class="drow__ds">' + esc(WAIT_WHY[x.reason] || '아직 계산 못 함') + ' · 저장해 두고 나중에 정리해요</span></span><span class="dwait">정리 대기</span></li>';
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
    var cells = ['월', '화', '수', '목', '금', '토', '일'].map(function (x) { return '<span class="dcal__w" aria-hidden="true">' + x + '</span>'; }).join('') +
      w.cells.map(function (c) {
        if (!c) return '<span></span>';
        return '<button type="button" class="dcal__d' + (c.on ? ' is-on' : '') + (c.today ? ' is-today' : '') + '"' + (c.off ? ' disabled' : ' data-act="dl-when-pick" data-v="' + esc(c.key) + '"') +
          ' aria-pressed="' + !!c.on + '" aria-label="' + esc(c.label) + (c.today ? ', 오늘' : '') + '">' + c.d + '</button>';
      }).join('');
    return '<div class="sheet-layer sheet-layer--top">' +
      '<button type="button" class="scrim" data-act="dl-when-close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dw-title">' +
      '<span class="grabber" aria-hidden="true"></span>' +
      '<h2 id="dw-title" class="sheet__title dwhen__title">언제 먹었나요?</h2>' +
      '<div class="dseg dseg--wide dwhen__quick" role="group" aria-label="빠르게 고르기">' + w.quick.map(function (q) { return '<button type="button" class="dseg__b" data-act="dl-when-pick" data-v="' + esc(q.key) + '" aria-pressed="' + !!q.on + '">' + esc(q.name) + '</button>'; }).join('') + '</div>' +
      '<div class="dcal__head"><p class="dcal__m" aria-live="polite">' + esc(w.title) + '</p>' +
        '<button type="button" class="mbar__btn" data-act="dl-when-month" data-v="-1" aria-label="이전 달"' + (w.prev ? '' : ' disabled') + '>' + svg(BACK) + '</button>' +
        '<button type="button" class="mbar__btn" data-act="dl-when-month" data-v="1" aria-label="다음 달"' + (w.next ? '' : ' disabled') + '>' + svg(CHEV) + '</button></div>' +
      '<div class="dcal">' + cells + '</div>' +
      '<p class="sheet__sub dcal__note">테두리 = 오늘 · 한 달 전까지 고를 수 있어요</p>' +
      '</section></div>';
  }

  /** ⑤ 확인 카드 (목업 05). c = { meals: [{ at, name, total, items: [{ name, sub, kcal, est }], pending }], ai: idle|busy|done|fail, aiNote, questions, together, partnerName, saving, error, dayLabel } */
  function confirmScreen(c, entering) {
    var many = c.meals.length > 1, nAll = c.meals.reduce(function (a, m) { return a + m.items.length + m.pending.length; }, 0);
    var aiBox = c.ai === 'busy' ? '<p class="dai" role="status"><span class="dai__dot" aria-hidden="true"></span>모르는 줄을 AI가 정리하는 중이에요…</p>'
      : c.aiNote ? '<p class="dai dai--' + (c.ai === 'fail' ? 'fail' : 'ok') + '" role="' + (c.ai === 'fail' ? 'alert' : 'status') + '">' + esc(c.aiNote) + '</p>' : '';
    var qs = c.questions && c.questions.length && c.ai !== 'busy' ? '<section class="dasks" aria-labelledby="dq-title"><h3 class="dsec" id="dq-title">꼭 필요한 것만 물어볼게요 · 한 번 정하면 다음부터 덜 물어요</h3>' +
      c.questions.map(function (q, i) { return askCard(q, i, c.questions.length); }).join('') +
      '<div class="dask__row"><button type="button" class="mbtn mbtn--solid" data-act="dq-send">답하고 다시 정리</button><button type="button" class="mbtn" data-act="dq-skip">건너뛰기</button></div></section>' : '';
    return '<div class="sheet-layer sheet-layer--full">' +
      '<section class="sheet dscreen' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dc-title">' +
      '<div class="dbar"><button type="button" class="mbar__btn" data-act="dl-back" aria-label="고치러 돌아가기">' + svg(BACK) + '</button></div>' +
      '<p class="caption">' + (c.dayLabel ? esc(c.dayLabel) + ' 기록이에요 · 확인하고 저장해요' : '확인하고 저장해요') + '</p>' +
      (many ? '<h2 id="dc-title" class="title">끼니 ' + c.meals.length + '개</h2>' : '') +
      aiBox + c.meals.map(function (m) { return section(m, many); }).join('') + qs +
      (c.together && c.partnerName ? '<p class="dnote">' + esc(c.partnerName) + ' 님과 함께 먹은 끼니로 표시해요</p>' : '') +
      (c.error ? '<p class="rform__error" role="alert">' + esc(c.error) + '</p>' : '') +
      '<div class="dfoot"><button type="button" class="mbtn mbtn--solid dfoot__go" data-act="dl-save"' + (c.saving || !nAll ? ' disabled' : '') + '>' + (c.saving ? '저장 중…' : c.ai === 'busy' ? '기다리지 않고 저장' : many ? '끼니 ' + c.meals.length + '개 저장' : '저장') + '</button></div>' +
      '</section></div>';
  }

  var api = { goalScreen: goalScreen, reco: reco, notes: notes, disc: disc, basisSheet: basisSheet, home: home, logScreen: logScreen, logFoot: logFoot, whenSheet: whenSheet, confirmScreen: confirmScreen, mealName: mealName, GOAL_NAME: GOAL_NAME };
  root.RT = root.RT || {};
  root.RT.viewDiet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
