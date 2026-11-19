// node --test tests/places.test.js — v48 단짝 지도 M2 (값 계산 · 확대 · 지도 데이터 · 규칙)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../js/places.js');
const Z = require('../js/map-zoom.js');
const VM = require('../js/view-map.js');
const ALL = require('../js/view-all.js');

const ROOT = path.join(__dirname, '..');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/kr-map.json'), 'utf8'));
const v = (date, extra) => Object.assign({ id: date, date, note: '' }, extra || {});

test('지도 데이터: 시·군·구 230곳 · 시·도 16개 · 줄인 크기 · 지역마다 가운데 점', () => {
  assert.equal(MAP.regions.length, 230);
  assert.equal(MAP.groups.length, 16);
  assert.ok(MAP.regions.every((r) => /^\d{5}$/.test(r.c) && r.d.length > 0 && Number.isInteger(r.x) && Number.isInteger(r.y) && r.c.slice(0, 2) === r.s));
  assert.equal(new Set(MAP.regions.map((r) => r.c)).size, 230, '코드 겹침 없음');
  assert.ok(fs.statSync(path.join(ROOT, 'data/kr-map.json')).size < 200 * 1024, '200KB 아래');
  assert.ok(!/\d\.\d/.test(MAP.regions[0].d), '정수 좌표');
  assert.match(MAP.source, /CC BY 4\.0/);
});

test('칠하기: 다녀온 곳 v · 가고 싶은 곳 w · 둘 다 vw · 없으면 빈칸', () => {
  assert.equal(P.paint(null), '');
  assert.equal(P.paint(P.fromDoc('52190', { visits: [v('2025-08-15')], wishRank: null })), 'v');
  assert.equal(P.paint(P.fromDoc('52190', { visits: [], wishRank: 1000 })), 'w');
  assert.equal(P.paint(P.fromDoc('52190', { visits: [v('2025-08-15')], wishRank: 1000 })), 'vw');
  assert.equal(P.paint(P.fromDoc('52190', { visits: [], wishRank: null })), '');
  const pl = P.fromDocs({ 52190: { visits: [v('2025-08-15')], wishRank: 2000 }, 50110: { visits: [], wishRank: 1000 }, bad: { visits: [] } });
  assert.deepEqual(Object.keys(pl).sort(), ['50110', '52190'], '이상한 코드는 뺌');
  assert.deepEqual(P.counts(pl), { visited: 1, wished: 2 });
  assert.deepEqual(P.visitedSidos(pl), ['52']);
});

test('다녀온 날: 단짝이 된 날보다 이르면 · 미래면 · 비었으면 막힘', () => {
  assert.equal(P.validateVisit('2025-08-15', '2025-07-20', '2026-10-27'), '');
  assert.match(P.validateVisit('2025-07-19', '2025-07-20', '2026-10-27'), /단짝이 된 날/);
  assert.equal(P.validateVisit('2025-07-20', '2025-07-20', '2026-10-27'), '', '단짝이 된 날 당일은 됨');
  assert.match(P.validateVisit('2026-10-28', '2025-07-20', '2026-10-27'), /지난 날/);
  assert.match(P.validateVisit('', '2025-07-20', '2026-10-27'), /골라/);
  assert.equal(P.validateVisit('2001-01-01', null, '2026-10-27'), '', '기념일을 아직 안 정했으면 막지 않음');
});

test('방문 더하기: 날짜 순(가장 이른 날이 맨 앞 — 규칙이 맨 앞을 검사) · 100개까지', () => {
  assert.deepEqual(P.withVisit([v('2026-01-01')], v('2025-12-24')).map((x) => x.date), ['2025-12-24', '2026-01-01']);
  const many = Array.from({ length: 100 }, (_, i) => v('2025-09-' + String((i % 28) + 1).padStart(2, '0')));
  const out = P.withVisit(many, v('2026-10-01'));
  assert.equal(out.length, 100); assert.equal(out[99].date, '2026-10-01');
  assert.equal(P.cleanNote('  광한루   산책 '), '광한루 산책');
  assert.equal(P.cleanNote('가'.repeat(150)).length, 100);
});

test('지역 이름 · 찾기', () => {
  assert.equal(P.fullName(MAP, '52190'), '전북 남원시');
  assert.equal(P.fullName(MAP, '26350'), '부산 해운대구');
  assert.equal(P.search(MAP, '해운대')[0].name, '부산 해운대구');
  assert.ok(P.search(MAP, '전북').some((r) => r.name === '전북 남원시'), '시·도 이름으로도');
  assert.ok(P.search(MAP, '중구').length >= 5, '같은 이름 여러 곳');
  assert.deepEqual(P.search(MAP, ''), []);
  assert.equal(P.dateText('2026-10-01', '2026-10-27'), '10월 1일');
  assert.equal(P.dateText('2025-12-24', '2026-10-27'), '2025년 12월 24일');
});

test('확대 · 끌기: 비율 그대로 · 가장 작게 = 처음 자리 · 기준점 제자리 · 지역으로', () => {
  const H = VM.HOME;
  assert.deepEqual(Z.zoomAt(H, 0.5, 0.5, 0.5, H), H, '처음보다 작게는 안 됨');
  const z = Z.zoomAt(H, 2, 0.25, 0.75, H);
  assert.ok(Math.abs(z.h / z.w - H.h / H.w) < 1e-9, '비율 그대로');
  assert.ok(Math.abs((z.x + z.w * 0.25) - (H.x + H.w * 0.25)) < 1e-6 && Math.abs((z.y + z.h * 0.75) - (H.y + H.h * 0.75)) < 1e-6, '기준점 제자리');
  assert.equal(Z.zoomAt(H, 1000, 0.5, 0.5, H).w, Z.MIN_W, '가장 크게');
  const f = Z.focusOn(H, 500, 700, 360, H);
  assert.equal(f.w, 360); assert.ok(Math.abs(f.x + f.w / 2 - 500) < 1e-6);
  const p = Z.panBy(z, 10000, 0, 350, H);
  assert.ok(p.x + p.w / 2 >= H.x - 1e-6, '끌어도 가운데가 지도 밖으로 안 나감');
});

test('지도 SVG: 지역마다 data-code · 칠한 칸 class · 고른 곳 테두리 · 순위 숫자 없음', () => {
  const html = VM.mapSvg(MAP, { 52190: 'vw', 50110: 'w' }, '52190', VM.HOME, '단짝 지도');
  assert.equal((html.match(/class="rg/g) || []).length, 230);
  assert.match(html, /class="rg vw" data-code="52190"/);
  assert.match(html, /class="rg w" data-code="50110"/);
  assert.match(html, /<path class="sel"/);
  assert.doesNotMatch(html.replace(/ d="[^"]*"/g, '').replace(/viewBox="[^"]*"/, '').replace(/data-code="\d+"/g, '').replace(/<pattern[^]*?<\/pattern>/g, '').replace(/ (x|y)="\d+"/g, ''), />[^<]*\d[^<]*</, '글자 안에 숫자 없음');
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  assert.match(css, /\.km \.rg\.v \{ fill: var\(--both\); \}/);
  assert.match(css, /\.km \.rg\.w \{ fill: url\(#kmhatch\); \}/);
  assert.match(css, /\.km \.rg\.vw \{ fill: url\(#kmhatch2\); \}/);
  assert.match(html, /id="kmhatch2"[^]*?var\(--both\)[^]*?var\(--accent\)/, '색 위 빗금 = --both 바탕 + --accent');
});

test('안 간 곳 시트 · 함께 다녀왔어요 폼: 단짝이 된 날 안내 · 날짜 min', () => {
  const base = { code: '52190', name: '전북 남원시', place: null, startKey: '2025-07-20', startText: '2025년 7월 20일', todayKey: '2026-10-27', noteMax: 100, visitsView: [], lastText: '' };
  const view = VM.sheet(Object.assign({ mode: 'view' }, base));
  assert.match(view, /아직 함께 가 보지 않은 곳/);
  assert.match(view, /data-act="map-visit"[^]*함께 다녀왔어요[^]*data-act="map-wish"[^]*가고 싶은 곳에 담기/);
  assert.match(view, /단짝이 된 날\(2025년 7월 20일\)부터/);
  const form = VM.sheet(Object.assign({ mode: 'record', partnerName: '다진', hasPartner: true, form: { vid: null, nth: 1, date: '2026-10-27', stars: 0, note: '', saving: false, error: '' } }, base));
  assert.match(form, /전북 남원시 · 함께 다녀왔어요/, '안 간 곳 · 가고 싶은 곳의 「함께 다녀왔어요」도 같은 시트');
  assert.match(form, /id="mp-date"[^>]*min="2025-07-20"[^>]*max="2026-10-27"/);
});

test('「전체」 카드 미리보기: 함께 다녀온 시·도 칸만 칠함', () => {
  assert.equal(ALL.TILE_SIDO.length, ALL.TILES.length);
  const t = ALL.tilesFor(['50']);
  assert.deepEqual(t, [ALL.TILES.length - 1], '제주 = 맨 아래 칸');
  assert.ok(ALL.tilesFor(['52']).length > 0 && ALL.tilesFor(['11', '26', '36']).length === 3);
});

test('규칙: places 는 members 만 · 지우기 없음 · 기록은 내 칸만(방문을 지울 땐 예외) · 옛 칸 안 받음 · 가장 이른 방문 ≥ 단짝이 된 날', () => {
  const r = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const blk = r.slice(r.indexOf('function coupleStart'), r.indexOf('// ── 알림 ──'));
  assert.match(blk, /match \/places\/\{code\}/);
  assert.match(blk, /allow read: if isMember\(\);/);
  assert.match(blk, /allow delete: if false;/);
  assert.match(blk, /n\.diff\(o\)\.affectedKeys\(\)\.hasOnly\(\[request\.auth\.uid\]\) \|\| vs\.size\(\) < ovs\.size\(\)/);
  assert.match(blk, /vs\[0\]\.date >= coupleStart\(\)/);
  assert.match(blk, /hasOnly\(\['code', 'wishRank', 'wishNote', 'wishedAt', 'wishedBy', 'visits', 'entries', 'updatedAt', 'updatedBy'\]\)/, 'stars 칸 없음');
  assert.match(blk, /v\.keys\(\)\.hasOnly\(\['id', 'date', 'createdAt', 'createdBy'\]\)/, 'visits[].note 없음');
  assert.match(blk, /e\.stars is int && e\.stars >= 1 && e\.stars <= 5/);
  assert.match(blk, /code\.matches\('\^\[0-9\]\{5\}\$'\)/);
});

test('지도 파일은 처음 열 때만 받음 (오프라인 목록에 없고, 화면 코드는 fetch)', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /kr-map\.json/);
  for (const f of ['js/places.js', 'js/map-zoom.js', 'js/view-map.js']) assert.match(sw, new RegExp("'" + f.replace('.', '\\.') + "'"));
  assert.match(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8'), /fetch\('data\/kr-map\.json'\)/);
});

test('점검 AI 회귀: 찾기 결과만 따로 그림 · 단짝이 된 날을 안 정했으면 먼저 정하게 · 규칙은 맨 앞 방문이 그대로면 통과', () => {
  const r = VM.findResults({ q: '해운대', results: [{ code: '26350', name: '부산 해운대구', been: true }] });
  assert.match(r, /data-act="map-pick" data-v="26350"[^]*함께 다녀옴/);
  assert.doesNotMatch(r, /mp-q/, '입력칸은 결과 안에 없음');
  assert.match(VM.findSheet({ q: '', results: [] }), /id="mp-q"[^]*id="mp-results"/);
  const need = VM.sheet({ code: '52110', name: '전북 전주시', place: null, mode: 'needstart' });
  assert.match(need, /먼저 단짝이 된 날을 정해 주세요[^]*data-act="open-anniv"/);
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  assert.match(rules, /vs\[0\] == o\.visits\[0\]/);
  assert.match(VM.screen({ status: 'ready', seg: 'map', counts: { visited: 0, wished: 0 }, paint: {}, map: MAP }), /id="km-slot"/, '지도는 자리만, app.js 가 한 번 만든 svg 를 붙임');
});

test('회귀(v48 배포 실패): 규칙 함수 이름이 겹치지 않음 · 식 안에 // 줄 주석 없음', () => {
  const r = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const names = [...r.matchAll(/function ([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, [], '겹치는 함수 이름: ' + dup.join(', '));
  // 한 줄이 && · || 로 이어지는 식 한가운데에 주석 줄이 끼지 않게 (컴파일러마다 다르게 볼 수 있어서)
  const lines = r.split('\n');
  lines.forEach((l, i) => { if (/^\s*\/\//.test(l) && i > 0 && /(&&|\|\||\()\s*$/.test(lines[i - 1])) assert.fail('식 안 주석: ' + (i + 1) + '번째 줄'); });
});

test('v49 → v54 방문 지우기: 그것만 빠짐 · 두 사람 기록도 함께 · 마지막 방문이면 칠하기 빠짐', () => {
  const vs = [v('2025-08-15', { id: 'a' }), v('2026-10-01', { id: 'b' })];
  assert.deepEqual(P.withoutVisit(vs, 'a').map((x) => x.id), ['b']);
  assert.deepEqual(P.withoutVisit(vs, 'zz').length, 2);
  const cur = { visits: [{ id: 'a', date: '2025-08-15' }, { id: 'b', date: '2026-10-01' }], entries: { j: { a: { stars: 5, note: '', at: 't' }, b: { stars: 4, note: 'x', at: 't' } }, d: { b: { stars: 3, note: '', at: 't' } } } };
  const next = P.removeVisit(cur, 'b');
  assert.deepEqual(next.visits.map((x) => x.id), ['a']);
  assert.deepEqual(next.entries, { j: { a: { stars: 5, note: '', at: 't' } } }, '단짝 칸이 비면 칸째 빠짐');
  const gone = P.removeVisit(next, 'a');
  assert.deepEqual(gone.visits, []); assert.deepEqual(gone.entries, {});
  assert.equal(P.paint(P.fromDoc('52190', gone)), '', '방문이 0개면 지도 색도 빠짐');
});

test('M3 순위 키: 끼워 넣기 = 앞뒤 중간값 · 맨 앞/끝 = ±1000 · 좁으면 다시 매기기 · 같은 키면 코드 순', () => {
  const pl = P.fromDocs({ 11110: { wishRank: 1000 }, 11140: { wishRank: 2000 }, 11170: { wishRank: 3000 }, 11200: { wishRank: null } });
  const l = P.wishList(pl);
  assert.deepEqual(l.map((x) => x.code), ['11110', '11140', '11170'], '빼 둔 곳은 없음');
  assert.deepEqual(P.keyAt(l, 2), { key: 2500, rebalance: false }, '3위에 넣기');
  assert.equal(P.keyAt(l, 0).key, 0); assert.equal(P.keyAt(l, 3).key, 4000); assert.equal(P.keyAt([], 0).key, 1000);
  const tight = [{ code: 'a', wishRank: 1000 }, { code: 'b', wishRank: 1000 + 1e-9 }];
  assert.equal(P.keyAt(tight, 1).rebalance, true, '간격이 너무 좁으면 다시 매김');
  assert.deepEqual(P.rebalance(['x', 'y', 'z']), { x: 1000, y: 2000, z: 3000 });
  const tie = P.wishList(P.fromDocs({ 22222: { wishRank: 1500 }, 11111: { wishRank: 1500 } }));
  assert.deepEqual(tie.map((x) => x.code), ['11111', '22222'], '두 기기가 같은 키를 넣어도 번호가 겹치지 않음');
});

const ent = (st, note) => ({ stars: st === undefined ? null : st, note: note || '', at: '2026-11-19T00:00:00Z' });
test('v54 평균: 모든 별점의 단순 평균 · 사람별 평균 · 메모만 남긴 기록은 빠짐', () => {
  const vs = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, date: '2026-0' + (i + 3) + '-01' }));
  const p = P.fromDoc('11110', { visits: vs, entries: {
    j: { a: ent(5), b: ent(4), c: ent(3), d: ent(4) },
    d: { a: ent(5), b: ent(5), c: ent(3), d: ent(null, '붕어빵') } } });
  assert.equal(P.avgText(P.avgStars(p)), '4.1', '5,4,3,4,5,5,3 → 4.1');
  assert.deepEqual(P.personStars(p, 'j'), { avg: 4, n: 4 });
  assert.deepEqual(P.personStars(p, 'd'), { avg: 13 / 3, n: 3 }, '메모만 남긴 기록은 평균 · 횟수에서 빠짐');
  assert.deepEqual(P.entryOf(p, 'd', 'd'), { stars: null, note: '붕어빵' });
  const ghost = P.fromDoc('11110', { visits: [vs[0]], entries: { j: { a: ent(2), zz: ent(5) } } });
  assert.equal(P.avgStars(ghost), 2, '지운 방문의 기록은 평균에 안 들어감');
});

test('v54 다녀온 곳 정렬: 평균 → 횟수 → 최근, 별점이 하나도 없는 곳은 맨 뒤', () => {
  const one = (id, date, j, d) => ({ visits: [{ id, date }], entries: Object.assign({}, j ? { j: { [id]: ent(j) } } : {}, d ? { d: { [id]: ent(d) } } : {}) });
  const pl = P.fromDocs({
    11110: one('a', '2026-01-01', 4, 5),
    11140: { visits: [{ id: 'b1', date: '2025-09-01' }, { id: 'b2', date: '2026-02-01' }], entries: { j: { b1: ent(4) }, d: { b2: ent(5) } } },
    11170: one('c', '2026-03-01', 5),
    11200: { visits: [{ id: 'e', date: '2026-10-01' }], entries: { j: { e: ent(null, '메모만') } } },
    11230: one('f', '2026-05-01', 4, 5)
  });
  assert.deepEqual(P.visitedList(pl, 'stars').map((x) => x.code), ['11170', '11140', '11230', '11110', '11200'], '5 > 4.5(2번) > 4.5(최근) > 4.5 > 없음');
  assert.deepEqual(P.visitedList(pl, 'recent').map((x) => x.code), ['11200', '11230', '11170', '11140', '11110']);
  assert.equal(P.visitedList(pl, 'many')[0].code, '11140');
  assert.equal(P.starRank(pl, '11170'), 1); assert.equal(P.starRank(pl, '11200'), null);
  assert.equal(P.starFill(4.5), 5); assert.equal(P.starFill(4.4), 4); assert.equal(P.starFill(null), 0);
  assert.equal(P.avgText(4.5), '4.5'); assert.equal(P.avgText(4), '4');
});

test('v54 저장 모양: 새 방문 + 내 기록 · 내 칸만 고침 · 비우면 칸을 지움 · 100개 넘으면 오래된 기록도 같이 빠짐', () => {
  const cur = { code: '11110', visits: [{ id: 'a', date: '2026-01-01', createdBy: 'd' }], entries: { d: { a: ent(4) } } };
  const n1 = P.addVisit(cur, { id: 'b', date: '2026-11-16', createdAt: 't', createdBy: 'j' }, 'j', P.cleanEntry(4, '  단풍은   졌지만 ', 't'));
  assert.deepEqual(n1.visits.map((x) => x.id), ['a', 'b']);
  assert.deepEqual(n1.entries.j, { b: { stars: 4, note: '단풍은 졌지만', at: 't' } });
  assert.deepEqual(n1.entries.d, cur.entries.d, '단짝 칸은 그대로');
  assert.equal(P.cleanEntry(null, ' ', 't'), null, '별점도 메모도 없으면 기록 없음');
  assert.deepEqual(P.cleanEntry(0, '메모', 't'), { stars: null, note: '메모', at: 't' }, '메모만 남겨도 됨');
  const n2 = P.setEntry(n1, 'j', 'b', null);
  assert.equal(n2.entries.j, undefined, '내 기록을 다 비우면 내 칸째 빠짐');
  assert.deepEqual(n2.entries.d, cur.entries.d);
  const many = { visits: Array.from({ length: 100 }, (_, i) => ({ id: 'v' + i, date: '2025-09-' + String((i % 28) + 1).padStart(2, '0') })), entries: {} };
  many.entries.d = {}; many.visits.forEach((x) => { many.entries.d[x.id] = ent(3); });
  const n3 = P.addVisit(many, { id: 'new', date: '2026-10-01' }, 'j', null);
  assert.equal(n3.visits.length, 100);
  assert.equal(Object.keys(n3.entries.d).length, 99, '빠진 방문의 기록도 함께 빠짐');
  assert.ok(n3.visits.every((x) => !('note' in x)) && !('stars' in n3));
});

test('v54 옮기기: 옛 지역 별점 → 그 사람의 가장 최근 방문 · 옛 메모 → 만든 사람 칸 · 옛 칸은 지움', () => {
  const old = { code: '52190', wishRank: null, stars: { j: 5, d: 3, bad: 9 },
    visits: [{ id: 'a', date: '2025-08-15', note: '광한루', createdBy: 'd', createdAt: 't1' }, { id: 'b', date: '2026-10-01', note: '', createdBy: 'j', createdAt: 't2' }] };
  assert.equal(P.needsFold(old), true);
  const f = P.legacyFold(old);
  assert.equal(P.needsFold(f), false);
  assert.ok(!('stars' in f) && f.visits.every((x) => !('note' in x)), '옛 칸 없음');
  assert.deepEqual(f.entries.j, { b: { stars: 5, note: '', at: null } });
  assert.deepEqual(f.entries.d, { a: { stars: null, note: '광한루', at: 't1' }, b: { stars: 3, note: '', at: null } });
  assert.equal(f.entries.bad, undefined, '이상한 별점은 버림');
  const p = P.fromDoc('52190', old);
  assert.equal(P.avgStars(p), 4, '옮기기 전 문서도 새 모양으로 읽음');
  const again = P.legacyFold(Object.assign({}, old, { entries: { j: { b: { stars: 2, note: '', at: 'x' } } } }));
  assert.equal(again.entries.j.b.stars, 2, '이미 새 칸에 값이 있으면 덮지 않음');
  assert.deepEqual(P.legacyFold({ stars: { j: 4 }, visits: [] }).entries, {}, '방문이 없으면 옛 별점은 둘 곳이 없음');
  const script = fs.readFileSync(path.join(ROOT, 'scripts/migrate-place-entries.js'), 'utf8');
  assert.match(script, /legacyFold/); assert.match(script, /backup/); assert.match(script, /--write/);
});

test('M3 화면: 가고 싶은 곳(또 가기 · 손잡이) · 다녀온 곳(정렬 · 별) · 순위 고르기(↑↓ · N위로 담기) · 별점 카드(단짝 줄은 보기만)', () => {
  const w = VM.wishTab({ rows: [{ code: '50110', no: 1, name: '제주 제주시', note: '바다', again: false }, { code: '12130', no: 2, name: '전남광주 여수시', note: '', again: true }] });
  assert.match(w, /다음에 함께 갈 곳 2[^]*끌어서 순위 바꾸기/);
  assert.match(w, /data-code="12130"[^]*또 가기[^]*data-grip="12130"/);
  const b = VM.beenTab({ sort: 'stars', rows: [{ code: '52110', name: '전북 전주시', count: 3, lastText: '11월 9일', fill: 5 }] });
  assert.match(b, /data-v="stars" aria-pressed="true"/); assert.match(b, /3번 · 마지막 11월 9일/);
  assert.equal((b.match(/mstar is-on/g) || []).length, 5);
  const r = VM.rankScreen({ name: '전북 남원시', rows: [{ code: 'a', name: 'A' }, { code: 'n', name: '전북 남원시', isNew: true }, { code: 'b', name: 'B' }], idx: 1, note: '', saving: false, change: false });
  assert.match(r, /몇 위로 담을까요/); assert.match(r, /2위로 담기/);
  assert.match(r, /mrow--new[^]*data-v="-1"[^]*data-v="1"/);
});

test('v54 다녀온 곳 시트(C): 요약 카드 · 버튼 둘 · 접힌 줄에 두 사람 별점(없으면 —) · 펼친 줄만 메모 칸', () => {
  const place = P.fromDoc('11110', { visits: [{ id: 'a', date: '2026-03-01' }, { id: 'b', date: '2026-10-12' }], entries: { j: { b: ent(5, '첫 가을 여행') }, d: { a: ent(3) } } });
  const s = { code: '11110', name: '서울 종로구', place, mode: 'view', lastText: '10월 12일', wishNo: null, meSlot: 'me', partnerSlot: 'her', meName: '준민', partnerName: '단짝', hasPartner: true,
    summary: { avgText: '4.1', fill: 4, count: 7, rankNo: 2, me: { slot: 'me', name: '준민', avgText: '4.2', n: 4 }, partner: { slot: 'her', name: '단짝', avgText: '4', n: 3 } },
    visitsView: [{ id: 'b', nth: 2, date: '10월 12일', open: true, me: { stars: 5, note: '첫 가을 여행' }, partner: null }, { id: 'a', nth: 1, date: '3월 1일', open: false, me: null, partner: { stars: 3, note: '' } }] };
  const html = VM.sheet(s);
  assert.match(html, /서울 종로구[^]*함께 2번[^]*다녀온 곳 별점 2위 · 마지막 10월 12일/);
  assert.match(html, /msum__avg">4\.1[^]*별점 7개 평균[^]*준민[^]*4\.2[^]* · 4번[^]*단짝[^]*<b>4<\/b>[^]* · 3번/);
  assert.match(html, /data-act="map-visit">또 다녀왔어요[^]*data-act="map-wish">또 가고 싶어요/);
  assert.match(html, /<button type="button" class="mvrow" data-act="map-visit-toggle" data-v="b" aria-expanded="true"[^]*10월 12일[^]*· 2번째[^]*★<\/span>5[^]*mvchip[^]*—/, '단짝 별점이 없으면 —');
  assert.match(html, /data-v="a" aria-expanded="false"/);
  assert.equal((html.match(/class="mvbody"/g) || []).length, 1, '펼친 줄만 메모 칸');
  assert.match(html, /data-act="map-entry" data-v="b"[^]*첫 가을 여행[^]*단짝[^]*아직 안 남겼어요/);
  const empty = VM.summaryCard({ count: 0 });
  assert.match(empty, /아직 별점이 없어요/);
  const onlyStar = VM.visitList(Object.assign({}, s, { visitsView: [{ id: 'b', nth: 1, date: 'x', open: true, me: { stars: 4, note: '' }, partner: null }] }));
  assert.match(onlyStar, /＋ 한 줄 남기기/, '별점만 있으면 한 줄 남기기');
  const none = VM.visitList(Object.assign({}, s, { visitsView: [{ id: 'b', nth: 1, date: 'x', open: true, me: null, partner: null }] }));
  assert.match(none, /＋ 별점 · 한 줄 남기기/);
});

test('v54 기록 남기기 시트: 새 방문(날짜 · 알림 안내) · 고치기(날짜 없음 · 방문 지우기 두 번) · 별 5개 radiogroup', () => {
  const base = { code: '11110', name: '서울 종로구', place: P.fromDoc('11110', { visits: [{ id: 'a', date: '2026-03-01' }] }), startKey: '2025-07-20', todayKey: '2026-11-19', noteMax: 100, meSlot: 'me', partnerSlot: 'her', partnerName: '다진', hasPartner: true };
  const add = VM.recordSheet(Object.assign({ form: { vid: null, nth: 2, date: '2026-11-16', stars: 4, note: '붕어빵', saving: false, error: '' } }, base));
  assert.match(add, /서울 종로구 · 또 다녀왔어요/);
  assert.match(add, /2번째 방문 · 내 별점과 메모만 남겨요\. 단짝은 자기 칸을 따로 채워요/);
  assert.match(add, /id="mp-date"/);
  assert.match(add, /role="radiogroup"/);
  assert.equal((add.match(/data-act="map-rec-star"/g) || []).length, 5);
  assert.equal((add.match(/mrec__star is-on/g) || []).length, 4);
  assert.match(add, /data-v="4" role="radio" aria-checked="true"/);
  assert.match(add, /저장하면 단짝에게 「별점을 남겨 주세요」 알림이 가요/);
  assert.doesNotMatch(add, /방문 지우기/);
  const ed = (c) => VM.recordSheet(Object.assign({ dateText: '3월 1일', form: { vid: 'a', nth: 1, date: '2026-03-01', stars: 0, note: '', saving: false, error: '', confirmDelete: c } }, base));
  assert.match(ed(false), /서울 종로구 · 1번째 방문/);
  assert.doesNotMatch(ed(false), /id="mp-date"/, '고칠 땐 날짜 없음');
  assert.doesNotMatch(ed(false), /알림이 가요/, '고칠 땐 알림 안내 없음');
  assert.match(ed(false), /data-act="map-visit-delete"[^>]*>방문 지우기/);
  assert.match(ed(true), /text-btn--warn[^]*한 번 더 누르면 이 방문과 두 사람 기록을 모두 지워요/);
  const css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
  assert.match(css, /\.mrec__star \{ width: 48px; height: 48px;/, '별 버튼 48px');
  assert.match(css, /\.mvrow \{[^}]*min-height: 52px;/, '접힌 줄 52px 이상');
  assert.match(css, /\.msum__avg \{ font-size: 32px; font-weight: 800;/);
  const v54 = css.slice(css.indexOf('/* ── v54 우리 지도'));
  assert.doesNotMatch(v54.replace(/\/\*[^]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, '색은 토큰만');
});
