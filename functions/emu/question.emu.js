// 교환 쪽지 보안 규칙 시험 R1~R12 (docs/question/rules/rules.test.mjs 를 저장소 틀로 — 에뮬레이터 필요)
// Cloud Shell 에서: bash scripts/emu-rules.sh   (npm test 에는 안 들어감 — *.emu.js)
// 바꾼 것: 저장소 isMember() 는 이메일로 보므로 시험 사람에게 이메일 토큰을 줌 (a@test.dev · b@test.dev = 두 사람, z@test.dev = 남)
'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, collection, getDocs, deleteDoc } = require('firebase/firestore');
const EMAIL = { 'u-junmin': 'a@test.dev', 'u-danjjak': 'b@test.dev', 'u-stranger': 'z@test.dev' };
const HOST = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
const J = 'u-junmin', D = 'u-danjjak', X = 'u-stranger';
const DATE = '2026-11-20';
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
    await setDoc(doc(db, 'members', D), { name: '단짝' });
  });
});

const as = (uid) => env.authenticatedContext(uid, { email: EMAIL[uid], email_verified: true }).firestore();
const newDay = (extra = {}) => ({ q: 'us-007', text: '우리 둘만 아는 말이 있다면요?', src: 'base', by: null, skipped: [], done: {}, likes: {}, createdAt: serverTimestamp(), ...extra });
async function seedDay(extra = {}) {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'qdays', DATE), { ...newDay(), createdAt: new Date(), ...extra }));
}
async function answer(uid, text = '답') {
  const db = as(uid);
  const b = writeBatch(db);
  b.set(doc(db, 'qdays', DATE, 'a', uid), { text, at: serverTimestamp() });
  b.update(doc(db, 'qdays', DATE), { [`done.${uid}`]: serverTimestamp() });
  return b.commit();
}

test('R1 members는 그날 질문을 만들 수 있고, 남은 못 만듦', async () => {
  await assertSucceeds(setDoc(doc(as(J), 'qdays', DATE), newDay()));
  await env.clearFirestore();
  await assertFails(setDoc(doc(as(X), 'qdays', DATE), newDay()));
});

test('R2 만들 때 done/likes/skipped가 비어 있지 않으면 거부', async () => {
  await assertFails(setDoc(doc(as(J), 'qdays', DATE), newDay({ done: { [J]: 1 } })));
});

test('R3 답 + done 표시를 한 batch로 → 성공, done만 따로 → 거부', async () => {
  await seedDay();
  await assertFails(updateDoc(doc(as(J), 'qdays', DATE), { [`done.${J}`]: serverTimestamp() }));
  await assertSucceeds(answer(J));
});

test('R4 단짝 답: 내 답이 없으면 읽기 거부, 내 답이 생기면 허용', async () => {
  await seedDay();
  await answer(D, '배 채웠어?');
  await assertFails(getDoc(doc(as(J), 'qdays', DATE, 'a', D)));
  await answer(J, '꿍 하나만');
  await assertSucceeds(getDoc(doc(as(J), 'qdays', DATE, 'a', D)));
});

test('R5 답 목록 조회(list)는 거부 — 하나씩 get', async () => {
  await seedDay();
  await answer(J);
  await assertFails(getDocs(collection(as(J), 'qdays', DATE, 'a')));
});

test('R6 남의 답 칸에 쓰기 · 남의 done 표시 거부', async () => {
  await seedDay();
  await assertFails(setDoc(doc(as(J), 'qdays', DATE, 'a', D), { text: '대신', at: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(J), 'qdays', DATE), { [`done.${D}`]: serverTimestamp() }));
});

test('R7 답 고치기: editedAt 붙이면 성공, at 바꾸거나 301자면 거부, 지우기 거부', async () => {
  await seedDay();
  await answer(J);
  const ref = doc(as(J), 'qdays', DATE, 'a', J);
  await assertSucceeds(updateDoc(ref, { text: '고친 답', editedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { text: '가'.repeat(301), editedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { at: new Date(0), editedAt: serverTimestamp() }));
  await assertFails(deleteDoc(ref));
});

test('R8 다른 질문: 아무도 안 답했을 때 한 번만, skipped에 원래 질문', async () => {
  await seedDay();
  const ref = doc(as(J), 'qdays', DATE);
  const swap = { q: 'pick-001', text: '바다 vs 산, 하나만 고른다면요?', src: 'base', by: null, skipped: ['us-007'], swappedAt: serverTimestamp(), swappedBy: J };
  await assertFails(updateDoc(ref, { ...swap, skipped: [] }));
  await assertSucceeds(updateDoc(ref, swap));
  await assertFails(updateDoc(doc(as(D), 'qdays', DATE), { ...swap, q: 'pick-002', skipped: ['us-007', 'pick-001'], swappedBy: D }));
});

test('R9 다른 질문: 답이 하나라도 있으면 거부 · 우리 질문이면 거부', async () => {
  await seedDay();
  await answer(D);
  const swap = { q: 'pick-001', text: '?', src: 'base', by: null, skipped: ['us-007'], swappedAt: serverTimestamp(), swappedBy: J };
  await assertFails(updateDoc(doc(as(J), 'qdays', DATE), swap));
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'members', J), {}); });
  await seedDay({ src: 'ours', q: 'o-4', by: D });
  await assertFails(updateDoc(doc(as(J), 'qdays', DATE), { ...swap, skipped: ['o-4'] }));
});

test('R10 마음에 남아요: 둘 다 답한 뒤 내 칸만', async () => {
  await seedDay();
  await answer(J);
  await assertFails(updateDoc(doc(as(J), 'qdays', DATE), { [`likes.${J}`]: true }));
  await answer(D);
  await assertSucceeds(updateDoc(doc(as(J), 'qdays', DATE), { [`likes.${J}`]: true }));
  await assertFails(updateDoc(doc(as(J), 'qdays', DATE), { [`likes.${D}`]: true }));
});

test('R11 우리 질문: 낸 사람 = 나, 60자까지, 고치기 · 지우기는 낸 사람만', async () => {
  const ref = doc(as(J), 'ourQuestions', 'o-9');
  await assertFails(setDoc(ref, { text: '질문?', by: D, ask: true, createdAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { text: '가'.repeat(61), by: J, ask: true, createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(ref, { text: '제일 좋아하는 라면은?', by: J, ask: true, createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(D), 'ourQuestions', 'o-9'), { text: '바꿈?' }));
  await assertFails(deleteDoc(doc(as(D), 'ourQuestions', 'o-9')));
  await assertSucceeds(updateDoc(ref, { ask: false }));
  await assertSucceeds(deleteDoc(ref));
});

test('R12 그날 질문 지우기는 아무도 못 함', async () => {
  await seedDay();
  await assertFails(deleteDoc(doc(as(J), 'qdays', DATE)));
});
