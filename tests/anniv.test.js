// node --test tests/  — v46 우리 기념일
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const A = require('../js/anniv.js');

const d = (y, m, dd) => D.fromYMD(y, m, dd);

test('며칠째: 시작한 날 = 1일, 100일 = 시작일 + 99일', () => {
  const s = d(2025, 1, 1);
  assert.equal(A.dayCount(s, s), 1);
  assert.equal(A.dayCount(s, s + 99), 100);
  const m = A.build(A.fromDoc({ start: '2025-01-01', label: '단짝이 된 지' }), s + 99);
  assert.equal(m.count, 100);
  assert.equal(m.today, '100일');
  assert.equal(m.line, '단짝이 된 지 100일');
});

test('기념일 목록: 100일 단위 + 주년, 날짜 순, 콤마', () => {
  const s = d(2025, 1, 1);
  const list = A.between(s, s, d(2027, 12, 31)).map((x) => x.name);
  assert.deepEqual(list.slice(0, 5), ['100일', '200일', '300일', '1주년', '400일']);
  assert.ok(list.includes('1,000일'));
  assert.ok(list.includes('2주년'));
  // 1주년 = 2026-01-01
  assert.equal(A.between(s, s, d(2026, 1, 1)).filter((x) => x.kind === 'year')[0].day, d(2026, 1, 1));
});

test('2월 29일 시작 → 평년 주년은 2월 28일', () => {
  const s = d(2024, 2, 29);
  assert.equal(A.yearsAfter(s, 1), d(2025, 2, 28));
  assert.equal(A.yearsAfter(s, 4), d(2028, 2, 29));
});

test('다가오는 · 지난 기념일 · D-day 글자', () => {
  const s = d(2025, 1, 1), today = d(2025, 5, 1); // 121일째
  const m = A.build(A.fromDoc({ start: '2025-01-01', label: '만난 지' }), today);
  assert.equal(m.count, 121);
  assert.equal(m.today, null);
  assert.equal(m.next[0].name, '200일');
  assert.equal(m.next[0].d, 'D-' + (s + 199 - today));
  assert.equal(m.next.length, 3);
  assert.deepEqual(m.past.map((x) => x.name), ['100일']);
  assert.equal(A.dLabel(today, today), '오늘');
});

test('오래된 관계도 다가오는 기념일을 찾는다 · 같은 날이면 주년이 먼저', () => {
  const s = d(2000, 3, 1);
  const up = A.upcoming(s, d(2026, 11, 16), 4);
  assert.equal(up.length, 4);
  assert.ok(up[0].day >= d(2026, 11, 16));
  for (let i = 1; i < up.length; i++) assert.ok(up[i].day >= up[i - 1].day);
  assert.equal(A.past(s, d(2026, 11, 16), 3).length, 3);
});

test('저장 값 읽기 · 폼 검사', () => {
  assert.equal(A.fromDoc(null), null);
  assert.equal(A.fromDoc({ start: '2025-02-30' }), null);
  assert.equal(A.fromDoc({ start: '2025-01-01' }).label, '단짝이 된 지');
  assert.equal(A.fromDoc({ start: '2025-01-01', label: '  함께한   지 ' }).label, '함께한 지');
  const today = d(2026, 11, 16);
  assert.equal(A.validate({ label: '단짝이 된 지', start: '2026-11-16' }, today), '');
  assert.match(A.validate({ label: '', start: '2026-11-16' }, today), /관계 이름/);
  assert.match(A.validate({ label: '아주아주아주긴이름', start: '2026-11-16' }, today), /8자/);
  assert.match(A.validate({ label: '단짝이 된 지', start: '2026-11-17' }, today), /지난 날/);
  assert.match(A.validate({ label: '단짝이 된 지', start: '' }, today), /골라/);
});

test('시작일이 미래면 future 표시', () => {
  const m = A.build(A.fromDoc({ start: '2026-12-01' }), d(2026, 11, 16));
  assert.equal(m.future, true);
});

test('규칙: couple/main — 관계 이름 글자 수가 앱과 같음', () => {
  const fs = require('fs'), path = require('path');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.ok(rules.includes('match /couple/{id}'));
  assert.ok(rules.includes("request.resource.data.label.size() <= " + A.LABEL_MAX));
  assert.ok(rules.includes("hasOnly(['start', 'label', 'box', 'updatedBy', 'updatedAt'])"));
  assert.ok(rules.includes("request.resource.data.box in [" + A.BOXES.map((b) => "'" + b.id + "'").join(', ') + "]"), 'v52 박스 모양 목록 = 앱 목록');
});

test('v52 박스 모양: 저장값이 이상하면 하트 잇기 · 막대는 지난 기념일 → 다음 기념일', () => {
  assert.equal(A.fromDoc({ start: '2025-01-01', label: '만난 지' }).box, 'heart');
  assert.equal(A.fromDoc({ start: '2025-01-01', label: '만난 지', box: 'ticket' }).box, 'ticket');
  assert.equal(A.fromDoc({ start: '2025-01-01', label: '만난 지', box: '<x>' }).box, 'heart');
  const s = d(2025, 1, 1);
  assert.deepEqual(A.build(A.fromDoc({ start: '2025-01-01', label: '만난 지' }), s + 49).prog, { from: '시작', to: '100일', pct: 49 }, '첫 기념일 전엔 시작한 날부터');
  assert.deepEqual(A.build(A.fromDoc({ start: '2025-01-01', label: '만난 지' }), s + 99).prog, { from: '100일', to: '200일', pct: 0 }, '기념일 당일은 다음 기념일까지 0%');
  assert.equal(A.build(A.fromDoc({ start: '2025-01-01', label: '만난 지' }), s + 149).prog.pct, 50);
  assert.equal(A.build(A.fromDoc({ start: '2025-01-01', label: '만난 지' }), s + 98).prog.pct, 98, '회귀(점검 AI): 전날이 100% 로 반올림되지 않음');
  const rules = require('fs').readFileSync(require('path').join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['box'\]\)/, '모양만 바꿀 땐 「누가 정했는지」 그대로 둘 수 있게');
});

test('v47 용어: 예전에 저장된 「사귄 지」는 「단짝이 된 지」로 보이고, 고를 거리에도 「사귄」이 없다', () => {
  assert.equal(A.fromDoc({ start: '2025-01-01', label: '사귄 지' }).label, '단짝이 된 지');
  assert.equal(A.build(A.fromDoc({ start: '2025-01-01', label: '사귄 지' }), d(2025, 1, 1) + 99).line, '단짝이 된 지 100일');
  assert.equal(A.DEFAULT_LABEL, '단짝이 된 지');
  assert.ok(A.PRESETS.every((p) => !/사귄/.test(p)));
  assert.ok(A.PRESETS.every((p) => p.length <= A.LABEL_MAX), '규칙 8자 안');
  assert.equal(A.fromDoc({ start: '2025-01-01', label: '만난 지' }).label, '만난 지', '직접 고른 다른 이름은 그대로');
});
