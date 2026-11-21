// 결산 카드 8 「교환 쪽지」 시험 N1~N13 (docs/recap/changes/card8/test/note-card.test.js 그대로 — import 줄 · fixture 경로만 저장소에 맞춤)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import NC from '../functions/recap-note.js';
import RTX from '../js/recap-text.js';
const { computeNoteCard, longestStreak, noteTile, MAX_NOTE_LEN } = NC;
const { makeNoteCardText, noteDateLabel: dateLabel, diffChip } = RTX;

const here = dirname(fileURLToPath(import.meta.url));
const load = () => JSON.parse(readFileSync(join(here, 'fixtures', 'recap-note-2026-11.json'), 'utf8'));
const NOV = { kind: 'month', key: '2026-11' };
const J = 'u_junmin';
const D = 'u_danjjak';

test('N1 둘 다 남긴 날만 센다 (한 사람만 남긴 날 · 다른 달은 빠짐)', () => {
  const f = load();
  const card = computeNoteCard({ period: NOV, ...f });
  assert.equal(card.bothDays, 15);
});

test('N2 가장 긴 연속은 달력 날짜로 이어진 날 (11/5~9 → 5일)', () => {
  const f = load();
  assert.equal(computeNoteCard({ period: NOV, ...f }).streak, 5);
  assert.equal(longestStreak(['2026-11-30', '2026-12-01', '2026-12-02']), 3);
  assert.equal(longestStreak([]), 0);
});

test('N3 마음에 남은 쪽지: 누른 사람마다 가장 최근 하나, 최근 순, 전체 수는 따로', () => {
  const f = load();
  const card = computeNoteCard({ period: NOV, ...f });
  assert.equal(card.likedCount, 3);
  assert.deepEqual(
    card.liked.map((x) => [x.date, x.likedBy, x.author]),
    [['2026-11-15', J, D], ['2026-11-09', D, J]],
  );
  assert.equal(card.liked[0].q, '단짝에게 배운 것 하나는요?');
  assert.equal(card.liked[0].text, '천천히 먹어도 된다는 거. 같이 먹으면 나도 모르게 느긋해져');
});

test('N4 둘 다 안 남긴 날의 좋아요 · 작성자 글이 빈 날은 건너뜀', () => {
  const f = load();
  const card = computeNoteCard({ period: NOV, ...f });
  const dates = card.liked.map((x) => x.date);
  assert.ok(!dates.includes('2026-11-10'));
  assert.ok(!dates.includes('2026-11-12'));
});

test('N5 쪽지 글은 앞뒤 빈칸을 떼고 300자까지만', () => {
  const f = load();
  f.answers['2026-11-15'][D] = { text: '  ' + '가'.repeat(400) + '  ' };
  const card = computeNoteCard({ period: NOV, ...f });
  assert.equal(card.liked[0].text.length, MAX_NOTE_LEN);
});

test('N6 보여 줄 게 없으면 null → 카드 건너뜀 (기능이 아직 없던 달)', () => {
  const f = load();
  assert.equal(computeNoteCard({ period: { kind: 'month', key: '2026-10' }, ...f }), null);
  assert.equal(computeNoteCard({ period: NOV, members: f.members, days: [], answers: {} }), null);
});

test('N7 지난달 비교: 지난달 기록이 없으면 null, 있으면 차이', () => {
  const f = load();
  assert.equal(computeNoteCard({ period: NOV, ...f }).prevDiff, null);
  assert.equal(computeNoteCard({ period: NOV, ...f, prevDays: [] }).prevDiff, null);
  const prev = Array.from({ length: 12 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    done: { [J]: 1, [D]: 1 },
  }));
  prev.push({ date: '2026-10-20', done: { [J]: 1 } }); // 한 사람만 → 안 셈
  assert.equal(computeNoteCard({ period: NOV, ...f, prevDays: prev }).prevDiff, 3);
});

test('N8 비교 칩 문구 (카드 2와 같은 규칙, 마이너스는 U+2212)', () => {
  assert.equal(diffChip(3), '지난달보다 +3일');
  assert.equal(diffChip(-2), '지난달보다 −2일');
  assert.equal(diffChip(0), '지난달과 같아요');
  assert.equal(diffChip(null), null);
});

test('N9 연말: 1년치 합 · 가장 많이 주고받은 달 (같으면 앞선 달) · 비교 없음', () => {
  const f = load();
  const oct = Array.from({ length: 15 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    done: { [J]: 1, [D]: 1 },
  }));
  const card = computeNoteCard({ period: { kind: 'year', key: '2026' }, ...f, days: [...oct, ...f.days] });
  assert.equal(card.bothDays, 31); // 10월 15 + 11월 15 + 12월 1
  assert.deepEqual(card.bestMonth, { month: 10, days: 15 }); // 10월 15 = 11월 15 → 앞선 달
  assert.equal(card.prevDiff, undefined);
});

test('N10 두 사람이 아니면 멈춤 · 모르는 uid의 done은 무시', () => {
  const f = load();
  assert.throws(() => computeNoteCard({ period: NOV, ...f, members: [f.members[0]] }));
  const days = [{ date: '2026-11-01', done: { [J]: 1, stranger: 1 } }];
  assert.equal(computeNoteCard({ period: NOV, members: f.members, days }), null);
});

test('N11 마무리 타일에는 숫자만 (쪽지 글 · 질문이 이미지에 안 들어감)', () => {
  const f = load();
  const tile = noteTile(computeNoteCard({ period: NOV, ...f }));
  assert.deepEqual(tile, { value: 15, unit: '일' });
  assert.equal(noteTile(null), null);
});

test('N12 화면 글: 이름은 한 곳에서, 날짜 요일, 연속 1일이면 둘째 줄 없음', () => {
  const f = load();
  const card = computeNoteCard({ period: NOV, ...f });
  const t = makeNoteCardText('교환 쪽지');
  const labelOf = (uid) => f.labels[uid];
  assert.equal(t.kick('month'), '교환 쪽지');
  assert.equal(t.kick('year'), '교환 쪽지 · 올해');
  assert.equal(makeNoteCardText('다른 이름').kick('month'), '다른 이름');
  assert.deepEqual(t.lead(card, 'month'), ['둘 다 쪽지를 남긴 날이에요.', '가장 길게는 5일 연속']);
  assert.deepEqual(t.lead({ ...card, streak: 1 }, 'month'), ['둘 다 쪽지를 남긴 날이에요.']);
  assert.equal(t.likedHead(card), '마음에 남은 쪽지 3장');
  assert.equal(t.likedItem(card.liked[0], labelOf), '준민의 마음에 남은 쪽지 · 11월 15일 (일)');
  assert.equal(t.likedAuthor(card.liked[0], labelOf), '단짝의 쪽지');
  assert.equal(dateLabel('2026-11-09'), '11월 9일 (월)');
  assert.equal(t.chip(card, 'month'), null);
});

test('N13 연말: 둘째 줄은 연속, 가장 많이 주고받은 달은 아래 칸에 (두 번 쓰지 않음)', () => {
  const t = makeNoteCardText();
  const card = { bothDays: 31, streak: 6, bestMonth: { month: 11, days: 15 } };
  assert.deepEqual(t.lead(card, 'year'), ['둘 다 쪽지를 남긴 날이에요.', '가장 길게는 6일 연속']);
  assert.deepEqual(t.bestMonth(card), { month: '11월', label: '가장 많이 주고받은 달', sub: '15일 둘 다 남겼어요' });
  assert.equal(t.bestMonth({ bothDays: 1, streak: 1, bestMonth: null }), null);
});
