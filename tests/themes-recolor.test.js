// 색 바꿈 (11/24 종합 묶음 2, docs/themes-recolor) — tests.md R1 ~ R4.
// 캠핑 낮 · 밤, 프라하 낮의 버튼 계열 토큰만 바뀌고 다른 판은 하나도 안 바뀐다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const css = read('styles/tokens.css');
const rec = read('docs/themes-recolor/tokens-recolor.css');

function block(id) {
  const m = new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}').exec(css);
  assert.ok(m, id + ' 블록이 있어야 해요');
  const v = {};
  m[1].replace(/--([a-z-]+):\s*([^;]+);/g, (_, k, x) => { v[k] = x.trim(); });
  return { raw: m[1], v };
}
// tokens-recolor.css → { 판: { 토큰: 값 } }
const WANT = {};
rec.replace(/\[data-theme="([a-z-]+)"\]\{([^}]*)\}/g, (_, b, body) => {
  WANT[b] = {};
  body.replace(/--([a-z-]+):(#[0-9A-Fa-f]{6})/g, (__, k, x) => { WANT[b][k] = x.toUpperCase(); });
});
function lum(h) {
  const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('R1 세 판의 바뀐 토큰 = tokens-recolor.css · 나머지 토큰은 그대로', () => {
  assert.deepEqual(Object.keys(WANT).sort(), ['camping', 'camping-night', 'prague']);
  for (const [b, kv] of Object.entries(WANT)) {
    const { v } = block(b);
    assert.ok(Object.keys(kv).length >= 10, b);
    for (const [k, x] of Object.entries(kv)) assert.equal(v[k], x, `${b} --${k}`);
  }
  // 바꾸지 않은 토큰(그림 · 머리 장식 · 바탕 · 사람 색 포함)은 11/23 값 그대로
  const REST = { camping: 'de7d96bd76c2', 'camping-night': '17c0c86fa20f', prague: 'de51fb1f6c22' };
  for (const [b, h] of Object.entries(REST)) {
    const { v } = block(b);
    const rest = Object.entries(v).filter(([k]) => !(k in WANT[b])).map(([k, x]) => k + '=' + x).join(';');
    assert.equal(crypto.createHash('sha1').update(rest).digest('hex').slice(0, 12), h, b + ' 나머지 토큰이 바뀌었어요');
  }
});

test('R2 세 판 글자 20쌍 4.5:1 이상 (contrast.md)', () => {
  const pairs = [['text', 'bg'], ['text', 'surface'], ['text', 'raised'], ['sub', 'bg'], ['sub', 'surface'], ['sub', 'raised'], ['sub', 'tint'], ['on-primary', 'primary'],
    ['tint-text', 'tint'], ['tab-active', 'surface'], ['tab-active', 'tint'], ['strong', 'surface'], ['warn', 'surface'], ['me-ink', 'me'], ['her-ink', 'her'],
    ['both-ink', 'both'], ['empty-text', 'empty'], ['toast-fg', 'toast-bg'], ['text', 'empty'], ['sub', 'empty']];
  for (const b of Object.keys(WANT)) {
    const { v } = block(b);
    for (const [f, g] of pairs) assert.ok(contrast(v[f], v[g]) >= 4.5, `${b}: --${f} / --${g} = ${contrast(v[f], v[g]).toFixed(2)}`);
  }
});

test('R3 다른 판은 하나도 안 바뀜 — 11/23 새 도트 판 스냅숏 (프라하 밤 포함)', () => {
  const SNAP = { 'summer-sea': 'a53b9f1d6e1b', 'summer-sea-night': 'b715e7a63957', 'autumn-forest': '18fc9d4ce77b', 'autumn-forest-night': 'adafe290f2ea',
    'observatory': '0979d471ee7a', 'observatory-night': '83cf77fd2967', 'train-trip': 'e9e038d4ef18', 'train-trip-night': '4ad74c712c27',
    'tennis-court': '6d68da889bbf', 'tennis-court-night': 'daedb744c964', 'porto': '6f3a0be7584e', 'porto-night': '2de057546223',
    'prague-night': 'f8e6c1e2da1b', 'tuscany': '136af405646c', 'tuscany-night': '0eaeb5a7ff81', 'airport': 'a623949b86fc',
    'airport-night': '8ede5e889632', 'amusement-park': '1139e92f9c48', 'amusement-park-night': 'dc4dff14368c' };
  for (const [id, h] of Object.entries(SNAP)) assert.equal(crypto.createHash('sha1').update(block(id).raw).digest('hex').slice(0, 12), h, id + ' 토큰이 바뀌었어요');
  // 그 전 판들은 tests/themes-2026-11.test.js A6 스냅숏이 지킴
});

test('R4 시트 미리보기 카드 · 묶음 줄 색 띠는 그 판의 --primary 를 씀 (값을 따로 적지 않음)', () => {
  const view = read('js/view.js'), app = read('styles/app.css');
  assert.match(view, /tgl__strip[^\n]*data-theme="' \+ esc\(th\.day\)/);
  assert.match(app, /\.tgl__strip i \{[^}]*background: var\(--primary\)/);
  for (const x of ['#4A433A', '#EDE0C4', '#3F4E66', '#3E5E36', '#F29A4E', '#A8482A']) {
    assert.ok(!view.toUpperCase().includes(x), 'view.js 에 ' + x);
    assert.ok(!app.toUpperCase().includes(x), 'app.css 에 ' + x);
  }
});
