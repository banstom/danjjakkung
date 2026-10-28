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
    tab: 'routine',      // 아래 탭: routine | schedule | todo
    todoDocs: [], todoErr: '', eventDocs: [], eventErr: '',
    todoUi: { expanded: {}, showDone: {} },  // 묶음마다 「더 보기」 · 「완료 보기」
    todoForm: null,      // 할 일 추가 · 고치기 시트
    eventForm: null,     // 일정 추가 · 고치기 · 보기 시트
    sched: null,         // { mode: 'week' | 'day', weekStart, day }
    notifyOpen: false,   // 「알림」 시트
    themeOpen: false,    // 「테마」 시트
    colors: null,        // 내 계정의 나 · 상대 색 (users 문서의 colors, 테마마다) — null = 아직 모름
    prefs: null,         // 내 알림 설정 { partner, remindAt, hide } (users/<uid>.notify)
    prefsReady: false,
    push: { busy: false, error: '', info: '' },
    toast: ''
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
      today: state.today, filter: state.filter, page: state.page, sheetDay: state.sheetDay
    });
  }

  // 입력칸에서 글자를 치는 동안에는 다시 그리지 않는다 (폰 키보드가 닫히거나 한글 조합이 깨지지 않게)
  var composing = false, deferred = false;
  var INPUT_IDS = ['rt-name', 'rt-start', 'au-email', 'au-pass', 'me-name', 'nt-remind', 'td-title', 'td-date', 'ev-title', 'ev-short', 'ev-date', 'ev-start', 'ev-end'];
  for (var iw = 0; iw < 7; iw++) INPUT_IDS.push('ev-ts-' + iw, 'ev-te-' + iw); // 요일마다 시간
  var LS_TAB = 'danjjakkung.tab';
  (function () {
    var q = /[?&]tab=(routine|schedule|todo)/.exec(root.location.search || '');
    var t = q ? q[1] : lsGet(LS_TAB);
    if (t === 'schedule' || t === 'todo' || t === 'routine') state.tab = t;
    if (q) { lsSet(LS_TAB, t); try { root.history.replaceState(null, '', root.location.pathname); } catch (e) {} }
  })();
  function typing() {
    var el = document.activeElement;
    return !!el && INPUT_IDS.indexOf(el.id) >= 0 && appEl.contains(el);
  }
  function render(force) {
    if (!force && (composing || typing())) { deferred = true; return; }
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
    if (state.status !== 'ready') { state.notifyOpen = false; state.themeOpen = false; state.todoForm = null; state.eventForm = null; }
    if (state.todoForm && state.todoForm.id && !findTodo(state.todoForm.id) && !state.todoForm.saving) { state.todoForm = null; setTimeout(function () { showToast('다른 기기에서 지워진 할 일이에요'); }, 0); }
    if (state.eventForm && state.eventForm.id && !findEvent(state.eventForm.id) && !state.eventForm.saving) { state.eventForm = null; setTimeout(function () { showToast('다른 기기에서 지워진 일정이에요'); }, 0); }
    var other = state.tab !== 'routine';
    var plan = state.status === 'ready' ? planHtml(other) : {};
    var sheetOpen = !!(((!other && (m.sheet || m.manage)) || state.notifyOpen || state.themeOpen || plan.sheet) && state.status === 'ready');
    var entering = state.sheetEntering;
    m.header.canSignOut = state.status === 'ready';
    m.header.bell = state.status === 'ready' && RT.push && root.DANJJAKKUNG_PUSH_READY ? (RT.push.isOn() ? 'on' : 'off') : null;
    m.header.palette = state.status === 'ready' && RT.themes ? RT.themes.byId(RT.themes.current()).name : null;
    if (state.status !== 'ready') m.header.meName = '';
    appEl.innerHTML = RT.view.page(state.status, m, state.toast, { sheetEntering: entering, auth: state.auth, setup: state.setup, verify: state.verify, email: state.email, web: true, notify: state.notifyOpen ? notifyModel() : null, theme: state.themeOpen && !state.notifyOpen ? themeModel() : null,
      tab: state.tab, tabHtml: plan.tab, sheetHtml: plan.sheet, tabbarHtml: state.status === 'ready' ? RT.viewPlan.tabbar(state.tab) : '' });
    document.body.classList.toggle('has-tabbar', state.status === 'ready');
    state.push.errorFresh = false;
    if (state.todoForm) state.todoForm.errorFresh = false;
    if (state.eventForm) state.eventForm.errorFresh = false;
    state.sheetEntering = false;
    state.auth.errorFresh = false; state.setup.errorFresh = false; state.verify.errorFresh = false;
    setThemeColor();
    syncPeopleColors();
    if (state.manage && state.manage.form) state.manage.form.errorFresh = false;
    var newSheet = appEl.querySelector('.sheet');
    if (newSheet && scrollTop && !entering) newSheet.scrollTop = scrollTop;
    document.body.classList.toggle('has-sheet', sheetOpen);
    restoreFocus(focus, sheetOpen);
    if (focusAfter && !sheetOpen) {
      // 시트가 닫히거나 줄이 접혀 사라졌을 때 포커스를 근처 버튼으로 옮긴다
      for (var fi = 0; fi < focusAfter.length; fi++) { var fe = appEl.querySelector(focusAfter[fi]); if (fe) { fe.focus({ preventScroll: true }); break; } }
      focusAfter = null;
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

  // 다시 그려도 누르던 버튼에 포커스가 남도록
  var FOCUS_ATTR = { toggle: 'data-key', day: 'data-day', filter: 'data-id', page: 'data-dir', close: null,
    'pick-icon': 'data-icon', 'edit-routine': 'data-key', 'resume-routine': 'data-key', 'save-routine': null, 'cancel-form': null,
    'new-routine': null, 'stop-routine': null, 'delete-routine': null, 'close-manage': null, 'open-manage': null,
    'open-notify': null, 'close-notify': null, 'open-theme': null, 'close-theme': null, 'pick-theme': 'data-v', 'pick-color': 'data-key', 'reset-colors': null, 'push-on': null, 'push-off': null, 'push-test': null, 'pref-partner': null, 'pref-hide': null,
    tab: 'data-tab', 'todo-toggle': 'data-id', 'todo-edit': 'data-id', 'todo-more': 'data-key', 'todo-donelist': 'data-key', 'todo-add': 'data-key',
    'todo-due': 'data-v', 'todo-cancel': null, 'todo-delete': null, 'sched-mode': 'data-mode', 'sched-day': 'data-day', 'sched-open-day': null, 'sched-week': 'data-dir',
    'sched-thisweek': null, 'event-add': null, 'event-open': 'data-at', 'event-edit': null, 'event-cancel': null, 'event-delete': null, 'ev-skip': 'data-v', 'ev-unskip': 'data-v',
    'ev-owner': 'data-v', 'ev-repeat': 'data-v', 'ev-wd': 'data-v', 'ev-timemode': 'data-v', 'ev-cat': 'data-v' };
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
        appEl.querySelector('.sheet [data-act="push-on"]:not([disabled])') ||
        appEl.querySelector('.sheet [data-act="event-edit"]') || appEl.querySelector('.sheet [type="submit"]:not([disabled])') ||
        appEl.querySelector('.sheet [data-act="save-routine"]:not([disabled])') || appEl.querySelector('.sheet [data-act="new-routine"]') || appEl.querySelector('.sheet .tpick.is-on') || appEl.querySelector('.sheet .close-btn');
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

  appEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true' || !appEl.contains(btn)) return;
    var act = btn.getAttribute('data-act');
    if (act === 'filter') { state.filter = btn.getAttribute('data-id'); state.page = 0; render(); }
    else if (act === 'page') { state.page = state.page + Number(btn.getAttribute('data-dir')); render(); }
    else if (act === 'this-month') { state.page = 0; render(); var cur = appEl.querySelector('.cell.is-today') || appEl.querySelector('[data-act="page"]:not([disabled])'); if (cur) cur.focus({ preventScroll: true }); }
    else if (act === 'day') openSheet(Number(btn.getAttribute('data-day')));
    else if (act === 'toggle') toggle(btn.getAttribute('data-key'));
    else if (act === 'close') closeSheet();
    else if (act === 'auth-mode') { state.auth.mode = btn.getAttribute('data-id'); state.auth.error = ''; state.auth.info = ''; render(true); }
    else if (act === 'sign-out') signOut();
    else if (act === 'retry') { retries = 0; state.status = 'loading'; render(true); subscribe(); }
    else if (act === 'verify-check') checkVerified();
    else if (act === 'verify-resend') resendVerification();
    else if (act === 'open-manage') { state.sheetDay = null; state.manage = { open: true, form: null }; state.sheetEntering = true; render(); }
    else if (act === 'close-manage') closeManage();
    else if (act === 'new-routine') { setForm({ key: null, name: '', icon: '', start: D.toKey(state.today) }); focusName(); }
    else if (act === 'edit-routine') editRoutine(btn.getAttribute('data-key'));
    else if (act === 'cancel-form') { setForm(null); }
    else if (act === 'pick-icon') { if (state.manage && state.manage.form) { state.manage.form.icon = btn.getAttribute('data-icon'); state.manage.form.error = ''; render(true); } }
    else if (act === 'save-routine') saveRoutine();
    else if (act === 'stop-routine') stopRoutine();
    else if (act === 'resume-routine') resumeRoutine(btn.getAttribute('data-key'));
    else if (act === 'delete-routine') deleteRoutine();
    else if (act === 'tab') setTab(btn.getAttribute('data-tab'));
    else if (act === 'todo-toggle') toggleTodo(btn.getAttribute('data-id'));
    else if (act === 'todo-edit') editTodo(btn.getAttribute('data-id'));
    else if (act === 'todo-add') addTodo(btn.getAttribute('data-key'));
    else if (act === 'todo-more') { var km = btn.getAttribute('data-key'); state.todoUi.expanded[km] = !state.todoUi.expanded[km]; render(true); }
    else if (act === 'todo-donelist') { var kd = btn.getAttribute('data-key'); state.todoUi.showDone[kd] = !state.todoUi.showDone[kd]; render(true); }
    else if (act === 'todo-due') { if (state.todoForm) { state.todoForm.choice = btn.getAttribute('data-v'); state.todoForm.error = ''; render(true); } }
    else if (act === 'todo-cancel') closePlanSheet();
    else if (act === 'todo-delete') deleteTodo();
    else if (act === 'sched-mode') { schedState().mode = btn.getAttribute('data-mode'); render(true); }
    else if (act === 'sched-day' && schedState().mode === 'week') { schedState().pick = Number(btn.getAttribute('data-day')); render(true); } // 주 보기: 아래 목록만 바꾼다
    else if (act === 'sched-day' || act === 'sched-open-day') {
      var sd = Number(btn.getAttribute('data-day')); schedState().day = sd; schedState().weekStart = RT.schedule.monStart(sd); schedState().mode = 'day';
      if (act === 'sched-open-day') focusAfter = ['.sstrip__btn[data-day="' + sd + '"]']; // 「크게 보기」 버튼이 사라지므로 그날 요일 버튼으로
      render(true);
    }
    else if (act === 'sched-week') { schedState().weekStart += 7 * Number(btn.getAttribute('data-dir')); render(true); }
    else if (act === 'sched-thisweek') { schedState().weekStart = RT.schedule.monStart(state.today); render(true); }
    else if (act === 'event-add') addEvent();
    else if (act === 'event-open') openEvent(btn.getAttribute('data-id'), false, btn.getAttribute('data-at'), btn.getAttribute('data-day'));
    else if (act === 'event-edit') { if (state.eventForm && state.eventForm.mode === 'view') openEvent(state.eventForm.id, true, null, state.eventForm.occDay); }
    else if (act === 'ev-skip') skipEvent(btn.getAttribute('data-v'), true);
    else if (act === 'ev-unskip') skipEvent(btn.getAttribute('data-v'), false);
    else if (act === 'event-cancel') closePlanSheet();
    else if (act === 'event-delete') deleteEvent();
    else if (act === 'ev-owner' || act === 'ev-repeat' || act === 'ev-wd' || act === 'ev-timemode' || act === 'ev-cat') setEventField(act, btn.getAttribute('data-v'));
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
  });

  // ── 아래 탭 · 할 일 · 시간표 ─────────────────────────────
  function setTab(t) {
    if (['routine', 'schedule', 'todo'].indexOf(t) < 0 || t === state.tab) return;
    state.tab = t; lsSet(LS_TAB, t);
    state.sheetDay = null; state.manage = null; state.todoForm = null; state.eventForm = null;
    render(true);
    try { root.scrollTo(0, 0); } catch (e) {}
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
  function eventList() { return RT.schedule.fromDocs(state.eventDocs); }

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
      return { id: t.id, title: t.title, done: t.done, slot: tog ? 'both' : (slotOf[t.scope] || 'me'), canCheck: canCheck, canEdit: canCheck,
        lockText: nameOf(t.scope) + ' 님만 체크할 수 있어요', meta: bits.join(' · '), over: !t.done && TD.bucket(t, today) === 'overdue' };
    }
    function sec(key, items) {
      var s = TD.section(items, today, { expanded: state.todoUi.expanded[key], showDone: state.todoUi.showDone[key] });
      return { key: key, open: s.open.map(rowOf), done: s.done.map(rowOf), moreCount: s.moreCount, canCollapse: s.canCollapse,
        doneCount: s.doneCount, showDone: !!state.todoUi.showDone[key], count: '남은 ' + s.openCount + (s.doneCount ? ' · 완료 ' + s.doneCount : '') };
    }
    return {
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
    if (state.tab === 'todo' && other) out.tab = V.todoTab(todoModel());
    if (state.tab === 'schedule' && other) out.tab = V.scheduleTab(scheduleModel());
    if (state.todoForm) out.sheet = V.todoSheet(state.todoForm, state.sheetEntering);
    else if (state.eventForm) out.sheet = V.eventSheet(Object.assign({}, state.eventForm, { skipInfo: skipInfo(state.eventForm) }), state.sheetEntering);
    return out;
  }
  function openPlanSheet(kind, form) {
    state.sheetDay = null; state.manage = null; state.notifyOpen = false; state.themeOpen = false;
    state.todoForm = kind === 'todo' ? form : null; state.eventForm = kind === 'event' ? form : null;
    state.sheetEntering = true; render(true);
  }
  var planReturn = null; // 시트를 닫으면 포커스를 돌려줄 버튼
  function closePlanSheet(fallback) {
    state.todoForm = null; state.eventForm = null;
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
    openPlanSheet('todo', { mode: 'add', scope: key === 'together' ? 'together' : state.me, title: '', choice: 'none', date: D.toKey(state.today), error: '' });
  }
  function editTodo(id) {
    var t = findTodo(id);
    if (!t || !(t.scope === 'together' || t.scope === state.me)) return;
    planReturn = '[data-act="todo-edit"][data-id="' + CSS.escape(id) + '"]';
    openPlanSheet('todo', { mode: 'edit', id: id, scope: t.scope, title: t.title, choice: RT.todos.choiceOf(t.due, state.today), date: t.due || D.toKey(state.today), error: '' });
  }
  function saveTodo() {
    var f = state.todoForm;
    if (!store || !f || f.saving || !state.me) return;
    var err = RT.todos.validate(f);
    if (err) return planFail(f, err);
    var old = f.id ? findTodo(f.id) : null;
    if (f.id && !old) { closePlanSheet(); showToast('다른 기기에서 지워진 할 일이에요'); return; }
    var due = RT.todos.dueFrom(f.choice, state.today, f.date);
    var t = old ? Object.assign({}, old, { title: String(f.title).trim(), due: due })
      : { id: RT.store.newKey(), scope: f.scope, title: String(f.title).trim(), due: due, done: false, doneBy: null, doneAt: null, createdBy: state.me, createdAt: new Date().toISOString() };
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
    store.saveTodo(Object.assign({}, t, { done: next, doneBy: next ? state.me : null, doneAt: next ? new Date().toISOString() : null }))
      .catch(function () { showToast('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); });
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
    openPlanSheet('event', { mode: 'add', id: null, title: '', short: '', owner: 'me', weekly: true, weekdays: [RT.schedule.weekdayOf(day)], wdPicked: false, perDay: false, times: {}, cat: null, date: D.toKey(day), start: '10:00', end: '11:00', error: '' });
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
        weekdays: e.weekly ? e.weekdays.slice() : [S.weekdayOf(D.parse(e.date))], wdPicked: e.weekly ? true : undefined, perDay: !!e.perDay, times: copyTimes(e.times), cat: e.cat || null, date: e.date || D.toKey(state.today), start: e.start, end: e.end, error: '', occDay: occDay });
      return;
    }
    var people = planPeople(), slot = 'me';
    people.forEach(function (p) { if (p.key === e.owner) slot = p.slot; });
    openPlanSheet('event', { mode: 'view', id: id, title: e.title, slot: slot,
      whenText: S.whenText(e),
      whoText: nameOf(e.owner) + ' 님 일정', canEdit: false, lockText: nameOf(e.owner) + ' 님만 고칠 수 있어요',
      occDay: occDay, skipText: occDay !== null && S.isSkipped(e, occDay) ? D.full(occDay) + '은 쉬는 날이에요' : '' });
  }
  function copyTimes(t) { var o = {}; if (t) Object.keys(t).forEach(function (k) { o[k] = { start: t[k].start, end: t[k].end }; }); return o; }
  function setEventField(act, v) {
    var f = state.eventForm;
    if (!f || f.mode === 'view') return;
    if (act === 'ev-owner') { if (f.lockOwner) return; f.owner = v === 'both' ? 'both' : 'me'; }
    else if (act === 'ev-cat') f.cat = f.cat === v ? null : v; // 한 번 더 누르면 카테고리 없음
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
      if (v === 'weekly' && !f.weekly && f.wdPicked !== true) {
        f.wdPicked = false;
        if (!isNaN(D.parse(f.date))) f.weekdays = [RT.schedule.weekdayOf(D.parse(f.date))];
      }
      f.weekly = v === 'weekly';
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
      weekdays: days, date: f.weekly ? null : f.date, start: first.start, end: first.end,
      times: perDay ? copyTimes(f.times) : null, cat: RT.schedule.catOf(f.cat) ? f.cat : null, createdBy: old ? old.createdBy || state.me : state.me,
      // 쉬는 날은 폼이 아니라 저장된 일정에서 (바뀐 요일에 없는 날은 빠진다)
      skip: f.weekly && old && old.weekly ? RT.schedule.withSkip({ skip: old.skip, weekdays: days }, [], true, state.today) : [], extra: old ? old.extra : null };
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
      occ = { key: key, label: D.full(f.occDay), skipped: S.isSkipped(e, f.occDay),
        weekKey: e.weekdays.length > 1 ? 'week:' + key : null, weekLabel: D.label(ws) + ' 주',
        weekSkipped: weekKeys.every(function (k) { return e.skip.indexOf(k) >= 0; }) };
    }
    var list = e.skip.map(function (k) { var n = D.parse(k); return { key: k, label: D.label(n) + ' (' + S.WD[S.weekdayOf(n)] + ')', past: n < state.today }; });
    return { occ: occ, list: list, busy: !!f.saving };
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

  // ── 「알림」 시트 ───────────────────────────────────────
  var REMIND_TIMES = [];
  for (var hh = 17; hh <= 23; hh++) { REMIND_TIMES.push((hh < 10 ? '0' : '') + hh + ':00', (hh < 10 ? '0' : '') + hh + ':30'); }
  var DEFAULT_PREFS = { partner: true, remindAt: null, hide: false };
  function currentPrefs() { return Object.assign({}, DEFAULT_PREFS, state.prefs || {}); }
  function notifyModel() {
    var P = RT.push;
    return {
      support: P ? P.support() : 'unsupported', on: !!(P && P.isOn()),
      busy: state.push.busy, error: state.push.error || (state.prefsError ? '알림 설정을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요' : ''),
      errorFresh: state.push.errorFresh, info: state.push.info,
      prefs: currentPrefs(), prefsReady: state.prefsReady, times: REMIND_TIMES
    };
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
        return { hex: hex, name: T.colorName(hex), ink: T.inkFor(id, hex), on: hex === pair[who], taken: hex === pair[who === 'self' ? 'partner' : 'self'] };
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
    state.sheetDay = null; state.manage = null; state.notifyOpen = false; state.todoForm = null; state.eventForm = null;
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
    state.sheetDay = null; state.manage = null; state.themeOpen = false;
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
  function setPref(patch) {
    if (!store || !state.uid || !state.prefsReady) return;
    savePrefs(Object.assign(currentPrefs(), patch));
  }
  appEl.addEventListener('change', function (ev) {
    // 날짜 · 시간 칸은 고른 순간 값만 담는다 (다시 그리지 않음)
    if (ev.target.id === 'td-date' && state.todoForm) { state.todoForm.date = ev.target.value; return; }
    if (ev.target.id === 'ev-date' && state.eventForm) { state.eventForm.date = ev.target.value; return; }
    if (ev.target.id === 'ev-start' && state.eventForm) { state.eventForm.start = ev.target.value; return; }
    if (ev.target.id === 'ev-end' && state.eventForm) { state.eventForm.end = ev.target.value; return; }
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
    setForm({ key: key, name: r.name || '', icon: r.icon || '', start: r.start || D.toKey(state.today) });
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
    if (id === 'au-email') { state.auth.email = ev.target.value; return; }
    if (id === 'au-pass') { state.auth.password = ev.target.value; return; }
    if (id === 'me-name') { state.setup.name = ev.target.value; return; }
    if (state.todoForm && (id === 'td-title' || id === 'td-date')) { state.todoForm[id === 'td-title' ? 'title' : 'date'] = ev.target.value; clearPlanError(state.todoForm, 'td-error'); return; }
    if (state.eventForm && /^ev-(title|short|date|start|end)$/.test(id)) { state.eventForm[id.slice(3)] = ev.target.value; clearPlanError(state.eventForm, 'ev-error'); return; }
    var f = state.manage && state.manage.form;
    if (!f) return;
    if (ev.target.id === 'rt-name') f.name = ev.target.value;
    else if (ev.target.id === 'rt-start') { f.start = ev.target.value; f.confirmStart = false; }
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

  appEl.addEventListener('keydown', function (ev) {
    if ((state.sheetDay === null && !state.manage && !state.notifyOpen && !state.themeOpen && !state.todoForm && !state.eventForm) || !appEl.querySelector('.sheet')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); if (state.todoForm || state.eventForm) closePlanSheet(); else if (state.notifyOpen) closeNotify(); else if (state.themeOpen) closeTheme(); else if (state.manage) closeManage(); else closeSheet(); return; }
    if (ev.key === 'Enter' && ev.target.id === 'rt-name' && !ev.isComposing && !composing) { ev.preventDefault(); ev.target.blur(); saveRoutine(); return; }
    if (ev.key === 'Tab') {
      // 시트가 열려 있으면 포커스를 시트 안에서만 돈다
      var items = Array.prototype.slice.call(appEl.querySelectorAll('.sheet button:not([disabled]), .sheet input, .sheet select:not([disabled])'));
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
      state.today = now; render();
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
      var d = ev.data || {}, q = /[?&]tab=(routine|schedule|todo)/.exec(String(d.link || ''));
      if (d.type === 'open' && q && state.status === 'ready') setTab(q[1]);
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
      state.todoForm.title = get('td-title'); if (document.getElementById('td-date')) state.todoForm.date = get('td-date'); saveTodo();
    }
    else if (form.getAttribute('data-form') === 'event' && state.eventForm) {
      var ef = state.eventForm; ef.title = get('ev-title'); if (document.getElementById('ev-short')) ef.short = get('ev-short');
      if (document.getElementById('ev-start')) { ef.start = get('ev-start'); ef.end = get('ev-end'); }
      for (var w7 = 0; w7 < 7; w7++) if (document.getElementById('ev-ts-' + w7)) ef.times[w7] = { start: get('ev-ts-' + w7), end: get('ev-te-' + w7) };
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
  function unsubscribe() { subs.forEach(function (u) { try { u(); } catch (e) {} }); subs = []; }
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
        var colors = RT.themes ? RT.themes.cleanColors(doc && doc.colors) : {};
        var colorsChanged = JSON.stringify(colors) !== JSON.stringify(state.colors);
        state.colors = colors;
        if (!fromCache) { state.prefsReady = true; state.prefsError = false; }
        if (state.notifyOpen || (colorsChanged && state.status === 'ready')) render();
      }, function () { state.prefsReady = false; state.prefsError = true; if (state.notifyOpen) render(); }),
      store.watchTodos(function (list) { state.todoDocs = list; state.todoErr = ''; if (state.status === 'ready') render(); },
        function () { state.todoErr = '잠시 뒤 다시 열어 주세요. 계속되면 저장 규칙을 확인해야 해요.'; render(); }),
      store.watchEvents(function (list) { state.eventDocs = list; state.eventErr = ''; if (state.status === 'ready') render(); },
        function () { state.eventErr = '잠시 뒤 다시 열어 주세요. 계속되면 저장 규칙을 확인해야 해요.'; render(); }),
      store.watchChecks(function (map, meta, changes, first, fromCache) {
        state.server = map; state.meta = meta; gotChecks = true;
        if (!fromCache) { checksDefinitive = true; retries = 0; }
        announceLive(changes);
        runCatchUpOnce();
        ready();
      }, lost)
    ];
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
