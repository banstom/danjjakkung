// node --test tests/view-recap.test.js — 결산 화면 (docs/recap/tests.md U 묶음 + E1 결산 칸)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../js/view-recap.js');
const { computeRecap } = require('../functions/recap.js');

const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/recap-' + n + '.json'), 'utf8'));
const { noteFixture } = require('./note-fixture.js');
const NF = noteFixture();
const oct = load('2026-10'), nov = Object.assign(load('2026-11'), { qdays: NF.qdays, qanswers: NF.qanswers }); // 카드 8 = 교환 쪽지
const doc = JSON.parse(JSON.stringify(computeRecap(nov, oct)));
const slot = (uid) => (uid === 'jm' ? 'me' : 'her');
const deckAt = (i, viewer) => V.deck(V.deckModel(doc, viewer || 'jm', i, slot));

test('U1 진행 막대 칸 수 = 실제 카드 수 (빠진 카드는 칸도 없음) · 지금 장까지 켜짐', () => {
  const html = deckAt(3);
  assert.equal((html.match(/<div class="rc-prog"[^]*?<\/div>/)[0].match(/<span/g) || []).length, 10);
  assert.equal((html.match(/class="is-on"/g) || []).length, 4);
  const noSpend = JSON.parse(JSON.stringify(computeRecap({ ...nov, spends: [] }, oct)));
  const h2 = V.deck(V.deckModel(noSpend, 'jm', 0, slot));
  assert.equal((h2.match(/<div class="rc-prog"[^]*?<\/div>/)[0].match(/<span/g) || []).length, 9);
});

test('U2 넘기기: 왼쪽 1/3 = 앞, 나머지 = 다음 · 처음 · 마지막에서 멈춤', () => {
  assert.equal(V.tapDir(100, 390), -1);
  assert.equal(V.tapDir(200, 390), 1);
  assert.equal(V.step(0, 10, -1), 0);
  assert.equal(V.step(9, 10, 1), 9);
  assert.equal(V.step(4, 10, 1), 5);
});

test('U3 보는 사람이 먼저 (준민 화면 · 다진 화면)', () => {
  const kj = deckAt(4, 'jm'), kd = deckAt(4, 'dj');
  const nm = (h, n) => h.indexOf('rc-prow__nm">' + n + '<');
  assert.ok(nm(kj, '준민') >= 0 && nm(kj, '준민') < nm(kj, '단짝'));
  assert.ok(nm(kd, '단짝') >= 0 && nm(kd, '단짝') < nm(kd, '준민'));
});

test('U4 카드마다 목업 문구 (R2 달력 · R3 새 루틴 · R7 별점 · R9 영수증 · R10 버튼)', () => {
  const r2 = deckAt(1);
  assert.match(r2, /15<small>일<\/small>/);
  assert.match(r2, /지난달보다 \+2일/);
  assert.equal((r2.match(/rc-d rc-d--(full|half|none|blank)/g) || []).length, 30);
  assert.match(deckAt(2), /이번 달에 새로 만든 루틴/);
  assert.match(deckAt(6), /★5\.0/);
  const r9 = deckAt(8);
  assert.match(r9, /11월의 단짝 영수증/);
  assert.match(r9, /446,200원/);
  const r10 = deckAt(9);
  assert.match(r10, /data-act="rc-save"/);
  assert.match(r10, /data-act="rc-restart"/);
  assert.doesNotMatch(r10, /class="rc-tap"/); // 마지막 장엔 넘기기 안내 없음
});

test('U8 카드 8 교환 쪽지: 목업 08 문구 · 접힌 모서리 카드 · 쪽지 글 · 사람 색 점 / 쪽지가 없는 달은 카드 · 칸 없음', () => {
  const h = deckAt(7);
  assert.match(h, /rc-kick">교환 쪽지</); assert.match(h, /15<small>일<\/small>/);
  assert.match(h, /둘 다 쪽지를 남긴 날이에요\.<br>가장 길게는 5일 연속/);
  assert.doesNotMatch(h, /rc-cmp/, '지난달 쪽지가 없으면 비교 칩 없음');
  assert.match(h, /마음에 남은 쪽지 3장/);
  assert.match(h, /준민의 마음에 남은 쪽지 · 11월 15일 \(일\)[^]*단짝에게 배운 것 하나는요\?[^]*천천히 먹어도 된다는 거[^]*dot--her[^]*단짝의 쪽지/);
  assert.equal((h.match(/class="rc-notecard"/g) || []).length, 2);
  const none = JSON.parse(JSON.stringify(computeRecap(load('2026-11'), oct)));
  assert.ok(!none.cards.some((c) => c.id === 'note'));
});

test('U5 메모 · 이름은 글자 그대로 (태그로 안 읽힘)', () => {
  const d = JSON.parse(JSON.stringify(doc));
  d.cards.find((c) => c.id === 'places').best.per[0].note = '<img src=x onerror=alert(1)>';
  const html = V.deck(V.deckModel(d, 'jm', 6, slot));
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test('E1 결산 칸: 1~7일에 새 결산이 있으면 「새로 나왔어요」, 아니면 다음 달 1일 안내 · 목록은 최근부터, 연말은 그 해 12월 위', () => {
  const list = [{ key: '2026-10', doc }, { key: '2026-11', doc }, { key: '2026', doc: { cards: [] } }, { key: '2026-12', doc }];
  const a = V.entryModel(list.slice(0, 2), { y: 2026, m: 11, d: 19 });
  assert.equal(a.banner.fresh, false);
  assert.equal(a.banner.kick, '12월 1일 아침에 나와요');
  assert.equal(a.banner.title, '11월의 단짝꿍');
  const b = V.entryModel(list.slice(0, 2), { y: 2026, m: 12, d: 1 });
  assert.equal(b.banner.fresh, true);
  assert.equal(b.banner.key, '2026-11');
  const c = V.entryModel(list, { y: 2027, m: 1, d: 3 });
  assert.equal(c.banner.key, '2026'); // 1월 첫 주엔 연말결산
  assert.deepEqual(c.rows.map((r) => r.name), ['2026년의 단짝꿍', '2026년 12월의 단짝꿍', '2026년 11월의 단짝꿍', '2026년 10월의 단짝꿍']);
  assert.equal(c.rows[2].value, '함께 해낸 날 15일');
  assert.equal(c.rows[0].value, '함께 해낸 날 —');
  assert.match(V.tab(a), /aria-pressed="true">결산/);
  assert.match(V.tab(V.entryModel([], { y: 2026, m: 11, d: 19 })), /아직 지난 결산이 없어요/);
});

test('카드 넘기기는 전체 화면 대화상자 · 닫기 버튼 · 키보드용 앞 · 다음 버튼', () => {
  const html = deckAt(0);
  assert.match(html, /role="dialog" aria-modal="true" aria-label="11월의 단짝꿍"/);
  assert.match(html, /data-act="rc-close" aria-label="닫기"/);
  assert.match(html, /data-act="rc-prev" disabled/);
  assert.match(html, /data-act="rc-next">/);
});

test('U8-1 카드 8 쪽지가 길면 「전체 보기」 → 쪽지 전체가 겹쳐 뜸 (11-23 사용자 결정: 3줄 + 전체 보기)', () => {
  assert.equal(V.longNote('짧은 쪽지'), false);
  assert.equal(V.longNote('가'.repeat(49)), true);
  assert.equal(V.longNote('한 줄\n두 줄\n세 줄'), true);
  const d = JSON.parse(JSON.stringify(doc));
  const nc = d.cards.find((c) => c.id === 'note');
  const long = '오늘은 같이 걸으면서 이야기한 게 제일 좋았어. '.repeat(6).trim();
  const key = Object.keys(nc.liked || {})[0];
  if (Array.isArray(nc.liked)) nc.liked[0].text = long; else nc.liked[key].text = long;
  const idx = d.cards.findIndex((c) => c.id === 'note');
  const closed = V.deck(V.deckModel(d, 'jm', idx, slot));
  assert.match(closed, /data-act="rc-note" data-v="0">전체 보기</);
  assert.doesNotMatch(closed, /rc-notesheet/);
  const open = V.deck(V.deckModel(d, 'jm', idx, slot, { noteOpen: 0 }));
  assert.match(open, /class="rc-notesheet" data-act="rc-note-close"/);
  assert.ok(open.includes('rc-notesheet__tx">' + long + '<'), '쪽지 글 전체 (자르지 않음)');
  // 다른 카드에서는 noteOpen 이 있어도 안 뜸
  assert.doesNotMatch(V.deck(V.deckModel(d, 'jm', 0, slot, { noteOpen: 0 })), /rc-notesheet/);
});

test('Y3 연말 미니 지도: 올해 다녀온 지역만 칠함 · 지도 데이터가 없으면 같은 높이 빈 칸 (11-23)', () => {
  const map = { regions: [{ c: '11010', d: 'M0 0L1 1' }, { c: '42150', d: 'M2 2L3 3' }], context: [], groupBorder: 'M0 0' };
  const h = V.miniMap(map, ['42150']);
  assert.match(h, /<svg class="rc-mini"[^>]*aria-label="올해 다녀온 곳 1곳을 칠한 지도"/);
  assert.equal((h.match(/class="rg on"/g) || []).length, 1);
  assert.match(h, /class="rg on" d="M2 2L3 3"/);
  assert.match(V.miniMap(null, ['42150']), /rc-mini--wait/);
});
