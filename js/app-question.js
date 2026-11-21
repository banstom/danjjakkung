/* 교환 쪽지 (docs/question) — 화면 상태 · 저장 · 구독. app.js 가 host 를 넘겨 만든다 (RT.appQuestion.create(host)).
   계산은 js/question.js(서버 함수와 같은 모듈), 문구는 js/question-text.js, 그리기는 js/view-question.js.
   지키는 것 (점검 AI 목록): 단짝 쪽지는 done 에 내 uid 가 있을 때만 구독한다 — 그 밖엔 부르지도 않음 (화면 · 입구 · 지난 쪽지 · 캐시).
   host = { store(), render(force), toast(t), me(), partner(), nameOf(uid), slotOf(uid), since(), focus(sels, inSheet), kung: { ready(), send() }, now() } */
(function (root) {
  'use strict';
  var RT = root.RT;
  var Q = RT.question, QT = RT.questionText, T = QT.T, V = RT.viewQuestion;
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function seoul(ms) { var d = new Date(ms + 9 * 3600000); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes() }; }
  function timeLabel(ms) { if (!ms) return ''; var p = seoul(ms), h = p.hh % 12 === 0 ? 12 : p.hh % 12; return (p.hh >= 12 ? '오후 ' : '오전 ') + h + ':' + (p.mm < 10 ? '0' : '') + p.mm; }
  function keyParts(key) { var a = key.split('-').map(Number), w = new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay(); return { y: a[0], m: a[1], d: a[2], w: w }; }
  function dayLabel(key) { var p = keyParts(key); return p.m + '월 ' + p.d + '일 ' + DOW[p.w] + '요일'; }

  function create(host) {
    var st = {
      open: false, view: 'today',    // today | past | ours
      viewDate: null,                // 지금 보는 쪽지 날짜 (오늘 또는 지난 날)
      today: null,                   // 오늘 서울 날짜 키 (구독 중인 날)
      day: undefined, dayFromCache: false, off: false, // 오늘 qdays 문서 (undefined = 아직 모름, null = 없음)
      pastDay: undefined,            // 지난 날 화면의 문서
      history: null, historyAt: 0, historyBusy: false,
      ours: null, oursOff: false,
      ans: {},                       // 'date|uid' → { text, at, editedAt } | null
      mineWriting: null,             // { draft, editing, saving, error }
      swap: false, add: null, pastMonth: null, busy: false, entering: false
    };
    var unsub = { day: null, past: null, ours: null, a: {} };
    var ensured = {};                // 날짜 → 만들기를 한 번 시도함

    function S() { return host.store(); }
    function me() { return host.me(); }
    function partner() { return host.partner(); }
    function nowKey() { return Q.dateKey(host.now()); }
    function render(f) { host.render(f); }

    // ── 구독 ──
    /** 오늘 문서 구독 (자정이 지나면 새 날짜로). 앱이 그릴 때마다 부른다 */
    function tick() {
      if (!S() || !me()) return;
      var k = nowKey();
      if (k === st.today && unsub.day) return;
      if (unsub.day) { try { unsub.day(); } catch (e) {} }
      st.today = k; st.day = undefined; st.off = false;
      if (st.open && st.view === 'today' && (!st.viewDate || st.viewDate < k)) { st.viewDate = k; st.mineWriting = null; }
      unsub.day = S().watchQDay(k, function (doc, fromCache) {
        st.day = doc; st.dayFromCache = !!fromCache; st.off = false;
        if (!doc && !fromCache) ensure(k);
        syncAnswers(); render();
      }, function () { st.off = true; st.day = null; render(); });
    }
    function stopAll() {
      ['day', 'past', 'ours'].forEach(function (k) { if (unsub[k]) { try { unsub[k](); } catch (e) {} unsub[k] = null; } });
      Object.keys(unsub.a).forEach(function (k) { try { unsub.a[k](); } catch (e) {} });
      unsub.a = {}; st.ans = {}; st.today = null; st.day = undefined;
    }
    /** 보고 있는 날의 쪽지 구독: 내 쪽지는 내가 남겼을 때, 단짝 쪽지는 둘 다 남겼을 때만 */
    function syncAnswers() {
      var want = {};
      var d = viewedDay();
      if (st.open && d && me()) {
        var done = d.done || {}, p = partner();
        if (done[me()]) want[d.date + '|' + me()] = true;
        if (done[me()] && p && done[p]) want[d.date + '|' + p] = true;
      }
      Object.keys(unsub.a).forEach(function (k) { if (!want[k]) { try { unsub.a[k](); } catch (e) {} delete unsub.a[k]; } });
      Object.keys(want).forEach(function (k) {
        if (unsub.a[k]) return;
        var parts = k.split('|');
        unsub.a[k] = S().watchAnswer(parts[0], parts[1], function (a) { st.ans[k] = a; render(); }, function () { st.ans[k] = null; render(); });
      });
    }
    function watchOurs() {
      if (unsub.ours || !S()) return;
      unsub.ours = S().watchOurs(function (list) { st.ours = list; st.oursOff = false; render(); }, function () { st.ours = []; st.oursOff = true; render(); });
    }
    function loadHistory(force) {
      if (!S() || st.historyBusy) return Promise.resolve(st.history || []);
      if (st.history && !force && host.now() - st.historyAt < 30000) return Promise.resolve(st.history);
      st.historyBusy = true;
      return S().loadQDays().then(function (list) { st.history = list; st.historyAt = host.now(); st.historyBusy = false; return list; },
        function (e) { st.historyBusy = false; throw e; });
    }

    // ── 그날 질문 만들기 (앱 쪽) — 서버 함수 questionDaily 와 같은 모듈 · 같은 순서 ──
    function ctxFor(date, history, ours) {
      return { date: date, since: host.since(), bank: bank(), history: history, ours: ours };
    }
    var bankData = null, bankBusy = null;
    function bank() { return bankData; }
    function loadBank() {
      if (bankData) return Promise.resolve(bankData);
      if (bankBusy) return bankBusy;
      bankBusy = fetch('data/questions.json').then(function (r) { if (!r.ok) throw new Error('bank'); return r.json(); }).then(function (b) { bankData = b; bankBusy = null; return b; },
        function (e) { bankBusy = null; throw e; });
      return bankBusy;
    }
    function oursOnce() {
      if (st.ours) return Promise.resolve(st.ours);
      return new Promise(function (ok) {
        var u = S().watchOurs(function (list) { try { u(); } catch (e) {} ok(list); }, function () { ok([]); });
      });
    }
    function ensure(date) {
      if (ensured[date] || !S() || date !== nowKey()) return;
      ensured[date] = true;
      Promise.all([loadBank(), loadHistory(true), oursOnce()]).then(function (r) {
        var pick = Q.pickQuestion(ctxFor(date, r[1], r[2]));
        return S().createQDay(date, pick);
      }).catch(function () { ensured[date] = false; if (st.open) { st.loadErr = true; render(); } });
    }

    // ── 화면 값 ──
    function viewedDay() {
      if (!st.open) return st.day || null;
      if (st.viewDate && st.viewDate !== st.today) return st.pastDay || null;
      return st.day || null;
    }
    function ansOf(date, uid) { return st.ans[date + '|' + uid]; }
    function tags(d) {
      var out = [];
      if (d.q === 'first') out.push(T.tagFirst);
      if (/^hundred:/.test(d.q)) out.push(T.tagHundred(Number(d.q.split(':')[1])));
      if (/^anniv:/.test(d.q)) out.push(T.tagAnniv(Number(d.q.split(':')[1])));
      if (d.src === 'ours' && d.by) out.push(T.tagOursBy(d.by === me() ? host.nameOf(me()) : '단짝'));
      return out;
    }
    function screenModel() {
      var d = viewedDay(), meU = me(), p = partner();
      var base = { meSlot: host.slotOf(meU), herSlot: p ? host.slotOf(p) : 'her', past: !!(st.viewDate && st.viewDate !== st.today) };
      if (st.off) return Object.assign(base, { error: '저장 규칙 배포 뒤에 열려요' });
      if (st.loadErr && !d) return Object.assign(base, { error: '오늘 질문을 펼치지 못했어요 · 잠시 뒤 다시 열어 주세요' });
      if (!d) return base;
      var state = Q.viewState(d, meU, p);
      var mine = ansOf(d.date, meU), her = p ? ansOf(d.date, p) : null;
      var w = st.mineWriting;
      var writing = state === 'none' || state === 'theirs' || !!(w && w.editing);
      return Object.assign(base, {
        day: { dateLabel: dayLabel(d.date), text: d.text, tags: tags(d), canSwap: d.date === st.today && Q.canSwap(d, st.today) },
        state: state,
        first: d.q === 'first' && state === 'none',
        nudge: state === 'mine' && d.date === st.today && host.kung.ready(),
        mine: {
          writing: writing, editing: !!(w && w.editing), draft: w ? w.draft : '', saving: !!(w && w.saving), error: w ? w.error : '',
          text: mine ? mine.text : (mine === null ? '' : null), timeLabel: timeLabel((mine && mine.at) || (d.done || {})[meU]), edited: !!(mine && mine.editedAt)
        },
        theirs: state === 'both'
          ? { text: her ? her.text : (her === null ? '' : null), timeLabel: timeLabel((her && her.at) || d.done[p]), edited: !!(her && her.editedAt), liked: !!(d.likes || {})[meU] }
          : { timeLabel: timeLabel((d.done || {})[p]) } // 접힌 쪽지 · 빈 자리 — 글 칸 없음
      });
    }
    function entryModel() {
      var d = st.day, p = partner();
      return { text: d ? d.text : '', state: d ? Q.viewState(d, me(), p) : 'none', meSlot: host.slotOf(me()), herSlot: p ? host.slotOf(p) : 'her', off: st.off };
    }
    function monthKey(k) { return k.slice(0, 7); }
    function shiftMonth(m, dir) { var a = m.split('-').map(Number), t = a[0] * 12 + a[1] - 1 + dir; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); }
    function pastModel() {
      var meU = me(), p = partner(), m = st.pastMonth, hist = st.history || [];
      var first = hist.length ? monthKey(hist[0].date) : monthKey(st.today);
      var rows = Q.monthRows(hist, { month: m, me: meU, partner: p, today: st.today });
      var both = rows.filter(function (r) { return r.state === 'both'; }).length;
      var a = m.split('-');
      return {
        title: a[0] + '년 ' + Number(a[1]) + '월', canPrev: m > first, canNext: m < monthKey(st.today), loading: !st.history, error: st.pastErr || '',
        summary: T.pastSummary(rows.length, both), meSlot: host.slotOf(meU), herSlot: p ? host.slotOf(p) : 'her',
        rows: rows.map(function (r) {
          var kp = keyParts(r.date), dayDoc = hist.filter(function (h) { return h.date === r.date; })[0] || {};
          var sub = r.src === 'ours' && r.by ? T.tagOursBy(r.by === meU ? host.nameOf(meU) : '단짝') : (dayDoc.swappedAt ? T.swapped : '');
          return { date: r.date, d: kp.d, w: DOW[kp.w], text: r.text, sub: sub, me: !!(dayDoc.done || {})[meU], her: !!(dayDoc.done || {})[p], late: r.late, liked: r.liked };
        })
      };
    }
    function oursModel() {
      var meU = me(), lists = Q.oursLists(st.ours || [], st.history || []);
      function who(q) { return q.by === meU ? host.nameOf(meU) : '단짝'; }
      return {
        waiting: lists.waiting.map(function (q) {
          var mine = q.by === meU;
          return { id: q.id, text: mine ? q.text : null, hidden: !mine, slot: host.slotOf(q.by), editable: mine && Q.canEditOurs(q, meU, st.history || []),
            line: mine ? who(q) + ' · ' + (q.ask ? T.addAsk + ' · 내일 나와요' : T.addMix + ' · 며칠 안에 나와요') : (q.ask ? T.addAsk + ' · 내일 나와요' : T.addMix + ' · 며칠 안에 나와요') };
        }),
        shown: lists.shown.map(function (q) { var kp = keyParts(q.date); return { text: q.text, slot: host.slotOf(q.by), line: who(q) + ' · ' + kp.m + '월 ' + kp.d + '일' + (q.ask ? ' · ' + T.addAsk : '') }; })
      };
    }

    // ── 열기 · 닫기 ──
    function open() {
      if (!S() || !me()) return;
      tick();
      st.open = true; st.view = 'today'; st.viewDate = st.today; st.mineWriting = null; st.loadErr = false;
      watchOurs(); loadBank().catch(function () {});
      if (st.day === null && !st.off) ensure(st.today);
      syncAnswers();
      host.focus(['[data-act="q-close"]']);
      render(true);
      try { root.scrollTo(0, 0); } catch (e) {}
    }
    function close(silent) {
      st.open = false; st.view = 'today'; st.viewDate = null; st.pastDay = undefined; st.swap = false; st.add = null; st.mineWriting = null;
      if (unsub.past) { try { unsub.past(); } catch (e) {} unsub.past = null; }
      if (unsub.ours) { try { unsub.ours(); } catch (e) {} unsub.ours = null; st.ours = null; }
      syncAnswers();
      if (!silent) { host.focus(['[data-act="q-open"]']); render(true); try { root.scrollTo(0, 0); } catch (e) {} }
    }
    /** 뒤로 (Esc · 안드로이드 뒤로 · ‹) — 맨 위 것 하나만 */
    function back() {
      if (st.add) { closeAdd(); return; }
      if (st.swap) { st.swap = false; host.focus(['[data-act="q-swap"]']); render(true); return; }
      if (st.mineWriting && st.mineWriting.editing) { st.mineWriting = null; render(true); return; }
      if (st.view === 'ours') { st.view = st.oursFrom || 'today'; host.focus(['[data-act="q-add"]']); render(true); return; }
      if (st.view === 'today' && st.viewDate && st.viewDate !== st.today) { openPast(); return; }
      if (st.view === 'past') { st.view = 'today'; st.viewDate = st.today; syncAnswers(); host.focus(['[data-act="q-past"]']); render(true); return; }
      close();
    }
    function openPast(month) {
      st.view = 'past'; st.pastMonth = month || st.pastMonth || monthKey(st.today); st.pastErr = '';
      if (unsub.past) { try { unsub.past(); } catch (e) {} unsub.past = null; }
      st.viewDate = st.today; st.pastDay = undefined; st.mineWriting = null; syncAnswers();
      loadHistory(true).then(function () { render(); }, function () { st.pastErr = '기록을 불러오지 못했어요 · 잠시 뒤 다시 열어 주세요'; render(); });
      host.focus(['.qz-hrow', '[data-act="q-past-close"]']);
      render(true);
      try { root.scrollTo(0, 0); } catch (e) {}
    }
    function openPastDay(date) {
      if (date === st.today) { st.view = 'today'; st.viewDate = st.today; syncAnswers(); render(true); return; }
      st.view = 'today'; st.viewDate = date; st.pastDay = (st.history || []).filter(function (h) { return h.date === date; })[0]; st.mineWriting = null;
      if (unsub.past) { try { unsub.past(); } catch (e) {} }
      unsub.past = S().watchQDay(date, function (doc) { st.pastDay = doc; syncAnswers(); render(); }, function () {});
      syncAnswers(); host.focus(['[data-act="q-close"]']); render(true);
      try { root.scrollTo(0, 0); } catch (e) {}
    }

    // ── 쪽지 남기기 · 고치기 ──
    function curDraft() { var el = document.getElementById('q-text'); return el ? el.value : (st.mineWriting ? st.mineWriting.draft : ''); }
    function save() {
      var d = viewedDay(); if (!d || st.busy) return;
      var w = st.mineWriting || (st.mineWriting = { draft: '', editing: false });
      w.draft = curDraft();
      var c = Q.checkAnswer(w.draft);
      if (!c.ok) { w.error = T[c.why]; render(true); return; }
      w.saving = true; w.error = ''; st.busy = true; render(true);
      var job = w.editing ? S().editAnswer(d.date, me(), c.text) : S().saveAnswer(d.date, me(), c.text);
      job.then(function () { st.busy = false; st.mineWriting = null; host.focus(['[data-act="q-like"]', '[data-act="q-edit"]']); render(true); },
        function () { st.busy = false; w.saving = false; w.error = '남기지 못했어요 · 잠시 뒤 다시 해 주세요'; render(true); });
    }
    function edit() {
      var d = viewedDay(); if (!d) return;
      var mine = ansOf(d.date, me());
      st.mineWriting = { draft: mine ? mine.text : '', editing: true, saving: false, error: '' };
      host.focus(['#q-text']); render(true);
    }
    function like() {
      var d = viewedDay(); if (!d || !Q.canLike(d, me(), partner())) return;
      var on = !(d.likes || {})[me()];
      d.likes = Object.assign({}, d.likes); if (on) d.likes[me()] = true; else delete d.likes[me()];
      render(true);
      S().setLike(d.date, me(), on).catch(function () { host.toast('저장하지 못했어요 · 잠시 뒤 다시 눌러 주세요'); });
    }

    // ── 다른 질문 ──
    function doSwap() {
      var d = st.day; if (!d || st.busy) return;
      st.busy = true;
      Promise.all([loadBank(), loadHistory(true), oursOnce()]).then(function (r) {
        var ctx = ctxFor(st.today, r[1].filter(function (h) { return h.date < st.today; }), r[2]);
        return S().swapQDay(st.today, function (cur) {
          if (!Q.canSwap(cur, st.today)) return null;
          var s = Q.swapDay(ctx, cur, { uid: me(), now: host.now() });
          return { q: s.q, text: s.text, src: 'base', by: null, skipped: s.skipped, swappedBy: me() };
        });
      }).then(function () { st.busy = false; st.swap = false; host.focus(['.qz-qtext', '[data-act="q-past"]']); render(true); },
        function () { st.busy = false; st.swap = false; host.toast('바꾸지 못했어요 · 이미 쪽지가 있거나 바꾼 질문이에요'); render(true); });
    }

    // ── 질문 넣기 · 고치기 ──
    function openAdd(id) {
      var q = id ? (st.ours || []).filter(function (x) { return x.id === id; })[0] : null;
      st.add = { id: q ? q.id : null, text: q ? q.text : '', ask: q ? q.ask : true, error: '', saving: false };
      st.entering = true; host.focus(['#q-qtext'], true); render(true);
    }
    function closeAdd() { var id = st.add && st.add.id; st.add = null; host.focus([id ? '[data-act="q-ours-edit"][data-v="' + id + '"]' : '[data-act="q-add"]']); render(true); }
    function saveAdd() {
      var f = st.add; if (!f || f.saving) return;
      var el = document.getElementById('q-qtext'); if (el) f.text = el.value;
      loadBank().then(function (b) {
        var others = (st.ours || []).filter(function (x) { return x.id !== f.id; });
        var c = Q.checkQuestion(f.text, { bank: b, ours: others });
        if (!c.ok) { f.error = T[c.why]; host.focus(['#q-qtext'], true); render(true); return; }
        f.saving = true; render(true);
        var job = f.id ? S().editOurs(f.id, c.text, f.ask) : S().addOurs(me(), c.text, f.ask);
        return job.then(function () { var wasEdit = !!f.id; st.add = null; host.toast(wasEdit ? '질문을 고쳤어요' : (f.ask ? '내일 질문으로 넣었어요' : '목록에 섞어 뒀어요')); render(true); });
      }).catch(function () { if (st.add) { st.add.saving = false; st.add.error = '넣지 못했어요 · 잠시 뒤 다시 해 주세요'; render(true); } });
    }
    function delOurs() {
      var f = st.add; if (!f || !f.id || f.saving) return;
      if (!f.confirm) { f.confirm = true; f.error = '한 번 더 누르면 지워요'; render(true); return; }
      f.saving = true; render(true);
      S().deleteOurs(f.id).then(function () { st.add = null; host.toast('질문을 지웠어요'); render(true); },
        function () { if (st.add) { st.add.saving = false; st.add.error = '지우지 못했어요'; render(true); } });
    }

    // ── 누르기 · 입력 ──
    function act(a, btn) {
      var v = btn.getAttribute('data-v');
      if (a === 'q-open') open();
      else if (a === 'q-close') back();
      else if (a === 'q-past') openPast();
      else if (a === 'q-past-close') { st.view = 'today'; st.viewDate = st.today; syncAnswers(); host.focus(['[data-act="q-past"]']); render(true); }
      else if (a === 'q-past-month') { st.pastMonth = shiftMonth(st.pastMonth, Number(btn.getAttribute('data-dir'))); host.focus(['[data-act="q-past-month"][data-dir="' + btn.getAttribute('data-dir') + '"]:not(:disabled)', '[data-act="q-past-month"]:not(:disabled)']); render(true); }
      else if (a === 'q-past-day') openPastDay(v);
      else if (a === 'q-save') save();
      else if (a === 'q-edit') edit();
      else if (a === 'q-edit-cancel') { st.mineWriting = null; host.focus(['[data-act="q-edit"]']); render(true); }
      else if (a === 'q-like') like();
      else if (a === 'q-kung') { if (host.kung.ready()) host.kung.send(); }
      else if (a === 'q-swap') { var d = st.day; if (d && Q.canSwap(d, st.today)) { st.swap = true; st.entering = true; host.focus(['[data-act="q-swap-no"]:not(.scrim)'], true); render(true); } }
      else if (a === 'q-swap-no') { st.swap = false; host.focus(['[data-act="q-swap"]']); render(true); }
      else if (a === 'q-swap-yes') doSwap();
      else if (a === 'q-add') openAdd(null);
      else if (a === 'q-add-close') closeAdd();
      else if (a === 'q-add-ask') { if (st.add) { var el = document.getElementById('q-qtext'); if (el) st.add.text = el.value; st.add.ask = v === 'ask'; host.focus(['[data-act="q-add-ask"][data-v="' + v + '"]'], true); render(true); } }
      else if (a === 'q-add-save') saveAdd();
      else if (a === 'q-ours-del') delOurs();
      else if (a === 'q-ours') { var el2 = document.getElementById('q-qtext'); if (el2 && st.add) st.add.text = el2.value; st.add = null; st.oursFrom = st.view; st.view = 'ours'; loadHistory(true).then(function () { render(); }, function () {}); host.focus(['[data-act="q-ours-close"]']); render(true); try { root.scrollTo(0, 0); } catch (e) {} }
      else if (a === 'q-ours-close') { st.view = st.oursFrom === 'past' ? 'past' : 'today'; host.focus(['[data-act="q-add"]', '[data-act="q-past-close"]']); render(true); }
      else if (a === 'q-ours-edit') openAdd(v);
      else return false;
      return true;
    }
    function input(id, value) {
      if (id === 'q-text') {
        var w = st.mineWriting || (st.mineWriting = { draft: '', editing: false, saving: false, error: '' });
        w.draft = value;
        var c = document.getElementById('q-count'); if (c) c.textContent = Array.from(value).length + ' / 300';
        var b = document.querySelector('[data-act="q-save"]'); if (b) b.disabled = !value.trim() || !!w.saving;
        return true;
      }
      if (id === 'q-qtext' && st.add) {
        st.add.text = value; st.add.confirm = false;
        var n = document.getElementById('q-qcount'); if (n) n.textContent = Array.from(value).length;
        return true;
      }
      return false;
    }

    // ── 그리기 ──
    function screenHtml() {
      if (st.view === 'past') return V.past(pastModel());
      if (st.view === 'ours') return V.ours(oursModel());
      return V.screen(screenModel());
    }
    function sheetHtml() {
      var e = st.entering; st.entering = false;
      if (st.add) return V.addSheet(st.add, e);
      if (st.swap) return V.swapSheet(e);
      return '';
    }

    return {
      tick: tick, stop: function () { close(true); stopAll(); }, open: open, close: close, back: back, openPast: openPast,
      isOpen: function () { return st.open; }, hasSheet: function () { return st.open && (!!st.add || st.swap); },
      act: act, input: input, screenHtml: screenHtml, sheetHtml: sheetHtml, entryModel: entryModel,
      // 시험 · 점검용
      _st: st, _screenModel: screenModel
    };
  }

  root.RT = root.RT || {};
  root.RT.appQuestion = { create: create, timeLabel: timeLabel, dayLabel: dayLabel };
})(typeof window !== 'undefined' ? window : globalThis);
