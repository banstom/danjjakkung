// 새 도트 테마 (11/23 종합 묶음, docs/themes-2026-11) — 각 폴더 tests.md 자동 시험 A1 ~ A9 를 테마 표 하나로.
// 단계(SA1 · OT1 · TC1 · AO1)가 들어올 때마다 NEW 표에 그 테마를 더한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = require('../js/themes.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const css = read('styles/tokens.css');

// 들어간 새 테마: id · 묶음 · 기획 폴더 · 이름 (이름은 기획 문서 표 그대로)
const NEW = [
  { id: 'summer-sea', group: 'season', folder: 'themes-summer-autumn', ko: '찰방찰방 여름 바다' },
  { id: 'autumn-forest', group: 'season', folder: 'themes-summer-autumn', ko: '알록달록 가을 숲' },
  { id: 'observatory', group: 'outing', folder: 'themes-observatory-train', ko: '반짝반짝 천문대' },
  { id: 'train-trip', group: 'travel', folder: 'themes-observatory-train', ko: '덜컹덜컹 기차 여행' },
  { id: 'tennis-court', group: 'outing', folder: 'themes-tennis-cities', ko: '통통 테니스 코트' },
  { id: 'porto', group: 'travel', folder: 'themes-tennis-cities', ko: '또각또각 포르투' },
  { id: 'prague', group: 'travel', folder: 'themes-tennis-cities', ko: '뾰족뾰족 프라하' },
  { id: 'tuscany', group: 'travel', folder: 'themes-tennis-cities', ko: '살랑살랑 토스카나' }
];
const boardsOf = (t) => [t.id, t.id + '-night'];

function block(id) {
  const m = new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}').exec(css);
  assert.ok(m, id + ' 블록이 있어야 해요');
  const v = {};
  m[1].replace(/--([a-z-]+):\s*([^;]+);/g, (_, k, x) => { v[k] = x.trim(); });
  return { raw: m[1], v };
}
function lum(h) {
  const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// 기획 spec 「사람 색 후보」 표 → 테마마다 [hex…] (그 폴더 테마 순서 = 표의 열 순서)
function specPalettes(folder) {
  const s = read('docs/' + folder + '/spec.md');
  const sec = s.slice(s.indexOf('사람 색 후보'));
  const ids = NEW.filter((t) => t.folder === folder).map((t) => t.id);
  const all = [...new Set(read('docs/' + folder + '/README.md').match(/`([a-z-]+)` \/ `\1-night`|`([a-z-]+)` \/ `[a-z-]+-night`/g) || [])];
  const order = all.map((x) => /`([a-z-]+)`/.exec(x)[1]);
  const out = {};
  for (const line of sec.split('\n').filter((l) => l.startsWith('|') && l.includes('`#'))) {
    line.replace(/^\||\|$/g, '').split('|').forEach((cell, i) => {
      const m = /`(#[0-9A-Fa-f]{6})`/.exec(cell);
      const id = order[i];
      if (m && ids.includes(id)) (out[id] = out[id] || []).push(m[1].toUpperCase());
    });
  }
  return out;
}

test('A1 판마다 봄소풍 판과 같은 토큰을 빠짐없이 · 그림 경로는 그 테마 폴더 · 머리 장식 72px', () => {
  const want = Object.keys(block('spring-picnic').v);
  for (const t of NEW) for (const b of boardsOf(t)) {
    const { v } = block(b);
    for (const k of want) assert.ok(v[k] && v[k].length, b + ' 에 --' + k + ' 없음');
    for (const k of ['bg-art', 'head-art']) assert.match(v[k], new RegExp("^url\\('\\.\\./themes/" + t.id + "/(bg|head)" + (b.endsWith('-night') ? '-night' : '') + "\\.svg'\\)$"), b + ' --' + k);
    assert.equal(v['head-w'], '72px');
    assert.equal(v['head-h'], b.endsWith('-night') ? '60px' : '42px');
    assert.equal(v['bg-art-size'], '84px');
  }
});

test('A2 글자 대비 (contrast.md 21쌍) — 모든 판 4.5:1 이상 · 외곽선 · 달력 꽉 찬 칸 3:1', () => {
  const pairs = [['text', 'bg'], ['text', 'surface'], ['text', 'raised'], ['sub', 'bg'], ['sub', 'surface'], ['sub', 'raised'], ['on-primary', 'primary'], ['tint-text', 'tint'],
    ['tab-active', 'tab-bg'], ['tab-inactive', 'tab-bg'], ['me-ink', 'me'], ['her-ink', 'her'], ['both-ink', 'both'], ['on-today', 'today'], ['lv-full-text', 'lv-full'],
    ['lv-half-text', 'lv-half'], ['empty-text', 'empty'], ['toast-fg', 'toast-bg'], ['warn', 'surface'], ['success', 'surface'], ['warning', 'surface']];
  for (const t of NEW) for (const b of boardsOf(t)) {
    const { v } = block(b);
    for (const [f, g] of pairs) assert.ok(contrast(v[f], v[g]) >= 4.5, `${b}: --${f} / --${g} = ${contrast(v[f], v[g]).toFixed(2)}`);
    assert.ok(contrast(v.ol, v.surface) >= 3, b + ' 외곽선');
  }
});

test('A3 낮 · 밤 묶음으로 등록 — 자동이면 시스템 다크 모드를 따름 · 도트 스킨 · NEW', () => {
  for (const t of NEW) {
    const th = T.byId(t.id);
    assert.ok(th, t.id);
    assert.deepEqual(th.modes, { light: t.id, dark: t.id + '-night' });
    assert.equal(th.skin, 'pixel');
    assert.ok(th.tags.includes('NEW'));
    assert.equal(T.board(t.id, 'auto', false), t.id);
    assert.equal(T.board(t.id, 'auto', true), t.id + '-night');
    assert.equal(T.board(t.id, 'dark', false), t.id + '-night');
    assert.equal(T.board(t.id, 'light', true), t.id);
    assert.equal(T.ofBoard(t.id + '-night').id, t.id);
  }
});

test('A4 그 테마가 아닐 때는 그림 · 장식을 안 받음 — 경로는 제 토큰 블록 · 그림 표에만, 미리 받기(sw) 목록에 없음', () => {
  const sw = read('sw.js'), px = read('styles/pixel.css'), app = read('styles/app.css');
  for (const t of NEW) {
    const re = new RegExp('themes/' + t.id + '/', 'g');
    const inBlocks = boardsOf(t).reduce((n, b) => n + (block(b).raw.match(re) || []).length, 0);
    assert.equal((css.match(re) || []).length, inBlocks, t.id + ' 그림 경로는 제 블록 안에만');
    assert.equal(inBlocks, 4);
    assert.doesNotMatch(sw, re); assert.doesNotMatch(px, re); assert.doesNotMatch(app, re);
    assert.match(T.art('s1', t.id).src, new RegExp('^themes/' + t.id + '/s1\\.png$'));
  }
  // 그림 자리는 지금 테마로만 그린다 (artHtml 은 current 만 봄)
  assert.match(read('js/themes.js'), /function artHtml\(slot, cls\) \{\n\s*var a = art\(slot\);/);
});

test('A5 그림 4장: PNG 크기 = 표 · 정수 배율 · 보이는 크기가 spec 4절 표 그대로 · 파일 8개 150KB 이하', () => {
  for (const t of NEW) {
    const spec = read('docs/' + t.folder + '/spec.md');
    let sum = 0;
    for (const f of ['s1.png', 's2.png', 's3.png', 's4.png', 'bg.svg', 'bg-night.svg', 'head.svg', 'head-night.svg']) {
      const p = path.join(ROOT, 'themes', t.id, f);
      assert.ok(fs.existsSync(p), t.id + '/' + f);
      sum += fs.statSync(p).size;
      // 기획 묶음 그림과 같은 파일
      assert.ok(fs.readFileSync(p).equals(fs.readFileSync(path.join(ROOT, 'design/assets/themes', t.id, f))), t.id + '/' + f + ' 기획 그림과 같아야 해요');
    }
    assert.ok(sum <= 150 * 1024);
    for (const s of ['s1', 's2', 's3', 's4']) {
      const a = T.ART[t.id][s], png = fs.readFileSync(path.join(ROOT, 'themes', t.id, s + '.png'));
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [a.w, a.h], t.id + ' ' + s + ' PNG 크기');
      assert.ok(Number.isInteger(a.x) && a.x >= 1);
      const row = `${a.w}×${a.h} × ${a.x} → ${a.w * a.x}×${a.h * a.x}`;
      assert.ok(spec.includes(row), t.id + ' ' + s + ' 명세 표에 ' + row);
      assert.ok(a.alt && a.alt.length);
    }
  }
});

test('A6 기존 테마 판의 토큰은 하나도 안 바뀜 (11/23 전 스냅숏)', () => {
  const SNAP = { 'soft-pastel': '9a3f31a7449e', 'cosmic-dream': 'a95d12a98dcc', 'ocean-breeze': 'fa7a2fee2747', 'forest-diary': '01dadea765db', 'vintage-film': '8fb1161fe84f',
    'blue-hour': '791f39ddfcf2', 'golden-hour': '2240be012e97', 'sakura-dream': '1baef7e8ff9c', 'midnight-noir': '34a491237943', 'arctic-frost': '83477033bfcd',
    'chocolate-noir': '0ff76d7f6035', 'roast-nuts': '4394abf0ee27', 'winter-knit': '2e74dd163575', 'harvest': '5fa3e1c5fb63', 'winter-snack': '1f718960b636',
    'winter-snack-night': '23ad943f622f', 'merry-xmas': 'eb031069fb38', 'merry-xmas-night': '96f3fc25bf55', 'spring-picnic': '35aa0b1bcfe4', 'spring-picnic-night': '8449eba37c05' };
  for (const [id, h] of Object.entries(SNAP)) assert.equal(crypto.createHash('sha1').update(block(id).raw).digest('hex').slice(0, 12), h, id + ' 토큰이 바뀌었어요');
});

test('A7 사람 색 후보 = spec 표 8색 · 앞 둘 = 판의 짝꿍 · 나 기본색 · 함께 색 · 규칙에 그 테마 칸', () => {
  const rules = read('firestore.rules');
  const folders = [...new Set(NEW.map((t) => t.folder))];
  const spec = Object.assign({}, ...folders.map(specPalettes));
  for (const t of NEW) {
    const pal = T.palette(t.id), { v } = block(t.id), night = block(t.id + '-night').v;
    assert.equal(pal.length, 8);
    assert.deepEqual([...pal].sort(), [...spec[t.id]].sort(), t.id + ' 후보 = spec 표');
    assert.deepEqual(pal.slice(0, 2), [v.her, v.me], t.id + ' 앞 둘 = --her · --me');
    assert.deepEqual([night.her, night.me, night.both], [v.her, v.me, v.both], t.id + ' 낮 · 밤 같은 사람 색');
    assert.equal(T.bothColor(t.id), v.both);
    for (const hex of pal) assert.ok(T.contrast(hex, T.inkFor(t.id, hex)) >= 4.5, t.id + ' ' + hex);
    for (const hex of pal) assert.ok(T.colorName(hex) !== hex, t.id + ' ' + hex + ' 이름');
    assert.ok(rules.includes(`validPair(c['${t.id}'])`), t.id + ' 규칙');
  }
});

test('A8 테마 이름은 테마 목록(js/themes.js) 한 곳에만', () => {
  const js = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => [f, read('js/' + f)]);
  for (const t of NEW) {
    assert.equal(T.byId(t.id).ko, t.ko);
    for (const [f, src] of js) if (f !== 'themes.js') assert.ok(!src.includes(t.ko), f + ' 에 ' + t.ko);
  }
});

test('A9 묶음(group) · 테마 시트 순서 = docs/themes-sheet/spec.md 2절 표', () => {
  for (const t of NEW) {
    assert.equal(T.groupOf(t.id), t.group);
    const g = T.groups().find((x) => x.id === t.group), order = T.GROUPS.find((x) => x.id === t.group).order;
    const got = g.themes.map((x) => x.id);
    assert.deepEqual(got, order.filter((id) => !!T.byId(id)), t.group + ' 묶음 순서');
  }
});

test('밤 판은 어두운 판 목록(쿠키 그림 색)에 · 빨강은 경고 · 장식 · 토마토 · 사람 색에만', () => {
  const dark = /(\[data-theme="cosmic-dream"\], \[data-theme="midnight-noir"\][^{]*)\{\n\s*--ck-hi/.exec(css)[1];
  for (const t of NEW) assert.ok(dark.includes(`[data-theme="${t.id}-night"]`), t.id + '-night');
  const ALLOWED = ['warn', 'sec-dot', 'deco-a', 'tomato-red', 'her'];
  const red = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.25 || mx !== r) return false;
    const hue = ((g - b) / d) * 60;
    return (hue < 12 || hue > 345) && l > 0.25 && l < 0.75;
  };
  for (const t of NEW) for (const b of boardsOf(t)) for (const [k, x] of Object.entries(block(b).v)) if (/^#[0-9A-F]{6}$/.test(x) && red(x)) assert.ok(ALLOWED.includes(k), `${b}: --${k} ${x}`);
});
