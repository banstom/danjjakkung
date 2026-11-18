/* 앱(웹판) — 로그인하고, 저장소를 구독하고, 누를 때마다 다시 그린다.
   화면 계산(model) · 그리기(view) · 저장(store)은 artifact 판과 같은 파일을 쓴다. */
(function (root) {
  'use strict';
  var RT = root.RT;
  var D = RT.dates;
  var appEl = document.getElementById('app');

  var state = {
    status: 'loading',   // loading | login | setup | denied | unconfigured | ready | nodb
    members: {},         // { uid: { name } }
    server: {},          // 저장소가 보내 준 체크
    meta: {},            // 체크마다 누가 · 언제
    pending: {},         // 저장 중인 내 탭 { id: true/false }
    me: null,            // 지금 보는 사람 = 로그인한 계정의 uid (이름을 정한 뒤)
    uid: null,
    email: '',
    auth: { mode: 'login', email: '', password: '', error: '', busy: false, info: '' },
    setup: { name: '', error: '', busy: false },
    verify: { error: '', info: '', busy: false },
    today: D.fromLocal(new Date()),
    filter: 'all',
    page: 0,
    sheetDay: null,
    sheetEntering: false,
    routineDocs: [],     // routines 컬렉션
    manage: null,        // 「내 루틴」 시트 { open, form: { key, name, icon, start, error, saving, confirmDelete } }
    tab: 'routine',      // 아래 탭: routine | schedule | todo | look(돌아보기)
    review: { mode: 'week', page: 0, key: null, todos: [], kungs: [], loading: false, error: '' }, // 돌아보기: 주 · 달, page = 몇 칸 전, 기간 안에 끝낸 일 · 꿍 (열 때 불러옴)
    todoDocs: [], todoErr: '', eventDocs: [], eventErr: '',
    todoUi: { expanded: {}, showDone: {} },  // 묶음마다 「더 보기」 · 「완료 보기」
    todoForm: null,      // 할 일 추가 · 고치기 시트
    todoView: 'list',    // 할 일 탭: list(목록) | plane(u&I 평면)
    uni: { who: null, mode: 'block', flash: null },  // 평면: 누구 것 · 블록/점 · 방금 놓은 일
    place: null,         // 축 놓기 화면 { id, title, scope, cat, axis: 'u'|'i', p, raw: { u, i }, cur, touched, ask, hint }
    uniSheet: null,      // 평면 시트 { kind: 'detail', id, confirmDelete } | { kind: 'unplaced' }
    archive: null,       // 「완료한 일 보관함」 { items, loading, more, error }
    eventForm: null,     // 일정 추가 · 고치기 · 보기 시트
    catDocs: [],         // cats 컬렉션 (둘이 같이 쓰는 시간표 카테고리 — js/cats.js)
    catSheet: null,      // 「카테고리」 시트 { back: 돌아갈 일정 · 할 일 폼, backKind: 'event' | 'todo', sorting: 순서 바꾸는 중, edit: { id, name, icon, error, saving, confirmDelete } | null, error }
    sched: null,         // { mode: 'week' | 'day', weekStart, day }
    notifyOpen: false,   // 「알림」 시트
    themeOpen: false,    // 「테마」 시트
    couple: null,        // 우리 기념일 couple/main (v46) — 없으면 null
    coupleOff: false,    // 규칙이 아직 없거나 막히면 기념일 칸만 숨긴다
    anniv: null,         // 기념일 시트 { edit: null | { label, custom, start, saving, error } }
    map: null,           // 단짝 지도 화면 (v48) { seg, sel, vb, sheet: null | { mode: 'view' | 'visit', form }, find: null | { q } }
    placeDocs: null,     // places 문서들 { code: doc } — null = 아직 안 읽음
    placesOff: false,    // 규칙이 아직 없거나 막히면 true
    colors: null,        // 내 계정의 나 · 상대 색 (users 문서의 colors, 테마마다) — null = 아직 모름
    prefs: null,         // 내 알림 설정 { partner, remindAt, hide } (users/<uid>.notify)
    weeklyOn: true,      // 일요일 저녁 돌아보기 알림 (users/<uid>.weekly, 없으면 켬)
    todoNotifyOn: true,  // 함께 할 일 알림 (users/<uid>.todoNotify, 없으면 켬, v38)
    routineView: 'time', // 루틴 묶어 보기 (users/<uid>.routineView, v44) — time | kind | manual
    missNotifyOn: true,  // 아침 8시 어제 놓친 루틴 알림 (users/<uid>.missNotify, 없으면 켬, v41)
    prefsReady: false,
    push: { busy: false, error: '', info: '' },
    toast: '',
    kungs: [],           // 오늘 보낸 꿍 (kungs 컬렉션, 날짜가 오늘인 것)
    grow: { key: null, todos: [], kungs: [], ok: false }, // 토마토 · 퀘스트용 지난 기록 (끝낸 일 · 꿍, 하루에 한 번 불러옴, v40 · v41)
    growOpen: false,     // 「우리 토마토」 시트
    kungOff: false,      // 꿍 규칙이 아직 없거나 막혔으면 칸을 숨긴다
  };
  var store = null;
  var toastTimer = null;
  var gotMembers = false, gotChecks = false, gotRoutines = false;
  var membersFromServer = false; // 이름을 정했는지는 서버 확인을 받은 뒤에만 판단한다
  var LS_SEEN = 'danjjakkung.lastSeen';
  // 예전 이름(짝꿍 그리드 · 도란도란)으로 저장해 둔 값도 이어서 쓴다
  var LS_OLD = { 'danjjakkung.lastSeen': 'jjakkung.lastSeen', 'danjjakkung.announced': 'dorandoran.announced' };
  function lsGet(k) {
    try { var v = root.localStorage.getItem(k); return v != null ? v : (LS_OLD[k] ? root.localStorage.getItem(LS_OLD[k]) : null); }
    catch (e) { return null; }
  }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 화면은 그대로 */ } }

  // 사람 이름(members) + 루틴 컬렉션 = 화면 모델이 받는 설정
  function fullConfig() {
    var people = {};
    Object.keys(state.members).forEach(function (uid) { people[uid] = state.members[uid].name; });
    return { people: people, routines: state.routineDocs };
  }

  function model() {
    return RT.model.build({
      config: fullConfig(), manage: state.manage,
      checks: RT.store.mergeChecks(state.server, state.pending), meta: state.meta,
      me: state.me, identity: state.me ? 'account' : 'pending',
      today: state.today, filter: state.filter, page: state.page, sheetDay: state.sheetDay, routineView: state.routineView,
      kungs: state.kungs, kungOff: state.kungOff
    });
  }

  // 입력칸에서 글자를 치는 동안에는 다시 그리지 않는다 (폰 키보드가 닫히거나 한글 조합이 깨지지 않게)
  var composing = false, deferred = false, deferTimer = null;
  var INPUT_IDS = ['dg-age', 'dg-height', 'dg-weight', 'dg-e-kcal', 'dg-e-protein', 'dg-e-fat', 'dg-e-carb', 'mp-date', 'mp-note', 'mp-q', 'mp-wnote', 'an-label', 'an-start', 'cat-name', 'rt-name', 'rt-start', 'rt-cue', 'rt-at', 'au-email', 'au-pass', 'me-name', 'nt-remind', 'td-title', 'td-date', 'td-short', 'td-memo', 'ev-title', 'ev-short', 'ev-date', 'ev-start', 'ev-end', 'ev-from', 'ev-until'];
  for (var iw = 0; iw < 7; iw++) INPUT_IDS.push('ev-ts-' + iw, 'ev-te-' + iw); // 요일마다 시간
  for (var ix = 0; ix < 4; ix++) INPUT_IDS.push('ev-xs-' + ix, 'ev-xe-' + ix, 'ev-ms-' + ix, 'ev-me-' + ix); // 하루에 한 번 더 · 그날만 시간
  var LS_QUEST = 'danjjakkung.questSeen';
  var TAB_IDS = ['routine', 'schedule', 'todo', 'look', 'all']; // v47: 「전체」
  var LS_BOX = 'danjjakkung.box', LS_TAB = 'danjjakkung.tab', LS_VIEW = 'danjjakkung.todoView', LS_UNIMODE = 'danjjakkung.uniMode', LS_TODOCAT = 'danjjakkung.todoCat';
  if (lsGet(LS_VIEW) === 'plane') state.todoView = 'plane';
  if (lsGet(LS_UNIMODE) === 'dot') state.uni.mode = 'dot';
  (function () {
    var q = /[?&]tab=(routine|schedule|todo|look|all)/.exec(root.location.search || '');
    var t = q ? q[1] : lsGet(LS_TAB);
    if (TAB_IDS.indexOf(t) >= 0) state.tab = t;
    // 돌아보기는 언제나 이번 주부터 (주소로 열어도 · 다시 열어도)
    if (q) { lsSet(LS_TAB, t); try { root.history.replaceState(null, '', root.location.pathname); } catch (e) {} }
  })();
  function typing() {
    var el = document.activeElement;
    return !!el && INPUT_IDS.indexOf(el.id) >= 0 && appEl.contains(el);
  }
  function render(force) {
    // 한글 조합 중인 입력칸이 조합 끝 신호 없이 사라지면(찾기 결과 누르기 · 저장) composing 이 남아 화면 갱신이 계속 미뤄졌다 → 입력칸이 없으면 풀기
    if (composing && !typing()) composing = false;
    if (!force && (composing || typing() || (lift && lift.on) || (rlift && rlift.on) || (kmZoom && kmZoom.busy()) || mdrag || avaTouching())) {
      deferred = true;
      // 손가락 · 끌기 때문에 미뤘으면 잠시 뒤 다시 (입력칸은 focusout 에서 다시 그림)
      if (!typing() && !deferTimer) deferTimer = setTimeout(function () { deferTimer = null; if (deferred) render(); }, 400);
      return;
    }
    deferred = false;
    var sheetEl = appEl.querySelector('.sheet');
    var scrollTop = sheetEl ? sheetEl.scrollTop : 0;
    var m = model();
    if (m.manage && m.manage.gone && state.manage) {
      // 다른 기기에서 지워진 루틴을 고치고 있었다면 칸을 닫는다
      state.manage = { open: true, form: null };
      state.toast = '다른 기기에서 지워진 루틴이에요';
      m = model();
    }
    // 더는 맞지 않는 상태는 여기서 바로잡는다
    if (!m.empty) {
      state.filter = m.filter;
      state.page = m.grid.page;
      if (state.sheetDay !== null && !m.sheet) { state.sheetDay = null; }
    }
    var focus = focusOf(document.activeElement);
    if (state.manage && !m.manage) state.manage = null;
    if (state.status !== 'ready') { state.notifyOpen = false; state.themeOpen = false; state.account = false; state.todoForm = null; state.eventForm = null; state.catSheet = null; state.place = null; state.uniSheet = null; state.archive = null; }
    if (state.todoForm && state.todoForm.id && !findTodo(state.todoForm.id) && !state.todoForm.saving) { state.todoForm = null; setTimeout(function () { showToast('다른 기기에서 지워진 할 일이에요'); }, 0); }
    if (state.eventForm && state.eventForm.id && !findEvent(state.eventForm.id) && !state.eventForm.saving) { state.eventForm = null; setTimeout(function () { showToast('다른 기기에서 지워진 일정이에요'); }, 0); }
    if (state.place && !state.place.fresh && !findTodo(state.place.id)) { state.place = null; setTimeout(function () { showToast('다른 기기에서 지워졌거나 완료된 할 일이에요'); }, 0); }
    if (state.uniSheet && state.uniSheet.kind === 'detail' && !findTodo(state.uniSheet.id)) state.uniSheet = null;
    var other = state.tab !== 'routine';
    var ex = state.status === 'ready' && (!other || state.tab === 'look' || state.growOpen) ? extras() : null;
    state.extras = ex;
    if (ex && !other && !m.empty) { m.grow = ex.grow; m.quest = ex.quest; }
    if (state.growOpen && !(ex && ex.grow)) state.growOpen = false;
    var plan = state.status === 'ready' ? planHtml(other) : {};
    if (state.status === 'ready' && state.anniv) plan.sheet = RT.viewReview.annivSheet(annivSheetModel(), state.sheetEntering);
    else if (state.anniv) state.anniv = null;
    var flipBefore = flipMeasure();
    if (state.status === 'ready' && state.account && !plan.sheet) plan.sheet = RT.viewAll.accountSheet({ meName: m.header.meName, email: state.email }, state.sheetEntering);
    if (state.status === 'ready' && state.ava && !plan.sheet) plan.sheet = RT.viewAvatar.sheet({ img: (state.avaDocs || {})[state.uid || state.me] ? state.avaDocs[state.uid || state.me].img : '', partnerName: partnerInfo().partnerName, error: state.ava.error, busy: state.ava.busy }, state.sheetEntering && !state.avaCrop) +
      (state.avaCrop ? RT.viewAvatar.crop(state.avaCrop, state.sheetEntering) : '');
    if (state.status === 'ready' && state.avaView && !plan.sheet) {
      var avv = avaViewModel();
      if (avv) plan.sheet = RT.viewAvatar.viewer(avv, state.sheetEntering); else state.avaView = null; // 사진이 지워지면 닫음
    }
    var sheetOpen = !!(((!other && (m.sheet || m.manage)) || state.notifyOpen || state.themeOpen || state.growOpen || plan.sheet) && state.status === 'ready');
    var entering = state.sheetEntering;
    if (state.status !== 'ready') m.header.meName = '';
    var onAll = state.status === 'ready' && state.tab === 'all';
    m.header.title = onAll ? '전체' : '';
    m.header.hidden = onAll && (!!state.map || !!state.diet); // 지도 화면은 자기 머리줄(뒤로 · 단짝 지도 · 찾기)
    m.header.dday = null; // v51: 디데이는 「전체」의 「우리 둘」 박스에서만 (사용자 결정)
    appEl.innerHTML = RT.view.page(state.status, m, state.toast, { sheetEntering: entering, auth: state.auth, setup: state.setup, verify: state.verify, email: state.email, web: true, grow: state.growOpen && ex ? ex.grow : null, notify: state.notifyOpen ? notifyModel() : null, theme: state.themeOpen && !state.notifyOpen ? themeModel() : null,
      tab: state.tab, tabHtml: plan.tab, sheetHtml: plan.sheet, tabbarHtml: state.status === 'ready' ? RT.viewPlan.tabbar(state.tab) : '' });
    document.body.classList.toggle('has-tabbar', state.status === 'ready');
    flipPlay(flipBefore);
    if (state.map) mountMap();
    if (state.avaCrop) avaApply();
    if (mdrag && !mdrag.li.isConnected) mdrag = null; // 강제로 다시 그려 줄이 사라졌으면 끌기 끝
    state.push.errorFresh = false;
    if (state.todoForm) state.todoForm.errorFresh = false;
    if (state.eventForm) state.eventForm.errorFresh = false;
    if (state.catSheet && state.catSheet.edit) state.catSheet.edit.errorFresh = false;
    state.sheetEntering = false;
    state.auth.errorFresh = false; state.setup.errorFresh = false; state.verify.errorFresh = false;
    setThemeColor();
    syncPeopleColors();
    if (state.manage && state.manage.form) state.manage.form.errorFresh = false;
    var newSheet = appEl.querySelector('.sheet');
    if (newSheet && scrollTop && !entering) newSheet.scrollTop = scrollTop;
    document.body.classList.toggle('has-sheet', sheetOpen);
    restoreFocus(focus, sheetOpen);
    if (focusAfter && (!sheetOpen || focusInSheet)) {
      // 시트가 닫히거나 줄이 접혀 사라졌을 때 포커스를 근처 버튼으로 옮긴다
      for (var fi = 0; fi < focusAfter.length; fi++) { var fe = appEl.querySelector(focusAfter[fi]); if (fe) { fe.focus({ preventScroll: true }); break; } }
      focusAfter = null; focusInSheet = false;
    }
    // 체크한 할 일이 「완료」로 접혀 사라지면 그 묶음의 버튼으로 포커스를 옮긴다
    if (focus && focus.act === 'todo-toggle' && !find(focus) && toggleScope[focus.value]) {
      var k = CSS.escape(toggleScope[focus.value]);
      var fb = appEl.querySelector('[data-act="todo-donelist"][data-key="' + k + '"]') || appEl.querySelector('[data-act="todo-add"][data-key="' + k + '"]');
      if (fb) fb.focus({ preventScroll: true });
    }
  }
  var toggleScope = Object.create(null); // 할 일 id → 묶음
  var focusAfter = null; // 다음 그리기 뒤 포커스할 곳 (앞에서부터 있는 것)
  var focusInSheet = false; // 시트가 열린 채여도 focusAfter 를 쓴다 (카테고리 시트 ↔ 일정 폼)

  // 다시 그려도 누르던 버튼에 포커스가 남도록
  var FOCUS_ATTR = { toggle: 'data-key', day: 'data-day', filter: 'data-id', page: 'data-dir', close: null,
    'pick-icon': 'data-icon', 'edit-routine': 'data-key', 'resume-routine': 'data-key', 'save-routine': null, 'cancel-form': null,
    'new-routine': null, 'stop-routine': null, 'delete-routine': null, 'close-manage': null, 'open-manage': null,
    'routine-view': 'data-v', 'pick-kind': 'data-v', 'rt-order': null, 'rt-order-done': null, 'rt-move': 'data-key',
    'when-mode': 'data-v', 'when-cue': 'data-v', 'when-remind': null, 'when-clear-at': null,
    'rest-open': null, 'rest-from': 'data-v', 'rest-until': 'data-v', 'rest-save': null, 'rest-cancel': null, 'wake-routine': 'data-key',
    'open-notify': null, 'close-notify': null, 'open-theme': null, 'close-theme': null, 'pick-theme': 'data-v', 'pick-color': 'data-key', 'reset-colors': null, 'push-on': null, 'push-off': null, 'push-test': null, 'pref-partner': null, 'pref-hide': null, 'pref-weekly': null, 'pref-todo': null, 'pref-miss': null, 'send-kung': null, 'open-grow': null, 'close-grow': null, 'open-quest': null,
    tab: 'data-tab', 'todo-toggle': 'data-id', 'todo-edit': 'data-id', 'todo-more': 'data-key', 'todo-donelist': 'data-key', 'todo-add': 'data-key',
    'todo-due': 'data-v', 'todo-cancel': null, 'todo-delete': null, 'sched-mode': 'data-mode', 'sched-day': 'data-day', 'sched-open-day': null, 'sched-week': 'data-dir',
    'sched-thisweek': null, 'event-add': null, 'event-open': 'data-at', 'event-edit': null, 'event-cancel': null, 'event-delete': null, 'ev-skip': 'data-v', 'ev-unskip': 'data-v',
    'ev-move': 'data-v', 'ev-move-save': null, 'ev-move-cancel': null, 'ev-unmove': 'data-v', 'ev-move-day': 'data-v',
    'ev-owner': 'data-v', 'ev-repeat': 'data-v', 'ev-wd': 'data-v', 'ev-timemode': 'data-v', 'ev-cat': 'data-v', 'ev-more-add': null, 'ev-more-del': 'data-v',
    'cat-open': null, 'cat-sort': null, 'cat-move': 'data-key', 'cat-close': null, 'cat-new': null, 'cat-edit': 'data-id', 'cat-icon': 'data-icon', 'cat-save': null, 'cat-cancel': null, 'cat-delete': null,
    'todo-view': 'data-v', 'todo-cat': 'data-v', 'todo-scope': 'data-v', 'todo-save-list': null, 'todo-save-place': null, 'uni-who': 'data-v', 'uni-mode': 'data-v', 'uni-open': 'data-id', 'uni-unplaced': null,
    'uni-place': 'data-id', 'uni-done': null, 'uni-edit': null, 'uni-delete': null, 'uni-close': null, 'place-block': null, 'place-cancel': null, 'place-ask': null, 'place-ans': 'data-v', 'place-stopask': null,
    'place-next': null, 'place-back': null, 'archive-open': null, 'archive-more': null, 'archive-undo': 'data-id', 'archive-close': null,
    'rv-mode': 'data-v', 'rv-page': 'data-dir', 'rv-now': null, 'rv-retry': null,
    'open-account': null, 'close-account': null, 'ava-open': null, 'ava-close': null, 'ava-view': 'data-v', 'ava-view-close': null, 'ava-view-edit': null, 'ava-delete': null, 'ava-crop-cancel': null, 'ava-crop-save': null, 'all-map': null, 'all-diet': null, 'diet-close': null, 'dg-open': null, 'dg-close': null, 'dg-goal': 'data-v', 'dg-sex': 'data-v', 'dg-act': 'data-v', 'dg-edit': 'data-v', 'dg-skip': null, 'dg-retune': null, 'dg-basis': null, 'dg-basis-close': null, 'dg-basis-ok': null, 'dg-start': null,
    'map-close': null, 'map-seg': 'data-v', 'map-zoom': 'data-v', 'map-visit': null, 'map-visit-cancel': null, 'map-visit-save': null, 'map-visit-edit': 'data-v', 'map-visit-delete': null, 'map-wish': null, 'map-rank': null, 'map-rank-close': null, 'map-rank-move': 'data-v', 'map-rank-save': null, 'map-unwish': null, 'map-star': 'data-v', 'map-sort': 'data-v', 'map-open': 'data-v', 'map-wish-add': null, 'map-find': null, 'map-find-close': null, 'map-pick': 'data-v', 'map-retry': null,
    'open-anniv': null, 'close-anniv': null, 'anniv-edit': null, 'anniv-label': 'data-v', 'anniv-box': 'data-v', 'anniv-save': null, 'anniv-cancel': null };
  function focusOf(el) {
    if (!el || !el.getAttribute || !appEl.contains(el)) return null;
    if (INPUT_IDS.indexOf(el.id) >= 0) {
      // 입력 중에 다시 그려도 커서 자리를 지킨다
      var sel = null;
      try { sel = [el.selectionStart, el.selectionEnd]; } catch (e) {}
      return { input: el.id, sel: sel };
    }
    var act = el.getAttribute('data-act');
    if (!act || !(act in FOCUS_ATTR)) return null;
    var attr = FOCUS_ATTR[act];
    return { act: act, attr: attr, value: attr ? el.getAttribute(attr) : null, inSheet: !!el.closest('.sheet') };
  }
  function find(f) {
    var sel = '[data-act="' + f.act + '"]' + (f.attr ? '[' + f.attr + '="' + CSS.escape(f.value || '') + '"]' : '');
    return appEl.querySelector((f.inSheet ? '.sheet ' : '') + sel);
  }
  function restoreFocus(f, sheetOpen) {
    if (f && f.input) {
      var inp = document.getElementById(f.input);
      if (inp) {
        inp.focus({ preventScroll: true });
        try { if (f.sel && f.sel[0] !== null) inp.setSelectionRange(f.sel[0], f.sel[1]); } catch (e) {}
        return;
      }
    }
    var target = f ? find(f) : null;
    if (sheetOpen && (!target || !target.closest('.sheet'))) {
      // 시트가 열려 있으면 포커스는 시트 안에 둔다
      // (입력칸에는 저절로 들어가지 않는다 — 폰 키보드가 갑자기 뜨지 않게)
      target = appEl.querySelector('.sheet [data-act="toggle"]:not([disabled]):not([aria-disabled="true"])') ||
        appEl.querySelector('.sheet [data-act="place-block"]') || appEl.querySelector('.sheet [data-act="uni-done"]') || appEl.querySelector('.sheet [data-act="uni-place"]') ||
        appEl.querySelector('.sheet [data-act="push-on"]:not([disabled])') ||
        appEl.querySelector('.sheet [data-act="event-edit"]') || appEl.querySelector('.sheet [type="submit"]:not([disabled])') ||
        appEl.querySelector('.sheet [data-act="save-routine"]:not([disabled])') || appEl.querySelector('.sheet [data-act="new-routine"]') || appEl.querySelector('.sheet .tpick.is-on') || appEl.querySelector('.sheet .close-btn') ||
        appEl.querySelector('.sheet [data-act="archive-undo"]') || appEl.querySelector('.sheet [data-act="archive-close"]') || appEl.querySelector('.sheet [data-act="uni-close"]');
    }
    if (target && !target.disabled && document.activeElement !== target) target.focus({ preventScroll: true });
  }

  function showToast(text, ms) {
    state.toast = text;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { state.toast = ''; render(); }, ms || 2600);
    render();
  }

  function openSheet(day) { state.sheetDay = day; state.sheetEntering = true; render(); }
  function closeSheet() {
    var day = state.sheetDay;
    state.sheetDay = null;
    render();
    var back = appEl.querySelector('[data-act="day"][data-day="' + day + '"]');
    if (back && !back.disabled) back.focus({ preventScroll: true });
  }

  function routines() { return RT.model.routinesFrom(fullConfig()); }
  function names() { return RT.people.names(fullConfig(), routines()); }

  // 휴대폰 위쪽 띠 색을 화면 바탕과 맞춘다
  function setThemeColor() { if (RT.themes) RT.themes.syncMeta(document); }
  /** 내 자리('her' | 'me') — 두 사람 순서는 루틴 탭과 같다 */
  function mySlot() {
    var ps = state.status === 'ready' ? planPeople() : [];
    for (var i = 0; i < ps.length; i++) if (ps[i].mine) return ps[i].slot;
    return null;
  }
  // 계정 색을 아직 모르면(불러오는 중) 이 기기에 적어 둔 색을 그대로 둔다
  function syncPeopleColors() {
    if (!RT.themes || state.colors === null) return;
    var slot = mySlot();
    if (slot) RT.themes.setPeople(slot, state.colors);
  }

  // 로그인한 계정이 이름을 정했으면 그 사람으로 본다
  function resolveIdentity() {
    if (!gotMembers || !state.uid) return;
    state.me = state.members[state.uid] ? state.uid : null;
    runCatchUp();
  }

  // ── 알림 ─────────────────────────────────────────────
  var openedAt = Date.now();
  var LS_ANN = 'danjjakkung.announced';
  var announced = Object.create(null);   // 이미 알려 줬거나 화면에서 본 체크 (id@at) — 기기에 최근 200개 보관
  (function () { try { (JSON.parse(lsGet(LS_ANN) || '[]') || []).forEach(function (k) { if (typeof k === 'string') announced[k] = true; }); } catch (e) {} })();
  function saveAnnounced() { lsSet(LS_ANN, JSON.stringify(Object.keys(announced).slice(-200))); }
  var checksDefinitive = false;          // 캐시가 아닌 저장소 값을 받았는지
  var SLACK_MS = 2 * 60 * 1000;          // 두 폰의 시계가 조금 달라도 놓치지 않게

  function visible() { return !document.hidden; }
  function keyOf(id, at) { return id + '@' + at; }

  // 다시 열었을 때(또는 화면으로 돌아왔을 때): 마지막으로 본 뒤 상대가 남긴 기록 요약
  function runCatchUp() {
    if (!checksDefinitive || !state.me || !visible()) return;
    var seen = lsGet(LS_SEEN);
    var now = new Date().toISOString();
    if (!seen) { // 이 기기에서 처음 열면 조용히, 지금까지 기록은 본 것으로
      Object.keys(state.meta).forEach(function (id) { var m = state.meta[id]; if (m && m.at) announced[keyOf(id, m.at)] = true; });
      saveAnnounced(); lsSet(LS_SEEN, now); return;
    }
    var since = new Date(new Date(seen).getTime() - SLACK_MS).toISOString();
    var fresh = {};
    Object.keys(state.meta).forEach(function (id) {
      var m = state.meta[id];
      if (m && m.at && !announced[keyOf(id, m.at)]) fresh[id] = m;
    });
    var msg = RT.news.catchUp(fresh, state.me, routines(), state.today, since, names());
    // 지금 화면에 보이는 기록은 모두 '본 것'으로 남긴다 → 다음에 다시 알리지 않음
    Object.keys(state.meta).forEach(function (id) { var m = state.meta[id]; if (m && m.at) announced[keyOf(id, m.at)] = true; });
    saveAnnounced();
    lsSet(LS_SEEN, now);
    if (msg) showToast(msg, 4200);
  }

  // 실시간: 상대가 방금 남긴 체크 (페이지를 연 뒤의 것만, 한 번씩만, 화면을 보고 있을 때만)
  function announceLive(changes) {
    if (!state.me || !visible()) return;
    var cutoff = new Date(openedAt - 60000).toISOString();
    var items = changes.filter(function (c) {
      return c.by && c.by !== state.me && c.at && c.at >= cutoff && !announced[keyOf(c.routine + '|' + c.date, c.at)];
    }).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    if (!items.length) return;
    items.forEach(function (c) { announced[keyOf(c.routine + '|' + c.date, c.at)] = true; });
    saveAnnounced();
    var msg = RT.news.live(items, state.me, routines(), state.today, names());
    if (msg) { lsSet(LS_SEEN, new Date().toISOString()); showToast(msg, 3600); }
  }

  var kungBusy = false;
  function sendKung() {
    var k = model().kung;
    if (!store || kungBusy || !k || k.status !== 'ready') return;
    kungBusy = true;
    var day = D.toKey(state.today);
    state.kungs = state.kungs.concat([{ from: state.me, to: k.to, date: day }]); render(true); // 바로 잠근다
    store.sendKung(state.me, k.to, day).then(function () {
      kungBusy = false; showToast('💌 ' + k.toName + ' 님에게 꿍을 보냈어요');
    }, function () {
      kungBusy = false;
      state.kungs = state.kungs.filter(function (x) { return x.from !== state.me; });
      showToast('보내지 못했어요. 잠시 뒤 다시 눌러 주세요');
    });
  }

  function toggle(key) {
    if (!store || state.sheetDay === null || state.sheetDay > state.today) return;
    var r = routines().filter(function (x) { return x.key === key; })[0];
    if (!r || !state.me || r.owner !== state.me) return; // 남의 루틴은 못 누른다
    var day = state.sheetDay;
    var dateKey = D.toKey(day);
    var id = key + '|' + dateKey;
    var current = RT.store.mergeChecks(state.server, state.pending);
    var next = !current[id];
    var wasAllDone = model().allDoneToday;
    state.pending = Object.assign({}, state.pending);
    state.pending[id] = next;
    // 누가 · 언제도 바로 보여 준다 (저장소 값이 오면 그걸로 바뀐다)
    state.meta = Object.assign({}, state.meta);
    if (next) state.meta[id] = { by: state.me, at: new Date().toISOString() }; else delete state.meta[id];
    render();
    store.setDone(key, dateKey, next, { person: state.me, uid: state.uid }).then(function () {
      // 저장 완료: 마지막 탭이 이것이면 표시를 저장된 값으로 옮긴다 (그 뒤 탭이 있으면 그대로 둔다)
      if (state.pending[id] === next) {
        state.pending = Object.assign({}, state.pending); delete state.pending[id];
        state.server = Object.assign({}, state.server); if (next) state.server[id] = true; else delete state.server[id];
      }
      if (day === state.today && next && !wasAllDone && model().allDoneToday) {
        showToast(model().togetherToday ? '🎉 오늘 모두 완료! 같이 해냈어요' : '🎉 오늘 루틴 완료!');
      } else render();
    }, function () {
      // 실패하면 화면을 원래대로 돌리고 알려 준다
      if (state.pending[id] === next) { state.pending = Object.assign({}, state.pending); delete state.pending[id]; }
      showToast('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    });
  }

  // 단짝 지도: 지역(path)을 누르면 그 지역 시트 (끌거나 확대한 직후의 click 은 map-zoom.js 가 막음)
  appEl.addEventListener('click', function (ev) {
    var rg = state.map && ev.target.closest && ev.target.closest('#km [data-code]');
    if (rg) mapSel(rg.getAttribute('data-code'));
  });
  appEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true' || !appEl.contains(btn)) return;
    var act = btn.getAttribute('data-act');
    if (act === 'filter') { state.filter = btn.getAttribute('data-id'); state.page = 0; render(); }
    else if (act === 'page') { state.page = state.page + Number(btn.getAttribute('data-dir')); render(); }
    else if (act === 'this-month') { state.page = 0; render(); var cur = appEl.querySelector('.cell.is-today') || appEl.querySelector('[data-act="page"]:not([disabled])'); if (cur) cur.focus({ preventScroll: true }); }
    else if (act === 'day') openSheet(Number(btn.getAttribute('data-day')));
    else if (act === 'toggle') toggle(btn.getAttribute('data-key'));
    else if (act === 'send-kung') sendKung();
    else if (act === 'close') closeSheet();
    else if (act === 'auth-mode') { state.auth.mode = btn.getAttribute('data-id'); state.auth.error = ''; state.auth.info = ''; render(true); }
    else if (act === 'sign-out') signOut();
    else if (act === 'retry') { retries = 0; state.status = 'loading'; render(true); subscribe(); }
    else if (act === 'verify-check') checkVerified();
    else if (act === 'verify-resend') resendVerification();
    else if (act === 'open-manage') { state.sheetDay = null; state.manage = { open: true, form: null }; state.sheetEntering = true; render(); }
    else if (act === 'close-manage') closeManage();
    else if (act === 'new-routine') { setForm({ key: null, name: '', icon: '', start: D.toKey(state.today), when: RT.model.whenEdit(null) }); focusName(); }
    else if (act === 'routine-view') setRoutineView(btn.getAttribute('data-v'));
    else if (act === 'pick-kind') {
      var kf = state.manage && state.manage.form;
      if (kf) { var kv = btn.getAttribute('data-v'); kf.kind = kv === RT.icons.kindOf(kf.icon) ? null : kv; render(true); }
    }
    else if (act === 'rt-order') { if (state.manage) { state.manage.reorder = true; state.manage.form = null; render(true); } }
    else if (act === 'rt-order-done') { if (state.manage) { state.manage.reorder = false; render(true); } }
    else if (act === 'rt-move') moveRoutine(btn.getAttribute('data-key'), parseInt(btn.getAttribute('data-dir'), 10));
    else if (act === 'when-mode' || act === 'when-cue' || act === 'when-remind' || act === 'when-clear-at') {
      var wf = state.manage && state.manage.form;
      if (wf) {
        wf.when = wf.when || RT.model.whenEdit(null);
        var wv = btn.getAttribute('data-v');
        if (act === 'when-mode') wf.when.mode = wv;
        else if (act === 'when-cue') wf.when.cue = wf.when.cue === wv ? '' : wv;
        else if (act === 'when-remind') wf.when.remind = !wf.when.remind;
        else { wf.when.at = ''; wf.when.remind = false; }
        wf.error = ''; render(true);
      }
    }
    else if (act === 'edit-routine') editRoutine(btn.getAttribute('data-key'));
    else if (act === 'cancel-form') { setForm(null); }
    else if (act === 'pick-icon') { if (state.manage && state.manage.form) { state.manage.form.icon = btn.getAttribute('data-icon'); state.manage.form.error = ''; render(true); } }
    else if (act === 'save-routine') saveRoutine();
    else if (act === 'stop-routine') stopRoutine();
    else if (act === 'resume-routine') resumeRoutine(btn.getAttribute('data-key'));
    else if (act === 'delete-routine') deleteRoutine();
    else if (act === 'rest-open') { var rf0 = state.manage && state.manage.form; if (rf0 && rf0.key) { rf0.rest = { from: RT.store.mergeChecks(state.server, state.pending)[rf0.key + '|' + D.toKey(state.today)] ? 'tomorrow' : 'today', until: 'open' }; rf0.error = ''; render(true); } }
    else if (act === 'rest-cancel') { var rf1 = state.manage && state.manage.form; if (rf1) { rf1.rest = null; render(true); } }
    else if (act === 'rest-from' || act === 'rest-until') {
      var rf2 = state.manage && state.manage.form && state.manage.form.rest;
      if (rf2) { rf2[act === 'rest-from' ? 'from' : 'until'] = btn.getAttribute('data-v'); rf2.error = ''; render(true); }
    }
    else if (act === 'rest-save') saveRest();
    else if (act === 'wake-routine') wakeRoutine(btn.getAttribute('data-key'));
    else if (act === 'tab') setTab(btn.getAttribute('data-tab'));
    else if (act === 'todo-toggle') toggleTodo(btn.getAttribute('data-id'));
    else if (act === 'todo-edit') editTodo(btn.getAttribute('data-id'));
    else if (act === 'todo-add') addTodo(btn.getAttribute('data-key'));
    else if (act === 'todo-more') { var km = btn.getAttribute('data-key'); state.todoUi.expanded[km] = !state.todoUi.expanded[km]; render(true); }
    else if (act === 'todo-donelist') { var kd = btn.getAttribute('data-key'); state.todoUi.showDone[kd] = !state.todoUi.showDone[kd]; render(true); }
    else if (act === 'todo-due') { if (state.todoForm) { state.todoForm.choice = btn.getAttribute('data-v'); state.todoForm.error = ''; render(true); } }
    else if (act === 'todo-cancel') closePlanSheet();
    else if (act === 'todo-delete') deleteTodo();
    else if (act === 'todo-save-list') saveTodo(false);
    else if (act === 'todo-save-place') saveTodo(true);
    else if (act === 'todo-cat') { var tf = state.todoForm; if (tf && !tf.saving) { var cv = btn.getAttribute('data-v'); tf.cat = tf.cat === cv ? null : cv; render(true); } }
    else if (act === 'todo-scope') { var tf2 = state.todoForm; if (tf2 && !tf2.saving) { tf2.scope = btn.getAttribute('data-v') === 'together' ? 'together' : state.me; render(true); } }
    else if (act === 'todo-view') setTodoView(btn.getAttribute('data-v'));
    else if (act === 'uni-who') { state.uni.who = btn.getAttribute('data-v'); render(true); }
    else if (act === 'uni-mode') { state.uni.mode = btn.getAttribute('data-v') === 'dot' ? 'dot' : 'block'; lsSet(LS_UNIMODE, state.uni.mode); render(true); }
    else if (act === 'uni-open') openUniSheet({ kind: 'detail', id: btn.getAttribute('data-id') }, '[data-act="uni-open"][data-id="' + CSS.escape(btn.getAttribute('data-id')) + '"]');
    else if (act === 'uni-unplaced') openUniSheet({ kind: 'unplaced' }, '[data-act="uni-unplaced"]');
    else if (act === 'uni-close') closeUniSheet();
    else if (act === 'uni-place') startPlace(btn.getAttribute('data-id'));
    else if (act === 'uni-done') uniDone();
    else if (act === 'uni-edit') { var ue = state.uniSheet; if (ue && ue.id) { state.uniSheet = null; editTodo(ue.id); } }
    else if (act === 'uni-delete') uniDelete();
    else if (act === 'place-cancel') closePlace();
    else if (act === 'place-ask') placeAsk();
    else if (act === 'place-ans') placeAnswer(btn.getAttribute('data-v'));
    else if (act === 'place-stopask') { if (state.place) { state.place.ask = null; focusAfter = ['[data-act="place-block"]']; focusInSheet = true; render(true); } }
    else if (act === 'place-next') placeNext();
    else if (act === 'place-back') placeBack();
    else if (act === 'rv-mode') { if (btn.getAttribute('data-v') !== state.review.mode) setReview(btn.getAttribute('data-v'), 0); }
    else if (act === 'rv-page') {
      var rvDir = Number(btn.getAttribute('data-dir'));
      focusAfter = ['[data-act="rv-page"][data-dir="' + rvDir + '"]:not([disabled])', '[data-act="rv-page"][data-dir="' + (-rvDir) + '"]:not([disabled])'];
      setReview(state.review.mode, state.review.page + rvDir);
    }
    else if (act === 'rv-now') { focusAfter = ['[data-act="rv-page"][data-dir="1"]']; setReview(state.review.mode, 0); }
    else if (act === 'rv-retry') { state.review.key = null; state.review.kungs = []; render(true); }
    else if (act === 'archive-open') openArchive();
    else if (act === 'archive-more') loadArchive();
    else if (act === 'archive-undo') undoArchived(btn.getAttribute('data-id'));
    else if (act === 'archive-close') closeArchive();
    else if (act === 'sched-mode') { setSchedMode(btn.getAttribute('data-mode')); render(true); }
    else if (act === 'sched-day' && schedState().mode === 'week') { schedState().pick = Number(btn.getAttribute('data-day')); render(true); } // 주 보기: 아래 목록만 바꾼다
    else if (act === 'sched-day' || act === 'sched-open-day') {
      var sd = Number(btn.getAttribute('data-day')); schedState().day = sd; schedState().weekStart = RT.schedule.monStart(sd); schedState().mode = 'day';
      if (act === 'sched-open-day') focusAfter = ['.sstrip__btn[data-day="' + sd + '"]']; // 「크게 보기」 버튼이 사라지므로 그날 요일 버튼으로
      render(true);
    }
    else if (act === 'sched-week') {
      var sw = schedState(), dir = 7 * Number(btn.getAttribute('data-dir'));
      if (sw.mode === 'day') { sw.day += dir; sw.weekStart = RT.schedule.monStart(sw.day); } // 일 보기: 지난주 · 다음 주의 같은 요일
      else sw.weekStart += dir;
      render(true);
    }
    else if (act === 'sched-thisweek') {
      var st0 = schedState(); st0.weekStart = RT.schedule.monStart(state.today);
      if (st0.mode === 'day') st0.day = state.today;
      focusAfter = ['[data-act="sched-week"][data-dir="-1"]']; // 버튼이 숨으므로 옆 화살표로
      render(true);
    }
    else if (act === 'event-add') addEvent();
    else if (act === 'event-open') openEvent(btn.getAttribute('data-id'), false, btn.getAttribute('data-at'), btn.getAttribute('data-day'));
    else if (act === 'event-edit') { if (state.eventForm && state.eventForm.mode === 'view') openEvent(state.eventForm.id, true, null, state.eventForm.occDay); }
    else if (act === 'ev-skip') skipEvent(btn.getAttribute('data-v'), true);
    else if (act === 'ev-unskip') skipEvent(btn.getAttribute('data-v'), false);
    else if (act === 'ev-move') openMove(btn.getAttribute('data-v'));
    else if (act === 'ev-move-cancel') { if (state.eventForm) { state.eventForm.move = null; render(true); } }
    else if (act === 'ev-move-save') saveMove();
    else if (act === 'ev-move-day') pickMoveDay(btn.getAttribute('data-v'));
    else if (act === 'ev-unmove') moveEvent(btn.getAttribute('data-v'), null);
    else if (act === 'event-cancel') closePlanSheet();
    else if (act === 'event-delete') deleteEvent();
    else if (act === 'ev-owner' || act === 'ev-repeat' || act === 'ev-wd' || act === 'ev-timemode' || act === 'ev-cat' || act === 'ev-more-add' || act === 'ev-more-del') setEventField(act, btn.getAttribute('data-v'));
    else if (act === 'cat-open') openCats();
    else if (act === 'cat-close') closeCats();
    else if (act === 'cat-new') editCat(null);
    else if (act === 'cat-edit') editCat(btn.getAttribute('data-id'));
    else if (act === 'cat-icon') { var ce = state.catSheet && state.catSheet.edit; if (ce && !ce.saving) { ce.icon = btn.getAttribute('data-icon'); ce.error = ''; render(true); } }
    else if (act === 'cat-cancel') { if (state.catSheet) { var cid = state.catSheet.edit && state.catSheet.edit.id; state.catSheet.edit = null; focusAfter = [cid ? '[data-act="cat-edit"][data-id="' + cid + '"]' : '[data-act="cat-new"]']; focusInSheet = true; render(true); } }
    else if (act === 'cat-save') saveCat();
    else if (act === 'cat-sort') { var csx = state.catSheet; if (csx && !csx.edit) { csx.sorting = !csx.sorting; focusAfter = ['[data-act="cat-sort"]']; focusInSheet = true; render(true); } }
    else if (act === 'cat-move') { var mk = String(btn.getAttribute('data-key')).split(':'); moveCat(mk[0], Number(mk[1])); }
    else if (act === 'cat-delete') deleteCat();
    else if (act === 'open-notify') openNotify();
    else if (act === 'close-notify') closeNotify();
    else if (act === 'open-theme') openTheme();
    else if (act === 'close-theme') closeTheme();
    else if (act === 'pick-theme') pickTheme(btn.getAttribute('data-v'));
    else if (act === 'pick-color') pickColor(btn.getAttribute('data-who'), btn.getAttribute('data-v'));
    else if (act === 'reset-colors') resetColors();
    else if (act === 'push-on') pushOn();
    else if (act === 'push-off') pushOff();
    else if (act === 'push-test') pushTest();
    else if (act === 'pref-partner') setPref({ partner: !(currentPrefs().partner) });
    else if (act === 'pref-hide') setPref({ hide: !(currentPrefs().hide) });
    else if (act === 'pref-weekly') setWeekly(!state.weeklyOn);
    else if (act === 'pref-todo') setTodoNotify(!state.todoNotifyOn);
    else if (act === 'pref-miss') setMissNotify(!state.missNotifyOn);
    else if (act === 'open-grow') { state.growOpen = true; state.sheetEntering = true; focusAfter = ['[data-act="close-grow"]']; focusInSheet = true; render(true); }
    else if (act === 'close-grow') closeGrow();
    else if (act === 'open-quest') { resetReview(); setTab('look'); }
    else if (act === 'open-anniv') openAnniv();
    else if (act === 'open-account') openAccount();
    else if (act === 'ava-open') openAva();
    else if (act === 'ava-view') openAvaView(btn.getAttribute('data-v'));
    else if (act === 'ava-view-close') closeAvaView();
    else if (act === 'ava-view-edit') { state.avaView = null; openAva(); }
    else if (act === 'ava-close') closeAva();
    else if (act === 'ava-delete') avaDelete();
    else if (act === 'ava-crop-cancel') avaCancel();
    else if (act === 'ava-crop-save') avaSave();
    else if (act === 'close-account') closeAccount();
    else if (act === 'all-map') openMap();
    else if (act === 'map-close') closeMap();
    else if (act === 'map-retry') { mapDataState = null; loadMapData(); render(true); }
    else if (act === 'map-seg') { if (state.map) { state.map.seg = btn.getAttribute('data-v'); state.map.sel = null; state.map.sheet = null; render(true); } }
    else if (act === 'map-zoom') mapZoom(Number(btn.getAttribute('data-v')));
    else if (act === 'map-unsel') mapUnsel();
    else if (act === 'map-visit') mapVisitForm();
    else if (act === 'map-visit-cancel') { if (state.map && state.map.sheet) { if (state.map.sheet.back || state.map.sheet.mode === 'edit') { state.map.sheet = { mode: 'view' }; focusAfter = ['[data-act="map-visit"]']; focusInSheet = true; render(true); } else mapUnsel(); } }
    else if (act === 'map-visit-save') { if (state.map && state.map.sheet && state.map.sheet.mode === 'edit') saveVisitEdit(); else saveVisit(); }
    else if (act === 'map-visit-edit') mapEditForm(btn.getAttribute('data-v'));
    else if (act === 'map-visit-delete') deleteVisit();
    else if (act === 'map-wish') { if (state.map && state.map.sel) openRank(state.map.sel, false); }
    else if (act === 'map-rank') { if (state.map && state.map.sel) openRank(state.map.sel, true); }
    else if (act === 'map-rank-close') closeRank();
    else if (act === 'map-rank-move') rankMove(Number(btn.getAttribute('data-v')));
    else if (act === 'map-rank-save') saveRank();
    else if (act === 'map-unwish') unwish();
    else if (act === 'map-star') setStar(Number(btn.getAttribute('data-v')));
    else if (act === 'map-sort') { if (state.map) { state.map.sort = btn.getAttribute('data-v'); render(true); } }
    else if (act === 'map-open') { if (Date.now() >= noClickUntil) mapSel(btn.getAttribute('data-v')); }
    else if (act === 'map-wish-add') { if (state.map && mapReady()) { state.map.find = { q: '', mode: 'wish' }; state.sheetEntering = true; focusAfter = ['#mp-q']; focusInSheet = true; render(true); } }
    else if (act === 'map-find') openFind();
    else if (act === 'map-find-close') closeFind();
    else if (act === 'map-pick') mapPick(btn.getAttribute('data-v'));
    else if (act === 'all-diet') openDiet();
    else if (act === 'diet-close') closeDiet();
    else if (act === 'dg-open') { if (state.diet) { dietGoalForm(false); focusAfter = ['[data-act="dg-close"]']; focusInSheet = true; render(true); } }
    else if (act === 'dg-close') { if (state.diet) { if (myGoal()) { state.diet.view = 'home'; state.diet.form = null; focusAfter = ['[data-act="dg-open"]']; render(true); } else closeDiet(); } }
    else if (act === 'dg-goal' || act === 'dg-sex' || act === 'dg-act') { var df = state.diet && state.diet.form; if (df) { var nv0 = btn.getAttribute('data-v'); if (act === 'dg-goal' && df.goal !== nv0 && !df.skip) { df.edits = {}; df.editing = null; } df[act === 'dg-goal' ? 'goal' : act === 'dg-sex' ? 'sex' : 'activity'] = nv0; df.error = ''; focusInSheet = true; render(true); } }
    else if (act === 'dg-edit') { var de = state.diet && state.diet.form; if (de) { var k = btn.getAttribute('data-v'); dietTakeEdit(de, k); if (de.editing && de.editing !== k) dietTakeEdit(de, de.editing); de.editing = de.editing === k ? null : k; focusAfter = de.editing ? ['#dg-e-' + k] : ['[data-act="dg-edit"][data-v="' + k + '"]']; focusInSheet = true; render(true); } }
    else if (act === 'dg-skip') { var dk = state.diet && state.diet.form; if (dk) { dk.skip = !dk.skip; dk.editing = null; dk.error = ''; focusInSheet = true; render(true); } }
    else if (act === 'dg-retune') { var dr = state.diet && state.diet.form; if (dr) { dr.retune = !dr.retune; focusInSheet = true; render(true); } }
    else if (act === 'dg-basis') { if (state.diet) { state.diet.basis = { needAck: false }; state.sheetEntering = true; focusAfter = ['[data-act="dg-basis-ok"]']; focusInSheet = true; render(true); } }
    else if (act === 'dg-basis-close') { if (state.diet) { state.diet.basis = null; focusAfter = ['[data-act="dg-basis"]']; focusInSheet = true; render(true); } }
    else if (act === 'dg-basis-ok') { if (state.diet && state.diet.basis) { var need = state.diet.basis.needAck; state.diet.basis = null; state.diet.acked = true; if (need) dietStart(true); else { focusAfter = ['[data-act="dg-start"]']; focusInSheet = true; render(true); } } }
    else if (act === 'dg-start') dietStart(false);
    else if (act === 'close-anniv') closeAnniv();
    else if (act === 'anniv-edit') annivEdit();
    else if (act === 'anniv-cancel') { if (state.anniv) { state.anniv.edit = null; focusAfter = ['[data-act="anniv-edit"]']; focusInSheet = true; render(true); } }
    else if (act === 'anniv-label') annivLabel(btn.getAttribute('data-v'));
    else if (act === 'anniv-box') annivBox(btn.getAttribute('data-v'));
    else if (act === 'anniv-save') saveAnniv();
  });

  // ── 아래 탭 · 할 일 · 시간표 ─────────────────────────────
  function setTab(t) {
    if (t === 'all' && state.tab === 'all' && state.diet) { closeDiet(); return; }
    if (t === 'all' && state.tab === 'all' && state.map) { closeMap(); return; } // 지도에서 「전체」를 누르면 「전체」로
    if (TAB_IDS.indexOf(t) < 0 || t === state.tab) return;
    if (state.map) stopMap();
    if (state.diet) stopDiet();
    state.tab = t; lsSet(LS_TAB, t);
    if (t === 'look') state.review.key = null; // 돌아보기를 열 때마다 새로 불러온다
    if (t === 'routine') state.grow.key = null; // 루틴 탭으로 돌아오면 토마토 · 퀘스트 기록도 새로
    state.sheetDay = null; state.manage = null; state.todoForm = null; state.eventForm = null; state.catSheet = null;
    state.place = null; state.uniSheet = null; state.archive = null; state.anniv = null; state.account = false; state.ava = null; state.avaView = null; dropCrop();
    render(true);
    try { root.scrollTo(0, 0); } catch (e) {}
  }
  /** 주 ↔ 일 바꿀 때 보던 주를 이어서 본다 (일 → 주: 그 날짜의 주 · 그 요일 목록, 주 → 일: 고른 요일 · 오늘 · 월요일) */
  function setSchedMode(mode) {
    var st = schedState(), S = RT.schedule;
    if (mode === st.mode) return;
    if (mode === 'week') { st.weekStart = S.monStart(st.day); st.pick = st.day; }
    else if (S.monStart(st.day) !== st.weekStart) {
      var ws = st.weekStart, inWeek = function (d) { return typeof d === 'number' && d >= ws && d <= ws + 6; };
      st.day = inWeek(st.pick) ? st.pick : (inWeek(state.today) ? state.today : ws);
    }
    st.mode = mode;
  }
  function schedState() {
    if (!state.sched) state.sched = { mode: 'week', weekStart: RT.schedule.monStart(state.today), day: state.today };
    return state.sched;
  }
  /** 두 사람 순서 = 루틴 탭과 같은 순서 (그래서 색 · 자리가 두 사람 화면에서 같다) */
  function planPeople() {
    var nm = names(), order = RT.people.list(routines()).map(function (p) { return p.person; });
    Object.keys(state.members).sort().forEach(function (u) { if (order.indexOf(u) < 0) order.push(u); });
    return order.filter(function (u) { return state.members[u] || nm[u]; }).slice(0, 2).map(function (u, i) {
      return { key: u, name: nm[u] || (state.members[u] && state.members[u].name) || '짝꿍', slot: i === 0 ? 'her' : 'me', mine: u === state.me };
    });
  }
  function nameOf(uid) { var nm = names(); return nm[uid] || (state.members[uid] && state.members[uid].name) || '짝꿍'; }
  function todoList() { return RT.todos.fromDocs(state.todoDocs); }
  function catList() { return RT.cats.fromDocs(state.catDocs); }
  function eventList() { return RT.schedule.fromDocs(state.eventDocs, catList()); }

  function todoModel() {
    var TD = RT.todos, today = state.today, people = planPeople(), list = todoList();
    if (state.todoErr) return { error: state.todoErr };
    var slotOf = {}; people.forEach(function (p) { slotOf[p.key] = p.slot; });
    function rowOf(t) {
      var tog = t.scope === 'together';
      var canCheck = tog || t.scope === state.me;
      var bits = [];
      var due = TD.dueLabel(t, today);
      if (due && !t.done) bits.push(due);
      if (tog) bits.push(t.done ? nameOf(t.doneBy) + ' 님이 했어요' : nameOf(t.createdBy) + ' 님이 추가');
      else if (t.done) bits.push('완료');
      var cat = catOf(t.cat);
      return { id: t.id, title: t.title, icon: cat ? cat.icon : '', done: t.done, slot: tog ? 'both' : (slotOf[t.scope] || 'me'), canCheck: canCheck, canEdit: canCheck,
        memo: TD.memoLine(t.memo), lockText: nameOf(t.scope) + ' 님만 체크할 수 있어요', meta: bits.join(' · '), over: !t.done && TD.bucket(t, today) === 'overdue' };
    }
    function sec(key, items) {
      var s = TD.section(items, today, { expanded: state.todoUi.expanded[key], showDone: state.todoUi.showDone[key] });
      return { key: key, open: s.open.map(rowOf), done: s.done.map(rowOf), moreCount: s.moreCount, canCollapse: s.canCollapse,
        doneCount: s.doneCount, showDone: !!state.todoUi.showDone[key], count: '남은 ' + s.openCount + (s.doneCount ? ' · 완료 ' + s.doneCount : '') };
    }
    return {
      view: state.todoView,
      together: sec('together', list.filter(function (t) { return t.scope === 'together'; })),
      people: people.map(function (p) { return Object.assign(sec(p.key, list.filter(function (t) { return t.scope === p.key; })), { name: p.name, slot: p.slot, mine: p.mine }); })
    };
  }
  function scheduleModel() {
    var S = RT.schedule, people = planPeople(), persons = people.map(function (p) { return p.key; });
    if (state.eventErr) return { error: state.eventErr };
    var nm = {}; people.forEach(function (p) { nm[p.key] = p.name; });
    var evs = eventList(), st = schedState();
    var now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    return { mode: st.mode, week: S.week(evs, persons, state.me, st.weekStart, state.today, { pick: st.pick, names: nm, now: nowMin }), day: S.day(evs, persons, nm, state.me, st.day, state.today, nowMin),
      people: people.map(function (p) { return { slot: p.slot, name: p.name, me: p.mine }; }), hasBoth: evs.some(function (e) { return e.owner === 'both'; }), nowText: S.fmt(nowMin) };
  }
  function planHtml(other) {
    var V = RT.viewPlan, out = {};
    if (state.tab === 'todo' && other) out.tab = state.todoView === 'plane' ? V.uniTab(state.todoErr ? { error: state.todoErr } : { view: 'plane', uni: uniModel() }) : V.todoTab(todoModel());
    if (state.tab === 'schedule' && other) out.tab = V.scheduleTab(scheduleModel());
    if (state.tab === 'look' && other) out.tab = RT.viewReview.tab(reviewModel());
    if (state.tab === 'all' && other) out.tab = state.map ? RT.viewMap.screen(mapModel()) : state.diet ? RT.viewDiet.home(dietHomeModel()) : RT.viewAll.tab(allModel());
    if (state.tab === 'all' && state.diet && state.diet.view === 'goal' && state.diet.form) out.sheet = RT.viewDiet.goalScreen(dietGoalModel(), state.sheetEntering && !state.diet.basis) + (state.diet.basis ? RT.viewDiet.basisSheet({ needAck: state.diet.basis.needAck, notice: RT.dietGoal.NOTICE }, state.sheetEntering) : '');
    if (state.tab === 'all' && state.map && state.map.rank && mapReady()) out.sheet = RT.viewMap.rankScreen(rankModel(), state.sheetEntering);
    else if (state.tab === 'all' && state.map && state.map.find) out.sheet = RT.viewMap.findSheet(mapFindModel(), state.sheetEntering);
    else if (state.tab === 'all' && state.map && state.map.sel && state.map.sheet && mapReady()) out.sheet = RT.viewMap.sheet(mapSheetModel(), state.sheetEntering);
    var dm = state.uniSheet && state.uniSheet.kind === 'detail' ? uniDetailModel() : null;
    if (state.place) out.sheet = V.placeScreen(placeModel());
    else if (state.todoForm) out.sheet = V.todoSheet(todoFormView(state.todoForm), state.sheetEntering);
    else if (state.eventForm) out.sheet = V.eventSheet(Object.assign({}, state.eventForm, { skipInfo: skipInfo(state.eventForm), cats: catList() }), state.sheetEntering);
    else if (state.catSheet) out.sheet = V.catSheet(catModel(), state.sheetEntering);
    else if (dm) out.sheet = V.uniDetail(dm, state.sheetEntering);
    else if (state.uniSheet && state.uniSheet.kind === 'unplaced') out.sheet = V.uniUnplaced(unplacedModel(), state.sheetEntering);
    else if (state.archive) out.sheet = V.archiveSheet(archiveModel(), state.sheetEntering);
    return out;
  }
  // ── 돌아보기 ──
  /** 기간이 바뀌면(주 · 달 · 넘기기 · 날짜가 바뀜) 그 기간에 끝낸 일과 꿍을 불러온다. 루틴 · 일정은 이미 듣고 있는 것을 쓴다 */
  function reviewModel() {
    var rv = state.review;
    var key = rv.mode + '|' + rv.page + '|' + state.today;
    if (rv.key !== key && store) { rv.key = key; rv.loading = true; rv.error = ''; setTimeout(function () { loadReview(key); }, 0); }
    var seen = {}, kungs = rv.kungs === null || state.kungOff ? null : state.kungs.concat(rv.kungs).filter(function (k) { var id = k && k.date + '_' + k.from; if (!id || seen[id]) return false; seen[id] = true; return true; });
    var now = new Date();
    var m = RT.review.build({ mode: rv.mode, page: rv.page, today: state.today, config: fullConfig(), checks: RT.store.mergeChecks(state.server, state.pending),
      persons: planPeople(), todos: RT.review.mergeTodos(state.todoDocs, rv.todos), kungs: kungs, events: eventList(), nowMin: now.getHours() * 60 + now.getMinutes() });
    m.loading = rv.loading; m.error = rv.error;
    m.anniv = annivView(true);
    m.quest = rv.mode === 'week' && state.extras && state.extras.quests ? state.extras.quests[RT.review.rangeOf('week', state.today, rv.page).from] || null : null;
    return m;
  }
  function loadReview(key) {
    var rv = state.review;
    if (!store || !key || rv.key !== key) return; // 그사이 다른 기간으로 넘겼으면 그 기간 것만 불러온다
    var r = RT.review.rangeOf(rv.mode, state.today, rv.page);
    var a = D.parts(r.from), b = D.parts(r.to + 1);
    var fromIso = new Date(a.y, a.m - 1, a.d).toISOString(), toIso = new Date(b.y, b.m - 1, b.d).toISOString();
    Promise.all([
      store.loadDoneBetween(fromIso, toIso),
      store.loadKungs(D.toKey(r.from), D.toKey(r.to + 1)).catch(function () { return null; }) // 꿍 규칙이 아직 없으면 꿍 칸만 숨긴다
    ]).then(function (res) {
      if (state.review.key !== key) return;
      rv.todos = res[0]; rv.kungs = res[1]; rv.loading = false; render();
    }, function () {
      if (state.review.key !== key) return;
      rv.loading = false; rv.error = '끝낸 일을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 불러와 주세요.'; render();
    });
  }
  // ── 함께 키우기 · 주간 퀘스트 (v40 · v41): 저장 없이 기록에서 계산 ──
  // 퀘스트 목표는 지난 4주로 정하므로, 토마토 시작 주 4주 전부터의 끝낸 일 · 꿍을 하루에 한 번 불러 둔다 (오늘 것은 듣고 있는 값과 합친다)
  function growFrom() { return Math.min(RT.schedule.monStart(RT.grow.START), RT.schedule.monStart(state.today)) - 28; }
  function ensureGrow() {
    var g = state.grow, key = D.toKey(state.today);
    if (!store || state.status !== 'ready' || g.key === key) return;
    g.key = key;
    var from = growFrom(), a = D.parts(from), b = D.parts(state.today + 1);
    var fromIso = new Date(a.y, a.m - 1, a.d).toISOString(), toIso = new Date(b.y, b.m - 1, b.d).toISOString();
    Promise.all([
      store.loadDoneBetween(fromIso, toIso),
      store.loadKungs(D.toKey(from), D.toKey(state.today + 1)).catch(function () { return null; })
    ]).then(function (res) {
      if (g.key !== key) return;
      g.todos = res[0]; g.kungs = res[1]; g.ok = true; render();
    }, function () { if (g.key === key) g.key = null; }); // 다음에 그릴 때 다시 (그동안 토마토 칸만 안 보임)
  }
  function extras() {
    ensureGrow();
    var g = state.grow;
    if (!g.ok || !RT.grow || !RT.quest) return null;
    var cfg = fullConfig(), routinesAll = RT.model.routinesFrom(cfg);
    if (!routinesAll.length) return null;
    var checks = RT.store.mergeChecks(state.server, state.pending), persons = planPeople();
    var todos = RT.review.mergeTodos(state.todoDocs, g.todos);
    var kungs = g.kungs === null ? null : (function () {
      var seen = {};
      return g.kungs.concat(state.kungs || []).filter(function (k) { var id = k.date + '_' + k.from; if (seen[id]) return false; seen[id] = true; return true; });
    })();
    var events = eventList(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    var curMon = RT.schedule.monStart(state.today), firstStart = Math.min.apply(null, routinesAll.map(function (r) { return r.start; }));
    var from = growFrom(), cache = {};
    function statsFor(mon) {
      if (mon < from || mon > curMon || mon + 6 < firstStart) return null;
      if (!cache[mon]) cache[mon] = RT.quest.statsOf(RT.review.build({ mode: 'week', page: (curMon - mon) / 7, today: state.today, config: cfg, checks: checks,
        persons: persons, todos: todos, kungs: kungs, events: events, nowMin: nowMin }));
      return cache[mon];
    }
    var quests = {}, list = [];
    for (var mon = RT.schedule.monStart(RT.grow.START); mon <= curMon; mon += 7) {
      var q = RT.quest.build({ mon: mon, weeks: [statsFor(mon), statsFor(mon - 7), statsFor(mon - 14), statsFor(mon - 21), statsFor(mon - 28)] });
      quests[mon] = q; list.push(q);
    }
    var grow = RT.grow.build({ routines: routinesAll, checks: checks, persons: persons.map(function (p) { return p.key; }), todos: todos, today: state.today,
      quests: list.map(function (q) { return { mon: q.mon, done: q.done, allDone: q.allDone }; }) });
    var quest = quests[curMon];
    celebrate(quest);
    return { grow: grow, quest: quest, quests: quests };
  }
  /** 퀘스트를 처음 채운 순간 한 번만 축하 (이 기기에 본 주를 적어 둔다) */
  function celebrate(q) {
    if (!q || !q.done) return;
    var seen = lsGet(LS_QUEST) || '', id = q.week + (q.allDone ? 'b' : 'm');
    if (seen === id || (seen === q.week + 'b')) return;
    lsSet(LS_QUEST, id);
    setTimeout(function () { showToast(q.allDone ? '🎉 보너스 퀘스트까지 성공! 토마토 +2' : '🎉 이번 주 퀘스트 성공! 토마토가 쑥 자랐어요 (+5)'); }, 0);
  }
  function resetReview() { state.review.mode = 'week'; state.review.page = 0; state.review.key = null; }
  function setReview(mode, page) {
    var rv = state.review;
    rv.mode = mode === 'month' ? 'month' : 'week';
    rv.page = Math.max(0, page | 0);
    render(true);
  }

  function openPlanSheet(kind, form) {
    state.sheetDay = null; state.manage = null; state.notifyOpen = false; state.themeOpen = false;
    state.todoForm = kind === 'todo' ? form : null; state.eventForm = kind === 'event' ? form : null; state.catSheet = null;
    state.uniSheet = null; state.archive = null; state.place = null;
    state.sheetEntering = true; render(true);
  }
  var planReturn = null; // 시트를 닫으면 포커스를 돌려줄 버튼
  function closePlanSheet(fallback) {
    state.todoForm = null; state.eventForm = null; state.catSheet = null;
    focusAfter = [planReturn, fallback].filter(Boolean); planReturn = null;
    render(true);
  }
  /** 저장이 오래 걸리면(오프라인 등) 시트는 먼저 닫는다 — 저장은 연결되면 이어서 된다 */
  function settle(job, f, isOpen, okMsg, fallback) {
    var timer = setTimeout(function () {
      if (isOpen()) { closePlanSheet(fallback); showToast('연결되면 저장돼요'); }
    }, 2500);
    job.then(function () {
      clearTimeout(timer);
      if (isOpen()) { closePlanSheet(fallback); showToast(okMsg); }
    }, function () {
      clearTimeout(timer);
      if (isOpen()) planFail(f, '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
      else showToast('저장하지 못했어요. 잠시 뒤 다시 해 주세요.');
    });
  }
  function planFail(f, msg) { f.saving = false; f.error = msg; f.errorFresh = true; render(true); }

  // 할 일
  function findTodo(id) { return todoList().filter(function (t) { return t.id === id; })[0] || null; }
  function addTodo(key) {
    if (!state.me) return;
    planReturn = '[data-act="todo-add"][data-key="' + CSS.escape(key) + '"]';
    var last = lsGet(LS_TODOCAT), cat = last && catOf(last) ? last : null; // 카테고리는 지난번 고른 것
    var fromPlane = key === 'plane';
    openPlanSheet('todo', { mode: 'add', scope: key === 'together' ? 'together' : state.me, scopePick: fromPlane, placeDefault: fromPlane, cat: cat, short: '', memo: '',
      title: '', choice: 'none', date: D.toKey(state.today), error: '' });
  }
  /** 시트에 그릴 값: 카테고리 목록 · 평면 블록 미리보기 */
  function todoFormView(f) {
    var c = catOf(f.cat), sm = slotMap();
    return Object.assign({}, f, { cats: catList(), shortHint: '비우면 「' + RT.uni.short(String(f.title || '').trim() || '할 일') + '」',
      preview: { short: previewShort(f), icon: c ? c.icon : '', slot: f.scope === 'together' ? 'both' : (sm[f.scope] || 'me') } });
  }
  /** 평면 블록 글자: 평면에 보일 이름이 있으면 그것, 없으면 할 일 이름 앞 8자 */
  function blockName(t) { return t.short || RT.uni.short(t.title); }
  function previewShort(f) {
    var s = String(f.short || '').trim();
    return s ? RT.uni.short(s) : RT.uni.short(String(f.title || '').trim() || '할 일');
  }
  function editTodo(id) {
    var t = findTodo(id);
    if (!t || !(t.scope === 'together' || t.scope === state.me)) return;
    planReturn = '[data-act="todo-edit"][data-id="' + CSS.escape(id) + '"]';
    openPlanSheet('todo', { mode: 'edit', id: id, scope: t.scope, title: t.title, short: t.short || '', memo: t.memo || '', cat: t.cat && catOf(t.cat) ? t.cat : null, choice: RT.todos.choiceOf(t.due, state.today), date: t.due || D.toKey(state.today), error: '' });
  }
  function saveTodo(placeAfter) {
    var f = state.todoForm;
    if (!store || !f || f.saving || !state.me) return;
    var err = RT.todos.validate(f);
    if (err) return planFail(f, err);
    var old = f.id ? findTodo(f.id) : null;
    if (f.id && !old) { closePlanSheet(); showToast('다른 기기에서 지워진 할 일이에요'); return; }
    var due = RT.todos.dueFrom(f.choice, state.today, f.date);
    var cat = f.cat && catOf(f.cat) ? f.cat : null;
    var short = RT.todos.shortFrom(f.short, f.title), memo = RT.todos.memoFrom(f.memo);
    var t = old ? Object.assign({}, old, { title: String(f.title).trim(), due: due, cat: cat, short: short, memo: memo, clearMemo: !!old.memo && !memo })
      : { id: RT.store.newKey(), scope: f.scope, title: String(f.title).trim(), due: due, cat: cat, short: short, memo: memo, ui: {}, done: false, doneBy: null, doneAt: null, createdBy: state.me, createdAt: new Date().toISOString() };
    if (!old) lsSet(LS_TODOCAT, cat || '');
    if (placeAfter === undefined) placeAfter = !old && !!f.placeDefault;
    if (!old && placeAfter) {
      // 바로 놓기 화면으로 (저장은 뒤에서 이어서 — 오프라인이어도 놓기는 계속할 수 있게)
      store.saveTodo(t).catch(function () { showToast('저장하지 못했어요. 잠시 뒤 다시 해 주세요.'); });
      state.todoForm = null; planReturn = null;
      startPlace(t.id, Object.assign({ fresh: true }, t));
      return;
    }
    f.saving = true; f.error = ''; render(true);
    settle(store.saveTodo(t), f, function () { return state.todoForm === f; }, old ? '할 일을 고쳤어요' : '📝 할 일을 추가했어요',
      '[data-act="todo-add"][data-key="' + CSS.escape(t.scope) + '"]');
  }
  var lastPlanDelete = 0;
  function deleteTodo() {
    var f = state.todoForm;
    if (!store || !f || f.saving || !f.id) return;
    var now = Date.now();
    if (!f.confirmDelete) { f.confirmDelete = true; lastPlanDelete = now; render(true); return; }
    if (now - lastPlanDelete < 400) return;
    f.saving = true; render(true);
    planReturn = null;
    var dt = findTodo(f.id);
    if (dt && dt.ui[state.me]) logUi(f.id, 'delete');
    settle(store.deleteTodo(f.id), f, function () { return state.todoForm === f; }, '할 일을 지웠어요', '[data-act="todo-add"][data-key="' + CSS.escape(f.scope) + '"]');
  }
  var togglingTodo = Object.create(null);
  function toggleTodo(id) {
    var t = findTodo(id);
    if (!store || !t || !state.me || togglingTodo[id] || !(t.scope === 'together' || t.scope === state.me)) return;
    var next = !t.done;
    togglingTodo[id] = true;
    setTimeout(function () { delete togglingTodo[id]; }, 800); // 두 번 눌림만 막는다 (오프라인이어도 되돌릴 수 있게)
    toggleScope[id] = t.scope;
    if (next && t.scope === 'together') showToast('✨ 함께 할 일 하나 끝!');
    if (t.ui[state.me]) logUi(id, next ? 'done' : 'undo', t.ui[state.me]);
    store.saveTodo(Object.assign({}, t, { done: next, doneBy: next ? state.me : null, doneAt: next ? new Date().toISOString() : null }))
      .catch(function () { showToast('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); });
  }

  // ── u&I 평면 ──────────────────────────────────────────
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function catOf(id) { return id ? RT.cats.find(catList(), id) : null; }
  function slotMap() { var m = {}; planPeople().forEach(function (p) { m[p.key] = p.slot; }); return m; }
  function slotOfTodo(t, sm) { return t.scope === 'together' ? 'both' : ((sm || slotMap())[t.scope] || 'me'); }
  function logUi(id, type, place) {
    if (!store || !state.me) return;
    store.logUi({ todo: id, by: state.me, type: type, u: place && place.u, i: place && place.i }).catch(function () { /* 기록은 못 남겨도 화면은 그대로 */ });
  }
  function setTodoView(v) {
    v = v === 'plane' ? 'plane' : 'list';
    if (v === state.todoView) return;
    state.todoView = v; lsSet(LS_VIEW, v); render(true);
  }
  /** 누구의 평면에 올라갈 일: 그 사람 일 + 함께 할 일 중, 그 사람이 놓은 남은 일 */
  function planeTasks(who) {
    return todoList().filter(function (t) { return !t.done && (t.scope === who || t.scope === 'together') && t.ui[who]; });
  }
  function unplacedTasks() {
    return todoList().filter(function (t) { return !t.done && (t.scope === state.me || t.scope === 'together') && !t.ui[state.me]; });
  }
  function uniWho() { var w = state.uni.who; return planPeople().some(function (p) { return p.key === w; }) ? w : state.me; }
  function planeLayout(who) {
    var byId = {};
    RT.uni.layout(planeTasks(who).map(function (t) { return { id: t.id, createdAt: t.createdAt, place: t.ui[who] }; })).forEach(function (l) { byId[l.id] = l; });
    return byId;
  }
  function uniModel() {
    var U = RT.uni, who = uniWho(), sm = slotMap(), tasks = planeTasks(who), lay = planeLayout(who);
    var counts = {}, keys = [];
    var items = tasks.map(function (t) {
      var l = lay[t.id], c = catOf(t.cat), k = c ? c.id : '-';
      if (!counts[k]) { counts[k] = { icon: c ? c.icon : '', name: c ? c.name : '카테고리 없음', n: 0, order: c ? c.order : 999 }; keys.push(k); }
      counts[k].n++;
      return { id: t.id, short: blockName(t), icon: c ? c.icon : '', slot: slotOfTodo(t, sm), y0: l.y,
        x: 5 + l.x * 90, y: 11 + (1 - l.y) * 80, shift: l.x > 0.78 ? '-86%' : l.x < 0.22 ? '-14%' : '-50%', flash: state.uni.flash === t.id,
        aria: t.title + (t.scope === 'together' ? ' (함께)' : '') + ', ' + l.n + '개 중 ' + l.urgentRank + '번째로 급함 · ' + l.importantRank + '번째로 중요함' };
    }).sort(function (a, b) { return b.y0 - a.y0; }); // 위(중요한 것)부터 그려서 아래 블록이 위 블록 꼬리를 덮지 않게
    return { mode: state.uni.mode, mine: who === state.me, whoName: nameOf(who), items: items,
      people: planPeople().map(function (p) { return { key: p.key, name: p.name, slot: p.slot, mine: p.mine, on: p.key === who }; }),
      legend: keys.map(function (k) { return counts[k]; }).sort(function (a, b) { return a.order - b.order; }), unplaced: who === state.me ? unplacedTasks().length : 0 };
  }
  var uniReturn = null;
  function openUniSheet(sheet, back) {
    state.sheetDay = null; state.manage = null; state.notifyOpen = false; state.themeOpen = false; state.todoForm = null; state.eventForm = null; state.catSheet = null; state.archive = null;
    state.uniSheet = sheet; uniReturn = back || null; state.sheetEntering = true; render(true);
  }
  function closeUniSheet() { state.uniSheet = null; focusAfter = [uniReturn, '[data-act="todo-view"][data-v="plane"]'].filter(Boolean); uniReturn = null; render(true); }
  function uniDetailModel() {
    var s = state.uniSheet, t = findTodo(s.id), who = uniWho();
    if (!t) return null;
    var l = planeLayout(who)[t.id] || null, c = catOf(t.cat), chips = [];
    if (c) chips.push({ text: c.icon + ' ' + c.name });
    chips.push(t.scope === 'together' ? { text: '함께 할 일', slot: 'both' } : { text: t.scope === state.me ? '내 일' : nameOf(t.scope) + ' 님 일', slot: slotOfTodo(t) });
    var due = RT.todos.dueLabel(t, state.today); chips.push({ text: due ? '기한 ' + due : '기한 없음' });
    var pl = t.ui[who], placed = '';
    if (pl && pl.at) {
      var d0 = D.dayOfIso(pl.at);
      if (!isNaN(d0)) { placed = D.label(d0) + ' (' + D.DOW[D.parts(d0).w] + ') ' + D.timeLabel(pl.at) + '에 놓음'; if (state.today > d0) placed += ' · ' + (state.today - d0 + 1) + '일째 그 자리'; }
      if (who !== state.me) placed = nameOf(who) + ' 님이 ' + placed;
    }
    var mine = who === state.me, can = t.scope === 'together' || t.scope === state.me;
    return { id: t.id, title: t.title, memo: t.memo || '', chips: chips, n: l ? l.n : 0, urgentRank: l ? l.urgentRank : 0, importantRank: l ? l.importantRank : 0, placed: placed,
      canDone: can && !t.done, canPlace: mine && can, canEdit: mine && can, confirmDelete: !!s.confirmDelete };
  }
  function unplacedModel() {
    var sm = slotMap();
    return { items: unplacedTasks().map(function (t) { var c = catOf(t.cat); return { id: t.id, title: t.title, icon: c ? c.icon : '', slot: slotOfTodo(t, sm) }; }) };
  }
  function uniDone() {
    var s = state.uniSheet, t = s && findTodo(s.id);
    if (!t) return;
    state.uniSheet = null; uniReturn = null; focusAfter = ['[data-act="todo-view"][data-v="plane"]'];
    toggleTodo(t.id);
    if (t.scope !== 'together') showToast('✅ 완료! 평면에서 빠졌어요');
    else render(true);
  }
  var lastUniDelete = 0;
  function uniDelete() {
    var s = state.uniSheet, t = s && findTodo(s.id), now = Date.now();
    if (!t || !store || !(t.scope === 'together' || t.scope === state.me)) return;
    if (!s.confirmDelete) { s.confirmDelete = true; lastUniDelete = now; render(true); return; }
    if (now - lastUniDelete < 400) return;
    if (t.ui[state.me]) logUi(t.id, 'delete');
    state.uniSheet = null; uniReturn = null; focusAfter = ['[data-act="todo-view"][data-v="plane"]'];
    store.deleteTodo(t.id).then(function () {}, function () { showToast('지우지 못했어요. 잠시 뒤 다시 해 주세요.'); });
    showToast('할 일을 지웠어요');
  }

  // 축 놓기: 급한 정도(u) → 중요한 정도(i). 세로선 위, 위로 갈수록 큼.
  function placeLine(axis) {
    var pl = state.place;
    return RT.uni.line(planeTasks(state.me).filter(function (t) { return t.id !== pl.id; })
      .map(function (t) { return { id: t.id, raw: t.ui[state.me][axis], createdAt: t.createdAt, title: t.title }; }));
  }
  /** 이 축에서 처음 보여 줄 자리: 놓은 적 있으면 그 순서의 틈, 없으면 가운데 */
  function startPos(axis) {
    var pl = state.place, raw = pl.raw[axis], ln = placeLine(axis);
    if (raw === null || raw === undefined) return 0.5;
    if (!ln.length) return raw;
    return RT.uni.slotPos(ln.filter(function (o) { return o.raw < raw; }).length, ln);
  }
  function startPlace(id, info) {
    var t = findTodo(id) || info;
    if (!t || !state.me || !(t.scope === 'together' || t.scope === state.me)) return;
    var cur = (t.ui && t.ui[state.me]) || null;
    state.uniSheet = null; state.todoForm = null; state.archive = null; uniReturn = null;
    state.place = { id: id, fresh: !!(info && info.fresh), title: t.title, short: t.short || null, scope: t.scope, cat: t.cat || null, axis: 'u', raw: { u: cur ? cur.u : null, i: cur ? cur.i : null }, cur: cur, touched: false, ask: null, hint: false };
    state.place.p = startPos('u');
    state.sheetEntering = true; render(true);
  }
  function josa(word) {
    var ch = String(word || '').trim().slice(-1).charCodeAt(0);
    if (ch >= 0xAC00 && ch <= 0xD7A3) return (ch - 0xAC00) % 28 ? '이' : '가';
    return '이(가)';
  }
  function noteHtml(p, ln, axis) {
    if (!ln.length) return axis === 'u' ? '가운데가 보통이에요. 급할수록 위로 올려 주세요' : '가운데가 보통이에요. 중요할수록 위로 올려 주세요';
    var d = RT.uni.describe(p, ln, axis);
    if (typeof d === 'string') return esc(d);
    return '<b>' + esc(d.below) + '</b>보다 ' + esc(d.more) + '<br><b>' + esc(d.above) + '</b>보다 ' + esc(d.less);
  }
  function placeModel() {
    var pl = state.place, U = RT.uni, ln = placeLine(pl.axis), c = catOf(pl.cat);
    var nb = U.neighbors(pl.p, ln), ask = null, pv = -1;
    if (pl.ask) { pv = U.askPivot(pl.ask); ask = { step: pl.ask.step, max: U.maxAsk(ln.length), pivot: ln[pv] ? ln[pv].title : '', word: U.WORDS[pl.axis].ask, josa: josa(pl.title) }; }
    var marks = ln.map(function (o, k) {
      return { title: o.title, pos: o.pos, near: !pl.ask && (o === nb.below || o === nb.above), pivot: k === pv, out: !!pl.ask && (k < pl.ask.lo || k >= pl.ask.hi) };
    });
    return { axis: pl.axis, title: pl.title, short: blockName(pl), icon: c ? c.icon : '', slot: slotOfTodo(pl), p: pl.p, marks: marks, hint: pl.hint && !pl.ask, ask: ask,
      canAsk: ln.length > 0, noteHtml: noteHtml(pl.p, ln, pl.axis), saving: !!pl.saving,
      sub: !ln.length ? '처음 놓는 할 일이에요' : pl.axis === 'u' ? '위로 갈수록 급해요 · 평면에서는 오른쪽으로 옮겨져요' : '위로 갈수록 중요해요' };
  }
  function closePlace() {
    var pl = state.place;
    state.place = null;
    focusAfter = [pl ? '[data-act="uni-open"][data-id="' + CSS.escape(pl.id) + '"]' : null, '[data-act="uni-unplaced"]', '[data-act="todo-view"][data-v="plane"]'].filter(Boolean);
    render(true);
  }
  function placeAsk() {
    var pl = state.place;
    if (!pl) return;
    var n = placeLine(pl.axis).length;
    if (!n) return;
    pl.ask = RT.uni.askStart(n); pl.hint = false;
    focusAfter = ['[data-act="place-ans"][data-v="yes"]']; focusInSheet = true;
    render(true);
  }
  function placeAnswer(ans) {
    var pl = state.place, U = RT.uni;
    if (!pl || !pl.ask) return;
    pl.ask = U.askAnswer(pl.ask, ans);
    if (U.askDone(pl.ask)) {
      pl.p = U.slotPos(U.askSlot(pl.ask), placeLine(pl.axis));
      pl.ask = null; pl.hint = true; pl.touched = true;
      focusAfter = ['[data-act="place-next"]'];
    } else focusAfter = ['[data-act="place-ans"][data-v="yes"]'];
    focusInSheet = true;
    render(true);
  }
  /** 지금 축의 raw: 손대지 않았으면 원래 값 그대로 (다시 정하기에서 그냥 넘겨도 바뀌지 않게) */
  function axisRaw() {
    var pl = state.place, orig = pl.raw[pl.axis];
    if (!pl.touched && orig !== null && orig !== undefined) return orig;
    return Math.round(RT.uni.rawFrom(pl.p, placeLine(pl.axis)) * 10000) / 10000;
  }
  function placeNext() {
    var pl = state.place;
    if (!pl || pl.ask) return;
    pl.raw[pl.axis] = axisRaw();
    if (pl.axis === 'u') {
      pl.axis = 'i'; pl.touched = false; pl.hint = false; pl.p = startPos('i');
      focusAfter = ['[data-act="place-block"]']; focusInSheet = true;
      render(true);
      return;
    }
    finishPlace();
  }
  function placeBack() {
    var pl = state.place;
    if (!pl) return;
    pl.raw.i = axisRaw();
    pl.axis = 'u'; pl.touched = false; pl.hint = false; pl.ask = null; pl.p = startPos('u');
    focusAfter = ['[data-act="place-block"]']; focusInSheet = true;
    render(true);
  }
  function finishPlace() {
    var pl = state.place;
    if (!store || !pl) return;
    var u = pl.raw.u, i = pl.raw.i;
    store.placeTodo(pl.id, state.me, u, i).catch(function () { showToast('평면에 놓지 못했어요. 잠시 뒤 다시 해 주세요.'); });
    logUi(pl.id, pl.cur ? 'move' : 'add', { u: u, i: i });
    var id = pl.id;
    state.place = null;
    state.todoView = 'plane'; lsSet(LS_VIEW, 'plane'); state.uni.who = state.me; state.uni.flash = id;
    focusAfter = ['[data-act="uni-open"][data-id="' + CSS.escape(id) + '"]'];
    showToast(pl.cur ? '자리를 옮겼어요' : '📍 평면에 놓았어요');
    setTimeout(function () { if (state.uni.flash === id) { state.uni.flash = null; render(); } }, 1800);
  }
  // 끌어서 놓기 · 방향키 — 끄는 동안은 다시 그리지 않고 블록 · 문장만 옮긴다
  var drag = null;
  function placeTrack() { return appEl.querySelector('.pline__track'); }
  function updatePlaceDom() {
    var pl = state.place, ln = placeLine(pl.axis), top = (Math.round((1 - pl.p) * 100000) / 1000) + '%';
    var b = appEl.querySelector('.pblock'); if (b) b.style.top = top;
    var h = appEl.querySelector('.phint'); if (h) h.remove();
    var n = document.getElementById('pnote'); if (n) n.innerHTML = noteHtml(pl.p, ln, pl.axis);
    var nb = RT.uni.neighbors(pl.p, ln);
    Array.prototype.forEach.call(appEl.querySelectorAll('.pmark[data-k]'), function (el) {
      var o = ln[Number(el.getAttribute('data-k'))];
      el.classList.toggle('is-near', !!o && (o === nb.below || o === nb.above));
    });
  }
  function dragTo(clientY) {
    var tr = placeTrack();
    if (!tr || !state.place) return;
    var r = tr.getBoundingClientRect();
    var p = 1 - (clientY - r.top) / r.height;
    state.place.p = p < 0 ? 0 : p > 1 ? 1 : p;
    state.place.hint = false;
    updatePlaceDom();
  }
  appEl.addEventListener('pointerdown', function (ev) {
    if (!state.place || state.place.ask || !ev.target.closest('[data-pline]')) return;
    ev.preventDefault();
    drag = { id: ev.pointerId };
    var line = ev.target.closest('[data-pline]');
    try { line.setPointerCapture(ev.pointerId); } catch (e) {}
    var b = appEl.querySelector('.pblock'); if (b) { b.classList.add('is-dragging'); b.focus({ preventScroll: true }); }
    dragTo(ev.clientY);
  });
  appEl.addEventListener('pointermove', function (ev) { if (drag && ev.pointerId === drag.id) { ev.preventDefault(); dragTo(ev.clientY); } });
  function endDrag(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    drag = null;
    if (!state.place) return;
    state.place.touched = true;
    render(true);
  }
  appEl.addEventListener('pointerup', endDrag);
  appEl.addEventListener('pointercancel', endDrag);
  function placeKey(ev) {
    var pl = state.place;
    if (!pl || pl.ask || !ev.target.closest || !ev.target.closest('.pblock')) return false;
    var step = ev.shiftKey ? 0.1 : 0.03, d = 0;
    if (ev.key === 'ArrowUp') d = step; else if (ev.key === 'ArrowDown') d = -step;
    else if (ev.key === 'Home') d = 1; else if (ev.key === 'End') d = -1;
    else return false;
    ev.preventDefault();
    pl.p = Math.max(0, Math.min(1, pl.p + d)); pl.touched = true; pl.hint = false;
    render(true);
    return true;
  }
  // 평면 블록이 새 자리로 미끄러지게 (FLIP) — 다시 그리기 전 자리를 재 두고, 그린 뒤 그 차이만큼 되돌렸다가 풀어 준다
  var reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function flipMeasure() {
    if (reduceMotion || state.tab !== 'todo') return null;
    var out = {};
    Array.prototype.forEach.call(appEl.querySelectorAll('[data-uni-pt]'), function (el) { var r = el.getBoundingClientRect(); out[el.getAttribute('data-uni-pt')] = { x: r.left, y: r.top }; });
    return out;
  }
  function flipPlay(before) {
    if (!before) return;
    Array.prototype.forEach.call(appEl.querySelectorAll('[data-uni-pt]'), function (el) {
      var b = before[el.getAttribute('data-uni-pt')];
      if (!b || !el.animate) return;
      var r = el.getBoundingClientRect(), dx = b.x - r.left, dy = b.y - r.top;
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  // 평면에서 꾹 눌러 바로 옮기기 (내 평면 · 내가 고칠 수 있는 일만)
  // 꾹 누르면(LIFT_MS) 블록이 들리고, 손을 떼면 그 자리의 이웃 사이로 raw 를 정한다 (축 놓기 화면과 같은 rawFrom).
  // 들기 전에 손가락이 움직이면 스크롤로 보고 그만둔다. 짧게 누르면 예전처럼 상세 시트.
  var LIFT_MS = 380, LIFT_SLOP = 8;
  var lift = null, noClickUntil = 0;
  function planeBox() { return appEl.querySelector('.uplane'); }
  function cancelLift() { if (lift && lift.timer) clearTimeout(lift.timer); lift = null; }
  /** 평면 위 화면 자리(px) → 평면 좌표 (0~1, 위 = 중요함 1) — uniModel 의 x = 5 + 90·lx, y = 11 + 80·(1 − ly) 을 거꾸로 */
  function planeXY(clientX, clientY) {
    var r = planeBox().getBoundingClientRect();
    var xp = (clientX - r.left) / r.width * 100, yp = (clientY - r.top) / r.height * 100;
    var c = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    return { lx: c((xp - 5) / 90), ly: c(1 - (yp - 11) / 80) };
  }
  function liftOn() {
    if (!lift) return;
    // 기다리는 사이 다시 그려졌으면 새 블록으로
    if (!lift.el.isConnected) lift.el = appEl.querySelector('[data-uni-pt="' + CSS.escape(lift.id) + '"]');
    if (!lift.el) { cancelLift(); return; }
    lift.on = true; lift.timer = null;
    lift.el.classList.add('is-lifted');
    var pb = planeBox(); if (pb) pb.classList.add('is-moving');
    try { lift.el.setPointerCapture(lift.pid); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
  }
  function liftMove(ev) {
    var p = planeXY(ev.clientX, ev.clientY);
    lift.el.style.left = (5 + p.lx * 90) + '%';
    lift.el.style.top = (11 + (1 - p.ly) * 80) + '%';
    var tag = lift.el.querySelector('.upt__tag');
    if (tag) tag.style.setProperty('--shift', p.lx > 0.78 ? '-86%' : p.lx < 0.22 ? '-14%' : '-50%'); // 가장자리에서 이름이 잘리지 않게 (uniModel 과 같음)
    lift.moved = Math.abs(ev.clientX - lift.x0) + Math.abs(ev.clientY - lift.y0) > 4;
    var q = RT.uni.quadrant(p.lx, p.ly), pb = planeBox();
    if (pb) pb.setAttribute('data-over', q);
  }
  /** 손을 뗀 자리 → raw (u, i): 평면에 그려진 다른 할 일 자리 사이 비율을 그 일들의 raw 사이에 쓴다 */
  function dropRaw(lx, ly) {
    var who = state.me, lay = planeLayout(who), others = planeTasks(who).filter(function (t) { return t.id !== lift.id && lay[t.id]; });
    function ln(axis, key) {
      return others.map(function (t) { return { id: t.id, raw: t.ui[who][axis], pos: lay[t.id][key] }; }).sort(function (a, b) { return a.pos - b.pos; });
    }
    var r4 = function (v) { return Math.round(v * 10000) / 10000; };
    return { u: r4(RT.uni.rawFrom(lx, ln('u', 'x'))), i: r4(RT.uni.rawFrom(ly, ln('i', 'y'))) };
  }
  function liftEnd(ev, cancelled) {
    var L = lift;
    cancelLift();
    if (!L || !L.on) return;
    noClickUntil = Date.now() + 400; // 손을 떼면 따라오는 click 으로 상세 시트가 열리지 않게
    var pb = planeBox(); if (pb) { pb.classList.remove('is-moving'); pb.removeAttribute('data-over'); }
    L.el.classList.remove('is-lifted');
    var t = findTodo(L.id);
    if (cancelled || !L.moved || !t || !t.ui[state.me] || !store) { render(true); return; }
    var p = planeXY(ev.clientX, ev.clientY);
    lift = L; var raw = dropRaw(p.lx, p.ly); lift = null;
    store.placeTodo(t.id, state.me, raw.u, raw.i).catch(function () { showToast('옮기지 못했어요. 잠시 뒤 다시 해 주세요.'); });
    logUi(t.id, 'move', raw);
    state.uni.flash = t.id;
    var id = t.id;
    showToast('자리를 옮겼어요');
    setTimeout(function () { if (state.uni.flash === id) { state.uni.flash = null; render(); } }, 1800);
  }
  appEl.addEventListener('pointerdown', function (ev) {
    if (state.place || state.tab !== 'todo' || state.todoView !== 'plane' || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    var el = ev.target.closest && ev.target.closest('[data-uni-pt]');
    if (!el || uniWho() !== state.me) return;
    var t = findTodo(el.getAttribute('data-uni-pt'));
    if (!t || !(t.scope === 'together' || t.scope === state.me) || !t.ui[state.me]) return;
    cancelLift();
    lift = { id: t.id, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, el: el, on: false, moved: false };
    lift.timer = setTimeout(liftOn, LIFT_MS);
  });
  appEl.addEventListener('pointermove', function (ev) {
    if (!lift || ev.pointerId !== lift.pid) return;
    if (!lift.on) { if (Math.abs(ev.clientX - lift.x0) + Math.abs(ev.clientY - lift.y0) > LIFT_SLOP) cancelLift(); return; }
    ev.preventDefault(); liftMove(ev);
  });
  appEl.addEventListener('pointerup', function (ev) { if (lift && ev.pointerId === lift.pid) liftEnd(ev, false); });
  appEl.addEventListener('pointercancel', function (ev) { if (lift && ev.pointerId === lift.pid) liftEnd(ev, true); });
  // 들고 있는 동안 화면이 스크롤되지 않게 (터치)
  appEl.addEventListener('touchmove', function (ev) { if (lift && lift.on) ev.preventDefault(); }, { passive: false });
  // 꾹 누를 때 뜨는 메뉴(안드로이드) 막기
  appEl.addEventListener('contextmenu', function (ev) { if (ev.target.closest && ev.target.closest('[data-uni-pt]')) ev.preventDefault(); });
  appEl.addEventListener('click', function (ev) { if (Date.now() < noClickUntil && ev.target.closest && ev.target.closest('[data-uni-pt]')) { ev.stopPropagation(); ev.preventDefault(); } }, true);

  // 루틴 카드 꾹 눌러 끌어 순서 바꾸기 (v44) — 내 루틴, 「종류」 · 「내 순서」 보기에서, 같은 묶음 안에서만
  // 꾹 누르면(LIFT_MS) 카드가 들리고, 끄는 대로 같은 묶음 안 자리를 바꿔 보여 준다. 손을 떼면 그 순서로 저장
  var rlift = null;
  function cancelRLift() { if (rlift && rlift.timer) clearTimeout(rlift.timer); rlift = null; }
  function rliftOn() {
    if (!rlift) return;
    if (!rlift.el.isConnected) { cancelRLift(); return; }
    rlift.on = true; rlift.timer = null;
    var r = rlift.el.getBoundingClientRect();
    rlift.grab = rlift.y0 - r.top;
    rlift.el.classList.add('is-lifted');
    rlift.box.classList.add('is-sorting');
    try { rlift.el.setPointerCapture(rlift.pid); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
  }
  function rliftMove(y) {
    var el = rlift.el, box = rlift.box;
    var others = Array.prototype.filter.call(box.querySelectorAll(':scope > .routine'), function (c) { return c !== el; });
    var before = null;
    for (var i = 0; i < others.length; i++) {
      var r = others[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { before = others[i]; break; }
    }
    if (before) { if (el.nextElementSibling !== before) box.insertBefore(el, before); }
    else if (box.lastElementChild !== el) box.appendChild(el);
    el.style.transform = '';
    var top = el.getBoundingClientRect().top;
    el.style.transform = 'translateY(' + Math.round(y - rlift.grab - top) + 'px)';
  }
  function rliftEnd(cancelled) {
    var L = rlift;
    cancelRLift();
    if (!L || !L.on) return;
    noClickUntil = Date.now() + 400;
    L.el.classList.remove('is-lifted'); L.el.style.transform = ''; L.box.classList.remove('is-sorting');
    var sub = Array.prototype.map.call(L.box.querySelectorAll(':scope > .routine'), function (c) { return c.getAttribute('data-rkey'); });
    if (cancelled || sub.join() === L.before.join()) { render(true); return; }
    saveOrder(RT.model.spliceSub(myOrderKeys(), sub), '순서를 바꿨어요');
  }
  appEl.addEventListener('pointerdown', function (ev) {
    if (state.tab !== 'routine' || state.routineView === 'time' || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    var el = ev.target.closest && ev.target.closest('.routine[data-rkey]');
    var box = el && el.parentElement;
    if (!el || !box || !box.matches('.rsub[data-mine]') || ev.target.closest('button, a, input')) return;
    cancelRLift();
    rlift = { pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, el: el, box: box, on: false,
      before: Array.prototype.map.call(box.querySelectorAll(':scope > .routine'), function (c) { return c.getAttribute('data-rkey'); }) };
    rlift.timer = setTimeout(rliftOn, LIFT_MS);
  });
  appEl.addEventListener('pointermove', function (ev) {
    if (!rlift || ev.pointerId !== rlift.pid) return;
    if (!rlift.on) { if (Math.abs(ev.clientX - rlift.x0) + Math.abs(ev.clientY - rlift.y0) > LIFT_SLOP) cancelRLift(); return; }
    ev.preventDefault(); rliftMove(ev.clientY);
  });
  appEl.addEventListener('pointerup', function (ev) { if (rlift && ev.pointerId === rlift.pid) rliftEnd(false); });
  appEl.addEventListener('pointercancel', function (ev) { if (rlift && ev.pointerId === rlift.pid) rliftEnd(true); });
  appEl.addEventListener('touchmove', function (ev) { if (rlift && rlift.on) ev.preventDefault(); }, { passive: false });
  appEl.addEventListener('contextmenu', function (ev) { if (rlift && ev.target.closest && ev.target.closest('.routine')) ev.preventDefault(); });

  // 「완료한 일 보관함」: 어제까지 완료한 일 — 열 때만 30개씩 불러온다
  var ARCHIVE_PAGE = 30;
  function openArchive() {
    if (!store) return;
    state.sheetDay = null; state.manage = null; state.notifyOpen = false; state.themeOpen = false; state.todoForm = null; state.eventForm = null; state.catSheet = null; state.uniSheet = null;
    state.archive = { items: [], loading: true, more: false, error: '' };
    state.sheetEntering = true; render(true);
    loadArchive();
  }
  function closeArchive() { state.archive = null; focusAfter = ['[data-act="archive-open"]']; render(true); }
  function loadArchive() {
    var a = state.archive;
    if (!a || !store) return;
    var last = a.items[a.items.length - 1];
    var before = last && last.doneAt ? last.doneAt : RT.todos.dayStartIso(state.today);
    a.loading = true; a.error = ''; if (a.items.length) render(true);
    store.loadDone(before, ARCHIVE_PAGE).then(function (docs) {
      if (state.archive !== a) return;
      var seen = {}; a.items.forEach(function (t) { seen[t.id] = true; });
      a.items = a.items.concat(RT.todos.fromDocs(docs).filter(function (t) { return t.done && !seen[t.id]; }));
      a.more = docs.length >= ARCHIVE_PAGE; a.loading = false;
      if (a.items.length > ARCHIVE_PAGE) focusAfter = ['[data-act="archive-more"]', '[data-act="archive-close"]'], focusInSheet = true;
      render(true);
    }, function () {
      if (state.archive !== a) return;
      a.loading = false; a.error = '불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'; render(true);
    });
  }
  function archiveModel() {
    var a = state.archive, sm = slotMap();
    return { loading: a.loading, more: a.more, error: a.error, groups: RT.todos.archiveGroups(a.items).map(function (g) {
      return { label: g.label, items: g.items.map(function (t) {
        var c = catOf(t.cat), tog = t.scope === 'together';
        return { id: t.id, title: t.title, icon: c ? c.icon : '', slot: slotOfTodo(t, sm), canUndo: tog || t.scope === state.me,
          meta: (tog ? '함께 · ' + nameOf(t.doneBy) + ' 님이 했어요' : t.scope === state.me ? '내 일' : nameOf(t.scope) + ' 님 일') + (t.doneAt ? ' · ' + D.timeLabel(t.doneAt) : '') };
      }) };
    }) };
  }
  function undoArchived(id) {
    var a = state.archive, t = a && a.items.filter(function (x) { return x.id === id; })[0];
    if (!t || !store || !(t.scope === 'together' || t.scope === state.me)) return;
    a.items = a.items.filter(function (x) { return x.id !== id; });
    store.saveTodo(Object.assign({}, t, { done: false, doneBy: null, doneAt: null })).catch(function () { showToast('되돌리지 못했어요. 잠시 뒤 다시 해 주세요.'); });
    if (t.ui[state.me]) logUi(id, 'undo', t.ui[state.me]);
    showToast('남은 일로 되돌렸어요');
    var nf = appEl.querySelector('.sheet [data-act="archive-undo"]') || appEl.querySelector('.sheet [data-act="archive-more"]') || appEl.querySelector('.sheet [data-act="archive-close"]');
    if (nf) nf.focus({ preventScroll: true });
  }

  // 일정
  function findEvent(id) { return eventList().filter(function (e) { return e.id === id; })[0] || null; }
  function canEditEvent(e) { return !!state.me && (e.owner === state.me || e.owner === 'both'); }
  function addEvent() {
    if (!state.me) return;
    var st = schedState(), wk = st.weekStart;
    // 새 일정의 요일: 일 보기면 그날, 주 보기면 아래 목록에 고른 요일(없으면 오늘 · 월요일)
    var day = st.mode === 'day' ? st.day : (st.pick >= wk && st.pick <= wk + 6 ? st.pick : (state.today >= wk && state.today <= wk + 6 ? state.today : wk));
    planReturn = '[data-act="event-add"]';
    openPlanSheet('event', { mode: 'add', id: null, title: '', short: '', owner: 'me', weekly: true, weekdays: [RT.schedule.weekdayOf(day)], wdPicked: false, perDay: false, times: {}, cat: null, date: D.toKey(day), from: D.toKey(RT.schedule.monStart(day)), span: 'all', until: '', start: '10:00', end: '11:00', more: [], error: '' });
  }
  function openEvent(id, forceEdit, at, dayAttr) {
    var e = findEvent(id);
    if (!e) return;
    // 누른 칸의 날짜 (매주 일정이면 「이날만 쉬기」에 쓴다)
    var occ = dayAttr === null || dayAttr === undefined || dayAttr === '' ? NaN : Number(dayAttr);
    var occDay = e.weekly && !isNaN(occ) && e.weekdays.indexOf(RT.schedule.weekdayOf(occ)) >= 0 ? occ : null;
    // 화 · 목처럼 같은 일정이 여러 칸에 있으면, 누른 그 칸으로 포커스를 돌려준다
    if (!forceEdit) planReturn = '[data-act="event-open"]' + (at ? '[data-at="' + CSS.escape(at) + '"]' : '[data-id="' + CSS.escape(id) + '"]');
    var S = RT.schedule;
    if (canEditEvent(e)) {
      openPlanSheet('event', { mode: 'edit', id: id, title: e.title, short: e.short || '', owner: e.owner === 'both' ? 'both' : 'me', lockOwner: e.owner === 'both', weekly: e.weekly,
        weekdays: e.weekly ? e.weekdays.slice() : [S.weekdayOf(D.parse(e.date))], wdPicked: e.weekly ? true : undefined, perDay: !!e.perDay, times: copyTimes(e.times), cat: e.catIcon ? e.cat : null, date: e.date || D.toKey(state.today), from: e.from || D.toKey(S.monStart(occDay !== null ? occDay : state.today)), span: S.spanKind(e), until: e.last || '', start: e.start, end: e.end, more: copySpans(e.more), error: '', occDay: occDay });
      return;
    }
    var people = planPeople(), slot = 'me';
    people.forEach(function (p) { if (p.key === e.owner) slot = p.slot; });
    openPlanSheet('event', { mode: 'view', id: id, title: e.title, slot: slot,
      whenText: S.whenText(e),
      whoText: nameOf(e.owner) + ' 님 일정', canEdit: false, lockText: nameOf(e.owner) + ' 님만 고칠 수 있어요',
      occDay: occDay, skipText: occDay !== null && S.isSkipped(e, occDay) ? D.full(occDay) + '은 쉬는 날이에요' : '',
      moveText: occDay !== null && !S.isSkipped(e, occDay) && S.movedOn(e, occDay) ? D.full(occDay) + ' 일정은 ' + movedText(e, occDay) + ' (원래 ' + S.spanText(S.baseSpans(e, occDay)) + ')' : '' });
  }
  /** '11월 3일 (화) 10:00–12:00로 옮겼어요' / '11:00–13:00로 바뀌었어요' */
  function movedText(e, n) {
    var S = RT.schedule, to = S.moveTo(e, n), sp = S.spanText(S.movedOn(e, n));
    return to ? D.label(D.parse(to)) + ' (' + S.WD[S.weekdayOf(D.parse(to))] + ') ' + sp + '로 옮겼어요' : sp + '로 바뀌었어요';
  }
  function copySpans(l) { return (l || []).map(function (t) { return { start: t.start, end: t.end }; }); }
  function copyTimes(t) { var o = {}; if (t) Object.keys(t).forEach(function (k) { o[k] = { start: t[k].start, end: t[k].end }; }); return o; }
  function setEventField(act, v) {
    var f = state.eventForm;
    if (!f || f.mode === 'view') return;
    if (act === 'ev-owner') { if (f.lockOwner) return; f.owner = v === 'both' ? 'both' : 'me'; }
    else if (act === 'ev-cat') f.cat = f.cat === v ? null : v; // 한 번 더 누르면 카테고리 없음
    else if (act === 'ev-more-add') {
      // 하루에 한 번 더: 지금 마지막 시간 1시간 뒤부터 1시간 (늦으면 밤 10시)
      var es = document.getElementById('ev-start'), ee = document.getElementById('ev-end');
      if (es && ee) { f.start = es.value; f.end = ee.value; }
      (f.more || []).forEach(function (t, i) { var a0 = document.getElementById('ev-xs-' + i), b0 = document.getElementById('ev-xe-' + i); if (a0 && b0) { t.start = a0.value; t.end = b0.value; } });
      var S0 = RT.schedule, ends = [f.end].concat((f.more || []).map(function (t) { return t.end; })).map(S0.toMin).filter(function (x) { return !isNaN(x); });
      var st0 = Math.min(Math.max.apply(null, ends.length ? ends : [600]) + 60, 22 * 60);
      f.more = (f.more || []).concat([{ start: S0.fmt(st0), end: S0.fmt(Math.min(st0 + 60, 23 * 60 + 55)) }]).slice(0, S0.MORE_MAX);
      setTimeout(function () { var el = document.getElementById('ev-xs-' + (f.more.length - 1)); if (el && el.focus) el.focus(); }, 0);
    }
    else if (act === 'ev-more-del') { f.more = (f.more || []).filter(function (_, i) { return i !== Number(v); }); }
    else if (act === 'ev-timemode') {
      var days = RT.schedule.weekdaysOf(f);
      if (v === 'per' && !f.perDay) {
        // 지금 「모두 같은 시간」에 적힌 시간으로 요일 줄을 채운다 (예전에 적어 둔 요일 시간이 되살아나지 않게)
        f.times = {};
        days.forEach(function (d) { f.times[d] = { start: f.start, end: f.end }; });
        f.perDay = true;
      } else if (v === 'same' && f.perDay) {
        if (days.length && f.times[days[0]]) { f.start = f.times[days[0]].start; f.end = f.times[days[0]].end; }
        f.perDay = false;
      }
    }
    else if (act === 'ev-repeat') {
      // 한 번 → 매주로 바꾸면 날짜의 요일이 미리 골라지고, 처음 누른 요일이 그걸 바꾼다 (새 일정과 같게)
      if (v === 'once' && f.perDay) {
        // 한 번 일정은 시간이 하나 — 첫 요일 시간을 쓰고 요일마다 모드는 끈다
        var fd = RT.schedule.weekdaysOf(f)[0];
        if (fd !== undefined && f.times[fd]) { f.start = f.times[fd].start; f.end = f.times[fd].end; }
        f.perDay = false;
      }
      var S1 = RT.schedule;
      if (v !== 'once' && !f.weekly && !isNaN(D.parse(f.date))) {
        if (f.wdPicked !== true) { f.wdPicked = false; f.weekdays = [S1.weekdayOf(D.parse(f.date))]; }
        f.from = D.toKey(S1.monStart(D.parse(f.date))); // 한 번 일정의 날짜가 있는 주부터
      }
      if (v === 'until' && isNaN(D.parse(f.until))) {
        // 끝나는 날 기본: 시작 주 + 3주 (4주 동안) 의 일요일
        var fs = D.parse(f.from);
        f.until = D.toKey((isNaN(fs) ? S1.monStart(state.today) : S1.monStart(fs)) + 27);
      }
      f.weekly = v !== 'once';
      f.span = v === 'week' ? 'week' : v === 'until' ? 'until' : 'all';
    }
    else if (act === 'ev-wd') {
      // 요일은 여러 개 고를 수 있다 (누르면 켜고 끄기).
      // 새 일정은 오늘 요일이 미리 골라져 있는데, 처음 누른 요일은 그걸 바꾼다 (화를 누르면 「오늘 + 화」가 아니라 「화」)
      var w = Number(v), list = RT.schedule.weekdaysOf(f), at = list.indexOf(w);
      if (f.wdPicked === false) list = [w];
      else if (at >= 0) { list.splice(at, 1); if (f.times) delete f.times[w]; } // 뺐다가 다시 고르면 첫 요일 시간으로
      else list.push(w);
      f.weekdays = list.sort(); f.wdPicked = true;
      if (f.perDay) {
        // 새로 고른 요일은 첫 요일 시간으로 채워 둔다. 하나만 남으면 그 시간이 일정 시간이 된다.
        var had = list.filter(function (d) { return f.times[d]; })[0];
        var base = had !== undefined ? f.times[had] : { start: f.start, end: f.end };
        list.forEach(function (d) { if (!f.times[d]) f.times[d] = { start: base.start, end: base.end }; });
        if (list.length === 1) { f.start = f.times[list[0]].start; f.end = f.times[list[0]].end; f.perDay = false; }
      }
    }
    f.error = ''; render(true);
  }
  function saveEvent() {
    var f = state.eventForm;
    if (!store || !f || f.saving || !state.me || f.mode === 'view') return;
    var err = RT.schedule.validate(f);
    if (err) return planFail(f, err);
    var old = f.id ? findEvent(f.id) : null;
    if (f.id && !old) { closePlanSheet(); showToast('다른 기기에서 지워진 일정이에요'); return; }
    var days = f.weekly ? RT.schedule.weekdaysOf(f) : null;
    // 요일마다 시간 칸을 썼으면 첫 요일 시간이 일정 시간, 요일마다 정말 다를 때만 times 를 저장
    var usedRows = !!(f.weekly && f.perDay && days.length > 1);
    var first = usedRows ? f.times[days[0]] : { start: f.start, end: f.end };
    var perDay = usedRows && !RT.schedule.sameTimes(f.times, days);
    var e = { id: f.id || RT.store.newKey(), owner: f.owner === 'both' ? 'both' : state.me, title: String(f.title).trim(), short: RT.schedule.shortOf(f.title, f.short), weekly: !!f.weekly,
      weekdays: days, from: f.weekly ? D.toKey(RT.schedule.monStart(D.parse(f.from))) : null,
      // 마지막 날(포함): 이번 주만 = 시작 주 일요일, 언제까지 = 고른 날, 매주 = 없음
      last: !f.weekly ? null : f.span === 'week' ? D.toKey(RT.schedule.monStart(D.parse(f.from)) + 6) : f.span === 'until' ? D.toKey(D.parse(f.until)) : null, more: copySpans(f.more).sort(function (a, b) { return RT.schedule.toMin(a.start) - RT.schedule.toMin(b.start); }), date: f.weekly ? null : f.date, start: first.start, end: first.end,
      times: perDay ? copyTimes(f.times) : null, cat: RT.schedule.catOf(f.cat, catList()) ? f.cat : null, createdBy: old ? old.createdBy || state.me : state.me,
      // 쉬는 날은 폼이 아니라 저장된 일정에서 (바뀐 요일에 없는 날은 빠진다)
      skip: f.weekly && old && old.weekly ? RT.schedule.withSkip({ skip: old.skip, weekdays: days }, [], true, state.today) : [],
      // 그날만 바꾼 시간도 저장된 일정에서 (바뀐 요일에 없는 날은 빠진다)
      moved: f.weekly && old && old.weekly ? RT.schedule.withMoved({ moved: old.moved, weekdays: days }, null, null, state.today) : {}, extra: old ? old.extra : null };
    f.saving = true; f.error = ''; render(true);
    settle(store.saveEvent(e), f, function () { return state.eventForm === f; }, old ? '일정을 고쳤어요' : '🗓️ 일정을 추가했어요', '[data-act="event-add"]');
  }
  /** 고치기 시트의 쉬는 날 칸 — 저장된 매주 일정 기준 (누른 칸의 날 + 지금 쉬는 날 목록) */
  function skipInfo(f) {
    var S = RT.schedule, e = f.mode === 'edit' && f.id ? findEvent(f.id) : null;
    if (!e || !e.weekly || !f.weekly) return null;
    var occ = null;
    if (f.occDay !== null && f.occDay !== undefined && e.weekdays.indexOf(S.weekdayOf(f.occDay)) >= 0) {
      var ws = S.monStart(f.occDay), key = D.toKey(f.occDay);
      var weekKeys = e.weekdays.map(function (w) { return D.toKey(ws + w); });
      var mv = S.movedOn(e, f.occDay);
      occ = { key: key, label: D.full(f.occDay), skipped: S.isSkipped(e, f.occDay),
        moved: mv ? movedText(e, f.occDay) : '', base: S.spanText(S.baseSpans(e, f.occDay)),
        weekKey: e.weekdays.length > 1 ? 'week:' + key : null, weekLabel: D.label(ws) + ' 주',
        weekSkipped: weekKeys.every(function (k) { return e.skip.indexOf(k) >= 0; }) };
    }
    var list = e.skip.map(function (k) { var n = D.parse(k); return { key: k, label: D.label(n) + ' (' + S.WD[S.weekdayOf(n)] + ')', past: n < state.today }; });
    var moves = Object.keys(e.moved || {}).map(function (k) {
      var n = D.parse(k);
      var to = e.moved[k].to, tn = to ? D.parse(to) : n;
      return { key: k, label: D.label(n) + ' (' + S.WD[S.weekdayOf(n)] + ')' + (to ? ' → ' + D.label(tn) + ' (' + S.WD[S.weekdayOf(tn)] + ')' : '') + ' ' + S.spanText(e.moved[k].spans), past: tn < state.today };
    });
    return { occ: occ, list: list, moves: moves, move: f.move || null, busy: !!f.saving };
  }
  /** 쉬는 날: key = 'YYYY-MM-DD' 하나 또는 'week:YYYY-MM-DD'(그 주 이 일정의 모든 요일). 누르면 바로 저장된다. */
  function skipEvent(v, on) {
    var f = state.eventForm, S = RT.schedule;
    if (!store || !f || !f.id || f.saving || f.mode !== 'edit') return;
    var e = findEvent(f.id);
    if (!e || !e.weekly) return;
    var keys, label;
    if (String(v).indexOf('week:') === 0) {
      var ws = S.monStart(D.parse(String(v).slice(5)));
      if (isNaN(ws)) return;
      keys = e.weekdays.map(function (w) { return D.toKey(ws + w); });
      label = D.label(ws) + '이 있는 주';
    } else {
      var n = D.parse(v);
      if (isNaN(n)) return;
      keys = [v]; label = D.label(n);
    }
    var next = S.withSkip(e, keys, on, state.today);
    var doc = Object.assign({}, e, { skip: next, times: e.perDay ? e.times : null });
    var fromOcc = f.occDay !== null && f.occDay !== undefined && keys.indexOf(D.toKey(f.occDay)) >= 0;
    var msg = on ? '🌿 ' + label + ' ' + e.title + ' 쉬어요' : label + ' ' + e.title + ' 다시 해요';
    if (on && next.length === (e.skip || []).length && keys.some(function (k) { return next.indexOf(k) < 0; })) { planFail(f, '쉬는 날은 ' + S.SKIP_MAX + '개까지예요'); return; }
    if (fromOcc) {
      // 누른 칸에서 쉬기 · 되돌리기 → 시트를 닫고 시간표로
      f.saving = true; render(true);
      settle(store.saveEvent(doc), f, function () { return state.eventForm === f; }, msg, '[data-act="event-add"]');
    } else {
      // 「쉬는 날」 목록에서 되돌리기 → 시트는 그대로 (폼에 적던 것도 그대로)
      store.saveEvent(doc).then(function () { showToast(msg); }, function () { showToast('저장하지 못했어요. 잠시 뒤 다시 해 주세요.'); });
    }
  }
  /** 「이날만 시간 바꾸기」: 누른 칸의 날 시간 칸을 연다 (지금 그날 시간으로 채워서) */
  function openMove(key) {
    var f = state.eventForm, S = RT.schedule;
    if (!f || f.mode !== 'edit' || f.saving) return;
    var e = findEvent(f.id), n = D.parse(key);
    if (!e || !e.weekly || isNaN(n)) return;
    var ws = S.monStart(n);
    f.move = { key: key, to: S.moveTo(e, n) || key, spans: copySpans(S.spansOn(e, n)), error: '',
      // 옮길 날: 그 주 월~일 (원래 날이 기본)
      days: [0, 1, 2, 3, 4, 5, 6].map(function (i) { return { key: D.toKey(ws + i), wd: S.WD[i], date: D.parts(ws + i).d, orig: ws + i === n }; }) };
    render(true);
    setTimeout(function () { var el = document.getElementById('ev-ms-0'); if (el && el.focus) el.focus(); }, 0);
  }
  function readMoveSpans(f) {
    f.move.spans.forEach(function (t, i) {
      var ms = document.getElementById('ev-ms-' + i), me = document.getElementById('ev-me-' + i);
      if (ms) t.start = ms.value;
      if (me) t.end = me.value;
    });
  }
  function pickMoveDay(key) {
    var f = state.eventForm;
    if (!f || !f.move || f.saving) return;
    readMoveSpans(f); // 적던 시간은 그대로
    f.move.to = key; f.move.error = ''; render(true);
  }
  function saveMove() {
    var f = state.eventForm, S = RT.schedule;
    if (!f || !f.move || f.saving) return;
    readMoveSpans(f);
    var list = f.move.spans;
    for (var i = 0; i < list.length; i++) {
      var s = S.toMin(list[i].start), t = S.toMin(list[i].end), nm = list.length > 1 ? (i + 1) + '번째 ' : '';
      if (isNaN(s) || isNaN(t)) { f.move.error = nm + '시작 · 끝 시간을 골라 주세요'; render(true); return; }
      if (t <= s) { f.move.error = nm + '끝 시간이 시작보다 늦어야 해요'; render(true); return; }
    }
    if (S.overlaps(list)) { f.move.error = '이날 시간들이 서로 겹쳐요'; render(true); return; }
    moveEvent(f.move.key, copySpans(list).sort(function (a, b) { return S.toMin(a.start) - S.toMin(b.start); }), f.move.to);
  }
  /** 그날만 날 · 시간 바꾸기(span, to) · 원래대로(span = null). 누르면 바로 저장된다. */
  function moveEvent(key, span, to) {
    var f = state.eventForm, S = RT.schedule;
    if (!store || !f || !f.id || f.saving || f.mode !== 'edit') return;
    var e = findEvent(f.id), n = D.parse(key);
    if (!e || !e.weekly || isNaN(n)) return;
    var base = S.baseSpans(e, n);
    if (!to || to === key) to = null;
    if (span && !to && S.sameSpans(span, base)) span = null; // 원래 날 · 시간과 같으면 되돌리기
    var next = S.withMoved(e, key, span, state.today, to);
    if (span && !next[key]) { f.move.error = '바꾼 날은 ' + S.SKIP_MAX + '개까지예요'; render(true); return; }
    var doc = Object.assign({}, e, { moved: next, times: e.perDay ? e.times : null });
    var label = D.label(n) + ' (' + S.WD[S.weekdayOf(n)] + ')';
    var tl = to ? D.label(D.parse(to)) + ' (' + S.WD[S.weekdayOf(D.parse(to))] + ') ' : '';
    var msg = span ? (to ? '📅 ' + label + ' ' + e.title + ' → ' + tl + S.spanText(span) + '로 옮겼어요' : '🕐 ' + label + ' ' + e.title + ' ' + S.spanText(span) + '로 바꿨어요')
      : label + ' ' + e.title + ' 원래대로(' + S.spanText(base) + ')';
    var fromOcc = f.occDay !== null && f.occDay !== undefined && D.toKey(f.occDay) === key;
    if (fromOcc || span) {
      f.saving = true; render(true);
      settle(store.saveEvent(doc), f, function () { return state.eventForm === f; }, msg, '[data-act="event-add"]');
    } else {
      // 「시간 바꾼 날」 목록에서 되돌리기 → 시트는 그대로
      store.saveEvent(doc).then(function () { showToast(msg); }, function () { showToast('저장하지 못했어요. 잠시 뒤 다시 해 주세요.'); });
    }
  }
  function deleteEvent() {
    var f = state.eventForm;
    if (!store || !f || f.saving || !f.id || f.mode !== 'edit') return;
    var now = Date.now();
    if (!f.confirmDelete) { f.confirmDelete = true; lastPlanDelete = now; render(true); return; }
    if (now - lastPlanDelete < 400) return;
    f.saving = true; render(true);
    planReturn = null;
    settle(store.deleteEvent(f.id), f, function () { return state.eventForm === f; }, '일정을 지웠어요', '[data-act="event-add"]');
  }

  // ── 「카테고리」 시트 ── 둘이 같이 쓰는 목록 (js/cats.js). 일정 폼에서 열고, 닫으면 그 폼으로 돌아간다.
  function catModel() {
    var C = RT.cats, cs = state.catSheet, list = catList(), docs = state.eventDocs;
    var e = cs.edit;
    if (e && e.id && !C.find(list, e.id) && !e.saving) { cs.edit = e = null; setTimeout(function () { showToast('다른 기기에서 지워진 카테고리예요'); }, 0); }
    return {
      list: list.map(function (c) { return { id: c.id, name: c.name, icon: c.icon, uses: C.usage(docs, c.id) }; }),
      edit: e ? Object.assign({}, e, { max: C.NAME_MAX, uses: e.id ? C.usage(docs, e.id) : 0 }) : null,
      icons: C.ICONS, full: list.length >= C.MAX, max: C.MAX, hasBack: !!cs.back, backLabel: cs.backKind === 'todo' ? '할 일로 돌아가기' : '일정으로 돌아가기',
      sorting: !!cs.sorting && !e,
      error: state.catErr ? '카테고리를 불러오지 못했어요. 저장 규칙을 배포해야 할 수 있어요' : ''
    };
  }
  function openCats() {
    var tf = state.todoForm;
    if (tf) {
      // 할 일 폼에서: 입력칸 값은 input 때마다 상태에 담겨 있다
      if (tf.saving || !state.me) return;
      var gv = function (id) { var el = document.getElementById(id); return el ? el.value : null; };
      ['title:td-title', 'date:td-date', 'short:td-short', 'memo:td-memo'].forEach(function (kv) { var p = kv.split(':'), v = gv(p[1]); if (v !== null) tf[p[0]] = v; });
      state.todoForm = null;
      state.catSheet = { back: tf, backKind: 'todo', edit: null };
      state.sheetEntering = false; render(true);
      return;
    }
    var f = state.eventForm;
    if (!f || f.mode === 'view' || f.saving || !state.me) return;
    // 아직 상태에 안 담긴 요일별 시간 칸을 읽어 둔다 (돌아왔을 때 그대로)
    for (var w = 0; w < 7; w++) {
      var s = document.getElementById('ev-ts-' + w), t = document.getElementById('ev-te-' + w);
      if (s && t) f.times[w] = { start: s.value, end: t.value };
    }
    state.eventForm = null;
    state.catSheet = { back: f, backKind: 'event', edit: null };
    state.sheetEntering = false; render(true);
  }
  function closeCats() {
    var cs = state.catSheet;
    if (!cs) return;
    state.catSheet = null;
    if (cs.back && cs.backKind === 'todo') { state.todoForm = cs.back; focusAfter = ['.sheet [data-act="cat-open"]']; focusInSheet = true; }
    else if (cs.back) { state.eventForm = cs.back; focusAfter = ['.sheet [data-act="cat-open"]']; focusInSheet = true; }
    render(true);
  }
  function editCat(id) {
    var cs = state.catSheet;
    if (!cs || (cs.edit && cs.edit.saving)) return;
    var c = id ? RT.cats.find(catList(), id) : null;
    if (id && !c) return;
    cs.edit = c ? { id: c.id, name: c.name, icon: c.icon, isDefault: RT.cats.isDefault(c.id), error: '' } : { id: null, name: '', icon: '', error: '' };
    render(true);
    var inp = document.getElementById('cat-name');
    if (inp && !c) inp.focus({ preventScroll: true });
  }
  /** 저장 · 지우기는 화면에 먼저 반영되고(오프라인이어도), 서버 확인이 오래 걸리면 폼만 먼저 닫는다 */
  function catJob(job, f, okMsg, after, focusSel) {
    var done = false;
    function finish(msg) {
      if (done) return; done = true;
      if (state.catSheet && state.catSheet.edit === f) state.catSheet.edit = null;
      if (after) after();
      if (focusSel) { focusAfter = focusSel; focusInSheet = true; }
      showToast(msg); render(true);
    }
    var timer = setTimeout(function () { finish('연결되면 저장돼요'); }, 2500);
    job.then(function () { clearTimeout(timer); finish(okMsg); }, function () {
      clearTimeout(timer);
      if (done) { showToast('카테고리를 저장하지 못했어요. 잠시 뒤 다시 해 주세요.'); return; }
      done = true;
      if (state.catSheet && state.catSheet.edit === f) planFail(f, '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
      else showToast('카테고리를 저장하지 못했어요. 잠시 뒤 다시 해 주세요.');
    });
  }
  function saveCat() {
    var cs = state.catSheet, f = cs && cs.edit, C = RT.cats;
    if (!store || !f || f.saving || !state.me) return;
    var input = document.getElementById('cat-name');
    if (input) f.name = input.value;
    var list = catList(), err = C.validate(f, list);
    if (err) return planFail(f, err);
    var old = f.id ? C.find(list, f.id) : null;
    if (f.id && !old) { cs.edit = null; render(true); showToast('다른 기기에서 지워진 카테고리예요'); return; }
    var c = { id: f.id || C.newId(), name: String(f.name).trim(), icon: f.icon, order: old ? old.order : C.nextOrder(list) };
    f.saving = true; f.error = ''; render(true);
    catJob(store.saveCat(c, state.me), f, old ? '카테고리를 고쳤어요' : c.icon + ' ' + c.name + ' 카테고리를 만들었어요', function () {
      // 일정 폼에서 새로 만들었으면 그 일정에 바로 골라 둔다
      if (!old && state.catSheet && state.catSheet.back) state.catSheet.back.cat = c.id;
    }, ['[data-act="cat-edit"][data-id="' + c.id + '"]', '[data-act="cat-new"]']);
  }
  /** 순서 바꾸기: 바뀌는 카테고리만 저장 (화면에는 바로 — 오프라인이어도) */
  function moveCat(id, dir) {
    var cs = state.catSheet;
    if (!store || !cs || !cs.sorting || cs.edit || !state.me) return;
    var changes = RT.cats.move(catList(), id, dir);
    if (!changes.length) return;
    Promise.all(changes.map(function (c) { return store.saveCat(c, state.me); }))
      .catch(function () { showToast('순서를 저장하지 못했어요. 잠시 뒤 다시 해 주세요.'); });
    focusInSheet = true;
    // 끝에 닿아 버튼이 막히면 반대쪽 버튼으로
    focusAfter = ['[data-act="cat-move"][data-key="' + id + ':' + dir + '"]:not([disabled])', '[data-act="cat-move"][data-key="' + id + ':' + (-dir) + '"]'];
    render(true);
  }
  var lastCatDelete = 0;
  function deleteCat() {
    var cs = state.catSheet, f = cs && cs.edit;
    if (!store || !f || !f.id || f.saving || !state.me) return;
    var now = Date.now();
    if (!f.confirmDelete) { f.confirmDelete = true; lastCatDelete = now; render(true); return; }
    if (now - lastCatDelete < 400) return;
    var c = RT.cats.find(catList(), f.id);
    if (!c) { cs.edit = null; render(true); return; }
    f.saving = true; render(true);
    catJob(store.deleteCat(c.id, RT.cats.isDefault(c.id), state.me), f, c.name + ' 카테고리를 지웠어요', function () {
      if (state.catSheet && state.catSheet.back && state.catSheet.back.cat === c.id) state.catSheet.back.cat = null;
    }, ['[data-act="cat-new"]', '.sheet .close-btn[data-act="cat-close"]']);
  }

  // ── 「알림」 시트 ───────────────────────────────────────
  var REMIND_TIMES = [];
  for (var hh = 17; hh <= 23; hh++) { REMIND_TIMES.push((hh < 10 ? '0' : '') + hh + ':00', (hh < 10 ? '0' : '') + hh + ':30'); }
  var DEFAULT_PREFS = { partner: true, remindAt: null, hide: false };
  function currentPrefs() { return Object.assign({}, DEFAULT_PREFS, state.prefs || {}, { weekly: state.weeklyOn, todo: state.todoNotifyOn, miss: state.missNotifyOn }); }
  function notifyModel() {
    var P = RT.push;
    return {
      support: P ? P.support() : 'unsupported', on: !!(P && P.isOn()),
      busy: state.push.busy, error: state.push.error || (state.prefsError ? '알림 설정을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요' : ''),
      errorFresh: state.push.errorFresh, info: state.push.info,
      prefs: currentPrefs(), prefsReady: state.prefsReady, times: REMIND_TIMES
    };
  }
  // ── 우리 기념일 (v46): couple/main 하나를 둘이 같이 쓴다 (js/anniv.js) ──
  /** 화면 값: anniv.build 결과 | { unset: true }(아직 안 정함 — withUnset 일 때만) | null(규칙 없음 · 계산 못 함) */
  function annivView(withUnset) {
    if (!RT.anniv || state.coupleOff || !store) return null;
    var a = RT.anniv.fromDoc(state.couple);
    if (!a) return withUnset ? { unset: true } : null;
    return RT.anniv.build(a, state.today);
  }
  // ── 단짝 지도 (v48) ──
  var mapDataState = null, mapData = null, unPlaces = null; // mapDataState: null | 'loading' | 'error' | 'ready'
  var kmEl = null, kmSel = null, kmPaths = null, kmZoom = null; // 한 번만 만들어 두고 다시 붙이는 지도 <svg>
  function mapReady() { return mapDataState === 'ready' && !!mapData; }
  function placeList() { return RT.places.fromDocs(state.placeDocs || {}); }
  /** places 문서 하나 저장 + 저장된 값을 화면에 바로 반영 (실시간 반영을 기다리지 않음 — 고치거나 지운 뒤 지도 · 목록이 바로 바뀌게) */
  /** 화면에 있는 값이 방금 저장한 값보다 새것이면(짝꿍이 바로 뒤에 고침) 덮지 않는다 */
  function newerThan(cur, next) { return !!(cur && next && cur.updatedAt && next.updatedAt && cur.updatedAt > next.updatedAt); }
  function savePlace(code, uid, change) {
    return store.updatePlace(code, uid, change).then(function (next) {
      if (next && state.placeDocs && !newerThan(state.placeDocs[code], next)) { state.placeDocs = Object.assign({}, state.placeDocs); state.placeDocs[code] = next; }
      return next;
    });
  }
  function loadMapData() {
    if (mapDataState === 'loading' || mapDataState === 'ready') return;
    mapDataState = 'loading';
    // 지도를 처음 열 때만 받는다 (약 140KB). 받은 뒤엔 서비스 워커가 저장해 둬서 오프라인에서도 열림
    fetch('data/kr-map.json').then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (d) { mapData = d; mapDataState = 'ready'; render(true); })
      .catch(function () { mapDataState = 'error'; render(true); });
  }
  function loadPlacesOnce() {
    if (!store || state.placeDocs !== null || state.placesLoading) return;
    state.placesLoading = true;
    store.loadPlaces().then(function (d) { state.placesLoading = false; if (state.placeDocs === null) state.placeDocs = d; state.placesOff = false; render(); },
      function () { state.placesLoading = false; state.placesOff = true; render(); });
  }
  function allMapModel() {
    if (state.placeDocs === null && !state.placesOff && !state.placesLoading) setTimeout(loadPlacesOnce, 0);
    if (state.placeDocs === null) return { ready: false, count: 0, tiles: [] };
    var pl = placeList();
    return { ready: true, count: RT.places.counts(pl).visited, tiles: RT.viewAll.tilesFor(RT.places.visitedSidos(pl)) };
  }
  function openMap() {
    if (!RT.viewMap || !store) return;
    state.account = false; state.anniv = null; state.notifyOpen = false; state.themeOpen = false;
    state.map = { seg: 'map', sel: null, vb: Object.assign({}, RT.viewMap.HOME), sheet: null, find: null };
    loadMapData();
    if (unPlaces) unPlaces();
    unPlaces = store.watchPlaces(function (d) { state.placeDocs = d; state.placesOff = false; render(); },
      function () { state.placesOff = true; render(); });
    focusAfter = ['[data-act="map-close"]'];
    render(true);
    try { root.scrollTo(0, 0); } catch (e) {}
  }
  /** 지도 화면을 닫는다 (구독도 끊는다) */
  function stopMap() { if (unPlaces) { unPlaces(); unPlaces = null; } state.map = null; }
  function closeMap() { stopMap(); focusAfter = ['[data-act="all-map"]']; render(true); }
  function mapModel() {
    var m = state.map, pl = placeList(), paint = {};
    Object.keys(pl).forEach(function (c) { var p = RT.places.paint(pl[c]); if (p) paint[c] = p; });
    var ready = mapDataState === 'ready';
    return { status: ready ? 'ready' : mapDataState === 'error' ? 'error' : 'loading', off: state.placesOff, seg: m.seg, sel: m.sel, vb: m.vb, map: mapData, paint: paint, counts: RT.places.counts(pl),
      wish: ready && m.seg === 'wish' ? { rows: wishRows(pl) } : null, been: ready && m.seg === 'been' ? { sort: m.sort || 'stars', rows: beenRows(pl, m.sort || 'stars') } : null };
  }
  /** render 끝에서: 지도 자리(#km-slot)에 만들어 둔 <svg> 를 붙이고 칠하기 · 고른 곳 · 보는 자리만 바꾼다.
      (230곳 140KB 를 다시 그릴 때마다 새로 만들지 않고, 확대 · 끌기 손잡이도 한 번만 붙인다 — 점검 AI) */
  function mountMap() {
    var slot = document.getElementById('km-slot');
    if (!slot || !mapReady()) return;
    if (!kmEl) {
      var tmp = document.createElement('div');
      tmp.innerHTML = RT.viewMap.mapSvg(mapData, {}, null, RT.viewMap.HOME, '단짝 지도');
      kmEl = tmp.firstChild;
      kmPaths = Array.prototype.slice.call(kmEl.querySelectorAll('.rg'));
      kmSel = document.createElementNS('http://www.w3.org/2000/svg', 'path'); kmSel.setAttribute('class', 'sel');
      kmZoom = { home: RT.viewMap.HOME, get: function () { return state.map ? state.map.vb : RT.viewMap.HOME; }, set: function (vb) { if (state.map) state.map.vb = vb; } };
      RT.mapZoom.attach(kmEl, kmZoom);
    }
    var mm = mapModel(), c = mm.counts;
    kmPaths.forEach(function (p) { var k = mm.paint[p.getAttribute('data-code')] || ''; p.setAttribute('class', 'rg' + (k ? ' ' + k : '')); });
    var r = mm.sel && RT.places.regionOf(mapData, mm.sel);
    if (r) { kmSel.setAttribute('d', r.d); if (kmSel.parentNode !== kmEl) kmEl.appendChild(kmSel); }
    else if (kmSel.parentNode) kmSel.parentNode.removeChild(kmSel);
    kmEl.setAttribute('aria-label', '단짝 지도: 함께 다녀온 곳 ' + c.visited + '곳은 색칠, 가고 싶은 곳 ' + c.wished + '곳은 빗금');
    RT.mapZoom.setBox(kmEl, state.map.vb);
    slot.appendChild(kmEl);
  }
  function mapZoom(dir) {
    if (!state.map) return;
    state.map.vb = RT.mapZoom.zoomAt(state.map.vb, dir > 0 ? 1.6 : 1 / 1.6, 0.5, 0.5, RT.viewMap.HOME);
    var el = document.getElementById('km'); if (el) RT.mapZoom.setBox(el, state.map.vb);
  }
  function mapSel(code) {
    if (!state.map || !mapReady() || !RT.places.regionOf(mapData, code)) return;
    state.map.sel = code; state.map.sheet = { mode: 'view' }; state.sheetEntering = true;
    focusAfter = ['[data-act="map-visit"]']; focusInSheet = true;
    render(true);
  }
  function mapUnsel() {
    if (!state.map) return;
    var code = state.map.sel;
    state.map.sel = null; state.map.sheet = null; state.map.star = null;
    focusAfter = ['.mrow__main[data-v="' + code + '"]', '[data-act="map-zoom"][data-v="1"]', '[data-act="map-close"]']; // 목록에서 열었으면 그 줄로
    render(true);
  }
  function todayKey() { return D.toKey(state.today); }
  function coupleStartKey() { var a = RT.anniv && RT.anniv.fromDoc(state.couple); return a ? a.startKey : null; }
  function mapVisitForm() {
    if (!state.map || !state.map.sel) return;
    var back = !!(state.map.sheet && state.map.sheet.mode === 'view');
    // 단짝이 된 날을 아직 안 정했으면 먼저 정하게 한다 (나중에 정하면 그 전 기록이 규칙에 걸리지 않게 — 점검 AI)
    if (!coupleStartKey() && !state.coupleOff && RT.anniv) { state.map.sheet = { mode: 'needstart', back: back }; focusAfter = ['[data-act="open-anniv"]']; focusInSheet = true; render(true); return; }
    state.map.sheet = { mode: 'visit', back: back, form: { date: todayKey(), note: '', saving: false, error: '', errorFresh: false } };
    focusAfter = ['#mp-date']; focusInSheet = true;
    render(true);
  }
  function mapSheetModel() {
    var m = state.map, P = RT.places, code = m.sel, p = placeList()[code] || null, start = coupleStartKey(), tk = todayKey();
    var vv = p ? p.visits.slice().reverse().map(function (v, i, arr) {
      var n = arr.length - i;
      return { id: v.id, nth: n === 1 ? '처음' : n + '번째', date: P.dateText(v.date, tk), note: v.note };
    }) : [];
    return { code: code, name: P.fullName(mapData, code), place: p, mode: m.sheet.mode, form: m.sheet.form, noteMax: P.NOTE_MAX,
      startKey: start, startText: start ? RT.anniv.fullDate(D.parse(start)) : '', todayKey: tk,
      visitsView: vv, lastText: p && p.visits.length ? P.dateText(p.visits[p.visits.length - 1].date, tk) : '',
      wishNo: p && p.wishRank !== null ? P.wishList(placeList()).map(function (x) { return x.code; }).indexOf(code) + 1 : null,
      stars: p ? (function () { var pi = partnerInfo(), uid = state.uid || state.me, avg = P.avgStars(p);
        return { me: shownStar(code, uid), partner: pi.partner ? p.stars[pi.partner] || 0 : 0, meSlot: pi.meSlot, partnerSlot: pi.partnerSlot, partnerName: pi.partnerName, avgText: P.avgText(avg), rankNo: P.starRank(placeList(), code) }; })() : null };
  }
  function saveVisit() {
    var m = state.map, f = m && m.sheet && m.sheet.form;
    if (!f || f.saving || !store) return;
    var di = document.getElementById('mp-date'), ni = document.getElementById('mp-note');
    if (di) f.date = di.value;
    if (ni) f.note = ni.value;
    var err = RT.places.validateVisit(f.date, coupleStartKey(), todayKey());
    if (err) { f.error = err; f.errorFresh = true; render(true); return; }
    var code = m.sel, uid = state.uid || state.me, now = new Date().toISOString();
    var visit = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: f.date, note: RT.places.cleanNote(f.note), createdAt: now, createdBy: uid };
    f.saving = true; render(true);
    savePlace(code, uid, function (cur) {
      var next = Object.assign({}, cur || {});
      next.visits = RT.places.withVisit(cur && cur.visits, visit);
      next.wishRank = null; next.wishNote = ''; // 함께 다녀왔으면 가고 싶은 곳에서 빠진다 (메모도 같이)
      if (!next.stars) next.stars = {};
      return next;
    }).then(function () {
      if (state.map && state.map.sel === code) { state.map.sheet = { mode: 'view' }; focusAfter = ['[data-act="map-visit"]']; focusInSheet = true; } // 포커스가 시트에 남아야 Esc 가 먹는다
      showToast('함께 다녀온 곳에 칠했어요');
      render(true);
    }, function (e) {
      if (!state.map || !state.map.sheet || !state.map.sheet.form) return;
      var denied = e && (e.code === 'permission-denied' || /permission/.test(String(e.message || e)));
      var ff = state.map.sheet.form; ff.saving = false; ff.errorFresh = true;
      ff.error = denied ? '저장이 막혔어요. 다녀온 날이 단짝이 된 날보다 이르지 않은지 확인해 주세요' : '저장하지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요';
      render(true);
    });
  }
  // ── 방문 고치기 · 지우기 (v49) ──
  function mapEditForm(id) {
    var m = state.map, p = m && m.sel && placeList()[m.sel];
    var i = p ? p.visits.map(function (v) { return v.id; }).indexOf(id) : -1;
    if (i < 0) return;
    var v = p.visits[i];
    m.sheet = { mode: 'edit', form: { id: id, nth: i === 0 ? '처음' : (i + 1) + '번째', date: v.date, note: v.note, saving: false, error: '', errorFresh: false, confirmDelete: false } };
    focusAfter = ['#mp-date']; focusInSheet = true;
    render(true);
  }
  /** 고친 · 지운 기록 저장. change(visits) → 새 visits */
  function writeVisits(change, okText, onFail) {
    var m = state.map, f = m && m.sheet && m.sheet.form, code = m && m.sel, uid = state.uid || state.me;
    if (!f || f.saving || !store) return;
    f.saving = true; render(true);
    savePlace(code, uid, function (cur) {
      var next = Object.assign({}, cur || {});
      next.visits = change((cur && cur.visits) || []);
      if (!next.stars) next.stars = {};
      return next;
    }).then(function () {
      if (state.map && state.map.sel === code) { state.map.sheet = { mode: 'view' }; focusAfter = ['[data-act="map-visit"]']; focusInSheet = true; }
      showToast(okText);
      render(true);
    }, function (e) {
      if (!state.map || !state.map.sheet || !state.map.sheet.form) return;
      var ff = state.map.sheet.form, denied = e && (e.code === 'permission-denied' || /permission/.test(String(e.message || e)));
      ff.saving = false; ff.confirmDelete = false; ff.errorFresh = true;
      ff.error = denied ? onFail : '저장하지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요';
      render(true);
    });
  }
  function saveVisitEdit() {
    var f = state.map && state.map.sheet && state.map.sheet.form;
    if (!f || f.saving) return;
    var di = document.getElementById('mp-date'), ni = document.getElementById('mp-note');
    if (di) f.date = di.value;
    if (ni) f.note = ni.value;
    var err = RT.places.validateVisit(f.date, coupleStartKey(), todayKey());
    if (err) { f.error = err; f.errorFresh = true; render(true); return; }
    var id = f.id, date = f.date, note = RT.places.cleanNote(f.note);
    writeVisits(function (vs) { return RT.places.withEdited(vs, id, date, note); }, '기록을 고쳤어요', '저장이 막혔어요. 다녀온 날이 단짝이 된 날보다 이르지 않은지 확인해 주세요');
  }
  function deleteVisit() {
    var f = state.map && state.map.sheet && state.map.sheet.form;
    if (!f || f.saving) return;
    if (!f.confirmDelete) { f.confirmDelete = true; focusAfter = ['[data-act="map-visit-delete"]']; focusInSheet = true; render(true); return; }
    var id = f.id;
    writeVisits(function (vs) { return RT.places.withoutVisit(vs, id); }, '기록을 지웠어요', '지우지 못했어요. 잠시 뒤 다시 해 주세요');
  }

  // ── 단짝 지도 M3 (v50): 가고 싶은 곳 순위 · 다녀온 곳 · 별점 ──
  function partnerInfo() {
    var ps = planPeople(), me = ps.filter(function (p) { return p.mine; })[0], pt = ps.filter(function (p) { return !p.mine; })[0];
    return { meSlot: me ? me.slot : 'me', partner: pt ? pt.key : null, partnerSlot: pt ? pt.slot : 'her', partnerName: pt ? pt.name : '단짝' };
  }
  function wishRows(pl) {
    var list = RT.places.wishList(pl), ord = state.map && state.map.wishOrder;
    if (ord) list = list.slice().sort(function (a, b) { var i = ord.indexOf(a.code), j = ord.indexOf(b.code); return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j); });
    return list.map(function (p, i) { return { code: p.code, no: i + 1, name: RT.places.fullName(mapData, p.code), note: p.wishNote, again: p.visits.length > 0 }; });
  }
  function beenRows(pl, sort) {
    var tk = todayKey();
    return RT.places.visitedList(pl, sort).map(function (x) { return { code: x.code, name: RT.places.fullName(mapData, x.code), count: x.count, lastText: RT.places.dateText(x.last, tk), fill: RT.places.starFill(x.avg) }; });
  }
  function openRank(code, change) {
    var pl = placeList(), p = pl[code] || null, list = RT.places.wishList(pl).filter(function (x) { return x.code !== code; });
    var cur = p && p.wishRank !== null ? RT.places.wishList(pl).map(function (x) { return x.code; }).indexOf(code) : -1;
    state.map.rank = { code: code, idx: cur >= 0 ? cur : list.length, idx0: cur, note: p && cur >= 0 ? p.wishNote : '', saving: false, error: '', change: cur >= 0 };
    state.map.find = null; state.sheetEntering = true;
    focusAfter = ['[data-act="map-rank-move"]:not([disabled])', '[data-act="map-rank-save"]']; focusInSheet = true;
    render(true);
  }
  function closeRank() { if (!state.map) return; state.map.rank = null; focusAfter = state.map.sel ? ['[data-act="map-rank"]', '[data-act="map-wish"]'] : ['[data-act="map-wish-add"]']; focusInSheet = !!state.map.sel; render(true); }
  function rankModel() {
    var r = state.map.rank, pl = placeList();
    var rows = RT.places.wishList(pl).filter(function (x) { return x.code !== r.code; }).map(function (x) { return { code: x.code, name: RT.places.fullName(mapData, x.code) }; });
    rows.splice(Math.max(0, Math.min(rows.length, r.idx)), 0, { code: r.code, name: RT.places.fullName(mapData, r.code), isNew: true });
    r.idx = Math.max(0, Math.min(rows.length - 1, r.idx));
    return { name: RT.places.fullName(mapData, r.code), rows: rows, idx: r.idx, note: r.note, saving: r.saving, error: r.error, change: r.change };
  }
  function rankMove(d) {
    var r = state.map && state.map.rank; if (!r) return;
    var n = RT.places.wishList(placeList()).filter(function (x) { return x.code !== r.code; }).length + 1;
    r.idx = Math.max(0, Math.min(n - 1, r.idx + d));
    focusAfter = ['[data-act="map-rank-move"][data-v="' + d + '"]:not([disabled])', '[data-act="map-rank-move"]:not([disabled])']; focusInSheet = true;
    render(true);
  }
  /** code 를 가고 싶은 곳에 둔다 — 바로 앞 이웃(prev 코드, null = 맨 앞) 뒤로.
      한 트랜잭션 안에서 지금 저장된 값을 읽고 계산한다: 그 사이 단짝이 빼거나 다녀온 곳은 되살리지 않고(점검 AI),
      간격이 너무 좁으면 그 자리에서 모두 다시 매긴다. fallbackIdx = 이웃이 사라졌을 때 쓸 자리 */
  function placeWish(code, prev, fallbackIdx, opts) {
    var uid = state.uid || state.me, P = RT.places;
    var codes = P.wishList(placeList()).map(function (x) { return x.code; }).concat([code]);
    return store.transactPlaces(codes, uid, function (data) {
      var fresh = P.fromDocs(data), list = P.wishList(fresh).filter(function (x) { return x.code !== code; });
      var at = prev === null ? 0 : list.map(function (x) { return x.code; }).indexOf(prev) + 1;
      if (prev !== null && at === 0) at = Math.max(0, Math.min(list.length, fallbackIdx));
      var k = P.keyAt(list, at), writes = {}, key = k.key;
      if (k.rebalance) {
        var order = list.map(function (x) { return x.code; }); order.splice(at, 0, code);
        var keys = P.rebalance(order); key = keys[code];
        Object.keys(keys).forEach(function (c) { if (c !== code) writes[c] = { wishRank: keys[c] }; });
      }
      var cur = data[code], was = cur && typeof cur.wishRank === 'number';
      var w = { wishRank: key };
      if (opts && typeof opts.note === 'string') w.wishNote = P.cleanNote(opts.note);
      if (!was) { w.wishedAt = new Date().toISOString(); w.wishedBy = uid; }
      writes[code] = w;
      return writes;
    }).then(function (done) { // 저장된 값을 화면에 바로
      if (done && state.placeDocs) { var pd = Object.assign({}, state.placeDocs); Object.keys(done).forEach(function (c) { if (!newerThan(pd[c], done[c])) pd[c] = done[c]; }); state.placeDocs = pd; }
      return done;
    });
  }
  /** 순위 화면 · 끌기에서 고른 자리 → 바로 앞 이웃 코드 (자리 번호 대신 이웃으로 저장해야 그 사이 목록이 바뀌어도 고른 자리가 맞다) */
  function prevOf(code, idx) {
    var list = RT.places.wishList(placeList()).filter(function (x) { return x.code !== code; });
    return idx > 0 && list[idx - 1] ? list[idx - 1].code : null;
  }
  function saveRank() {
    var r = state.map && state.map.rank; if (!r || r.saving || !store) return;
    var ni = document.getElementById('mp-wnote'); if (ni) r.note = ni.value;
    r.saving = true; r.error = ''; render(true);
    var no = r.idx + 1, change = r.change, p0 = placeList()[r.code];
    // 「순위 바꾸기」에서 자리도 메모도 그대로면 저장하지 않고 닫기
    if (change && r.idx === r.idx0 && RT.places.cleanNote(r.note) === (p0 ? p0.wishNote : '')) { state.map.rank = null; if (state.map.sel) { focusAfter = ['[data-act="map-rank"]']; focusInSheet = true; } render(true); return; }
    placeWish(r.code, prevOf(r.code, r.idx), r.idx, { note: r.note }).then(function () {
      if (!state.map) return;
      state.map.rank = null;
      if (state.map.sel) { state.map.sheet = { mode: 'view' }; focusAfter = ['[data-act="map-rank"]']; focusInSheet = true; }
      else focusAfter = ['[data-act="map-wish-add"]'];
      showToast(change ? no + '위로 옮겼어요' : '가고 싶은 곳 ' + no + '위로 담았어요');
      render(true);
    }, function () {
      if (!state.map || !state.map.rank) return;
      state.map.rank.saving = false; state.map.rank.error = '저장하지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요'; render(true);
    });
  }
  function unwish() {
    var code = state.map && state.map.sel; if (!code || !store) return;
    savePlace(code, state.uid || state.me, function (cur) {
      var next = Object.assign({}, cur || {}); next.wishRank = null; next.wishNote = '';
      if (!next.visits) next.visits = []; if (!next.stars) next.stars = {};
      return next;
    }).then(function () { focusAfter = ['[data-act="map-visit"]']; focusInSheet = true; showToast('가고 싶은 곳에서 뺐어요'); render(true); },
      function () { showToast('빼지 못했어요. 잠시 뒤 다시 해 주세요'); });
  }
  /** 내 별점 (같은 별을 다시 누르면 지움) — 단짝 별점은 못 고침(규칙).
      화면엔 state.map.star(기다리는 값)를 먼저 보이고, 저장은 한 번에 하나씩 · 마지막 값만 (빨리 여러 번 눌러도 순서가 안 꼬이게).
      실패하면 기다리는 값을 지워 저장된 값으로 돌아간다 (점검 AI) */
  function shownStar(code, uid) {
    var ps = state.map && state.map.star;
    if (ps && ps.code === code) return ps.v;
    var p = placeList()[code]; return p ? p.stars[uid] || 0 : 0;
  }
  function setStar(n) {
    var code = state.map && state.map.sel, uid = state.uid || state.me; if (!code || !store) return;
    var nv = shownStar(code, uid) === n ? 0 : n;
    var ps = state.map.star && state.map.star.code === code ? state.map.star : (state.map.star = { code: code, v: nv, busy: false });
    ps.v = nv;
    focusAfter = ['[data-act="map-star"][data-v="' + n + '"]']; focusInSheet = true;
    render(true);
    if (!ps.busy) flushStar(ps, uid);
  }
  function flushStar(ps, uid) {
    var want = ps.v; ps.busy = true;
    savePlace(ps.code, uid, function (cur) {
      var next = Object.assign({}, cur || {}); next.stars = Object.assign({}, (cur && cur.stars) || {});
      if (want) next.stars[uid] = want; else delete next.stars[uid];
      if (!next.visits) next.visits = [];
      return next;
    }).then(function () {
      ps.busy = false;
      if (ps.v !== want) { flushStar(ps, uid); return; } // 그 사이 또 눌렀으면 마지막 값으로 한 번 더
      if (state.map && state.map.star === ps) { state.map.star = null; render(); }
    }, function () {
      ps.busy = false;
      if (state.map && state.map.star === ps) state.map.star = null;
      showToast('별점을 저장하지 못했어요'); render(true);
    });
  }
  // 끌어서 순위 바꾸기: 가고 싶은 곳 목록(#mwish)의 손잡이 · 순위 고르기 화면(#mrank)의 강조 줄
  var mdrag = null;
  appEl.addEventListener('pointerdown', function (ev) {
    if (!state.map || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    var g = ev.target.closest && ev.target.closest('[data-grip]');
    var box = g && g.closest('#mwish, #mrank');
    if (!g || !box) return;
    var li = g.closest('li');
    ev.preventDefault();
    var r = li.getBoundingClientRect();
    mdrag = { pid: ev.pointerId, li: li, box: box, grab: ev.clientY - r.top, moved: false, before: Array.prototype.map.call(box.children, function (c) { return c.getAttribute('data-code') || ''; }).join() };
    li.classList.add('is-lifted');
    try { li.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  appEl.addEventListener('pointermove', function (ev) {
    if (!mdrag || ev.pointerId !== mdrag.pid) return;
    ev.preventDefault();
    var li = mdrag.li, box = mdrag.box, y = ev.clientY, before = null;
    var others = Array.prototype.filter.call(box.children, function (c) { return c !== li; });
    for (var i = 0; i < others.length; i++) { var rr = others[i].getBoundingClientRect(); if (y < rr.top + rr.height / 2) { before = others[i]; break; } }
    if (before) { if (li.nextElementSibling !== before) box.insertBefore(li, before); } else if (box.lastElementChild !== li) box.appendChild(li);
    li.style.transform = ''; var top = li.getBoundingClientRect().top;
    li.style.transform = 'translateY(' + Math.round(y - mdrag.grab - top) + 'px)';
    mdrag.moved = true;
  });
  function mdragEnd(cancelled) {
    var D0 = mdrag; mdrag = null; if (!D0) return;
    D0.li.classList.remove('is-lifted'); D0.li.style.transform = '';
    var order = Array.prototype.map.call(D0.box.children, function (c) { return c.getAttribute('data-code') || ''; });
    if (cancelled || order.join() === D0.before) { render(true); return; }
    noClickUntil = Date.now() + 400;
    var code = D0.li.getAttribute('data-code'), idx = order.indexOf(code);
    if (D0.box.id === 'mrank') { if (state.map && state.map.rank) state.map.rank.idx = idx; render(true); return; }
    // 저장이 끝날 때까지 놓은 순서를 들고 있는다 (원래 자리로 튀었다 옮겨지지 않게 — 점검 AI)
    var prev = idx > 0 ? order[idx - 1] : null, tmp = order.slice();
    if (state.map) state.map.wishOrder = tmp;
    render(true);
    var done = function () { if (state.map && state.map.wishOrder === tmp) { state.map.wishOrder = null; render(true); } };
    placeWish(code, prev, idx).then(function () { done(); showToast((idx + 1) + '위로 옮겼어요'); }, function () { done(); showToast('순위를 바꾸지 못했어요'); });
  }
  appEl.addEventListener('pointerup', function (ev) { if (mdrag && ev.pointerId === mdrag.pid) mdragEnd(false); });
  appEl.addEventListener('pointercancel', function (ev) { if (mdrag && ev.pointerId === mdrag.pid) mdragEnd(true); });
  // 끄는 도중 줄이 사라지면(뒤로가기 등으로 다시 그림) 끌기를 끝낸다 — 남아 있으면 다시 그리기가 계속 미뤄진다 (점검 AI)
  //  (줄을 옮기는 insertBefore 도 캡처를 풀기 때문에, 줄이 화면에서 사라졌을 때만)
  appEl.addEventListener('lostpointercapture', function (ev) { if (mdrag && ev.pointerId === mdrag.pid && !mdrag.li.isConnected) mdragEnd(true); }, true);
  appEl.addEventListener('touchmove', function (ev) { if (mdrag) ev.preventDefault(); }, { passive: false });

  function openFind() {
    if (!state.map || !mapReady()) return;
    state.map.find = { q: '' }; state.sheetEntering = true;
    focusAfter = ['#mp-q']; focusInSheet = true;
    render(true);
  }
  function closeFind() { if (!state.map) return; var wish = state.map.find && state.map.find.mode === 'wish'; state.map.find = null; focusAfter = wish ? ['[data-act="map-wish-add"]'] : ['[data-act="map-find"]']; render(true); }
  function mapFindModel() {
    var pl = placeList();
    return { q: state.map.find.q, results: RT.places.search(mapData, state.map.find.q, 20).map(function (r) { return { code: r.code, name: r.name, been: !!(pl[r.code] && pl[r.code].visits.length) }; }) };
  }
  function mapPick(code) {
    if (!state.map) return;
    if (state.map.find && state.map.find.mode === 'wish') { openRank(code, false); return; } // 가고 싶은 곳 더하기 → 순위 고르기
    state.map.find = null;
    var r = RT.places.regionOf(mapData, code);
    if (r) state.map.vb = RT.mapZoom.focusOn(state.map.vb, r.x, r.y, 360, RT.viewMap.HOME);
    mapSel(code);
  }

  // ── 단짝 식탁 (D2): 목표 고르기 · 계산 근거 · 임시 첫 화면 ──
  var unGoals = null, unPriv = null;
  function myGoal() { var d = state.goalDocs && state.goalDocs[state.uid || state.me]; return d && d.kind ? d : null; }
  function loadGoalsOnce() {
    if (!store || state.goalDocs || state.goalsLoading || state.goalsOff) return;
    state.goalsLoading = true;
    store.loadGoals().then(function (d) { state.goalsLoading = false; if (!state.goalDocs) state.goalDocs = d; render(); },
      function () { state.goalsLoading = false; state.goalsOff = true; render(); });
  }
  function allDietModel() {
    if (!state.goalDocs && !state.goalsOff) setTimeout(loadGoalsOnce, 0);
    var g = myGoal();
    return { ready: !!state.goalDocs, kcal: g ? g.kcal : null, kind: g ? g.kind : null };
  }
  function openDiet() {
    if (!store || !RT.viewDiet) return;
    var uid = state.uid || state.me;
    state.account = false; state.anniv = null;
    state.diet = { view: 'home', form: null, basis: null };
    if (unGoals) unGoals(); if (unPriv) unPriv();
    unGoals = store.watchGoals(function (d) { state.goalDocs = d; state.goalsOff = false; if (state.diet && state.diet.view === 'home' && !myGoal() && !state.diet.form) dietGoalForm(true); render(); },
      function () { state.goalsOff = true; render(); });
    unPriv = store.watchPrivate(uid, function (d) { state.privDoc = d || {}; render(); }, function () { state.privDoc = null; state.privOff = true; render(); });
    if (state.goalDocs && !myGoal()) dietGoalForm(true);
    focusAfter = ['[data-act="diet-close"]', '[data-act="dg-close"]'];
    render(true);
    try { root.scrollTo(0, 0); } catch (e) {}
  }
  function stopDiet() { if (unGoals) { unGoals(); unGoals = null; } if (unPriv) { unPriv(); unPriv = null; } state.diet = null; }
  function closeDiet() { stopDiet(); focusAfter = ['[data-act="all-diet"]']; render(true); }
  /** 목표 고르기 열기 — 저장된 몸 정보 · 목표로 채움 (처음이면 비움) */
  function dietGoalForm(first) {
    var pv = state.privDoc || {}, b = pv.body || {}, g = myGoal(), skip = !!(g && g.edited && !b.weightKg);
    // 고친 줄만 고친 값으로 (줄별 기록은 private/{uid}.edits — 점검 AI: 한 줄 고치면 네 줄이 다 굳던 문제). 직접 입력이면 네 줄 모두
    var edits = {};
    ['kcal', 'protein', 'fat', 'carb'].forEach(function (k) { if (skip && g) edits[k] = g[k]; else if (pv.edits && typeof pv.edits[k] === 'number') edits[k] = pv.edits[k]; });
    state.diet.form = { first: !!first && !g, goal: g ? g.kind : 'keep', sex: b.sex || '', age: b.age || '', height: b.heightCm || '', weight: b.weightKg || '', activity: b.activity || '',
      skip: skip, retune: !!(g && g.retune), edits: edits, editing: null, saving: false, error: '' };
    state.diet.view = 'goal'; state.sheetEntering = true;
  }
  function dietBody(f) {
    var n = function (v) { var x = parseFloat(v); return isFinite(x) ? x : NaN; };
    var b = { sex: f.sex, age: n(f.age), heightCm: n(f.height), weightKg: n(f.weight), activity: f.activity, goal: f.goal };
    var ok = (b.sex === 'm' || b.sex === 'f') && b.age >= 1 && b.age <= 120 && b.heightCm >= 50 && b.heightCm <= 260 && b.weightKg >= 10 && b.weightKg <= 400 && !!RT.dietGoal.ACTIVITY[b.activity];
    return ok ? b : null;
  }
  function dietReco(f) {
    var G = RT.dietGoal, body = f.skip ? null : dietBody(f), t = body ? G.targets(body) : null, vals = {}, subs = {}, edited = {};
    ['kcal', 'protein', 'fat', 'carb'].forEach(function (k) {
      var e = f.edits[k]; edited[k] = e != null && e !== '';
      vals[k] = edited[k] ? parseFloat(e) : t ? t[k] : null;
    });
    if (t) {
      var pct = function (g, m) { return t.kcal ? Math.round(g * m / t.kcal * 100) : 0; };
      subs.kcal = f.goal === 'keep' ? '하루 소비 약 ' + Math.round(t.tdee).toLocaleString('ko-KR') : f.goal === 'bulk' ? '하루 소비 약 ' + Math.round(t.tdee).toLocaleString('ko-KR') + ' + 10%' : '하루 소비 약 ' + Math.round(t.tdee).toLocaleString('ko-KR') + ' − 주 0.5%';
      subs.protein = t.proteinCapped ? '칼로리의 20%까지' : '체중 × ' + (f.goal === 'keep' ? '1.6' : '2.0') + 'g · ' + pct(t.protein, 4) + '%';
      subs.fat = pct(t.fat, 9) + '%'; subs.carb = '나머지 · ' + pct(t.carb, 4) + '%';
    }
    var LIM = { kcal: 10000, protein: 1000, fat: 1000, carb: 2000 }; // 저장 규칙(validGoal)과 같은 상한
    var full = vals.kcal > 0 && vals.protein >= 0 && vals.fat >= 0 && vals.carb >= 0 && [vals.kcal, vals.protein, vals.fat, vals.carb].every(function (v) { return v != null && isFinite(v); });
    var tooBig = full && Object.keys(LIM).filter(function (k) { return vals[k] > LIM[k]; });
    if (tooBig && tooBig.length) full = false;
    var notes = full ? G.notesFor(vals) : [];
    if (t && t.kcalRaised && !edited.kcal) notes.unshift('감량 속도를 늦췄어요 (기초대사량보다 낮게 먹지 않게)');
    if (full && body && f.edits.kcal != null && f.edits.kcal !== '' && G.clampKcal(vals.kcal, body, f.goal) > vals.kcal) notes.push('기초대사량이나 주 1% 감량보다 낮은 칼로리예요 — 저장은 되지만 권하지 않아요');
    if (tooBig && tooBig.length) notes.push('너무 큰 숫자예요 (칼로리 10,000 · 탄수 2,000 · 단백질 · 지방 1,000g까지)');
    return { ready: !!t, skip: f.skip, values: vals, subs: subs, editing: f.editing, edited: edited, notes: notes, full: full, tooBig: !!(tooBig && tooBig.length), targets: t, body: body };
  }
  function dietGoalModel() {
    var f = state.diet.form;
    return Object.assign({}, f, { reco: dietReco(f), notice: RT.dietGoal.NOTICE });
  }
  function dietHomeModel() {
    var pi = partnerInfo(), pg = pi.partner && state.goalDocs ? state.goalDocs[pi.partner] : null;
    return { mine: myGoal(), partner: pi.partner ? { name: pi.partnerName, goal: pg && pg.kind ? pg : null } : null };
  }
  function dietRefreshReco() {
    var box = document.getElementById('dg-reco'); if (!box || !state.diet || !state.diet.form) return;
    var r = dietReco(state.diet.form);
    box.innerHTML = RT.viewDiet.reco(r);
    var nb = document.getElementById('dg-notes'); if (nb) nb.innerHTML = RT.viewDiet.notes(r);
  }
  function dietRefreshNotes() {
    var nb = document.getElementById('dg-notes'); if (!nb || !state.diet || !state.diet.form) return;
    nb.innerHTML = RT.viewDiet.notes(dietReco(state.diet.form));
  }
  /** 고치기 칸의 값을 폼에 — 추천값을 그대로 둔 채 「완료」만 누르면 고친 것으로 치지 않음 (점검 AI) */
  function dietTakeEdit(f, k) {
    var el = document.getElementById('dg-e-' + k); if (!el) return;
    var v = el.value.trim(), t = !f.skip ? (dietReco(Object.assign({}, f, { edits: Object.assign({}, f.edits, (function () { var o = {}; o[k] = null; return o; })()) })).targets) : null;
    if (t && v !== '' && Math.round(parseFloat(v)) === Math.round(t[k]) && (f.edits[k] == null || f.edits[k] === '')) { delete f.edits[k]; return; }
    if (v === '' && !f.skip) delete f.edits[k]; else f.edits[k] = v;
  }
  function dietStart(acked) {
    var d = state.diet, f = d && d.form, uid = state.uid || state.me; if (!f || f.saving || !store) return;
    ['kcal', 'protein', 'fat', 'carb'].forEach(function (k) { dietTakeEdit(f, k); });
    if (state.privDoc == null) { f.error = '내 정보를 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요'; render(true); return; } // 불러오기 전에 저장하면 예전 몸 정보를 덮을 수 있어서
    var r = dietReco(f);
    if (!r.full) { f.error = r.tooBig ? '숫자가 너무 커요. 목표를 다시 확인해 주세요' : f.skip ? '칼로리 · 단백질 · 지방 · 탄수를 모두 적어 주세요' : '몸 정보를 다 적거나, 「건너뛰고 직접 입력」으로 목표를 적어 주세요'; render(true); return; }
    var ack = acked || d.acked || (state.privDoc && state.privDoc.ackAt);
    if (!ack) { d.basis = { needAck: true }; state.sheetEntering = true; focusAfter = ['[data-act="dg-basis-ok"]']; focusInSheet = true; render(true); return; } // 처음 한 번은 계산 근거를 확인해야 시작
    var now = new Date().toISOString(), edited = f.skip || Object.keys(r.edited).some(function (k) { return r.edited[k]; });
    var priv = { updatedAt: now };
    if (!state.privDoc.ackAt) priv.ackAt = now; // 이미 확인했으면 그대로 (저장은 merge)
    var ed = {}; ['kcal', 'protein', 'fat', 'carb'].forEach(function (k) { if (r.edited[k]) ed[k] = r.values[k]; });
    priv.edits = f.skip ? {} : ed; // 줄별로 고친 값 (다시 열 때 고친 줄만 고친 값으로)
    if (r.body) { priv.body = { sex: r.body.sex, age: r.body.age, heightCm: r.body.heightCm, weightKg: r.body.weightKg, activity: r.body.activity }; priv.suggested = { kind: f.goal, kcal: r.targets.kcal, protein: r.targets.protein, fat: r.targets.fat, carb: r.targets.carb }; }
    var goal = { kind: f.goal, kcal: r.values.kcal, protein: r.values.protein, fat: r.values.fat, carb: r.values.carb, edited: edited, retune: !!f.retune, updatedAt: now };
    f.saving = true; f.error = ''; render(true);
    store.saveDietGoal(uid, priv, goal).then(function () {
      if (!state.diet) return;
      state.privDoc = Object.assign({}, state.privDoc, priv);
      state.goalDocs = Object.assign({}, state.goalDocs || {}); state.goalDocs[uid] = goal;
      state.diet.view = 'home'; state.diet.form = null; state.diet.basis = null;
      focusAfter = ['[data-act="dg-open"]'];
      showToast('목표를 정했어요'); render(true);
    }, function () {
      if (!state.diet || !state.diet.form) return;
      state.diet.form.saving = false; state.diet.form.error = '저장하지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요'; render(true);
    });
  }

  // ── 「우리 둘」 박스 · 프로필 사진 (v51) ──
  function usModel() {
    var A = RT.anniv, v = state.couple && !state.coupleOff ? annivView(false) : null, a = A && A.fromDoc(state.couple);
    var ps = planPeople(), av = state.avaDocs || {};
    // 왼쪽 = 나, 오른쪽 = 단짝 (각자 폰에서. 별점 카드 「나 · 단짝」과 같은 순서)
    var order = ps.slice().sort(function (x, y) { return (y.mine ? 1 : 0) - (x.mine ? 1 : 0); }).map(function (p) { return { uid: p.key, name: p.name, slot: p.slot, mine: p.mine, img: av[p.key] && av[p.key].img ? av[p.key].img : '' }; });
    var line1, line2 = '';
    if (state.coupleOff || !A) { line1 = ''; }
    else if (!state.coupleLoaded) { line1 = ' '; } // 불러오는 중엔 「정해 볼까요?」를 잠깐 보이지 않게
    else if (!a) { line1 = '우리가 시작한 날을'; line2 = '정해 볼까요?'; }
    else if (v && v.future) { line1 = v.startText + '부터'; line2 = '시작까지 ' + v.dText; }
    else if (v) { line1 = v.line; line2 = v.today ? '오늘은 ' + v.today + '이에요 🎉' : v.next[0] ? v.next[0].name + '까지 ' + v.next[0].d : ''; }
    if (a && state.coupleLoaded && lsGet(LS_BOX) !== a.box) lsSet(LS_BOX, a.box); // 다음에 열 때 불러오는 동안에도 같은 모양 (깜빡임 없게)
    return { style: a ? a.box : A ? A.cleanBox(lsGet(LS_BOX)) : 'heart', left: order[0] || null, right: order[1] || null, line1: line1, line2: line2, off: !!state.coupleOff || !A,
      count: v && !v.future ? v.count : 0, label: v ? v.label : '', countText: v && !v.future ? v.countText : '', next: v && !v.future && v.next[0] ? v.next[0] : null, todayName: v && !v.future ? v.today : null, prog: v && !v.future ? v.prog : null,
      nexts: v && !v.future ? v.next : [], past: v && !v.future ? v.past : [] };
  }
  function avaViewModel() {
    var uid = state.avaView && state.avaView.uid, d = uid && (state.avaDocs || {})[uid];
    if (!d || !d.img) return null;
    var p = planPeople().filter(function (x) { return x.key === uid; })[0];
    if (!p) return null;
    return { name: p.name, img: d.img, mine: !!p.mine };
  }
  function openAvaView(uid) {
    if (!uid) return;
    state.anniv = null; state.account = false; state.ava = null;
    state.avaView = { uid: String(uid) }; state.sheetEntering = true;
    focusAfter = ['[data-act="ava-view-close"].aview__btn']; focusInSheet = true;
    render(true);
  }
  function closeAvaView() {
    var uid = state.avaView && state.avaView.uid; state.avaView = null;
    focusAfter = uid ? ['[data-act="ava-view"][data-v="' + uid.replace(/[^A-Za-z0-9_-]/g, '') + '"]', '[data-act="ava-open"]'] : ['[data-act="ava-open"]'];
    render(true);
  }
  function openAva() {
    state.anniv = null; state.account = false; state.avaView = null;
    state.ava = { error: '', busy: false }; state.sheetEntering = true;
    focusAfter = ['#ava-file']; focusInSheet = true;
    render(true);
  }
  function dropCrop() { var c = state.avaCrop; if (c && c.src) URL.revokeObjectURL(c.src); state.avaCrop = null; acp = {}; }
  function closeAva() { dropCrop(); state.ava = null; focusAfter = ['[data-act="ava-open"]']; render(true); }
  function avaPicked(file) {
    if (!file || !state.ava) return;
    if (!/^image\//.test(file.type || 'image/')) { state.ava.error = '사진 파일을 골라 주세요'; render(true); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      if (!state.ava) { URL.revokeObjectURL(url); return; }
      var view = Math.min(300, Math.max(220, (root.innerWidth || 360) - 80));
      var st = RT.avatarCrop.cover(img.naturalWidth, img.naturalHeight, view);
      state.avaCrop = { src: url, view: view, iw: img.naturalWidth, ih: img.naturalHeight, st: st, img: img, saving: false, error: '' };
      state.sheetEntering = true; focusAfter = ['[data-act="ava-crop-save"]']; focusInSheet = true;
      render(true); avaApply();
    };
    img.onerror = function () { URL.revokeObjectURL(url); if (state.ava) { state.ava.error = '사진을 열 수 없어요. 다른 사진을 골라 주세요'; render(true); } };
    img.src = url;
  }
  /** 사진 위치를 화면에 (다시 그리지 않고 transform 만) */
  function avaApply() {
    var c = state.avaCrop, el = c && document.getElementById('acrop-img'); if (!el) return;
    el.style.width = (c.iw * c.st.scale) + 'px'; el.style.height = (c.ih * c.st.scale) + 'px';
    el.style.transform = 'translate(' + c.st.x + 'px,' + c.st.y + 'px)';
    var z = document.getElementById('ava-zoom'); if (z && document.activeElement !== z) z.value = String(c.st.scale / c.st.min);
  }
  function avaCancel() { dropCrop(); focusAfter = ['#ava-file']; focusInSheet = true; render(true); }
  function avaSave() {
    var c = state.avaCrop, C = RT.avatarCrop, uid = state.uid || state.me; if (!c || c.saving || !store) return;
    var s = C.source(c.st, c.view), bg = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff', data = '';
    // 크게 보기에도 또렷하게 512px 부터. 규칙의 글자 수를 넘으면 384 · 256 으로 줄여 다시 (v52)
    for (var si = 0; si < C.SIZES.length; si++) {
      var n = C.SIZES[si], cv = document.createElement('canvas'); cv.width = n; cv.height = n;
      var g = cv.getContext('2d');
      g.fillStyle = bg; // 투명 PNG 가 JPEG 에서 검게 나오지 않게
      g.fillRect(0, 0, n, n);
      g.drawImage(c.img, s.sx, s.sy, s.size, s.size, 0, 0, n, n);
      var q = C.QUALITY; data = cv.toDataURL('image/jpeg', q);
      while (data.length > C.MAX_LEN && q > 0.55) { q -= 0.1; data = cv.toDataURL('image/jpeg', q); } // 저장 규칙의 크기 안으로
      if (data.length <= C.MAX_LEN) break;
    }
    if (data.length > C.MAX_LEN) { c.error = '사진이 너무 커요. 다른 사진을 골라 주세요'; render(true); return; }
    c.saving = true; c.error = ''; render(true); avaApply();
    store.saveAvatar(uid, data).then(function () {
      state.avaDocs = Object.assign({}, state.avaDocs); state.avaDocs[uid] = { img: data };
      if (state.avaCrop === c) dropCrop(); else URL.revokeObjectURL(c.src); state.ava = null;
      focusAfter = ['[data-act="ava-open"]']; showToast('사진을 바꿨어요'); render(true);
    }, function () { if (state.avaCrop) { state.avaCrop.saving = false; state.avaCrop.error = '저장하지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요'; render(true); avaApply(); } });
  }
  function avaDelete() {
    var uid = state.uid || state.me; if (!state.ava || state.ava.busy || !store) return;
    state.ava.busy = true; render(true);
    store.deleteAvatar(uid).then(function () {
      state.avaDocs = Object.assign({}, state.avaDocs); delete state.avaDocs[uid];
      state.ava = null; focusAfter = ['[data-act="ava-open"]']; showToast('사진을 지웠어요'); render(true);
    }, function () { if (state.ava) { state.ava.busy = false; state.ava.error = '지우지 못했어요. 잠시 뒤 다시 해 주세요'; render(true); } });
  }
  // 사진 자리 고르기: 한 손가락 = 옮기기, 두 손가락 = 크기
  var acp = {};
  appEl.addEventListener('pointerdown', function (ev) {
    var v = state.avaCrop && ev.target.closest && ev.target.closest('#acrop-view'); if (!v) return;
    ev.preventDefault(); acp[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    try { v.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  appEl.addEventListener('pointermove', function (ev) {
    var c = state.avaCrop; if (!c || !acp[ev.pointerId]) return;
    var ids = Object.keys(acp), prev = acp[ev.pointerId], C = RT.avatarCrop;
    if (ids.length === 1) {
      c.st = C.clamp({ scale: c.st.scale, min: c.st.min, x: c.st.x + ev.clientX - prev.x, y: c.st.y + ev.clientY - prev.y }, c.iw, c.ih, c.view);
      acp[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    } else {
      var other = acp[ids[0] == ev.pointerId ? ids[1] : ids[0]];
      var d0 = Math.hypot(prev.x - other.x, prev.y - other.y) || 1, d1 = Math.hypot(ev.clientX - other.x, ev.clientY - other.y) || 1;
      var r = document.getElementById('acrop-view').getBoundingClientRect();
      c.st = C.zoomAt(c.st, d1 / d0, (ev.clientX + other.x) / 2 - r.left, (ev.clientY + other.y) / 2 - r.top, c.iw, c.ih, c.view);
      acp[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    }
    avaApply();
  });
  // 앱 밖에서 손을 떼도 지난 손가락이 남지 않게 (남으면 다음 한 손가락 끌기가 확대로 처리됨 — 점검 AI)
  ['pointerup', 'pointercancel'].forEach(function (t) { root.addEventListener(t, function (ev) { delete acp[ev.pointerId]; }, true); });
  function avaTouching() { for (var k in acp) return true; return false; }

  // ── 「전체」 탭 (v47) ──
  function allModel() {
    return {
      us: usModel(), // 「우리 둘」 박스 (디데이 · 다음 기념일 · 사진)
      map: allMapModel(),
      diet: allDietModel(),
      notify: RT.push && root.DANJJAKKUNG_PUSH_READY ? (RT.push.isOn() ? '켜짐' : '꺼짐') : '',
      theme: RT.themes ? RT.themes.byId(RT.themes.current()).name : '',
      meName: state.me ? nameOf(state.me) : ''
    };
  }
  function openAccount() {
    state.anniv = null; state.notifyOpen = false; state.themeOpen = false;
    state.account = true; state.sheetEntering = true;
    focusAfter = ['[data-act="sign-out"]']; focusInSheet = true;
    render(true);
  }
  function closeAccount() {
    state.account = false;
    focusAfter = ['[data-act="open-account"]'];
    render(true);
  }
  function annivSheetModel() {
    var A = RT.anniv, f = state.anniv.edit, a = A.fromDoc(state.couple), by = '';
    if (a && a.updatedBy) {
      var t = a.updatedAt ? D.dayOfIso(a.updatedAt) : NaN;
      by = (a.updatedBy === state.me ? '내가' : nameOf(a.updatedBy) + ' 님이') + (isNaN(t) ? '' : ' ' + D.label(t)) + ' 정했어요';
    }
    return { view: a ? A.build(a, state.today) : null, by: by, box: a ? { current: a.box, boxes: A.BOXES } : null,
      edit: f ? Object.assign({}, f, { presets: A.PRESETS, max: A.LABEL_MAX, maxDate: D.toKey(state.today), sample: sampleCount(f.start) }) : null };
  }
  function sampleCount(key) {
    var n = D.parse(key);
    return !isNaN(n) && n <= state.today ? String(RT.anniv.dayCount(n, state.today)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '100';
  }
  function annivForm() {
    var A = RT.anniv, a = A.fromDoc(state.couple);
    var label = a ? a.label : A.DEFAULT_LABEL;
    return { label: label, custom: A.PRESETS.indexOf(label) < 0, start: a ? a.startKey : '', saving: false, error: '', errorFresh: false };
  }
  function openAnniv() {
    if (!RT.anniv || state.coupleOff) return;
    state.sheetDay = null; state.manage = null; state.notifyOpen = false; state.themeOpen = false; state.growOpen = false;
    state.todoForm = null; state.eventForm = null; state.catSheet = null; state.uniSheet = null; state.archive = null;
    state.anniv = { edit: RT.anniv.fromDoc(state.couple) ? null : annivForm() };
    state.sheetEntering = true;
    focusAfter = state.anniv.edit ? ['[data-act="anniv-label"][aria-pressed="true"]'] : ['[data-act="anniv-edit"]']; focusInSheet = true;
    render(true);
  }
  function closeAnniv() {
    state.anniv = null;
    focusAfter = ['[data-act="open-anniv"]'];
    render(true);
  }
  function annivEdit() {
    if (!state.anniv) return;
    state.anniv.edit = annivForm();
    focusAfter = ['#an-start']; focusInSheet = true;
    render(true);
  }
  /** 입력칸 값을 폼에 옮겨 둔다 (다시 그려도 적던 것이 남게) */
  function annivRead(f) {
    var li = document.getElementById('an-label'), si = document.getElementById('an-start');
    if (li && f.custom) f.label = li.value;
    if (si) f.start = si.value;
  }
  function annivLabel(v) {
    var f = state.anniv && state.anniv.edit;
    if (!f || f.saving) return;
    annivRead(f);
    if (v) { f.label = v; f.custom = false; }
    else { if (!f.custom) f.label = ''; f.custom = true; focusAfter = ['#an-label']; focusInSheet = true; }
    f.error = '';
    render(true);
  }
  /** v52 「우리 둘」 박스 모양 — 누르면 바로 저장 (화면엔 먼저, 못 하면 되돌림).
      버튼을 막지 않는다: 오프라인이면 저장 약속이 서버에 닿을 때까지 안 끝나서 막으면 계속 못 누름 · 포커스도 잃음 (점검 AI)
      모양만 바꾸면 「누가 정했어요」(updatedBy · updatedAt)는 그대로 — 기념일을 정한 기록이 덮이지 않게 */
  var boxSeq = 0;
  function annivBox(id) {
    var A = RT.anniv, a = A.fromDoc(state.couple);
    if (!store || !state.me || !state.anniv || !a) return;
    id = A.cleanBox(id); if (id === a.box) return;
    var prev = state.couple.box, seq = ++boxSeq;
    state.couple = Object.assign({}, state.couple, { box: id });
    lsSet(LS_BOX, id);
    focusAfter = ['[data-act="anniv-box"][data-v="' + id + '"]']; focusInSheet = true;
    render(true);
    store.saveBox(id).catch(function () {
      if (seq !== boxSeq) return; // 그 뒤에 또 눌렀으면 그 값이 맞음
      if (state.couple && state.couple.box === id) { state.couple = Object.assign({}, state.couple, { box: prev }); lsSet(LS_BOX, A.cleanBox(prev)); }
      if (state.anniv) { focusAfter = ['[data-act="anniv-box"][aria-pressed="true"]']; focusInSheet = true; }
      showToast('모양을 바꾸지 못했어요. 잠시 뒤 다시 해 주세요'); render(true);
    });
  }
  function saveAnniv() {
    var A = RT.anniv, f = state.anniv && state.anniv.edit;
    if (!store || !f || f.saving || !state.me) return;
    annivRead(f);
    var err = A.validate(f, state.today);
    if (err) { f.error = err; f.errorFresh = true; render(true); return; }
    var c = { start: f.start, label: A.cleanLabel(f.label) };
    var before = state.couple;
    f.saving = true; f.error = '';
    state.couple = Object.assign({}, state.couple, { start: c.start, label: c.label, updatedBy: state.me, updatedAt: new Date().toISOString() }); // 화면에는 먼저 (박스 모양은 그대로)
    state.anniv.edit = null;
    focusAfter = ['[data-act="anniv-edit"]']; focusInSheet = true;
    render(true);
    store.saveCouple(c, state.me).then(function () {
      var v = A.build(A.fromDoc(state.couple), state.today);
      showToast(v && !v.future ? '오늘은 ' + v.line + '째예요 💞' : '기념일을 저장했어요');
    }, function () {
      state.couple = before;
      if (state.anniv) { state.anniv.edit = Object.assign(annivForm(), { label: c.label, custom: A.PRESETS.indexOf(c.label) < 0, start: c.start, error: '저장하지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요', errorFresh: true }); }
      render(true);
    });
  }

  // ── 테마 ── (테마는 이 기기에, 나 · 상대 색은 내 계정에 테마마다 저장: js/themes.js)
  function themeModel() {
    var T = RT.themes, id = T.current(), slot = mySlot(), ps = planPeople();
    var out = { themes: T.THEMES, current: id, colors: null };
    if (!slot || !store) return out;
    var colors = state.colors || {}, pair = T.pairFor(id, colors, slot);
    var partner = ps.filter(function (p) { return !p.mine; })[0];
    var me = ps.filter(function (p) { return p.mine; })[0];
    function row(who, label) {
      return { who: who, label: label, value: pair[who], options: T.palette(id).map(function (hex) {
        return { hex: hex, name: T.colorName(hex), ink: T.inkFor(id, hex), on: hex === pair[who], taken: hex === pair[who === 'self' ? 'partner' : 'self'], both: hex === T.bothColor(id) };
      }) };
    }
    out.colors = {
      themeName: T.byId(id).name, loading: state.colors === null,
      rows: [row('self', '나' + (me && me.name ? ' (' + me.name + ')' : '')), row('partner', partner ? partner.name : '상대')],
      custom: !!T.cleanColors(colors)[id]
    };
    return out;
  }
  function saveColors(next) {
    var before = state.colors;
    state.colors = next; render(true);
    store.saveColors(state.uid, next).catch(function () {
      state.colors = before; render(true);
      showToast('색을 저장하지 못했어요. 잠시 뒤 다시 해 주세요');
    });
  }
  function pickColor(who, hex) {
    var slot = mySlot();
    if (!RT.themes || !store || !state.uid || !slot || state.colors === null) return;
    var next = RT.themes.withPick(state.colors, RT.themes.current(), slot, who, hex);
    if (JSON.stringify(next) === JSON.stringify(RT.themes.cleanColors(state.colors))) return;
    saveColors(next);
  }
  function resetColors() {
    if (!RT.themes || !store || !state.uid || state.colors === null) return;
    var id = RT.themes.current();
    if (!RT.themes.cleanColors(state.colors)[id]) return;
    saveColors(RT.themes.withReset(state.colors, id));
  }
  function openTheme() {
    if (!RT.themes) return;
    state.anniv = null; state.account = false;
    state.sheetDay = null; state.manage = null; state.notifyOpen = false; state.todoForm = null; state.eventForm = null; state.catSheet = null;
    state.themeOpen = true; state.sheetEntering = true; render(true);
  }
  function closeTheme() {
    state.themeOpen = false; render(true);
    var back = appEl.querySelector('[data-act="open-theme"]');
    if (back) back.focus({ preventScroll: true });
  }
  function pickTheme(id) {
    if (!RT.themes || !RT.themes.save(id)) return;
    render(true);                              // 선택 표시를 먼저 그리고
    RT.themes.apply(id, { smooth: true });    // 그려진 화면 위에서 색을 바꿔야 스르륵 바뀐다
  }
  function openNotify() {
    state.anniv = null; state.account = false;
    state.sheetDay = null; state.manage = null; state.themeOpen = false; state.catSheet = null;
    state.push = { busy: false, error: '', info: '' };
    state.notifyOpen = true; state.sheetEntering = true; render(true);
  }
  function closeNotify() {
    state.notifyOpen = false; render(true);
    var back = appEl.querySelector('[data-act="open-notify"]');
    if (back) back.focus({ preventScroll: true });
  }
  function pushFail(msg) { state.push.busy = false; state.push.error = msg; state.push.errorFresh = true; state.push.info = ''; render(true); }
  function pushOn() {
    if (!store || !state.uid || state.push.busy || !RT.push) return;
    state.push = { busy: true, error: '', info: '' };
    var job = RT.push.enable(store, state.uid); // 허용 창은 누른 순간에 띄운다 (render보다 먼저)
    render(true);
    job.then(function () {
      state.push.busy = false;
      state.push.info = '알림을 켰어요. 「테스트 알림 보내기」로 확인해 보세요';
      // 처음 켜는 거라면 기본 설정을 같이 남긴다 (저녁 알림은 밤 9시)
      // (설정을 아직 못 읽었으면 덮어쓰지 않는다 — 다른 기기에서 정한 값을 지키기 위해)
      if (state.prefsReady && !state.prefs) return savePrefs({ partner: true, remindAt: '21:00', hide: false });
    }).then(function () { render(true); }, function (e) { pushFail(RT.push.errorText(e)); });
  }
  function pushOff() {
    if (!store || state.push.busy || !RT.push) return;
    state.push = { busy: true, error: '', info: '' }; render(true);
    RT.push.disable(store, state.uid).then(function () {
      state.push.busy = false; state.push.info = '이 기기에서는 알림을 받지 않아요'; render(true);
    }, function () { pushFail('끄지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요'); });
  }
  function pushTest() {
    if (!store || state.push.busy) return;
    state.push = { busy: true, error: '', info: '' }; render(true);
    store.ping(state.uid).then(function () {
      state.push.busy = false; state.push.info = '테스트 알림을 보냈어요. 몇 초 안에 휴대폰 알림으로 와요'; render(true);
    }, function () { pushFail('보내지 못했어요. 잠시 뒤 다시 눌러 주세요'); });
  }
  function savePrefs(next) {
    var before = state.prefs;
    state.prefs = next; render(true);
    return store.saveNotify(state.uid, next).catch(function () {
      state.prefs = before; pushFail('설정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요');
    });
  }
  function setWeekly(on) {
    if (!store || !state.uid || !state.prefsReady) return;
    var before = state.weeklyOn;
    state.weeklyOn = on; render(true);
    store.saveWeekly(state.uid, on).catch(function () { state.weeklyOn = before; pushFail('설정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요'); });
  }
  // ── 루틴 묶어 보기 · 순서 (v44) ──
  function setRoutineView(v) {
    if (v !== 'time' && v !== 'kind' && v !== 'manual') return;
    state.routineView = v; render(true);
    if (store && state.uid) store.saveValue(state.uid, 'routineView', v).catch(function () {}); // 저장이 안 돼도 이 기기에서는 바뀐 채로
  }
  /** 내 진행 중인 루틴 키 (지금 order 순서) */
  function myOrderKeys() {
    var today = state.today;
    return routines().filter(function (r) { return r.owner === state.me && (r.end === null || r.end >= today); }).map(function (r) { return r.key; });
  }
  function saveOrder(newKeys, msg) {
    if (!store || !state.me) return;
    var mine = routines().filter(function (r) { return r.owner === state.me; });
    var changes = RT.model.ordersFor(mine, newKeys);
    if (!changes.length) { render(true); return; }
    // 바로 보이게 먼저 화면 값에 넣고 저장 (실패하면 서버 값으로 돌아옴)
    changes.forEach(function (c) { var raw = rawRoutine(c.key); if (raw) raw.order = c.order; });
    render(true);
    Promise.all(changes.map(function (c) { return store.setRoutineOrder(c.key, c.order); }))
      .then(function () { if (msg) showToast(msg); }, function () { showToast('순서를 저장하지 못했어요. 잠시 뒤 다시 해 주세요.'); });
  }
  function moveRoutine(key, dir) { saveOrder(RT.model.moveKey(myOrderKeys(), key, dir)); }

  function setMissNotify(on) {
    if (!store || !state.uid || !state.prefsReady) return;
    var before = state.missNotifyOn;
    state.missNotifyOn = on; render(true);
    store.saveFlag(state.uid, 'missNotify', on).catch(function () { state.missNotifyOn = before; pushFail('설정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요'); });
  }
  function setTodoNotify(on) {
    if (!store || !state.uid || !state.prefsReady) return;
    var before = state.todoNotifyOn;
    state.todoNotifyOn = on; render(true);
    store.saveTodoNotify(state.uid, on).catch(function () { state.todoNotifyOn = before; pushFail('설정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요'); });
  }
  function setPref(patch) {
    if (!store || !state.uid || !state.prefsReady) return;
    savePrefs(Object.assign(currentPrefs(), patch));
  }
  appEl.addEventListener('change', function (ev) {
    if (ev.target.id === 'ava-file') { avaPicked(ev.target.files && ev.target.files[0]); ev.target.value = ''; return; }
    // 언제 할지 시각: 고르면 「알려 주기」 스위치가 나오도록 다시 그린다 (v41)
    if (ev.target.id === 'rt-at' && state.manage && state.manage.form) {
      var af = state.manage.form; af.when = af.when || RT.model.whenEdit(null); af.when.at = ev.target.value; if (!af.when.at) af.when.remind = false; render(true); return;
    }
    // 쉬기 날짜: 고르면 안내(며칠 쉬어요)가 바뀌도록 다시 그린다
    if ((ev.target.id === 'rs-from' || ev.target.id === 'rs-until') && state.manage && state.manage.form && state.manage.form.rest) {
      var rsf = state.manage.form.rest; rsf[ev.target.id === 'rs-from' ? 'fromDate' : 'untilDate'] = ev.target.value; rsf.error = ''; render(true); return;
    }
    // 날짜 · 시간 칸은 고른 순간 값만 담는다 (다시 그리지 않음)
    if (ev.target.id === 'td-date' && state.todoForm) { state.todoForm.date = ev.target.value; return; }
    if (ev.target.id === 'ev-date' && state.eventForm) { state.eventForm.date = ev.target.value; return; }
    if (ev.target.id === 'ev-start' && state.eventForm) { state.eventForm.start = ev.target.value; return; }
    if (ev.target.id === 'ev-end' && state.eventForm) { state.eventForm.end = ev.target.value; return; }
    var mm = /^ev-m([se])-(\d)$/.exec(ev.target.id);
    if (mm && state.eventForm && state.eventForm.move) {
      var mf = state.eventForm.move, mt = mf.spans[Number(mm[2])];
      if (mt) mt[mm[1] === 's' ? 'start' : 'end'] = ev.target.value;
      mf.error = ''; var me0 = document.querySelector('.skipbox .rform__error'); if (me0) me0.remove(); return;
    }
    var xm = /^ev-x([se])-(\d)$/.exec(ev.target.id);
    if (xm && state.eventForm && state.eventForm.more) { var xt = state.eventForm.more[Number(xm[2])]; if (xt) xt[xm[1] === 's' ? 'start' : 'end'] = ev.target.value; return; }
    if ((ev.target.id === 'ev-from' || ev.target.id === 'ev-until') && state.eventForm) {
      // 시작 · 끝나는 주: 고른 주 안내만 바로 바꾼다 (다시 그리지 않음)
      state.eventForm[ev.target.id === 'ev-from' ? 'from' : 'until'] = ev.target.value;
      var note = document.getElementById('ev-from-note');
      if (note) note.textContent = RT.viewPlan.spanNote(state.eventForm);
      if (state.eventForm.error) { state.eventForm.error = ''; var er = document.getElementById('ev-error'); if (er) er.remove(); }
      return;
    }
    var tm = /^ev-t([se])-(\d)$/.exec(ev.target.id);
    if (tm && state.eventForm) { var tf = state.eventForm, tw = Number(tm[2]); tf.times[tw] = tf.times[tw] || { start: tf.start, end: tf.end }; tf.times[tw][tm[1] === 's' ? 'start' : 'end'] = ev.target.value; return; }
    if (ev.target.id !== 'nt-remind') return;
    setPref({ remindAt: ev.target.value || null });
  });

  function signOut() {
    if (!RT.firebase.signOut) return;
    if (RT.themes) RT.themes.forget(); // 다른 사람이 이 기기로 로그인해도 내 색이 남지 않게
    // 로그아웃하면 이 기기로는 알림이 가지 않게 한다
    // (인터넷이 끊겨 있어도 로그아웃이 멈추지 않게 1.5초까지만 기다린다)
    var off = RT.push && RT.push.isOn() && store && state.uid ? RT.push.disable(store, state.uid).catch(function () {}) : Promise.resolve();
    Promise.race([off, new Promise(function (res) { setTimeout(res, 1500); })]).then(function () { RT.firebase.signOut(); });
  }

  // ── 「내 루틴」 ─────────────────────────────────────────
  function rawRoutine(key) { return state.routineDocs.filter(function (r) { return r.key === key; })[0] || null; }
  function setForm(form) { if (!state.manage) return; state.manage = { open: true, form: form }; render(true); }
  function focusName() { var n = document.getElementById('rt-name'); if (n) n.focus({ preventScroll: false }); }
  function closeManage() {
    state.manage = null;
    render(true);
    var back = appEl.querySelector('[data-act="open-manage"]');
    if (back) back.focus({ preventScroll: true });
  }
  function editRoutine(key) {
    var r = rawRoutine(key);
    if (!r || r.owner !== state.me) return;
    setForm({ key: key, name: r.name || '', icon: r.icon || '', start: r.start || D.toKey(state.today), when: RT.model.whenEdit(r.when), kind: r.kind || null });
    focusName();
  }
  function migrateIfNeeded() { return Promise.resolve(); }
  function persist(r, okMsg, fromForm) {
    var f = fromForm ? state.manage && state.manage.form : null;
    if (f) { f.saving = true; f.error = ''; render(true); }
    return migrateIfNeeded().then(function () { return store.saveRoutine(r); }).then(function () {
      if (f && state.manage && state.manage.form === f) state.manage = { open: true, form: null };
      showToast(okMsg);
    }, function () {
      if (f && state.manage && state.manage.form === f) { f.saving = false; f.error = '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.'; f.errorFresh = true; render(true); }
      else showToast('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    });
  }
  function fail(f, msg) { f.error = msg; f.errorFresh = true; f.confirmStart = false; render(true); }
  function saveRoutine() {
    var f = state.manage && state.manage.form;
    if (!store || !f || f.saving || !state.me) return;
    var err = RT.model.validateRoutine(f);
    var old = f.key ? rawRoutine(f.key) : null;
    if (f.key && !old) { setForm(null); showToast('다른 기기에서 지워진 루틴이에요'); return; }
    if (!err && old && old.end && f.start > old.end) err = '시작일이 그만둔 날(' + D.label(D.parse(old.end)) + ')보다 늦어요';
    if (err) { fail(f, err); return; }
    // 시작일을 뒤로 미루면 그 전 기록이 안 보이게 된다 → 한 번 더 확인
    if (old && f.start > old.start && !f.confirmStart) {
      var hidden = Object.keys(state.server).filter(function (id) {
        var p = id.split('|');
        return p[0] === old.key && p[1] >= old.start && p[1] < f.start;
      }).length;
      if (hidden) {
        f.error = '시작일을 바꾸면 그 전 기록 ' + hidden + '개가 그리드에서 안 보여요. 그래도 바꾸려면 한 번 더 눌러 주세요';
        f.errorFresh = true; f.confirmStart = true; render(true); return;
      }
    }
    var nm = names();
    var r = old ? Object.assign({}, old) : { key: RT.store.newKey(), owner: state.me, order: Date.now(), end: null };
    if (old && old.owner !== state.me) return; // 남의 루틴은 못 고친다
    r.name = String(f.name).trim();
    r.icon = f.icon;
    r.start = f.start;
    r.who = nm[state.me] || r.who || '';
    r.when = RT.model.whenSave(f.when); // v41: null = 언제든 (저장할 때 지움)
    r.kind = RT.model.kindSave(f.kind, r.icon); // v44: 아이콘이 정한 종류와 같으면 null (자동)
    persist(r, old ? '루틴을 고쳤어요' : '🌱 새 루틴을 추가했어요', true);
  }
  function stopRoutine() {
    var f = state.manage && state.manage.form;
    var old = f && f.key ? rawRoutine(f.key) : null;
    if (!store || !old || f.saving || old.owner !== state.me) return;
    if (old.start > D.toKey(state.today)) { fail(f, '아직 시작 전인 루틴이에요. 지우려면 삭제를 눌러 주세요'); return; }
    persist(Object.assign({}, old, { end: D.toKey(state.today) }), '오늘까지 하고 그만해요. 기록은 그리드에 남아요', true);
  }
  var resuming = Object.create(null);
  function resumeRoutine(key) {
    var old = rawRoutine(key);
    if (!store || !old || old.owner !== state.me || resuming[key]) return;
    resuming[key] = true;
    persist(Object.assign({}, old, { end: null }), '다시 시작해요! 쉬었던 날은 연속에서 빠져요', false)
      .then(function () { delete resuming[key]; });
  }
  // ── 쉬기 (v38) ──
  function saveRest() {
    var f = state.manage && state.manage.form;
    var old = f && f.key ? rawRoutine(f.key) : null;
    if (!store || !old || !f.rest || f.saving || old.owner !== state.me) return;
    var r = routines().filter(function (x) { return x.key === old.key; })[0];
    if (!r) return;
    var p = RT.model.restPlan(f.rest, r, state.today, !!RT.store.mergeChecks(state.server, state.pending)[old.key + '|' + D.toKey(state.today)]);
    if (p.error) { f.rest.error = p.error; f.rest.errorFresh = true; render(true); return; }
    var msg = p.from === state.today ? '🌿 오늘부터 쉬어요. 쉬는 동안 연속 기록은 그대로예요' : '🌿 ' + D.label(p.from) + '부터 쉬어요';
    persist(Object.assign({}, old, { rest: RT.model.restAdd(old.rest, p.from, p.to) }), msg, true);
  }
  var waking = Object.create(null);
  function wakeRoutine(key) {
    var old = rawRoutine(key);
    if (!store || !old || old.owner !== state.me || waking[key]) return;
    var r = routines().filter(function (x) { return x.key === key; })[0];
    var info = r ? RT.model.restInfo(r, state.today) : null;
    if (!info) return;
    waking[key] = true;
    persist(Object.assign({}, old, { rest: RT.model.restWake(old.rest, state.today) }), info.now ? '💪 오늘부터 다시 시작해요' : '쉬기를 취소했어요', false)
      .then(function () { delete waking[key]; });
  }
  var lastDeleteTap = 0;
  function deleteRoutine() {
    var f = state.manage && state.manage.form;
    var old = f && f.key ? rawRoutine(f.key) : null;
    if (!store || !old || f.saving || old.owner !== state.me) return;
    var now = Date.now();
    if (!f.confirmDelete) { f.confirmDelete = true; lastDeleteTap = now; render(true); return; } // 두 번 눌러야 지운다
    if (now - lastDeleteTap < 400) return; // 두 번 빠르게 누른 건 한 번으로 친다
    f.saving = true; render(true);
    store.deleteRoutine(old.key).then(function () {
      if (state.manage && state.manage.form === f) state.manage = { open: true, form: null };
      showToast('루틴을 지웠어요');
    }, function () {
      if (state.manage && state.manage.form === f) { f.saving = false; fail(f, '지우지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
    });
  }

  // 입력칸: 글자를 칠 때마다 상태에만 담고 화면은 다시 그리지 않는다
  appEl.addEventListener('input', function (ev) {
    var id = ev.target.id;
    if (id === 'ava-zoom' && state.avaCrop) { var ac = state.avaCrop, vw = ac.view / 2; ac.st = RT.avatarCrop.zoomAt(ac.st, (ac.st.min * parseFloat(ev.target.value)) / ac.st.scale, vw, vw, ac.iw, ac.ih, ac.view); avaApply(); return; }
    if (state.diet && state.diet.form && /^dg-(age|height|weight|e-(kcal|protein|fat|carb))$/.test(id)) {
      var dfm = state.diet.form, key = id.slice(3);
      if (key.indexOf('e-') === 0) dfm.edits[key.slice(2)] = ev.target.value; else dfm[key] = ev.target.value;
      dfm.error = '';
      if (key.indexOf('e-') !== 0) dietRefreshReco(); // 추천 칸만 다시 (입력칸은 그대로 — 숫자 입력이 끊기지 않게)
      else dietRefreshNotes(); // 고친 값 입력 중엔 안내 줄만
      return;
    }
    if (state.map && state.map.rank && id === 'mp-wnote') { state.map.rank.note = ev.target.value; return; }
    if (state.map && state.map.find && id === 'mp-q') {
      // 결과 목록만 바꾼다 (입력칸을 다시 그리면 한글 조합이 「나ㅁ」처럼 깨진다 — 점검 AI)
      state.map.find.q = ev.target.value;
      var box = document.getElementById('mp-results'); if (box) box.innerHTML = RT.viewMap.findResults(mapFindModel());
      return;
    }
    if (state.map && state.map.sheet && state.map.sheet.form && (id === 'mp-date' || id === 'mp-note')) {
      state.map.sheet.form[id === 'mp-date' ? 'date' : 'note'] = ev.target.value; state.map.sheet.form.error = ''; return;
    }
    if (id === 'au-email') { state.auth.email = ev.target.value; return; }
    if (id === 'au-pass') { state.auth.password = ev.target.value; return; }
    if (id === 'me-name') { state.setup.name = ev.target.value; return; }
    if (state.todoForm && (id === 'td-title' || id === 'td-date')) {
      state.todoForm[id === 'td-title' ? 'title' : 'date'] = ev.target.value; clearPlanError(state.todoForm, 'td-error');
      var pvt = id === 'td-title' && appEl.querySelector('.upreview .upt__name-txt');
      if (pvt) pvt.textContent = previewShort(state.todoForm);
      var sht = id === 'td-title' && document.getElementById('td-short');
      if (sht) sht.placeholder = '비우면 「' + RT.uni.short(ev.target.value.trim() || '할 일') + '」';
      return;
    }
    if (state.todoForm && id === 'td-memo') {
      state.todoForm.memo = ev.target.value; clearPlanError(state.todoForm, 'td-error');
      var mc = document.getElementById('td-memo-count');
      if (mc) mc.textContent = ev.target.value.length + ' / ' + RT.todos.MEMO_MAX;
      return;
    }
    if (state.todoForm && id === 'td-short') {
      state.todoForm.short = ev.target.value; clearPlanError(state.todoForm, 'td-error');
      var pvs = appEl.querySelector('.upreview .upt__name-txt');
      if (pvs) pvs.textContent = previewShort(state.todoForm);
      return;
    }
    if (id === 'cat-name' && state.catSheet && state.catSheet.edit) { var cf = state.catSheet.edit; cf.name = ev.target.value; clearPlanError(cf, 'cat-error'); var pv = appEl.querySelector('.cpreview__name'); if (pv) pv.textContent = cf.name.trim() || '이름'; return; }
    if (state.eventForm && /^ev-(title|short|date|start|end)$/.test(id)) { state.eventForm[id.slice(3)] = ev.target.value; clearPlanError(state.eventForm, 'ev-error'); return; }
    var f = state.manage && state.manage.form;
    if (!f) return;
    if (ev.target.id === 'rt-name') f.name = ev.target.value;
    else if (ev.target.id === 'rt-start') { f.start = ev.target.value; f.confirmStart = false; }
    else if (ev.target.id === 'rt-cue') { f.when = f.when || RT.model.whenEdit(null); f.when.cue = ev.target.value; }
    else return;
    if (f.error && !f.confirmStart) { f.error = ''; var e = document.getElementById('rt-error'); if (e) e.remove(); }
  });
  function clearPlanError(f, elId) { if (f.error) { f.error = ''; var e = document.getElementById(elId); if (e) e.remove(); } }
  appEl.addEventListener('compositionstart', function () { composing = true; });
  appEl.addEventListener('compositionend', function () { composing = false; });
  // 입력칸에서 나가면 미뤄 둔 화면 갱신을 한다
  appEl.addEventListener('focusout', function (ev) {
    if (INPUT_IDS.indexOf(ev.target.id) < 0) return;
    setTimeout(function () { if (deferred && !typing()) render(); }, 0);
  });

  function sheetIsOpen() {
    return (state.sheetDay !== null || !!state.anniv || !!state.account || !!state.ava || !!state.avaView || !!state.manage || state.notifyOpen || state.themeOpen || state.growOpen || !!state.todoForm || !!state.eventForm || !!state.catSheet || !!state.place || !!state.uniSheet || !!state.archive) && !!appEl.querySelector('.sheet');
  }
  /** 맨 위 시트 하나 닫기 (Esc · 뒤로가기) */
  function closeGrow() { state.growOpen = false; focusAfter = ['[data-act="open-grow"]']; render(true); }
  function closeTopSheet() {
    if (state.avaCrop) { avaCancel(); return; }
    if (state.avaView) { closeAvaView(); return; }
    if (state.ava) { closeAva(); return; }
    if (state.account) { closeAccount(); return; }
    if (state.diet) {
      if (state.diet.basis) { state.diet.basis = null; focusAfter = ['[data-act="dg-basis"]']; focusInSheet = true; render(true); }
      else if (state.diet.view === 'goal' && myGoal()) { state.diet.view = 'home'; state.diet.form = null; render(true); }
      else closeDiet();
      return;
    }
    if (state.map) {
      if (state.map.rank) closeRank();
      else if (state.map.find) closeFind();
      else if (state.map.sheet && ((state.map.sheet.mode === 'visit' && state.map.sheet.back) || state.map.sheet.mode === 'edit')) { state.map.sheet = { mode: 'view' }; render(true); }
      else if (state.map.sel) mapUnsel();
      else closeMap();
      return;
    }
    if (state.anniv) { if (state.anniv.edit && state.couple && RT.anniv.fromDoc(state.couple)) { state.anniv.edit = null; render(true); } else closeAnniv(); return; }
    if (state.growOpen) { closeGrow(); return; }
    if (state.place) { if (state.place.ask) { state.place.ask = null; render(true); } else closePlace(); return; }
    if (state.todoForm || state.eventForm || state.catSheet) { /* 아래로 */ }
    else if (state.uniSheet) { closeUniSheet(); return; }
    else if (state.archive) { closeArchive(); return; }
    if (state.catSheet) { if (state.catSheet.edit) { state.catSheet.edit = null; render(true); } else closeCats(); }
    else if (state.todoForm || state.eventForm) closePlanSheet();
    else if (state.notifyOpen) closeNotify();
    else if (state.themeOpen) closeTheme();
    else if (state.manage) closeManage();
    else closeSheet();
  }

  // ── 뒤로가기: 바로 나가지 않게 ──
  // 첫 화면 위에 「지킴이」 기록을 하나 얹어 둔다. 뒤로가기를 누르면 그 기록만 빠지고(popstate),
  //  시트가 열려 있으면 시트를 닫고 지킴이를 다시 얹는다 / 아니면 「나갈까요?」를 묻는다.
  //  묻는 동안엔 지킴이가 없어서 한 번 더 누르면 그대로 나간다.
  // 크롬은 손대기 전에 얹은 기록을 뒤로가기에서 건너뛸 수 있어서, 처음 화면을 누를 때 얹는다.
  var guardOn = false, exitEl = null, exitTimer = null;
  function pushGuard() {
    if (guardOn) return;
    try { root.history.pushState({ dj: 'guard' }, ''); guardOn = true; } catch (e) { /* 기록을 못 남기면 그냥 둔다 */ }
  }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, function () { if (!exitEl) pushGuard(); }, true); });
  function hideExit(stay) {
    if (!exitEl) return;
    exitEl.remove(); exitEl = null; document.body.classList.remove('has-exit');
    if (stay) pushGuard();
  }
  function askExit() {
    if (exitEl) return;
    exitEl = document.createElement('div');
    exitEl.className = 'exit-layer';
    exitEl.innerHTML = '<button type="button" class="scrim" data-exit="stay" aria-label="머무르기"></button>' +
      '<section class="exit-box" role="alertdialog" aria-modal="true" aria-labelledby="exit-title" aria-describedby="exit-sub">' +
      '<h2 id="exit-title" class="exit-box__title">단짝꿍을 나갈까요?</h2>' +
      '<p id="exit-sub" class="exit-box__sub">뒤로를 한 번 더 눌러도 나가요</p>' +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-exit="stay">머무르기</button>' +
      '<button type="button" class="solid-btn" data-exit="leave">나가기</button></div></section>';
    exitEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-exit]');
      if (!b) return;
      if (b.getAttribute('data-exit') === 'stay') { hideExit(true); return; }
      hideExit(false);
      try { root.history.back(); } catch (e) {}
      // 홈 화면 앱처럼 더 돌아갈 곳이 없으면 창 닫기를 해 보고, 그래도 남아 있으면 안내 후 다시 지킨다
      setTimeout(function () {
        try { root.close(); } catch (e) {}
        setTimeout(function () {
          if (document.hidden) return;
          showToast('뒤로를 한 번 더 누르면 나가요');
          clearTimeout(exitTimer); exitTimer = setTimeout(function () { if (!document.hidden && !exitEl) pushGuard(); }, 3000);
        }, 300);
      }, 300);
    });
    exitEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); hideExit(true); }
      if (ev.key === 'Tab') { // 포커스는 두 버튼 안에서만
        var bs = exitEl.querySelectorAll('.exit-box button'), first = bs[0], last = bs[bs.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    });
    document.body.appendChild(exitEl);
    document.body.classList.add('has-exit');
    var stayBtn = exitEl.querySelector('.ghost-btn'); if (stayBtn) stayBtn.focus({ preventScroll: true });
  }
  root.addEventListener('popstate', function (ev) {
    if (ev.state && ev.state.dj === 'guard') { guardOn = true; return; } // 앞으로 가기로 지킴이에 돌아옴
    guardOn = false;
    clearTimeout(exitTimer);
    if (exitEl) return;
    if (sheetIsOpen() || state.map || state.diet) { closeTopSheet(); pushGuard(); return; } // 지도 화면도 뒤로 = 「전체」로
    askExit();
  });

  appEl.addEventListener('keydown', function (ev) {
    if ((state.sheetDay === null && !state.anniv && !state.account && !state.ava && !state.avaView && !(state.map && (state.map.sel || state.map.find || state.map.rank)) && !(state.diet && (state.diet.form || state.diet.basis)) && !state.manage && !state.notifyOpen && !state.themeOpen && !state.growOpen && !state.todoForm && !state.eventForm && !state.catSheet && !state.place && !state.uniSheet && !state.archive) || !appEl.querySelector('.sheet')) return;
    if (placeKey(ev)) return;
    if (ev.key === 'Enter' && ev.target.id === 'cat-name' && !ev.isComposing && !composing) { ev.preventDefault(); ev.target.blur(); saveCat(); return; }
    if (ev.key === 'Escape') { ev.preventDefault(); closeTopSheet(); return; }
    if (ev.key === 'Enter' && ev.target.id === 'rt-name' && !ev.isComposing && !composing) { ev.preventDefault(); ev.target.blur(); saveRoutine(); return; }
    if (ev.key === 'Tab') {
      // 시트가 열려 있으면 포커스를 시트 안에서만 돈다
      var layers = appEl.querySelectorAll('.sheet-layer'), top = layers.length ? layers[layers.length - 1] : appEl; // 겹친 시트는 맨 위 것만 (점검 AI)
      var items = Array.prototype.slice.call(top.querySelectorAll('.sheet button:not([disabled]), .sheet input, .sheet select:not([disabled])'));
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      var inside = items.indexOf(document.activeElement) >= 0;
      if (!inside) { ev.preventDefault(); (ev.shiftKey ? last : first).focus(); }
      else if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  // 자정이 지나면 오늘 날짜를 바꿔 다시 그린다 (폰을 다시 켰을 때도)
  var lastMinute = -1;
  function checkToday() {
    var d = new Date(), now = D.fromLocal(d), minute = d.getHours() * 60 + d.getMinutes();
    if (now !== state.today) {
      var old = state.today;
      if (state.sched) {
        if (state.sched.day === old) state.sched.day = now;
        if (state.sched.weekStart === RT.schedule.monStart(old)) state.sched.weekStart = RT.schedule.monStart(now);
      }
      state.today = now; state.grow.key = null; watchKungs(); render();
    }
    else if (state.tab === 'schedule' && state.sched && state.sched.mode === 'day' && minute !== lastMinute && !state.eventForm) render();
    lastMinute = minute;
  }
  setInterval(checkToday, 30000);
  document.addEventListener('visibilitychange', function () {
    if (visible()) { checkToday(); runCatchUp(); }
    else if (checksDefinitive && state.me) lsSet(LS_SEEN, new Date().toISOString()); // 화면을 떠날 때 '여기까지 봤음'
  });
  root.addEventListener('focus', checkToday);
  if (root.navigator.serviceWorker && root.navigator.serviceWorker.addEventListener) {
    root.navigator.serviceWorker.addEventListener('message', function (ev) {
      var d = ev.data || {}, q = /[?&]tab=(routine|schedule|todo|look|all)/.exec(String(d.link || ''));
      if (d.type === 'open' && q && state.status === 'ready') { if (q[1] === 'look') resetReview(); setTab(q[1]); if (q[1] === 'look') render(true); }
    });
  }
  root.addEventListener('pageshow', checkToday);

  render();

  // ── 로그인 ─────────────────────────────────────────────
  function authFail(msg) { state.auth.busy = false; state.auth.error = msg; state.auth.errorFresh = true; render(true); }
  // 로그인 · 이름 칸은 진짜 <form>: 엔터 · 비밀번호 자동 완성 · 저장이 되게 하고, 값은 제출할 때 화면에서 읽는다
  appEl.addEventListener('submit', function (ev) {
    var form = ev.target.closest('[data-form]');
    if (!form) return;
    ev.preventDefault();
    if (composing) return;
    var get = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var focused = document.activeElement;
    var values = { email: get('au-email'), password: get('au-pass'), name: get('me-name') };
    // 입력칸에서 나가야 화면이 다시 그려진다 (입력 중에는 다시 그리지 않으므로)
    if (focused && focused.blur && appEl.contains(focused)) focused.blur();
    if (form.getAttribute('data-form') === 'auth') { state.auth.email = values.email; state.auth.password = values.password; submitAuth(); }
    else if (form.getAttribute('data-form') === 'setup') { state.setup.name = values.name; submitSetup(); }
    else if (form.getAttribute('data-form') === 'todo' && state.todoForm) {
      state.todoForm.title = get('td-title'); if (document.getElementById('td-date')) state.todoForm.date = get('td-date');
      if (document.getElementById('td-short')) state.todoForm.short = get('td-short');
      if (document.getElementById('td-memo')) state.todoForm.memo = get('td-memo'); saveTodo();
    }
    else if (form.getAttribute('data-form') === 'event' && state.eventForm) {
      var ef = state.eventForm; ef.title = get('ev-title'); if (document.getElementById('ev-short')) ef.short = get('ev-short');
      if (document.getElementById('ev-start')) { ef.start = get('ev-start'); ef.end = get('ev-end'); }
      for (var w7 = 0; w7 < 7; w7++) if (document.getElementById('ev-ts-' + w7)) ef.times[w7] = { start: get('ev-ts-' + w7), end: get('ev-te-' + w7) };
      (ef.more || []).forEach(function (t, i) { if (document.getElementById('ev-xs-' + i)) { t.start = get('ev-xs-' + i); t.end = get('ev-xe-' + i); } });
      if (document.getElementById('ev-from')) ef.from = get('ev-from');
      if (document.getElementById('ev-until')) ef.until = get('ev-until');
      if (document.getElementById('ev-date')) ef.date = get('ev-date'); saveEvent();
    }
  });

  function submitAuth() {
    var a = state.auth;
    if (a.busy) return;
    var email = String(a.email || '').trim();
    if (!email) return authFail('이메일을 적어 주세요');
    a.busy = true; a.error = ''; a.info = ''; render(true);
    var F = RT.firebase;
    var job = a.mode === 'reset' ? F.reset(email) : a.mode === 'signup' ? F.signUp(email, a.password) : F.signIn(email, a.password);
    job.then(function () {
      a.busy = false;
      if (a.mode === 'reset') { a.mode = 'login'; a.info = '메일을 보냈어요. 메일의 링크로 비밀번호를 바꾼 뒤 로그인해 주세요.'; }
      a.password = '';
      if (a.mode === 'signup') a.mode = 'login';
      render(true);
    }, function (e) { authFail(F.errorText(e)); });
  }
  function submitSetup() {
    var s = state.setup;
    if (s.busy || !store || !state.uid) return;
    var name = String(s.name || '').trim();
    if (!name) { s.error = '이름을 적어 주세요'; s.errorFresh = true; render(true); return; }
    if (name.length > 10) { s.error = '이름은 10자까지 쓸 수 있어요'; s.errorFresh = true; render(true); return; }
    s.busy = true; s.error = ''; render(true);
    store.saveMember(state.uid, name).then(function () { s.busy = false; showToast('🌱 ' + name + ' 님, 환영해요!'); }, function () {
      // (이미 이름이 있는데 서버 확인 전에 이 화면이 뜬 경우도 여기로 온다 → 초대 거절로 보지 않는다)
      s.busy = false; s.error = '저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'; s.errorFresh = true; render(true);
    });
  }

  // ── 이메일 인증 ──
  function checkVerified() {
    var v = state.verify;
    if (v.busy) return;
    v.busy = true; v.error = ''; v.info = ''; render(true);
    RT.firebase.checkVerified().then(function (ok) {
      v.busy = false;
      if (!ok) { v.error = '아직 인증되지 않았어요. 메일의 링크를 눌렀는지 확인해 주세요'; v.errorFresh = true; render(true); return; }
      startSession();
    }, function (e) { v.busy = false; v.error = RT.firebase.errorText(e); v.errorFresh = true; render(true); });
  }
  function resendVerification() {
    var v = state.verify;
    RT.firebase.sendVerification().then(function () { v.info = '인증 메일을 다시 보냈어요'; v.error = ''; render(true); },
      function (e) { v.error = e && e.code === 'auth/too-many-requests' ? '메일을 너무 자주 보냈어요. 조금 뒤 다시 해 주세요' : RT.firebase.errorText(e); v.errorFresh = true; render(true); });
  }

  // ── 저장소 연결 (끊기면 몇 번까지 다시 붙는다) ─────────────
  var subs = [];
  var retries = 0;
  var kungUnsub = null;
  function watchKungs() {
    if (kungUnsub) { try { kungUnsub(); } catch (e) {} kungUnsub = null; }
    if (!store || !state.uid) return;
    state.kungs = [];
    kungUnsub = store.watchKungs(D.toKey(state.today), function (list) { state.kungs = list; state.kungOff = false; if (state.status === 'ready') render(); },
      function () { state.kungOff = true; state.kungs = []; if (state.status === 'ready') render(); }); // 규칙이 아직 없어도 기록 화면은 그대로 둔다 (lost로 보내지 않음)
  }
  function unsubscribe() { subs.forEach(function (u) { try { u(); } catch (e) {} }); subs = []; if (kungUnsub) { try { kungUnsub(); } catch (e) {} kungUnsub = null; } }
  function subscribe() {
    unsubscribe();
    subs = [
      store.watchMembers(function (members, fromCache) {
        state.members = members; gotMembers = true;
        if (!fromCache) membersFromServer = true;
        resolveIdentity(); ready();
      }, lost),
      store.watchRoutines(function (list) { state.routineDocs = list; gotRoutines = true; ready(); }, lost),
      // 내 알림 설정 — 아직 규칙이 없거나 막혀도 기록 화면은 그대로 둔다 (lost로 보내지 않음)
      store.watchUser(state.uid, function (doc, fromCache) {
        state.prefs = doc && doc.notify ? doc.notify : null;
        state.weeklyOn = !(doc && doc.weekly === false);
        state.todoNotifyOn = !(doc && doc.todoNotify === false);
        state.missNotifyOn = !(doc && doc.missNotify === false);
        if (doc && (doc.routineView === 'time' || doc.routineView === 'kind' || doc.routineView === 'manual')) state.routineView = doc.routineView;
        var colors = RT.themes ? RT.themes.cleanColors(doc && doc.colors) : {};
        var colorsChanged = JSON.stringify(colors) !== JSON.stringify(state.colors);
        state.colors = colors;
        if (!fromCache) { state.prefsReady = true; state.prefsError = false; }
        if (state.notifyOpen || (colorsChanged && state.status === 'ready')) render();
      }, function () { state.prefsReady = false; state.prefsError = true; if (state.notifyOpen) render(); }),
      store.watchTodos(function (list) { state.todoDocs = list; state.todoErr = ''; if (state.status === 'ready') render(); },
        function () { state.todoErr = '잠시 뒤 다시 열어 주세요. 계속되면 저장 규칙을 확인해야 해요.'; render(); }, RT.todos.dayStartIso(state.today)),
      store.watchEvents(function (list) { state.eventDocs = list; state.eventErr = ''; if (state.status === 'ready') render(); },
        function () { state.eventErr = '잠시 뒤 다시 열어 주세요. 계속되면 저장 규칙을 확인해야 해요.'; render(); }),
      // 카테고리 — 아직 규칙이 없거나 막혀도 기본 6개로 보이게 둔다 (lost로 보내지 않음)
      // 우리 기념일 (v46) — 규칙이 아직 없거나 막히면 기념일 칸만 숨긴다
      // 프로필 사진 (v51) — 둘 다 읽음. 규칙이 아직 없으면 테마 색 동그라미 그대로
      store.watchAvatars(function (d) { state.avaDocs = d; if (state.status === 'ready') render(); }, function () { state.avaDocs = {}; }),
      store.watchCouple(function (doc) { state.couple = doc; state.coupleOff = false; state.coupleLoaded = true; if (state.status === 'ready') render(); },
        function () { state.coupleOff = true; state.couple = null; if (state.status === 'ready') render(); }),
      store.watchCats(function (list) { state.catDocs = list; state.catErr = false; if (state.status === 'ready') render(); },
        function () { state.catErr = true; if (state.catSheet) render(); }),
      store.watchChecks(function (map, meta, changes, first, fromCache) {
        state.server = map; state.meta = meta; gotChecks = true;
        if (!fromCache) { checksDefinitive = true; retries = 0; }
        announceLive(changes);
        runCatchUpOnce();
        ready();
      }, lost)
    ];
    watchKungs();
  }
  var caughtUpOnce = false;
  function runCatchUpOnce() { if (!caughtUpOnce && checksDefinitive && state.me) { caughtUpOnce = true; runCatchUp(); } }
  function ready() {
    if (state.status === 'denied' || !state.uid) return render();
    var before = state.status;
    if (gotMembers && gotChecks && gotRoutines) {
      if (state.me) state.status = 'ready';
      else if (membersFromServer) state.status = 'setup';   // 캐시만 보고 이름 화면을 띄우지 않는다
    }
    render(state.status !== before); // 화면이 바뀌는 순간은 입력 중이어도 그린다
  }
  var reconnecting = false, reconnectTimer = null;
  function lost(e) {
    var code = e && e.code;
    if (code === 'permission-denied' || code === 'unauthenticated') { unsubscribe(); state.status = 'denied'; render(true); return; }
    if (reconnecting) return; // 여러 구독이 같이 끊겨도 한 번만 처리
    if (state.status !== 'ready' || retries >= 3) { state.status = 'nodb'; render(); return; }
    reconnecting = true;
    retries++;
    showToast('연결이 잠시 끊겼어요. 다시 연결하는 중이에요.');
    reconnectTimer = setTimeout(function () { reconnecting = false; reconnectTimer = null; if (state.uid) subscribe(); }, 2000 * retries);
  }

  function resetSession() {
    unsubscribe();
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    reconnecting = false; retries = 0; membersFromServer = false;
    gotMembers = gotChecks = gotRoutines = false;
    checksDefinitive = false; caughtUpOnce = false;
    state.members = {}; state.routineDocs = []; state.server = {}; state.meta = {}; state.pending = {};
    state.me = null; state.sheetDay = null; state.manage = null;
    state.notifyOpen = false; state.themeOpen = false; state.prefs = null; state.prefsReady = false; state.colors = null;
    state.todoDocs = []; state.eventDocs = []; state.todoErr = ''; state.eventErr = ''; state.todoForm = null; state.eventForm = null; state.sched = null;
    state.catDocs = []; state.catErr = false; state.catSheet = null;
    state.couple = null; state.coupleOff = false; state.anniv = null; stopMap(); state.placeDocs = null; state.placesOff = false; state.placesLoading = false; stopDiet(); state.ava = null; state.avaView = null; dropCrop(); state.avaDocs = {}; state.goalDocs = null; state.goalsOff = false; state.goalsLoading = false; state.privDoc = null;
    state.place = null; state.uniSheet = null; state.archive = null; state.uni.who = null; state.uni.flash = null;
  }

  function startSession() {
    state.status = 'loading';
    render(true);
    subscribe();
    // 알림을 켜 둔 기기면 주소가 바뀌었는지 확인한다
    if (RT.push && store && state.uid) RT.push.refresh(store, state.uid);
  }

  if (!RT.firebase || !RT.firebase.configured) {
    state.status = 'unconfigured';
    render(true);
  } else {
    store = RT.store.createStore(RT.firebase.db, { metadataChanges: true });
    RT.firebase.onAuth(function (user) {
      resetSession();
      if (!user) {
        // 로그아웃하면 로그인 칸으로 (방금 쓴 이메일은 남겨 둔다)
        state.auth = { mode: 'login', email: state.email || state.auth.email || '', password: '', error: '', busy: false, info: '' };
        state.uid = null; state.email = '';
        state.status = 'login';
        render(true);
        return;
      }
      state.uid = user.uid; state.email = user.email || '';
      state.setup = { name: '', error: '', busy: false };
      if (!user.emailVerified) {
        // 이메일 인증 전에는 기록을 열지 않는다 (규칙도 막는다)
        state.verify = { error: '', info: '', busy: false };
        state.status = 'verify';
        render(true);
        return;
      }
      startSession();
    });
  }
})(window);
