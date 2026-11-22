#!/usr/bin/env node
/* 11-23 단짝 식탁 데이터 지우기 (한 번만) — 11-20에 폐기한 식탁 기능이 남긴 문서를 지운다.
   지우는 것: meals/* · goals/* · foods/* · private/{uid} (+ private/{uid}/weights/*)
   다른 데이터(루틴 · 일정 · 지도 · 영수증 · 쪽지 · 쿠키 · 결산)는 건드리지 않는다.
   옛 결산 문서(recaps/*)에 들어 있는 식탁 카드 숫자도 그대로 둔다.

   Cloud Shell 에서:
     cd ~/danjjakkung && git fetch && git switch main && git pull
     cd functions && npm ci --silent && cd ..
     node scripts/delete-diet-data.js            ← 미리 보기 (몇 개인지만 셈, 지우지 않음)
     node scripts/delete-diet-data.js --write    ← 백업 JSON 파일을 만든 뒤 실제로 지움 (되돌릴 수 없음)
   인증이 안 되면: gcloud auth application-default login (한 번) */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const PROJECT = 'jjakkung-grid';
const WRITE = process.argv.includes('--write');
const TOP = ['meals', 'goals', 'foods', 'private'];

(async () => {
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const backup = {};
  const refs = [];
  for (const col of TOP) {
    const snap = await db.collection(col).get();
    backup[col] = {};
    for (const d of snap.docs) {
      backup[col][d.id] = d.data();
      if (col === 'private') {
        const w = await d.ref.collection('weights').get();
        if (w.size) backup[col][d.id].__weights = Object.fromEntries(w.docs.map((x) => [x.id, x.data()]));
        w.docs.forEach((x) => refs.push(x.ref));
      }
      refs.push(d.ref);
    }
    const extra = col === 'private' ? ` (체중 기록 ${Object.values(backup.private).reduce((a, v) => a + (v.__weights ? Object.keys(v.__weights).length : 0), 0)}개 포함)` : '';
    console.log(`${col}: ${snap.size}개${extra}`);
  }
  console.log(`지울 문서 모두 ${refs.length}개`);
  if (!WRITE) { console.log('미리 보기만 했어요. 지우려면 --write 를 붙여 다시 실행해 주세요.'); return; }
  if (!refs.length) { console.log('지울 것이 없어요.'); return; }
  const file = path.join(process.cwd(), `diet-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 1));
  console.log(`백업: ${file}  (필요 없으면 나중에 지워도 돼요)`);
  for (let i = 0; i < refs.length; i += 400) {
    const b = db.batch();
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
  console.log(`지웠어요: ${refs.length}개`);
})().catch((e) => { console.error(e); process.exit(1); });
