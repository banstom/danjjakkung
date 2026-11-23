/* 짝꿍과의 연말 문답 (docs/yearqa/spec.md, 코드 이름 yearqa) — 계산만 하는 모듈 (화면 · 저장은 js/app-yearqa.js).
   질문 30개(5묶음 × 6) · 쓰는 기간 · 지금 단계 · 답 검사 · 결산에서 얻는 힌트 · 연말결산 뒤에 붙는 카드 값.
   지키는 것: 짝꿍 답은 둘 다 봉투를 붙이고 1월 1일(서울)이 지나야 화면에 나옴 — 규칙(firestore.rules yearqa)도 같은 뜻. */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;

  var NAME = '짝꿍과의 연말 문답';  // 이름은 여기 한 곳
  var MAX = 300;                     // 답 하나 글자 수
  var HOUR = 3600000;

  /** 묶음 · 질문. id 는 한 번 정하면 그대로 (저장된 답의 열쇠). {next} = 다음 해 */
  var SECTIONS = [
    { id: 'taste', title: '올해의 취향', qs: [
      { id: 't1', q: '올해 우리 플레이리스트 1번 곡은 뭐예요?' },
      { id: 't2', q: '짝꿍이랑 또 가고 싶은 곳은 어디예요?', hint: 'bestPlace' },
      { id: 't3', q: '짝꿍이랑 먹을 때 질리지 않았던 최애 메뉴는요?' },
      { id: 't4', q: '짝꿍 덕분에 잘 쓴 물건 세 가지를 꼽는다면요?' },
      { id: 't5', q: '짝꿍이랑 다시 보고 싶은 영화나 책은요?' },
      { id: 't6', q: '올해 짝꿍에게 가장 잘 어울렸던 옷이나 스타일은요?' }
    ] },
    { id: 'find', title: '올해의 발견', qs: [
      { id: 'f1', q: '짝꿍이랑 처음 가 본 곳 중 가장 좋았던 곳은요?', hint: 'newPlaces' },
      { id: 'f2', q: '짝꿍이랑 처음 도전해 본 건 뭐예요?' },
      { id: 'f3', q: '의외로 우리 둘이 잘 맞았던 건 뭐였어요?' },
      { id: 'f4', q: '올해 짝꿍에게서 새로 배운 게 있다면요?' },
      { id: 'f5', q: '짝꿍 옆에서 내가 쉬는 방법은 뭐예요?' },
      { id: 'f6', q: '올해 새로 알게 된 짝꿍의 습관은요?' }
    ] },
    { id: 'change', title: '올해의 변화', qs: [
      { id: 'c1', q: '1년 전과 달라진 짝꿍의 모습은요?' },
      { id: 'c2', q: '1년 전보다 우리가 능숙해진 건 뭐예요?', hint: 'routine' },
      { id: 'c3', q: '올해 우리의 가장 큰 지출은 뭐였어요?', hint: 'spend' },
      { id: 'c4', q: '짝꿍 때문에 새로 생긴 관심사가 있나요?' },
      { id: 'c5', q: '올해 우리가 더는 하지 않게 된 건 뭐예요?' },
      { id: 'c6', q: '올해 짝꿍을 가장 칭찬해 주고 싶은 점은요?' }
    ] },
    { id: 'us', title: '올해의 우리', qs: [
      { id: 'u1', q: '올해 짝꿍에게 들어서 가장 기뻤던 말은요?' },
      { id: 'u2', q: '짝꿍에게 고맙다고 꼭 전하고 싶은 순간은요?' },
      { id: 'u3', q: '짝꿍 덕분에 새로 알게 된 사람이 있나요?' },
      { id: 'u4', q: '올해 우리의 가장 기억에 남는 날은 언제예요?', hint: 'bestMonth' },
      { id: 'u5', q: '올해 가장 자주 본 짝꿍의 표정은요?' },
      { id: 'u6', q: '내가 짝꿍에게 가장 자주 한 말은 뭐였을까요?' }
    ] },
    { id: 'next', title: '{next} 우리', qs: [
      { id: 'n1', q: '{next}년 우리의 추구미는요?' },
      { id: 'n2', q: '짝꿍이랑 내년에도 계속하고 싶은 건요?', hint: 'routine' },
      { id: 'n3', q: '짝꿍이랑 내년에 꼭 가 보고 싶은 곳은요?' },
      { id: 'n4', q: '짝꿍이랑 같이 새로 배워 보고 싶은 건요?' },
      { id: 'n5', q: '내년의 짝꿍에게 한 줄 남겨 주세요', note: '{next}년 연말 문답을 열 때 펼쳐져요', capsule: true },
      { id: 'n6', q: '{next}년 첫 장에 쓸 우리의 한 마디는요?', first: true }
    ] }
  ];
  var ALL = [];
  SECTIONS.forEach(function (s) { s.qs.forEach(function (q) { ALL.push(Object.assign({ sec: s.id }, q)); }); });
  var CAPSULE = 'n5', FIRST = 'n6';

  /** 이름 + 이/가 (받침) */
  function iga(name) {
    var s = String(name || ''), c = s.charCodeAt(s.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return s + ((c - 0xac00) % 28 ? '이' : '가');
    return s + '이(가)';
  }
  function fill(s, year) { return String(s).replace(/\{next\}/g, String(Number(year) + 1)); }
  /** 그해 질문 묶음 (문장의 {next} 채움) */
  function sections(year) {
    return SECTIONS.map(function (s) {
      return { id: s.id, title: fill(s.title, year), qs: s.qs.map(function (q) { return Object.assign({}, q, { q: fill(q.q, year), note: q.note ? fill(q.note, year) : undefined }); }) };
    });
  }
  function question(id, year) { var q = ALL.filter(function (x) { return x.id === id; })[0]; return q ? Object.assign({}, q, { q: fill(q.q, year) }) : null; }

  // ── 기간 (서울) ── 12월 1일 0시에 열리고, 다음 해 1월 1일 0시에 펼쳐지고, 1월 31일이 지나면 닫힘
  function seoulMs(y, m, d) { return Date.UTC(y, m - 1, d) - 9 * HOUR; }
  function times(year) {
    var y = Number(year);
    return { openAt: seoulMs(y, 12, 1), revealAt: seoulMs(y + 1, 1, 1), closeAt: seoulMs(y + 1, 2, 1) };
  }
  /** 지금 쓸 수 있는 해 (12월 → 그해, 1월 → 지난해, 그 밖엔 null) */
  function activeYear(nowMs) {
    var d = new Date(nowMs + 9 * HOUR), m = d.getUTCMonth() + 1, y = d.getUTCFullYear();
    return m === 12 ? y : m === 1 ? y - 1 : null;
  }

  /**
   * 지금 단계. sealed = { uid: ms } (yearqa/{year}.sealed), me · partner = uid
   * before 열리기 전 · write 쓰는 중 · wait 나만 붙임 · ready 둘 다 붙임(1월 1일 전) · open 펼쳐짐 · closed 기간이 끝남(둘 다는 못 붙임)
   */
  function phase(year, nowMs, sealed, me, partner) {
    var t = times(year), s = sealed || {};
    var mine = !!s[me], theirs = !!(partner && s[partner]);
    if (mine && theirs) return nowMs >= t.revealAt ? 'open' : 'ready';
    if (nowMs < t.openAt) return 'before';
    if (nowMs >= t.closeAt) return 'closed';
    return mine ? 'wait' : 'write';
  }
  /** 짝꿍 답을 읽어도 되는지 (규칙과 같은 뜻 — 둘 다 붙이고 1월 1일이 지남) */
  function canReadPartner(year, nowMs, sealed, me, partner) { return phase(year, nowMs, sealed, me, partner) === 'open'; }

  // ── 답 ──
  function len(s) { return Array.from(String(s || '')).length; }
  /** 답 정리: 앞뒤 빈칸 지우고, 빈 답 · 모르는 질문은 뺌. 넘치는 글은 잘라 내지 않고 errors 에 */
  function clean(answers) {
    var out = {}, errors = [];
    Object.keys(answers || {}).forEach(function (id) {
      if (!question(id, 2000)) return;
      var v = String(answers[id] == null ? '' : answers[id]).replace(/\n{3,}/g, '\n\n').trim();
      if (!v) return;
      if (len(v) > MAX) errors.push(id);
      out[id] = v;
    });
    return { answers: out, errors: errors };
  }
  function count(answers) { return Object.keys(clean(answers).answers).length; }
  /** 봉투를 붙일 수 있는지: 하나 이상 · 넘치는 답 없음 */
  function canSeal(answers) { var c = clean(answers); return Object.keys(c.answers).length >= 1 && !c.errors.length; }
  /** 묶음별 쓴 개수 → [{ id, done, total }] */
  function progress(answers, year) {
    var a = clean(answers).answers;
    return sections(year || 2000).map(function (s) { return { id: s.id, done: s.qs.filter(function (q) { return a[q.id]; }).length, total: s.qs.length }; });
  }

  // ── 힌트 ── 그해 결산 문서에서 (연말결산이 있으면 그것, 없으면 그해 월말결산들). 없으면 그 질문은 힌트 없음
  function cardOf(doc, id) { return ((doc && doc.cards) || []).filter(function (c) { return c && c.id === id; })[0] || null; }
  function hints(year, recaps, viewer) {
    var y = String(year), list = (recaps || []).filter(function (r) { return r && r.doc && (r.key === y || r.key.slice(0, 5) === y + '-'); });
    var yearly = list.filter(function (r) { return r.key === y; })[0];
    var docs = yearly ? [yearly.doc] : list.filter(function (r) { return r.key !== y; }).sort(function (a, b) { return a.key < b.key ? -1 : 1; }).map(function (r) { return r.doc; });
    var out = {};
    if (!docs.length) return out;
    // 새로 칠한 곳 (순서대로, 겹침 없이)
    var np = [];
    docs.forEach(function (d) { var c = cardOf(d, 'places'); (c && c.newPlaces || []).forEach(function (n) { if (n && np.indexOf(n) < 0) np.push(n); }); });
    if (np.length) out.newPlaces = '단짝 지도에 새로 칠한 곳 · ' + np.slice(0, 3).join(' · ') + (np.length > 3 ? ' 외 ' + (np.length - 3) + '곳' : '');
    // 별점 가장 높았던 곳
    var best = null;
    docs.forEach(function (d) { var c = cardOf(d, 'places'); var b = c && c.best; if (b && typeof b.avg === 'number' && (!best || b.avg > best.avg || (b.avg === best.avg && b.date > best.date))) best = b; });
    if (best && best.name) out.bestPlace = '별점 가장 높았던 곳 · ' + best.name + ' ★' + best.avg.toFixed(1);
    // 가장 잘 지킨 루틴 (보는 사람 것 — 가장 여러 번 1위였던 루틴, 같으면 나중 것)
    var tally = {}, lastName = null;
    docs.forEach(function (d) {
      var c = cardOf(d, 'routines');
      var p = c && (c.people || []).filter(function (x) { return x && x.uid === viewer; })[0];
      if (p && p.name) { tally[p.name] = (tally[p.name] || 0) + 1; lastName = p.name; }
    });
    var names = Object.keys(tally);
    if (names.length) {
      var top = names.sort(function (a, b) { return tally[b] - tally[a] || (b === lastName ? 1 : a === lastName ? -1 : 0); })[0];
      out.routine = '내가 가장 잘 지킨 루틴 · ' + top;
    }
    // 가장 많이 쓴 곳 (분류 이름별 금액 합)
    var spend = {};
    docs.forEach(function (d) { var c = cardOf(d, 'spends'); if (c && c.topCatLabel) spend[c.topCatLabel] = (spend[c.topCatLabel] || 0) + (Number(c.topCatAmount) || 0); });
    var sp = Object.keys(spend).sort(function (a, b) { return spend[b] - spend[a]; })[0];
    if (sp) out.spend = '단짝 영수증에서 가장 많이 쓴 곳 · ' + sp;
    // 둘 다 해낸 날이 가장 많았던 달
    if (yearly) {
      var tg = cardOf(yearly.doc, 'together');
      if (tg && tg.bestMonth && tg.bestMonth.fullDays) out.bestMonth = '둘 다 루틴을 해낸 날이 가장 많았던 달 · ' + tg.bestMonth.month + '월';
    } else {
      var bm = null;
      list.forEach(function (r) { if (r.key === y) return; var c = cardOf(r.doc, 'together'); if (c && c.fullDays && (!bm || c.fullDays > bm.n)) bm = { m: Number(r.key.slice(5, 7)), n: c.fullDays }; });
      if (bm) out.bestMonth = '둘 다 루틴을 해낸 날이 가장 많았던 달 · ' + bm.m + '월';
    }
    var byQ = {};
    ALL.forEach(function (q) { if (q.hint && out[q.hint]) byQ[q.id] = out[q.hint]; });
    return byQ;
  }

  // ── 연말결산 뒤 카드 ──
  /**
   * 결산 덱 끝에 붙일 카드. st = { year, now, sealed, me, partner, mine: answers|null, theirs: answers|null, lastTheirs: 작년 짝꿍 답|null, nameOf(uid) }
   * → [{ card: { id }, text }] — 펼쳐지기 전엔 'yq-wait' 한 장
   */
  function deckCards(st) {
    var y = st.year, ph = phase(y, st.now, st.sealed, st.me, st.partner), pn = st.nameOf(st.partner) || '짝꿍';
    if (ph === 'closed' && !(st.sealed && (st.sealed[st.me] || st.sealed[st.partner]))) return []; // 아무도 안 쓴 해는 카드 없음
    if (ph !== 'open') {
      var w = { kick: NAME, title: String(y) + '년, 서로에게 물었어요' };
      if (ph === 'write' || ph === 'before') { w.lead = '아직 내 문답을 다 쓰지 않았어요.\n봉투를 붙이고 ' + pn + '도 붙이면 여기서 펼쳐져요.'; w.action = ph === 'write' ? 'write' : null; }
      else if (ph === 'wait') { w.lead = '내 봉투는 붙였어요.\n' + iga(pn) + ' 봉투를 붙이면 여기서 펼쳐져요.'; w.action = 'view'; }
      else if (ph === 'ready') { w.lead = '둘 다 봉투를 붙였어요.\n1월 1일이 되면 펼쳐져요.'; }
      else { w.lead = '올해 문답은 둘 다 봉투를 붙이기 전에 닫혔어요.'; w.action = st.sealed && st.sealed[st.me] ? 'view' : null; }
      return [{ card: { id: 'yq-wait' }, text: w }];
    }
    var mine = clean(st.mine).answers, theirs = clean(st.theirs).answers;
    var secs = sections(y), both = 0, total = 0;
    ALL.forEach(function (q) { if (mine[q.id] || theirs[q.id]) total++; if (mine[q.id] && theirs[q.id]) both++; });
    var out = [{ card: { id: 'yq-intro' }, text: { kick: NAME, title: String(y) + '년, 서로에게 물었어요', lead: '둘이 함께 답한 질문 ' + both + '개', sub: '한 장씩 넘기며 서로의 답을 펼쳐 보세요' } }];
    secs.forEach(function (s) {
      var rows = s.qs.filter(function (q) { return !q.capsule && !q.first && (mine[q.id] || theirs[q.id]); }).map(function (q) {
        return { id: q.id, q: q.q, mine: mine[q.id] || '', theirs: theirs[q.id] || '' };
      });
      if (rows.length) out.push({ card: { id: 'yq-sec', sec: s.id }, text: { kick: NAME, title: s.title, rows: rows } });
    });
    if (mine[CAPSULE] || theirs[CAPSULE]) {
      out.push({ card: { id: 'yq-capsule' }, text: { kick: NAME, title: '내년의 짝꿍에게', lead: String(Number(y) + 1) + '년 연말 문답을 열 때 펼쳐져요', mine: !!mine[CAPSULE], theirs: !!theirs[CAPSULE] } });
    }
    if (mine[FIRST] || theirs[FIRST]) {
      out.push({ card: { id: 'yq-first' }, text: { kick: NAME, title: String(Number(y) + 1) + '년 첫 장', mine: mine[FIRST] || '', theirs: theirs[FIRST] || '' } });
    }
    return out;
  }
  /** 작년 짝꿍이 남긴 「내년의 짝꿍에게」 (작년 문답이 펼쳐졌을 때만 읽어 옴) */
  function capsuleFrom(lastTheirs) { var a = clean(lastTheirs).answers; return a[CAPSULE] || ''; }

  var api = { NAME: NAME, iga: iga, MAX: MAX, SECTIONS: SECTIONS, ALL: ALL, CAPSULE: CAPSULE, FIRST: FIRST, sections: sections, question: question, times: times, activeYear: activeYear, phase: phase, canReadPartner: canReadPartner, len: len, clean: clean, count: count, canSeal: canSeal, progress: progress, hints: hints, deckCards: deckCards, capsuleFrom: capsuleFrom };
  root.RT = root.RT || {};
  root.RT.yearqa = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
