/* 집중 F1 (docs/focus/spec.md) — 화면 상태 · 저장 · 구독 · 타이머. app.js 가 host 를 넘겨 만든다 (RT.appFocus.create(host)).
   계산은 js/focus.js, 글은 js/focus-text.js, 그리기는 js/view-focus.js. 저장은 js/store.js.
   지키는 것: 시간은 시작 시각 기준으로 계산(타이머로 더하지 않음), 자리 비움은 상태 'away' 하나만 저장(횟수 · 시간은 이 기기에만),
   함께 시간은 저장하지 않고 두 사람 구간이 겹친 만큼 계산, 하루는 새벽 5시. */
(function (root) {
  'use strict';
  var RT = root.RT, F = RT.focus, T = RT.focusText.T, V = RT.viewFocus;
  var LS = 'danjjakkung.focus';

  function create(host) {
    var st = { started: false, docs: {}, docsReady: {}, logs: null, logsOff: false, logsFrom: null, screen: false, done: null, sheet: null, entering: false,
      wpick: null, wake: null, wakeLock: null, timer: null, hiddenAt: null, awayMs: 0, awayTimer: null, busy: false, minute: -1 };
    var unsub = [];
    var loc = {};
    try { loc = JSON.parse(root.localStorage.getItem(LS) || '{}') || {}; } catch (e) { loc = {}; }
    function saveLoc() { try { root.localStorage.setItem(LS, JSON.stringify(loc)); } catch (e) {} }
    function S() { return host.store(); }
    function me() { return host.me(); }
    function her() { return host.partner(); }
    function now() { return host.now(); }
    function render(f) { host.render(f); }
    function toast(t) { host.toast(t); }

    // ── 구독 ── 내 문서 · 짝꿍 문서 · 이번 주(+어제) 기록
    function tick() {
      if (!S() || !me()) return;
      var from = F.addDays(F.weekStart(F.dayKey(now())), 0), y = F.addDays(F.dayKey(now()), -1);
      if (y < from) from = y;
      if (st.started && st.logsFrom !== from) { stopLogs(); }
      st.started = true;
      st.subbed = st.subbed || {};
      [me(), her()].filter(Boolean).forEach(function (u) { // 짝꿍은 멤버 목록이 늦게 오면 그때 붙임
        if (st.subbed[u]) return;
        st.subbed[u] = true;
        unsub.push(S().watchFocus(u, function (d) { st.docs[u] = d; st.docsReady[u] = true; afterChange(); schedule(); render(); }, function () { st.docsReady[u] = true; st.logsOff = true; render(); }));
      });
      if (!st.logsFrom) {
        st.logsFrom = from;
        st.logUnsub = S().watchFocusLogs(from, function (list) { st.logs = list; st.logsOff = false; render(); }, function () { st.logs = []; st.logsOff = true; render(); });
      }
      schedule();
    }
    function stopLogs() { if (st.logUnsub) { try { st.logUnsub(); } catch (e) {} } st.logUnsub = null; st.logsFrom = null; }
    function stop() {
      unsub.forEach(function (f) { try { f(); } catch (e) {} }); unsub = []; stopLogs();
      st.started = false; st.subbed = {}; st.docs = {}; st.docsReady = {}; st.logs = null; st.screen = false; st.done = null; st.sheet = null;
      if (st.timer) { clearInterval(st.timer); st.timer = null; }
      releaseWake();
    }

    // ── 지금 값 ──
    function myDoc() { return st.docs[me()] || null; }
    function myLive() { return F.live(myDoc(), now()); }
    function herLive() { return her() ? F.live(st.docs[her()], now()) : null; }
    function lives() { var o = {}; o[me()] = myLive(); if (her()) o[her()] = herLive(); return o; }
    function myState() { var s = myLive().state; return s === 'stale' ? 'stale' : s; }
    function catName(id) { var c = host.cats().filter(function (x) { return x.id === id; })[0]; return c ? c.name : T.noCat; }
    function catIcon(id) { var c = host.cats().filter(function (x) { return x.id === id; })[0]; return c ? c.icon : ''; }
    function subjOf(cat, label) { return T.subj(catName(cat), label); }
    function strictPref() { var u = host.user(); return !!(u && u.focusMode === 'strict') || loc.mode === 'strict' && !(u && u.focusMode === 'loose'); }
    function totals() { return F.totals(st.logs || [], lives(), me(), her(), now()); }
    function sessionMs() { return myLive().runMs; }

    // ── 시작 · 쉬기 · 다시 · 끝 ──
    function write(body) {
      st.docs[me()] = body; // 화면에 먼저
      render(true);
      return S().setFocus(me(), body).catch(function () { toast(T.tFail); });
    }
    function remember(cat, label) {
      loc.cats = [cat].concat((loc.cats || []).filter(function (c) { return c !== cat; })).slice(0, 16);
      if (label) { loc.labels = loc.labels || {}; loc.labels[cat] = [label].concat((loc.labels[cat] || []).filter(function (l) { return l !== label; })).slice(0, 5); }
      loc.lastCat = cat; saveLoc();
    }
    function start(cat, label, opts) {
      opts = opts || {};
      var cur = myDoc(), t = now();
      var go = function () {
        remember(cat, label);
        var call = cur && cur.call || null;
        write({ state: 'run', cat: cat || null, label: label || null, start: t, segStart: t, segs: [], pauseAt: null, strict: strictPref(), call: call });
        st.done = null; st.sheet = null;
        if (opts.screen !== false) { st.screen = true; host.screenOpened(); }
        if (opts.toast) toast(opts.toast);
        updateWake();
      };
      var s = myState();
      if (s === 'run' || s === 'pause' || s === 'away') return finish({ quiet: true }).then(go);
      go();
      return Promise.resolve();
    }
    function pause() {
      var d = myDoc(); if (!d || d.state !== 'run') return;
      var t = now();
      write(Object.assign({}, d, { state: 'pause', segs: (d.segs || []).concat([[d.segStart, t]]), segStart: null, pauseAt: t }));
      updateWake();
    }
    function resume() {
      var d = myDoc(); if (!d || (d.state !== 'pause' && d.state !== 'away')) return;
      write(Object.assign({}, d, { state: 'run', segStart: now(), pauseAt: null }));
      st.awayMs = 0;
      updateWake();
    }
    function goAway(at) {
      var d = myDoc(); if (!d || d.state !== 'run') return;
      write(Object.assign({}, d, { state: 'away', segs: (d.segs || []).concat([[d.segStart, Math.max(d.segStart, at)]]), segStart: null, pauseAt: null }));
    }
    /** 끝내기 — opts.end = 끝 시각(늦게 고른 끝 · 쉬기 30분), opts.quiet = 요약 없이(과목 바꾸기) */
    function finish(opts) {
      opts = opts || {};
      var d = myDoc(); if (!d || !d.state || d.state === 'idle') return Promise.resolve();
      var endAt = opts.end || now(), cap = d.start + F.AUTO_STOP;
      var segs = (d.segs || []).slice();
      if (d.state === 'run' && d.segStart) segs.push([d.segStart, endAt]);
      segs = F.clip(segs, d.start, Math.min(endAt, cap));
      var total = F.sum(segs);
      var idle = { state: 'idle', cat: d.cat || null, label: d.label || null, start: null, segStart: null, segs: [], pauseAt: null, strict: strictPref(), call: d.call || null };
      var subj = subjOf(d.cat, d.label);
      st.sheet = null;
      if (total < F.MIN_SAVE) {
        st.docs[me()] = idle; st.screen = opts.keepScreen ? st.screen : false; render(true); releaseWake();
        if (!opts.quiet) toast(T.tShort);
        return S().setFocus(me(), idle).catch(function () { toast(T.tFail); });
      }
      var parts = F.byDay(segs), logs = Object.keys(parts).sort().map(function (k) {
        var ss = parts[k];
        return { by: me(), cat: d.cat || null, label: d.label || null, day: k, start: ss[0][0], end: ss[ss.length - 1][1], ms: F.sum(ss), segs: ss, strict: !!d.strict };
      }).filter(function (l) { return l.ms >= F.MIN_SAVE; });
      st.docs[me()] = idle;
      var showDone = st.screen && !opts.quiet;
      if (!showDone) st.screen = false;
      releaseWake();
      // 기록을 화면에 먼저 (구독이 돌아오기 전에도 합계가 맞게)
      var temp = logs.map(function (l, i) { return Object.assign({ id: 'tmp' + now() + i }, l); });
      st.logs = (st.logs || []).concat(temp);
      if (showDone) st.done = doneModel(total, subj, null);
      render(true);
      if (!showDone && !opts.quiet) toast(T.tDone(total));
      return S().endFocus(me(), logs, idle).then(function (ids) {
        if (st.done && ids && ids.length) st.done.logId = ids[ids.length - 1];
        render();
      }, function () { toast(T.tFail); });
    }
    function doneModel(thisMs, subj) {
      var t = totals(), w = F.week(st.logs || [], lives(), me(), her(), now());
      return { today: t.me, subj: subj, thisMs: thisMs, both: t.both, herWeek: w.weekHer, meWeek: w.weekMe, s3: host.art('s3', 'fc-s3__img', 'done') };
    }
    function call() {
      var d = myDoc() || { state: 'idle', segs: [], strict: strictPref() };
      var hd = her() ? st.docs[her()] : null;
      if (d.call && now() - d.call < F.CALL_GAP) { toast(T.tCallWait); return; }
      write(Object.assign({}, d, { call: now() }));
      toast(T.tCalled(host.nameOf(her())));
      void hd;
    }

    // ── 저절로 일어나는 것: 3시간 물음 · 6시간 멈춤 · 쉬기 30분 · 짝꿍의 같이 하자 ──
    function afterChange() {
      var d = myDoc(), t = now();
      if (d && d.state === 'pause' && d.pauseAt && t - d.pauseAt >= F.PAUSE_END && !st.busy) {
        st.busy = true; var at = d.pauseAt;
        finish({ end: at, quiet: true }).then(function () { st.busy = false; toast(T.tPauseLong(at)); });
        return;
      }
      if (d && d.state && d.state !== 'idle' && d.start && t >= d.start + F.AUTO_STOP && (!st.sheet || st.sheet.kind !== 'end')) openEndAsk();
      else if (d && d.state === 'run' && t - d.start >= F.LONG_ASK && loc.asked !== d.start && !st.sheet && !document.hidden) { st.sheet = { kind: 'still' }; st.entering = true; }
      var hd = her() ? st.docs[her()] : null;
      if (hd && hd.call && t - hd.call < F.CALL_GAP && loc.seenCall !== hd.call && myState() !== 'run') {
        loc.seenCall = hd.call; saveLoc();
        setTimeout(function () { toast(T.tCalledMe(host.nameOf(her()))); }, 0);
      }
    }
    function openEndAsk() {
      var d = myDoc(); if (!d) return;
      var cap = d.start + F.AUTO_STOP, seen = loc.seen && loc.seen > d.start && loc.seen < cap ? loc.seen : null;
      st.sheet = { kind: 'end', pick: seen || cap }; st.entering = true;
    }

    // ── 엄격 모드: 앱을 나가고 5초 (spec 1-4, tests C9) ──
    function onVisibility() {
      var d = myDoc();
      if (document.hidden) {
        loc.seen = now(); saveLoc();
        if (d && d.state === 'run' && d.strict) {
          st.hiddenAt = now(); loc.hiddenAt = st.hiddenAt; saveLoc();
          clearTimeout(st.awayTimer);
          st.awayTimer = setTimeout(function () { if (document.hidden && st.hiddenAt) goAway(st.hiddenAt); }, F.STRICT_GRACE);
        }
        releaseWake();
        return;
      }
      clearTimeout(st.awayTimer);
      var hid = st.hiddenAt || loc.hiddenAt || null;
      st.hiddenAt = null; delete loc.hiddenAt; saveLoc();
      d = myDoc();
      if (hid && d && d.strict && (d.state === 'run' || d.state === 'away') && d.start && hid >= d.start) {
        var gone = now() - hid;
        if (gone > F.STRICT_GRACE) {
          if (d.state === 'run') goAway(hid);
          st.awayMs = gone; st.screen = true; host.screenOpened();
        }
      }
      updateWake();
      afterChange();
      render(true);
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

    // ── 화면 켜 두기 (Wake Lock) ──
    function updateWake() {
      var want = st.screen && !st.done && myState() === 'run' && !document.hidden;
      if (!want) { releaseWake(); return; }
      if (st.wakeLock) return;
      var nav = root.navigator;
      if (!nav || !nav.wakeLock || !nav.wakeLock.request) { st.wake = false; return; }
      nav.wakeLock.request('screen').then(function (l) { st.wakeLock = l; st.wake = true; l.addEventListener && l.addEventListener('release', function () { st.wakeLock = null; }); }, function () { st.wake = false; render(); });
    }
    function releaseWake() { if (st.wakeLock) { try { st.wakeLock.release(); } catch (e) {} st.wakeLock = null; } }

    // ── 1초 타이머: 숫자 칸만 바꿈, 1분마다 다시 그림 ──
    function anyOn() { var a = myState(), b = herLive() ? herLive().state : 'idle'; return ['run', 'pause', 'away'].indexOf(a) >= 0 || ['run', 'pause', 'away'].indexOf(b) >= 0; }
    function schedule() {
      var want = anyOn();
      if (want && !st.timer) st.timer = setInterval(second, 1000);
      if (!want && st.timer) { clearInterval(st.timer); st.timer = null; }
    }
    function second() {
      if (document.hidden) return;
      var m = Math.floor(now() / 60000);
      if (m !== st.minute) { st.minute = m; loc.seen = now(); saveLoc(); afterChange(); render(); return; }
      paintNumbers();
    }
    function setText(sel, text) { var els = document.querySelectorAll('[data-fc="' + sel + '"]'); for (var i = 0; i < els.length; i++) if (els[i].textContent !== text) els[i].textContent = text; }
    function paintNumbers() {
      var t = totals(), lv = myLive();
      setText('today', F.hms(t.me));
      setText('nowR', T.nowRight(lv.runMs));
      setText('run', F.hms(lv.runMs));
      setText('sum', T.todaySum(t.me));
      var ring = document.querySelector('[data-fc="ring"]');
      if (ring && lv.state === 'run') {
        var p = (lv.runMs % F.H) / F.H;
        ring.setAttribute('stroke-dashoffset', (V.RING_C * (1 - p)).toFixed(1));
        var tip = document.querySelector('[data-fc="tip"]');
        if (tip) { var a = p * 2 * Math.PI - Math.PI / 2; tip.setAttribute('cx', (144 + V.RING_R * Math.cos(a)).toFixed(1)); tip.setAttribute('cy', (144 + V.RING_R * Math.sin(a)).toFixed(1)); }
      }
    }

    // ── 화면 값 ──
    function herModel(t) {
      if (!her()) return null;
      var hl = herLive(), ready = st.docsReady[her()];
      var state = ready ? F.shownState(hl) : null;
      var hd = st.docs[her()] || {};
      var mine = myDoc();
      return { state: state, slot: host.slotOf(her()), runMs: hl ? hl.runMs : 0, today: t.her, strict: !!hd.strict, subj: hl && hl.cat !== undefined && state && state !== 'idle' ? subjOf(hl.cat, hl.label) : '',
        together: (function () { var since = F.togetherSince(myLive(), hl); return since ? now() - since : 0; })(),
        btn: state == null ? null : F.partnerButton(state === 'away' || state === 'pause' ? 'busy' : state, mine && mine.call, now()) };
    }
    function tabModel() {
      var t = totals(), lv = myLive(), cats = host.cats(), logs = st.logs || [];
      var on = lv.state === 'run' || lv.state === 'pause' || lv.state === 'away';
      var order = F.recentCats(cats, logs, me(), loc.cats);
      var todayLogs = logs.filter(function (l) { return l.by === me() && l.day === t.day; });
      var byCat = {}, labs = {};
      todayLogs.forEach(function (l) { byCat[l.cat || ''] = (byCat[l.cat || ''] || 0) + l.ms; if (l.label) { labs[l.cat] = labs[l.cat] || {}; labs[l.cat][l.label] = (labs[l.cat][l.label] || 0) + l.ms; } });
      if (on) { var cd = F.byDay(lv.segs)[t.day]; if (cd) byCat[lv.cat || ''] = (byCat[lv.cat || ''] || 0) + F.sum(cd); }
      var show = order.slice(0, 3);
      if (on && lv.cat && show.indexOf(lv.cat) < 0) show = [lv.cat].concat(show.slice(0, 2));
      var subjects = show.map(function (id) {
        var l = labs[id] ? Object.keys(labs[id]).map(function (k) { return k + ' ' + F.hm(labs[id][k]); }).join(' · ') : '';
        return { id: id, name: catName(id), icon: catIcon(id), todayMs: byCat[id] || 0, labels: l, active: on && lv.cat === id, activeLabel: lv.label, activeMs: lv.runMs };
      });
      var w = F.week(logs, lives(), me(), her(), now());
      var pick = st.wpick != null && !w.days[st.wpick].future ? st.wpick : F.weekdayOf(t.day);
      var hm = herModel(t);
      return { date: host.dateText(), strict: on ? !!lv.strict : strictPref(), herName: host.nameOf(her()), herSlot: host.slotOf(her()),
        first: !on && !logs.some(function (l) { return l.by === me(); }) && !t.me,
        me: { state: lv.state, runMs: lv.runMs, subj: subjOf(lv.cat, lv.label) },
        today: { me: t.me, her: t.her, both: t.both, nowBoth: !!F.togetherSince(lv, herLive()), compare: on ? null : F.compare(t.me, t.yesterday) },
        her: hm, subjects: subjects, moreCount: Math.max(0, cats.length - subjects.length),
        week: { days: w.days, empty: !w.weekMe && !w.weekHer, pick: pick } };
    }
    function screenModel() {
      var t = totals(), lv = myLive(), hl = herLive(), since = F.togetherSince(lv, hl);
      var badge = since ? { kind: 'both', ms: now() - since } : lv.state === 'pause' && lv.pauseAt ? { kind: 'pause', ms: now() - lv.pauseAt } : null;
      var s3 = host.isPixel() && root.innerHeight >= 700 && root.innerWidth > 340 ? host.art('s3', 'fc-s3__img', 'focus') : '';
      return { done: st.done, state: lv.state === 'stale' ? 'pause' : lv.state, runMs: lv.runMs, todayMs: t.me, progress: (lv.runMs % F.H) / F.H, subj: subjOf(lv.cat, lv.label), strict: !!lv.strict,
        meSlot: host.slotOf(me()), badge: badge, wake: st.wake, awayMs: st.awayMs, s3: s3, reduceMotion: host.reduceMotion(), herName: host.nameOf(her()), her: herModel(t),
        pixelRing: host.isPixel() && RT.focusRing ? RT.focusRing.svg(lv.state === 'run' ? (lv.runMs % F.H) / F.H : (lv.runMs % F.H) / F.H, lv.state !== 'run') : '' };
    }
    function bandModel() {
      var lv = myLive(), hl = herLive();
      var kind = F.band(lv.state, hl ? F.shownState(hl) : 'idle');
      if (!kind) return null;
      if (kind === 'partner') return { kind: kind, name: host.nameOf(her()), cat: catName(hl.cat), ms: hl.runMs };
      if (kind === 'both') return { kind: kind, ms: now() - F.togetherSince(lv, hl) };
      if (kind === 'mepause') return { kind: kind, ms: lv.pauseAt ? now() - lv.pauseAt : 0 };
      return { kind: kind, subj: subjOf(lv.cat, lv.label), ms: lv.runMs };
    }
    function dotModel(onFocus) {
      var lv = myLive(), hl = herLive();
      var s = F.dot(lv.state, hl ? F.shownState(hl) : 'idle', onFocus);
      if (!s.length) return null;
      return { slots: s.map(function (x) { return x === 'me' ? host.slotOf(me()) : host.slotOf(her()); }), label: s.length === 2 ? T.dotBoth : s[0] === 'her' ? T.dotPartner(host.nameOf(her())) : T.dotMe };
    }

    // ── 시트 값 ──
    function subjSheetModel() {
      var s = st.sheet, cats = host.cats(), order = F.recentCats(cats, st.logs || [], me(), loc.cats);
      var list = (s.expanded ? order : order.slice(0, 6)).map(function (id) { return { id: id, name: catName(id), icon: catIcon(id), picked: id === s.cat }; });
      var labels = s.cat ? F.recentLabels(st.logs || [], me(), s.cat, loc.labels && loc.labels[s.cat]) : [];
      return { cats: list, more: s.expanded ? 0 : Math.max(0, order.length - 6), cat: s.cat, label: s.label || '', labels: labels, subj: s.cat ? subjOf(s.cat, s.label) : '', mode: s.mode };
    }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function localInput(ms) { var d = new Date(ms + 9 * F.H); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
    function fromLocalInput(v) { var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 9 * F.H : null; }
    function endSheetModel() {
      var d = myDoc() || {}, cap = d.start + F.AUTO_STOP, s = st.sheet;
      var seen = loc.seen && loc.seen > d.start && loc.seen < cap ? loc.seen : null;
      var chips = [];
      if (seen) chips.push({ t: seen, label: T.endSeen(seen) });
      for (var h = Math.ceil((d.start + 1) / F.H) * F.H; h <= cap; h += F.H) chips.push({ t: h, label: F.clock(h) });
      chips.forEach(function (c) { c.picked = c.t === s.pick; });
      var segs = (d.segs || []).slice(); if (d.state === 'run' && d.segStart) segs.push([d.segStart, cap]);
      return { start: d.start, chips: chips, min: localInput(d.start), max: localInput(cap), value: localInput(s.pick), ms: F.sum(F.clip(segs, d.start, s.pick)) };
    }
    function logById(id) { return (st.logs || []).filter(function (l) { return l.id === id; })[0] || null; }
    function editSheetModel() {
      var s = st.sheet, l = logById(s.id); if (!l) return null;
      var start = s.start != null ? s.start : l.start, end = s.end != null ? s.end : l.end, cat = s.cat !== undefined ? s.cat : l.cat, label = s.label !== undefined ? s.label : l.label;
      var others = (st.logs || []).filter(function (x) { return x.by === me() && x.id !== l.id; }).map(function (x) { return [x.start, x.end]; });
      var chk = F.checkEdit(start, end, others, now());
      var err = chk ? (chk.err === 'overlap' ? T.overlapErr(chk.with) : chk.err === 'order' ? T.orderErr : chk.err === 'future' ? T.futureErr : T.shortErr) : '';
      return { subj: subjOf(cat, label), startVal: F.clock(start), endVal: F.clock(end), err: err, ms: editedMs(l, start, end), confirmDel: !!s.confirmDel };
    }
    function editedMs(l, start, end) {
      if (start === l.start && end === l.end) return l.ms;
      var segs = F.clip(l.segs || [[l.start, l.end]], start, end);
      if (start < l.start) segs.unshift([start, Math.min(l.start, end)]);
      if (end > l.end) segs.push([Math.max(l.end, start), end]);
      return F.sum(segs);
    }
    function timeOnDay(baseMs, hhmm) { // 'HH:MM' → 같은 집중 하루 안의 ms (새벽 5시 앞은 다음 날)
      var m = /^(\d{2}):(\d{2})$/.exec(hhmm || ''); if (!m) return null;
      var key = F.dayKey(baseMs), t = F.dayStart(key) - 5 * F.H + (+m[1]) * F.H + (+m[2]) * F.M;
      if (+m[1] < 5) t += 24 * F.H;
      return t;
    }

    // ── 바깥에서 부르는 것 ──
    function tabHtml() {
      if (st.screen) return V.screen(screenModel());
      if (st.logsOff && st.logs && !st.logs.length && !myDoc()) return V.tab({ date: host.dateText(), strict: strictPref(), error: T.tFail });
      return V.tab(tabModel());
    }
    function sheetHtml() {
      var s = st.sheet; if (!s) return '';
      var e = st.entering; st.entering = false;
      if (s.kind === 'subj') return V.subjSheet(subjSheetModel(), e);
      if (s.kind === 'set') { var lv = myLive(); return V.settingsSheet({ strict: strictPref(), busy: lv.state === 'run' || lv.state === 'pause' || lv.state === 'away', herName: host.nameOf(her()) }, e); }
      if (s.kind === 'still') return V.stillSheet({ start: (myDoc() || {}).start }, e);
      if (s.kind === 'end') return myDoc() && myDoc().start ? V.endSheet(endSheetModel(), e) : '';
      if (s.kind === 'log') {
        var t = F.dayKey(now());
        return V.logSheet({ rows: (st.logs || []).filter(function (l) { return l.by === me() && l.day === t; }).sort(function (a, b) { return a.start - b.start; }).map(function (l) { return { id: l.id, start: l.start, end: l.end, subj: subjOf(l.cat, l.label), ms: l.ms }; }) }, e);
      }
      if (s.kind === 'edit') { var em = editSheetModel(); if (!em) { st.sheet = null; return ''; } return V.editSheet(em, e); }
      return '';
    }
    function openSheet(sh) { st.sheet = sh; st.entering = true; host.focus(['.fc-sheet .sheet__title'], true); render(true); }
    function closeSheet() {
      var s = st.sheet; if (!s) return;
      if (s.kind === 'still') { loc.asked = (myDoc() || {}).start; saveLoc(); }
      if (s.kind === 'end') return; // 끝난 시각은 꼭 골라야 함 (기록하지 않을래요도 있음)
      if (s.kind === 'edit' && s.confirmDel) { s.confirmDel = false; render(true); return; }
      if (s.kind === 'subj' && s.back) { st.sheet = s.back; render(true); return; }
      st.sheet = null; render(true);
    }
    function act(a, btn) {
      var v = btn && btn.getAttribute('data-v');
      switch (a) {
        case 'fc-play': start(v, null, {}); return true;
        case 'fc-end': finish({}); return true;
        case 'fc-open': st.screen = true; host.screenOpened(); updateWake(); render(true); return true;
        case 'fc-down': down(); return true;
        case 'fc-pause': pause(); return true;
        case 'fc-resume': resume(); return true;
        case 'fc-done-ok': st.done = null; st.screen = false; render(true); return true;
        case 'fc-call': call(); return true;
        case 'fc-join': openSheet({ kind: 'subj', mode: 'join', cat: loc.lastCat || (host.cats()[0] || {}).id || null, label: '' }); return true;
        case 'fc-subj': openSheet({ kind: 'subj', mode: 'start', cat: loc.lastCat || (host.cats()[0] || {}).id || null, label: '', expanded: v !== 'label' }); if (v === 'label') host.focus(['#fc-label'], true); return true;
        case 'fc-pick': st.sheet.cat = v; render(true); return true;
        case 'fc-catmore': st.sheet.expanded = true; render(true); return true;
        case 'fc-lchip': st.sheet.label = st.sheet.label === v ? '' : v; render(true); return true;
        case 'fc-start':
          if (st.sheet && st.sheet.kind === 'subj' && st.sheet.cat) {
            if (st.sheet.mode === 'change' && st.sheet.back) { var bk = st.sheet.back; bk.cat = st.sheet.cat; bk.label = F.cleanLabel(st.sheet.label) || null; st.sheet = bk; render(true); return true; }
            var c = st.sheet.cat, l = F.cleanLabel(st.sheet.label) || null; st.sheet = null; start(c, l, {});
          }
          return true;
        case 'fc-settings': openSheet({ kind: 'set' }); return true;
        case 'fc-mode': {
          var lv = myLive(); if (lv.state === 'run' || lv.state === 'pause' || lv.state === 'away') { toast(T.tBusyMode); return true; }
          loc.mode = v === 'strict' ? 'strict' : 'loose'; saveLoc(); host.saveUser('focusMode', loc.mode); render(true); return true;
        }
        case 'fc-sheet-close': closeSheet(); return true;
        case 'fc-still-yes': loc.asked = (myDoc() || {}).start; saveLoc(); st.sheet = null; render(true); return true;
        case 'fc-endpick': st.sheet.pick = Number(v); render(true); return true;
        case 'fc-endsave': { var pk = st.sheet.pick; st.sheet = null; finish({ end: pk, quiet: false }); return true; }
        case 'fc-endskip': {
          var d0 = myDoc(); st.sheet = null; if (!d0) return true;
          var idle = { state: 'idle', cat: d0.cat || null, label: d0.label || null, start: null, segStart: null, segs: [], pauseAt: null, strict: strictPref(), call: d0.call || null };
          write(idle); st.screen = false; return true;
        }
        case 'fc-noop': return true;
        case 'fc-log': openSheet({ kind: 'log' }); return true;
        case 'fc-edit': { var lg = logById(v); if (!lg) return true; if (lg.by !== me()) { toast(T.readOnly); return true; } openSheet({ kind: 'edit', id: v, back: st.sheet && st.sheet.kind === 'log' ? st.sheet : null }); return true; }
        case 'fc-edit-subj': { var es = st.sheet, l0 = logById(es.id); openSheet({ kind: 'subj', mode: 'change', cat: es.cat !== undefined ? es.cat : l0.cat, label: (es.label !== undefined ? es.label : l0.label) || '', back: es }); return true; }
        case 'fc-editsave': saveEdit(); return true;
        case 'fc-del': st.sheet.confirmDel = true; render(true); return true;
        case 'fc-delno': st.sheet.confirmDel = false; render(true); return true;
        case 'fc-delyes': { var id = st.sheet.id; st.sheet = null; st.logs = (st.logs || []).filter(function (x) { return x.id !== id; }); render(true); S().deleteFocusLog(id).then(function () { toast(T.tDeleted); }, function () { toast(T.tFail); }); return true; }
        case 'fc-wday': st.wpick = Number(v); render(true); return true;
        case 'fc-band': {
          if (v === 'partner') openSheet({ kind: 'subj', mode: 'join', cat: loc.lastCat || (host.cats()[0] || {}).id || null, label: '' });
          else { st.screen = true; host.screenOpened(); updateWake(); render(true); }
          return true;
        }
      }
      return false;
    }
    function saveEdit() {
      var s = st.sheet, l = logById(s.id); if (!l) return;
      var m = editSheetModel(); if (!m || m.err) return;
      var start = s.start != null ? s.start : l.start, end = s.end != null ? s.end : l.end;
      var segs = F.clip(l.segs || [[l.start, l.end]], start, end);
      if (start < l.start) segs.unshift([start, Math.min(l.start, end)]);
      if (end > l.end) segs.push([Math.max(l.end, start), end]);
      segs = F.norm(segs);
      var body = { by: l.by, cat: s.cat !== undefined ? s.cat : l.cat, label: s.label !== undefined ? s.label : (l.label || null), day: F.dayKey(start), start: start, end: end, ms: F.sum(segs), segs: segs, strict: !!l.strict, createdAt: l.createdAt || now() };
      st.logs = (st.logs || []).map(function (x) { return x.id === l.id ? Object.assign({ id: l.id }, body) : x; });
      if (st.done) st.screen = false; // 끝냄 요약에서 고쳤으면 집중 탭으로
      st.sheet = null; st.done = null; render(true);
      S().updateFocusLog(l.id, body).then(function () { toast(T.tEdited); }, function () { toast(T.tFail); });
    }
    function input(id, value) {
      var s = st.sheet;
      if (id === 'fc-label' && s && s.kind === 'subj') {
        s.label = value;
        var n = document.getElementById('fc-label-n'); if (n) n.textContent = T.labelCount(Array.from(value || '').length);
        var go = document.querySelector('.fc-sheet [data-act="fc-start"]');
        if (go && s.mode !== 'change' && s.cat) go.textContent = T.startBtn(subjOf(s.cat, F.cleanLabel(value)));
        return true;
      }
      if (id === 'fc-endtime' && s && s.kind === 'end') { var t = fromLocalInput(value); var d = myDoc(); if (t && d && t > d.start && t <= d.start + F.AUTO_STOP) { s.pick = t; } return true; }
      if ((id === 'fc-es' || id === 'fc-ee') && s && s.kind === 'edit') {
        var l = logById(s.id); if (!l) return true;
        var tt = timeOnDay(l.start, value); if (tt == null) return true;
        if (id === 'fc-es') s.start = tt; else s.end = tt;
        return true;
      }
      return false;
    }
    function down() { st.screen = false; st.done = null; releaseWake(); render(true); }

    return {
      tick: tick, stop: stop, act: act, input: input, tabHtml: tabHtml, sheetHtml: sheetHtml,
      hasSheet: function () { return !!st.sheet; }, closeSheet: closeSheet, screenOpen: function () { return st.screen; }, down: down,
      bandHtml: function () { return V.band(bandModel()); }, dot: dotModel, schedule: schedule,
      openScreen: function () { st.screen = true; updateWake(); },
      // 시험 · 다른 모듈용
      _st: st, _models: { tab: tabModel, screen: screenModel, band: bandModel }
    };
  }

  var api = { create: create };
  root.RT = root.RT || {};
  root.RT.appFocus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
