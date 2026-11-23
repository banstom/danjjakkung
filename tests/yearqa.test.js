// node --test tests/yearqa.test.js — 짝꿍과의 연말 문답 (docs/yearqa/spec.md)
// 지키는 것: 짝꿍 답은 둘 다 봉투를 붙이고 1월 1일(서울)이 지나야 구독 · 화면에 나옴 / 질문 id 그대로 / 결산 덱 끝에 붙음
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require('../js/yearqa.js'); require('../js/view-yearqa.js'); require('../js/recap-text.js'); require('../js/view-recap.js');
global.document = { getElementById: () => null, querySelector: () => null };
require('../js/app-yearqa.js');
const RT = globalThis.RT, Y = RT.yearqa, V = RT.viewYearqa;
const ROOT = path.join(__dirname, '..');
const J = 'u-junmin', D = 'u-dajin';
const at = (s) => Date.parse(s + '+09:00');

test('YQ1 질문 29개 · 묶음 5개 · id 겹침 없음 · {next} 채움 · 물음표 또는 요청문', () => {
  assert.equal(Y.ALL.length, 29);
  assert.equal(Y.SECTIONS.length, 5);
  assert.equal(new Set(Y.ALL.map((q) => q.id)).size, 29);
  const secs = Y.sections(2026);
  assert.equal(secs[4].title, '2027 우리');
  const all = secs.flatMap((s) => s.qs);
  all.forEach((q) => { assert.ok(!/\{next\}/.test(q.q + (q.note || '')), q.id); assert.ok(/[?요]$/.test(q.q), q.q); });
  assert.ok(all.find((q) => q.id === 'n5').capsule && all.find((q) => q.id === 'n6').first);
  // 서로를 향한 질문: 모든 질문에 「짝꿍」 또는 「우리」
  all.forEach((q) => assert.ok(/짝꿍|우리/.test(q.q), q.q));
});

test('YQ2 기간: 12월 1일 열림 · 1월 1일 0시 펼침 · 2월 1일 닫힘 (서울)', () => {
  assert.equal(Y.activeYear(at('2026-11-30T23:59:59')), null);
  assert.equal(Y.activeYear(at('2026-12-01T00:00:00')), 2026);
  assert.equal(Y.activeYear(at('2027-01-31T23:00:00')), 2026);
  assert.equal(Y.activeYear(at('2027-02-01T00:00:00')), null);
  const S = (o) => o;
  assert.equal(Y.phase(2026, at('2026-11-30T12:00:00'), {}, J, D), 'before');
  assert.equal(Y.phase(2026, at('2026-12-10T12:00:00'), {}, J, D), 'write');
  assert.equal(Y.phase(2026, at('2026-12-10T12:00:00'), S({ [D]: 1 }), J, D), 'write');
  assert.equal(Y.phase(2026, at('2026-12-10T12:00:00'), S({ [J]: 1 }), J, D), 'wait');
  assert.equal(Y.phase(2026, at('2026-12-31T23:59:59'), S({ [J]: 1, [D]: 2 }), J, D), 'ready');
  assert.equal(Y.phase(2026, at('2027-01-01T00:00:00'), S({ [J]: 1, [D]: 2 }), J, D), 'open');
  assert.equal(Y.phase(2026, at('2027-02-01T00:00:00'), S({ [J]: 1 }), J, D), 'closed');
  assert.equal(Y.phase(2026, at('2027-03-01T00:00:00'), S({ [J]: 1, [D]: 2 }), J, D), 'open', '둘 다 붙였으면 닫힌 뒤에도 펼쳐 봄');
});

test('YQ3 답 정리 · 봉투 조건 · 묶음별 개수', () => {
  const c = Y.clean({ t1: '  밤양갱 ', t2: '', zz: '모르는 질문', c1: 'a\n\n\n\nb', u1: 'x'.repeat(301) });
  assert.deepEqual(Object.keys(c.answers).sort(), ['c1', 't1', 'u1']);
  assert.equal(c.answers.t1, '밤양갱'); assert.equal(c.answers.c1, 'a\n\nb');
  assert.deepEqual(c.errors, ['u1']);
  assert.equal(Y.canSeal({}), false);
  assert.equal(Y.canSeal({ t1: ' ' }), false);
  assert.equal(Y.canSeal({ t1: '하나' }), true);
  assert.equal(Y.canSeal({ t1: '하나', u1: 'x'.repeat(301) }), false, '넘친 답이 있으면 못 붙임');
  assert.equal(Y.len('😀가'), 2, '이모지는 한 글자');
  const p = Y.progress({ t1: 'a', t2: 'b', n6: 'c' }, 2026);
  assert.deepEqual(p.map((x) => x.done), [2, 0, 0, 0, 1]);
  assert.deepEqual(p.map((x) => x.total), [5, 6, 6, 6, 6]);
});

const month = (key, cards) => ({ key, doc: { period: { kind: 'month', key }, cards } });
test('YQ4 힌트: 월말결산들에서 (연말결산 전) · 연말결산이 있으면 그것만', () => {
  const list = [
    month('2026-10', [{ id: 'places', newPlaces: ['군산', '전주'], best: { name: '군산', date: '2026-10-03', avg: 4.5 } },
      { id: 'routines', people: [{ uid: J, name: '아침 러닝', pct: 90 }, { uid: D, name: '독서', pct: 80 }] },
      { id: 'spends', topCatLabel: '식사', topCatAmount: 100000 }, { id: 'together', fullDays: 12 }]),
    month('2026-11', [{ id: 'places', newPlaces: ['고창', '전주', '용인'], best: { name: '고창', date: '2026-11-02', avg: 4.0 } },
      { id: 'routines', people: [{ uid: J, name: '아침 러닝', pct: 70 }] },
      { id: 'spends', topCatLabel: '카페', topCatAmount: 50000 }, { id: 'together', fullDays: 20 }]),
    month('2025-11', [{ id: 'places', newPlaces: ['작년 곳'] }])
  ];
  const h = Y.hints(2026, list, J);
  assert.equal(h.f1, '단짝 지도에 새로 칠한 곳 · 군산 · 전주 · 고창 외 1곳');
  assert.equal(h.t2, '별점 가장 높았던 곳 · 군산 ★4.5');
  assert.equal(h.c2, '내가 가장 잘 지킨 루틴 · 아침 러닝'); assert.equal(h.n2, h.c2);
  assert.equal(h.c3, '단짝 영수증에서 가장 많이 쓴 곳 · 식사');
  assert.equal(h.u4, '둘 다 루틴을 해낸 날이 가장 많았던 달 · 11월');
  assert.ok(!Object.values(h).some((x) => /작년 곳/.test(x)), '다른 해 결산은 안 씀');
  const withYear = list.concat([{ key: '2026', doc: { cards: [{ id: 'together', bestMonth: { month: 3, fullDays: 25 } }] } }]);
  const h2 = Y.hints(2026, withYear, J);
  assert.equal(h2.u4, '둘 다 루틴을 해낸 날이 가장 많았던 달 · 3월');
  assert.equal(h2.f1, undefined, '연말결산이 있으면 그 문서만');
  assert.deepEqual(Y.hints(2026, [], J), {});
});

const nameOf = (u) => (u === J ? '준민' : '다진');
test('YQ5 결산 덱 카드: 펼치기 전엔 대기 한 장(짝꿍 답 없음) · 펼친 뒤 묶음 · 타임캡슐은 글 없이 · 첫 장', () => {
  const mine = { t1: '내 노래', n5: '내년의 너에게', n6: '더 단단하게' };
  const theirs = { t1: '다진 노래', f2: '클라이밍', n5: '비밀 한 줄', n6: '같이 천천히' };
  const base = { year: 2026, me: J, partner: D, mine, theirs, nameOf };
  const wait = Y.deckCards(Object.assign({}, base, { now: at('2026-12-31T22:00:00'), sealed: { [J]: 1, [D]: 2 } }));
  assert.equal(wait.length, 1); assert.equal(wait[0].card.id, 'yq-wait');
  assert.ok(!JSON.stringify(wait).includes('다진 노래'));
  assert.match(wait[0].text.lead, /1월 1일/);
  const waitMine = Y.deckCards(Object.assign({}, base, { now: at('2027-01-02T10:00:00'), sealed: { [J]: 1 } }));
  assert.equal(waitMine[0].text.action, 'view'); assert.match(waitMine[0].text.lead, /다진이 봉투를 붙이면/);
  const none = Y.deckCards(Object.assign({}, base, { now: at('2027-03-02T10:00:00'), sealed: {} }));
  assert.deepEqual(none, [], '아무도 안 쓴 해는 카드 없음');
  const open = Y.deckCards(Object.assign({}, base, { now: at('2027-01-01T09:00:00'), sealed: { [J]: 1, [D]: 2 } }));
  assert.deepEqual(open.map((x) => x.card.id), ['yq-intro', 'yq-sec', 'yq-sec', 'yq-capsule', 'yq-first']);
  assert.equal(open[0].text.lead, '둘이 함께 답한 질문 3개');
  assert.deepEqual(open[1].text.rows, [{ id: 't1', q: '올해 우리 플레이리스트 1번 곡은 뭐예요?', mine: '내 노래', theirs: '다진 노래' }]);
  assert.equal(open[2].text.rows[0].mine, '', '한쪽만 답한 질문도 나옴');
  const cap = JSON.stringify(open[3]);
  assert.ok(!cap.includes('비밀 한 줄') && !cap.includes('내년의 너에게'), '타임캡슐 글은 내년까지 안 보임');
  assert.equal(open[4].text.title, '2027년 첫 장');
});

test('YQ6 결산 덱에 붙이기: view-recap deckModel 이 after 카드를 끝에 · 카드 속을 그림', () => {
  const doc = { period: { kind: 'year', key: '2026' }, people: [{ uid: J, name: '준민' }, { uid: D, name: '다진' }], coupleSince: '2025-02-14',
    cards: [{ id: 'cover' }, { id: 'final', tiles: [] }] };
  const after = Y.deckCards({ year: 2026, now: at('2027-01-01T09:00:00'), sealed: { [J]: 1, [D]: 2 }, me: J, partner: D, mine: { t1: '<b>노래</b>' }, theirs: { t1: '다진' }, nameOf });
  const slot = (u) => (u === J ? 'me' : 'her');
  const m = RT.viewRecap.deckModel(doc, J, 0, slot, { after, viewer: J, partnerUid: D, nameOf, yqYear: '2026' });
  const ids = m.cards.map((x) => x.card.id);
  assert.equal(ids[ids.length - 1], 'yq-sec'); assert.ok(ids.indexOf('final') < ids.indexOf('yq-intro'));
  const secIdx = ids.indexOf('yq-sec');
  const html = RT.viewRecap.deck(Object.assign({}, m, { idx: secIdx }));
  assert.match(html, /&lt;b&gt;노래&lt;\/b&gt;/, '답은 글자로만');
  assert.match(html, /준민/); assert.match(html, /다진/);
  const empty = RT.viewRecap.deckModel(Object.assign({}, doc, { cards: [] }), J, 0, slot, { after: [] });
  assert.equal(empty.n, 0);
});

function fakeStore(meta, answers) {
  const calls = [];
  return {
    calls,
    watchYearQa: (y, next) => { calls.push(['meta', y]); setImmediate(() => next(meta[y] || { sealed: {} })); return () => {}; },
    watchYearAnswer: (y, uid, next) => { calls.push(['answer', y, uid]); setImmediate(() => next(answers[y + '|' + uid] || null)); return () => {}; },
    getYearAnswer: (y, uid) => { calls.push(['get', y, uid]); return Promise.resolve(answers[y + '|' + uid] || null); },
    saveYearAnswers: (y, uid, a, sealed) => { calls.push(['save', y, uid, a, sealed]); return Promise.resolve(); },
    sealYear: (y, uid, a) => { calls.push(['seal', y, uid, a]); return Promise.resolve(); }
  };
}
function host(store, now, toasts) {
  return { store: () => store, render: () => {}, toast: (t) => toasts && toasts.push(t), me: () => J, partner: () => D, nameOf, slotOf: (u) => (u === J ? 'me' : 'her'), now: () => now, recaps: () => [], focus: () => {} };
}
const tick = () => new Promise((r) => setImmediate(r));

test('YQ7 잠김: 1월 1일 전이면 둘 다 붙였어도 짝꿍 답을 구독하지 않음 · 화면 어디에도 없음', async () => {
  const st = fakeStore({ 2026: { sealed: { [J]: 1, [D]: 2 } } }, { ['2026|' + J]: { answers: { t1: '내 답' }, sealed: true }, ['2026|' + D]: { answers: { t1: '다진의 비밀 답' }, sealed: true } });
  const c = RT.appYearqa.create(host(st, at('2026-12-31T23:00:00')));
  c.tick(); await tick(); await tick();
  c.open(2026); await tick();
  assert.ok(!st.calls.some((x) => x[0] === 'answer' && x[2] === D), '짝꿍 답 구독 안 함');
  assert.ok(!c.sheetHtml().includes('다진의 비밀 답'));
  assert.ok(!JSON.stringify(c.deckCards(2026)).includes('다진의 비밀 답'));
  assert.equal(c.entryModel().phase, 'ready');
});

test('YQ8 펼침: 1월 1일 뒤 둘 다 붙였으면 구독 → 덱 카드에 짝꿍 답', async () => {
  const st = fakeStore({ 2026: { sealed: { [J]: 1, [D]: 2 } } }, { ['2026|' + J]: { answers: { t1: '내 답' }, sealed: true }, ['2026|' + D]: { answers: { t1: '다진 답' }, sealed: true } });
  const c = RT.appYearqa.create(host(st, at('2027-01-01T09:00:00')));
  c.deckCards(2026); await tick(); await tick(); await tick();
  assert.ok(st.calls.some((x) => x[0] === 'answer' && x[2] === D));
  const cards = c.deckCards(2026);
  assert.equal(cards[0].card.id, 'yq-intro');
  assert.ok(JSON.stringify(cards).includes('다진 답'));
});

test('YQ9 쓰기: 입력 → 잠시 뒤 저장(정리된 답) · 봉투 붙이기 → sealYear · 빈 답이면 막음', async () => {
  const st = fakeStore({}, {});
  const toasts = [];
  const c = RT.appYearqa.create(host(st, at('2026-12-05T20:00:00'), toasts));
  c.tick(); await tick(); await tick();
  c.open(2026); await tick();
  assert.equal(c._screenModel().loading, false);
  c.act('yq-seal'); await tick();
  assert.ok(!st.calls.some((x) => x[0] === 'seal')); assert.match(toasts.pop(), /하나 이상/);
  assert.equal(c.input('yq-a-t1', '  밤양갱  '), true);
  assert.equal(c.input('yq-a-zz', 'x'), false);
  await c.flush();
  const save = st.calls.find((x) => x[0] === 'save');
  assert.deepEqual(save.slice(1), [2026, J, { t1: '밤양갱' }, false]);
  c.act('yq-seal-ask', { getAttribute: () => null });
  assert.ok(c._screenModel().confirm);
  c.act('yq-seal'); await tick();
  assert.deepEqual(st.calls.find((x) => x[0] === 'seal').slice(1), [2026, J, { t1: '밤양갱' }]);
});

test('YQ10 작년 짝꿍의 「내년의 짝꿍에게」: 작년 문답이 펼쳐졌을 때만 읽어 쓰는 화면 위에', async () => {
  const st = fakeStore({ 2026: { sealed: { [J]: 1, [D]: 2 } } }, { ['2026|' + D]: { answers: { n5: '내년에도 잘 부탁해' }, sealed: true } });
  const c = RT.appYearqa.create(host(st, at('2027-12-03T20:00:00')));
  c.open(2027); await tick(); await tick(); await tick();
  c.open(2027); await tick();
  assert.ok(st.calls.some((x) => x[0] === 'get' && x[1] === 2026 && x[2] === D));
  assert.match(c.sheetHtml(), /작년의 다진이 남긴 한 줄[\s\S]*내년에도 잘 부탁해/);
  const st2 = fakeStore({ 2026: { sealed: { [D]: 2 } } }, { ['2026|' + D]: { answers: { n5: '비밀' }, sealed: true } });
  const c2 = RT.appYearqa.create(host(st2, at('2027-12-03T20:00:00')));
  c2.open(2027); await tick(); await tick(); c2.open(2027); await tick();
  assert.ok(!st2.calls.some((x) => x[0] === 'get'), '작년에 나만 안 붙였으면 안 읽음');
});

test('YQ11 그리기: 입구 · 쓰는 화면 (힌트 · 타임캡슐 안내 · 봉투 확인)', () => {
  assert.equal(V.entry(null), '');
  assert.equal(V.entry({ phase: 'before' }), '');
  const e = V.entry({ year: 2026, phase: 'write', done: 3, total: 29, partnerSealed: true, pname: '다진', slotMe: 'me', slotHer: 'her' });
  assert.match(e, /data-act="yq-open"/); assert.match(e, /3 \/ 29 답함/); assert.match(e, /다진이 먼저 봉투를 붙였어요/);
  assert.match(V.entry({ year: 2026, phase: 'open', done: 3, total: 29, partnerSealed: true, pname: '다진', slotMe: 'me', slotHer: 'her' }), /data-act="yq-reveal"/);
  const secs = Y.sections(2026).map((s) => ({ id: s.id, title: s.title, done: 0, total: s.qs.length }));
  const qs = Y.sections(2026)[4].qs.map((q) => ({ id: q.id, q: q.q, note: q.note, capsule: q.capsule, hint: q.id === 'n2' ? '내가 가장 잘 지킨 루틴 · 러닝' : '', value: '' }));
  const h = V.sheet({ year: 2026, phase: 'write', sealed: false, secs, cur: 'next', qs, save: 'saved', confirm: { done: 4, empty: 25 }, pname: '다진' });
  assert.match(h, /id="yq-a-n5"/); assert.match(h, /2027년 연말 문답을 열 때 펼쳐져요/);
  assert.match(h, /힌트 · 내가 가장 잘 지킨 루틴/);
  assert.match(h, /data-act="yq-seal-ask"/); assert.match(h, /봉투를 붙일까요\?/); assert.match(h, /건너뛴 질문 25개/);
});

test('YQ12 규칙 · 연결: 규칙에 1월 1일 · 둘 다 봉인 조건, 화면 파일이 index · 서비스워커에', () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const blk = rules.slice(rules.indexOf('match /yearqa/{year}'), rules.indexOf('// ── 출출 쿠키'));
  assert.match(blk, /timestamp\.date\(int\(year\) \+ 1, 1, 1\) - duration\.value\(9, 'h'\)/);
  assert.match(blk, /allow get: if isMember\(\) && \(yqMe\(\) == uid\s*\|\| \(resource\.data\.sealed == true && yqRevealed\(\)/);
  assert.match(blk, /allow list: if false/);
  assert.match(blk, /resource\.data\.sealed != true \|\| request\.resource\.data\.sealed == true/, '붙인 봉투는 못 뗌');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ['js/yearqa.js', 'js/view-yearqa.js', 'js/app-yearqa.js'].forEach((f) => { assert.ok(idx.includes('src="' + f + '"'), f); assert.ok(sw.includes("'" + f + "'"), f); });
  assert.ok(idx.indexOf('js/yearqa.js') < idx.indexOf('js/view-yearqa.js') && idx.indexOf('js/view-yearqa.js') < idx.indexOf('js/app-yearqa.js') && idx.indexOf('js/app-yearqa.js') < idx.indexOf('js/app.js'));
});
