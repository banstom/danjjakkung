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

  // 할 일 하나를 끝내 두면(내 칸) 도트 테마의 할 일 탭에 S3 「다 끝냈어요」가 나온다
  await jm.click('[data-act="tab"][data-tab="todo"]');
  await jm.click('[data-act="todo-add"][data-key="' + (await jm.getAttribute('.tcard--col [data-act="todo-add"]', 'data-key')) + '"]');
  await jm.fill('#td-title', '붕어빵 사기');
  await jm.click('form[data-form="todo"] button[type="submit"]'); await jm.waitForTimeout(200);
  assert.strictEqual(await jm.$$eval('.tdone', (a) => a.length), 0, 'S3 남은 일이 있으면 없음');
  await jm.click('.tcard--col .trow:not(.is-done) [data-act="todo-toggle"]'); await jm.waitForTimeout(250);
  assert.strictEqual(await jm.$$eval('.tdone', (a) => a.length), 0, 'S3 다른 테마에서는 없음');

  // 그림 자리 점검: 정수 배율 · 화면 크기 = 원본 × 배율 · 늘어나지 않음 (D2)
  const ART = { s1: '.top .top__art', s2: '.afeat__art', s3: '.tdone .theme-art' };
  globalThis.__checks = async (p, id, mode, tag) => {
    // C1 · C3: 스킨 · 도트 글꼴
    const font = await p.evaluate(() => ({ fam: getComputedStyle(document.querySelector('.title')).fontFamily, ok11: document.fonts.check('24px Galmuri11', '전체'), ok14: document.fonts.check('15px Galmuri14', '루틴') }));
    assert.ok(/Galmuri11/.test(font.fam) && font.ok11 && font.ok14, tag + ' C3 도트 글꼴 ' + JSON.stringify(font));
    // C4: 화면에 보이는 글씨 크기는 12 · 15 · 24 · 36 만
    for (const tab of ['routine', 'schedule', 'todo', 'look', 'all']) {
      await p.click(`[data-act="tab"][data-tab="${tab}"]`); await p.waitForTimeout(120);
      const sizes = await p.evaluate(() => {
        const out = {};
        document.querySelectorAll('#app *').forEach((e) => {
          if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
          const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
          if (e.closest('svg')) return; // 지도 · 토마토 그림 안 글자는 그림
          const f = getComputedStyle(e).fontSize; out[f] = (out[f] || 0) + 1;
        });
        return out;
      });
      const bad = Object.keys(sizes).filter((f) => !['12px', '15px', '24px', '36px'].includes(f));
      assert.deepStrictEqual(bad, [], `${tag} ${tab} C4 표 밖 글씨 크기 ${JSON.stringify(sizes)}`);
      // C6: 누르는 것 44px 이상 (세그먼트 · 아래 탭 · 버튼)
      const small = await p.evaluate(() => [...document.querySelectorAll('.seg__btn, .tabbar__btn, .solid-btn, .ghost-btn, .close-btn, .tpick, .tset__more')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height < 44; }).map((e) => e.className + ' ' + Math.round(e.getBoundingClientRect().height)));
      assert.deepStrictEqual(small, [], `${tag} ${tab} C6 44px 미만`);
    }
    // C5: 머리 장식이 머리말 글자를 가리지 않음 (날짜 글자 위 ≥ 장식 아래)
    const c5 = await p.evaluate(() => ({ head: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-h')), top: document.querySelector('.top').getBoundingClientRect().top }));
    assert.ok(c5.top >= c5.head + 8, tag + ' C5 머리 장식 ' + JSON.stringify(c5));
    // D2: 그림 자리
    await p.click('[data-act="tab"][data-tab="todo"]'); await p.waitForTimeout(120);
    await shot(p, tag + '-todo-done');
    await p.click('[data-act="tab"][data-tab="all"]'); await p.waitForTimeout(120);
    for (const [slot, sel] of Object.entries(ART)) {
      if (slot === 's3') { await p.click('[data-act="tab"][data-tab="todo"]'); await p.waitForTimeout(150); }
      const a = await p.$eval(sel, (img) => ({ w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height, nw: img.naturalWidth, nh: img.naturalHeight, src: img.getAttribute('src'), done: img.complete }));
      const k = a.w / a.nw;
      assert.ok(a.done && a.nw > 0, tag + ' ' + slot + ' 그림 불러옴 ' + a.src);
      assert.ok(Number.isInteger(k) && k >= 2 && Math.abs(a.h / a.nh - k) < 0.01, `${tag} ${slot} 정수 배율 ${JSON.stringify(a)}`);
      assert.ok(a.src === `themes/${id}/${slot}.png`, tag + ' ' + slot + ' 낮 · 밤 같은 그림');
    }
    await p.click('[data-act="tab"][data-tab="all"]'); await p.waitForTimeout(100);
    console.log(tag, 'C1 · C3 · C4 · C5 · C6 · D2 통과');
  };

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
  // ── E. 테마 설정 화면 ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', serviceWorkers: 'block' });
    const p = jm; // 준민 화면 그대로 (도트 테마 낮 고정 상태에서 시작)
    await setTheme(p, 'winter-snack', 'auto');
    await p.emulateMedia({ colorScheme: 'light' });
    await p.reload(); await p.waitForSelector('.tabbar');
    await p.click('[data-act="tab"][data-tab="all"]');
    await p.click('[data-act="open-theme"]'); await p.waitForSelector('#theme-title');
    const hint = () => p.textContent('.tset__hint');
    const pressed = () => p.getAttribute('[data-act="theme-mode"][aria-pressed="true"]', 'data-v');
    assert.strictEqual(await pressed(), 'auto', 'E 기본 자동');
    assert.strictEqual((await hint()).trim(), '지금은 낮이에요 · 휴대폰 설정을 따라요');
    await shot(p, 'settings-auto-day');
    // 켜 둔 채 휴대폰을 다크 모드로 → 판 · 문구가 바로
    await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(400);
    assert.deepStrictEqual(await themeOf(p), ['winter-snack-night', 'pixel'], 'B2 켜 둔 채로 밤 판');
    assert.strictEqual((await hint()).trim(), '지금은 밤이에요 · 휴대폰 설정을 따라요');
    assert.strictEqual(await p.getAttribute('.tpick[data-v="winter-snack"] .tprev', 'data-theme'), 'winter-snack-night', 'E 미리보기도 밤 판');
    await shot(p, 'settings-auto-night');
    // 낮 고정
    await p.click('[data-act="theme-mode"][data-v="light"]'); await p.waitForTimeout(400);
    assert.deepStrictEqual(await themeOf(p), ['winter-snack', 'pixel'], 'E 낮 고정');
    assert.strictEqual((await hint()).trim(), '늘 낮으로 보여요');
    assert.strictEqual(await p.evaluate(() => localStorage.getItem('danjjakkung.themeMode')), 'light');
    await p.click('[data-act="theme-mode"][data-v="dark"]'); await p.waitForTimeout(400);
    assert.strictEqual((await hint()).trim(), '늘 밤으로 보여요');
    await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(300);
    assert.deepStrictEqual(await themeOf(p), ['merry-xmas-night'.replace('merry-xmas', 'winter-snack'), 'pixel'], 'B3 밤 고정은 시스템과 상관없이');
    // 꼬리표 · 앞 네 장 · 더 보기
    const cards = await p.$$eval('.tpick', (a) => a.map((e) => e.getAttribute('data-v')));
    assert.deepStrictEqual(cards, ['winter-snack', 'merry-xmas', 'soft-pastel', 'cosmic-dream'], 'E 앞 네 장 (도트 2 → 기본 둘)');
    assert.match(await p.textContent('.tpick[data-v="winter-snack"] .tpick__tags'), /사용 중.*낮·밤.*NEW/);
    assert.match(await p.textContent('.tpick[data-v="cosmic-dream"] .tpick__tags'), /어둡게/);
    await p.click('[data-act="theme-more"]');
    assert.strictEqual(await p.$$eval('.tpick', (a) => a.length), 16, 'E 더 보기 → 16장');
    // 판이 없는 테마 → 낮 · 밤 줄 숨김 + 안내
    await p.click('.tpick[data-v="soft-pastel"]'); await p.waitForTimeout(400);
    assert.strictEqual(await p.$$eval('[data-act="theme-mode"]', (a) => a.length), 0, 'E 판 없는 테마는 낮 · 밤 숨김');
    assert.strictEqual((await hint()).trim(), '이 테마는 한 가지 밝기만 있어서 낮·밤 고르기가 없어요');
    assert.deepStrictEqual(await themeOf(p), ['soft-pastel', null], 'E 스킨 꺼짐');
    await shot(p, 'settings-single-mode');
    await ctx.close();
    console.log('E 설정 화면 통과');
  }
  await browser.close();
  console.log('도트 테마 화면 시험 끝');
}

eval(harness + '\n;globalThis.__main = ' + main.toString() + ';');
globalThis.__main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
