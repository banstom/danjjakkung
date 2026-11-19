#!/usr/bin/env node
/* v54 단짝 지도 옮기기 (한 번만) — 지역 별점 · 방문 메모를 「방문마다 각자」 기록(entries)으로.
   - 옛 stars.<uid>      → 그 지역 가장 최근 방문의 entries.<uid>.<visitId>.stars
   - 옛 visits[].note    → 그 방문을 만든 사람(createdBy)의 entries.<createdBy>.<visitId>.note
   - 옮긴 뒤 stars, visits[].note 칸은 지운다. 옮기기 전에 places 전체를 JSON 파일로 백업한다.
   계산은 앱과 같은 함수(js/places.js legacyFold)를 쓴다.

   Cloud Shell 에서 (규칙 · 서버를 배포하기 전에):
     cd ~/danjjakkung/functions && npm ci --silent && cd ..
     node scripts/migrate-place-entries.js            ← 미리 보기 (바꾸지 않음)
     node scripts/migrate-place-entries.js --write    ← 백업 파일을 만든 뒤 실제로 옮김
   인증이 안 되면: gcloud auth application-default login (한 번) */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const P = require(path.join(__dirname, '..', 'js', 'places.js'));

const PROJECT = 'jjakkung-grid';
const WRITE = process.argv.includes('--write');

(async () => {
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const snap = await db.collection('places').get();
  const all = {};
  snap.docs.forEach((d) => { all[d.id] = d.data(); });
  const todo = snap.docs.filter((d) => P.needsFold(d.data()));
  console.log(`places 문서 ${snap.size}개 · 옮길 문서 ${todo.length}개`);
  todo.forEach((d) => {
    const before = d.data(), after = P.legacyFold(before);
    const stars = before.stars ? Object.keys(before.stars).length : 0;
    const notes = (before.visits || []).filter((v) => v && v.note).length;
    console.log(`  ${d.id}: 지역 별점 ${stars}개 · 방문 메모 ${notes}개 → 기록 ${Object.values(after.entries).reduce((a, m) => a + Object.keys(m).length, 0)}개`);
  });
  if (!WRITE) { console.log('미리 보기만 했어요. 옮기려면 --write 를 붙여 다시 실행해 주세요.'); return; }
  const file = path.join(process.cwd(), `places-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(all, null, 1));
  console.log(`백업: ${file}`);
  const at = new Date().toISOString();
  for (let i = 0; i < todo.length; i += 400) {
    const b = db.batch();
    todo.slice(i, i + 400).forEach((d) => {
      const next = P.legacyFold(d.data());
      next.updatedAt = at; // updatedBy 는 그대로 (마지막으로 고친 사람)
      b.set(d.ref, next); // 통째로 바꿔 stars · visits[].note 를 지운다
    });
    await b.commit();
  }
  console.log(`옮기기 끝: ${todo.length}개`);
})().catch((e) => { console.error('옮기기 실패:', e.message || e); process.exit(1); });
