// node --test tests/all.test.js — v47 「전체」 탭 · 머리말 정리
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../js/view.js');
const P = require('../js/view-plan.js');
const ALL = require('../js/view-all.js');
const AV = require('../js/view-avatar.js');
const CROP = require('../js/avatar-crop.js');

const ROOT = path.join(__dirname, '..');
const us = { left: { uid: 'j', name: '준민', slot: 'me', mine: true, img: '' }, right: { uid: 'd', name: '다진', slot: 'her', mine: false, img: 'data:image/jpeg;base64,AAAA' }, line1: '단짝이 된 지 412일', line2: '500일까지 D-88', off: false };
const base = { us, dday: '단짝이 된 지 412일', annivOff: false, map: { ready: false, count: 0, tiles: [] }, notify: '켜짐', theme: 'Soft Pastel', meName: '준민' };

test('아래 탭이 다섯 개, 마지막이 「전체」', () => {
  const html = P.tabbar('all');
  const tabs = [...html.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['routine', 'schedule', 'todo', 'look', 'all']);
  assert.match(html, /data-tab="all" aria-current="page"[^]*?<span>전체<\/span>/);
});

test('「전체」: 우리 둘 카드 · 단짝 기능 2칸 · 설정 3줄이 각 시트를 연다', () => {
  const html = ALL.tab(base);
  assert.match(html, /우리 둘[^]*준민[^]*data-act="open-anniv"[^]*단짝이 된 지 412일[^]*500일까지 D-88[^]*다진/, 'v51 박스: 왼쪽 준민 · 가운데 디데이 · 오른쪽 다진');
  assert.match(html, /data-act="all-map"[^]*단짝 지도/);
  assert.match(html, /data-act="all-diet"[^]*단짝 식탁[^]*목표 정하기/, 'D2: 준비 중 대신 목표 정하기');
  assert.match(ALL.tab(Object.assign({}, base, { diet: { ready: true, kcal: 2853.7, kind: 'bulk' } })), /하루 2,854kcal/);
  for (const act of ['open-notify', 'open-theme', 'open-account']) assert.match(html, new RegExp('data-act="' + act + '"'));
  assert.match(html, /알림<\/span><\/span><span class="arow__vl">켜짐/);
  assert.match(html, /Soft Pastel/);
  assert.match(html, /준민 님으로 접속/);
});

test('v51 「우리 둘」 박스: 내 동그라미만 사진 버튼 · 단짝은 사진 보기만 · 사진 없으면 사람 색 · 기념일 규칙이 없으면 디데이 버튼 없음', () => {
  const html = AV.box(us);
  assert.match(html, /data-act="ava-open" aria-label="준민 사진 올리기"/);
  assert.doesNotMatch(html, /다진 사진/, '단짝 동그라미는 버튼 아님');
  assert.match(html, /ubox__ph--me"><span class="ubox__ini"[^>]*>준</, '사진 없으면 사람 색 + 첫 글자');
  assert.match(html, /ubox__ph--her" style="background-image:url\(data:image\/jpeg;base64,AAAA\)"/, '단짝이 올린 사진');
  assert.doesNotMatch(AV.box(Object.assign({}, us, { right: Object.assign({}, us.right, { img: 'data:image/jpeg;base64,AA) ;background:url(http://x' }) })), /http:\/\/x/, '회귀(점검 AI): 이상한 글자는 사진으로 안 씀');
  assert.match(AV.box(Object.assign({}, us, { line1: '우리가 시작한 날을', line2: '정해 볼까요?' })), /정해 볼까요\?/);
  assert.doesNotMatch(AV.box(Object.assign({}, us, { off: true })), /data-act="open-anniv"/);
});

test('v51 사진 자리 고르기: 처음엔 칸을 꽉 채움 · 빈틈 없게 묶음 · 확대 4배까지 · 저장 범위', () => {
  const st = CROP.cover(1200, 800, 300);
  assert.equal(st.scale, 300 / 800); assert.equal(st.y, 0); assert.equal(st.x, (300 - 1200 * 300 / 800) / 2);
  const moved = CROP.clamp(Object.assign({}, st, { x: 50, y: -50 }), 1200, 800, 300);
  assert.equal(moved.x, 0, '오른쪽으로 끌어도 왼쪽 빈틈 없음'); assert.equal(moved.y, 0);
  const z = CROP.zoomAt(st, 10, 150, 150, 1200, 800, 300);
  assert.equal(z.scale, st.min * CROP.MAX_ZOOM, '4배까지');
  const src = CROP.source({ scale: 0.5, min: 0.25, x: -100, y: -50 }, 300);
  assert.deepEqual(src, { sx: 200, sy: 100, size: 600 });
  const r = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  assert.match(r, /match \/avatars\/\{uid\}[^]*img\.size\(\) <= 120000/); assert.equal(CROP.MAX_LEN, 120000, '앱 상한 = 규칙 상한');
});

test('단짝 지도 미리보기: 칠한 칸만 is-on (색은 --both 하나), 지도 준비 전엔 「준비 중」', () => {
  const html = ALL.mapPreview([0, 5]);
  assert.equal((html.match(/is-on/g) || []).length, 2);
  assert.equal((html.match(/amap__tile/g) || []).length, ALL.TILES.length);
  assert.match(ALL.tab(base), /단짝 지도[^]*준비 중/);
  assert.match(ALL.tab(Object.assign({}, base, { map: { ready: true, count: 12, tiles: [] } })), /함께 12곳/);
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  assert.match(css, /\.amap__tile\.is-on \{ background: var\(--both\); \}/);
});

test('계정 시트: 접속한 사람 · 로그아웃 · 닫기', () => {
  const html = ALL.accountSheet({ meName: '준민', email: 'jm@example.com' }, true);
  assert.match(html, /준민 님으로 접속 · jm@example\.com/);
  assert.match(html, /data-act="sign-out"/);
  assert.match(html, /data-act="close-account"/);
});

test('머리말: 접속 · 로그아웃 · 🔔 · 🎨 이 없고 칩만 남음, 「전체」 탭은 제목 「전체」', () => {
  const h = { date: '11월 18일 수요일', meName: '준민', canSignOut: true, bell: 'on', palette: 'Soft Pastel', dday: { text: '단짝이 된 지 412일' } };
  const html = V.page('ready', { header: h, empty: true }, '', { tab: 'todo', tabHtml: '' });
  const top = html.slice(0, html.indexOf('</header>'));
  assert.doesNotMatch(top, /sign-out|로그아웃|님으로 접속|open-notify|open-theme|🔔|🎨/);
  assert.match(top, /<h1 class="title">단짝꿍<\/h1>[^]*class="dday"[^]*단짝이 된 지 412일/);
  const all = V.page('ready', { header: Object.assign({}, h, { title: '전체', dday: null }), empty: true }, '', { tab: 'all', tabHtml: '' });
  assert.match(all, /<h1 class="title">전체<\/h1>/);
  assert.doesNotMatch(all.slice(0, all.indexOf('</header>')), /dday/);
});

test('v51: 머리말 디데이 칩 · 돌아보기 기념일 카드는 뺌 (「우리 둘」 박스 하나로)', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.match(app, /m\.header\.dday = null;/);
  const rv = fs.readFileSync(path.join(ROOT, 'js/view-review.js'), 'utf8');
  assert.match(rv, /var out = head\(m\);/);
});

test('화면 코드 어디에도 「사귄」이 남지 않음 (예전 저장값을 바꾸는 표만 예외)', () => {
  const files = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f).concat(['index.html', 'functions/index.js']);
  for (const f of files) {
    const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((l) => /사귄/.test(l) && !/OLD_LABELS/.test(l));
    assert.deepEqual(lines, [], f);
  }
});

test('「전체」 탭 파일이 앱 · 오프라인 목록에 들어 있음, ?tab=all 로 열림', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /js\/view-all\.js/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /'js\/view-all\.js'/);
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.equal((app.match(/tab=\(routine\|schedule\|todo\|look\|all\)/g) || []).length, 2, '주소 · 알림 링크 둘 다');
});

test('점검 AI 회귀: 규칙이 막히면 「정해 볼까요?」 없음 · 못 쓰는 설정 줄은 숨김 · 로그아웃은 닫기와 다른 모양', () => {
  const off = ALL.tab(Object.assign({}, base, { dday: '', annivOff: true }));
  assert.doesNotMatch(off, /정해 볼까요/);
  const bare = ALL.tab(Object.assign({}, base, { notify: '', theme: '' }));
  assert.doesNotMatch(bare, /open-notify|open-theme/);
  assert.match(bare, /open-account/);
  const sh = ALL.accountSheet({ meName: '준민' });
  assert.match(sh, /class="acct__out" data-act="sign-out"/);
  assert.doesNotMatch(sh, /class="close-btn[^"]*" data-act="sign-out"/);
});

test('점검 AI 회귀: 시작일이 미래면 박스에 「○○부터 · 시작까지 D-n」 · 불러오는 중엔 「정해 볼까요?」를 안 보임', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.match(app, /v && v\.future\) \{ line1 = v\.startText \+ '부터'; line2 = '시작까지 ' \+ v\.dText;/);
  assert.match(app, /else if \(!state\.coupleLoaded\)/);
});
