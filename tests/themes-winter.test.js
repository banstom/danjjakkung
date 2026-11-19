// 겨울 업데이트 (11/19) — 도트 테마 2종 × 낮 · 밤 판. docs/themes-winter/tests.md 의 A · B(논리) · D(파일) 시험
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'styles/tokens.css'), 'utf8');
const BOARDS = ['winter-snack', 'winter-snack-night', 'merry-xmas', 'merry-xmas-night'];

function block(id) {
  const m = new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}').exec(css);
  assert.ok(m, id + ' 블록이 있어야 해요');
  const v = {};
  m[1].replace(/--([a-z-]+):\s*([^;]+);/g, (_, k, x) => { v[k] = x.trim(); });
  return v;
}
const common = (() => { const m = /:root, \[data-theme\] \{([^}]*)\}/.exec(css); const v = {}; m[1].replace(/--([a-z-]+):\s*([^;]+);/g, (_, k, x) => { v[k] = x.trim(); }); return v; })();
function lum(h) {
  const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// 브라우저처럼: localStorage · 다크 모드 · <html> 을 흉내 내고 themes.js 를 새로 띄운다
function boot(store, dark) {
  const attrs = {}, mqs = [];
  const html = { getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: (k) => { delete attrs[k]; },
    classList: { add() {}, remove() {}, contains: () => false }, style: { setProperty() {}, removeProperty() {} } };
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const env = { dark: !!dark };
  const win = {
    localStorage: ls,
    document: { documentElement: html, querySelector: () => null },
    matchMedia: () => { const mq = { get matches() { return env.dark; }, addEventListener: (t, f) => mqs.push(f) }; return mq; },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    setTimeout: (f) => f()
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/themes.js'), 'utf8'), { window: win, globalThis: win, JSON, Math, Object, String, parseInt, setTimeout: (f) => f() });
  return { T: win.RT.themes, attrs, store, setDark(d) { env.dark = d; mqs.forEach((f) => f()); } };
}

// ── A. 토큰 · 색 ──
test('A1 네 판이 다른 테마의 토큰을 모두 정의 + 새 토큰 7개', () => {
  const base = Object.keys(block('soft-pastel'));
  const NEW = ['ol', 'sh', 'btn-hi', 'btn-lo', 'sec-dot', 'deco-a', 'deco-b'];
  for (const id of BOARDS) {
    const v = block(id);
    for (const k of base.concat(NEW)) assert.ok(k in v, id + ' 에 --' + k + ' 없음');
    for (const k of NEW) assert.match(v[k], /^#[0-9A-F]{6}$/, id + ' --' + k);
    for (const k of ['bg-art', 'head-art']) assert.match(v[k], new RegExp("^url\\('\\.\\./themes/" + id.replace('-night', '') + '/'), id + ' --' + k);
  }
  for (const k of NEW) assert.ok(k in common, '공통 블록에 --' + k + ' 기본값');
});

test('A2 글자 대비 (contrast.md 21쌍) — 네 판 모두 4.5:1 이상', () => {
  const pairs = [['text', 'bg'], ['text', 'surface'], ['text', 'raised'], ['sub', 'bg'], ['sub', 'surface'], ['sub', 'raised'], ['on-primary', 'primary'], ['tint-text', 'tint'],
    ['tab-active', 'tab-bg'], ['tab-inactive', 'tab-bg'], ['me-ink', 'me'], ['her-ink', 'her'], ['both-ink', 'both'], ['on-today', 'today'], ['lv-full-text', 'lv-full'],
    ['lv-half-text', 'lv-half'], ['empty-text', 'empty'], ['toast-fg', 'toast-bg'], ['warn', 'surface'], ['success', 'surface'], ['warning', 'surface']];
  for (const id of BOARDS) {
    const v = Object.assign({}, block(id));
    // 판에 없으면 공통 값 (오늘 = 글자색 · 위 글자 = 카드색)
    if (!/^#/.test(v.today || '')) { v.today = v.text; v['on-today'] = v.surface; }
    for (const [f, b] of pairs) {
      const r = contrast(v[f], v[b]);
      assert.ok(r >= 4.5, `${id}: --${f} / --${b} = ${r.toFixed(2)}`);
    }
  }
});

test('A4 빨강은 경고(--warn) · 장식(섹션 점 · 장식 색) · 토마토 · 사람 색에만', () => {
  const ALLOWED = ['warn', 'sec-dot', 'deco-a', 'tomato-red', 'her'];
  const red = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.25 || mx !== r) return false;
    const hue = ((g - b) / d) * 60;
    return (hue < 12 || hue > 345) && l > 0.25 && l < 0.75;
  };
  for (const id of BOARDS) {
    const v = block(id);
    for (const [k, x] of Object.entries(v)) if (/^#[0-9A-F]{6}$/.test(x) && red(x)) assert.ok(ALLOWED.includes(k), `${id}: --${k} ${x} 는 빨강 — 경고는 --warn 만`);
  }
});

// ── B. 낮 · 밤 판 고르기 ──
test('B1 · B2 자동: 시스템 밝게 → 낮 판, 어둡게 → 밤 판, 켜 둔 채로 바로 바뀜', () => {
  const s = boot({ 'danjjakkung.theme': 'winter-snack' }, false);
  assert.strictEqual(s.attrs['data-theme'], 'winter-snack');
  assert.strictEqual(s.attrs['data-skin'], 'pixel');
  s.setDark(true);
  assert.strictEqual(s.attrs['data-theme'], 'winter-snack-night');
  const d = boot({ 'danjjakkung.theme': 'merry-xmas', 'danjjakkung.themeMode': 'auto' }, true);
  assert.strictEqual(d.attrs['data-theme'], 'merry-xmas-night');
});

test('B3 낮 · 밤 고정이면 시스템과 상관없이', () => {
  const s = boot({ 'danjjakkung.theme': 'winter-snack', 'danjjakkung.themeMode': 'light' }, true);
  assert.strictEqual(s.attrs['data-theme'], 'winter-snack');
  s.setDark(false); s.setDark(true);
  assert.strictEqual(s.attrs['data-theme'], 'winter-snack');
  const n = boot({ 'danjjakkung.theme': 'merry-xmas', 'danjjakkung.themeMode': 'dark' }, false);
  assert.strictEqual(n.attrs['data-theme'], 'merry-xmas-night');
  // 고르기: 저장하고 바로
  n.T.chooseMode('light');
  assert.strictEqual(n.attrs['data-theme'], 'merry-xmas');
  assert.strictEqual(n.store['danjjakkung.themeMode'], 'light');
});

test('B4 판이 없는 테마는 모드와 상관없이 그대로, 스킨 없음', () => {
  const s = boot({ 'danjjakkung.theme': 'soft-pastel', 'danjjakkung.themeMode': 'dark' }, true);
  assert.strictEqual(s.attrs['data-theme'], 'soft-pastel');
  assert.ok(!('data-skin' in s.attrs));
  assert.strictEqual(s.T.hasModes('soft-pastel'), false);
  assert.strictEqual(s.T.hasModes('winter-snack'), true);
  // 도트 테마에서 바꾸면 스킨이 사라진다
  const p = boot({ 'danjjakkung.theme': 'winter-snack' }, false);
  p.T.choose('ocean-breeze');
  assert.strictEqual(p.attrs['data-theme'], 'ocean-breeze');
  assert.ok(!('data-skin' in p.attrs));
});

test('B5 테마를 안 고른 사람은 지금과 같음', () => {
  assert.strictEqual(boot({}, false).attrs['data-theme'], 'soft-pastel');
  const d = boot({ 'danjjakkung.themeMode': 'light' }, true);
  assert.strictEqual(d.attrs['data-theme'], 'cosmic-dream');
  d.setDark(false);
  assert.strictEqual(d.attrs['data-theme'], 'soft-pastel');
});

test('B7 판 id 가 저장돼 있으면 묶음 id 로 고쳐 저장', () => {
  const s = boot({ 'danjjakkung.theme': 'winter-snack-night' }, false);
  assert.strictEqual(s.store['danjjakkung.theme'], 'winter-snack');
  assert.strictEqual(s.T.current(), 'winter-snack');
  assert.strictEqual(s.attrs['data-theme'], 'winter-snack');
});

test('B8 모르는 테마 id → 기본 테마', () => {
  assert.strictEqual(boot({ 'danjjakkung.theme': 'footprints' }, false).attrs['data-theme'], 'soft-pastel');
  assert.strictEqual(boot({ 'danjjakkung.theme': 'nope-night' }, true).attrs['data-theme'], 'cosmic-dream');
});

test('B9 모드 값이 이상하면 auto', () => {
  const s = boot({ 'danjjakkung.theme': 'merry-xmas', 'danjjakkung.themeMode': 'dusk' }, true);
  assert.strictEqual(s.T.mode(), 'auto');
  assert.strictEqual(s.attrs['data-theme'], 'merry-xmas-night');
  assert.strictEqual(s.T.chooseMode('dusk'), false);
});

// ── D. 그림 파일 ──
test('D4 · D5 테마 그림: 테마마다 낮 · 밤이 같은 s1~s4, 합계 150KB 이하', () => {
  for (const id of ['winter-snack', 'merry-xmas']) {
    const dir = path.join(ROOT, 'themes', id);
    let sum = 0;
    for (const f of ['s1.png', 's2.png', 's3.png', 's4.png', 'bg.svg', 'bg-night.svg', 'head.svg', 'head-night.svg']) {
      assert.ok(fs.existsSync(path.join(dir, f)), id + '/' + f);
      sum += fs.statSync(path.join(dir, f)).size;
    }
    assert.ok(sum <= 150 * 1024, id + ' 그림 합계 ' + sum);
  }
});
