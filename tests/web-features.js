// node tests/web-features.js <shots-dir>
// 교환 쪽지(docs/question tests.md C) · 출출 쿠키(docs/eat tests.md C U1~U14) · 결산 카드 8 화면 시험.
// 가짜 Firebase · 로그인 · 두 사람 만들기는 tests/web.js 의 앞부분(시험 본문 전)을 그대로 빌려 쓴다 (포트만 다르게).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'web.js'), 'utf8');
const cut = src.indexOf('\n(async () => {');
if (cut < 0) throw new Error('tests/web.js 의 시험 본문 시작을 찾지 못했어요');
const harness = src.slice(0, cut).replace('const PORT = 8766;', 'const PORT = 8768;');

async function main() {
  await new Promise((r) => setTimeout(r, 700));
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (p, name, full) => p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full });
  const setTheme = (p, id) => p.evaluate((v) => { localStorage.setItem('danjjakkung.theme', v); RT.themes.apply(v); }, id);
  const text = (p, sel) => p.textContent(sel);
  const docOf = (k) => docs.get(k);
  const keys = (pre) => [...docs.keys()].filter((k) => k.startsWith(pre));

  const jm = await open(browser, '준민');
  await signUp(jm, 'junmin@example.com', 'pass1234', '준민');
  await addRoutine(jm, '테니스 연습', '🎾', '2026-10-20');
  const dj = await open(browser, '다진');
  await signUp(dj, 'dajin@example.com', 'pass5678', '다진');
  await addRoutine(dj, '스쿼트 100개', '🦵', '2026-10-18'); // 다진은 오늘 아직 안 함 → 꿍 보낼 수 있음
  await jm.waitForTimeout(300);
  const qDenied = (p) => p.evaluate(() => window.__qDenied || 0);
  // E5 음식점 찾기: 서버 함수 대신 가짜 카카오 후보 (부른 검색어를 셈)
  const searched = [];
  const fakePlaces = (p) => p.route('**/searchPlace', async (route) => {
    const q = JSON.parse(route.request().postData() || '{}').data.q; searched.push(q);
    const items = q.includes('솔뫼') ? [
      { kakaoId: '27341234', url: 'https://place.map.kakao.com/27341234', name: '솔뫼 마을', kind: '칼국수', area: '서울 성북구' },
      { kakaoId: '11112222', url: 'https://place.map.kakao.com/11112222', name: '솔뫼 칼국수 본점', kind: '칼국수', area: '경기 고양시' }] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { items, used: searched.length, limit: 100 } }) });
  });
  await fakePlaces(jm); await fakePlaces(dj);

  // ══ 교환 쪽지 ══
  // E1 입구: 처음 그릴 때 오늘 질문이 없으면 만든다 (첫날 질문)
  await toAll(jm);
  await jm.waitForFunction(() => /첫 쪽지예요/.test((document.querySelector('[data-act="q-open"]') || {}).textContent || ''), null, { timeout: 8000 });
  assert.match(await text(jm, '[data-act="q-open"]'), /둘 다 아직이에요/);
  assert.strictEqual(keys('qdays/').length, 1, '오늘 질문 문서 하나');
  const today = keys('qdays/')[0].split('/')[1];
  assert.strictEqual(today, '2026-10-27', '서울 날짜');
  // 두 기기가 같이 열어도 문서 하나 (다진이 열어도 그대로)
  await toAll(dj); await dj.waitForFunction(() => /첫 쪽지예요/.test((document.querySelector('[data-act="q-open"]') || {}).textContent || ''));
  assert.strictEqual(keys('qdays/').filter((k) => k.split('/').length === 2).length, 1);
  await shot(jm, 'q-E1-all');

  // F08 첫날 · F01 둘 다 아직 · F02 쓰는 중
  await jm.click('[data-act="q-open"]'); await jm.waitForSelector('.qz-qn');
  assert.match(await text(jm, '.qz-qn'), /첫 쪽지/);
  assert.match(await text(jm, '.qz-how'), /이렇게 써요/);
  assert.ok(await jm.$('[data-act="q-swap"]'), '아무도 안 남겼으면 다른 질문 버튼');
  assert.match(await text(jm, '.qz-wait'), /아직 안 남겼어요/);
  await shot(jm, 'q-F08-first');
  assert.ok(await jm.$eval('[data-act="q-save"]', (b) => b.disabled), '빈 쪽지면 남기기 꺼짐');
  await jm.fill('#q-text', '「꿍 하나만 보내 줘」 — 힘든 날 신호. 다른 사람은 무슨 뜻인지 모를걸요.');
  assert.strictEqual(await text(jm, '#q-count'), '43 / 300');
  await shot(jm, 'q-F02-typing');
  // F03 나만 남김
  await jm.click('[data-act="q-save"]');
  await jm.waitForSelector('[data-act="q-edit"]');
  const qd = docOf('qdays/' + today);
  assert.ok(qd.done[docOf('qdays/' + today) && Object.keys(qd.done)[0]], 'done 표시');
  assert.ok(docOf('qdays/' + today + '/a/' + Object.keys(qd.done)[0]), '쪽지 문서 (같은 묶음)');
  assert.match(await text(jm, '.qz-tint'), /단짝이 남기면 알려 드릴게요/);
  assert.ok(await jm.$('[data-act="q-kung"]'), '꿍 보내서 알려 주기');
  assert.strictEqual(await jm.$('[data-act="q-swap"]'), null, '쪽지가 있으면 다른 질문 없음');
  await shot(jm, 'q-F03-mine');

  // F04 단짝만 남김 (다진 화면): 입구 「단짝이 남겼어요」, 접힌 쪽지 — 글은 화면 · DOM 어디에도 없고, 쪽지 읽기도 안 함
  await dj.waitForFunction(() => /단짝이 남겼어요/.test(document.querySelector('[data-act="q-open"]').textContent));
  await dj.click('[data-act="q-open"]'); await dj.waitForSelector('.qz-folded');
  const djHtml = await dj.content();
  assert.ok(!djHtml.includes('힘든 날 신호'), '접힌 쪽지 글이 DOM 에 없음');
  assert.match(await text(dj, '.qz-nlock'), /오후 9:\d\d에 접어 둔 쪽지[^]*내 쪽지를 남기면 펴져요/);
  assert.strictEqual(await qDenied(dj), 0, '단짝 쪽지를 읽으려 하지 않음');
  await shot(dj, 'q-F04-folded');
  // F05 둘 다 → 펴짐 · 마음에 남아요
  await dj.fill('#q-text', '「밥 먹었어?」 대신 「배 채웠어?」. 처음엔 오타였는데 이제 우리 말이 됐어요.');
  await dj.click('[data-act="q-save"]');
  await dj.waitForFunction(() => /힘든 날 신호/.test(document.querySelector('.qz-grid').textContent), null, { timeout: 5000 });
  await dj.click('[data-act="q-like"]'); await dj.waitForTimeout(150);
  assert.strictEqual(await dj.getAttribute('[data-act="q-like"]', 'aria-pressed'), 'true');
  assert.ok(Object.values(docOf('qdays/' + today).likes).includes(true), 'likes.{다진} = true');
  await shot(dj, 'q-F05-both');
  await jm.waitForFunction(() => /배 채웠어/.test(document.querySelector('.qz-grid').textContent), null, { timeout: 5000 });
  assert.strictEqual(await qDenied(jm), 0);
  // 고치기 → 「고침」
  await jm.click('[data-act="q-edit"]'); await jm.waitForSelector('#q-text');
  await jm.fill('#q-text', '「꿍 하나만」 — 힘든 날 신호예요.');
  await jm.click('[data-act="q-save"]'); await jm.waitForSelector('[data-act="q-edit"]');
  assert.match(await text(jm, '.qz-n--me .qz-nhead'), /고침/);
  // 다크 (코스믹 드림) 둘 다 펴짐 · 320px
  await setTheme(dj, 'cosmic-dream'); await dj.waitForTimeout(100); await shot(dj, 'q-F14-dark');
  await dj.setViewportSize({ width: 320, height: 700 }); await dj.waitForTimeout(100);
  assert.ok(await dj.evaluate(() => document.documentElement.scrollWidth <= 320), '320px 넘침 없음');
  await shot(dj, 'q-320'); await dj.setViewportSize({ width: 390, height: 844 }); await setTheme(dj, 'soft-pastel');

  // F07 질문 넣기 → F12 우리가 넣은 질문 (단짝 것은 글을 숨김)
  await jm.click('[data-act="q-add"]'); await jm.waitForSelector('#q-qtext');
  await jm.fill('#q-qtext', '요즘 제일 자주 흥얼거리는 노래는');
  await shot(jm, 'q-F07-add');
  await jm.click('[data-act="q-add-save"]'); await jm.waitForTimeout(250);
  const ours = keys('ourQuestions/');
  assert.strictEqual(ours.length, 1); assert.strictEqual(docOf(ours[0]).text, '요즘 제일 자주 흥얼거리는 노래는?', '물음표 붙여 줌');
  await dj.click('[data-act="q-add"]'); await dj.waitForSelector('[data-act="q-ours"]'); await dj.click('[data-act="q-ours"]'); await dj.waitForSelector('.qz-orow');
  assert.match(await text(dj, '.mscreen'), /단짝이 준비한 질문이 있어요/);
  assert.ok(!(await dj.content()).includes('흥얼거리는'), '단짝이 넣은 기다리는 질문 글은 숨김');
  await dj.click('[data-act="q-ours-close"]');
  await jm.click('[data-act="q-add"]'); await jm.waitForSelector('[data-act="q-ours"]'); await jm.click('[data-act="q-ours"]'); await jm.waitForSelector('[data-act="q-ours-edit"]');
  assert.match(await text(jm, '.mscreen'), /흥얼거리는 노래는\?/);
  await shot(jm, 'q-F12-ours');
  await jm.click('[data-act="q-ours-close"]');
  // F13 알림 시트 두 줄
  await jm.click('[data-act="q-close"]'); await jm.waitForSelector('.all');
  await jm.click('[data-act="open-notify"]'); await jm.waitForSelector('[data-act="pref-qremind"]');
  assert.match(await text(jm, '.sheet'), /저녁 6시에 교환 쪽지 알려 주기[^]*단짝이 쪽지를 남기면 알려 주기/);
  // (알림을 켜기 전엔 스위치가 꺼져 있음 — 다른 알림 줄과 같은 규칙)
  await jm.click('button.close-btn[data-act="close-notify"]');

  // 다음 날: 다른 질문(F06) — 바꾸면 둘 다에게, 한 번만 / 단짝에게 묻기 질문은 내일(오늘 만든 건 오늘 안 나옴) → 그다음 날 나옴
  for (const p of [jm, dj]) await p.clock.fastForward('24:00:00');
  await jm.click('[data-act="tab"][data-tab="routine"]'); await toAll(jm);
  await jm.waitForFunction(() => document.querySelector('[data-act="q-open"]') && !/첫 쪽지예요/.test(document.querySelector('[data-act="q-open"]').textContent), null, { timeout: 8000 });
  const d2 = '2026-10-28';
  assert.ok(docOf('qdays/' + d2), '새 날 질문');
  assert.strictEqual(docOf('qdays/' + d2).src, 'ours', '어제 넣은 「단짝에게 묻기」가 오늘 나옴');
  await jm.click('[data-act="q-open"]'); await jm.waitForSelector('.qz-qn');
  assert.match(await text(jm, '.qz-qn'), /준민이 낸 질문/);
  assert.strictEqual(await jm.$('[data-act="q-swap"]'), null, '우리가 낸 질문은 바꿀 수 없음');
  await shot(jm, 'q-F09-ours-day');
  for (const p of [jm, dj]) await p.clock.fastForward('24:00:00');
  await jm.click('[data-act="q-close"]'); await jm.click('[data-act="tab"][data-tab="routine"]'); await toAll(jm);
  await jm.waitForFunction(() => !/흥얼거리는/.test(document.querySelector('[data-act="q-open"]').textContent), null, { timeout: 8000 });
  await jm.click('[data-act="q-open"]'); await jm.waitForSelector('[data-act="q-swap"]');
  const before = docOf('qdays/2026-10-29').text;
  await jm.click('[data-act="q-swap"]'); await jm.waitForSelector('[data-act="q-swap-yes"]');
  await shot(jm, 'q-F06-swap');
  await jm.click('[data-act="q-swap-yes"]'); await jm.waitForTimeout(300);
  const after = docOf('qdays/2026-10-29');
  assert.notStrictEqual(after.text, before); assert.deepStrictEqual(after.skipped.length, 1); assert.ok(after.swappedAt);
  assert.strictEqual(await jm.$('[data-act="q-swap"]'), null, '하루 한 번');
  await toAll(dj).catch(() => {}); await dj.click('[data-act="tab"][data-tab="routine"]'); await toAll(dj);
  await dj.waitForFunction((t) => document.querySelector('[data-act="q-open"]').textContent.includes(t), after.text, { timeout: 5000 });
  // F11 지난 쪽지: 질문 3개 · 둘 다 남긴 날 1일 · 28일은 늦게 남기기 · 마음에 남은 날 ♥
  await jm.click('[data-act="q-past"]'); await jm.waitForSelector('.qz-hrow');
  assert.match(await text(jm, '.qz-tint--top'), /질문 3개 · 둘 다 남긴 날 1일/);
  assert.ok(await jm.$('[data-act="q-past-day"][data-v="2026-10-28"] .qz-late'), '지난날 안 남긴 질문 → 늦게 남기기');
  assert.ok(await jm.$('[data-act="q-past-day"][data-v="2026-10-27"] .qz-heart'), '마음에 남은 날');
  await shot(jm, 'q-F11-past', true);
  await jm.click('[data-act="q-past-day"][data-v="2026-10-28"]'); await jm.waitForSelector('#q-text');
  await jm.fill('#q-text', '늦었지만 남겨요'); await jm.click('[data-act="q-save"]'); await jm.waitForSelector('[data-act="q-edit"]');
  assert.ok(Object.keys(docOf('qdays/2026-10-28').done).length === 1, '늦게 남기기');
  await jm.click('[data-act="q-close"]'); await jm.waitForSelector('.qz-hrow'); await jm.click('[data-act="q-past-close"]'); await jm.click('[data-act="q-close"]');
  await jm.waitForSelector('.all');
  console.log('교환 쪽지 확인 끝 (입구 E1 · 첫날 · 쓰기 · 나만 · 접힌 쪽지(글 없음 · 읽기 시도 0) · 둘 다 · 마음에 남아요 · 고치기 · 질문 넣기 · 우리 질문 숨김 · 알림 두 줄 · 다음 날 묻기 질문 · 다른 질문 · 지난 쪽지 · 늦게 남기기 · 다크 · 320px)');

  // ══ 출출 쿠키 ══
  // U1 빈 통(11) → 첫 쿠키 넣기 → 사용자 예시 → 접어서 넣기 → 「쿠키 통에 넣었어요 · 1개째」
  await jm.click('[data-act="ek-open"]'); await jm.waitForSelector('.ek-steps');
  await shot(jm, 'eat-11-empty');
  await jm.click('[data-act="ek-add"]'); await jm.waitForSelector('#ek-food');
  // U2 음식이 비면 꺼짐 · 21자째 · 101자째는 안 들어감
  assert.ok(await jm.$eval('[data-act="ek-write-save"]', (b) => b.disabled));
  await jm.fill('#ek-food', '가'.repeat(25)); assert.strictEqual((await jm.inputValue('#ek-food')).length, 20);
  await jm.fill('#ek-memo', '나'.repeat(120)); assert.strictEqual((await jm.inputValue('#ek-memo')).length, 100);
  await jm.fill('#ek-food', '칼국수');
  await jm.fill('#ek-memo', '뭔가 오늘따라 시원한 칼국수가 먹고싶네');
  assert.strictEqual(await text(jm, '#ek-memo-n'), '21 / 100'); // 목업 22 는 글자 수를 잘못 셈 (실제 21자)
  await jm.click('[data-act="ek-place"]'); await jm.waitForSelector('#ek-place-q');
  // E5: 검색 → 카카오 후보 → 고르기 → 쪽지에 적을 이름(내가 친 글자에서 시작) → 넣기
  await jm.fill('#ek-place-q', '솔뫼'); await jm.waitForSelector('[data-act="ek-place-pick"]');
  assert.strictEqual((await jm.$$('[data-act="ek-place-pick"]')).length, 2);
  assert.match(await text(jm, '[data-act="ek-place-pick"][data-v="0"]'), /솔뫼 마을칼국수 · 서울 성북구/);
  assert.ok(await jm.$('[data-act="ek-place-name"]'), '이름만 적기 줄은 늘 맨 아래');
  await shot(jm, 'eat-03-search');
  await jm.click('[data-act="ek-place-pick"][data-v="0"]'); await jm.waitForSelector('#ek-place-nm');
  assert.strictEqual(await jm.inputValue('#ek-place-nm'), '솔뫼', '카카오 장소명을 채우지 않고 내가 친 글자');
  await jm.click('[data-act="ek-place-back"]'); await jm.waitForSelector('[data-act="ek-place-pick"]');
  await jm.click('[data-act="ek-place-pick"][data-v="0"]'); await jm.waitForSelector('#ek-place-nm');
  await jm.fill('#ek-place-nm', '솔뫼 마을'); await jm.click('[data-act="ek-place-ok"]'); await jm.waitForSelector('[data-act="ek-place-clear"]');
  assert.match(await text(jm, '.ek-placebox'), /솔뫼 마을카카오맵 장소/);
  assert.deepStrictEqual([...new Set(searched)], ['솔뫼'], '친 동안은 기다렸다가 한 번만');
  await shot(jm, 'eat-02-write');
  await jm.click('[data-act="ek-write-save"]'); await jm.waitForSelector('.ek-jar');
  await jm.waitForSelector('.toast');
  assert.match(await text(jm, '.toast'), /쿠키 통에 넣었어요 · 1개째/);
  const e1 = keys('eats/'); assert.strictEqual(e1.length, 1);
  assert.deepStrictEqual([docOf(e1[0]).food, docOf(e1[0]).place.name, docOf(e1[0]).state], ['칼국수', '솔뫼 마을', 'jar']);
  assert.deepStrictEqual(docOf(e1[0]).place, { name: '솔뫼 마을', kakaoId: '27341234', url: 'https://place.map.kakao.com/27341234' }, 'E5 저장: 이름 · id · 주소만 (시·군·구 없음)');
  async function add(p, food, memo) {
    await p.click('[data-act="ek-add"]'); await p.waitForSelector('#ek-food');
    await p.fill('#ek-food', food); if (memo) await p.fill('#ek-memo', memo);
    await p.click('[data-act="ek-write-save"]'); await p.waitForSelector('.ek-jar'); await p.waitForTimeout(120);
  }
  for (const f of ['쌀국수', '돈가스', '쫄면']) await add(jm, f);
  await dj.click('[data-act="ek-open"]'); await dj.waitForSelector('.ek-jar');
  await add(dj, '김치찌개', '추운 날엔 무조건. 계란말이도 같이 시키자');
  await add(dj, '마라탕', '단계는 1단계로');
  // U10 단짝 화면에서 목록: 내 쿠키가 비밀, DOM 에도 음식 이름 없음
  await dj.click('[data-act="ek-list"]'); await dj.waitForSelector('.ek-krow');
  const djList = await dj.content();
  for (const f of ['칼국수', '쌀국수', '돈가스', '쫄면', '솔뫼']) assert.ok(!djList.includes(f), 'U10 ' + f + ' 비밀');
  assert.strictEqual((djList.match(/단짝의 쿠키/g) || []).length, 4);
  await shot(dj, 'eat-10-list');
  await dj.click('[data-act="ek-list-close"]');
  // 입구 「단짝 +2」 (준민은 통을 연 뒤 다진이 2개 넣음)
  await jm.click('[data-act="ek-close"]'); await jm.waitForSelector('.all');
  await jm.waitForFunction(() => /단짝 \+2/.test(document.querySelector('[data-act="ek-open"]').textContent));
  assert.match(await text(jm, '[data-act="ek-open"]'), /쿠키 6개/);
  assert.ok(!(await jm.$eval('[data-act="ek-open"]', (b) => b.textContent)).includes('김치찌개'), '입구에 단짝 쿠키 음식 이름 없음');
  await shot(jm, 'eat-12-entry');
  // U3 개수 3 · 범위 단짝 → 새로 열어도 그대로 (users 에 기억)
  await jm.click('[data-act="ek-open"]'); await jm.waitForSelector('.ek-jar');
  await jm.click('[data-act="ek-n"][data-v="3"]'); await jm.click('[data-act="ek-who"][data-v="partner"]'); await jm.waitForTimeout(150);
  await jm.reload(); await jm.waitForSelector('.tabbar'); await toAll(jm); await jm.click('[data-act="ek-open"]'); await jm.waitForSelector('.ek-jar');
  assert.strictEqual(await jm.getAttribute('[data-act="ek-n"][data-v="3"]', 'aria-pressed'), 'true', 'U3');
  assert.strictEqual(await jm.getAttribute('[data-act="ek-who"][data-v="partner"]', 'aria-pressed'), 'true');
  await shot(jm, 'eat-01-jar');
  // U4 단짝 쿠키만 3개 깨기 → 단짝 쿠키 2개뿐이라 있는 만큼, 모두 단짝 것 (U12: 움직임 줄이기면 05 없이 06)
  await jm.emulateMedia({ reducedMotion: 'reduce' });
  await jm.click('[data-act="ek-crack"]'); await jm.waitForSelector('.ek-pick');
  assert.strictEqual(await jm.$('.ek-cracking'), null, 'U12 깨는 중 화면 없이');
  const foods = await jm.$$eval('.ek-slip__food', (e) => e.map((x) => x.textContent).sort());
  assert.deepStrictEqual(foods, ['김치찌개', '마라탕'], 'U4 단짝 쿠키만 · 있는 만큼');
  assert.ok(await jm.$eval('[data-act="ek-choose"]', (b) => b.disabled), '안 골랐으면 꺼짐');
  await jm.click('.ek-pick:has-text("김치찌개")');
  assert.strictEqual(await text(jm, '[data-act="ek-choose"]'), '김치찌개로 할래요');
  await shot(jm, 'eat-06-pick');
  // U6 거의 동시에: 다진도 고르는 화면 → 준민이 먼저 → 다진은 「단짝이 방금 골랐어요」
  await dj.emulateMedia({ reducedMotion: 'reduce' });
  await dj.click('[data-act="ek-n"][data-v="1"]'); await dj.click('[data-act="ek-who"][data-v="all"]');
  await dj.click('[data-act="ek-crack"]'); await dj.waitForSelector('[data-act="ek-choose"]');
  await jm.click('[data-act="ek-choose"]'); await jm.waitForSelector('.ek-today');
  await dj.click('[data-act="ek-choose"]'); await dj.waitForSelector('.toast');
  assert.match(await text(dj, '.toast'), /단짝이 방금 골랐어요/, 'U6');
  assert.strictEqual(keys('eatState/').length, 1);
  // U5 오늘 먹을 것 08 · 깨기 꺼짐 · 입구
  assert.match(await text(jm, '.ek-today'), /오늘은 이거![^]*김치찌개[^]*단짝이 10월 2\d일에 적은 쿠키 · 가게는 안 정했어요[^]*추운 날엔 무조건/);
  assert.ok(await jm.$eval('[data-act="ek-crack"]', (b) => b.disabled));
  await shot(jm, 'eat-08-today');
  // 꿍으로 알려 주기 → eatPings 하나 (두 번째는 막힘)
  await jm.click('[data-act="ek-kung"]'); await jm.waitForTimeout(200);
  assert.strictEqual(keys('eatPings/').length, 1); assert.strictEqual(docOf(keys('eatPings/')[0]).food, '김치찌개');
  // U7 통에 돌려놓기 → 병 개수 그대로
  const jarCount = () => jm.$eval('.ek-jar', (j) => j.getAttribute('aria-label'));
  await jm.click('[data-act="ek-return"]'); await jm.waitForFunction(() => !document.querySelector('.ek-today'));
  assert.strictEqual(await jarCount(), '쿠키 통, 쿠키 6개', 'U7');
  assert.strictEqual(keys('eatState/').length, 0);
  // U9 다시 고르기 → 먹었어요(별점 4 · 또 먹고 싶어요) → 목록 먹은 것 1 · 통 안에 「또 먹기」
  await jm.click('[data-act="ek-crack"]'); await jm.waitForSelector('.ek-pick');
  await jm.click('.ek-pick:has-text("김치찌개")'); await jm.click('[data-act="ek-choose"]'); await jm.waitForSelector('.ek-today');
  await jm.click('[data-act="ek-ate"]'); await jm.waitForSelector('[data-act="ek-star"]');
  await jm.click('[data-act="ek-star"][data-v="4"]'); await jm.fill('#ek-note', '계란말이가 찌개보다 맛있었음');
  await shot(jm, 'eat-09-ate');
  await jm.click('[data-act="ek-ate-save"]'); await jm.waitForFunction(() => !document.querySelector('.ek-today'));
  await jm.click('[data-act="ek-list"]'); await jm.waitForSelector('.ek-krow');
  assert.match(await text(jm, '[data-act="ek-tab"][data-v="eaten"]'), /먹은 것 1/);
  assert.match(await text(jm, '.ek-list'), /김치찌개[^]*또 먹기/, 'U9');
  await jm.click('[data-act="ek-tab"][data-v="eaten"]'); await jm.waitForSelector('.ek-krow');
  assert.match(await text(jm, '.ek-list'), /김치찌개[^]*★4/);
  // 단짝은 나중에 자기 별점만
  await dj.click('[data-act="ek-list"]').catch(() => {}); await dj.waitForSelector('[data-act="ek-tab"]');
  await dj.click('[data-act="ek-tab"][data-v="eaten"]'); await dj.click('[data-act="ek-rate"]'); await dj.click('[data-act="ek-star"][data-v="5"]'); await dj.click('[data-act="ek-ate-save"]'); await dj.waitForTimeout(200);
  const eaten = keys('eats/').map(docOf).find((c) => c.state === 'eaten');
  assert.strictEqual(Object.keys(eaten.stars).length, 2, '두 사람 별점');
  await jm.waitForFunction(() => /★4\.5/.test(document.querySelector('.ek-list').textContent));
  // U11 내 쿠키 고치기(통 안) · 빼기 → 목록에서 사라짐
  await jm.click('[data-act="ek-tab"][data-v="jar"]');
  await jm.click('.ek-krow:has-text("쫄면")'); await jm.waitForSelector('#ek-food');
  await jm.fill('#ek-food', '비빔쫄면'); await jm.click('[data-act="ek-write-save"]'); await jm.waitForSelector('.ek-krow');
  assert.match(await text(jm, '.ek-list'), /비빔쫄면/);
  await jm.waitForSelector('.toast', { state: 'hidden', timeout: 8000 }).catch(() => {}); // 알림 글이 머리줄을 덮는 동안은 기다림
  await jm.click('.ek-krow:has-text("비빔쫄면")'); await jm.waitForSelector('[data-act="ek-out"]');
  await jm.click('[data-act="ek-out"]'); await jm.click('[data-act="ek-out"]'); await jm.waitForSelector('.ek-krow');
  assert.ok(!(await text(jm, '.ek-list')).includes('비빔쫄면'), 'U11 빼면 목록에서 사라짐');
  assert.ok(keys('eats/').map(docOf).some((c) => c.food === '비빔쫄면' && c.state === 'out'), '지우지 않고 out');
  await jm.click('[data-act="ek-list-close"]');
  // U8 고르고 3일 뒤(서울 날짜) 앱을 열면 자동으로 통에 돌려놓기
  await jm.click('[data-act="ek-crack"]'); await jm.waitForSelector('.ek-pick');
  await jm.waitForTimeout(300); await jm.click('.ek-pick'); await jm.click('[data-act="ek-choose"]'); await jm.waitForSelector('.ek-today');
  await jm.clock.fastForward(3 * 86400000); await jm.waitForTimeout(500); await jm.reload(); await jm.waitForSelector('.tabbar'); await toAll(jm);
  await jm.waitForFunction(() => !/오늘은/.test(document.querySelector('[data-act="ek-open"]').textContent), null, { timeout: 5000 });
  assert.strictEqual(keys('eatState/').length, 0, 'U8 자동 돌려놓기');
  // U13 어둡게 · U14 320px 넘침 없음
  await jm.click('[data-act="ek-open"]'); await jm.waitForSelector('.ek-jar');
  await setTheme(jm, 'cosmic-dream'); await jm.waitForTimeout(100); await shot(jm, 'eat-13-dark-jar');
  await setTheme(jm, 'soft-pastel');
  await jm.setViewportSize({ width: 320, height: 700 }); await jm.waitForTimeout(100);
  assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= 320), 'U14 통 320px');
  await shot(jm, 'eat-01-320');
  await jm.click('[data-act="ek-close"]'); await jm.waitForSelector('.all');
  assert.ok(await jm.evaluate(() => document.documentElement.scrollWidth <= 320), 'U14 전체 탭 320px');
  await shot(jm, 'all-320', true);
  await jm.setViewportSize({ width: 390, height: 844 });
  console.log('출출 쿠키 확인 끝 (U1~U14 · 꿍 알림 · 단짝 별점)');

  await browser.close();
  console.log('WEB_FEATURES_OK');
}

eval(harness + '\n;globalThis.__main = ' + main.toString() + ';');
globalThis.__main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
