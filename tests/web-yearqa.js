// node tests/web-yearqa.js <shots-dir> — 짝꿍과의 연말 문답 화면 시험 (docs/yearqa/tests.md)
// 가짜 Firebase · 로그인 · 두 사람 만들기는 tests/web.js 의 앞부분을 빌려 씀 (포트 · 시계 · 규칙 흉내만 바꿈).
// 흐름: 12월 5일 입구 → 쓰기 · 임시 저장 → 봉투 붙이기(둘 다) → 12월 31일엔 짝꿍 답을 안 읽음 → 1월 1일 연말결산 끝에 문답 카드
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'web.js'), 'utf8');
const cut = src.indexOf('\n(async () => {');
if (cut < 0) throw new Error('tests/web.js 의 시험 본문 시작을 찾지 못했어요');
let harness = src.slice(0, cut).replace('const PORT = 8766;', 'const PORT = 8769;')
  .replace("new Date('2026-10-27T21:00:00+09:00')", "new Date('2026-12-05T20:00:00+09:00')")
  // Firestore merge 는 지도(map) 칸을 깊게 합침 — 봉투 표시 sealed.{uid} 가 서로 지워지지 않게 한 단계 깊게
  .replace('if (o && o.merge) v = Object.assign({}, local.get(p) || {}, v);', 'if (o && o.merge) { var ob = local.get(p) || {}; var nv = Object.assign({}, ob, v); Object.keys(v).forEach(function (k) { if (v[k] && typeof v[k] === "object" && !Array.isArray(v[k]) && ob[k] && typeof ob[k] === "object") nv[k] = Object.assign({}, ob[k], v[k]); }); v = nv; }')
  // 규칙 흉내: 짝꿍 문답은 둘 다 붙이고 1월 1일(서울)이 지나야 — 앱은 그 전에 읽으려 하지도 않아야 함 (window.__yqDenied)
  .replace('  function readDenied(p) {\n', () => "  function readDenied(p) {\n    var ym = new RegExp('^yearqa/([0-9]{4})/a/([^/]+)$').exec(p);\n    if (ym && user && ym[2] !== user.uid) { var rev = Date.UTC(+ym[1] + 1, 0, 1) - 9 * 3600000, mine = local.get('yearqa/' + ym[1] + '/a/' + user.uid), th = local.get(p);\n      if (!(Date.now() >= rev && mine && mine.sealed && th && th.sealed)) { window.__yqDenied = (window.__yqDenied || 0) + 1; return true; } }\n");
if (!harness.includes('__yqDenied') || !harness.includes('2026-12-05T20:00')) throw new Error('하네스 바꾸기 실패');
const R = require('../functions/recap.js');

async function main() {
  await new Promise((r) => setTimeout(r, 700));
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + '.png') });
  const denied = (p) => p.evaluate(() => window.__yqDenied || 0);
  const toRecap = async (p) => { await p.click('[data-act="tab"][data-tab="look"]'); await p.click('[data-act="rv-mode"][data-v="recap"]'); };

  const jm = await open(browser, '준민');
  await signUp(jm, 'junmin@example.com', 'pass1234', '준민');
  const dj = await open(browser, '다진');
  await signUp(dj, 'dajin@example.com', 'pass5678', '다진');
  const J = accounts.get('junmin@example.com').uid, D = accounts.get('dajin@example.com').uid;

  // Y-C1 입구: 12월엔 결산 칸에 문답 카드
  await toRecap(jm);
  await jm.waitForSelector('.yq-entry', { timeout: 6000 });
  assert.match(await jm.textContent('.yq-entry'), /2026년 · 짝꿍과의 연말 문답/);
  assert.match(await jm.textContent('.yq-entry'), /0 \/ 30 답함/);
  await shot(jm, 'yq-01-entry');

  // Y-C2 쓰기: 첫 묶음 · 입력하면 잠시 뒤 저장 (정리된 글)
  await jm.click('.yq-entry');
  await jm.waitForSelector('.sheet.yq');
  assert.match(await jm.textContent('.yq-intro'), /1월 1일 연말결산 뒤/);
  await jm.fill('#yq-a-t1', '  밤양갱  ');
  await jm.fill('#yq-a-t3', '순대국');
  assert.strictEqual(await jm.textContent('#yq-c-taste'), '2/6');
  await jm.waitForTimeout(1600);
  assert.deepStrictEqual(docs.get('yearqa/2026/a/' + J).answers, { t1: '밤양갱', t3: '순대국' });
  assert.strictEqual(docs.get('yearqa/2026/a/' + J).sealed, false);
  assert.match(await jm.textContent('.yq-save'), /저장했어요/);
  await shot(jm, 'yq-02-write');
  // 다음 묶음으로 → 마지막 묶음 (타임캡슐 안내)
  for (let i = 0; i < 4; i++) await jm.click('.yq-foot .rc-btn');
  await jm.waitForSelector('#yq-a-n5');
  assert.match(await jm.textContent('.yq-q--capsule'), /2027년 연말 문답을 열 때 펼쳐져요/);
  await jm.fill('#yq-a-n5', '내년에도 옆에 있어 줘');
  await jm.fill('#yq-a-n6', '천천히, 단단하게');
  await shot(jm, 'yq-03-last');
  // Y-C3 봉투 붙이기 확인 → 붙이기
  await jm.click('[data-act="yq-seal-ask"]');
  await jm.waitForSelector('.yq-confirm');
  assert.match(await jm.textContent('.yq-confirm'), /답한 질문 4개 · 건너뛴 질문 26개/);
  await shot(jm, 'yq-04-confirm');
  await jm.click('.yq-confirm [data-act="yq-seal"]');
  await jm.waitForFunction(() => !document.querySelector('.yq-confirm'));
  assert.strictEqual(docs.get('yearqa/2026/a/' + J).sealed, true);
  assert.ok(docs.get('yearqa/2026').sealed[J]);
  assert.match(await jm.textContent('.yq-head__s'), /내 봉투는 붙였어요/);
  await jm.click('[data-act="yq-close"]');
  await jm.waitForFunction(() => /봉투 붙임/.test((document.querySelector('.yq-entry') || {}).textContent || ''));

  // 다진: 입구에 「준민이 먼저 봉투를 붙였어요」 → 쓰고 붙이기
  await toRecap(dj);
  await dj.waitForSelector('.yq-entry');
  assert.match(await dj.textContent('.yq-entry'), /준민이 먼저 봉투를 붙였어요/);
  await dj.click('.yq-entry'); await dj.waitForSelector('.sheet.yq');
  await dj.fill('#yq-a-t1', '사건의 지평선');
  await dj.click('[data-act="yq-sec"][data-v="next"]');
  await dj.fill('#yq-a-n5', '내년의 준민에게 비밀 한 줄');
  await dj.fill('#yq-a-n6', '같이 걷기');
  await dj.click('[data-act="yq-seal-ask"]'); await dj.click('.yq-confirm [data-act="yq-seal"]');
  await dj.waitForFunction(() => !document.querySelector('.yq-confirm'));
  assert.ok(docs.get('yearqa/2026').sealed[J] && docs.get('yearqa/2026').sealed[D], '둘 다 표시');
  await dj.click('[data-act="yq-close"]');
  await jm.waitForFunction(() => /1월 1일 결산 뒤에 펼쳐져요/.test((document.querySelector('.yq-entry') || {}).textContent || ''));
  await shot(jm, 'yq-05-ready');
  assert.strictEqual(await denied(jm) + await denied(dj), 0, '1월 1일 전엔 짝꿍 답을 읽으려 하지 않음');

  // Y-C4 1월 1일: 연말결산(서버가 만든 문서 흉내) 끝에 문답 카드
  const input = JSON.parse(JSON.stringify(require('./fixtures/recap-2026-11.json')).replace(/"jm"/g, JSON.stringify(J)).replace(/"dj"/g, JSON.stringify(D)));
  input.period = { kind: 'year', key: '2026' };
  docs.set('recaps/2026', JSON.parse(JSON.stringify(R.computeRecap(input, null))));
  for (const p of [jm, dj]) await p.clock.setSystemTime(new Date('2027-01-01T09:00:00+09:00'));
  await jm.reload(); await jm.waitForSelector('.title'); await jm.waitForTimeout(300);
  await toRecap(jm);
  await jm.waitForSelector('[data-act="yq-reveal"]', { timeout: 6000 });
  assert.match(await jm.textContent('.yq-entry'), /펼쳐 보기/);
  await jm.click('[data-act="yq-reveal"]');
  await jm.waitForSelector('.sheet.recap');
  // 마지막 장까지 넘기며 문답 카드 확인
  const seen = [];
  for (let i = 0; i < 20; i++) {
    seen.push(await jm.evaluate(() => (document.querySelector('.rc-stage') || {}).textContent || ''));
    if (await jm.$('.yq-pair--big')) break;
    await jm.keyboard.press('ArrowRight'); await jm.waitForTimeout(60);
  }
  const all = seen.join('\n');
  assert.ok(/우리의 한 해 요약|우리의 한 달 요약/.test(all) || /한 해/.test(all), '연말결산 카드가 앞에');
  assert.match(all, /2026년, 서로에게 물었어요/);
  assert.match(all, /둘이 함께 답한 질문 3개/);
  assert.match(all, /밤양갱[\s\S]*사건의 지평선|사건의 지평선[\s\S]*밤양갱/);
  assert.ok(!all.includes('내년의 준민에게 비밀 한 줄') && !all.includes('내년에도 옆에 있어 줘'), '타임캡슐 글은 안 보임');
  assert.match(all, /2027년 첫 장/);
  assert.match(await jm.textContent('.rc-stage'), /천천히, 단단하게[\s\S]*같이 걷기/);
  await shot(jm, 'yq-08-first');
  await jm.keyboard.press('ArrowLeft'); await jm.waitForTimeout(80); await shot(jm, 'yq-07-capsule');
  await jm.keyboard.press('ArrowLeft'); await jm.waitForTimeout(80); await jm.waitForSelector('.yq-sec'); await shot(jm, 'yq-06-section');
  // 어두운 테마
  await jm.evaluate(() => { localStorage.setItem('danjjakkung.theme', 'cosmic-dream'); RT.themes.apply('cosmic-dream'); });
  await jm.waitForTimeout(120); await shot(jm, 'yq-09-dark');
  // 320px
  await jm.setViewportSize({ width: 320, height: 568 }); await jm.waitForTimeout(120); await shot(jm, 'yq-10-320');
  const over = await jm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.ok(!over, '320px 가로 넘침 없음');

  console.log('연말 문답 화면 시험 통과 ·', OUT);
  await browser.close();
  process.exit(0);
}
eval(harness + '\n;globalThis.__main = ' + main.toString() + ';');
globalThis.__main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
