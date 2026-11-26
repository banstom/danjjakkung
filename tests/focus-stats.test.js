// node --test tests/focus-stats.test.js — 집중 통계 계산 S1~S16 + S14-2 (docs/focus-stats/reference/focus-stats.test.js 를 옮김: 저장소 모듈 · 문구로)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FS = require('../js/focus-stats.js');
const FX = require('../docs/focus-stats/reference/fixtures.js');
const T = require('../js/focus-text.js').S;
const MIN = 60000;
const base = { logs: FX.weekMany, prevLogs: FX.prevWeek, olderLogs: FX.older, me: FX.ME, her: FX.HER, today: FX.TODAY, now: FX.NOW };

test('S1 시간 표기: 짧은 곳 H:MM · 문장 「2시간 10분」 · 1시간 미만 「48분」', () => {
  assert.equal(T.short(130 * MIN), '2:10');
  assert.equal(T.short(5 * MIN + 59999), '0:05'); // 버림
  assert.equal(T.long(130 * MIN), '2시간 10분');
  assert.equal(T.long(120 * MIN), '2시간');
  assert.equal(T.long(48 * MIN), '48분');
  assert.equal(T.long(0), '0분');
});

test('S2 하루는 05시에 나뉨: 00:10 시작은 앞날, 05:00 은 그날', () => {
  assert.equal(FS.dayOf(FX.at('2026-11-25', '00:10')), '2026-11-25');
  assert.equal(FS.dayOf(FX.at('2026-11-26', '05:00')), '2026-11-26');
  assert.equal(FS.dayOf(FX.at('2026-11-26', '04:59')), '2026-11-26'); // 11-27 04:59 → 11-26
  assert.equal(FS.dayStartMs('2026-11-26'), Date.parse('2026-11-26T05:00:00+09:00'));
  assert.equal(FS.dayOf(Date.parse('2026-11-27T04:59:00+09:00')), '2026-11-26');
  assert.equal(FS.dayOf(Date.parse('2026-11-27T05:00:00+09:00')), '2026-11-27');
  assert.equal(FS.weekStart('2026-11-29'), '2026-11-23');
  assert.equal(FS.dow('2026-11-23'), 0);
});

test('S3 함께 = 두 사람 구간이 겹친 시간 (쉬기는 빠짐, 같은 사람 겹침은 한 번만)', () => {
  const a = FS.merge([[0, 10], [5, 20], [30, 40]]);
  assert.deepEqual(a, [[0, 20], [30, 40]]);
  assert.equal(FS.length(FS.intersect(a, [[15, 35]])), 10);
  const w = FS.weekView(base);
  assert.equal(T.short(w.days[2].both), '1:40'); // 수: 19:35~ 겹침, 쉬는 10분은 빠짐
  assert.equal(w.days[1].both, 0);               // 화: 22:30 에 다진이 막 끝냄 → 0
});

test('S4 이번 주 합계 · 날별 · 미래 날', () => {
  const w = FS.weekView(base);
  assert.deepEqual(w.days.map(d => T.short(d.me)), ['2:20', '1:10', '2:45', '1:05', '0:00', '0:00', '0:00']);
  assert.deepEqual(w.days.map(d => T.short(d.her)), ['1:50', '1:25', '2:10', '0:45', '0:00', '0:00', '0:00']);
  assert.equal(T.short(w.total.me), '7:20');
  assert.equal(T.short(w.total.both), '3:30');
  assert.deepEqual(w.days.map(d => d.future), [false, false, false, false, true, true, true]);
  assert.equal(w.days[3].isToday, true);
});

test('S5 지난주 이맘때: 지난주 같은 시각까지만 자름, 늘었을 때만', () => {
  const w = FS.weekView(base);
  assert.equal(T.vsLastWeek(w.vsLastWeek), '지난주 이맘때보다 +2시간 20분');
  // 지난주가 더 많으면 null
  const w2 = FS.weekView(Object.assign({}, base, { logs: FX.weekFew }));
  assert.equal(w2.vsLastWeek, null);
  // 지난주 기록이 없으면 null
  const w3 = FS.weekView(Object.assign({}, base, { prevLogs: [] }));
  assert.equal(w3.vsLastWeek, null);
  // 구간 중간에서 자름: 지난주 목 14:30~15:30 → 30분만
  const cut = [FX.L(FX.ME, 'study', '', '2026-11-19', '14:30', [60])];
  const w4 = FS.weekView(Object.assign({}, base, { logs: [FX.L(FX.ME, 'study', '', FX.TODAY, '07:00', [40])], prevLogs: cut }));
  assert.equal(T.long(w4.vsLastWeek), '10분');
});

test('S6 막대 눈금: 가장 큰 값(나 · 짝꿍 · 목표)을 시간 단위로 올림, 적어도 1시간', () => {
  assert.equal(FS.weekView(base).scale, 3 * 60 * MIN);
  assert.equal(FS.weekView(Object.assign({}, base, { goalMs: 4 * 60 * MIN })).scale, 4 * 60 * MIN);
  assert.equal(FS.weekView(Object.assign({}, base, { logs: [] })).scale, 60 * MIN);
});

test('S7 연속: 오늘 했으면 오늘까지, 안 했으면 어제까지 · 빠진 날에서 끊김', () => {
  const w = FS.weekView(base);
  assert.deepEqual([w.tiles.streak.n, w.tiles.streak.todayDone], [15, true]); // 11-12 ~ 11-26
  const t = {}; t['2026-11-24'] = MIN; t['2026-11-25'] = MIN;
  assert.deepEqual(FS.streak(t, '2026-11-26'), { n: 2, todayDone: false, reachedDay: '2026-11-24' });
  assert.equal(T.streakNext(2), '오늘 하면 3일째');
  t['2026-11-25'] = 59999; // 1분 안 됨
  assert.equal(FS.streak(t, '2026-11-26').n, 0);
  // 읽어 둔 첫날까지 이어지면 더 읽어야 함
  assert.equal(FS.needMoreForStreak({ n: 15, reachedDay: '2026-11-12' }, '2026-11-12'), true);
  assert.equal(FS.needMoreForStreak({ n: 3, reachedDay: '2026-11-24' }, '2026-10-26'), false);
});

test('S8 기록 칸: 집중한 날 · 한 번에 가장 길게 · 목표 채운 날 · 가장 많이 한 날', () => {
  const w = FS.weekView(Object.assign({}, base, { goalMs: 120 * MIN }));
  assert.equal(w.tiles.focusedDays, 4);
  assert.deepEqual([T.short(w.tiles.longest.ms), w.tiles.longest.label], ['2:10', '수학']);
  assert.equal(w.tiles.goalDays, 2);               // 월 2:20 · 수 2:45
  assert.equal(FS.weekView(base).tiles.goalDays, null); // 목표 없으면 칸 대신 가장 많이 한 날
  assert.equal(w.tiles.bestDay.dow, 2);
});

test('S9 과목: 많은 순 4줄, 넘치면 3줄 + 「그 밖」, 짧은 이름 3개까지', () => {
  const s = FS.weekView(base).subjects;
  assert.deepEqual(s.rows.map(r => r.cat), ['study', 'lang', 'read', 'work']); // 같으면 id 순
  assert.deepEqual(s.rows[0].labels.map(l => l.label), ['수학', '영단어']);
  assert.equal(s.other, null);
  const extra = FX.weekMany.concat([FX.L(FX.ME, 'cert', '', '2026-11-24', '09:00', [10])]);
  const s2 = FS.weekView(Object.assign({}, base, { logs: extra })).subjects;
  assert.equal(s2.rows.length, 3);
  assert.deepEqual([s2.other.count, T.short(s2.other.ms)], [2, '0:45']);
  const many = ['a', 'b', 'c', 'd', 'e'].map((x, i) => FX.L(FX.ME, 'study', x, FX.TODAY, '08:0' + i, [10 - i]));
  assert.equal(FS.subjects(many, FX.ME).rows[0].moreLabels, 2);
});

test('S10 요일 누름: 그날 과목 · 시간대 띠', () => {
  const w = FS.weekView(Object.assign({}, base, { selected: 2 }));
  assert.equal(w.selected.day, '2026-11-25');
  assert.equal(T.dayLine(2, w.selected.me, FX.HER_NAME, w.selected.her, w.selected.both), '수 · 나 2:45 · 다진 2:10 · 함께 1:40');
  assert.deepEqual(w.subjects.rows.map(r => r.cat), ['study', 'work']);
  assert.equal(w.band.me.length, 4);
  assert.equal(w.band.both.length, 3); // 저녁 두 번 + 새벽(나 23:40~00:15 · 다진 00:10~)
  assert.ok(w.band.her.some(x => x[0] > 19 / 24)); // 00:10 새벽 기록은 띠 오른쪽 끝 쪽
});

test('S11 히트맵 단계: 한 사람 1분 · 1시간 · 2시간 · 4시간 / 함께 1분 · 30분 · 1시간 · 2시간', () => {
  assert.deepEqual([0, MIN - 1, MIN, 59 * MIN, 60 * MIN, 120 * MIN, 239 * MIN, 240 * MIN].map(m => FS.level(m)), [0, 0, 1, 1, 2, 3, 3, 4]);
  // 함께 달력은 30분 · 1시간 · 2시간
  assert.deepEqual([0, MIN, 29 * MIN, 30 * MIN, 60 * MIN, 120 * MIN].map(m => FS.level(m, true)), [0, 1, 1, 2, 3, 4]);
});

test('S12 돌아보기 달: 합계 · 함께한 날(10분 이상) · 앞 빈 칸 · 기록', () => {
  const m = FS.monthView({ logs: FX.november(), me: FX.ME, her: FX.HER, month: '2026-11', today: FX.TODAY });
  assert.equal(m.cells.length, 30);
  assert.equal(m.lead, 6); // 11-01 은 일요일
  assert.deepEqual([T.short(m.total.me), T.short(m.total.her), T.short(m.total.both)], ['35:37', '27:02', '12:35']);
  assert.equal(m.togetherDays, 13);
  assert.equal(T.rvBestTogether(m.bestTogether.day, m.bestTogether.ms), '함께 가장 길었던 날 11/25 · 1:40');
  assert.equal(m.cells[26].future, true);
  const tiny = [FX.L(FX.ME, 'study', '', FX.TODAY, '08:00', [9]), FX.L(FX.HER, 'study', '', FX.TODAY, '08:00', [9])];
  assert.equal(FS.monthView({ logs: tiny, me: FX.ME, her: FX.HER, month: '2026-11', today: FX.TODAY }).togetherDays, 0);
});

test('S13 돌아보기 주: 그 주만, 비교 없음', () => {
  const v = FS.rangeView({ logs: FX.prevWeek.concat(FX.older), me: FX.ME, her: FX.HER, from: '2026-11-16', to: '2026-11-22', today: FX.TODAY });
  assert.deepEqual([T.short(v.total.me), T.short(v.total.her), T.short(v.total.both)], ['8:45', '5:10', '2:40']);
  assert.equal(v.cells.length, 7);
  assert.equal(v.togetherDays, 3);
  assert.equal('vs' in v, false);
});

test('S14 결산 카드: 분 단위 · 사람별 · 날마다 함께 · 지난달 값', () => {
  const c = FS.recapCard(FX.november(), '2026-11', [FX.ME, FX.HER], FX.octCard);
  assert.equal(c.id, 'focus');
  assert.equal(c.together, 755);
  assert.deepEqual(c.people, { jun: 2137, dajin: 1622 });
  assert.equal(c.togetherDays, 13);
  assert.deepEqual(c.best, { day: '2026-11-25', min: 100 });
  assert.equal(c.days.length, 30);
  assert.equal(T.rcVsPrev((c.together - c.prevTogether) * MIN), '지난달보다 +1시간 55분');
  assert.equal(T.rcVsPrev(-65 * MIN), '지난달보다 −1시간 5분');
  assert.equal(FS.recapCard([], '2026-11', [FX.ME, FX.HER], null), null);
  assert.equal(FS.recapCard(FX.november(), '2026-11', [FX.ME, FX.HER], null).prevTogether, null);
});

test('S14-2 첫 달(11월): 지난달 카드 없음 · since = 첫 기록 날', () => {
  const first = FX.november().filter(l => l.day >= '2026-11-25');
  const c = FS.recapCard(first, '2026-11', [FX.ME, FX.HER], null);
  assert.equal(c.prevTogether, null);
  assert.equal(c.since, '2026-11-25');
  assert.equal(T.rcSince(c.since), '11/25부터 모은 기록이에요');
  assert.equal(T.long(c.together * MIN), '2시간 10분');
  assert.equal(FS.recapCard(FX.november(), '2026-11', [FX.ME, FX.HER], null).since, '2026-11-01');
});

test('S15 연말: 가장 많이 함께한 달', () => {
  const y = FS.recapYear({ '2026-10': { together: 640 }, '2026-11': { together: 755 }, '2026-12': null });
  assert.deepEqual(y, { id: 'focus', together: 1395, bestMonth: { month: '2026-11', together: 755 } });
  assert.equal(T.rcYearBest('2026-11', 755 * MIN), '가장 많이 함께한 달 11월 · 12시간 35분');
});

test('S16 빈 주: empty · 과목 없음 · 연속은 지난 기록으로', () => {
  const w = FS.weekView(Object.assign({}, base, { logs: [] }));
  assert.equal(w.empty, true);
  assert.equal(w.subjects.rows.length, 0);
  assert.equal(w.tiles.longest, null);
  assert.deepEqual([w.tiles.streak.n, w.tiles.streak.todayDone], [0, false]); // 이번 주가 비면 어제(수)도 빔 → 0
});

// ── 저장소와 맞춰 보기 (docs/focus-stats/tests.md A1 · A2 · A3) ──
test('A1 · A2 지금 계산(js/focus.js totals · week)과 새 모듈(weekView)의 날별 나 · 짝꿍 · 함께가 같다 — 무작위 로그 200번', () => {
  const F = require('../js/focus.js');
  const now = Date.parse('2026-11-29T23:00:00+09:00'); // 일요일 밤 → 이번 주 7일 모두 지남
  const ws = FS.weekStart(FS.dayOf(now));
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 0; n < 200; n++) {
    const logs = [];
    for (const by of ['a', 'b']) {
      for (let d = 0; d < 7; d++) {
        let t = FS.dayStartMs(FS.addDays(ws, d)) + Math.floor(rnd() * 6) * 3600000;
        for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
          const len = (5 + Math.floor(rnd() * 120)) * 60000, gap = Math.floor(rnd() * 90) * 60000;
          const s = t + gap, e = s + len; t = e;
          const parts = F.byDay([[s, e]]);
          Object.keys(parts).forEach((day) => { const ss = parts[day]; logs.push({ by, cat: 'study', label: '', day, start: ss[0][0], end: ss[ss.length - 1][1], ms: F.sum(ss), segs: ss }); });
        }
      }
    }
    const wv = FS.weekView({ logs, prevLogs: [], olderLogs: [], me: 'a', her: 'b', today: FS.dayOf(now), now });
    const fw = F.week(logs, {}, 'a', 'b', now);
    wv.days.forEach((d, i) => {
      assert.equal(d.me, fw.days[i].me, 'me ' + d.day); assert.equal(d.her, fw.days[i].her, 'her ' + d.day);
      const t = F.totals(logs, {}, 'a', 'b', FS.dayStartMs(d.day) + 3600000);
      assert.equal(d.both, t.both, '함께 = 오늘 카드 「🔥 함께」 ' + d.day);
    });
  }
});
test('A3 저장소 segs 모양: Firestore [{ s, e }] → 앱 · 서버 모두 [[s, e]] (ms) 로 바꿔 넘김', () => {
  const RR = require('../functions/recap-read.js');
  const raw = { members: [{ id: 'a', name: '준민' }, { id: 'b', name: '다진' }], focusLogs: [{ id: 'f1', by: 'a', cat: 'study', label: '수학', day: '2026-11-25', start: 1, end: 61, ms: 60, segs: [{ s: 1, e: 61 }] }] };
  const inp = RR.toInput(raw, { kind: 'month', key: '2026-11' });
  assert.deepEqual(inp.focusLogs[0].segs, [[1, 61]]);
  assert.equal(inp.focusLogs[0].ms, 60);
});
