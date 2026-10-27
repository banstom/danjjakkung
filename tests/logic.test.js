// node --test tests/  — 며칠차 · 연속 · 쉰 날 · 계절 · 그리드 계산 테스트
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const S = require('../js/streak.js');
const { seasonOf } = require('../js/seasons.js');
const M = require('../js/model.js');

const day = (m, d) => D.fromYMD(2026, m, d);
const doneSet = (...days) => (d) => days.includes(d);

// 실제 기록: 스쿼트 10/18 시작, 18일만 하고 19~21 쉼, 22~25 연속, 26 아직(실패)
const squatDone = [day(10, 18), day(10, 22), day(10, 23), day(10, 24), day(10, 25)];

test('dates: 키 변환이 월 경계에서도 맞다', () => {
  assert.equal(D.toKey(day(10, 31) + 1), '2026-11-01');
  assert.equal(D.parse('2026-11-01'), day(11, 1));
  assert.ok(Number.isNaN(D.parse('2026-1-1')));
  assert.equal(D.full(day(10, 26)), '10월 26일 월요일');
  assert.equal(D.weekStart(day(10, 21)), day(10, 18)); // 10/18은 일요일
});

test('스쿼트 10/26 밤: 9일차, 연속 4일(오늘 체크 전), 최근 쉰 날 10/21', () => {
  const s = S.summary({ start: day(10, 18), today: day(10, 26), isDone: doneSet(...squatDone) });
  assert.equal(s.dayN, 9);
  assert.equal(s.count, 5);
  assert.equal(s.todayDone, false);
  assert.equal(s.streak, 4);
  assert.equal(s.best, 4);
  assert.equal(s.lastMiss, day(10, 21));
});

test('스쿼트 10/26에 했다면 연속 5일차였다', () => {
  const s = S.summary({ start: day(10, 18), today: day(10, 26), isDone: doneSet(...squatDone, day(10, 26)) });
  assert.equal(s.streak, 5);
  assert.equal(s.todayDone, true);
});

test('스쿼트 10/27: 어제 쉬었으니 연속 0, 오늘 하면 1일차', () => {
  const before = S.summary({ start: day(10, 18), today: day(10, 27), isDone: doneSet(...squatDone) });
  assert.equal(before.dayN, 10);
  assert.equal(before.streak, 0);
  assert.equal(before.lastMiss, day(10, 26));
  const after = S.summary({ start: day(10, 18), today: day(10, 27), isDone: doneSet(...squatDone, day(10, 27)) });
  assert.equal(after.streak, 1);
});

test('테니스 10/26: 시작 전, D-1', () => {
  const s = S.summary({ start: day(10, 27), today: day(10, 26), isDone: () => false });
  assert.equal(s.started, false);
  assert.equal(s.daysUntil, 1);
});

test('테니스 예시: 8일차인데 하루 쉬어서 연속 3일차', () => {
  const t = [27, 28, 29, 30].map((d) => day(10, d)).concat([day(11, 1), day(11, 2), day(11, 3)]);
  const s = S.summary({ start: day(10, 27), today: day(11, 3), isDone: doneSet(...t) });
  assert.equal(s.dayN, 8);
  assert.equal(s.streak, 3);
  assert.equal(s.best, 4);
  assert.equal(s.lastMiss, day(10, 31));
});

test('계절: 12~2 겨울, 3~5 봄, 6~8 여름, 9~11 가을', () => {
  const want = { 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'autumn', 10: 'autumn', 11: 'autumn', 12: 'winter' };
  for (const [m, k] of Object.entries(want)) assert.equal(seasonOf(Number(m)).key, k, m + '월');
});

test('그리드 칸 단계', () => {
  assert.equal(S.level(0, 0), 'pre');
  assert.equal(S.level(2, 0), 'none');
  assert.equal(S.level(2, 1), 'half');
  assert.equal(S.level(2, 2), 'full');
  assert.equal(S.level(1, 1), 'full');
});

const config = {
  routines: [
    { key: 'squat', icon: '🦵', name: '스쿼트 100개', who: '다진', owner: 'her', start: '2026-10-18' },
    { key: 'tennis', icon: '🎾', name: '테니스 연습', who: '준민', owner: 'me', start: '2026-10-27' }
  ]
};
const checks = Object.fromEntries(squatDone.map((d) => ['squat|' + D.toKey(d), true]));

test('화면 모델 10/26: 카드 두 장, 테니스는 D-1, 그리드는 10/18 주부터', () => {
  const m = M.build({ config, checks, today: day(10, 26), filter: 'all', page: 0, sheetDay: null });
  assert.equal(m.header.season.key, 'autumn');
  assert.deepEqual(m.chips.map((c) => c.label), ['전체', '다진', '준민']);
  const [sq, tn] = m.cards;
  assert.equal(sq.dayValue, '9일차');
  assert.equal(sq.streakValue, '4일');
  assert.equal(sq.streakLabel, '연속 · 오늘 하면 5일차');
  assert.match(sq.hint, /최근 쉰 날 10월 21일/);
  assert.equal(tn.started, false);
  assert.equal(tn.dayValue, 'D-1');
  assert.equal(m.grid.range, '2026년 10월');
  assert.equal(m.grid.cells.length, 35); // 9/27 주 ~ 10/31 주
  assert.equal(m.grid.cells[0].out, true); // 9월 칸은 비워 둔다
  assert.equal(m.grid.cells.find((c) => !c.out).day, day(10, 1));
  assert.equal(m.grid.cells.find((c) => c.day === day(10, 17)).level, 'pre');
  const c26 = m.grid.cells.find((c) => c.day === day(10, 26));
  assert.equal(c26.today, true);
  assert.equal(c26.level, 'none');
  // 테니스 시작 전에 다진만 스쿼트한 날은 '모두'가 아니라 '일부'
  assert.equal(m.grid.cells.find((c) => c.day === day(10, 22)).level, 'half');
  assert.equal(m.grid.cells.find((c) => c.day === day(10, 27)).level, 'future');
  assert.equal(m.both.value, '—');
});

test('준민 칩: 테니스 시작 전 칸은 누를 수 없다', () => {
  const m = M.build({ config, checks, today: day(10, 26), filter: 'me', page: 0, sheetDay: null });
  assert.equal(m.cards.length, 1);
  assert.equal(m.grid.cells.find((c) => c.day === day(10, 26)).level, 'pre');
  assert.equal(m.grid.cells.find((c) => c.day === day(10, 26)).disabled, true);
  assert.equal(m.both, null);
});

test('바텀 시트: 오늘은 체크, 지난날은 고치기, 시작 전 루틴은 잠김', () => {
  const m = M.build({ config, checks, today: day(10, 26), filter: 'all', page: 0, sheetDay: day(10, 26), me: 'her' });
  assert.equal(m.sheet.isToday, true);
  assert.equal(m.sheet.rows[0].button, '체크');
  assert.equal(m.sheet.rows[0].meta, '9일차 · 하면 연속 5일차');
  assert.equal(m.sheet.rows[1].pre, true);
  const past = M.build({ config, checks, today: day(10, 26), filter: 'all', page: 0, sheetDay: day(10, 19), me: 'her' });
  assert.equal(past.sheet.rows[0].button, '안 함');
  assert.equal(past.sheet.rows[0].meta, '2일차');
  const future = M.build({ config, checks, today: day(10, 26), filter: 'all', page: 0, sheetDay: day(10, 27) });
  assert.equal(future.sheet, null);
});

test('달력은 지난달·다음 달 모두 넘겨 볼 수 있다', () => {
  const now = M.build({ config, checks, today: day(10, 27), page: 0 });
  assert.equal(now.grid.range, '2026년 10월');
  assert.equal(now.grid.canPrev, true);
  assert.equal(now.grid.canNext, true);
  assert.equal(now.grid.isThisMonth, true);
  const sep = M.build({ config, checks, today: day(10, 27), page: 1 });
  assert.equal(sep.grid.range, '2026년 9월');
  assert.ok(sep.grid.cells.filter((c) => !c.out).every((c) => c.level === 'pre' && c.disabled)); // 시작 전 달
  const nov = M.build({ config, checks, today: day(10, 27), page: -1 });
  assert.equal(nov.grid.range, '2026년 11월');
  assert.ok(nov.grid.cells.filter((c) => !c.out).every((c) => c.level === 'future' && c.disabled)); // 아직 안 온 달
  assert.equal(nov.grid.isThisMonth, false);
  const far = M.build({ config, checks, today: day(10, 27), page: -99 });
  assert.equal(far.grid.range, '2027년 10월'); // 앞으로 12달까지
  assert.equal(far.grid.canNext, false);
  const back = M.build({ config, checks, today: day(10, 27), page: 99 });
  assert.equal(back.grid.range, '2025년 10월'); // 시작한 달보다 12달 앞까지
  assert.equal(back.grid.canPrev, false);
  const jan = M.build({ config, checks, today: D.fromYMD(2027, 1, 5), page: 1 });
  assert.equal(jan.grid.range, '2026년 12월'); // 해 넘김
});

test('둘 다 시작한 뒤 모두 해낸 날 연속', () => {
  const c = { ...checks };
  for (const d of [27, 28]) { c['squat|2026-10-' + d] = true; c['tennis|2026-10-' + d] = true; }
  const m = M.build({ config, checks: c, today: day(10, 29), filter: 'all', page: 0, sheetDay: null });
  assert.equal(m.both.value, '2일');
  assert.match(m.both.hint, /오늘 모두 하면 3일/);
});

test('이상한 config는 걸러낸다', () => {
  assert.deepEqual(M.routinesFrom({ routines: [{ key: 'a b', start: '2026-10-01' }, { key: 'x', start: 'nope' }] }), []);
  assert.equal(M.build({ config: null, checks: {}, today: day(10, 26) }).empty, true);
});

// ── 점검에서 나온 문제의 재발 방지 테스트 ──
const St = require('../js/store.js');

test('[점검 11] 없는 날짜(2월 30일, 13월)는 거른다', () => {
  assert.ok(Number.isNaN(D.parse('2026-02-30')));
  assert.ok(Number.isNaN(D.parse('2026-13-01')));
  assert.equal(D.parse('2028-02-29'), D.fromYMD(2028, 2, 29));
});

test('[점검 9] owner가 이상하거나 all이면 그 루틴을 뺀다', () => {
  const bad = { routines: [
    { key: 'a', who: 'x', owner: 'a"b', start: '2026-10-01' },
    { key: 'b', who: 'y', owner: 'all', start: '2026-10-01' },
    { key: 'c', who: 'z', owner: 'constructor', start: '2026-10-01' }
  ] };
  const rs = M.routinesFrom(bad);
  assert.deepEqual(rs.map((r) => r.key), ['c']);
  const m = M.build({ config: bad, checks: {}, today: day(10, 26) });
  assert.deepEqual(m.chips.map((c) => c.id), ['all', 'constructor']);
});

test('[점검 10·12] 오늘 칸 이름에 "오늘", 범례는 루틴 수에 맞게', () => {
  const m = M.build({ config, checks, today: day(10, 26), filter: 'all', page: 0, sheetDay: null });
  assert.match(m.grid.cells.find((c) => c.today).aria, /오늘/);
  assert.deepEqual(m.grid.legend.map((l) => l.label), ['안 함', '일부', '모두']);
  const three = { routines: config.routines.concat([{ key: 'run', icon: '', name: '런닝', who: '다진', owner: 'her', start: '2026-10-18' }]) };
  assert.equal(M.build({ config: three, checks, today: day(10, 26), filter: 'all' }).grid.legend[1].label, '일부');
});

test('[점검 6] 저장 중인 탭은 오래된 저장소 값보다 앞선다', () => {
  const merged = St.mergeChecks({ 'squat|2026-10-26': true }, { 'squat|2026-10-26': false, 'tennis|2026-10-27': true });
  assert.deepEqual(merged, { 'tennis|2026-10-27': true });
});

test('[점검 6] 같은 날 체크→취소를 연달아 눌러도 마지막 탭대로 저장된다', async () => {
  const docs = new Map();
  let failFirst = true;
  const db = { doc: (p) => ({
    set: async (v) => { if (failFirst) { failFirst = false; throw { code: 'unavailable' }; } docs.set(p, v); },
    delete: async () => { docs.delete(p); }
  }) };
  const s = St.createStore(db, { retryDelay: () => 30 });
  const a = s.setDone('squat', '2026-10-26', true);   // 첫 시도 실패 → 30ms 뒤 재시도
  const b = s.setDone('squat', '2026-10-26', false);  // 사용자가 바로 취소
  await Promise.all([a, b]);
  assert.equal(docs.has('checks/squat_2026-10-26'), false);
});

test('[점검 1] 저장이 끝내 실패하면 setDone이 거절된다(화면이 되돌릴 수 있게)', async () => {
  const db = { doc: () => ({ set: async () => { throw { code: 'invalid_argument' }; }, delete: async () => {} }) };
  await assert.rejects(St.createStore(db).setDone('squat', '2026-10-26', true));
});

test('[사용자 지적] 한 사람만 루틴을 하던 기간은 전체 보기에서 "모두" 색이 아니다', () => {
  const all = M.build({ config, checks, today: day(10, 26), filter: 'all' });
  for (const d of [18, 22, 23, 24, 25]) assert.equal(all.grid.cells.find((c) => c.day === day(10, d)).level, 'half', '10/' + d);
  const her = M.build({ config, checks, today: day(10, 26), filter: 'her' });
  assert.equal(her.grid.cells.find((c) => c.day === day(10, 22)).level, 'full'); // 다진 칩에서는 완료
  const c = { ...checks, 'squat|2026-10-27': true, 'tennis|2026-10-27': true };
  const both = M.build({ config, checks: c, today: day(10, 27), filter: 'all' });
  assert.equal(both.grid.cells.find((x) => x.day === day(10, 27)).level, 'full'); // 둘 다 한 날만 진한 색
});

test('머리말: 짝꿍 그리드, 서브 카피 없음', () => {
  const V = require('../js/view.js');
  const html = V.page('ready', M.build({ config, checks, today: day(10, 27) }), '');
  assert.match(html, /<h1 class="title">짝꿍 그리드<\/h1>/);
  assert.doesNotMatch(html, /사계절|도란도란|달성 그리드<\/h1>/);
});

// ── 같이 쓰기: 누가 체크했는지 · 남의 루틴 잠금 · 알림 ──
const P = require('../js/people.js');
const N = require('../js/news.js');
const cfg2 = { ...config, ownerPerson: 'me', guestPerson: 'her' };
const rts = M.routinesFrom(cfg2);

test('보는 사람: 주인은 준민, 초대받은 사람은 다진, 모르면 기기에서 고른 값', () => {
  assert.deepEqual(P.resolve(cfg2, true, null, rts), { person: 'me', source: 'account' });
  assert.deepEqual(P.resolve(cfg2, false, 'me', rts), { person: 'her', source: 'account' }); // 기기 값보다 계정이 우선
  assert.deepEqual(P.resolve(cfg2, null, 'her', rts), { person: 'her', source: 'device' });
  assert.deepEqual(P.resolve(cfg2, null, 'nobody', rts), { person: null, source: 'none' });
  assert.equal(P.nameOf(rts, 'her'), '다진');
});

test('남의 루틴은 못 누른다: 준민 화면에서 스쿼트는 잠김, 테니스는 체크 가능', () => {
  const c = { ...checks, 'squat|2026-10-27': true };
  const meta = { 'squat|2026-10-27': { by: 'her', at: '2026-10-27T09:33:00+09:00' } };
  const m = M.build({ config: cfg2, checks: c, meta, today: day(10, 27), sheetDay: day(10, 27), me: 'me', identity: 'account' });
  const [sq, tn] = m.sheet.rows;
  assert.equal(sq.locked, true);
  assert.equal(sq.button, '완료');
  assert.equal(sq.by, '다진 · 오전 9:33 체크');
  assert.equal(tn.locked, false);
  assert.equal(tn.button, '체크');
  assert.match(m.sheet.sub, /내 루틴만 체크할 수 있어요/);
  assert.equal(m.header.meName, '준민');
  const her = M.build({ config: cfg2, checks: c, meta, today: day(10, 27), sheetDay: day(10, 27), me: 'her', identity: 'account' });
  assert.equal(her.sheet.rows[1].locked, true);
  assert.equal(her.sheet.rows[1].button, '아직');
  assert.equal(her.sheet.rows[0].locked, false);
});

test('누구인지 모르면 아무것도 못 누르고 고르기 카드가 뜬다', () => {
  const m = M.build({ config: cfg2, checks, today: day(10, 27), sheetDay: day(10, 27), me: null, identity: 'none' });
  assert.ok(m.sheet.rows.every((r) => r.locked));
  assert.equal(m.needsPick, true);
  assert.deepEqual(m.people.map((p) => p.name), ['다진', '준민']);
  assert.equal(M.build({ config: cfg2, checks, today: day(10, 27), me: null, identity: 'pending' }).needsPick, false);
});

test('지난날 기록에는 시각 없이 누가 체크했는지만', () => {
  const meta = { 'squat|2026-10-25': { by: 'her', at: '2026-10-25T21:00:00+09:00' } };
  const m = M.build({ config: cfg2, checks, meta, today: day(10, 27), sheetDay: day(10, 25), me: 'her' });
  assert.equal(m.sheet.rows[0].by, '다진 체크');
  assert.equal(m.sheet.rows[0].locked, false); // 내 지난 기록은 고칠 수 있다
});

test('실시간 알림: 상대가 오늘 체크하면 한 줄, 내 체크나 취소는 조용히', () => {
  const it = { routine: 'squat', date: '2026-10-27', done: true, by: 'her', at: '2026-10-27T09:33:00+09:00' };
  assert.equal(N.live([it], 'me', rts, day(10, 27)), '🎉 다진 님이 스쿼트 100개 완료!');
  assert.equal(N.live([it], 'her', rts, day(10, 27)), '');
  assert.equal(N.live([{ ...it, date: '2026-10-25' }], 'me', rts, day(10, 27)), '다진 님이 10월 25일 스쿼트 100개 기록을 남겼어요');
  assert.equal(N.live([], 'me', rts, day(10, 27)), '');
});

test('다시 열었을 때: 마지막으로 본 뒤 상대가 남긴 기록 요약', () => {
  const meta = {
    'squat|2026-10-26': { by: 'her', at: '2026-10-26T21:00:00+09:00' },
    'squat|2026-10-27': { by: 'her', at: '2026-10-27T09:33:00+09:00' },
    'tennis|2026-10-27': { by: 'me', at: '2026-10-27T10:00:00+09:00' }
  };
  assert.equal(N.catchUp(meta, 'me', rts, day(10, 27), '2026-10-27T08:00:00+09:00'), '👏 다진 님이 오늘 오전 9:33에 스쿼트 100개 완료했어요');
  assert.equal(N.catchUp(meta, 'me', rts, day(10, 27), '2026-10-26T08:00:00+09:00'), '👏 다진 님 새 기록 2개 · 최근 오늘 스쿼트 100개');
  assert.equal(N.catchUp(meta, 'me', rts, day(10, 27), '2026-10-27T12:00:00+09:00'), '');
  assert.equal(N.catchUp(meta, 'me', rts, day(10, 27), null), ''); // 처음 여는 기기는 조용히
});

test('저장할 때 누가 · 언제를 남긴다', async () => {
  const docs = new Map();
  const db = { doc: (p) => ({ set: async (v) => { docs.set(p, v); }, delete: async () => {} }) };
  await St.createStore(db).setDone('tennis', '2026-10-27', true, { person: 'me', uid: 'u_x' });
  const v = docs.get('checks/tennis_2026-10-27');
  assert.equal(v.by, 'me');
  assert.equal(v.byUid, 'u_x');
  assert.ok(!Number.isNaN(Date.parse(v.at)));
});

// ── 내 루틴 추가 · 수정 · 그만하기 ──
const cfg3 = (extra) => ({ ownerPerson: 'me', guestPerson: 'her', people: { me: '준민', her: '다진' }, routines: config.routines.concat(extra || []) });

test('루틴을 그만하면 마지막 날까지만 세고, 다음 날부터 카드와 그리드에서 빠진다', () => {
  const c = cfg3();
  c.routines = c.routines.map((r) => r.key === 'squat' ? { ...r, end: '2026-10-25' } : r);
  const m = M.build({ config: c, checks, today: day(10, 27), me: 'me' });
  assert.deepEqual(m.cards.map((k) => k.key), ['tennis']);
  assert.equal(m.grid.cells.find((x) => x.day === day(10, 26)).level, 'pre'); // 그만둔 뒤 테니스 시작 전 → 루틴 없음
  assert.equal(m.grid.cells.find((x) => x.day === day(10, 22)).level, 'half'); // 지난 기록은 남는다
  const sheet = M.build({ config: c, checks, today: day(10, 27), me: 'me', sheetDay: day(10, 27) }).sheet;
  assert.deepEqual(sheet.rows.map((r) => r.key), ['tennis']); // 그만둔 루틴은 시트에도 없다
});

test('나중에 루틴을 추가해도 지난 "모두" 날은 그대로 (사람 기준)', () => {
  const extra = [{ key: 'read', icon: '📚', name: '독서 20분', who: '준민', owner: 'me', start: '2026-11-01' }];
  const c = { ...checks, 'squat|2026-10-28': true, 'tennis|2026-10-28': true };
  const m = M.build({ config: cfg3(extra), checks: c, today: day(10, 29), me: 'me' });
  assert.equal(m.grid.cells.find((x) => x.day === day(10, 28)).level, 'full');
  // 11월 1일부터는 준민이 테니스와 독서를 둘 다 해야 '모두'
  const c2 = { ...c, 'squat|2026-11-01': true, 'tennis|2026-11-01': true };
  const nov = M.build({ config: cfg3(extra), checks: c2, today: day(11, 1), me: 'me' });
  assert.equal(nov.grid.cells.find((x) => x.day === day(11, 1)).level, 'half');
  const c3 = { ...c2, 'read|2026-11-01': true };
  assert.equal(M.build({ config: cfg3(extra), checks: c3, today: day(11, 1) }).grid.cells.find((x) => x.day === day(11, 1)).level, 'full');
});

test('「내 루틴」 시트: 내 것만, 진행 중 · 그만한 것 나눠서, 기록 없는 루틴만 삭제 가능', () => {
  const extra = [
    { key: 'read', icon: '📚', name: '독서 20분', who: '준민', owner: 'me', start: '2026-11-01' },
    { key: 'run', icon: '🏃', name: '아침 런닝', who: '준민', owner: 'me', start: '2026-10-01', end: '2026-10-20' }
  ];
  const c = { ...checks, 'run|2026-10-02': true };
  const m = M.build({ config: cfg3(extra), checks: c, today: day(10, 27), me: 'me', manage: { open: true, form: { key: 'read', name: '독서 20분', icon: '📚', start: '2026-11-01' } } });
  assert.deepEqual(m.manage.current.map((x) => x.key), ['tennis', 'read']);
  assert.match(m.manage.current[1].status, /D-5/);
  assert.deepEqual(m.manage.ended.map((x) => x.key), ['run']);
  assert.equal(m.manage.form.mode, 'edit');
  assert.equal(m.manage.form.canDelete, true);   // 독서는 기록이 없다
  assert.equal(m.manage.form.canStop, false);    // 아직 시작 전
  assert.equal(m.manage.form.icons.length, 16);
  const t = M.build({ config: cfg3(extra), checks: c, today: day(10, 27), me: 'me', manage: { open: true, form: { key: 'tennis', name: '테니스 연습', icon: '🎾', start: '2026-10-27' } } });
  assert.equal(t.manage.form.canStop, true);
  const her = M.build({ config: cfg3(extra), checks: c, today: day(10, 27), me: 'her', manage: { open: true, form: null } });
  assert.deepEqual(her.manage.current.map((x) => x.key), ['squat']);
  assert.equal(M.build({ config: cfg3(), checks, today: day(10, 27), me: null, manage: { open: true } }).manage, null);
});

test('루틴 입력 확인', () => {
  assert.equal(M.validateRoutine({ name: ' ', icon: '📚', start: '2026-11-01' }), '루틴 이름을 적어 주세요');
  assert.equal(M.validateRoutine({ name: '가'.repeat(21), icon: '📚', start: '2026-11-01' }), '이름은 20자까지 쓸 수 있어요');
  assert.equal(M.validateRoutine({ name: '독서', icon: '🍕', start: '2026-11-01' }), '아이콘을 골라 주세요');
  assert.equal(M.validateRoutine({ name: '독서', icon: '📚', start: '' }), '시작일을 골라 주세요');
  assert.equal(M.validateRoutine({ name: '독서', icon: '📚', start: '2026-11-01' }), '');
});

test('루틴이 하나도 없는 사람도 config.people로 알아본다', () => {
  const c = { ...cfg3(), routines: [config.routines[0]] }; // 준민 루틴 없음
  const rs = M.routinesFrom(c);
  assert.deepEqual(P.resolve(c, true, null, rs), { person: 'me', source: 'account' });
  const m = M.build({ config: c, checks, today: day(10, 27), me: 'me', identity: 'account' });
  assert.equal(m.header.meName, '준민');
  assert.equal(m.canManage, true);
});

test('루틴 저장 · 삭제는 routines/<key> 문서로', async () => {
  const docs = new Map();
  const db = { doc: (p) => ({ set: async (v) => { docs.set(p, v); }, delete: async () => { docs.delete(p); } }) };
  const s = St.createStore(db);
  await s.saveRoutine({ key: 'read1', icon: '📚', name: '독서', who: '준민', owner: 'me', start: '2026-11-01', end: null, order: 3 });
  assert.equal(docs.get('routines/read1').name, '독서');
  await s.deleteRoutine('read1');
  assert.equal(docs.has('routines/read1'), false);
  assert.match(St.newKey(), /^[a-z0-9]+$/);
});

// ── 두 번째 점검의 재발 방지 ──
test('[점검 8] 한 사람이 루틴을 모두 그만두면, 남은 사람만 다 해도 "모두"', () => {
  const c = cfg3();
  c.routines = c.routines.map((r) => r.key === 'squat' ? { ...r, end: '2026-10-27' } : r);
  const ch = { ...checks, 'tennis|2026-10-28': true };
  const m = M.build({ config: c, checks: ch, today: day(10, 28) });
  assert.equal(m.grid.cells.find((x) => x.day === day(10, 28)).level, 'full');
  assert.equal(m.allDoneToday, true);
  assert.equal(m.togetherToday, false); // 오늘 루틴이 있는 사람은 한 명 → "같이" 문구 안 씀
  // 그만두기 전 날(10/27)은 둘 다 해야 '모두'
  assert.equal(m.grid.cells.find((x) => x.day === day(10, 27)).level, 'none');
});

test('[점검 7] 그만둔 날이 시작일보다 앞서도 루틴이 사라지지 않는다', () => {
  const c = cfg3([{ key: 'odd', icon: '📚', name: '이상한 루틴', who: '준민', owner: 'me', start: '2026-11-05', end: '2026-10-30' }]);
  const r = M.routinesFrom(c).find((x) => x.key === 'odd');
  assert.ok(r);
  assert.equal(r.end, r.start);
  const m = M.build({ config: c, checks, today: day(11, 10), me: 'me', manage: { open: true, form: null } });
  assert.ok(m.manage.ended.some((x) => x.key === 'odd')); // 내 루틴에서 찾아서 고치거나 지울 수 있다
});

test('[점검 9] 고치던 루틴이 다른 기기에서 지워지면 칸을 닫으라고 알려 준다', () => {
  const m = M.build({ config: cfg3(), checks, today: day(10, 27), me: 'me', manage: { open: true, form: { key: 'gone', name: 'x', icon: '📚', start: '2026-10-27' } } });
  assert.equal(m.manage.gone, true);
  assert.equal(m.manage.form, null);
});

test('[점검 2] 루틴이 하나도 없고 누구인지 모르면 빈 화면에서도 고르기 카드가 뜬다', () => {
  const c = { ...cfg3(), routines: [] };
  const m = M.build({ config: c, checks: {}, today: day(10, 27), me: null, identity: 'none' });
  assert.equal(m.empty, true);
  assert.equal(m.needsPick, true);
  assert.deepEqual(m.people.map((p) => p.name).sort(), ['다진', '준민']);
  const V = require('../js/view.js');
  assert.match(V.page('ready', m, ''), /누구로 체크할까요/);
});

test('[점검 8] 지금 하는 루틴이 없는 사람 칩을 누르면 안내가 뜬다', () => {
  const c = cfg3();
  c.routines = c.routines.map((r) => r.key === 'squat' ? { ...r, end: '2026-10-26' } : r);
  const m = M.build({ config: c, checks, today: day(10, 28), filter: 'her' });
  assert.equal(m.emptyFilter, true);
  const V = require('../js/view.js');
  assert.match(V.page('ready', m, ''), /지금 하고 있는 루틴이 없어요/);
});

test('사람 점 색은 사람 키와 상관없이 루틴 순서로 정한다 (웹판은 키가 uid)', () => {
  const c = { people: { uA: '다진', uB: '준민' }, routines: [
    { key: 'squat', icon: '🦵', name: '스쿼트 100개', who: '다진', owner: 'uA', start: '2026-10-18', order: 0 },
    { key: 'tennis', icon: '🎾', name: '테니스 연습', who: '준민', owner: 'uB', start: '2026-10-27', order: 1 }] };
  const m = M.build({ config: c, checks: {}, today: day(10, 27), me: 'uB', identity: 'account' });
  assert.deepEqual(m.cards.map((k) => k.dot), ['her', 'me']);
  assert.deepEqual(m.chips.map((x) => x.label), ['전체', '다진', '준민']);
  assert.equal(m.header.meName, '준민');
});
