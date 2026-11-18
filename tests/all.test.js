// node --test tests/all.test.js — v47 「전체」 탭 · 머리말 정리
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const V = require('../js/view.js');
const P = require('../js/view-plan.js');
const ALL = require('../js/view-all.js');

const ROOT = path.join(__dirname, '..');
const base = { dday: '단짝이 된 지 412일', annivOff: false, map: { ready: false, count: 0, tiles: [] }, notify: '켜짐', theme: 'Soft Pastel', meName: '준민' };

test('아래 탭이 다섯 개, 마지막이 「전체」', () => {
  const html = P.tabbar('all');
  const tabs = [...html.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['routine', 'schedule', 'todo', 'look', 'all']);
  assert.match(html, /data-tab="all" aria-current="page"[^]*?<span>전체<\/span>/);
});

test('「전체」: 우리 둘 카드 · 우리 기능 2칸 · 설정 3줄이 각 시트를 연다', () => {
  const html = ALL.tab(base);
  assert.match(html, /우리 둘[^]*단짝이 된 지 412일[^]*data-act="open-anniv"/);
  assert.match(html, /data-act="all-map"[^]*우리 지도/);
  assert.match(html, /data-act="all-diet"[^]*운동·식단[^]*준비 중/);
  for (const act of ['open-notify', 'open-theme', 'open-account']) assert.match(html, new RegExp('data-act="' + act + '"'));
  assert.match(html, /알림<\/span><\/span><span class="arow__vl">켜짐/);
  assert.match(html, /Soft Pastel/);
  assert.match(html, /준민 님으로 접속/);
});

test('「전체」: 기념일을 아직 안 정했으면 안내 문구, 규칙이 없으면 기념일 버튼 숨김', () => {
  assert.match(ALL.tab(Object.assign({}, base, { dday: '' })), /우리가 시작한 날을 정해 볼까요\?/);
  assert.doesNotMatch(ALL.tab(Object.assign({}, base, { annivOff: true })), /data-act="open-anniv"/);
});

test('우리 지도 미리보기: 칠한 칸만 is-on (색은 --both 하나), 지도 준비 전엔 「준비 중」', () => {
  const html = ALL.mapPreview([0, 5]);
  assert.equal((html.match(/is-on/g) || []).length, 2);
  assert.equal((html.match(/amap__tile/g) || []).length, ALL.TILES.length);
  assert.match(ALL.tab(base), /우리 지도[^]*준비 중/);
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

test('점검 AI 회귀: 시작일이 미래면 「○○부터 시작해요 · D-n」 (app.js allModel)', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.match(app, /v\.future \? v\.startText \+ '부터 시작해요 · ' \+ v\.dText/);
});
