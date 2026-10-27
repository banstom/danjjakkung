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
    today: D.fromLocal(new Date()),
    filter: 'all',
    page: 0,
    sheetDay: null,
    sheetEntering: false,
    routineDocs: [],     // routines 컬렉션
    manage: null,        // 「내 루틴」 시트 { open, form: { key, name, icon, start, error, saving, confirmDelete } }
    toast: ''
  };
  var store = null;
  var toastTimer = null;
  var gotMembers = false, gotChecks = false, gotRoutines = false;
  var LS_SEEN = 'jjakkung.lastSeen';
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
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
  var INPUT_IDS = ['rt-name', 'rt-start', 'au-email', 'au-pass', 'me-name'];
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
    document.documentElement.setAttribute('data-season', m.header.season.key);
    var focus = focusOf(document.activeElement);
    if (state.manage && !m.manage) state.manage = null;
    var sheetOpen = !!((m.sheet || m.manage) && state.status === 'ready');
    var entering = state.sheetEntering;
    m.header.canSignOut = state.status === 'ready';
    if (state.status !== 'ready') m.header.meName = '';
    appEl.innerHTML = RT.view.page(state.status, m, state.toast, { sheetEntering: entering, auth: state.auth, setup: state.setup, email: state.email });
    state.sheetEntering = false;
    state.auth.errorFresh = false; state.setup.errorFresh = false;
    setThemeColor();
    if (state.manage && state.manage.form) state.manage.form.errorFresh = false;
    var newSheet = appEl.querySelector('.sheet');
    if (newSheet && scrollTop && !entering) newSheet.scrollTop = scrollTop;
    document.body.classList.toggle('has-sheet', sheetOpen);
    restoreFocus(focus, sheetOpen);
  }

  // 다시 그려도 누르던 버튼에 포커스가 남도록
  var FOCUS_ATTR = { toggle: 'data-key', day: 'data-day', filter: 'data-id', page: 'data-dir', close: null,
    'pick-icon': 'data-icon', 'edit-routine': 'data-key', 'resume-routine': 'data-key', 'save-routine': null, 'cancel-form': null,
    'new-routine': null, 'stop-routine': null, 'delete-routine': null, 'close-manage': null, 'open-manage': null };
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
        appEl.querySelector('.sheet [data-act="save-routine"]:not([disabled])') || appEl.querySelector('.sheet [data-act="new-routine"]') || appEl.querySelector('.sheet .close-btn');
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
  function setThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    var bg = getComputedStyle(document.body).backgroundColor;
    if (bg && meta.getAttribute('content') !== bg) meta.setAttribute('content', bg);
  }

  // 로그인한 계정이 이름을 정했으면 그 사람으로 본다
  function resolveIdentity() {
    if (!gotMembers || !state.uid) return;
    state.me = state.members[state.uid] ? state.uid : null;
    runCatchUp();
  }

  // ── 알림 ─────────────────────────────────────────────
  var openedAt = Date.now();
  var LS_ANN = 'dorandoran.announced';
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
    else if (act === 'auth-submit') submitAuth();
    else if (act === 'setup-submit') submitSetup();
    else if (act === 'sign-out') { if (RT.firebase.signOut) RT.firebase.signOut(); }
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
  });

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
    var f = state.manage && state.manage.form;
    if (!f) return;
    if (ev.target.id === 'rt-name') f.name = ev.target.value;
    else if (ev.target.id === 'rt-start') { f.start = ev.target.value; f.confirmStart = false; }
    else return;
    if (f.error && !f.confirmStart) { f.error = ''; var e = document.getElementById('rt-error'); if (e) e.remove(); }
  });
  appEl.addEventListener('compositionstart', function () { composing = true; });
  appEl.addEventListener('compositionend', function () { composing = false; });
  // 입력칸에서 나가면 미뤄 둔 화면 갱신을 한다
  appEl.addEventListener('focusout', function (ev) {
    if (INPUT_IDS.indexOf(ev.target.id) < 0) return;
    setTimeout(function () { if (deferred && !typing()) render(); }, 0);
  });

  appEl.addEventListener('keydown', function (ev) {
    // 로그인 · 이름 칸에서 엔터 = 확인
    if (ev.key === 'Enter' && !ev.isComposing && !composing) {
      if (ev.target.id === 'au-email' || ev.target.id === 'au-pass') { ev.preventDefault(); ev.target.blur(); submitAuth(); return; }
      if (ev.target.id === 'me-name') { ev.preventDefault(); ev.target.blur(); submitSetup(); return; }
    }
    if ((state.sheetDay === null && !state.manage) || !appEl.querySelector('.sheet')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); if (state.manage) closeManage(); else closeSheet(); return; }
    if (ev.key === 'Enter' && ev.target.id === 'rt-name' && !ev.isComposing && !composing) { ev.preventDefault(); ev.target.blur(); saveRoutine(); return; }
    if (ev.key === 'Tab') {
      // 시트가 열려 있으면 포커스를 시트 안에서만 돈다
      var items = Array.prototype.slice.call(appEl.querySelectorAll('.sheet button:not([disabled]), .sheet input'));
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      var inside = items.indexOf(document.activeElement) >= 0;
      if (!inside) { ev.preventDefault(); (ev.shiftKey ? last : first).focus(); }
      else if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  // 자정이 지나면 오늘 날짜를 바꿔 다시 그린다 (폰을 다시 켰을 때도)
  function checkToday() {
    var now = D.fromLocal(new Date());
    if (now !== state.today) { state.today = now; render(); }
  }
  setInterval(checkToday, 30000);
  document.addEventListener('visibilitychange', function () {
    if (visible()) { checkToday(); runCatchUp(); }
    else if (checksDefinitive && state.me) lsSet(LS_SEEN, new Date().toISOString()); // 화면을 떠날 때 '여기까지 봤음'
  });
  root.addEventListener('focus', checkToday);
  root.addEventListener('pageshow', checkToday);

  render();

  // ── 로그인 ─────────────────────────────────────────────
  function authFail(msg) { state.auth.busy = false; state.auth.error = msg; state.auth.errorFresh = true; render(true); }
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
    store.saveMember(state.uid, name).then(function () { s.busy = false; showToast('🌱 ' + name + ' 님, 환영해요!'); }, function (e) {
      s.busy = false;
      if (e && e.code === 'permission-denied') { state.status = 'denied'; render(true); return; }
      s.error = '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.'; s.errorFresh = true; render(true);
    });
  }

  // ── 저장소 연결 (끊기면 몇 번까지 다시 붙는다) ─────────────
  var subs = [];
  var retries = 0;
  function unsubscribe() { subs.forEach(function (u) { try { u(); } catch (e) {} }); subs = []; }
  function subscribe() {
    unsubscribe();
    subs = [
      store.watchMembers(function (members) { state.members = members; gotMembers = true; resolveIdentity(); ready(); }, lost),
      store.watchRoutines(function (list) { state.routineDocs = list; gotRoutines = true; ready(); }, lost),
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
    if (gotMembers && gotChecks && gotRoutines) state.status = state.me ? 'ready' : 'setup';
    render();
  }
  var reconnecting = false;
  function lost(e) {
    var code = e && e.code;
    if (code === 'permission-denied' || code === 'unauthenticated') { unsubscribe(); state.status = 'denied'; render(true); return; }
    if (reconnecting) return; // 여러 구독이 같이 끊겨도 한 번만 처리
    if (state.status !== 'ready' || retries >= 3) { state.status = 'nodb'; render(); return; }
    reconnecting = true;
    retries++;
    showToast('연결이 잠시 끊겼어요. 다시 연결하는 중이에요.');
    setTimeout(function () { reconnecting = false; subscribe(); }, 2000 * retries);
  }

  function resetSession() {
    unsubscribe();
    gotMembers = gotChecks = gotRoutines = false;
    checksDefinitive = false; caughtUpOnce = false;
    state.members = {}; state.routineDocs = []; state.server = {}; state.meta = {}; state.pending = {};
    state.me = null; state.sheetDay = null; state.manage = null;
  }

  if (!RT.firebase || !RT.firebase.configured) {
    state.status = 'unconfigured';
    render(true);
  } else {
    store = RT.store.createStore(RT.firebase.db);
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
      state.status = 'loading';
      state.setup = { name: '', error: '', busy: false };
      render(true);
      subscribe();
    });
  }
})(window);
