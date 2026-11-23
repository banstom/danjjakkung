/* 짝꿍과의 연말 문답 (docs/yearqa/spec.md) — 화면 상태 · 저장 · 구독. app.js 가 host 를 넘겨 만든다 (RT.appYearqa.create(host)).
   계산은 js/yearqa.js, 그리기는 js/view-yearqa.js. 연말결산 덱 끝 카드는 deckCards(year) 로 app.js 에 넘긴다.
   지키는 것: 짝꿍 답은 둘 다 봉투를 붙이고 1월 1일(서울)이 지났을 때만 구독한다 — 그 전엔 부르지도 않음 (규칙도 막음).
   host = { store(), render(force), toast(t), me(), partner(), nameOf(uid), slotOf(uid), now(), recaps(), focus(sels, inSheet) } */
(function (root) {
  'use strict';
  var RT = root.RT;
  var Y = RT.yearqa, V = RT.viewYearqa;
  var SAVE_MS = 1200;

  function create(host) {
    var years = {};      // year → { meta, mine, theirs, lastTheirs, un: {} }
    var st = { open: false, year: null, cur: 'taste', draft: null, dirty: false, save: '', saving: null, confirm: false, sealing: false, entering: false };
    var timer = null;

    function S() { return host.store(); }
    function me() { return host.me(); }
    function partner() { return host.partner(); }
    function render(f) { host.render(f); }

    // ── 구독 ── 해마다 표시 문서 + 내 답. 짝꿍 답은 펼쳐진 뒤에만
    function watch(y) {
      if (!S() || !me() || !y) return null;
      var w = years[y];
      if (!w) {
        w = years[y] = { meta: undefined, mine: undefined, theirs: undefined, lastTheirs: undefined, un: {} };
        w.un.meta = S().watchYearQa(y, function (d) { w.meta = d; syncPartner(y); render(); }, function () { w.meta = { sealed: {} }; render(); });
        w.un.mine = S().watchYearAnswer(y, me(), function (d) {
          w.mine = d;
          if (st.open && st.year === y && st.draft === null) st.draft = Object.assign({}, (d && d.answers) || {});
          render();
        }, function () { w.mine = null; if (st.open && st.year === y && st.draft === null) st.draft = {}; render(); });
      }
      syncPartner(y);
      return w;
    }
    function readable(y) { var w = years[y]; return !!(w && w.meta && Y.canReadPartner(y, host.now(), w.meta.sealed, me(), partner())); }
    function syncPartner(y) {
      var w = years[y];
      if (!w || w.un.theirs || !partner() || !readable(y)) return;
      w.un.theirs = S().watchYearAnswer(y, partner(), function (d) { w.theirs = d; render(); }, function () { w.theirs = null; render(); });
    }
    /** 작년 짝꿍이 남긴 「내년의 짝꿍에게」 — 작년 문답이 펼쳐졌을 때만 한 번 읽음 */
    function syncCapsule(y) {
      var last = watch(y - 1);
      if (!last || last.lastTheirs !== undefined || !readable(y - 1)) return;
      last.lastTheirs = null;
      S().getYearAnswer(y - 1, partner()).then(function (d) { last.lastTheirs = d ? Y.capsuleFrom(d.answers) : ''; render(); }, function () { last.lastTheirs = ''; });
    }
    /** 앱이 그릴 때마다: 지금 쓸 수 있는 해를 구독 (입구 카드용) */
    function tick() { var y = Y.activeYear(host.now()); if (y) watch(y); }
    function stop() {
      flush();
      Object.keys(years).forEach(function (y) { Object.keys(years[y].un).forEach(function (k) { try { years[y].un[k](); } catch (e) {} }); });
      years = {}; st.open = false; st.draft = null;
    }

    function phaseOf(y) { var w = years[y]; return w && w.meta ? Y.phase(y, host.now(), w.meta.sealed, me(), partner()) : null; }

    // ── 입구 ──
    function entryModel() {
      var y = Y.activeYear(host.now());
      if (!y || !me()) return null;
      var w = watch(y), ph = phaseOf(y);
      if (!ph || w.mine === undefined) return null;
      var p = partner();
      return { year: y, phase: ph, done: Y.count(w.mine && w.mine.answers), total: Y.ALL.length, partnerSealed: !!(p && w.meta.sealed[p]), pname: host.nameOf(p), slotMe: host.slotOf(me()), slotHer: host.slotOf(p) };
    }

    // ── 쓰는 화면 ──
    function open(year) {
      var y = Number(year) || Y.activeYear(host.now());
      if (!y) return;
      var w = watch(y);
      st.open = true; st.year = y; st.cur = 'taste'; st.confirm = false; st.sealing = false; st.save = ''; st.dirty = false; st.entering = true;
      st.draft = w && w.mine !== undefined ? Object.assign({}, (w.mine && w.mine.answers) || {}) : null;
      syncCapsule(y);
      host.focus(['[data-act="yq-close"]'], true);
      render(true);
    }
    function close() {
      flush();
      var y = st.year;
      st.open = false; st.draft = null; st.confirm = false;
      host.focus(['[data-act="yq-open"][data-v="' + y + '"]', '[data-act="yq-reveal"]']);
      render(true);
    }
    function screenModel() {
      var y = st.year, w = years[y] || {}, ph = phaseOf(y) || 'write', p = partner();
      var mineSealed = !!(w.mine && w.mine.sealed);
      var hs = Y.hints(y, host.recaps() || [], me());
      var draft = st.draft || {};
      var prog = Y.progress(draft, y);
      var secs = Y.sections(y).map(function (s, i) { return { id: s.id, title: s.title, done: prog[i].done, total: prog[i].total }; });
      var sec = Y.sections(y).filter(function (s) { return s.id === st.cur; })[0] || Y.sections(y)[0];
      var last = years[y - 1], cap = last && last.lastTheirs ? { from: host.nameOf(p), text: last.lastTheirs } : null;
      var done = Y.count(draft);
      return {
        year: y, phase: ph, sealed: mineSealed, pname: host.nameOf(p), partnerSealed: !!(p && w.meta && w.meta.sealed[p]),
        secs: secs, cur: sec.id,
        qs: sec.qs.map(function (q) { return { id: q.id, q: q.q, note: q.note, capsule: !!q.capsule, hint: hs[q.id] || '', value: draft[q.id] || '' }; }),
        save: st.save, readOnly: ph === 'closed', capsule: cap, loading: st.draft === null,
        confirm: st.confirm ? { done: done, empty: Y.ALL.length - done } : null, sealing: st.sealing, entering: st.entering
      };
    }
    function sheetHtml() {
      if (!st.open) return '';
      var m = screenModel();
      st.entering = false;
      return V.sheet(m);
    }

    // ── 저장 ──
    function schedule() { if (timer) clearTimeout(timer); timer = setTimeout(function () { timer = null; flush(); }, SAVE_MS); }
    /** 바뀐 답이 있으면 지금 저장 (닫기 · 묶음 옮기기 · 봉투 붙이기 전) */
    function flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!st.dirty || !st.draft || !S() || !me()) return st.saving || Promise.resolve();
      var y = st.year, w = years[y] || {}, c = Y.clean(st.draft);
      st.dirty = false; st.save = 'saving'; setSave();
      var p = S().saveYearAnswers(y, me(), c.answers, !!(w.mine && w.mine.sealed)).then(function () {
        if (!st.dirty) st.save = 'saved'; setSave();
      }, function () { st.dirty = true; st.save = 'error'; setSave(); });
      st.saving = p;
      return p;
    }
    /** 저장 표시만 바꿈 (입력 중 다시 그리지 않게 글자만) */
    function setSave() {
      var el = typeof document !== 'undefined' && document.querySelector ? document.querySelector('.yq-save') : null;
      if (!el) return;
      el.textContent = { saved: '저장했어요', dirty: '저장 전', saving: '저장하는 중…', error: '저장하지 못했어요 · 인터넷을 확인해 주세요' }[st.save] || '';
      el.classList.toggle('yq-save--err', st.save === 'error');
    }

    function seal() {
      var y = st.year;
      if (!st.draft || st.sealing || !S()) return;
      var c = Y.clean(st.draft);
      if (c.errors.length) { st.confirm = false; host.toast(Y.MAX + '자를 넘긴 답이 있어요. 줄여 주세요'); render(true); return; }
      if (!Object.keys(c.answers).length) { st.confirm = false; host.toast('질문 하나 이상에 답해 주세요'); render(true); return; }
      if (timer) { clearTimeout(timer); timer = null; }
      st.sealing = true; st.dirty = false; render(true);
      S().sealYear(y, me(), c.answers).then(function () {
        st.sealing = false; st.confirm = false; st.save = 'saved';
        host.toast(phaseOf(y) === 'ready' || phaseOf(y) === 'open' ? '둘 다 봉투를 붙였어요 · 1월 1일에 펼쳐져요' : '봉투를 붙였어요');
        render(true);
      }, function () { st.sealing = false; st.dirty = true; host.toast('봉투를 붙이지 못했어요. 잠시 뒤 다시 해 주세요'); render(true); });
    }

    // ── 연말결산 덱 끝 카드 ──
    function deckCards(year) {
      var y = Number(year), w = watch(y);
      var loading = [{ card: { id: 'yq-wait' }, text: { kick: Y.NAME, title: y + '년, 서로에게 물었어요', lead: '불러오는 중이에요…' } }];
      if (!w || w.meta === undefined || w.mine === undefined) return loading;
      var ph = phaseOf(y);
      if (ph === 'open' && w.theirs === undefined) return loading; // 짝꿍 답을 불러오는 중
      return Y.deckCards({ year: y, now: host.now(), sealed: w.meta.sealed, me: me(), partner: partner(), mine: w.mine && w.mine.answers, theirs: w.theirs && w.theirs.answers, nameOf: host.nameOf });
    }

    // ── 입력 · 버튼 ──
    function input(id, value) {
      var m = /^yq-a-([a-z0-9]+)$/.exec(id);
      if (!m || !st.open || !st.draft || !Y.question(m[1], st.year)) return false;
      if (phaseOf(st.year) === 'closed') return true;
      st.draft[m[1]] = value; st.dirty = true; st.save = 'dirty'; setSave();
      var n = Y.len(value), cnt = document.getElementById('yq-n-' + m[1]);
      if (cnt) { cnt.textContent = n + ' / ' + Y.MAX; cnt.classList.toggle('is-over', n > Y.MAX); }
      var q = Y.question(m[1], st.year), pr = Y.progress(st.draft, st.year).filter(function (x) { return q && x.id === q.sec; })[0];
      var sc = pr && document.getElementById('yq-c-' + pr.id); if (sc) sc.textContent = pr.done + '/' + pr.total;
      schedule();
      return true;
    }
    function act(a, btn) {
      var v = btn && btn.getAttribute ? btn.getAttribute('data-v') : null;
      if (a === 'yq-open') { open(v); return true; }
      if (!st.open) return false;
      if (a === 'yq-close') { close(); return true; }
      if (a === 'yq-sec') {
        flush(); st.cur = v || 'taste';
        host.focus(['.yq-tab[data-v="' + st.cur + '"]'], true);
        render(true);
        var sc = typeof document !== 'undefined' && document.querySelector && document.querySelector('.yq-scroll'); if (sc) sc.scrollTop = 0;
        return true;
      }
      if (a === 'yq-seal-ask') { flush(); st.confirm = true; host.focus(['.yq-confirm [data-act="yq-seal"]'], true); render(true); return true; }
      if (a === 'yq-seal-no') { st.confirm = false; host.focus(['[data-act="yq-seal-ask"]'], true); render(true); return true; }
      if (a === 'yq-seal') { seal(); return true; }
      if (a === 'yq-stay') return true;
      return false;
    }
    /** 뒤로가기 · Esc */
    function back() { if (st.confirm) { st.confirm = false; render(true); } else close(); }

    return {
      tick: tick, stop: stop, entryModel: entryModel, open: open, close: close, back: back, isOpen: function () { return st.open; },
      sheetHtml: sheetHtml, deckCards: deckCards, input: input, act: act, flush: flush, readable: readable,
      _screenModel: screenModel, _years: function () { return years; }, _st: st
    };
  }

  RT.appYearqa = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
