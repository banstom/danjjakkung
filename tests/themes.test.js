// 테마: 목록 · 기본값 · 색표가 빠짐없는지 · 글자 대비
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = require('../js/themes.js');

const IDS = ['soft-pastel', 'cosmic-dream', 'ocean-breeze', 'forest-diary', 'vintage-film', 'blue-hour'];
const css = fs.readFileSync(path.join(__dirname, '../styles/tokens.css'), 'utf8');
const appCss = fs.readFileSync(path.join(__dirname, '../styles/app.css'), 'utf8');

// [data-theme="id"] 블록의 변수들 (soft-pastel은 :root와 같이 쓰는 블록)
function block(id) {
  const re = new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}');
  const m = re.exec(css);
  assert.ok(m, id + ' 블록이 있어야 해요');
  const vars = {};
  m[1].replace(/--([a-z-]+):\s*([^;]+);/g, (_, k, v) => { vars[k] = v.trim(); });
  return vars;
}
const common = (() => { const m = /:root, \[data-theme\] \{([^}]*)\}/.exec(css); const v = {}; m[1].replace(/--([a-z-]+):\s*([^;]+);/g, (_, k, x) => { v[k] = x; }); return v; })();

function lum(h) {
  const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

test('테마 ID 6개, 순서와 이름', () => {
  assert.deepStrictEqual(T.THEMES.map((t) => t.id), IDS);
  for (const t of T.THEMES) assert.ok(t.name && t.desc);
  assert.strictEqual(T.byId('nope'), null);
});

test('기본값: 밝은 화면 → Soft Pastel, 다크 모드 → Cosmic Dream', () => {
  assert.strictEqual(T.defaultId(false), 'soft-pastel');
  assert.strictEqual(T.defaultId(true), 'cosmic-dream');
  assert.strictEqual(T.choose('no-such-theme'), false);
  // 저장이 막혀도(노드에는 localStorage 없음) 고른 값은 기억한다
  assert.strictEqual(T.save('forest-diary'), true);
  assert.strictEqual(T.current(), 'forest-diary');
  assert.strictEqual(T.chosen(), true);
});

test('app.css 가 쓰는 색 변수는 모든 테마에 다 있다', () => {
  const used = new Set([...appCss.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => m[1]));
  used.delete('font');
  for (const id of IDS) {
    const v = Object.assign({}, common, block(id));
    for (const k of used) assert.ok(k in v, id + ' 에 --' + k + ' 없음');
  }
});

test('app.css 에는 색 값을 직접 쓰지 않는다', () => {
  assert.doesNotMatch(appCss, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test('글자 대비: 본문 · 보조 글자 · 버튼 · 강조 카드 4.5:1 이상, 테두리 3:1 이상', () => {
  const pairs = [['text', 'bg', 4.5], ['text', 'surface', 4.5], ['text', 'raised', 4.5], ['sub', 'bg', 4.5], ['sub', 'surface', 4.5], ['sub', 'raised', 4.5],
    ['on-primary', 'primary', 4.5], ['tab-active', 'surface', 4.5], ['tint-text', 'tint', 4.5], ['tint-text', 'surface', 4.5],
    ['her-ink', 'her', 4.5], ['me-ink', 'me', 4.5], ['lv-half-text', 'lv-half', 4.5], ['lv-full-text', 'lv-full', 4.5], ['empty-text', 'empty', 4.5],
    ['warn', 'surface', 4.5], ['warn', 'raised', 4.5], ['toast-fg', 'toast-bg', 4.5], ['accent', 'surface', 3], ['accent', 'bg', 3], ['accent', 'raised', 3], ['lv-full', 'surface', 3]];
  for (const id of IDS) {
    const v = block(id);
    for (const [f, b, min] of pairs) {
      const r = contrast(v[f], v[b]);
      assert.ok(r >= min, `${id}: --${f} / --${b} = ${r.toFixed(2)} (< ${min})`);
    }
    // 켜진 스위치 · 지금 선: 카드 위 3:1, 그 위 흰 손잡이 3:1
    const strong = v.strong || v.primary;
    assert.ok(contrast(strong, v.surface) >= 3, id + ' --strong / --surface');
    assert.ok(contrast('#FFFFFF', strong) >= 3, id + ' 손잡이 / --strong');
  }
});

test('요청서 색: 바탕 · 카드 · 본문 글자 · 테두리는 그대로', () => {
  const spec = {
    'soft-pastel': ['#FFF8E7', '#FFFFFF', '#34313A', '#EEE8E7'], 'cosmic-dream': ['#101426', '#191D33', '#F4F2FF', '#30334B'],
    'ocean-breeze': ['#EAF8F7', '#FFFFFF', '#20343A', '#D4EAE7'], 'forest-diary': ['#F3F3E9', '#FFFFFF', '#30372E', '#E1E5D8'],
    'vintage-film': ['#F2E8D5', '#FAF5EC', '#39352E', '#E3D7C4'], 'blue-hour': ['#F0F2FC', '#FFFFFF', '#2D3450', '#DDE1F1']
  };
  for (const id of IDS) {
    const v = block(id);
    assert.deepStrictEqual([v.bg, v.surface, v.text, v.line], spec[id], id);
  }
});
