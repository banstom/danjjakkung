/* eat(쿠키) 기능 (docs/eat) — 화면 상태 · 저장 · 구독. app.js 가 host 를 넘겨 만든다 (RT.appEat.create(host)).
   계산은 js/eat.js, 글은 js/eat-text.js, 그리기는 js/view-eat.js. 저장은 js/store.js (서버 시각 ↔ ms).
   지키는 것 (점검 AI 목록): 단짝 쿠키가 통 안에 있으면 화면 · DOM · 알림 어디에도 음식 · 가게 · 메모가 없다(listRows · 통 · 입구),
   오늘 먹을 것은 늘 하나(eatState/today 트랜잭션), 하루 기준은 서울 자정, 별점 · 한 줄은 자기 칸만. */
(function (root) {
  'use strict';
  var RT = root.RT;
  var E = RT.eat, ET = RT.eatText, T = ET.T, V = RT.viewEat;
  var LS_PREF = 'danjjakkung.eatDraw'; // 처음 그릴 때 깜빡임 없게 이 기기에도 (진짜 값은 users/<uid>.eatDrawN · eatDrawWho)

  function create(host) {
    var st = {
      started: false, open: false, view: 'jar', // jar | write | crack | pick | list
      cookies: null, off: false, today: null, todayReady: false,
      n: 1, who: 'all', prefLoaded: false,
      draw: null,          // { id, n, who, shown: [], ids: [], picked, busy }
      write: null, place: null, ate: null, paint: null,
      listTab: 'jar', fresh: null, entering: false, crackTimer: null, crackOpened: 0, returning: false, seenSaved: false
    };
    var unsub = [];
    function S() { return host.store(); }
    function me() { return host.me(); }
    function render(f) { host.render(f); }
    function now() { return host.now(); }
    try { var lp = JSON.parse(root.localStorage.getItem(LS_PREF) || 'null'); if (lp) { st.n = E.clampN(lp.n); st.who = ['all', 'me', 'partner'].indexOf(lp.who) >= 0 ? lp.who : 'all'; } } catch (e) {}

    // ── 구독 ── 통 · 목록은 eats 한 번 구독해서 메모리에서 거름 (한 해 수백 개)
    function tick() {
      if (!S() || !me()) return;
      if (!st.started) {
        st.started = true;
        unsub.push(S().watchEats(function (list) { st.cookies = list; st.off = false; afterChange(); render(); }, function () { st.off = true; st.cookies = []; render(); }));
        unsub.push(S().watchEatToday(function (t) { st.today = t; st.todayReady = true; afterChange(); render(); }, function () { st.todayReady = true; render(); }));
      }
      var u = host.user();
      if (u && !st.prefLoaded) {
        st.prefLoaded = true;
        if (u.eatDrawN) st.n = E.clampN(u.eatDrawN);
        if (['all', 'me', 'partner'].indexOf(u.eatDrawWho) >= 0) st.who = u.eatDrawWho;
      }
    }
    function stop() {
      unsub.forEach(function (f) { try { f(); } catch (e) {} }); unsub = [];
      st.started = false; st.cookies = null; st.today = null; st.todayReady = false; st.prefLoaded = false;
      close(true);
    }
    function cookies() { return st.cookies || []; }
    function byId(id) { return cookies().filter(function (c) { return c.id === id; })[0] || null; }
    /** 고른 날부터 서울 날짜로 3일째면 앱을 연 사람이 돌려놓기 (서버 함수 없음) */
    function afterChange() {
      if (st.today && st.todayReady && st.cookies && !st.returning && E.autoReturnDue(st.today, now())) {
        st.returning = true;
        S().returnEat(st.today.eatId).then(function () { st.returning = false; }, function () { st.returning = false; });
        return;
      }
      // 오늘 먹을 것이 가리키는 쿠키가 이미 통 · 먹은 것으로 갔으면 (다른 기기에서 묶음이 끊긴 경우) 표시만 지운다 — 규칙도 이 경우 지우기를 허락
      var tc = st.today && st.cookies ? byId(st.today.eatId) : null;
      if (tc && tc.state !== 'today' && tc.state !== 'out' && !st.returning) {
        st.returning = true;
        S().clearEatToday().then(function () { st.returning = false; }, function () { st.returning = false; });
      }
    }

    // ── 화면 값 ──
    function slotOf(uid) { return host.slotOf(uid); }
    function jarModel() {
      var list = cookies(), s = E.jarSummary(list, me(), now());
      var inJar = list.filter(function (c) { return c.state === 'jar'; }).sort(function (a, b) { return a.at - b.at; });
      var whos = inJar.map(function (c) { return c.by === me() ? 'me' : 'partner'; });
      var fresh = st.fresh ? inJar.findIndex(function (c) { return c.id === st.fresh; }) : -1;
      var tc = st.today ? byId(st.today.eatId) : null;
      var today = null;
      if (st.today && tc) {
        var kick = E.todayKick(st.today, now());
        var mine = tc.by === me();
        today = {
          kick: kick === 'today' ? T.todayKick : kick === 'yesterday' ? T.yesterdayKick : T.dayBeforeKick,
          food: tc.food, memo: tc.memo || '', place: tc.place ? { name: tc.place.name, url: tc.place.url || null } : null,
          sub: T.todayFrom(mine, tc.at) + ' · ' + (tc.place ? tc.place.name : T.noPlace),
          canKung: !!host.partner()
        };
      }
      return { summary: s, jar: { total: s.total, whos: whos, fresh: fresh, small: !!today }, meSlot: slotOf(me()), herSlot: host.partner() ? slotOf(host.partner()) : 'her',
        n: st.n, who: st.who, canDraw: E.canDraw(list, me(), st.who, st.today), today: today, empty: !list.some(function (c) { return c.state !== 'out'; }) && !st.today };
    }
    function slipOf(c) {
      var mine = c.by === me();
      var place = c.place ? { name: c.place.name, url: c.place.url || null, area: c.place.sigungu && host.areaName ? host.areaName(c.place.sigungu) : null } : null;
      return { id: c.id, mine: mine, slot: slotOf(c.by), ago: E.ago(c.at, now()), food: c.food, place: place, memo: c.memo || '', written: c.at };
    }
    function pickModel() {
      var d = st.draw, slips = d.ids.map(byId).filter(Boolean).filter(function (c) { return c.state === 'jar'; }).map(slipOf);
      var single = null;
      if (d.n === 1 && slips.length === 1) single = { sub: slips[0].mine ? T.singleSubMine(slips[0].ago) : T.singleSubPartner(slips[0].ago) };
      return { n: d.n, slips: slips, picked: single ? slips[0].id : d.picked, single: single, busy: d.busy };
    }
    function listModel() {
      var list = cookies(), rows = E.listRows(list, me(), st.listTab, now());
      return { tab: st.listTab, counts: E.tabCounts(list), rows: rows };
    }
    function entryModel() {
      var list = cookies(), tc = st.today ? byId(st.today.eatId) : null;
      var seen = (host.user() || {}).eatSeenAt || 0;
      return { total: list.filter(function (c) { return c.state === 'jar'; }).length, todayFood: tc ? tc.food : null, newCount: E.newPartnerCount(list, me(), seen), off: st.off };
    }

    // ── 열기 · 닫기 ──
    function open() {
      if (!S() || !me()) return;
      tick();
      st.open = true; st.view = 'jar'; st.fresh = null;
      // 입구 「단짝 +n」 기준: 통을 연 시각 (users/<uid>.eatSeenAt)
      S().saveUserFields(me(), { eatSeenAt: now() }).catch(function () {});
      host.focus(['[data-act="ek-close"]']);
      render(true);
      try { root.scrollTo(0, 0); } catch (e) {}
    }
    function close(silent) {
      if (st.crackTimer) { clearInterval(st.crackTimer); st.crackTimer = null; }
      var was = st.open;
      st.open = false; st.view = 'jar'; st.write = null; st.place = null; st.ate = null; st.paint = null; st.draw = null;
      if (!silent && was) { host.focus(['[data-act="ek-open"]']); render(true); try { root.scrollTo(0, 0); } catch (e) {} }
    }
    function toJar(focus) { if (st.crackTimer) { clearInterval(st.crackTimer); st.crackTimer = null; } st.view = 'jar'; st.draw = null; st.write = null; host.focus(focus || ['[data-act="ek-crack"]', '[data-act="ek-add"]']); render(true); try { root.scrollTo(0, 0); } catch (e) {} }
    function back() {
      if (st.paint) { st.paint = null; render(true); return; }
      if (st.ate) { st.ate = null; host.focus(['[data-act="ek-ate"]']); render(true); return; }
      if (st.place) { if (st.place.pick) placeBack(); else placeClose(); return; }
      if (st.view === 'write') { closeWrite(); return; }
      if (st.view === 'crack' || st.view === 'pick') { toJar(); return; }
      if (st.view === 'list') { toJar(['[data-act="ek-list"]']); return; }
      close();
    }

    // ── 넣기 · 고치기 · 빼기 ──
    function openWrite(id) {
      var c = id ? byId(id) : null;
      if (id && (!c || c.by !== me() || c.state !== 'jar')) { host.toast('지금은 고칠 수 없는 쿠키예요'); return; }
      st.write = c ? { edit: id, written: c.at, edited: !!c.editedAt, food: c.food, place: c.place || null, memo: c.memo || '', from: st.view, slot: slotOf(me()) }
        : { edit: null, written: now(), food: '', place: null, memo: '', from: st.view, slot: slotOf(me()) };
      st.view = 'write'; host.focus(['#ek-food']); render(true);
      try { root.scrollTo(0, 0); } catch (e) {}
    }
    function closeWrite() { var from = st.write && st.write.from; st.write = null; st.view = from === 'list' ? 'list' : 'jar'; host.focus(['[data-act="ek-add"]', '[data-act="ek-list-close"]']); render(true); }
    function takeInputs() {
      var w = st.write; if (!w) return;
      var f = document.getElementById('ek-food'), m = document.getElementById('ek-memo');
      if (f) w.food = f.value; if (m) w.memo = m.value;
    }
    function saveWrite() {
      var w = st.write; if (!w || w.saving) return;
      takeInputs();
      var input = { food: w.food, memo: w.memo, place: w.place };
      var r = w.edit ? E.editCookie(byId(w.edit) || {}, input, me(), now()) : E.newCookie(input, me(), now());
      if (!r.ok) { w.error = errText(r.errors); render(true); return; }
      w.saving = true; w.error = ''; render(true);
      if (w.edit) {
        var p = r.value; delete p.editedAt;
        S().editEat(w.edit, p).then(function () { st.write = null; st.view = w.from === 'list' ? 'list' : 'jar'; host.toast('쿠키를 고쳤어요'); render(true); },
          function () { w.saving = false; w.error = '고치지 못했어요 · 잠시 뒤 다시 해 주세요'; render(true); });
        return;
      }
      var doc = r.value; delete doc.at;
      var count = cookies().filter(function (c) { return c.state === 'jar'; }).length + 1;
      S().addEat(doc).then(function (id) {
        st.write = null; st.view = 'jar'; st.fresh = host.reduceMotion() ? null : id; st.lastAdded = id;
        host.toast(T.added(count));
        host.focus(['[data-act="ek-crack"]']); render(true);
        setTimeout(function () { if (st.fresh === id) { st.fresh = null; render(); } }, 1200);
      }, function () { w.saving = false; w.error = '넣지 못했어요 · 잠시 뒤 다시 해 주세요'; render(true); });
    }
    function errText(errs) {
      var e = errs[0];
      return { 'food-empty': '먹고 싶은 음식을 적어 주세요', 'food-long': '음식은 20자까지예요', 'memo-long': '메모는 100자까지예요', 'place-empty': '음식점 이름을 적어 주세요', 'place-long': '음식점 이름은 40자까지예요', 'not-author': '내가 적은 쿠키만 고칠 수 있어요', 'not-in-jar': '통 안에 있을 때만 고칠 수 있어요' }[e] || '다시 확인해 주세요';
    }
    function outCookie() {
      var w = st.write; if (!w || !w.edit || w.saving) return;
      if (!w.confirmOut) { takeInputs(); w.confirmOut = true; render(true); return; }
      var r = E.removeCookie(byId(w.edit) || {}, me());
      if (!r.ok) { w.error = errText(r.errors); render(true); return; }
      w.saving = true; render(true);
      S().removeEat(w.edit).then(function () { st.write = null; st.view = 'list'; host.toast('쿠키를 뺐어요'); render(true); },
        function () { w.saving = false; w.error = '빼지 못했어요'; render(true); });
    }

    // ── 깨기 · 고르기 ──
    function savePref() {
      try { root.localStorage.setItem(LS_PREF, JSON.stringify({ n: st.n, who: st.who })); } catch (e) {}
      S().saveUserFields(me(), { eatDrawN: st.n, eatDrawWho: st.who }).catch(function () {});
    }
    function crack() {
      var list = cookies();
      if (!E.canDraw(list, me(), st.who, st.today)) return;
      var ids = E.draw({ cookies: list, uid: me(), n: st.n, who: st.who });
      st.draw = { id: null, n: st.n, who: st.who, ids: ids, shown: ids.slice(), picked: null, busy: false };
      S().addDraw(me(), st.n, st.who, ids).then(function (id) { if (st.draw) st.draw.id = id; }, function () {});
      if (host.reduceMotion()) { st.view = 'pick'; host.focus(['.ek-pick', '[data-act="ek-choose"]']); render(true); return; }
      st.view = 'crack'; st.crackOpened = 0; render(true);
      st.crackTimer = setInterval(function () {
        st.crackOpened++;
        if (st.crackOpened > ids.length) { finishCrack(); return; }
        render();
      }, 300);
    }
    function finishCrack() {
      if (st.crackTimer) { clearInterval(st.crackTimer); st.crackTimer = null; }
      if (st.view !== 'crack') return;
      st.view = 'pick'; host.focus(['.ek-pick', '[data-act="ek-choose"]']); render(true);
      try { root.scrollTo(0, 0); } catch (e) {}
    }
    function redraw() {
      var d = st.draw; if (!d || d.busy) return;
      var ids = E.draw({ cookies: cookies(), uid: me(), n: d.n, who: d.who, exclude: d.shown });
      d.ids = ids; d.picked = null;
      ids.forEach(function (id) { if (d.shown.indexOf(id) < 0) d.shown.push(id); });
      if (d.id) S().updateDraw(d.id, { shown: d.shown.slice(-9) }).catch(function () {});
      host.focus(['.ek-pick', '[data-act="ek-choose"]']); render(true);
    }
    function choose() {
      var d = st.draw; if (!d || d.busy) return;
      var m = pickModel(), id = m.picked; if (!id) return;
      var c = byId(id); if (!c) return;
      var r = E.pick({ cookie: c, todayState: st.today, uid: me(), drawId: d.id, nowMs: now() });
      if (!r.ok) { if (r.error === 'taken') { host.toast(T.conflict); toJar(); } return; }
      d.busy = true; render(true);
      S().pickEat(id, me(), d.id).then(function (res) {
        d.busy = false;
        if (res && res.taken) { host.toast(T.conflict); toJar(['[data-act="ek-ate"]']); return; }
        if (res && res.gone) { host.toast('그 사이 통에서 빠진 쿠키예요'); toJar(); return; }
        if (d.id) S().updateDraw(d.id, { picked: id }).catch(function () {});
        st.today = st.today || { eatId: id, by: me(), at: now() }; // 구독보다 먼저 보이게
        toJar(['[data-act="ek-ate"]']);
      }, function () { d.busy = false; host.toast('고르지 못했어요 · 잠시 뒤 다시 해 주세요'); render(true); });
    }

    // ── 오늘 먹을 것 ──
    function returnToday() {
      var t = st.today, c = t && byId(t.eatId); if (!t || !c) return;
      var r = E.returnToJar({ cookie: c, todayState: t }); if (!r.ok) return;
      S().returnEat(t.eatId).then(function () { host.toast('통에 돌려놓았어요'); }, function () { host.toast('돌려놓지 못했어요'); });
    }
    function kung() {
      var t = st.today, c = t && byId(t.eatId); if (!t || !c || st.kungBusy) return;
      st.kungBusy = true;
      S().eatPing(me(), c.id, c.food).then(function () { st.kungBusy = false; host.toast('💌 단짝에게 알렸어요'); },
        function (e) { st.kungBusy = false; host.toast(e && e.code === 'permission-denied' ? '이 쿠키는 이미 알렸어요' : '보내지 못했어요 · 잠시 뒤 다시 해 주세요'); });
    }
    function openAte(rateId) {
      var c = rateId ? byId(rateId) : (st.today ? byId(st.today.eatId) : null); if (!c) return;
      var mine = rateId ? ((c.stars || {})[me()] || 0) : 0;
      st.ate = { id: c.id, food: c.food, stars: mine, note: rateId ? ((c.notes || {})[me()] || '') : '', together: true, again: true, rateOnly: !!rateId, saving: false };
      st.entering = true; host.focus(['[data-act="ek-star"][data-v="' + (mine || 1) + '"]'], true); render(true);
    }
    function saveAte() {
      var a = st.ate; if (!a || a.saving || !a.stars) return;
      var ni = document.getElementById('ek-note'); if (ni) a.note = ni.value;
      var c = byId(a.id); if (!c) return;
      if (a.rateOnly) {
        var rr = E.rate({ cookie: c, uid: me(), stars: a.stars, note: a.note });
        if (!rr.ok) { a.error = rr.error === 'note-long' ? '한 줄은 40자까지예요' : '별점을 골라 주세요'; render(true); return; }
        a.saving = true; render(true);
        S().rateEat(a.id, me(), a.stars, String(a.note || '').trim()).then(function () { st.ate = null; host.toast('별점을 남겼어요'); render(true); },
          function () { a.saving = false; a.error = '남기지 못했어요'; render(true); });
        return;
      }
      var r = E.eat({ cookie: c, todayState: st.today, uid: me(), stars: a.stars, note: a.note, together: a.together, again: a.again, nowMs: now() });
      if (!r.ok) { a.error = r.error === 'note-long' ? '한 줄은 40자까지예요' : r.error === 'not-today' ? '그 사이 바뀌었어요 · 다시 열어 주세요' : '별점을 골라 주세요'; render(true); return; }
      a.saving = true; render(true);
      var againDoc = r.againDoc ? Object.assign({}, r.againDoc) : null; if (againDoc) delete againDoc.at;
      S().eatEat(a.id, me(), { stars: a.stars, note: String(a.note || '').trim(), together: a.together, againDoc: againDoc }).then(function (res) {
        st.ate = null;
        if (res && res.gone) { host.toast('그 사이 바뀌었어요'); render(true); return; }
        st.today = null;
        var code = E.paintAsk({ cookie: c, together: a.together, paintedSigungu: host.paintedSigungu() });
        var area = code && host.areaName ? host.areaName(code) : null;
        if (code && area) { st.paint = { code: code, area: area, food: c.food }; st.entering = true; host.focus(['[data-act="ek-paint-yes"]'], true); }
        else host.toast('맛있게 먹었어요!');
        render(true);
      }, function () { a.saving = false; a.error = '남기지 못했어요 · 잠시 뒤 다시 해 주세요'; render(true); });
    }
    function paintYes() {
      var p = st.paint; if (!p || p.busy) return;
      p.busy = true; render(true);
      host.openMapPaint(p.code, p.food).then(function () { st.paint = null; host.toast('짝꿍 지도에 ' + p.area + ' 칠했어요'); render(true); },
        function () { st.paint = null; host.toast('지도에 칠하지 못했어요'); render(true); });
    }

    // ── 음식점 찾기 (E5 · docs/eat 6절) — 카카오 후보는 보여 주기만, 저장은 장소 ID · 주소 · 내가 확인한 이름 ──
    var SEARCH_WAIT = 500, searchCache = {}, searchTimer = null, searchSeq = 0;
    function cleanQ(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
    function placeRowsNow() { var box = document.getElementById('ek-place-res'); if (box && st.place) box.innerHTML = V.placeRows(st.place); }
    function placeOpen() {
      takeInputs();
      var q = st.write && st.write.place ? st.write.place.name : '';
      st.place = { q: q, items: null, loading: false, error: '', pick: null, search: !!host.searchPlace };
      st.entering = true; host.focus(['#ek-place-q'], true); render(true);
      if (q) runSearch(q);
    }
    function placeClose() {
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
      searchSeq++; st.place = null; host.focus(['[data-act="ek-place"]']); render(true);
    }
    function placeQuery(value) {
      st.place.q = value;
      if (searchTimer) clearTimeout(searchTimer);
      var q = cleanQ(value);
      if (!st.place.search || !q) { searchSeq++; st.place.items = null; st.place.loading = false; st.place.error = ''; placeRowsNow(); return; }
      if (searchCache[q]) { st.place.items = searchCache[q]; st.place.error = ''; placeRowsNow(); return; }
      st.place.loading = true; st.place.error = ''; placeRowsNow();
      searchTimer = setTimeout(function () { searchTimer = null; runSearch(q); }, SEARCH_WAIT);
    }
    function runSearch(q) {
      if (!st.place || !st.place.search) return;
      q = cleanQ(q); if (!q) return;
      if (searchCache[q]) { st.place.items = searchCache[q]; st.place.loading = false; st.place.error = ''; placeRowsNow(); return; }
      var seq = ++searchSeq;
      st.place.loading = true; st.place.error = ''; placeRowsNow();
      host.searchPlace(q).then(function (r) {
        if (seq !== searchSeq || !st.place) return;
        var items = (r && Array.isArray(r.items) ? r.items : []).filter(function (it) { return it && it.kakaoId && it.url && it.name; });
        searchCache[q] = items;
        st.place.items = items; st.place.loading = false; st.place.error = ''; placeRowsNow();
      }, function (e) {
        if (seq !== searchSeq || !st.place) return;
        var code = e && e.code, msg = e && e.message;
        st.place.loading = false; st.place.items = null;
        st.place.error = msg === 'offline' ? T.placeErr.offline : (T.placeErr[code] || T.placeErr.other);
        placeRowsNow();
      });
    }
    function placePick(i) {
      if (!st.place || !st.place.items || !st.place.items[i]) return;
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
      st.place.pick = { i: i, name: cleanQ(st.place.q).slice(0, 40) }; // 이름은 내가 친 글자에서 시작 (카카오 장소명을 그대로 채우지 않음 — 데브톡 답 전)
      host.focus(['#ek-place-nm'], true); render(true);
    }
    function placeBack() { if (!st.place) return; st.place.pick = null; host.focus(['#ek-place-q'], true); render(true); }
    function placeOk() {
      var p = st.place; if (!p || !p.pick || !st.write) return;
      var it = p.items && p.items[p.pick.i]; if (!it) return;
      var el = document.getElementById('ek-place-nm');
      var name = cleanQ(el ? el.value : p.pick.name).slice(0, 40);
      if (!name) { host.toast('쪽지에 적을 이름을 적어 주세요'); host.focus(['#ek-place-nm'], true); render(true); return; }
      st.write.place = { name: name, kakaoId: String(it.kakaoId), url: String(it.url) };
      st.place = null; host.focus(['[data-act="ek-place-clear"]']); render(true);
    }
    function enter(id) {
      if (!st.place) return;
      if (id === 'ek-place-nm') { placeOk(); return; }
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
      var q = cleanQ(st.place.q);
      if (!st.place.search) { if (q) act('ek-place-name', document.createElement('i')); return; }
      if (q) runSearch(q);
    }

    // ── 누르기 · 입력 ──
    function act(a, btn) {
      var v = btn.getAttribute('data-v');
      if (a === 'ek-open') open();
      else if (a === 'ek-close') back();
      else if (a === 'ek-list') { st.view = 'list'; host.focus(['[data-act="ek-list-close"]']); render(true); try { root.scrollTo(0, 0); } catch (e) {} }
      else if (a === 'ek-list-close') toJar(['[data-act="ek-list"]']);
      else if (a === 'ek-tab') { st.listTab = v === 'eaten' ? 'eaten' : 'jar'; host.focus(['[data-act="ek-tab"][data-v="' + st.listTab + '"]']); render(true); }
      else if (a === 'ek-n') { st.n = E.clampN(v); savePref(); host.focus(['[data-act="ek-n"][data-v="' + st.n + '"]']); render(true); }
      else if (a === 'ek-who') { st.who = v; savePref(); host.focus(['[data-act="ek-who"][data-v="' + v + '"]']); render(true); }
      else if (a === 'ek-add') openWrite(null);
      else if (a === 'ek-edit') openWrite(v);
      else if (a === 'ek-write-close') closeWrite();
      else if (a === 'ek-write-save') saveWrite();
      else if (a === 'ek-out') outCookie();
      else if (a === 'ek-place') placeOpen();
      else if (a === 'ek-place-close') placeClose();
      else if (a === 'ek-place-pick') placePick(Number(v));
      else if (a === 'ek-place-back') placeBack();
      else if (a === 'ek-place-ok') placeOk();
      else if (a === 'ek-place-name') { var q = document.getElementById('ek-place-q'); var name = String(q ? q.value : (st.place && st.place.q) || '').replace(/\s+/g, ' ').trim(); if (name && st.write) { st.write.place = { name: name.slice(0, 40) }; } st.place = null; host.focus(['[data-act="ek-place-clear"]']); render(true); }
      else if (a === 'ek-place-clear') { takeInputs(); if (st.write) st.write.place = null; host.focus(['[data-act="ek-place"]']); render(true); }
      else if (a === 'ek-crack') crack();
      else if (a === 'ek-crack-skip') finishCrack();
      else if (a === 'ek-pick') { if (st.draw) { st.draw.picked = st.draw.picked === v ? null : v; host.focus(['[data-act="ek-pick"][data-v="' + v + '"]']); render(true); } }
      else if (a === 'ek-pick-close') toJar();
      else if (a === 'ek-redraw') redraw();
      else if (a === 'ek-choose') choose();
      else if (a === 'ek-return') returnToday();
      else if (a === 'ek-kung') kung();
      else if (a === 'ek-ate') openAte(null);
      else if (a === 'ek-rate') openAte(v);
      else if (a === 'ek-ate-close') { st.ate = null; host.focus(['[data-act="ek-ate"]']); render(true); }
      else if (a === 'ek-star') { if (st.ate) { var ni = document.getElementById('ek-note'); if (ni) st.ate.note = ni.value; st.ate.stars = Number(v); st.ate.error = ''; host.focus(['[data-act="ek-star"][data-v="' + v + '"]'], true); render(true); } }
      else if (a === 'ek-together' || a === 'ek-again') { if (st.ate) { var nj = document.getElementById('ek-note'); if (nj) st.ate.note = nj.value; var k = a === 'ek-together' ? 'together' : 'again'; st.ate[k] = !st.ate[k]; host.focus(['[data-act="' + a + '"]'], true); render(true); } }
      else if (a === 'ek-ate-save') saveAte();
      else if (a === 'ek-paint-no') { st.paint = null; render(true); }
      else if (a === 'ek-paint-yes') paintYes();
      else return false;
      return true;
    }
    function input(id, value) {
      if (id === 'ek-food' && st.write) {
        st.write.food = value; st.write.error = '';
        var b = document.querySelector('[data-act="ek-write-save"]'); if (b) b.disabled = !value.trim() || !!st.write.saving;
        return true;
      }
      if (id === 'ek-memo' && st.write) {
        st.write.memo = value;
        var n = document.getElementById('ek-memo-n'); if (n) n.textContent = T.memoCount(Array.from(value).length, E.MEMO_MAX);
        return true;
      }
      if (id === 'ek-place-q' && st.place) { placeQuery(value); return true; }
      if (id === 'ek-place-nm' && st.place && st.place.pick) { st.place.pick.name = value; return true; }
      if (id === 'ek-note' && st.ate) { st.ate.note = value; return true; }
      return false;
    }

    // ── 그리기 ──
    function screenHtml() {
      if (st.view === 'write' && st.write) return V.writeScreen(st.write);
      if (st.view === 'crack' && st.draw) return V.crackScreen({ n: st.draw.ids.length, opened: st.crackOpened });
      if (st.view === 'pick' && st.draw) return V.pickScreen(pickModel());
      if (st.view === 'list') return V.listScreen(listModel());
      if (st.off) return '<div class="mscreen ek"><div class="mbar"><button type="button" class="mbar__btn" data-act="ek-close" aria-label="전체로 돌아가기"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><h1 class="mbar__title">' + T.name.replace(/[<>&]/g, '') + '</h1></div><div class="card ek-list ek-list--empty"><p class="muted">저장 규칙 배포 뒤에 열려요</p></div></div>';
      return V.jarScreen(jarModel());
    }
    function sheetHtml() {
      var e = st.entering; st.entering = false;
      if (st.paint) return V.paintSheet(st.paint, e);
      if (st.ate) return V.ateSheet(st.ate, e);
      if (st.place && st.view === 'write') return V.placeSheet(st.place, e);
      return '';
    }

    return {
      tick: tick, stop: stop, open: open, close: close, back: back,
      isOpen: function () { return st.open; }, enter: enter, hasSheet: function () { return st.open && !!(st.paint || st.ate || (st.place && st.view === 'write')); },
      act: act, input: input, screenHtml: screenHtml, sheetHtml: sheetHtml, entryModel: entryModel,
      _st: st, _jarModel: jarModel, _listModel: listModel
    };
  }

  root.RT = root.RT || {};
  root.RT.appEat = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
