// 교환 쪽지 시험 (참조 reference/test/day.test.js 그대로 — import 줄만 저장소 모듈로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bank, couple, nov, J, D, at, day } from './question-helpers.mjs';
import Q_swap from '../js/question.js';
const { swapBlock, swapDay } = Q_swap;
import Q_access from '../js/question.js';
const { viewState, canReadAnswer, toggleLike } = Q_access;
import Q_validate from '../js/question.js';
const { checkAnswer, checkQuestion } = Q_validate;
import Q_history from '../js/question.js';
const { monthRows, oursLists, canEditOurs } = Q_history;
import Q_recap from '../js/question.js';
const { questionRecap } = Q_recap;
import Q_notify from '../js/question.js';
const { reminderTargets, answerPush } = Q_notify;
import QT from '../js/question-text.js';
const { T, iga } = QT;

const today = '2026-11-20';
const ctx = { date: today, since: couple.since, bank, history: nov.days.filter((d) => d.date < today), ours: nov.ours };

test('Q-S1 다른 질문을 막는 경우: 지난날 · 우리 질문 · 이미 바꿈 · 답이 있음', () => {
  const d = day(today, 'pick-001');
  assert.equal(swapBlock(d, today), null);
  assert.equal(swapBlock({ ...d, date: '2026-11-19' }, today), 'past');
  assert.equal(swapBlock({ ...d, src: 'ours' }, today), 'ours');
  assert.equal(swapBlock({ ...d, swappedAt: 1 }, today), 'used');
  assert.equal(swapBlock({ ...d, done: { [D]: 1 } }, today), 'answered');
});

test('Q-S2 바꾸면 기본 묶음의 다른 질문 · 넘긴 질문은 skipped · 누가 언제 바꿨는지 남음', () => {
  const d = day(today, 'date:12-25', 'date');
  const s = swapDay(ctx, d, { uid: J, now: at(today, 8) });
  assert.equal(s.src, 'base');
  assert.notEqual(s.q, 'date:12-25');
  assert.deepEqual(s.skipped, ['date:12-25']);
  assert.equal(s.swappedBy, J);
  assert.throws(() => swapDay(ctx, s, { uid: D, now: at(today, 9) }), /used/);
});

test('Q-S3 오늘 질문을 바꿔도 지난 기록에 나온 질문은 다시 안 나옴', () => {
  const shownBefore = new Set(ctx.history.flatMap((d) => [d.q, ...(d.skipped || [])]));
  const s = swapDay(ctx, day(today, 'us-007'), { uid: D, now: at(today, 8) });
  assert.ok(!shownBefore.has(s.q));
});

test('Q-A1 보기 상태 넷: 둘 다 아직 · 나만 · 단짝만(잠김) · 둘 다', () => {
  assert.equal(viewState(day(today, 'x'), J, D), 'none');
  assert.equal(viewState(day(today, 'x', 'base', { done: { [J]: 1 } }), J, D), 'mine');
  assert.equal(viewState(day(today, 'x', 'base', { done: { [D]: 1 } }), J, D), 'theirs');
  assert.equal(viewState(day(today, 'x', 'base', { done: { [J]: 1, [D]: 2 } }), J, D), 'both');
});

test('Q-A2 단짝 답은 내 답이 있을 때만 읽을 수 있음 (규칙과 같은 뜻)', () => {
  assert.equal(canReadAnswer(J, J, new Set()), true);
  assert.equal(canReadAnswer(J, D, new Set([D])), false);
  assert.equal(canReadAnswer(J, D, new Set([D, J])), true);
});

test('Q-A3 마음에 남아요: 둘 다 답한 날만, 다시 누르면 지움', () => {
  const both = day(today, 'x', 'base', { done: { [J]: 1, [D]: 2 } });
  const liked = toggleLike(both, J, D);
  assert.deepEqual(liked.likes, { [J]: true });
  assert.deepEqual(toggleLike(liked, J, D).likes, {});
  assert.throws(() => toggleLike(day(today, 'x', 'base', { done: { [D]: 1 } }), J, D));
});

test('Q-V1 답: 앞뒤 빈칸 지움, 빈 답과 301자는 안 됨', () => {
  assert.deepEqual(checkAnswer('  붕어빵  '), { ok: true, text: '붕어빵' });
  assert.equal(checkAnswer('   ').why, 'answerEmpty');
  assert.equal(checkAnswer('가'.repeat(300)).ok, true);
  assert.equal(checkAnswer('가'.repeat(301)).why, 'answerLong');
});

test('Q-V2 우리 질문: 물음표 붙여 줌 · 기본 묶음/넣어 둔 질문과 같으면 안 됨 · 60자까지', () => {
  assert.equal(checkQuestion('제일 좋아하는 라면은', { bank, ours: [] }).text, '제일 좋아하는 라면은?');
  assert.equal(checkQuestion('어릴 때  꿈은 뭐였어요', { bank, ours: [] }).why, 'questionInBank');
  assert.equal(checkQuestion('겨울에 꼭 같이 먹고 싶은 간식은요', { bank, ours: nov.ours }).why, 'questionInOurs');
  assert.equal(checkQuestion('가', { bank, ours: [] }).why, 'questionShort');
  assert.equal(checkQuestion('가'.repeat(61), { bank, ours: [] }).why, 'questionLong');
});

test('Q-H1 지난 질문: 최근부터 · 늦게 답할 수 있는 날 표시 · 오늘은 늦은 날 아님', () => {
  const rows = monthRows(nov.days, { month: '2026-11', me: J, partner: D, today });
  assert.equal(rows.length, 20);
  assert.equal(rows[0].date, today);
  assert.equal(rows[0].late, false);
  const lateDates = rows.filter((r) => r.late).map((r) => r.date).sort();
  assert.deepEqual(lateDates, ['2026-11-06', '2026-11-11']);
});

test('Q-H2 우리가 넣은 질문: 기다리는 것 / 나온 것, 나온 질문은 못 고침', () => {
  const extra = { id: 'o-9', text: '아직 안 나온 질문?', by: J, ask: false, createdAt: at(today, 9) };
  const { waiting, shown } = oursLists([...nov.ours, extra], nov.days);
  assert.deepEqual(waiting.map((q) => q.id), ['o-9']);
  assert.deepEqual(shown.map((q) => q.id), ['o-4', 'o-3', 'o-2', 'o-1']);
  assert.equal(canEditOurs(extra, J, nov.days), true);
  assert.equal(canEditOurs(extra, D, nov.days), false);
  assert.equal(canEditOurs(nov.ours[0], J, nov.days), false);
});

test('Q-R1 결산 카드: 11월 시험 기록 → 질문 20개 · 둘 다 답한 날 · 마음에 남은 답', () => {
  const r = questionRecap(nov.days, { period: '2026-11', members: couple.members });
  const both = nov.days.filter((d) => d.done[J] && d.done[D]).length;
  assert.equal(r.asked, 20);
  assert.equal(r.both, both);
  assert.equal(r.ours, 4);
  assert.equal(r.liked.date, '2026-11-15');
  assert.deepEqual(r.liked.owners.sort(), [...couple.members].sort());
  assert.equal(questionRecap(nov.days, { period: '2026-10', members: couple.members }), null);
});

test('Q-N1 저녁 6시 알림: 답한 사람 · 끈 사람 빼고', () => {
  const d = day(today, 'x', 'base', { done: { [D]: 1 } });
  assert.deepEqual(reminderTargets(d, couple.members, {}), [J]);
  assert.deepEqual(reminderTargets(d, couple.members, { [J]: { qRemind: false } }), []);
  assert.deepEqual(reminderTargets(null, couple.members, {}), couple.members);
});

test('Q-N2 단짝이 답하면: 처음 답 → 「답하면 볼 수 있어요」, 두 번째 답 → 「열렸어요」, 지난날 · 끈 사람은 없음', () => {
  const base = { date: today, today, author: D, members: couple.members, prefs: {} };
  const first = answerPush({ ...base, dayAfter: { done: { [D]: 1 } } });
  assert.deepEqual([first.to, first.kind, first.body], [J, 'partner-answered', T.pushPartnerAnswered]);
  const second = answerPush({ ...base, dayAfter: { done: { [D]: 1, [J]: 1 } } });
  assert.equal(second.kind, 'both-open');
  assert.equal(answerPush({ ...base, date: '2026-11-19', dayAfter: { done: { [D]: 1 } } }), null);
  assert.equal(answerPush({ ...base, prefs: { [J]: { qPartner: false } }, dayAfter: { done: { [D]: 1 } } }), null);
});

test('Q-T1 낸 사람 꼬리표 조사: 준민이 · 단짝이 · 하루가', () => {
  assert.equal(T.tagOursBy('준민'), '준민이 낸 질문');
  assert.equal(T.tagOursBy('단짝'), '단짝이 낸 질문');
  assert.equal(iga('하루'), '하루가');
});

test('Q-T2 이름은 한 곳: 바꾸면 알림 제목 · 설정 · 결산 머리가 함께 바뀜, 기념 꼬리표 숫자는 쉼표', async () => {
  const { makeText, NAME } = (await import('../js/question-text.js')).default;
  assert.equal(T.name, NAME);
  const t = makeText('짝꿍 쪽지');
  assert.equal(t.settingRemind, '저녁 6시에 짝꿍 쪽지 알려 주기');
  assert.equal(t.recapKick, '짝꿍 쪽지');
  assert.equal(t.tagHundred(1000), '1,000일 기념 질문');
  assert.ok(!/답/.test(t.pushPartnerAnswered + t.pushBothOpen + t.partnerLocked), '화면 글은 「쪽지」로');
});
