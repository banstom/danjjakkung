#!/usr/bin/env node
/* 결산 미리 보기 (R4) — 실제 데이터로 결산을 계산만 하고 저장하지 않는다 (recaps/* 를 건드리지 않음 → 앱에 안 보임).
   서버 monthlyRecap 과 같은 함수(functions/recap-read.js loadPeriod → recap.js computeRecap)를 쓰고,
   카드마다 앱 문구(js/recap-text.js cardText)로 바꿔 보여 준다.

   Cloud Shell 에서:
     cd ~/danjjakkung && git fetch && git switch main && git pull && (cd functions && npm ci --silent)
     node scripts/recap-preview.js 2026-11          ← 11월 결산 (11월이 끝나기 전이면 오늘까지의 데이터로)
     node scripts/recap-preview.js 2026-11 --json   ← 계산 결과 전체를 recap-preview-2026-11.json 으로도 저장
   인증이 안 되면: gcloud auth application-default login (한 번)

   확인할 것: 카드 순서 · 빠진 카드 · 숫자가 앱에서 본 것과 맞는지 · 지도 카드가 옛 별점(옮기기 안 한 문서)을 놓치지 않는지 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const RD = require(path.join(__dirname, '..', 'functions', 'recap-read.js'));
const R = require(path.join(__dirname, '..', 'functions', 'recap.js'));
const RT = require(path.join(__dirname, '..', 'js', 'recap-text.js'));

const PROJECT = 'jjakkung-grid';
const key = process.argv.find((a) => /^\d{4}(-\d{2})?$/.test(a));
if (!key) { console.error('기간을 적어 주세요: node scripts/recap-preview.js 2026-11  (연말은 2026)'); process.exit(2); }
const period = { kind: key.length === 4 ? 'year' : 'month', key };

(async () => {
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const data = await RD.loadPeriod(db, period);
  if (data.people.length < 2) { console.log('members 가 둘이 아니라 결산을 만들지 않아요.'); return; }
  const range = R.periodRange(period);
  if (data.coupleSince && range.end < data.coupleSince) { console.log('단짝이 된 날보다 이른 기간이라 결산을 만들지 않아요.'); return; }
  const pp = R.prevPeriod(period);
  const prev = data.coupleSince && R.periodRange(pp).end < data.coupleSince ? null : await RD.loadPeriod(db, pp);
  const recap = JSON.parse(JSON.stringify(R.computeRecap(data, prev)));

  // 옮기기 확인: 옛 칸(stars · visits[].note)이 남은 지역은 결산이 별점을 못 읽는다
  const legacy = (await db.collection('places').get()).docs.filter((d) => {
    const p = d.data();
    return (p.stars && Object.keys(p.stars).length) || (p.visits || []).some((v) => v && v.note);
  }).map((d) => d.id);

  const viewer = recap.people[0].uid;
  console.log(`\n== ${key} 결산 미리 보기 (저장 안 함) · 기간 ${range.start} ~ ${range.end} ==`);
  console.log(`사람: ${recap.people.map((p) => p.name).join(' · ')}   카드 ${recap.cards.length}장\n`);
  recap.cards.forEach((c, i) => {
    let t;
    try { t = RT.cardText(c, recap, viewer); } catch (e) { t = { error: e.message }; }
    const show = Object.entries(t || {}).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `    ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
    console.log(`[${i + 1}] ${c.id}\n${show}\n`);
  });
  console.log(legacy.length ? `⚠ 옛 별점 칸이 남은 지역 ${legacy.length}곳: ${legacy.join(', ')} → node scripts/migrate-place-entries.js 로 옮겨 주세요` : '지도: 옛 별점 칸 없음 (옮기기 끝남)');
  if (process.argv.includes('--json')) {
    const file = path.join(process.cwd(), `recap-preview-${key}.json`);
    fs.writeFileSync(file, JSON.stringify(recap, null, 1));
    console.log(`전체 결과: ${file}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
