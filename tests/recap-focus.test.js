// node --test tests/recap-focus.test.js — 결산 「함께 집중」 카드 (docs/focus-stats/tests.md D1~D7, spec 4절)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../functions/recap.js');
const RT = require('../js/recap-text.js');
const VR = require('../js/view-recap.js');
const FX = require('../docs/focus-stats/reference/fixtures.js');

const people = [{ uid: FX.ME, name: '준민' }, { uid: FX.HER, name: '다진' }];
function data(key, focusLogs, extra) {
  return Object.assign({ period: { kind: 'month', key }, people, coupleSince: null, routines: [], checks: [], todos: [], kungs: [], events: [], places: [], qdays: [], qanswers: {}, spends: [], focusLogs }, extra || {});
}
const ids = (r) => r.cards.map((c) => c.id);
const deck = (r) => VR.deckModel(r, FX.ME, 0, (u) => (u === FX.ME ? 'me' : 'her'));

test('D1 11월 기록 → focus 카드, 함께 보낸 시간 다음 · 진행 막대 칸 수 = 그린 카드 수', () => {
  const ev = [{ start: '2026-11-07T13:00', end: '2026-11-07T15:00', shared: true }];
  const r = R.computeRecap(data('2026-11', FX.november(), { events: ev }), null);
  assert.deepEqual(ids(r), ['cover', 'time', 'focus', 'final']);
  const c = r.cards[2];
  assert.equal(c.together, 755); assert.deepEqual(c.people, { jun: 2137, dajin: 1622 }); assert.equal(c.togetherDays, 13); assert.equal(c.prevTogether, null);
  const m = deck(r);
  assert.equal(m.n, 4);
  const html = VR.deck(Object.assign(m, { idx: 2 }), false);
  assert.equal((html.match(/<span( class="is-on")?><\/span>/g) || []).length, 4, '진행 막대 칸 4개');
  assert.match(html, /함께 집중/); assert.match(html, /12<small>시간<\/small> 35<small>분<\/small>/); assert.match(html, /둘이 같은 시간에 켜 둔 시간이에요\./);
  assert.match(html, /준민 35시간 37분/); assert.match(html, /다진 27시간 2분/); assert.match(html, /함께 집중한 날 13일/); assert.match(html, /가장 길게 함께한 날 11\/25 · 1시간 40분/);
  assert.equal((html.match(/rc-d--f\d/g) || []).length - 5, 30, '날마다 30칸 (+ 범례 5)');
  assert.equal((html.match(/rc-d--pad/g) || []).length, 6, '2026-11-01 은 일요일 → 앞 빈 칸 6');
  const fin = r.cards[3].tiles.find((t) => t.id === 'focus');
  assert.deepEqual(fin, { id: 'focus', value: '12:35', unit: '', label: '함께 집중' });
});

test('D2 둘 다 기록 없는 달: 카드 없음', () => {
  const r = R.computeRecap(data('2026-11', []), null);
  assert.ok(!ids(r).includes('focus'));
  assert.ok(!r.cards.find((c) => c.id === 'final').tiles.some((t) => t.id === 'focus'));
});

test('D3 함께 0분: 「우리가 집중한 시간」 · 「이번 달은 각자 집중했어요.」, 달력 · 비교 없음, 타일 「우리가 집중」', () => {
  const solo = FX.november().filter((l) => l.by === FX.ME);
  const r = R.computeRecap(data('2026-11', solo), data('2026-10', FX.november().map((l) => Object.assign({}, l, { day: '2026-10' + l.day.slice(7) })).filter((l) => l.day <= '2026-10-31')));
  const c = r.cards.find((x) => x.id === 'focus');
  assert.equal(c.together, 0);
  const html = VR.deck(Object.assign(deck(r), { idx: r.cards.indexOf(c) }), false);
  assert.match(html, /우리가 집중한 시간/); assert.match(html, /이번 달은 각자 집중했어요\./);
  assert.doesNotMatch(html, /rc-fcal/); assert.doesNotMatch(html, /지난달보다/);
  assert.equal(r.cards.find((x) => x.id === 'final').tiles.find((t) => t.id === 'focus').label, '우리가 집중');
});

test('D4 · D4-2 비교: 지난달에 카드가 있으면 + / −, 없으면 칩 없음 — 첫 기록이 1일이 아니면 「11/25부터 모은 기록이에요」', () => {
  const oct = FX.november().filter((l) => l.day <= '2026-11-30').map((l) => Object.assign({}, l, { day: '2026-10' + l.day.slice(7), segs: l.segs.map((s) => [s[0] - 31 * 86400000, s[1] - 31 * 86400000]), start: l.start - 31 * 86400000, end: l.end - 31 * 86400000 }));
  const octRecap = R.computeRecap(data('2026-10', oct), null);
  const prevT = octRecap.cards.find((c) => c.id === 'focus').together;
  const r = R.computeRecap(data('2026-11', FX.november()), data('2026-10', oct));
  const c = r.cards.find((x) => x.id === 'focus');
  assert.equal(c.prevTogether, prevT);
  const t = RT.cardText(c, r, FX.ME);
  const S = require('../js/focus-text.js').S;
  assert.equal(t.cmp, c.together === prevT ? '지난달과 같아요' : S.rcVsPrev((c.together - prevT) * 60000));
  const first = R.computeRecap(data('2026-11', FX.november().filter((l) => l.day >= '2026-11-25')), null);
  assert.equal(RT.cardText(first.cards.find((x) => x.id === 'focus'), first, FX.ME).cmp, '11/25부터 모은 기록이에요');
  const all = R.computeRecap(data('2026-11', FX.november()), null);
  assert.equal(RT.cardText(all.cards.find((x) => x.id === 'focus'), all, FX.ME).cmp, null, '1일부터 기록이면 줄 없음');
  const fake = Object.assign({}, c, { together: 755, prevTogether: 820 });
  assert.equal(RT.cardText(fake, r, FX.ME).cmp, '지난달보다 −1시간 5분');
  assert.equal(RT.cardText(Object.assign({}, c, { together: 755, prevTogether: 640 }), r, FX.ME).cmp, '지난달보다 +1시간 55분');
});

test('D5 이미지 마무리: 숫자 타일만 (과목 · 시간대 · 달력은 카드 문서 · 타일에 없음)', () => {
  const r = R.computeRecap(data('2026-11', FX.november()), null);
  const c = r.cards.find((x) => x.id === 'focus');
  assert.deepEqual(Object.keys(c).sort(), ['best', 'days', 'id', 'people', 'prevTogether', 'since', 'together', 'togetherDays']);
  const fin = RT.cardText(r.cards.find((x) => x.id === 'final'), r, FX.ME);
  assert.ok(fin.tiles.some((t) => t.big === '12:35' && t.label === '함께 집중'));
});

test('D7 모르는 카드 id 는 건너뛰고 진행 막대 칸 수 = 그린 카드 수', () => {
  const r = R.computeRecap(data('2026-11', FX.november()), null);
  const withFake = Object.assign({}, r, { cards: r.cards.slice(0, 2).concat([{ id: 'future-card', x: 1 }]).concat(r.cards.slice(2)) });
  const m = deck(withFake);
  assert.equal(m.n, r.cards.length);
  assert.ok(!m.cards.some((x) => x.card.id === 'future-card'));
});

test('D7-2 FOCUS_CARD_ON = false 면 focus 카드 없음 (스위치 한 줄)', () => {
  assert.equal(R.FOCUS_CARD_ON, true);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../functions/recap.js'), 'utf8');
  assert.match(src, /^const FOCUS_CARD_ON = true;$/m);
  assert.match(src, /if \(!FOCUS_CARD_ON \|\| /);
});

test('연말: 큰 숫자 = 열두 달 함께 합, 「가장 많이 함께한 달」, 비교 · 달력 없음', () => {
  const y = R.computeRecap(Object.assign(data('2026-11', FX.november()), { period: { kind: 'year', key: '2026' } }), null);
  const c = y.cards.find((x) => x.id === 'focus');
  assert.equal(c.together, 755); assert.deepEqual(c.bestMonth, { month: '2026-11', together: 755 });
  const t = RT.cardText(c, y, FX.ME);
  assert.equal(t.cal, null); assert.equal(t.cmp, null);
  assert.ok(t.more.includes('가장 많이 함께한 달 11월 · 12시간 35분'));
});
