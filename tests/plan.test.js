// 할 일 · 시간표 계산 테스트
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dates');
const T = require('../js/todos');
const S = require('../js/schedule');

const today = D.parse('2026-10-28'); // 수요일
const td = (id, due, extra) => Object.assign({ id, scope: 'together', title: id, due, done: false, createdAt: '2026-10-01T00:00:00Z' }, extra);

test('할 일 기한 묶음 · 이번 주는 일요일까지', () => {
  assert.strictEqual(D.toKey(T.endOfWeek(today)), '2026-11-01');
  assert.strictEqual(T.bucket(td('a', '2026-10-27'), today), 'overdue');
  assert.strictEqual(T.bucket(td('a', '2026-10-28'), today), 'today');
  assert.strictEqual(T.bucket(td('a', '2026-11-01'), today), 'week');
  assert.strictEqual(T.bucket(td('a', '2026-11-02'), today), 'later');
  assert.strictEqual(T.bucket(td('a', null), today), 'none');
  // 일요일이면 그날이 주의 끝
  assert.strictEqual(T.endOfWeek(D.parse('2026-11-01')), D.parse('2026-11-01'));
});

test('정렬: 지남 → 오늘 → 이번 주 → 나중에 → 기한 없음', () => {
  const list = [td('none', null), td('later', '2026-11-20'), td('week', '2026-10-31'), td('today', '2026-10-28'), td('over', '2026-10-20'), td('week0', '2026-10-29')];
  assert.deepStrictEqual(T.sortOpen(list, today).map((t) => t.id), ['over', 'today', 'week0', 'week', 'later', 'none']);
});

test('기한 글자', () => {
  assert.strictEqual(T.dueLabel(td('a', '2026-10-26'), today), '2일 지남');
  assert.strictEqual(T.dueLabel(td('a', '2026-10-28'), today), '오늘');
  assert.strictEqual(T.dueLabel(td('a', '2026-10-29'), today), '내일');
  assert.strictEqual(T.dueLabel(td('a', '2026-10-31'), today), '토요일');
  assert.strictEqual(T.dueLabel(td('a', '2026-11-03'), today), '11월 3일');
  assert.strictEqual(T.dueLabel(td('a', null), today), '');
});

test('3개까지만 + 더 보기, 완료는 접기', () => {
  const list = ['1', '2', '3', '4', '5'].map((i) => td('t' + i, '2026-10-2' + (8 + +i > 9 ? 9 : 8))).concat([td('d1', null, { done: true, doneAt: '2026-10-27T01:00:00Z' }), td('d2', null, { done: true, doneAt: '2026-10-28T01:00:00Z' })]);
  const s = T.section(list, today, {});
  assert.strictEqual(s.open.length, 3); assert.strictEqual(s.moreCount, 2); assert.strictEqual(s.openCount, 5);
  assert.strictEqual(s.done.length, 0); assert.strictEqual(s.doneCount, 2);
  const e = T.section(list, today, { expanded: true, showDone: true });
  assert.strictEqual(e.open.length, 5); assert.strictEqual(e.moreCount, 0); assert.ok(e.canCollapse);
  assert.deepStrictEqual(e.done.map((t) => t.id), ['d2', 'd1']); // 최근 완료 먼저
});

test('기한 고르기 ↔ 저장값', () => {
  assert.strictEqual(T.dueFrom('today', today), '2026-10-28');
  assert.strictEqual(T.dueFrom('tomorrow', today), '2026-10-29');
  assert.strictEqual(T.dueFrom('week', today), '2026-11-01');
  assert.strictEqual(T.dueFrom('date', today, '2026-12-24'), '2026-12-24');
  assert.strictEqual(T.dueFrom('date', today, '2026-02-30'), null);
  assert.strictEqual(T.dueFrom('none', today), null);
  assert.strictEqual(T.choiceOf('2026-11-01', today), 'week');
  assert.strictEqual(T.choiceOf('2026-10-29', today), 'tomorrow');
  assert.strictEqual(T.choiceOf('2026-12-24', today), 'date');
  assert.strictEqual(T.validate({ title: '  ' }), '할 일을 적어 주세요');
  assert.strictEqual(T.validate({ title: 'a'.repeat(41) }), '할 일은 40자까지 쓸 수 있어요');
  assert.strictEqual(T.validate({ title: '장보기', choice: 'date', date: '' }), '날짜를 골라 주세요');
  assert.strictEqual(T.validate({ title: '장보기', choice: 'none' }), '');
});

test('할 일 문서 거르기', () => {
  const out = T.fromDocs([{ id: 'a', scope: 'together', title: 'x', due: '2026-02-30' }, { id: 'b', scope: 'u1', title: ' ' }, null, { id: 'c', scope: 'u1', title: 'y', done: true }]);
  assert.deepStrictEqual(out.map((t) => [t.id, t.due, t.done]), [['a', null, false], ['c', null, true]]);
});

// ── 시간표 ──
const P = ['dj', 'jm'];
const ev = (id, owner, extra) => Object.assign({ id, owner, title: id, weekly: true, weekday: 2, start: '10:00', end: '12:00' }, extra);

test('요일 · 주 시작(월요일)', () => {
  assert.strictEqual(S.weekdayOf(today), 2); // 수
  assert.strictEqual(D.toKey(S.monStart(today)), '2026-10-26');
  assert.strictEqual(D.toKey(S.monStart(D.parse('2026-11-01'))), '2026-10-26'); // 일요일은 그 주 끝
  assert.strictEqual(S.toMin('09:30'), 570); assert.strictEqual(S.fmt(570), '09:30'); assert.ok(isNaN(S.toMin('24:00')));
});

test('그날 일정: 매주 + 한 번', () => {
  const list = S.fromDocs([ev('w', 'dj'), ev('once', 'jm', { weekly: false, date: '2026-10-28', weekday: undefined }), ev('thu', 'jm', { weekday: 3 }), ev('bad', 'jm', { start: '12:00', end: '11:00' })]);
  assert.deepStrictEqual(S.on(list, today).map((e) => e.id), ['w', 'once']);
  assert.deepStrictEqual(S.on(list, today + 7).map((e) => e.id), ['w']); // 한 번 일정은 다음 주에 없음
});

test('주 보기: 자리 · 함께 · 겹침 · 고칠 수 있는지', () => {
  const list = S.fromDocs([ev('a', 'dj'), ev('b', 'dj', { start: '11:00', end: '13:00' }), ev('c', 'jm'), ev('d', 'both', { weekday: 5, start: '15:00', end: '19:00' }), ev('late', 'jm', { weekday: 0, start: '22:00', end: '23:30' })]);
  const w = S.week(list, P, 'jm', S.monStart(today), today);
  assert.strictEqual(w.range, '10월 26일 – 11월 1일');
  assert.ok(w.isThisWeek);
  assert.ok(w.days[2].isToday);
  const by = Object.fromEntries(w.blocks.filter((b) => !b.dup).map((b) => [b.id, b]));
  assert.deepStrictEqual([by.a.lane, by.a.col, by.a.cols, by.b.col, by.b.cols], [0, 0, 2, 1, 2]); // 겹치면 나란히
  assert.deepStrictEqual([by.c.lane, by.c.cols, by.c.slot], [1, 1, 'me']);
  // 함께 일정은 두 자리에 한 조각씩 (두 번째는 dup)
  const d = w.blocks.filter((b) => b.id === 'd');
  assert.deepStrictEqual(d.map((b) => [b.lane, b.slot, b.dup, b.dayIdx, b.editable]), [[0, 'both', false, 5, true], [1, 'both', true, 5, true]]);
  assert.strictEqual(by.a.editable, false); // 다진 일정은 준민이 못 고침
  assert.deepStrictEqual(w.hours, { from: 540, to: 1440 }); // 23:30까지 → 24시
});

test('일 보기: 지금 상태', () => {
  const list = S.fromDocs([ev('수업', 'dj', { start: '09:00', end: '12:00' }), ev('스터디', 'dj', { weekly: false, date: '2026-10-28', start: '15:00', end: '16:30' }), ev('과외', 'jm', { start: '19:00', end: '21:00' })]);
  const d = S.day(list, P, { dj: '다진', jm: '준민' }, 'jm', today, today, 10 * 60 + 5);
  assert.deepStrictEqual(d.status.map((s) => [s.name, s.busy, s.text]), [['다진', true, '수업 · 12:00까지'], ['준민', false, '비어 있어요 · 다음 19:00 과외']]);
  const late = S.day(list, P, { dj: '다진', jm: '준민' }, 'jm', today, today, 22 * 60);
  assert.strictEqual(late.status[1].text, '오늘 남은 일정 없어요');
  const other = S.day(list, P, {}, 'jm', today + 1, today, 600);
  assert.strictEqual(other.status, null); assert.strictEqual(other.now, null);
  assert.strictEqual(d.strip.length, 7); assert.ok(d.strip[2].on);
});

test('일정 확인', () => {
  assert.strictEqual(S.validate({ title: '', weekly: true, weekday: 1, start: '10:00', end: '11:00' }), '일정 이름을 적어 주세요');
  assert.strictEqual(S.validate({ title: '수업', weekly: true, weekday: 1, start: '11:00', end: '10:00' }), '끝 시간이 시작보다 늦어야 해요');
  assert.strictEqual(S.validate({ title: '수업', weekly: false, date: '', start: '10:00', end: '11:00' }), '날짜를 골라 주세요');
  assert.strictEqual(S.validate({ title: '수업', weekly: true, weekday: 6, start: '10:00', end: '11:00' }), '');
});

test('함께 일정이 각자 일정을 가리지 않는다 (겹치면 나란히)', () => {
  const list = S.fromDocs([ev('mine', 'jm', { start: '10:00', end: '12:00' }), ev('our', 'both', { start: '11:00', end: '13:00' })]);
  const w = S.week(list, P, 'jm', S.monStart(today), today);
  const lane1 = w.blocks.filter((b) => b.lane === 1).map((b) => [b.id, b.col, b.cols]);
  assert.deepStrictEqual(lane1, [['mine', 0, 2], ['our', 1, 2]]);
  const lane0 = w.blocks.filter((b) => b.lane === 0).map((b) => [b.id, b.col, b.cols]);
  assert.deepStrictEqual(lane0, [['our', 0, 1]]);
});

test('한 일정에 여러 요일 (화 · 목 수업)', () => {
  // 새 모양(weekdays)과 예전 모양(weekday 하나)이 섞여 있어도 읽는다
  const list = S.fromDocs([
    ev('bio', 'jm', { weekday: null, weekdays: [3, 1, 3] }),   // 화 · 목 (중복 · 순서 섞임)
    ev('old', 'dj', { weekday: 1 }),
    ev('empty', 'jm', { weekday: null, weekdays: [] }),        // 요일 없음 → 버림
    ev('junk', 'jm', { weekday: null, weekdays: [9, 'x'] })    // 이상한 값 → 버림
  ]);
  assert.deepStrictEqual(list.map((e) => e.id), ['bio', 'old']);
  assert.deepStrictEqual(list[0].weekdays, [1, 3]);
  assert.deepStrictEqual(list[1].weekdays, [1]);
  assert.strictEqual(S.wdText(list[0].weekdays), '화 · 목');
  const tue = today - 1, thu = today + 1; // today = 수
  assert.deepStrictEqual(S.on(list, tue).map((e) => e.id), ['bio', 'old']);
  assert.deepStrictEqual(S.on(list, thu).map((e) => e.id), ['bio']);
  assert.deepStrictEqual(S.on(list, today).map((e) => e.id), []);
  // 주 보기: 화 · 목 두 칸에 같은 일정이 나온다
  const w = S.week(list, ['dj', 'jm'], 'jm', S.monStart(today), today);
  const bio = w.blocks.filter((b) => b.id === 'bio');
  assert.strictEqual(bio.length, 2, '주 보기에 화 · 목 두 번');
  // 확인
  assert.strictEqual(S.validate({ title: '수업', weekly: true, weekdays: [], start: '10:00', end: '11:00' }), '요일을 골라 주세요');
  assert.strictEqual(S.validate({ title: '수업', weekly: true, weekdays: [1, 3], start: '10:00', end: '11:00' }), '');
});
