// node --test tests/ledger-view.test.js — 단짝 영수증 화면 · 시트 규칙 (docs/ledger/tests.md B · C 묶음)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../js/view-ledger.js');
const F = require('../js/ledger-form.js');
const P = require('../js/ledger-parse.js');

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/ledger-2026-11.json'), 'utf8'));
const names = { jm: '준민', dj: '단짝' };
const ctx = (viewer, extra) => Object.assign({ month: '2026-11', nowMonth: '2026-11', minMonth: '2026-05', viewer, partner: viewer === 'jm' ? 'dj' : 'jm', names, slotOf: (u) => (u === 'jm' ? 'me' : 'her') }, extra || {});
const who = { meName: '준민', partnerName: '단짝', today: new Date(2026, 10, 19) };
const sctx = { names: { me: '준민', partner: '단짝' }, slots: { me: 'me', partner: 'her' }, todayKey: '2026-11-19' };

test('V1 요약 카드 — 목업 L1 숫자 · 보는 사람이 왼쪽', () => {
  const m = V.screenModel(fx.spends, ctx('jm'));
  assert.equal(m.sum.total, '446,200원');
  assert.deepEqual(m.sum.people.map((p) => [p.name, p.pct, p.text]), [['준민', 50, '22.1만 원'], ['단짝', 50, '22.5만 원']]);
  assert.equal(m.sum.line, '이번 달은 단짝이 3,800원 더 냈어요');
  const d = V.screenModel(fx.spends, ctx('dj'));
  assert.equal(d.sum.people[0].name, '단짝');
});

test('V2 목록: 최근 날짜 위 · 나눔 줄은 몫 작은 글씨(「1.2만 · 1.1만」) · 혼자 낸 줄은 「분류 · 이름」', () => {
  const m = V.screenModel(fx.spends, ctx('jm'));
  assert.equal(m.days[0].label, '11월 18일 (수)');
  const chicken = m.days[0].rows[0];
  assert.equal(chicken.ds, '식사 · 둘이 나눔');
  assert.equal(chicken.sub, '1.2만 · 1.1만');
  assert.deepEqual(chicken.split.map((s) => s.pct), [52, 48]);
  const taxi = m.days.flatMap((d) => d.rows).find((r) => r.what === '택시');
  assert.equal(taxi.ds, '교통 · 단짝');
  for (let i = 1; i < m.days.length; i++) assert.ok(m.days[i - 1].date > m.days[i].date);
});

test('V3 분류 칩: 큰 금액부터 · 누르면 그 분류만 + 「교통만 · 73,500원 · 2건」, 요약은 달 전체 그대로', () => {
  const m = V.screenModel(fx.spends, ctx('jm', { cat: 'move' }));
  assert.equal(m.chips[0].text, '식사 14.9만 원');
  assert.equal(m.chips.find((c) => c.cat === 'move').on, true);
  assert.deepEqual(m.filter, { label: '교통만', total: '73,500원', count: '2건' });
  assert.equal(m.sum.total, '446,200원');
  assert.ok(m.days.flatMap((d) => d.rows).every((r) => r.ds.startsWith('교통')));
});

test('V4 기록 없는 달(L10) · 달 넘기기 끝 · 지난달 문구', () => {
  const m = V.screenModel([], ctx('jm', { month: '2026-12', nowMonth: '2026-12' }));
  assert.equal(m.empty, true);
  assert.equal(m.sum.total, '0원');
  assert.equal(m.sum.line, '아직 이번 달 기록이 없어요');
  assert.equal(m.canNext, false);
  const html = V.screen(m);
  assert.match(html, /함께 쓴 돈을 한 줄로 적어 봐요/);
  assert.doesNotMatch(html, /lg-who/);
  const first = V.screenModel([], ctx('jm', { month: '2026-05' }));
  assert.equal(first.canPrev, false);
  assert.equal(first.sum.label, '5월 함께 쓴 돈');
  assert.equal(V.shiftMonth('2026-01', -1), '2025-12');
});

test('V5 전체 탭 카드(L11) 한 줄', () => {
  assert.equal(V.entryModel(fx.spends, ctx('jm')).line, '준민 50% · 단짝 50% · 단짝이 3,800원 더');
  assert.equal(V.entryModel([], ctx('jm')).line, '이번 달 기록이 없어요');
  assert.match(V.entryModel([{ amount: 1000, paidBy: 'jm', cat: 'etc' }, { amount: 1000, paidBy: 'dj', cat: 'etc' }], ctx('jm')).line, /똑같이 냈어요/);
  assert.match(V.entryCard(V.entryModel(fx.spends, ctx('jm'))), /data-act="all-ledger"/);
});

test('S1 한 줄 적기: 직접 고친 칸(누가 · 분류 · 날짜)은 한 줄을 또 고쳐도 그대로', () => {
  const f = F.newAdd(who, '2026-11-19');
  F.applyLine(f, '숙소 12만 반반', who);
  assert.deepEqual([f.payer, f.shares, f.cat], ['both', { me: 60000, partner: 60000 }, 'stay']);
  F.setPayer(f, 'partner'); F.setCat(f, 'play'); F.setDate(f, '2026-11-15');
  F.applyLine(f, '어제 숙소 13만 반반', who);
  assert.deepEqual([f.payer, f.cat, f.date, f.amount], ['partner', 'play', '2026-11-15', 130000]);
});

test('S2 각자 몫 안내(L4) · 몫 고치기(rebalance) · 혼자로 바꾸면 몫 없음', () => {
  const f = F.newAdd(who, '2026-11-19');
  F.applyLine(f, '저녁 내가 12000 단짝 11000', who);
  assert.equal(F.messages(f, sctx.names).split, '준민 12,000 · 단짝 11,000을 각자 몫으로 읽었어요');
  F.setShare(f, 'partner', '5000');
  assert.deepEqual(f.shares, { me: 18000, partner: 5000 });
  assert.equal(F.messages(f, sctx.names).split, undefined);
  F.setPayer(f, 'me');
  assert.equal(f.shares, null);
});

test('S3 한 번 더 봐 주세요(L5) · 금액 못 찾음(L6) · 1억 이상', () => {
  const f = F.newAdd(who, '2026-11-19');
  F.applyLine(f, '뭔가 5000', who);
  const m = F.messages(f, sctx.names);
  assert.equal(m.payer, '누가 냈는지 안 적혀서 준민(적는 사람)으로 해 뒀어요');
  assert.equal(m.cat, '분류를 못 찾아서 기타로 해 뒀어요 · 눌러서 바꿔요');
  assert.equal(F.canSave(f), true); // 안내만, 저장은 막지 않음
  F.setPayer(f, 'me');
  assert.equal(F.messages(f, sctx.names).payer, undefined);
  F.applyLine(f, '천안 저녁', who);
  assert.equal(F.messages(f, sctx.names).error, '금액을 못 찾았어요 · 예: 42000 · 4.2만 · 4만2천');
  assert.equal(F.canSave(f), false);
  F.applyLine(f, '집 1억', who);
  assert.equal(F.messages(f, sctx.names).error, '1억 원보다 작게 적어 주세요');
});

test('S4 저장 모양: 나눔은 uid 몫 · 한쪽 0원이면 혼자 낸 것 · 고치면 처음 적은 사람 · 시각 · 한 줄 그대로', () => {
  const f = F.newAdd(who, '2026-11-19');
  F.applyLine(f, '숙소 12만 반반', who);
  const d = P.toDoc(F.toForm(f), { me: 'jm', partner: 'dj' }, { now: '2026-11-19T10:00:00Z', by: 'jm' });
  assert.deepEqual(d.shares, { jm: 60000, dj: 60000 });
  assert.equal(d.raw, '숙소 12만 반반');
  const e = F.newEdit('s1', P.fromDoc(d, { me: 'dj', partner: 'jm' }), '');
  assert.equal(e.payer, 'both');
  F.setShare(e, 'me', '0'); // 단짝(dj) 화면에서 내 몫 0 → 준민이 다 냄
  const d2 = P.toDoc(F.toForm(e), { me: 'dj', partner: 'jm' }, { now: '2026-11-20T00:00:00Z', by: 'dj', prev: d });
  assert.equal(d2.paidBy, 'jm');
  assert.equal(d2.shares, undefined);
  assert.deepEqual([d2.createdBy, d2.createdAt, d2.updatedBy, d2.raw], ['jm', '2026-11-19T10:00:00Z', 'dj', '숙소 12만 반반']);
});

test('S5 시트 HTML: 입력칸 아래만 다시 그리는 칸 · 오류는 aria-describedby · 지우기 확인(L8) · 적은 한 줄 글자 그대로', () => {
  const f = F.newAdd(who, '2026-11-19');
  F.applyLine(f, '<b>저녁</b> 4만 내가', who);
  const html = V.sheet(f, sctx, false);
  assert.match(html, /id="lg-parsed"/);
  assert.match(html, /aria-describedby="lg-line-err"/);
  assert.doesNotMatch(html, /<b>저녁/);
  assert.match(html, /오늘 · 11월 19일 \(목\)/);
  const e = F.newEdit('s1', { date: '2026-11-16', amount: 13700, payer: 'partner', shares: null, what: '택시', cat: 'move', raw: '택시 13700 단짝' }, '단짝이 11월 16일에 적었어요 · 둘 다 고칠 수 있어요');
  e.confirmDelete = true;
  const h2 = V.sheet(e, sctx, false);
  assert.match(h2, /적은 한 줄: 「택시 13700 단짝」/);
  assert.match(h2, /이 기록을 지울까요\?/);
  assert.match(h2, /단짝 화면에서도 함께 사라져요/);
  assert.match(h2, /data-act="lg-del-yes"/);
});
