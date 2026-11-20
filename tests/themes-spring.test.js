// 봄 업데이트 (11/20) — 「몽글몽글 봄소풍」 낮 · 밤 판. docs/themes-spring/tests.md SP1 ~ SP10 중 코드로 볼 수 있는 것
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'styles/tokens.css'), 'utf8');
const BOARDS = ['spring-picnic', 'spring-picnic-night'];

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


test('SP1 고르면 자동 → 시스템 밝기 따라 낮 · 밤 판, 고정하면 그 판 · 도트 스킨', () => {
  const s = boot({ 'danjjakkung.theme': 'spring-picnic' }, false);
  assert.strictEqual(s.attrs['data-theme'], 'spring-picnic');
  assert.strictEqual(s.attrs['data-skin'], 'pixel');
  s.setDark(true);
  assert.strictEqual(s.attrs['data-theme'], 'spring-picnic-night');
  assert.strictEqual(boot({ 'danjjakkung.theme': 'spring-picnic', 'danjjakkung.themeMode': 'light' }, true).attrs['data-theme'], 'spring-picnic');
  assert.strictEqual(boot({ 'danjjakkung.theme': 'spring-picnic', 'danjjakkung.themeMode': 'dark' }, false).attrs['data-theme'], 'spring-picnic-night');
  const T = s.T;
  const th = T.THEMES.find((x) => x.id === 'spring-picnic');
  assert.strictEqual(JSON.stringify([th.ko, th.skin, th.tags]), JSON.stringify(['몽글몽글 봄소풍', 'pixel', ['NEW']]));
});

test('SP2 두 판 모두 겨울 판과 같은 토큰을 빠짐없이 (빈 값 없음) + 머리 장식 너비 72px', () => {
  const winter = Object.keys(block('winter-snack'));
  for (const id of BOARDS) {
    const v = block(id);
    for (const k of winter) assert.ok(k in v && v[k] !== '', id + ' 에 --' + k + ' 없음');
    assert.strictEqual(v['head-w'], '72px');
    for (const k of ['bg-art', 'head-art']) assert.match(v[k], /^url\('\.\.\/themes\/spring-picnic\//);
  }
  assert.strictEqual(block('spring-picnic')['head-h'], '42px');
  assert.strictEqual(block('spring-picnic-night')['head-h'], '60px');
  assert.strictEqual(block('spring-picnic-night').dash, '#4B4166');
});

test('SP3 글자 대비 — contrast.md 21쌍 × 두 판 4.5:1 이상', () => {
  const pairs = [['text', 'bg'], ['text', 'surface'], ['text', 'raised'], ['text', 'tint'], ['sub', 'bg'], ['sub', 'surface'], ['sub', 'raised'], ['sub', 'tint'],
    ['tint-text', 'tint'], ['tint-text', 'surface'], ['on-primary', 'primary'], ['tab-active', 'surface'], ['strong', 'surface'], ['strong', 'bg'],
    ['me-ink', 'me'], ['her-ink', 'her'], ['both-ink', 'both'], ['empty-text', 'empty'], ['warn', 'surface'], ['toast-fg', 'toast-bg'], ['text', 'empty']];
  assert.strictEqual(pairs.length, 21);
  for (const id of BOARDS) {
    const v = block(id);
    for (const [f, b] of pairs) { const r = contrast(v[f], v[b]); assert.ok(r >= 4.5, `${id}: --${f} / --${b} = ${r.toFixed(2)}`); }
  }
});

test('SP4 봄소풍 그림은 봄소풍 판에서만 — 토큰 블록 밖 · 미리 받기(sw) 목록에 없음', () => {
  const outside = css.replace(/\[data-theme="spring-picnic(-night)?"\]\s*\{[^}]*\}/g, '');
  assert.ok(!/themes\/spring-picnic\//.test(outside), '봄소풍 판 밖에서 그림을 부름');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.ok(!/spring-picnic/.test(sw), 'sw 가 미리 받음');
});

test('SP5 그림 S1~S4: 정수 배율 · 보이는 크기가 명세 표 ±16px · PNG 크기 = 표의 w × h', () => {
  const T = boot({}, false).T;
  const SPEC = { s1: [72, 64], s2: [80, 40], s3: [136, 136], s4: [156, 120] };
  const dir = path.join(ROOT, 'themes/spring-picnic');
  for (const k of Object.keys(SPEC)) {
    const png = fs.readFileSync(path.join(dir, k + '.png'));
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    const all = fs.readFileSync(path.join(ROOT, 'js/themes.js'), 'utf8'), src = all.slice(all.indexOf('var ART'));
    const m = new RegExp("'spring-picnic': \\{[\\s\\S]*?" + k + ": \\{ w: (\\d+), h: (\\d+), x: (\\d+)").exec(src);
    assert.ok(m, k + ' 배율 표');
    const [mw, mh, x] = m.slice(1).map(Number);
    assert.deepStrictEqual([w, h], [mw, mh], k + ' PNG 크기');
    assert.ok(Number.isInteger(x) && x >= 1);
    assert.ok(Math.abs(w * x - SPEC[k][0]) <= 16 && Math.abs(h * x - SPEC[k][1]) <= 16, k + ' 보이는 크기 ' + w * x + '×' + h * x);
  }
});

test('SP6 · D 그림 파일 8개 · 합계 150KB 이하, 픽셀 스킨은 토큰만 (봄소풍 선택자 없음)', () => {
  let sum = 0;
  for (const f of ['s1.png', 's2.png', 's3.png', 's4.png', 'bg.svg', 'bg-night.svg', 'head.svg', 'head-night.svg']) {
    const p = path.join(ROOT, 'themes/spring-picnic', f);
    assert.ok(fs.existsSync(p), f);
    sum += fs.statSync(p).size;
  }
  assert.ok(sum <= 150 * 1024);
  const px = fs.readFileSync(path.join(ROOT, 'styles/pixel.css'), 'utf8');
  assert.ok(!/spring-picnic/.test(px.replace(/\/\*[\s\S]*?\*\//g, '')), 'pixel.css 는 토큰으로만');
  assert.match(px, /var\(--head-w, 48px\)/);
  assert.match(px, /var\(--dash, var\(--line\)\)/);
});

test('SP10 테마 시트: 봄소풍이 맨 앞 · 낮·밤 · NEW 꼬리표 · 사람 색 후보 8개', () => {
  const vsrc = fs.readFileSync(path.join(ROOT, 'js/view.js'), 'utf8');
  assert.match(vsrc, /var FEATURED = \['spring-picnic', 'winter-snack', 'merry-xmas', 'soft-pastel'\]/);
  const T = boot({}, false).T;
  const pal = T.palette('spring-picnic');
  assert.strictEqual(pal.length, 8);
  assert.strictEqual(JSON.stringify(pal.slice(0, 3)), JSON.stringify(['#E89AB0', '#F3C96B', '#A5CB93']));
  assert.strictEqual(T.bothColor('spring-picnic'), '#A5CB93');
});
