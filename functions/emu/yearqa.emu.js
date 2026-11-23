// 짝꿍과의 연말 문답 보안 규칙 시험 Y1~Y9 (docs/yearqa/spec.md 4절 — 에뮬레이터 필요)
// Cloud Shell 에서: bash scripts/emu-rules.sh   (npm test 에는 안 들어감 — *.emu.js)
// 시각은 진짜 시계: '2025' = 이미 펼쳐진 해(2026-01-01 지남), '2098' = 아직 안 펼쳐진 해
'use strict';
const { test, before, after, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, writeBatch, serverTimestamp, collection, getDocs, deleteDoc } = require('firebase/firestore');
const EMAIL = { 'u-junmin': 'a@test.dev', 'u-dajin': 'b@test.dev', 'u-stranger': 'z@test.dev' };
const HOST = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
const J = 'u-junmin', D = 'u-dajin', X = 'u-stranger';
const OPEN = '2025', LATER = '2098';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-danjjakkung',
    firestore: { rules: readFileSync(process.env.RULES_FILE, 'utf8'), host: HOST[0], port: Number(HOST[1]) },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'members', J), { name: '준민' });
    await setDoc(doc(db, 'members', D), { name: '다진' });
  });
});

const as = (uid) => env.authenticatedContext(uid, { email: EMAIL[uid], email_verified: true }).firestore();
const draft = (uid, year, answers = { t1: '답' }) => setDoc(doc(as(uid), 'yearqa', year, 'a', uid), { answers, sealed: false, updatedAt: serverTimestamp() });
function seal(uid, year, answers = { t1: '답' }) {
  const db = as(uid), b = writeBatch(db);
  b.set(doc(db, 'yearqa', year, 'a', uid), { answers, sealed: true, updatedAt: serverTimestamp(), sealedAt: serverTimestamp() });
  b.set(doc(db, 'yearqa', year), { sealed: { [uid]: serverTimestamp() } }, { merge: true });
  return b.commit();
}

test('Y1 임시 저장: 내 칸만 · 남은 못 씀', async () => {
  await assertSucceeds(draft(J, LATER));
  await assertFails(setDoc(doc(as(J), 'yearqa', LATER, 'a', D), { answers: {}, sealed: false, updatedAt: serverTimestamp() }));
  await assertFails(draft(X, LATER));
  await assertFails(setDoc(doc(as(J), 'yearqa', 'abcd', 'a', J), { answers: {}, sealed: false, updatedAt: serverTimestamp() }));
});

test('Y2 모르는 칸 · 41개 넘는 답 · 클라이언트 시각 → 거부', async () => {
  await assertFails(setDoc(doc(as(J), 'yearqa', LATER, 'a', J), { answers: {}, sealed: false, updatedAt: serverTimestamp(), extra: 1 }));
  const many = {}; for (let i = 0; i < 41; i++) many['q' + i] = 'x';
  await assertFails(setDoc(doc(as(J), 'yearqa', LATER, 'a', J), { answers: many, sealed: false, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as(J), 'yearqa', LATER, 'a', J), { answers: {}, sealed: false, updatedAt: new Date() }));
});

test('Y3 봉투 붙이기: 답(sealed) + 표시를 한 묶음으로 → 성공, 표시만 따로 → 거부', async () => {
  await assertFails(setDoc(doc(as(J), 'yearqa', LATER), { sealed: { [J]: serverTimestamp() } }));
  await assertSucceeds(seal(J, LATER));
  await assertSucceeds(seal(D, LATER)); // 두 번째 사람은 update
});

test('Y4 남의 표시는 못 붙임 · 내 표시를 두 번 못 붙임', async () => {
  await draft(J, LATER, { t1: 'a' });
  const db = as(J), b = writeBatch(db);
  b.set(doc(db, 'yearqa', LATER, 'a', J), { answers: { t1: 'a' }, sealed: true, updatedAt: serverTimestamp() });
  b.set(doc(db, 'yearqa', LATER), { sealed: { [D]: serverTimestamp() } }, { merge: true });
  await assertFails(b.commit());
  await assertSucceeds(seal(J, LATER));
  await assertFails(seal(J, LATER));
});

test('Y5 붙인 봉투는 못 뗌 (sealed true → false 거부), 고치기는 됨', async () => {
  await seal(J, LATER);
  await assertFails(draft(J, LATER, { t1: '고침' }));
  await assertSucceeds(setDoc(doc(as(J), 'yearqa', LATER, 'a', J), { answers: { t1: '고침' }, sealed: true, updatedAt: serverTimestamp() }));
});

test('Y6 펼쳐지기 전(1월 1일 전)엔 둘 다 붙였어도 짝꿍 답 못 읽음 · 내 답은 읽음', async () => {
  await seal(J, LATER); await seal(D, LATER);
  await assertSucceeds(getDoc(doc(as(J), 'yearqa', LATER, 'a', J)));
  await assertFails(getDoc(doc(as(J), 'yearqa', LATER, 'a', D)));
  await assertSucceeds(getDoc(doc(as(J), 'yearqa', LATER))); // 표시 문서는 읽음
});

test('Y7 펼쳐진 해: 둘 다 붙였으면 짝꿍 답 읽음 · 한쪽만이면 못 읽음', async () => {
  await seal(D, OPEN);
  await assertFails(getDoc(doc(as(J), 'yearqa', OPEN, 'a', D)), '나는 안 붙임');
  await draft(J, OPEN);
  await assertFails(getDoc(doc(as(J), 'yearqa', OPEN, 'a', D)), '내 것은 임시 저장뿐');
  await seal(J, OPEN);
  await assertSucceeds(getDoc(doc(as(J), 'yearqa', OPEN, 'a', D)));
  await assertFails(getDoc(doc(as(X), 'yearqa', OPEN, 'a', D)));
});

test('Y8 짝꿍이 임시 저장만 했으면 (내가 붙였어도) 못 읽음', async () => {
  await seal(J, OPEN); await draft(D, OPEN);
  await assertFails(getDoc(doc(as(J), 'yearqa', OPEN, 'a', D)));
});

test('Y9 목록 조회 · 지우기 거부', async () => {
  await seal(J, OPEN); await seal(D, OPEN);
  await assertFails(getDocs(collection(as(J), 'yearqa', OPEN, 'a')));
  await assertFails(deleteDoc(doc(as(J), 'yearqa', OPEN, 'a', J)));
  await assertFails(deleteDoc(doc(as(J), 'yearqa', OPEN)));
});
