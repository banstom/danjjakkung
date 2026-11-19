// 결산 에뮬레이터 시험 (docs/recap/tests.md B 묶음 F1~F7) — Cloud Shell 에서: bash scripts/emu-recap.sh
// F1~F6 은 tests/recap-server.test.js 와 같은 장면을 진짜 Firestore(에뮬레이터)로, F7 은 저장 규칙.
// 파일 이름이 *.test.js 가 아니라서 npm test 에는 들어가지 않는다 (에뮬레이터가 있어야 돌아감).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-danjjakkung';
const HOST = process.env.FIRESTORE_EMULATOR_HOST; // emulators:exec 가 넣어 줌
if (!HOST) throw new Error('FIRESTORE_EMULATOR_HOST 가 없어요 — bash scripts/emu-recap.sh 로 돌려 주세요');

const admin = require('firebase-admin');
admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const RJ = require('../recap-job');
const ROOT = path.join(__dirname, '../..');
const { seedFromFixture } = require(path.join(ROOT, 'tests/fake-db.js'));
const { cardText } = require(path.join(ROOT, 'js/recap-text.js'));

const load = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/recap-' + n + '.json'), 'utf8'));
const kst = (s) => new Date(s + '+09:00');
const card = (r, id) => r.cards.find((c) => c.id === id);

async function clear() {
  const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  if (!res.ok) throw new Error('에뮬레이터 비우기 실패 ' + res.status);
}
/** seedFromFixture 의 put 을 모았다가 한꺼번에 쓴다 */
async function seed(fn) {
  const writes = [];
  fn({ put: (p, d) => writes.push([p, d]) });
  for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    writes.slice(i, i + 400).forEach(([p, d]) => b.set(db.doc(p), d));
    await b.commit();
  }
}
const put = (p, d) => db.doc(p).set(d);
const countRecaps = async () => (await db.collection('recaps').get()).size;

test('읽기 → 계산 (진짜 쿼리): 목업 숫자 그대로', async () => {
  await clear();
  await seed((w) => { seedFromFixture(w, load('2026-10')); seedFromFixture(w, load('2026-11')); });
  const r = (await RJ.runMonthly(db, kst('2026-12-01T03:00:00')))['2026-11'];
  assert.deepEqual([card(r, 'together').fullDays, card(r, 'together').longestStreak, card(r, 'together').diffPrev], [15, 4, 2]);
  assert.deepEqual([card(r, 'todos').total, card(r, 'kungs').total, card(r, 'meals').sharedMeals], [23, 153, 18]);
  assert.equal(cardText(card(r, 'spends'), r, 'jm').bigText, '446,200원');
  const saved = (await db.doc('recaps/2026-11').get()).data();
  assert.deepEqual(saved.cards, r.cards);
});

test('F1 서울 시각 경계', async () => {
  await clear();
  await put('members/a', { name: '준민' }); await put('members/b', { name: '단짝' });
  await put('couple/main', { start: '2026-01-01' });
  await put('kungs/2026-11-30_a', { from: 'a', to: 'b', date: '2026-11-30' });
  await put('kungs/2026-12-01_a', { from: 'a', to: 'b', date: '2026-12-01' });
  await put('todos/t1', { scope: 'together', done: true, doneBy: 'a', doneAt: kst('2026-11-30T23:59:00').toISOString() });
  await put('todos/t2', { scope: 'together', done: true, doneBy: 'a', doneAt: kst('2026-12-01T00:00:00').toISOString() });
  const r = await RJ.buildOne(db, { kind: 'month', key: '2026-11' }, new Date());
  assert.equal(card(r, 'kungs').total, 1);
  assert.equal(card(r, 'todos').total, 1);
});

test('F2 두 번 돌려도 문서 하나 · 숫자 같음', async () => {
  await clear();
  await seed((w) => seedFromFixture(w, load('2026-11')));
  const a = (await RJ.runMonthly(db, kst('2026-12-01T03:00:00')))['2026-11'];
  const b = (await RJ.runMonthly(db, kst('2026-12-01T03:05:00')))['2026-11'];
  assert.equal(await countRecaps(), 1);
  assert.deepEqual(a.cards, b.cards);
});

test('F3 결산 뒤 기록을 고쳐도 문서 그대로', async () => {
  await clear();
  await seed((w) => seedFromFixture(w, load('2026-11')));
  await RJ.runMonthly(db, kst('2026-12-01T03:00:00'));
  const before = JSON.stringify((await db.doc('recaps/2026-11').get()).data());
  await put('kungs/2026-11-29_dj_x', { from: 'dj', to: 'jm', date: '2026-11-29' });
  assert.equal(JSON.stringify((await db.doc('recaps/2026-11').get()).data()), before);
});

test('F4 단짝이 된 달 이전은 없음 · 그 달은 비교 없음', async () => {
  await clear();
  await seed((w) => seedFromFixture(w, load('2026-11')));
  await put('couple/main', { start: '2026-11-10' });
  assert.equal((await RJ.runMonthly(db, kst('2026-11-01T03:00:00')))['2026-10'], null);
  assert.equal((await db.doc('recaps/2026-10').get()).exists, false);
  const r = (await RJ.runMonthly(db, kst('2026-12-01T03:00:00')))['2026-11'];
  assert.equal(card(r, 'together').diffPrev, null);
});

test('F5 1월 1일: 연말 + 12월 둘 다, 알림은 연말 하나', async () => {
  await clear();
  await seed((w) => seedFromFixture(w, load('2026-11')));
  await RJ.runMonthly(db, kst('2027-01-01T03:00:00'));
  assert.equal((await db.doc('recaps/2026').get()).exists, true);
  assert.equal((await db.doc('recaps/2026-12').get()).exists, true);
  const sent = [];
  await RJ.runNotify(db, kst('2027-01-01T09:00:00'), { send: async (u, m, k, tag) => sent.push(tag), once: async () => true, appUrl: 'x/' });
  assert.deepEqual(sent, ['recap-2026', 'recap-2026']);
});

test('F6 users.recap=false 면 안 보냄', async () => {
  await clear();
  await seed((w) => seedFromFixture(w, load('2026-11')));
  await RJ.runMonthly(db, kst('2026-12-01T03:00:00'));
  await put('users/dj', { recap: false });
  const sent = [];
  await RJ.runNotify(db, kst('2026-12-01T09:00:00'), { send: async (u) => sent.push(u), once: async () => true, appUrl: 'x/' });
  assert.deepEqual(sent, ['jm']);
});

test('F7 규칙: recaps 는 둘 다 읽기만 · 커플 아닌 사람은 못 읽음 · users.recap 은 참/거짓만', async () => {
  const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
  const [h, p] = HOST.split(':');
  const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: fs.readFileSync(process.env.RECAP_RULES, 'utf8'), host: h, port: Number(p) } });
  try {
    await clear();
    await put('recaps/2026-11', { v: 1 });
    const me = env.authenticatedContext('a', { email: 'a@test.dev', email_verified: true }).firestore();
    const stranger = env.authenticatedContext('z', { email: 'z@test.dev', email_verified: true }).firestore();
    await assertSucceeds(me.doc('recaps/2026-11').get());
    await assertFails(me.doc('recaps/2026-11').set({ v: 2 }));
    await assertFails(me.doc('recaps/2026-12').set({ v: 1 }));
    await assertFails(me.doc('recaps/2026-11').delete());
    await assertFails(stranger.doc('recaps/2026-11').get());
    await assertSucceeds(me.doc('users/a').set({ recap: false }));
    await assertFails(me.doc('users/a').set({ recap: 'no' }));
  } finally {
    await env.cleanup();
  }
});
