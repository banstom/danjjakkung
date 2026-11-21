// 출출 쿠키 보안 규칙 시험 R1~R16 (docs/eat/rules/emulator-tests.md) + 꿍으로 알려 주기(eatPings) — 에뮬레이터 필요
// Cloud Shell 에서: bash scripts/emu-rules.sh   (npm test 에는 안 들어감 — *.emu.js)
// 사람: me(a@test.dev) · her(b@test.dev) = 두 사람, stranger(z@test.dev). 쓰기 묶음은 앱(js/store.js)과 같은 모양
'use strict';
const { test, before, after, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction, serverTimestamp, deleteField, collection, getDocs } = require('firebase/firestore');

const ME = 'u-me', HER = 'u-her', X = 'u-stranger';
const EMAIL = { [ME]: 'a@test.dev', [HER]: 'b@test.dev', [X]: 'z@test.dev' };
const HOST = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.GCLOUD_PROJECT || 'demo-danjjakkung', firestore: { rules: readFileSync(process.env.RULES_FILE, 'utf8'), host: HOST[0], port: Number(HOST[1]) } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'members', ME), { name: '준민' });
    await setDoc(doc(db, 'members', HER), { name: '단짝' });
  });
});
const as = (uid) => env.authenticatedContext(uid, { email: EMAIL[uid], email_verified: true }).firestore();
const kakao = { name: '솔뫼 마을', kakaoId: '12345', url: 'https://place.map.kakao.com/12345', sigungu: '11290' };
const cookie = (by, extra = {}) => ({ food: '칼국수', place: kakao, memo: '뭔가 오늘따라 시원한 칼국수가 먹고싶네', by, at: serverTimestamp(), state: 'jar', ...extra });
async function seed(id, data) { await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'eats', id), { at: new Date('2026-11-20T00:00:00Z'), ...data })); }
async function seedToday(id, by = ME) {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'eats', id), { food: '김치찌개', by: HER, at: new Date('2026-11-15T10:30:00Z'), state: 'today', pick: { by, at: new Date(), drawId: null } });
    await setDoc(doc(db, 'eatState', 'today'), { eatId: id, by, at: new Date() });
  });
}
async function pick(uid, id) {
  const db = as(uid);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(doc(db, 'eatState', 'today'));
    if (s.exists()) throw new Error('taken');
    tx.update(doc(db, 'eats', id), { state: 'today', pick: { by: uid, at: serverTimestamp(), drawId: null } });
    tx.set(doc(db, 'eatState', 'today'), { eatId: id, by: uid, at: serverTimestamp() });
  });
}

test('R1 남은 eats 읽기 · 넣기 막힘', async () => {
  await assertFails(getDocs(collection(as(X), 'eats')));
  await assertFails(setDoc(doc(as(X), 'eats', 'k1'), cookie(X)));
});

test('R2 넣기: by=나 · jar · 서버 시각 · 카카오 장소 (+ 20자 음식 · 100자 메모도 통과)', async () => {
  await assertSucceeds(setDoc(doc(as(ME), 'eats', 'k1'), cookie(ME)));
  await assertSucceeds(setDoc(doc(as(ME), 'eats', 'k2'), cookie(ME, { food: '가'.repeat(20), memo: '나'.repeat(100), place: { name: '이름만' } })));
  await assertSucceeds(setDoc(doc(as(ME), 'eats', 'k3'), { food: '비빔밥', by: ME, at: serverTimestamp(), state: 'jar' }));
});

test('R3 by=단짝 · state=today · 앱 시각으로 넣기 모두 막힘', async () => {
  await assertFails(setDoc(doc(as(ME), 'eats', 'k1'), cookie(HER)));
  await assertFails(setDoc(doc(as(ME), 'eats', 'k2'), cookie(ME, { state: 'today' })));
  await assertFails(setDoc(doc(as(ME), 'eats', 'k3'), cookie(ME, { at: new Date() })));
});

test('R4 카카오 주소 · id · 시군구 모양이 틀리면 막힘', async () => {
  await assertFails(setDoc(doc(as(ME), 'eats', 'k1'), cookie(ME, { place: { ...kakao, url: 'http://place.map.kakao.com/12345' } })));
  await assertFails(setDoc(doc(as(ME), 'eats', 'k2'), cookie(ME, { place: { ...kakao, url: 'https://evil.example/12345' } })));
  await assertFails(setDoc(doc(as(ME), 'eats', 'k3'), cookie(ME, { place: { ...kakao, kakaoId: '12a' } })));
  await assertFails(setDoc(doc(as(ME), 'eats', 'k4'), cookie(ME, { place: { ...kakao, sigungu: '1129' } })));
});

test('R5 단짝이 내 쿠키 고치기 · 빼기 막힘', async () => {
  await seed('k1', { food: '칼국수', by: ME, state: 'jar' });
  await assertFails(updateDoc(doc(as(HER), 'eats', 'k1'), { food: '짬뽕', editedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(HER), 'eats', 'k1'), { state: 'out' }));
});

test('R6 고치기: 통 안 내 쿠키는 됨 / 고른 뒤 막힘 / 작성 시각 바꾸면 막힘', async () => {
  await seed('k1', { food: '칼국수', by: ME, state: 'jar' });
  await assertSucceeds(updateDoc(doc(as(ME), 'eats', 'k1'), { food: '수제비', place: null, memo: null, editedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(ME), 'eats', 'k1'), { food: '수제비', at: new Date(), editedAt: serverTimestamp() }));
  await seed('k2', { food: '칼국수', by: ME, state: 'today', pick: { by: ME, at: new Date(), drawId: null } });
  await assertFails(updateDoc(doc(as(ME), 'eats', 'k2'), { food: '수제비', editedAt: serverTimestamp() }));
});

test('R7 빼기(state out)는 됨 · 지우기는 막힘', async () => {
  await seed('k1', { food: '칼국수', by: ME, state: 'jar' });
  await assertFails(deleteDoc(doc(as(ME), 'eats', 'k1')));
  await assertSucceeds(updateDoc(doc(as(ME), 'eats', 'k1'), { state: 'out' }));
});

test('R8 고르기: 쿠키 jar→today + eatState/today 만들기를 한 묶음으로', async () => {
  await seed('k1', { food: '김치찌개', by: HER, state: 'jar' });
  await assertSucceeds(pick(ME, 'k1'));
});

test('R9 고르기를 쿠키만 · eatState 만 따로 하면 막힘', async () => {
  await seed('k1', { food: '김치찌개', by: HER, state: 'jar' });
  await assertFails(updateDoc(doc(as(ME), 'eats', 'k1'), { state: 'today', pick: { by: ME, at: serverTimestamp(), drawId: null } }));
  await assertFails(setDoc(doc(as(ME), 'eatState', 'today'), { eatId: 'k1', by: ME, at: serverTimestamp() }));
});

test('R10 이미 오늘 먹을 것이 있는데 단짝이 다른 쿠키로 고르기 막힘', async () => {
  await seedToday('k1');
  await seed('k2', { food: '마라탕', by: HER, state: 'jar' });
  const db = as(HER);
  const b = writeBatch(db);
  b.update(doc(db, 'eats', 'k2'), { state: 'today', pick: { by: HER, at: serverTimestamp(), drawId: null } });
  b.set(doc(db, 'eatState', 'today'), { eatId: 'k2', by: HER, at: serverTimestamp() });
  await assertFails(b.commit());
});

test('R11 돌려놓기: today→jar + eatState 지우기 한 묶음은 됨 / eatState 를 남기면 막힘', async () => {
  await seedToday('k1');
  await assertFails(updateDoc(doc(as(HER), 'eats', 'k1'), { state: 'jar', pick: null }));
  const db = as(HER);
  const b = writeBatch(db);
  b.update(doc(db, 'eats', 'k1'), { state: 'jar', pick: null });
  b.delete(doc(db, 'eatState', 'today'));
  await assertSucceeds(b.commit());
});

test('R12 먹었어요: 내 별점(1~5 정수)만 + eatState 지우기 / 0 · 6 · 4.5 · 단짝 칸까지 쓰기는 막힘', async () => {
  const eatBatch = (uid, stars, extra = {}) => {
    const db = as(uid); const b = writeBatch(db);
    b.update(doc(db, 'eats', 'k1'), { state: 'eaten', eaten: { at: serverTimestamp(), by: uid, together: true }, [`stars.${uid}`]: stars, ...extra });
    b.delete(doc(db, 'eatState', 'today'));
    return b.commit();
  };
  for (const bad of [0, 6, 4.5]) { await seedToday('k1'); await assertFails(eatBatch(ME, bad)); }
  await seedToday('k1');
  await assertFails(eatBatch(ME, 4, { [`stars.${HER}`]: 5 }));
  await seedToday('k1');
  await assertSucceeds(eatBatch(ME, 4, { [`notes.${ME}`]: '계란말이가 찌개보다 맛있었음' }));
});

test('R13 먹은 뒤: 단짝은 자기 별점 · 한 줄만 남김 / 내 별점 바꾸기는 막힘', async () => {
  await seed('k1', { food: '김치찌개', by: HER, state: 'eaten', eaten: { at: new Date(), by: ME, together: true }, stars: { [ME]: 4 } });
  await assertSucceeds(updateDoc(doc(as(HER), 'eats', 'k1'), { [`stars.${HER}`]: 5, [`notes.${HER}`]: '또 가자' }));
  await assertFails(updateDoc(doc(as(HER), 'eats', 'k1'), { [`stars.${ME}`]: 1 }));
});

test('R14 또 먹고 싶어요: 먹었어요 묶음에 새 쿠키(from=먹은 쿠키) 됨 / 없는 id 를 from 으로 막힘', async () => {
  await seedToday('k1');
  const db = as(ME);
  const b = writeBatch(db);
  b.update(doc(db, 'eats', 'k1'), { state: 'eaten', eaten: { at: serverTimestamp(), by: ME, together: true }, [`stars.${ME}`]: 4 });
  b.delete(doc(db, 'eatState', 'today'));
  b.set(doc(db, 'eats', 'k9'), { food: '김치찌개', by: ME, at: serverTimestamp(), state: 'jar', from: 'k1' });
  await assertSucceeds(b.commit());
  await assertFails(setDoc(doc(as(ME), 'eats', 'k10'), { food: '김치찌개', by: ME, at: serverTimestamp(), state: 'jar', from: 'nope' }));
});

test('R15 깨기 기록: n=3 · shown 3개 됨 / n=4 · by=단짝 막힘 / 단짝이 내 기록 고치기 막힘', async () => {
  await assertSucceeds(setDoc(doc(as(ME), 'eatDraws', 'd1'), { by: ME, at: serverTimestamp(), n: 3, who: 'all', shown: ['a', 'b', 'c'] }));
  await assertFails(setDoc(doc(as(ME), 'eatDraws', 'd2'), { by: ME, at: serverTimestamp(), n: 4, who: 'all', shown: ['a'] }));
  await assertFails(setDoc(doc(as(ME), 'eatDraws', 'd3'), { by: HER, at: serverTimestamp(), n: 1, who: 'all', shown: ['a'] }));
  await assertSucceeds(updateDoc(doc(as(ME), 'eatDraws', 'd1'), { shown: ['a', 'b', 'c', 'd'], picked: 'd' }));
  await assertFails(updateDoc(doc(as(HER), 'eatDraws', 'd1'), { picked: 'a' }));
});

test('R16 eatState/today 고치기(update)는 늘 막힘', async () => {
  await seedToday('k1');
  await assertFails(updateDoc(doc(as(ME), 'eatState', 'today'), { eatId: 'k2' }));
});

test('P1 꿍으로 알려 주기: 오늘 먹을 쿠키에 한 번만 · 음식 이름이 같아야 · 읽기 막힘', async () => {
  await seedToday('k1');
  await assertFails(setDoc(doc(as(ME), 'eatPings', 'k1_' + ME), { by: ME, eatId: 'k1', food: '다른 음식', at: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(as(ME), 'eatPings', 'k1_' + ME), { by: ME, eatId: 'k1', food: '김치찌개', at: serverTimestamp() }));
  await assertFails(setDoc(doc(as(ME), 'eatPings', 'k1_' + ME), { by: ME, eatId: 'k1', food: '김치찌개', at: serverTimestamp() }), '두 번째는 update 라 막힘');
  await assertFails(getDoc(doc(as(ME), 'eatPings', 'k1_' + ME)));
});

test('U1 users: 출출 쿠키 · 교환 쪽지 설정 칸', async () => {
  await assertSucceeds(setDoc(doc(as(ME), 'users', ME), { eatDrawN: 3, eatDrawWho: 'partner', eatSeenAt: Date.now(), qRemind: false, qPartner: true }, { merge: true }));
  await assertFails(setDoc(doc(as(ME), 'users', ME), { eatDrawN: 4 }, { merge: true }));
  await assertFails(setDoc(doc(as(ME), 'users', ME), { eatDrawWho: 'x' }, { merge: true }));
});
// deleteField 는 앞으로 쓸 때를 위해 불러 둠 (마음에 남아요 끄기는 question.emu.js)
void deleteField;
