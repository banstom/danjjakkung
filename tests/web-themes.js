// node tests/web-themes.js <shots-dir>
// 겨울 업데이트 도트 테마(docs/themes-winter/tests.md)의 화면 시험 — B6 · C · D · E.
// 가짜 Firebase · 로그인 · 두 사람 만들기는 tests/web.js 의 앞부분(시험 본문 전)을 그대로 빌려 쓴다 (포트만 다르게).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'web.js'), 'utf8');
const cut = src.indexOf('\n(async () => {');
if (cut < 0) throw new Error('tests/web.js 의 시험 본문 시작을 찾지 못했어요');
const harness = src.slice(0, cut).replace('const PORT = 8766;', 'const PORT = 8767;');

async function main() {
  await new Promise((r) => setTimeout(r, 700));
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (p, name, full) => p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full });
  const themeOf = (p) => p.evaluate(() => [document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-skin')]);
  const setTheme = (p, id, mode) => p.evaluate(([v, m]) => { localStorage.setItem('danjjakkung.theme', v); if (m) localStorage.setItem('danjjakkung.themeMode', m); RT.themes.apply(v); }, [id, mode || null]);

  // 두 사람 · 루틴 · 할 일
  const jm = await open(browser, '준민');
  await signUp(jm, 'junmin@example.com', 'pass1234', '준민');
  await addRoutine(jm, '테니스 연습', '🎾', '2026-10-20');
  await tick(jm, '2026-10-27');
  const dj = await open(browser, '다진');
  await signUp(dj, 'dajin@example.com', 'pass5678', '다진');
  await addRoutine(dj, '스쿼트 100개', '🦵', '2026-10-18');
  for (const d of ['2026-10-22', '2026-10-25', '2026-10-27']) await tick(dj, d, null);
  await jm.waitForTimeout(300);

  const net = []; // 내려받은 글꼴 · 그림
  jm.on('request', (r) => { const u = r.url(); if (/fonts\/galmuri|\/themes\//.test(u)) net.push(u.replace(/^.*?(fonts\/galmuri|themes)\//, '$1/')); });

  // ── C2 · D1/D3: 다른 테마에서는 도트 글꼴 · 그림을 하나도 안 받는다 ──
  await setTheme(jm, 'soft-pastel');
  await jm.reload(); await jm.waitForSelector('.tabbar');
  for (const tab of ['routine', 'todo', 'all']) { await jm.click(`[data-act="tab"][data-tab="${tab}"]`); await jm.waitForTimeout(120); }
  assert.deepStrictEqual(net, [], 'C2 다른 테마에서 도트 글꼴 · 테마 그림 요청 0');
  assert.strictEqual(await jm.$$eval('.theme-art', (a) => a.length), 0, 'D3 다른 테마에는 그림 자리 없음');
  assert.deepStrictEqual(await themeOf(jm), ['soft-pastel', null], 'C1 다른 테마에는 data-skin 없음');
  console.log('C2 · D3: 다른 테마 요청 0, 자리 0');

  // ── B6: 첫 프레임부터 맞는 판 (밤에 열 때 낮 판이 한 번도 안 보임) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      localStorage.setItem('danjjakkung.theme', 'merry-xmas'); localStorage.setItem('danjjakkung.themeMode', 'auto');
      window.__seen = [];
      new MutationObserver(() => { const t = document.documentElement.getAttribute('data-theme'); if (t && window.__seen[window.__seen.length - 1] !== t) window.__seen.push(t); })
        .observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
      document.addEventListener('readystatechange', () => { window.__atBody = window.__atBody || [document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-skin')]; });
    });
    await p.route('**/js/firebase-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.DANJJAKKUNG_FIREBASE_CONFIG=null;' }));
    await p.goto(URL); await p.waitForSelector('.title');
    const seen = await p.evaluate(() => window.__seen), atBody = await p.evaluate(() => window.__atBody);
    assert.deepStrictEqual(seen, ['merry-xmas-night'], 'B6 첫 판부터 밤 판 (낮 판이 끼지 않음)');
    assert.deepStrictEqual(atBody, ['merry-xmas-night', 'pixel'], 'B6 문서를 다 읽기 전부터 판 · 스킨');
    console.log('B6 첫 프레임:', seen.join(' → '), atBody.join(' '));
    await ctx.close();
  }

  // ── 도트 테마 화면 ──
  for (const [id, mode, tag] of [['winter-snack', 'light', 'snack-day'], ['winter-snack', 'dark', 'snack-night'], ['merry-xmas', 'light', 'xmas-day'], ['merry-xmas', 'dark', 'xmas-night']]) {
    await setTheme(jm, id, mode);
    await jm.reload(); await jm.waitForSelector('.tabbar');
    const board = id + (mode === 'dark' ? '-night' : '');
    assert.deepStrictEqual(await themeOf(jm), [board, 'pixel'], tag + ' 판 · 스킨');
    for (const tab of ['routine', 'schedule', 'todo', 'look', 'all']) {
      await jm.click(`[data-act="tab"][data-tab="${tab}"]`); await jm.waitForTimeout(150);
      await shot(jm, `${tag}-${tab}`, true);
    }
    await jm.evaluate(() => document.fonts.ready);
    globalThis.__checks && await globalThis.__checks(jm, id, mode, tag);
  }
  await browser.close();
  console.log('도트 테마 화면 시험 끝');
}

eval(harness + '\n;globalThis.__main = ' + main.toString() + ';');
globalThis.__main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
