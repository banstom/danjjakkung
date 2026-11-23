// node --test tests/recap.test.js — 월말 · 연말결산 계산 (docs/recap/tests.md A 묶음: 참조 시험 14개 + 저장소 시험)
// 시험 자료는 참조 자료를 저장소 모양으로 바꾼 것 (루틴은 요일 대신 쉬기 기간 · 체크는 key) — 숫자는 목업 그대로
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { computeRecap, dayStates, dayLevel, sharedMinutes, periodRange, prevPeriod, weekday } = require('../functions/recap.js');
const { cardText, cmpText, hoursText, dayLabel } = require('../js/recap-text.js');

const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/recap-' + n + '.json'), 'utf8'));
const { noteFixture } = require('./note-fixture.js');
const NF = noteFixture();
// 11-21 카드 8 = 교환 쪽지 (식탁 기록은 읽지 않음 — 자료에 meals 가 남아 있어도 카드 없음)
const nov = Object.assign(load('2026-11'), { qdays: NF.qdays, qanswers: NF.qanswers });
const oct = load('2026-10');
const recap = computeRecap(nov, oct);
const card = (id, r = recap) => r.cards.find((c) => c.id === id);

test('D1 날짜 도우미', () => {
  assert.equal(weekday('2026-11-16'), 0); // 월
  assert.equal(weekday('2026-11-15'), 6); // 일
  assert.equal(periodRange({ kind: 'month', key: '2026-02' }).days.length, 28);
  assert.equal(periodRange({ kind: 'year', key: '2028' }).days.length, 366);
  assert.deepEqual(prevPeriod({ kind: 'month', key: '2026-01' }), { kind: 'month', key: '2025-12' });
  assert.equal(dayLabel('2026-11-14'), '11월 14일 (토)');
});

test('C1 카드 순서와 건너뛰기', () => {
  assert.deepEqual(recap.cards.map((c) => c.id), ['cover', 'together', 'routines', 'todos', 'kungs', 'time', 'places', 'note', 'spends', 'final']);
  // 10월은 영수증 · (지도 방문 1번은 있음) — 기록이 없는 카드는 빠짐
  const r = computeRecap(oct, null);
  assert.ok(!r.cards.some((c) => c.id === 'spends'));
  assert.equal(r.cards[0].id, 'cover');
  assert.equal(r.cards.at(-1).id, 'final');
  // 아무 기록도 없으면 표지 + 마무리만
  const empty = computeRecap({ ...oct, routines: [], checks: [], todos: [], kungs: [], events: [], places: [], qdays: [], spends: [] });
  assert.deepEqual(empty.cards.map((c) => c.id), ['cover', 'final']);
});

test('C2 표지', () => {
  assert.deepEqual(cardText(card('cover'), recap, 'jm'), { kick: '2026년 11월', title: '이번 달의 단짝꿍', sub: '단짝이 된 지 290일' });
});

test('C3 함께 해낸 날 (목업 숫자)', () => {
  const c = card('together');
  assert.equal(c.fullDays, 15);
  assert.equal(c.longestStreak, 4);
  assert.equal(c.diffPrev, 2);
  assert.equal(cardText(c, recap, 'jm').cmp, '지난달보다 +2일');
});

test('C3-1 「모두」 규칙 — 저장소 규칙(시작 전 · 그만둔 뒤 · 쉬기)', () => {
  const routines = [
    { key: 'a', owner: 'x', name: 'A', start: '2026-01-01', end: null, rest: [{ from: '2026-11-18', to: '2026-11-18' }] },
    { key: 'b', owner: 'y', name: 'B', start: '2026-01-01', end: '2026-11-17' }
  ];
  const range = { days: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'] };
  const checks = [{ key: 'a', date: '2026-11-16' }, { key: 'a', date: '2026-11-17' }, { key: 'b', date: '2026-11-17' }];
  // 16: x만 함 → half / 17: 둘 다 → full / 18: x 쉬고 y 그만둠 → 빈 칸 / 19: y 그만둠 → x 혼자인데 못 함 → none
  assert.deepEqual(dayStates(range, routines, checks, ['x', 'y']).map((s) => s.state), ['half', 'full', null, 'none']);
});

test('C4 각자의 루틴 — 4일 이상인 것 중 % 높은 것, 지난달 비교', () => {
  const t = cardText(card('routines'), recap, 'jm');
  assert.deepEqual(t.rows.map((r) => [r.name, r.routine, r.pct, r.sub, r.cmp]), [
    ['준민', '영어 단어 30개', 85, '11/13일', '지난달보다 −15%p'], // 11-23: 같으면 「지난달과 같아요」 (전엔 「지난달보다 그대로」)
    ['단짝', '감사 일기', 86, '18/21일', null], // 11월에 만든 루틴 → 비교 없음
  ]);
  // 단짝이 보면 단짝이 먼저
  assert.equal(cardText(card('routines'), recap, 'dj').rows[0].name, '단짝');
});

test('C5 할 일 · 꿍', () => {
  const t = cardText(card('todos'), recap, 'jm');
  assert.equal(t.big, 23);
  assert.equal(t.lead, '그중 함께 할 일이 8개예요.');
  assert.deepEqual(t.more, ['가장 많이 끝낸 날 11월 14일 (토) · 3개']);
  assert.equal(t.cmp, '지난달보다 +11개');
  const k = cardText(card('kungs'), recap, 'jm');
  assert.equal(k.big, 153);
  assert.deepEqual(k.rows.map((r) => r.value), ['84번 보냄', '69번 보냄']);
  assert.deepEqual(k.more, ['가장 많이 오간 날 11월 5일 (목) · 9번']); // 같은 수면 이른 날
});

test('C6 함께 보낸 시간 — 겹침 합치기 · 기간 밖 자르기 · 각자 일정 빼기', () => {
  assert.equal(card('time').minutes, 2970);
  assert.equal(card('time').hours, 50);
  assert.equal(sharedMinutes({ kind: 'month', key: '2026-12' }, nov.events), 60); // 11-30 20:00 ~ 12-01 01:00 중 12월 1시간
  assert.equal(hoursText(45), '45분');
});

test('C7 지도 — 새로 칠한 곳 · 별점 가장 높은 방문', () => {
  const t = cardText(card('places'), recap, 'jm');
  assert.equal(t.big, 3);
  assert.deepEqual(t.more, ['새로 칠한 곳 2곳 · 강릉시 · 속초시']);
  assert.equal(t.best.title, '강릉시 · 11월 15일 (일)');
  assert.deepEqual(t.best.memos.map((m) => m.note), ['바다 보면서 먹은 물회', 'KTX 창밖이 예뻤어']);
});

test('C8 교환 쪽지 (11-21 식탁 → 교환 쪽지): 둘 다 남긴 날 15 · 연속 5 · 지난달 기록 없음 → 비교 없음 · 마음에 남은 쪽지 2장 · 식탁 숫자 없음', () => {
  const c = card('note');
  assert.deepEqual([c.bothDays, c.streak, c.prevDiff, c.likedCount, c.liked.length], [15, 5, null, 3, 2]);
  assert.ok(!card('meals'), '식탁 카드는 만들지 않음');
  assert.ok(!JSON.stringify(recap).match(/weight|kcal|체중|칼로리|sharedMeals|goalDays/));
  const t = cardText(c, recap, 'jm');
  assert.equal(t.kick, '교환 쪽지'); assert.equal(t.cmp, null); assert.deepEqual(t.leadLines, ['둘 다 쪽지를 남긴 날이에요.', '가장 길게는 5일 연속']);
  assert.deepEqual(t.liked.map((x) => x.head), ['준민의 마음에 남은 쪽지 · 11월 15일 (일)', '단짝의 마음에 남은 쪽지 · 11월 9일 (월)']);
  assert.deepEqual(t.liked.map((x) => x.by), ['단짝의 쪽지', '준민의 쪽지']);
  // 다진이 보면: 나 = 다진, 상대 = 단짝
  assert.equal(cardText(c, recap, 'dj').liked[0].head, '단짝의 마음에 남은 쪽지 · 11월 15일 (일)');
  // 쪽지가 없는 달은 카드 없음 → 진행 막대 칸도 하나 줄어듦
  assert.ok(!computeRecap(load('2026-11'), oct).cards.some((x) => x.id === 'note'));
});

test('C9 영수증 — 단짝 영수증 모듈과 같은 숫자', () => {
  const t = cardText(card('spends'), recap, 'jm');
  assert.equal(t.bigText, '446,200원');
  assert.deepEqual(t.rows.map((r) => `${r.name} ${r.pct}% ${r.value}`), ['준민 50% 22.1만 원', '단짝 50% 22.5만 원']);
  assert.deepEqual(t.more, ['가장 많이 쓴 곳은 식사 · 14.9만 원 · 4건']); // spec 2절 「· n건」
  assert.equal(t.title, '11월의 단짝 영수증');
});

test('C10 마무리 타일', () => {
  const t = cardText(card('final'), recap, 'jm');
  assert.deepEqual(t.tiles.map((x) => `${x.big} ${x.label}`), ['15일 둘 다 해낸 날', '23개 끝낸 일', '153번 주고받은 꿍', '50시간 함께 보낸 시간', '2곳 새로 칠한 곳', '15일 쪽지를 주고받은 날']);
  assert.equal(t.spends.line, '준민 50% · 단짝 50%');
  const fin = JSON.stringify(card('final'));
  for (const it of card('note').liked) { assert.ok(!fin.includes(it.text), '마무리(이미지)에 쪽지 글 없음'); assert.ok(!fin.includes(it.q), '질문도 없음'); }
});

test('C11 비교 문구', () => {
  assert.equal(cmpText(0, '일', 'month'), '지난달과 같아요');
  assert.equal(cmpText(-3, '개', 'year'), '작년보다 −3개');
  assert.equal(cmpText(null, '일', 'month'), null);
});

test('Y1 연말결산 — 같은 틀, 1년치', () => {
  const merge = (k) => [...oct[k], ...nov[k]];
  const year = { ...nov, period: { kind: 'year', key: '2026' }, checks: merge('checks'), todos: merge('todos'), kungs: merge('kungs'), events: merge('events') };
  const r = computeRecap(year, null);
  assert.deepEqual(cardText(r.cards[0], r, 'jm'), { kick: '2026년', title: '이번 해의 단짝꿍', sub: '단짝이 된 지 321일' });
  const tg = cardText(card('together', r), r, 'jm');
  assert.equal(tg.big, 28);
  assert.ok(tg.more.includes('가장 잘 해낸 달은 11월 (15일)'));
  const pl = cardText(card('places', r), r, 'jm');
  assert.ok(pl.more.includes('올해 별점 1위 강릉시 ★5.0'));
  assert.equal(cardText(card('final', r), r, 'jm').title, '우리의 한 해 요약');
});

// ── 저장소에서 더한 시험 ──
test('R1 서버 「모두」 단계가 앱 루틴 탭 달력(model.dayLevel)과 늘 같다 (무작위 300번)', () => {
  const M = require('../js/model.js');
  const D = require('../js/dates.js');
  const N = require('../functions/notify.js');
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const base = D.parse('2026-11-01');
  const dates = Array.from({ length: 14 }, (_, i) => D.toKey(base + i));
  for (let round = 0; round < 300; round++) {
    const rs = [];
    const n = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const start = D.toKey(base - 4 + Math.floor(rnd() * 14));
      const end = rnd() < 0.6 ? null : D.toKey(base - 6 + Math.floor(rnd() * 20));
      const rest = [];
      const nr = Math.floor(rnd() * 4);
      for (let j = 0; j < nr; j++) {
        const f = base - 6 + Math.floor(rnd() * 20);
        const roll = rnd();
        rest.push({ from: D.toKey(f), to: roll < 0.3 ? null : D.toKey(f + Math.floor(rnd() * 6) - (roll > 0.92 ? 3 : 0)) });
      }
      rs.push({ key: 'r' + k, name: 'r' + k, owner: rnd() < 0.5 ? 'x' : 'y', start, end, order: k, rest: nr ? rest : undefined });
    }
    const done = new Set();
    rs.forEach((r) => dates.forEach((d) => { if (rnd() < 0.6) done.add(r.key + '|' + d); }));
    const clean = M.routinesFrom({ routines: rs });
    const server = N.cleanRoutines(rs);
    dates.forEach((k) => {
      const app = M.dayLevel(clean, ['x', 'y'], D.parse(k), (r, d) => done.has(r.key + '|' + D.toKey(d))).level;
      assert.equal(dayLevel(server, ['x', 'y'], k, done), app, 'round ' + round + ' ' + k + ' ' + JSON.stringify(rs));
    });
  }
});

test('R2 시험 자료의 「영어 단어 30개」(월 · 수 · 금)는 쉬기 기간 30개 안 (저장 규칙 rest.size() <= 30)', () => {
  const r2 = nov.routines.find((r) => r.key === 'r2');
  assert.ok(r2.rest.length <= 30);
});

test('R3 결산 문서에 사람 순서가 없음 — 보는 사람만 바꾸면 카드 숫자는 같고 순서만 바뀜', () => {
  const t1 = cardText(card('kungs'), recap, 'jm');
  const t2 = cardText(card('kungs'), recap, 'dj');
  assert.deepEqual(t1.rows.map((r) => r.value), ['84번 보냄', '69번 보냄']);
  assert.deepEqual(t2.rows.map((r) => r.value), ['69번 보냄', '84번 보냄']);
  assert.equal(t1.big, t2.big);
});

test('R4 앞 기간이 없으면(단짝이 된 달) 비교 문구가 없음', () => {
  const r = computeRecap(nov, null);
  assert.equal(cardText(r.cards.find((c) => c.id === 'together'), r, 'jm').cmp, null);
  assert.equal(cardText(r.cards.find((c) => c.id === 'kungs'), r, 'jm').cmp, null);
});

test('R5 앞 달에 그 카드 기록이 없으면 비교 없음 (기능을 쓰기 전 달을 0으로 치지 않음) · 있으면 0개였어도 비교', () => {
  const empty = { ...oct, routines: [], checks: [], todos: [], kungs: [], events: [] };
  const r = computeRecap(nov, empty);
  for (const id of ['together', 'todos', 'kungs', 'time']) assert.equal(card(id, r).diffPrev, null, id);
  // 앞 달 루틴은 있었지만 하나도 못 해낸 경우 → 「모두」 0일과 비교
  const none = computeRecap(nov, { ...oct, checks: [] });
  assert.equal(card('together', none).diffPrev, 15);
});

test('R6 할 일 카드는 「끝낸 일」 (각자 끝낸 일도 셈) · 함께 할 일이 없으면 「이번 달 끝낸 할 일이에요.」', () => {
  const t = cardText(card('todos'), recap, 'jm');
  assert.equal(t.kick, '끝낸 일');
  const solo = computeRecap({ ...nov, todos: nov.todos.map((x) => ({ ...x, shared: false })) }, oct);
  assert.equal(cardText(card('todos', solo), solo, 'jm').lead, '이번 달 끝낸 할 일이에요.');
});

test('R7 각자의 루틴: 이번 기간에 시작한 루틴은 isNew (「이번 달에 새로 만든 루틴」)', () => {
  const rows = cardText(card('routines'), recap, 'jm').rows;
  assert.deepEqual(rows.map((r) => [r.routine, r.isNew]), [['영어 단어 30개', false], ['감사 일기', true]]);
});

test('R8 영수증 카드: 직접 만든 분류가 가장 많으면 그 이름', () => {
  const r = computeRecap({ ...nov, spendCats: [{ id: 'cdate01', label: '데이트' }], spends: [{ date: '2026-11-03', amount: 900000, paidBy: 'jm', cat: 'cdate01' }].concat(nov.spends) }, oct);
  const t = cardText(card('spends', r), r, 'jm');
  assert.match(t.more[0], /^가장 많이 쓴 곳은 데이트 · 90만 원 · 1건$/);
});

test('C4-1 각자의 루틴 비교가 0이면 「지난달과 같아요」 (11-23 점검 AI: 「지난달보다 그대로」 고침)', () => {
  const r = { period: { kind: 'month', key: '2026-11' }, people: [{ uid: 'a', name: '가' }, { uid: 'b', name: '나' }] };
  const c = { id: 'routines', people: [{ uid: 'a', name: '물', pct: 80, done: 8, due: 10, diff: 0 }, { uid: 'b', name: '책', pct: 90, done: 9, due: 10, diff: 5 }] };
  assert.deepEqual(cardText(c, r, 'a').rows.map((x) => x.cmp), ['지난달과 같아요', '지난달보다 +5%p']);
  const y = Object.assign({}, r, { period: { kind: 'year', key: '2026' } });
  assert.equal(cardText(c, y, 'a').rows[0].cmp, '작년과 같아요');
});

test('C-E 출출 쿠키 카드: 넣은 · 꺼낸 · 먹은 수, 둘 다 0 이면 없음, 교환 쪽지 다음 · 영수증 앞, 앞 기간에 카드가 있을 때만 비교 (11-23)', () => {
  const base = (eats, eatPicks, key) => ({ period: { kind: 'month', key: key || '2026-11' }, people: [{ uid: 'a', name: '가' }, { uid: 'b', name: '나' }], coupleSince: '2026-01-01',
    routines: [], checks: [], todos: [], kungs: [], events: [], places: [], qdays: [], qanswers: {}, spends: [{ date: '2026-11-03', amount: 1000, paidBy: 'a', cat: 'food' }], eats, eatPicks });
  const eats = [{ by: 'a', at: '2026-11-01', eatenAt: null, together: false }, { by: 'b', at: '2026-11-05', eatenAt: '2026-11-06', together: true }, { by: 'b', at: '2026-10-20', eatenAt: null, together: false }];
  const r = computeRecap(base(eats, [{ by: 'a', at: '2026-11-06' }]), null);
  const c = r.cards.find((x) => x.id === 'eat');
  assert.deepEqual([c.put, c.picked, c.eaten, c.together, c.byPerson.a, c.byPerson.b, c.diffPrev], [2, 1, 1, 1, { put: 1, picked: 1 }, { put: 1, picked: 0 }, null]);
  const ids = r.cards.map((x) => x.id);
  assert.ok(ids.indexOf('eat') === ids.indexOf('spends') - 1);
  assert.ok(!computeRecap(base([], []), null).cards.some((x) => x.id === 'eat'));
  // 비교: 10월에도 카드가 있으면 넣은 쿠키 차이
  const r2 = computeRecap(base(eats, []), base(eats, [], '2026-10'));
  assert.equal(r2.cards.find((x) => x.id === 'eat').diffPrev, 1);
  const t = cardText(c, r, 'b');
  assert.equal(t.kick, '출출 쿠키'); assert.equal(t.big, 2); assert.equal(t.lead, '이번 달 통에 넣은 쿠키예요.');
  assert.deepEqual(t.rows.map((x) => x.name + ' ' + x.value), ['나 1개 넣음 · 0개 꺼냄', '가 1개 넣음 · 1개 꺼냄']);
  assert.deepEqual(t.more, ['통에서 꺼낸 쿠키 1개', '먹었어요 1개 · 단짝과 함께 1개']);
});
