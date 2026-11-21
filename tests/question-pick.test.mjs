// 교환 쪽지 시험 (참조 reference/test/pick.test.js 그대로 — import 줄만 저장소 모듈로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bank, couple, J, D, at, day } from './question-helpers.mjs';
import Q_pick from '../js/question.js';
const { pickQuestion, WARMUP, LIGHT_TOPICS } = Q_pick;
import Q_order from '../js/question.js';
const { baseOrder } = Q_order;
import Q_kst from '../js/question.js';
const { dateKey, addDays, ddayCount } = Q_kst;

const since = couple.since;
const ctx = (date, history = [], ours = [], extra = {}) => ({ date, since, bank, history, ours, ...extra });
const topicOf = new Map(bank.base.map((q) => [q.id, q.topic]));
// 첫날이 아닌 평범한 날을 만들려고 지난 기록 하나를 깔아 둠
const prev = [day('2000-01-01', 'first', 'date')];

test('Q-K1 서울 날짜: 15:30Z는 다음 날 00:30 서울', () => {
  assert.equal(dateKey(Date.parse('2026-11-20T15:30:00Z')), '2026-11-21');
  assert.equal(dateKey(Date.parse('2026-11-20T14:59:00Z')), '2026-11-20');
  assert.equal(ddayCount(since, '2026-11-19'), 279);
  assert.equal(ddayCount(since, '2026-11-30'), 290);
});

test('Q-O1 순서는 seed가 같으면 같고, 다르면 다르며, 빠짐없이 한 번씩', () => {
  const a = baseOrder(bank.base, 'danjjakkung').map((q) => q.id);
  const b = baseOrder([...bank.base].reverse(), 'danjjakkung').map((q) => q.id);
  const c = baseOrder(bank.base, 'other').map((q) => q.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(new Set(a).size, bank.base.length);
});

test('Q-O2 같은 주제가 3번 넘게 잇따라 나오지 않음', () => {
  const order = baseOrder(bank.base, 'danjjakkung');
  let run = 1;
  for (let i = 1; i < order.length; i++) {
    run = order[i].topic === order[i - 1].topic ? run + 1 : 1;
    assert.ok(run <= 3, `${order[i].id} 근처에서 ${run}번 연속`);
  }
});

test('Q-P1 기록이 하나도 없는 첫날은 「첫 번째 오늘의 질문」', () => {
  const p = pickQuestion(ctx('2026-11-01'));
  assert.equal(p.q, 'first');
  assert.equal(p.src, 'date');
});

test('Q-P2 단짝이 된 날(해마다): 1주년은 변형 1, 2주년은 변형 2', () => {
  const p1 = pickQuestion(ctx('2027-02-14', prev));
  assert.equal(p1.q, 'anniv:1');
  assert.equal(p1.text, '단짝이 된 지 1년! 그동안 가장 기억에 남는 날은요?');
  assert.equal(pickQuestion(ctx('2028-02-14', prev)).q, 'anniv:2');
  assert.match(pickQuestion(ctx('2028-02-14', prev)).text, /2년, 처음과 달라진/);
});

test('Q-P3 2월 29일에 단짝이 됐으면 평년엔 2월 28일이 기념일', () => {
  const c = { ...ctx('2025-02-28', prev), since: '2024-02-29' };
  assert.equal(pickQuestion(c).q, 'anniv:1');
  assert.equal(pickQuestion({ ...ctx('2028-02-29', prev), since: '2024-02-29' }).q, 'anniv:4');
});

test('Q-P4 100일 단위: 300일(2026-12-10)은 셋째 변형, 숫자는 쉼표', () => {
  const p = pickQuestion(ctx('2026-12-10', prev));
  assert.equal(p.q, 'hundred:300');
  assert.equal(p.text, '단짝이 된 지 300일, 우리 둘을 한 문장으로 말하면요?');
  const p10 = pickQuestion({ ...ctx('2029-05-10', prev), since: '2026-08-14' });
  if (ddayCount('2026-08-14', '2029-05-10') === 1000) assert.match(p10.text, /1,000일/);
});

test('Q-P5 겹치는 날: 100일 단위가 정해진 날보다 먼저 (200일 = 9월 1일)', () => {
  assert.equal(ddayCount(since, '2026-09-01'), 200);
  assert.equal(pickQuestion(ctx('2026-09-01', prev)).q, 'hundred:200');
  const s = { ...ctx('2026-12-25', prev), since: '2025-12-25' };
  assert.equal(pickQuestion(s).q, 'anniv:1');
});

test('Q-P6 정해진 날: 1월 1일은 새해 질문', () => {
  const p = pickQuestion(ctx('2027-01-01', prev));
  assert.equal(p.q, 'date:01-01');
  assert.match(p.text, /^새해예요!/);
});

test('Q-P7 단짝에게 묻기: 어제 만든 질문은 오늘, 오늘 만든 질문은 내일', () => {
  const ours = [
    { id: 'a', text: '어제 낸 질문?', by: J, ask: true, createdAt: at('2026-11-19', 23, 59) },
    { id: 'b', text: '오늘 낸 질문?', by: D, ask: true, createdAt: at('2026-11-20', 0, 1) },
  ];
  const today = pickQuestion(ctx('2026-11-20', prev, ours));
  assert.deepEqual([today.q, today.src, today.by], ['a', 'ours', J]);
  const history = [...prev, day('2026-11-20', 'a', 'ours')];
  assert.equal(pickQuestion(ctx('2026-11-21', history, ours)).q, 'b');
  // 회귀: 오늘 만든 묻기 질문 하나뿐이어도 오늘은 안 나옴 (자정 직후 만든 질문 포함)
  assert.notEqual(pickQuestion(ctx('2026-11-20', prev, [ours[1]])).q, 'b');
});

test('Q-P8 묻기가 여럿이면 먼저 낸 것부터', () => {
  const ours = [
    { id: 'late', text: '늦게?', by: D, ask: true, createdAt: at('2026-11-18', 22) },
    { id: 'early', text: '일찍?', by: J, ask: true, createdAt: at('2026-11-18', 9) },
  ];
  assert.equal(pickQuestion(ctx('2026-11-20', prev, ours)).q, 'early');
});

test('Q-P9 목록에 섞기: 지난 2일에 우리 질문이 없을 때만', () => {
  const ours = [{ id: 'm', text: '섞기?', by: D, ask: false, createdAt: at('2026-11-10') }];
  const lately = [...prev, day('2026-11-19', 'x', 'ours')];
  assert.equal(pickQuestion(ctx('2026-11-20', lately, ours)).src, 'base');
  const twoAgo = [...prev, day('2026-11-18', 'x', 'ours'), day('2026-11-19', 'pick-001')];
  assert.equal(pickQuestion(ctx('2026-11-20', twoAgo, ours)).src, 'base');
  const clear = [...prev, day('2026-11-17', 'x', 'ours')];
  assert.equal(pickQuestion(ctx('2026-11-20', clear, ours)).q, 'm');
});

test('Q-P10 묻기는 간격 규칙과 상관없이 바로 (어제 우리 질문이었어도)', () => {
  const ours = [{ id: 'ask', text: '묻기?', by: J, ask: true, createdAt: at('2026-11-19', 8) }];
  const h = [...prev, day('2026-11-19', 'x', 'ours')];
  assert.equal(pickQuestion(ctx('2026-11-20', h, ours)).q, 'ask');
});

test(`Q-P11 처음 기본 질문 ${WARMUP}번은 가벼운 주제에서만`, () => {
  const history = [];
  let d = '2026-11-01';
  for (let i = 0; i < 40; i++) {
    const p = pickQuestion(ctx(d, history));
    history.push(day(d, p.q, p.src));
    d = addDays(d, 1);
  }
  const baseIds = history.filter((h) => h.src === 'base').map((h) => h.q);
  for (const id of baseIds.slice(0, WARMUP)) assert.ok(LIGHT_TOPICS.includes(topicOf.get(id)), id);
  assert.ok(baseIds.slice(WARMUP).some((id) => !LIGHT_TOPICS.includes(topicOf.get(id))), '그 뒤엔 다른 주제도 나옴');
});

test('Q-P12 한 바퀴 다 돌면 가장 오래전에 나온 것부터 다시', () => {
  const order = baseOrder(bank.base, 'danjjakkung');
  const history = [...prev];
  let d = '2020-01-01';
  for (const q of order) { history.push(day(d, q.id)); d = addDays(d, 1); }
  const p = pickQuestion(ctx('2030-01-02', history));
  assert.equal(p.q, order[0].id);
});

test('Q-P13 「다른 질문」으로 넘긴 질문은 아직 안 나온 질문들 뒤로', () => {
  const order = baseOrder(bank.base, 'danjjakkung');
  const h = [...prev, ...Array.from({ length: WARMUP }, (_, i) => day(addDays('2026-01-01', i), `warm-${i}`))];
  const first = pickQuestion(ctx('2026-11-20', h));
  const skippedDay = day('2026-11-20', 'other', 'base', { skipped: [first.q] });
  const next = pickQuestion(ctx('2026-11-21', [...h, skippedDay]));
  assert.notEqual(next.q, first.q);
  assert.ok(order.findIndex((q) => q.id === first.q) >= 0);
});

test('Q-P14 retired 질문은 나오지 않음', () => {
  const order = baseOrder(bank.base, 'danjjakkung');
  const retiredBank = { ...bank, base: bank.base.map((q) => (q.id === order[0].id ? { ...q, retired: true } : q)) };
  const h = [...prev, ...Array.from({ length: WARMUP }, (_, i) => day(addDays('2026-01-01', i), `warm-${i}`))];
  const p = pickQuestion({ ...ctx('2026-11-20', h), bank: retiredBank });
  assert.notEqual(p.q, order[0].id);
});

test('Q-P15 1년 돌려 보기: 기본 질문이 한 바퀴 안에 다시 안 나오고, 날짜 질문은 제날짜에', () => {
  const ours = [];
  const history = [];
  let d = '2026-11-01';
  for (let i = 0; i < 400; i++) {
    if (i % 9 === 3) ours.push({ id: `o${i}`, text: `우리 ${i}?`, by: i % 2 ? J : D, ask: i % 4 === 3, createdAt: at(d, 9) });
    const p = pickQuestion(ctx(d, history, ours));
    history.push(day(d, p.q, p.src));
    d = addDays(d, 1);
  }
  const base = history.filter((h) => h.src === 'base').map((h) => h.q);
  assert.equal(new Set(base).size, base.length, '기본 질문 겹침');
  const byDate = new Map(history.map((h) => [h.date, h.q]));
  assert.equal(byDate.get('2026-12-10'), 'hundred:300');
  assert.equal(byDate.get('2026-12-25'), 'date:12-25');
  assert.equal(byDate.get('2027-01-01'), 'date:01-01');
  assert.equal(byDate.get('2027-02-14'), 'anniv:1');
  assert.equal(new Set(history.filter((h) => h.src === 'ours').map((h) => h.q)).size, history.filter((h) => h.src === 'ours').length);
});

test('Q-P16 같은 기록이면 두 기기에서 같은 질문 (순수 함수)', () => {
  const a = pickQuestion(ctx('2026-11-20', [...prev]));
  const b = pickQuestion(ctx('2026-11-20', [...prev]));
  assert.deepEqual(a, b);
});
