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
  const form = VM.sheet(Object.assign({ mode: 'visit', form: { date: '2026-10-27', note: '', saving: false, error: '' } }, base));
  assert.match(form, /id="mp-date"[^>]*min="2025-07-20"[^>]*max="2026-10-27"/);
});

test('「전체」 카드 미리보기: 함께 다녀온 시·도 칸만 칠함', () => {
  assert.equal(ALL.TILE_SIDO.length, ALL.TILES.length);
  const t = ALL.tilesFor(['50']);
  assert.deepEqual(t, [ALL.TILES.length - 1], '제주 = 맨 아래 칸');
  assert.ok(ALL.tilesFor(['52']).length > 0 && ALL.tilesFor(['11', '26', '36']).length === 3);
});

test('규칙: places 는 members 만 · 지우기 없음 · 별점은 내 칸만 · 가장 이른 방문 ≥ 단짝이 된 날', () => {
  const r = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const blk = r.slice(r.indexOf('function coupleStart'), r.indexOf('// ── 알림 ──'));
  assert.match(blk, /match \/places\/\{code\}/);
  assert.match(blk, /allow read: if isMember\(\);/);
  assert.match(blk, /allow delete: if false;/);
  assert.match(blk, /affectedKeys\(\)\.hasOnly\(\[request\.auth\.uid\]\)/);
  assert.match(blk, /vs\[0\]\.date >= coupleStart\(\)/);
  assert.match(blk, /code\.matches\('\^\[0-9\]\{5\}\$'\)/);
});

test('지도 파일은 처음 열 때만 받음 (오프라인 목록에 없고, 화면 코드는 fetch)', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /kr-map\.json/);
  for (const f of ['js/places.js', 'js/map-zoom.js', 'js/view-map.js']) assert.match(sw, new RegExp("'" + f.replace('.', '\\.') + "'"));
  assert.match(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8'), /fetch\('data\/kr-map\.json'\)/);
});
