/* 화면 그리기 — 월말 · 연말결산 (docs/recap/spec.md, 목업 design/mockups/chosen/recap 시안 A · 꽉 찬 색).
   값: 서버가 저장한 recaps/{key} 문서 + js/recap-text.js 문구. 상태 · 넘기기 · 이미지 저장은 app.js / js/recap-image.js.
   tab(m)  : 돌아보기 「결산」 칸 (E1)
   deck(m) : 한 장씩 넘기는 카드 (R1~R10) */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var T = NODE ? require('./recap-text.js') : root.RT.recapText;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var X = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var DL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  var HEART = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor"/></svg>';
  var DOWS = ['월', '화', '수', '목', '금', '토', '일'];

  /** 결산 이름: 「11월의 단짝꿍」 · 다른 해면 「2025년 12월의 단짝꿍」 · 연말 「2026년의 단짝꿍」 */
  function nameOf(key, thisYear) {
    if (key.length === 4) return key + '년의 단짝꿍';
    var y = key.slice(0, 4), m = Number(key.slice(5, 7));
    return (String(thisYear) === y ? '' : y + '년 ') + m + '월의 단짝꿍';
  }
  /** 정렬: 최근부터, 연말결산은 그 해 12월 위 */
  function sortKey(key) { return key.length === 4 ? key + '-13' : key; }

  /**
   * 「결산」 칸 값. list = [{ key, doc }], today = { y, m, d }
   * → { banner: { fresh, key?, kick, title, sub }, rows: [{ key, name, value }], loading, error }
   */
  function entryModel(list, today, opts) {
    opts = opts || {};
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var byKey = {};
    (list || []).forEach(function (r) { byKey[r.key] = r; });
    var thisKey = today.y + '-' + pad(today.m);
    var prevKey = today.m === 1 ? (today.y - 1) + '-12' : today.y + '-' + pad(today.m - 1);
    var nextM = today.m === 12 ? 1 : today.m + 1;
    var banner;
    var freshKey = today.d <= 7 ? (today.m === 1 && byKey[String(today.y - 1)] ? String(today.y - 1) : byKey[prevKey] ? prevKey : null) : null;
    if (freshKey) banner = { fresh: true, key: freshKey, kick: '새로 나왔어요', title: nameOf(freshKey, today.y), sub: '눌러서 한 장씩 넘겨 보세요' };
    else banner = { fresh: false, kick: nextM + '월 1일 아침에 나와요', title: today.m + '월의 단짝꿍', sub: '이번 달이 끝나면 한 장씩 넘겨 볼 수 있어요', key: thisKey };
    var rows = (list || []).slice().sort(function (a, b) { return sortKey(a.key) < sortKey(b.key) ? 1 : -1; }).map(function (r) {
      var tg = (r.doc && r.doc.cards || []).filter(function (c) { return c.id === 'together'; })[0];
      return { key: r.key, name: nameOf(r.key, today.y), value: '함께 해낸 날 ' + (tg ? tg.fullDays + '일' : '—') };
    });
    return { banner: banner, rows: rows, loading: !!opts.loading, error: opts.error || '', yqHtml: opts.yqHtml || '' };
  }

  function seg() {
    return '<div class="plan__bar"><div class="seg seg--3" role="group" aria-label="돌아볼 기간">' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="week" aria-pressed="false">주</button>' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="month" aria-pressed="false">달</button>' +
      '<button type="button" class="seg__btn" data-act="rv-mode" data-v="recap" aria-pressed="true">결산</button></div></div>';
  }

  function tab(m) {
    var b = m.banner;
    var banner = '<button type="button" class="card rc-banner' + (b.fresh ? ' rc-banner--fresh' : '') + '"' + (b.fresh ? ' data-act="rc-open" data-v="' + esc(b.key) + '"' : ' aria-disabled="true"') + '>' +
      '<span class="rc-banner__kick">' + esc(b.kick) + '</span><span class="rc-banner__title">' + esc(b.title) + '</span><span class="rc-banner__sub">' + esc(b.sub) + '</span></button>';
    var list;
    if (m.error) list = '<div class="card rc-list"><p class="muted">' + esc(m.error) + '</p><button type="button" class="text-btn" data-act="rc-retry">다시 불러오기</button></div>';
    else if (m.loading && !m.rows.length) list = '<div class="card rc-list" aria-busy="true"><p class="muted">불러오는 중…</p></div>';
    else if (!m.rows.length) list = '<div class="card rc-list"><p class="muted">아직 지난 결산이 없어요</p></div>';
    else list = '<div class="card rc-list">' + m.rows.map(function (r) {
      return '<button type="button" class="rc-row" data-act="rc-open" data-v="' + esc(r.key) + '"><span class="rc-row__nm">' + esc(r.name) + '</span><span class="rc-row__vl">' + esc(r.value) + '</span></button>';
    }).join('') + '</div>';
    return '<div class="rv recap-tab">' + seg() + banner + (m.yqHtml || '') + '<h3 class="mgroup rc-sec">지난 결산</h3>' + list +
      '<p class="muted rc-hint">결산은 그달 1일에 계산해 둔 숫자예요. 나중에 기록을 고쳐도 바뀌지 않아요.</p></div>';
  }

  // ── 카드 ──
  function cmp(t) { return t ? '<span class="rc-cmp">' + esc(t) + '</span>' : ''; }
  function big(n, unit) { return '<p class="rc-big">' + esc(fmt(n)) + '<small>' + esc(unit) + '</small></p>'; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function lines(arr) { return arr && arr.length ? arr.map(esc).join('<br>') : ''; }
  function dot(slot, small) { return '<span class="dot dot--' + esc(slot) + (small ? ' dot--sm' : '') + '" aria-hidden="true"></span>'; }
  function prows(rows, slots) {
    return '<div class="rc-panel rc-panel--rows">' + rows.map(function (r) {
      return '<div class="rc-prow">' + dot(slots(r.uid)) + '<span class="rc-prow__nm">' + esc(r.name) + '</span><span class="rc-prow__vl">' + esc(r.value) + '</span></div>';
    }).join('') + '</div>';
  }

  /** 「모두」 달력 (월요일 시작). states = [{ date, state: 'full'|'half'|'none'|null }] */
  function calendar(states) {
    var lead = states.length ? (new Date(states[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7 : 0;
    var hasBlank = states.some(function (s) { return s.state === null; });
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="rc-d rc-d--pad"></span>';
    states.forEach(function (s) { cells += '<span class="rc-d rc-d--' + (s.state || 'blank') + '"></span>'; });
    var full = states.filter(function (s) { return s.state === 'full'; }).length;
    var half = states.filter(function (s) { return s.state === 'half'; }).length;
    var none = states.filter(function (s) { return s.state === 'none'; }).length;
    return '<div class="rc-panel"><div class="rc-cal" role="img" aria-label="' + esc('모두 해낸 날 ' + full + '일, 일부 해낸 날 ' + half + '일, 못 한 날 ' + none + '일') + '">' +
      DOWS.map(function (d) { return '<span class="rc-cal__dow">' + d + '</span>'; }).join('') + cells + '</div>' +
      '<div class="rc-lg" aria-hidden="true"><span><i class="rc-d--full"></i>모두</span><span><i class="rc-d--half"></i>일부</span><span><i class="rc-d--none"></i>못 함</span>' +
      (hasBlank ? '<span><i class="rc-d--blank"></i>루틴 없음</span>' : '') + '</div></div>';
  }

  function stars(n) {
    if (typeof n !== 'number') return '';
    return '<span class="rc-stars" aria-label="별 ' + n + '개">' + '★★★★★'.slice(0, n) + '<i>' + '★★★★★'.slice(n) + '</i></span>';
  }

  /** 카드 한 장의 속 (진행 막대 · 닫기 · 안내는 deck 이 붙임) */
  function cardBody(card, t, m) {
    var slots = m.slotOf;
    switch (card.id) {
      case 'cover':
        return '<div class="rc-body rc-body--cover"><p class="rc-kick">' + esc(t.kick) + '</p><h2 class="rc-title" id="rc-title">' + esc(t.title) + '</h2>' +
          (t.sub ? '<p class="rc-lead">' + esc(t.sub) + '</p>' : '') + '<div class="rc-art">' + (m.art || '') + '</div></div>';
      case 'together':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p>' + big(t.big, t.unit) + cmp(t.cmp) +
          '<p class="rc-lead">' + esc(t.lead) + (t.more.length ? '<br>' + lines(t.more) : '') + '</p>' +
          (m.kind === 'month' && card.states ? calendar(card.states) : '') + '</div>';
      case 'routines':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p><p class="rc-lead rc-lead--h">가장 잘 지킨 루틴</p>' + t.rows.map(function (r) {
          var slot = slots(r.uid);
          return '<div class="rc-panel rc-rt"><span class="rc-rt__who">' + dot(slot) + esc(r.name) + '</span><span class="rc-rt__nm">' + esc(r.routine) + '</span>' +
            '<span class="rc-rt__pct"><b>' + r.pct + '%</b><span>' + esc(r.sub) + '</span></span>' +
            '<div class="rc-hbar" aria-hidden="true"><span class="bg--' + esc(slot) + '" style="width:' + Math.max(0, Math.min(100, r.pct)) + '%"></span></div>' +
            (r.cmp ? '<span>' + cmp(r.cmp) + '</span>' : r.isNew ? '<span class="rc-note">' + (m.kind === 'year' ? '올해' : '이번 달에') + ' 새로 만든 루틴</span>' : '') + '</div>';
        }).join('') + '</div>';
      case 'todos':
      case 'kungs':
      case 'meals':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p>' + big(t.big, t.unit) + cmp(t.cmp) + '<p class="rc-lead">' + esc(t.lead) + '</p>' +
          prows(t.rows, slots) + (t.more && t.more.length ? '<p class="rc-more">' + lines(t.more) + '</p>' : '') + (t.note ? '<p class="rc-note">' + esc(t.note) + '</p>' : '') + '</div>';
      case 'note': // 카드 8 교환 쪽지 — 접힌 모서리 카드(쪽지 모양 5 전체는 아님), 쪽지 글 3줄까지 + 길면 「전체 보기」(11-23 사용자 결정)
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p>' + big(t.big, t.unit) + cmp(t.cmp) + '<p class="rc-lead">' + lines(t.leadLines) + '</p>' +
          (t.best ? '<div class="rc-panel rc-bestmo"><b>' + esc(t.best.month) + '</b><span>' + esc(t.best.label) + '<br>' + esc(t.best.sub) + '</span></div>' : '') +
          (t.likedHead ? '<p class="rc-likedhead">' + esc(t.likedHead) + '</p>' + t.liked.map(function (x, i) {
            return '<div class="rc-notecard"><span class="rc-notecard__hd">' + HEART + esc(x.head) + '</span><p class="rc-notecard__q">' + esc(x.q) + '</p>' +
              '<p class="rc-notecard__tx">' + esc(x.text) + '</p><span class="rc-notecard__ft"><span class="rc-notecard__by">' + dot(slots(x.author), true) + esc(x.by) + '</span>' +
              (longNote(x.text) ? '<button type="button" class="rc-notecard__more" data-act="rc-note" data-v="' + i + '">전체 보기</button>' : '') + '</span></div>';
          }).join('') : '') + '</div>';
      case 'time':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p>' + big(t.big, t.unit) + cmp(t.cmp) + '<p class="rc-lead">' + esc(t.lead) + '</p></div>';
      case 'places': {
        var b = t.best;
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p>' + big(t.big, t.unit) + '<p class="rc-lead">' + esc(t.lead) + (t.more.length ? '<br>' + lines(t.more) : '') + '</p>' +
          (b ? '<div class="rc-panel rc-best"><span class="rc-best__k">별점 가장 높은 방문</span><span class="rc-best__t">' + esc(b.title + ' · ★' + b.stars.toFixed(1)) + '</span>' +
            b.memos.map(function (x) {
              return '<div class="rc-memo"><span class="rc-memo__who">' + dot(slots(x.uid), true) + esc(x.name) + ' ' + stars(x.stars) + '</span>' + (x.note ? '<br>' + esc(x.note) : '') + '</div>';
            }).join('') + '</div>' : '') + '</div>';
      }
      case 'spends':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p><p class="rc-lead rc-lead--h">' + esc(t.lead) + '</p>' +
          '<div class="rc-receipt"><p class="rc-receipt__t">' + esc(t.title) + '</p><hr class="rc-hr">' +
          t.rows.map(function (r) { return '<div class="rc-ld"><span>' + dot(slots(r.uid)) + esc(r.name + ' ' + r.pct + '%') + '</span><i></i><b>' + esc(r.value) + '</b></div>'; }).join('') +
          '<hr class="rc-hr"><div class="rc-ld"><span>함께 쓴 돈</span><i></i><b class="rc-ld__total">' + esc(t.bigText) + '</b></div>' +
          '<p class="rc-receipt__more">' + lines(t.more) + '</p></div>' + ratio(t.rows, slots) + '</div>';
      case 'final':
        return '<div class="rc-body rc-body--final"><div><p class="rc-kick">' + esc(t.kick) + '</p><h2 class="rc-final__t">' + esc(t.title) + '</h2></div>' +
          '<div class="rc-tiles">' + t.tiles.map(function (x) { return '<div class="rc-tile"><b>' + esc(x.big) + '</b><span>' + esc(x.label) + '</span></div>'; }).join('') + '</div>' +
          (t.spends ? '<div class="rc-tile rc-tile--spend"><span>함께 쓴 돈 · 단짝 영수증</span><b>' + esc(t.spends.total) + '</b>' + ratio(m.finalRows || [], slots) + '<span>' + esc(t.spends.line) + '</span></div>' : '') +
          '<div class="rc-fill"></div><div class="rc-actions"><button type="button" class="rc-btn2" data-act="rc-restart">처음부터</button>' +
          '<button type="button" class="rc-btn" data-act="rc-save"' + (m.saving ? ' disabled aria-busy="true"' : '') + '>' + DL + (m.saving ? '만드는 중…' : '이미지로 저장') + '</button></div></div>';
      default: // 짝꿍과의 연말 문답 카드 (연말결산 끝에 붙음, js/view-yearqa.js)
        return /^yq-/.test(card.id) && root.RT && root.RT.viewYearqa ? root.RT.viewYearqa.card(card, t, m) : '';
    }
  }
  function ratio(rows, slots) {
    if (!rows.length) return '';
    return '<div class="rc-ratio" aria-hidden="true">' + rows.map(function (r) { return '<span class="bg--' + esc(slots(r.uid)) + '" style="width:' + r.pct + '%"></span>'; }).join('') + '</div>';
  }

  /**
   * 카드 넘기기 값. doc = 결산 문서, viewer = 보는 사람 uid, idx = 지금 장, slotOf(uid) → 'me' | 'her'
   * → { title, idx, n, cards: [{ card, text }], ... }
   */
  function deckModel(doc, viewer, idx, slotOf, extra) {
    var cards = (doc.cards || []).map(function (c) { var t = null; try { t = T.cardText(c, doc, viewer); } catch (e) { t = null; } return { card: c, text: t }; }).filter(function (x) { return x.text; }); // 모양이 이상한 옛 카드 하나 때문에 결산 전체가 안 열리지 않게 (11-23)
    if (extra && extra.after && extra.after.length) cards = cards.concat(extra.after); // 연말결산 뒤 「짝꿍과의 연말 문답」 카드
    var n = cards.length;
    var i = Math.max(0, Math.min(n - 1, idx | 0));
    var sp = (doc.cards || []).filter(function (c) { return c.id === 'spends'; })[0];
    var people = doc.people.slice().sort(function (a, b) { return a.uid === viewer ? -1 : b.uid === viewer ? 1 : 0; });
    var finalRows = sp ? people.map(function (p) { return { uid: p.uid, pct: sp.byPerson[p.uid] ? sp.byPerson[p.uid].pct : 0 }; }) : [];
    return Object.assign({ key: doc.period.key, kind: doc.period.kind, title: nameOf(doc.period.key, Number(doc.period.key.slice(0, 4))), idx: i, n: n, cards: cards, slotOf: slotOf, finalRows: finalRows }, extra || {});
  }

  /** 3줄(약 15px · 카드 폭)을 넘길 만한 쪽지인지 — 넘으면 「전체 보기」. 글자 수 · 줄바꿈으로 어림 */
  function longNote(s) { s = String(s || ''); return s.length > 48 || (s.match(/\n/g) || []).length >= 2; }
  /** 쪽지 전체 보기 (카드 위에 겹쳐 뜸). 바깥을 누르거나 닫기 · Esc 로 닫힘 */
  function noteSheet(x, m) {
    return '<div class="rc-notesheet" data-act="rc-note-close"><div class="rc-notesheet__card" role="dialog" aria-modal="true" aria-label="쪽지 전체" data-act="rc-note-stay">' +
      '<span class="rc-notecard__hd">' + HEART + esc(x.head) + '</span><p class="rc-notecard__q">' + esc(x.q) + '</p>' +
      '<p class="rc-notesheet__tx">' + esc(x.text) + '</p><span class="rc-notecard__by">' + dot(m.slotOf(x.author), true) + esc(x.by) + '</span>' +
      '<button type="button" class="rc-btn2" data-act="rc-note-close">닫기</button></div></div>';
  }
  function deck(m, entering) {
    var cur = m.cards[m.idx];
    var openNote = cur.card.id === 'note' && m.noteOpen !== null && m.noteOpen !== undefined && cur.text.liked ? cur.text.liked[m.noteOpen] : null;
    var prog = '<div class="rc-prog" aria-hidden="true">' + m.cards.map(function (_, i) { return '<span' + (i <= m.idx ? ' class="is-on"' : '') + '></span>'; }).join('') + '</div>';
    var last = m.idx === m.n - 1;
    return '<div class="sheet-layer sheet-layer--full"><section class="sheet recap' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(m.title) + '" aria-roledescription="카드 넘기기">' +
      prog + '<button type="button" class="rc-x" data-act="rc-close" aria-label="닫기">' + X + '</button>' +
      '<div class="rc-stage" data-act="rc-tap" aria-live="polite"><p class="sr-only">' + (m.idx + 1) + ' / ' + m.n + '</p>' + cardBody(cur.card, cur.text, m) + '</div>' +
      (last ? '' : '<p class="rc-tap" aria-hidden="true">왼쪽 · 오른쪽을 눌러 넘기기</p>') +
      '<div class="sr-only"><button type="button" data-act="rc-prev"' + (m.idx ? '' : ' disabled') + '>앞 장</button><button type="button" data-act="rc-next"' + (last ? ' disabled' : '') + '>다음 장</button></div>' +
      (openNote ? noteSheet(openNote, m) : '') +
      '</section></div>';
  }

  /** 넘기기: 왼쪽 1/3 = 앞, 나머지 = 다음. 처음 · 마지막에서는 그대로 */
  function step(idx, n, dir) { return Math.max(0, Math.min(n - 1, idx + dir)); }
  function tapDir(x, width) { return x < width / 3 ? -1 : 1; }

  var api = { nameOf: nameOf, entryModel: entryModel, tab: tab, deckModel: deckModel, deck: deck, step: step, tapDir: tapDir, longNote: longNote };
  root.RT = root.RT || {};
  root.RT.viewRecap = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
