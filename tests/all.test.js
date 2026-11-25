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
  assert.deepEqual(tabs, ['routine', 'schedule', 'focus', 'todo', 'all'], 'FT1: 루틴 · 시간표 · 집중 · 할 일 · 전체');
  assert.match(html, /data-tab="all" aria-current="page"[^]*?<span>전체<\/span>/);
  assert.match(P.tabbar('look'), /data-tab="all" aria-current="page"/, 'FT1: 돌아보기 화면에서는 「전체」가 켜짐');
  assert.doesNotMatch(P.tabbar('look'), /돌아보기/);
  assert.match(P.tabbar('focus'), /data-tab="focus" aria-current="page"[^]*?<span>집중<\/span>/);
});

test('FT1 전체 탭: 「우리 둘」 바로 아래 돌아보기 카드 → 단짝 기능 → 설정, [주] [달] [결산] · 결산 「새로」 · 연말 문답 한 줄', () => {
  const look = { cells: ['full', 's2', 'none', 'future', 'future', 'future', 'future'], todayIdx: 2, allDays: 1, line: '12월 1일 아침에 11월 결산이 나와요 · 연말 문답도 여기서 열려요', fresh: null, yq: null };
  const html = ALL.tab(Object.assign({}, base, { look }));
  assert.match(html, /우리 둘[^]*<h2 class="asec">돌아보기<\/h2>[^]*단짝 기능[^]*설정/);
  for (const v of ['week', 'month', 'recap']) assert.match(html, new RegExp('data-act="open-look" data-v="' + v + '"'));
  assert.match(html, /모두 해낸 날 1일/);
  assert.match(html, /alook__c lv-full/); assert.match(html, /alook__c lv-s2/); assert.match(html, /alook__c lv-none alook__c--today/);
  assert.match(html, /12월 1일 아침에 11월 결산이 나와요/);
  assert.doesNotMatch(html, /alook__new/);
  const fresh = ALL.tab(Object.assign({}, base, { look: Object.assign({}, look, { fresh: { key: '2026-11', text: '11월 결산이 나왔어요' }, line: null, yq: { act: 'yq-open', year: 2026 } }) }));
  assert.match(fresh, /data-v="recap">결산<span class="alook__new">새로<\/span>/);
  assert.match(fresh, /data-act="rc-open" data-v="2026-11">11월 결산이 나왔어요 ›/);
  assert.match(fresh, /data-act="yq-open" data-v="2026">[^<]*<span aria-hidden="true">💌<\/span> 짝꿍과의 연말 문답 ›/);
});

test('FT1 돌아보기 화면 머리말: ‹ 뒤로 + 「돌아보기」, 날짜 · 칩 없음', () => {
  const html = V.page('ready', { header: { date: '11월 25일 수요일', back: { title: '돌아보기', label: '전체로 돌아가기' }, meName: '준민' }, empty: true }, '', { tab: 'look', tabHtml: '<div class="rv"></div>' });
  assert.match(html, /<header class="top top--back"><button type="button" class="top__back" data-act="look-back" aria-label="전체로 돌아가기">/);
  assert.match(html, /<h1 class="title title--back">돌아보기<\/h1>/);
  assert.doesNotMatch(html, /11월 25일 수요일/);
});

test('「전체」: 우리 둘 카드 · 단짝 기능 2×2(지도 · 교환 쪽지 · 출출 쿠키 · 영수증) · 설정 3줄이 각 시트를 연다', () => {
  require('../js/question-text.js'); require('../js/view-question.js');
  const html = ALL.tab(Object.assign({}, base, { question: { text: '우리 둘만 아는 말이 있다면요?', state: 'theirs', meSlot: 'me', herSlot: 'her' } }));
  assert.match(html, /우리 둘[^]*준민[^]*다진[^]*data-act="open-anniv"[^]*단짝이 된 지 412일[^]*500일까지 D-88/, 'v52 하트 잇기: 왼쪽 준민 · 오른쪽 다진 · 아래 디데이');
  assert.match(html, /data-act="all-map"[^]*단짝 지도/);
  assert.doesNotMatch(html, /all-diet|단짝 식탁/, '11-20 단짝 식탁 폐기 — 입구 없음');
  assert.match(html, /data-act="q-open"[^]*교환 쪽지[^]*우리 둘만 아는 말이 있다면요\?[^]*단짝이 남겼어요/, '식탁 자리 = 교환 쪽지 입구 E1');
  for (const act of ['open-notify', 'open-theme', 'open-account']) assert.match(html, new RegExp('data-act="' + act + '"'));
  assert.match(html, /알림<\/span><\/span><span class="arow__vl">켜짐/);
  assert.match(html, /Soft Pastel/);
  assert.match(html, /준민 님으로 접속/);
});

test('v51 「우리 둘」 박스: 내 동그라미만 사진 버튼 · 단짝은 사진 보기만 · 사진 없으면 사람 색 · 기념일 규칙이 없으면 디데이 버튼 없음', () => {
  const html = AV.box(us);
  assert.match(html, /data-act="ava-open" aria-label="준민 사진 올리기"/);
  assert.doesNotMatch(html, /data-act="ava-open"[^>]*다진/, '단짝 동그라미는 바꾸기 버튼 아님');
  assert.match(html, /data-act="ava-view"[^>]*다진 사진 크게 보기/, 'v52: 단짝 사진은 크게 보기');
  assert.doesNotMatch(AV.box(Object.assign({}, us, { right: Object.assign({}, us.right, { img: '' }) })), /다진 사진/, '단짝 사진이 없으면 버튼 아님');
  assert.match(html, /ubox__ph--me"><span class="ubox__ini"[^>]*>준</, '사진 없으면 사람 색 + 첫 글자');
  assert.match(html, /ubox__ph--her" style="background-image:url\(data:image\/jpeg;base64,AAAA\)"/, '단짝이 올린 사진');
  assert.doesNotMatch(AV.box(Object.assign({}, us, { right: Object.assign({}, us.right, { img: 'data:image/jpeg;base64,AA) ;background:url(http://x' }) })), /http:\/\/x/, '회귀(점검 AI): 이상한 글자는 사진으로 안 씀');
  assert.match(AV.box(Object.assign({}, us, { line1: '우리가 시작한 날을', line2: '정해 볼까요?' })), /정해 볼까요\?/);
  assert.doesNotMatch(AV.box(Object.assign({}, us, { off: true })), /data-act="open-anniv"/);
});

test('v52 박스 모양 3가지: 글자는 관계 이름 그대로 · 사진 버튼은 모든 모양에서 같음 · 고르기 버튼', () => {
  const v = Object.assign({}, us, { line1: '연애한 지 465일', line2: '500일까지 D-35', count: 465, label: '연애한 지', countText: '465', next: { name: '500일', d: 'D-35' }, todayName: null, prog: { from: '400일', to: '500일', pct: 65 } });
  const h = AV.box(Object.assign({}, v, { style: 'heart' }));
  assert.match(h, /ubox--heart[^]*ubox__heart[^]*ubox__lab">연애한 지<[^]*ubox__big">465<small>일[^]*width:65%[^]*400일[^]*500일까지 D-35/);
  const t = AV.box(Object.assign({}, v, { style: 'ticket' }));
  assert.match(t, /ubox--ticket[^]*data-act="open-anniv"[^]*연애한 지[^]*465[^]*일째[^]*준민 &amp; 다진[^]*다음 기념일[^]*500일[^]*D-35/);
  const p = AV.box(Object.assign({}, v, { style: 'polaroid' }));
  assert.match(p, /ubox--polaroid[^]*ubox__pics[^]*준민[^]*다진[^]*연애한 지 465일[^]*500일까지 D-35/);
  const v2 = Object.assign({}, v, { past: [{ name: '400일' }, { name: '1주년' }, { name: '300일' }], nexts: [{ name: '500일', d: 'D-35' }, { name: '600일', d: 'D-135' }, { name: '2주년', d: 'D-246' }] });
  const o = AV.box(Object.assign({}, v2, { style: 'overlap' }));
  assert.match(o, /ubox--overlap[^]*ubox__venn[^]*ubox__vheart[^]*준민 · 다진[^]*연애한 지 465일/);
  assert.deepEqual([...o.matchAll(/<li class="([^"]*)"><span class="ubox__dot"[^>]*><\/span><span class="ubox__mn">([^<]+)/g)].map((m) => [m[2], m[1].includes('is-done')]),
    [['300일', true], ['1주년', true], ['400일', true], ['500일', false], ['600일', false], ['2주년', false]], '기념일 길: 지난 것(오래된 것부터) → 다음 것, 6개');
  const bd = AV.box(Object.assign({}, v2, { style: 'badge' }));
  assert.match(bd, /ubox--badge[^]*ubox__amp[^]*연애한 지 465일[^]*1주년[^]*달성[^]*400일[^]*달성[^]*500일[^]*D-35/, '단짝 배지: 지난 2개 + 다음 1개');
  assert.match(AV.box(Object.assign({}, v2, { style: 'badge', todayName: '500일', nexts: [{ name: '600일', d: 'D-100' }] })), /500일<\/span><span class="ubox__bst">오늘/);
  assert.match(AV.box(Object.assign({}, us, { style: 'overlap', line1: '우리가 시작한 날을', line2: '정해 볼까요?' })), /정해 볼까요\?/);
  assert.doesNotMatch(AV.box(Object.assign({}, us, { style: 'badge', line1: '우리가 시작한 날을', line2: '정해 볼까요?' })), /ubox__badges/, '날짜 없으면 배지 없음');
  for (const html of [h, t, p, o, bd]) { assert.match(html, /data-act="ava-open"/); assert.match(html, /data-act="ava-view" data-v="d"/); }
  assert.match(AV.box(Object.assign({}, v, { style: 'nope' })), /ubox--heart/, '모르는 모양은 하트 잇기');
  assert.match(AV.box(Object.assign({}, us, { style: 'ticket', line1: '우리가 시작한 날을', line2: '정해 볼까요?' })), /정해 볼까요\?/, '날짜 없을 때도 티켓에 안내');
  assert.match(AV.box(Object.assign({}, v, { style: 'ticket', next: null, todayName: '1주년' })), /오늘은[^]*1주년/);
  assert.doesNotMatch(AV.box(Object.assign({}, v, { style: 'heart', prog: { from: 'a', to: 'b', pct: '5%;x' } })), /5%;x/, '막대 값은 숫자만');
  const pk = AV.picker({ current: 'ticket', boxes: [{ id: 'heart', name: '하트 잇기' }, { id: 'ticket', name: '단짝 티켓' }, { id: 'polaroid', name: '폴라로이드' }], busy: false });
  assert.match(pk, /data-act="anniv-box" data-v="ticket" aria-pressed="true"/); assert.match(pk, /data-v="heart" aria-pressed="false"/);
  assert.doesNotMatch(AV.picker({ current: 'heart', boxes: [{ id: 'heart', name: '하트 잇기' }] }), / disabled/, '회귀(점검 AI): 저장 중에도 안 막음 (오프라인이면 계속 막힘)');
  assert.match(AV.box(Object.assign({}, v, { style: 'ticket', todayName: '500일', next: { name: '600일', d: 'D-100' } })), /오늘은[^]*500일[^]*🎉/, '회귀(점검 AI): 기념일 당일엔 다음 것이 있어도 오늘 축하');
  assert.match(AV.box(Object.assign({}, v, { style: 'ticket', countText: '27,456' })), /ubox__big ubox__big--long">27,456/, '긴 숫자는 작게');
  const css = fs.readFileSync(path.join(ROOT, 'styles', 'app.css'), 'utf8');
  assert.doesNotMatch(css, /\.ubox__(stub|amp) \{[^}]*--secondary/, '회귀(점검 AI): 글자 바탕에 --secondary 쓰지 않음 (chocolate-noir 대비)');
});

test('v52 사진 크게 보기: 사진 있는 동그라미는 누구 것이든 ava-view · 단짝 사진엔 바꾸기 없음 · 이상한 글자는 안 씀 · 512px 부터', () => {
  const withMine = Object.assign({}, us, { left: Object.assign({}, us.left, { uid: 'u1', img: 'data:image/jpeg;base64,BBBB' }), right: Object.assign({}, us.right, { uid: 'u2' }) });
  const html = AV.box(withMine);
  assert.match(html, /data-act="ava-view" data-v="u1" aria-label="준민 사진 크게 보기"/);
  assert.match(html, /data-act="ava-view" data-v="u2" aria-label="다진 사진 크게 보기"/);
  assert.doesNotMatch(html, /ava-open/, '사진이 있으면 바로 시트 대신 크게 보기');
  const mine = AV.viewer({ name: '준민', img: 'data:image/jpeg;base64,BBBB', mine: true });
  assert.match(mine, /class="aview__img" src="data:image\/jpeg;base64,BBBB"/); assert.match(mine, /data-act="ava-view-edit"/);
  assert.doesNotMatch(AV.viewer({ name: '다진', img: 'data:image/jpeg;base64,BBBB', mine: false }), /ava-view-edit/);
  assert.doesNotMatch(AV.viewer({ name: '다진', img: 'javascript:x', mine: false }), /<img/);
  assert.deepEqual(CROP.SIZES, [512, 384, 256]); assert.equal(CROP.OUT, 512);
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
  assert.match(app, /tab=\(routine\|schedule\|focus\|todo\|look\|all\)/, 'FT1: 집중 탭 · 예전 ?tab=look 도 받음');
  assert.equal((app.match(/lookLink\(/g) || []).length, 3, '주소 · 알림 링크 둘 다 같은 함수로 (정의 1 + 쓰는 곳 2)');
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

test('v53 설정 줄 이름은 「테마」 · 박스 모양은 서버에 저장 안 함', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'view-all.js'), 'utf8');
  assert.ok(src.includes("row('open-theme', 'palette', '테마', ''"));
  assert.ok(!src.includes('테마·사람 색'));
  const store = fs.readFileSync(path.join(ROOT, 'js', 'store.js'), 'utf8');
  assert.ok(!/saveBox/.test(store), '박스 모양은 각자 기기에');
  const app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  assert.ok(!/saveBox|'danjjakkung\.box'/.test(app), '회귀(점검 AI): v52 가 자동으로 써 둔 키는 안 씀 · 서버 저장 없음');
  assert.match(app, /boxMem = id/, '저장 못 하는 브라우저에서도 이번엔 바뀜');
});
