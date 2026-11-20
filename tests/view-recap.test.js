// node --test tests/view-recap.test.js — 결산 화면 (docs/recap/tests.md U 묶음 + E1 결산 칸)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../js/view-recap.js');
const { computeRecap } = require('../functions/recap.js');

const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/recap-' + n + '.json'), 'utf8'));
const oct = load('2026-10'), nov = load('2026-11');
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
