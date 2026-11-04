/* 목업 화면: ?o=A|B1|B2|C1|C2 &theme=<id> */
(function () {
  var q = new URLSearchParams(location.search);
  var o = q.get('o') || 'A';
  document.documentElement.dataset.theme = q.get('theme') || 'soft-pastel';
  var DOW = ['월', '화', '수', '목', '금', '토', '일'];
  // 지난주 10/26(월) ~ 11/1(일). 1 = 함, 0 = 안 함, p = 시작 전
  var R = [
    { who: '다진', slot: 'her', items: [['🦵', '스쿼트 100개', '1101110'], ['📚', '책 20쪽', '1011011']] },
    { who: '준민', slot: 'me', items: [['🏃', '달리기 3km', '1100101'], ['💧', '물 2L', 'ppp1111']] }
  ];
  var ALL = '1000010'; // 모두 해낸 날 (계산 결과 예시)
  var TABS3 = [
    ['routine', '루틴', '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'],
    ['schedule', '시간표', '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'],
    ['todo', '할 일', '<path d="M4 7l2 2 3.5-3.5M4 15l2 2 3.5-3.5M13 8h7M13 16h7"/>']
  ];
  var TAB_LOOK = ['look', '돌아보기', '<path d="M5 20V11M12 20V5M19 20v-6"/>'];
  function tabbar(active, four) {
    var tabs = four ? TABS3.concat([TAB_LOOK]) : TABS3;
    return '<nav class="tabbar">' + tabs.map(function (t) {
      return '<button class="tabbar__btn"' + (t[0] === active ? ' aria-current="page"' : '') + '><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + t[2] + '</svg><span>' + t[1] + '</span></button>';
    }).join('') + '</nav>';
  }
  function header() {
    return '<header class="top"><div class="top__text"><p class="caption">11월 3일 화요일 · 준민 님으로 접속 · <button class="link-btn">로그아웃</button></p><h1 class="title">단짝꿍</h1></div>' +
      '<div class="top__side"><button class="bell-btn">🔔</button><button class="bell-btn">🎨</button></div></header>';
  }
  var CHEV = { p: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>', n: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' };
  function weekHead(label) {
    return '<div class="grid-head"><button class="icon-btn">' + CHEV.p + '</button><span class="grid-title"><span class="grid-range">' + label + '</span></span><button class="icon-btn" disabled>' + CHEV.n + '</button></div>';
  }
  function stat(label, value, clean) {
    return '<div class="stat' + (clean ? ' stat--clean' : '') + '"><span class="stat__label">' + label + '</span><span class="stat__value">' + value + '</span></div>';
  }
  function usCard(title, nav) {
    return '<section class="card">' + (nav ? weekHead('10월 26일 – 11월 1일') : '') + '<div class="rv-head"><h2 class="rv-title">' + title + '</h2>' + (nav ? '' : '<span class="rv-sub">10월 26일 – 11월 1일</span>') + '</div>' +
      '<div class="rv-quad">' + stat('모두 해낸 날', '2일', true) + stat('함께 끝낸 일', '2개') + stat('꿍 주고받음', '4번') + stat('함께 일정', '5시간') + '</div></section>';
  }
  function cellsOf(s, both) {
    return s.split('').map(function (c) {
      var cls = c === 'p' ? 'lv-pre' : c === '1' ? (both ? 'is-both' : 'lv-full') : 'lv-none';
      return '<span class="rv-cell ' + cls + '"></span>';
    }).join('');
  }
  function routineWeek(withHead) {
    var h = '<div class="rv-grid"><span></span>' + DOW.map(function (d) { return '<span class="dow">' + d + '</span>'; }).join('');
    R.forEach(function (p) {
      h += '<div class="rv-who"><span class="dot dot--' + p.slot + '"></span>' + p.who + '</div>';
      p.items.forEach(function (it) {
        h += '<span class="rv-name"><span class="emoji-tile">' + it[0] + '</span>' + it[1] + '</span>' + cellsOf(it[2]);
      });
    });
    h += '<div class="rv-sep"></div><span class="rv-name rv-both"><span class="emoji-tile">🎉</span>모두 해낸 날</span>' + cellsOf(ALL, true) + '</div>';
    var legend = '<div class="grid-foot"><span class="hint-strong">줄을 누르면 그 루틴의 한 달이 열려요</span><span class="legend"><span class="legend__item"><span class="swatch lv-none"></span>안 함</span><span class="legend__item"><span class="swatch lv-full"></span>함</span></span></div>';
    return '<section class="card">' + (withHead ? '<div class="rv-head"><h2 class="rv-title">루틴</h2><span class="rv-sub">달성 15 / 26칸</span></div>' : '') + h + legend + '</section>';
  }
  function planeCard() {
    return '<section class="card"><div class="rv-head"><h2 class="rv-title">끝낸 일</h2><span class="rv-sub">7개 · 평면 위치 기준</span></div>' +
      '<div class="mini-plane">' +
      '<div class="mini-plane__q is-key"><span class="mini-plane__label">계획할 일</span><span class="mini-plane__n">3</span></div>' +
      '<div class="mini-plane__q"><span class="mini-plane__label">지금 할 일</span><span class="mini-plane__n">2</span></div>' +
      '<div class="mini-plane__q"><span class="mini-plane__label">나중에</span><span class="mini-plane__n">0</span></div>' +
      '<div class="mini-plane__q"><span class="mini-plane__label">빨리 쳐낼 일</span><span class="mini-plane__n">2</span></div></div>' +
      '<p class="rv-note">📌 <b>급해지기 전에</b> 끝낸 중요한 일이 3개예요</p>' +
      '<div class="rv-bars">' +
      '<div class="rv-bar"><span>함께</span><span class="rv-bar__track"><span class="rv-bar__fill" style="width:40%;background:var(--both)"></span></span><span class="rv-bar__n">2</span></div>' +
      '<div class="rv-bar"><span>다진</span><span class="rv-bar__track"><span class="rv-bar__fill" style="width:60%;background:var(--her)"></span></span><span class="rv-bar__n">3</span></div>' +
      '<div class="rv-bar"><span>준민</span><span class="rv-bar__track"><span class="rv-bar__fill" style="width:40%;background:var(--me)"></span></span><span class="rv-bar__n">2</span></div></div></section>';
  }
  function kungCard() {
    return '<section class="card both"><div class="both__text"><span class="both__title">💌 꿍 주고받음</span><span class="both__hint">꿍 받은 날 루틴을 끝까지 해낸 날 3번</span></div><span class="both__value">4번</span></section>';
  }
  function monthGrid(note) {
    var cells = '';
    for (var i = 0; i < 0; i++) cells += '<span class="cell lv-out"></span>';
    var lv = ['full', 'half', 'none', 'half', 'full', 'half', 'none'];
    for (var d = 1; d <= 30; d++) {
      var c = d <= 2 ? lv[(d + 3) % 7] : 'future';
      cells += '<span class="cell lv-' + c + (d === 3 ? ' is-today' : '') + '">' + d + '</span>';
    }
    return '<section class="card grid-card">' + weekHead('2026년 11월') + '<div class="week">' + ['일', '월', '화', '수', '목', '금', '토'].map(function (d) { return '<span class="dow">' + d + '</span>'; }).join('') + '</div><div class="week cells">' + cells + '</div>' +
      '<div class="grid-foot"><span class="hint-strong">' + (note || '칸을 누르면 그날 기록이 열려요') + '</span></div></section>';
  }
  function chips() {
    return '<div class="chip-row"><div class="chips"><button class="chip" aria-pressed="true">전체</button><button class="chip">다진</button><button class="chip">준민</button></div><button class="chip chip--manage">＋ 내 루틴</button></div>';
  }
  function seg(a, b, on) {
    return '<div class="plan__bar"><div class="seg"><button class="seg__btn" aria-pressed="' + (on === 0) + '">' + a + '</button><button class="seg__btn" aria-pressed="' + (on === 1) + '">' + b + '</button></div></div>';
  }
  var html = '', four = false, tab = 'routine';
  if (o === 'A') {
    four = true; tab = 'look';
    html = header() + seg('주', '월', 0) + usCard('지난주 우리', true) + routineWeek(true) + planeCard() + kungCard();
  } else if (o === 'B1') {
    html = header() + chips() + '<section class="card grid-card"><div class="grid-head"><button class="icon-btn">' + CHEV.p + '</button><span class="grid-title"><span class="grid-range">10월 26일 – 11월 1일</span></span><div class="seg seg--mini"><button class="seg__btn" aria-pressed="true">주</button><button class="seg__btn" aria-pressed="false">월</button></div></div>' +
      routineWeek(false).replace('<section class="card">', '').replace(/<\/section>$/, '') + '</section>' +
      '<div class="rv-strip">' + stat('모두 해낸 날', '2일', true) + stat('꿍', '4번') + '</div>';
  } else if (o === 'B2') {
    tab = 'todo';
    html = header() + seg('목록', '평면', 1) + planeCard().replace('끝낸 일</h2>', '지난주 끝낸 일</h2>') +
      '<section class="card"><p class="rv-note" style="margin:0">시간표 탭도 같은 방식: 주 보기 위에 <b>함께 일정 5시간 · 쉰 날 1일</b> 한 줄</p></section>';
  } else if (o === 'C1') {
    html = header() + '<section class="card rv-banner"><span class="emoji-tile">🎉</span><div class="rv-banner__text"><span class="rv-banner__title">지난주 우리 돌아보기</span><span class="rv-banner__sub">모두 해낸 날 2일 · 끝낸 일 7개 · 일요일 저녁 알림으로도 와요</span></div>' + CHEV.n + '</section>' + chips() + monthGrid();
  } else if (o === 'C2') {
    html = header() + chips() + monthGrid() +
      '<div class="sheet-layer"><button class="scrim"></button><section class="sheet sheet--tall"><div class="sheet__head"><h2 class="sheet__title">지난주 우리</h2></div><p class="sheet__sub">10월 26일 – 11월 1일 · 1 / 4</p>' +
      '<div class="rv-story"><span class="rv-sub">둘 다 루틴을 모두 해낸 날</span><span class="rv-story__big">2일 🎉</span>' + routineWeek(false).replace('<section class="card">', '<div>').replace(/<\/section>$/, '</div>') + '</div>' +
      '<div class="rv-dots" style="margin-top:12px"><i class="on"></i><i></i><i></i><i></i></div>' +
      '<p class="rv-note" style="text-align:center">옆으로 넘기면 끝낸 일 · 꿍 · 함께 일정</p></section></div>';
  }
  document.getElementById('app').innerHTML = html;
  document.body.insertAdjacentHTML('beforeend', tabbar(tab, four));
  document.body.classList.add('has-tabbar');
})();
