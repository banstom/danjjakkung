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
  // 함께 일정이 아무와도 안 겹치면 한 조각으로 칸 전체 폭
  const d = w.blocks.filter((b) => b.id === 'd');
  assert.deepStrictEqual(d.map((b) => [b.lane, b.slot, b.dup, b.dayIdx, b.editable, b.full]), [[0, 'both', false, 5, true, true]]);
  // 다진 a · b 는 서로 겹쳐 반쪽, 같은 시간 준민 c 와도 겹쳐 넓히지 않음
  assert.deepStrictEqual([by.a.full, by.b.full, by.c.full, by.late.full], [false, false, false, true]);
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

test('요일마다 다른 시간 (화 10–11시 · 목 16–17시)', () => {
  const list = S.fromDocs([
    ev('bio', 'jm', { weekday: null, weekdays: [1, 3], start: '10:00', end: '11:00', times: { 1: '10:00-11:00', 3: '16:00-17:00' } }),
    ev('same', 'dj', { weekday: null, weekdays: [1, 3], start: '09:00', end: '10:00' }),
    ev('bad', 'dj', { weekday: null, weekdays: [1, 3], start: '09:00', end: '10:00', times: { 1: '12:00-11:00', 3: 'x' } })
  ]);
  const bio = list[0];
  assert.strictEqual(bio.perDay, true);
  assert.deepStrictEqual(bio.times[3], { start: '16:00', end: '17:00' });
  assert.strictEqual(S.whenText(bio), '매주 화 10:00–11:00 · 목 16:00–17:00');
  assert.strictEqual(S.whenText(list[1]), '매주 화 · 목요일 · 09:00–10:00');
  assert.strictEqual(list[2].perDay, false); // 이상한 시간은 기본 시간으로
  const tue = today - 1, thu = today + 1;
  assert.deepStrictEqual(S.on(list, tue).filter((e) => e.id === 'bio').map((e) => e.start + '-' + e.end), ['10:00-11:00']);
  assert.deepStrictEqual(S.on(list, thu).filter((e) => e.id === 'bio').map((e) => e.start + '-' + e.end), ['16:00-17:00']);
  const w = S.week(list, ['dj', 'jm'], 'jm', S.monStart(today), today);
  assert.deepStrictEqual(w.blocks.filter((b) => b.id === 'bio').map((b) => b.dayIdx + ':' + S.fmt(b.s)), ['1:10:00', '3:16:00']);
  // 확인: 요일마다면 그 요일 시간을 본다
  const f = { title: '수업', weekly: true, weekdays: [1, 3], perDay: true, start: '10:00', end: '11:00', times: { 1: { start: '10:00', end: '11:00' }, 3: { start: '17:00', end: '16:00' } } };
  assert.strictEqual(S.validate(f), '목요일 끝 시간이 시작보다 늦어야 해요');
  f.times[3] = { start: '16:00', end: '17:00' };
  assert.strictEqual(S.validate(f), '');
});

test('주 보기: 안 겹치면 넓게 · 고른 요일 목록 · 카테고리', () => {
  const list = S.fromDocs([
    ev('gym', 'jm', { weekday: 0, start: '07:00', end: '08:00', cat: 'exercise' }),
    ev('bio', 'jm', { weekday: 1, start: '10:00', end: '12:00', cat: 'class' }),
    ev('ana', 'dj', { weekday: 1, start: '09:00', end: '12:00', cat: 'class' }),
    ev('lunch', 'both', { weekday: 1, start: '12:30', end: '13:30', cat: 'meet' }),
    ev('x', 'jm', { weekday: 1, start: '19:00', end: '20:00', cat: 'nope' })
  ]);
  assert.strictEqual(list.find((e) => e.id === 'x').cat, null); // 모르는 카테고리는 없음으로
  const w = S.week(list, P, 'jm', S.monStart(today), today, { pick: today - 1, names: { dj: '다진', jm: '준민' } });
  const by = (id) => w.blocks.filter((b) => b.id === id);
  assert.strictEqual(by('gym')[0].full, true);
  assert.strictEqual(by('gym')[0].icon, '🏃');
  assert.deepStrictEqual([by('bio')[0].full, by('ana')[0].full], [false, false]); // 화요일 오전은 둘 다 수업 → 반쪽
  assert.strictEqual(by('lunch').length, 1);
  assert.ok(w.days[1].picked && !w.days[2].picked);
  assert.strictEqual(w.pick.title, '화요일 · 10월 27일');
  assert.deepStrictEqual(w.pick.items.map((i) => [i.id, i.slot, i.who, i.icon, i.time]), [
    ['ana', 'her', '다진', '📚', '09:00–12:00'], ['bio', 'me', '준민', '📚', '10:00–12:00'],
    ['lunch', 'both', '함께', '💞', '12:30–13:30'], ['x', 'me', '준민', '', '19:00–20:00']]);
  // 다른 주로 가면 고른 요일은 그 주 월요일(이번 주면 오늘)
  const next = S.week(list, P, 'jm', S.monStart(today) + 7, today, { pick: today - 1 });
  assert.strictEqual(next.pick.day, S.monStart(today) + 7);
  assert.strictEqual(S.whenText(list.find((e) => e.id === 'bio')), '📚 수업 · 매주 화요일 · 10:00–12:00');
});

test('표시할 이름: 비거나 같으면 일정 이름 그대로 · 주 보기 블록에 실린다 · 10자까지', () => {
  assert.strictEqual(S.shortOf('4차산업혁명과디지털리터러시', ' 4디리 '), '4디리');
  assert.strictEqual(S.shortOf('일반생물', ''), null);
  assert.strictEqual(S.shortOf('일반생물', '일반생물'), null);
  const list = S.fromDocs([
    ev('dl', 'jm', { title: '4차산업혁명과디지털리터러시', short: '4디리' }),
    ev('bio', 'jm', { weekday: 3, short: 'bio' }), // 같은 이름이면 없음으로
    ev('x', 'jm', { weekday: 4, short: 3 }) // 이상한 값은 무시
  ]);
  assert.strictEqual(list.find((e) => e.id === 'dl').short, '4디리');
  assert.strictEqual(list.find((e) => e.id === 'bio').short, null);
  assert.strictEqual(list.find((e) => e.id === 'x').short, null);
  const w = S.week(list, P, 'jm', S.monStart(today), today);
  const b = w.blocks.find((x) => x.id === 'dl');
  assert.strictEqual(b.short, '4디리');
  assert.strictEqual(b.title, '4차산업혁명과디지털리터러시');
  const f = { title: '수업', short: '가나다라마바사아자차카', weekly: true, weekdays: [1], start: '10:00', end: '11:00' };
  assert.match(S.validate(f), /표시할 이름은 10자/);
  assert.strictEqual(S.validate(Object.assign({}, f, { short: '가나다라마바사아자차' })), '');
});
