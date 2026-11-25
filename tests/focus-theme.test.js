// node --test tests/focus-theme.test.js — 집중 F1 테마 맞춤 (docs/focus/tests.md B1 · B2 · B3 · B6, contrast.md P1~P12 · G1~G2)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../js/themes.js');
const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'styles/tokens.css'), 'utf8');

function vars(body) { const v = {}; body.replace(/--([a-z0-9-]+):\s*([^;]+);/g, (_, k, x) => { v[k] = x.trim(); }); return v; }
const common = vars(/:root, \[data-theme\] \{([^}]*)\}/.exec(css)[1]);
/** 판 하나의 값 = 공통 블록 + 그 판 블록(들) — 같은 판을 가리키는 블록이 여럿이면 뒤가 이김 */
function board(id) {
  const re = new RegExp('\\[data-theme="' + id + '"\\]\\s*\\{([^}]*)\\}', 'g');
  let m, out = Object.assign({}, common), n = 0;
  while ((m = re.exec(css))) { Object.assign(out, vars(m[1])); n++; }
  assert.ok(n, id + ' 블록');
  for (let i = 0; i < 8; i++) for (const k of Object.keys(out)) { const r = /^var\(--([a-z0-9-]+)\)$/.exec(out[k]); if (r && out[r[1]]) out[k] = out[r[1]]; }
  return out;
}
function lum(h) { const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function cr(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const PAIRS = [['P1', 'text', 'surface', 4.5], ['P2', 'text', 'bg', 4.5], ['P3', 'sub', 'surface', 4.5], ['P4', 'sub', 'bg', 4.5], ['P5', 'both-ink', 'both', 4.5], ['P6', 'text', 'raised', 4.5],
  ['P7', 'tint-text', 'tint', 4.5], ['P8', 'on-primary', 'primary', 4.5], ['P9', 'tint-text', 'surface', 4.5], ['P10', 'her-ink', 'her', 4.5], ['P11', 'me-ink', 'me', 4.5], ['P12', 'sub', 'raised', 4.5],
  ['G1', 'focus-ring', 'focus-track', 3], ['G2', 'focus-ring', 'bg', 3]];
const BOARDS = T.THEMES.flatMap((t) => (t.skin === 'pixel' ? [t.id, t.id + '-night'] : [t.id]));

test('B1 새 토큰: 공통 블록에 --focus-ring · --focus-track, 판 블록 안에는 Cosmic Dream 말고 없음', () => {
  assert.equal(common['focus-ring'], 'var(--strong)');
  assert.equal(common['focus-track'], 'var(--empty)');
  const own = [...css.matchAll(/\[data-theme="([a-z-]+)"\]\s*\{([^}]*)\}/g)].filter((m) => /--focus-(ring|track)/.test(m[2])).map((m) => m[1]);
  assert.deepEqual(own, ['cosmic-dream']);
  assert.equal(board('cosmic-dream')['focus-ring'], board('cosmic-dream').accent);
});

test('B2 · B3 대비: 58판 × P1~P12 (4.5:1) · G1~G2 (3:1)', () => {
  assert.equal(BOARDS.length, 58, '기본 14 + 도트 22 × 낮 · 밤');
  const bad = [];
  for (const id of BOARDS) {
    const v = board(id);
    for (const [code, f, b, min] of PAIRS) {
      assert.ok(/^#[0-9a-fA-F]{6}$/.test(v[f] || '') && /^#[0-9a-fA-F]{6}$/.test(v[b] || ''), id + ' ' + code + ' 색 값 ' + v[f] + ' / ' + v[b]);
      const r = cr(v[f], v[b]);
      if (r < min) bad.push(`${id} ${code} ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, []);
  // 기획 계정이 계산한 가장 빠듯한 값 그대로 (contrast.md)
  assert.equal(cr(board('winter-knit')['focus-ring'], board('winter-knit')['focus-track']).toFixed(2), '3.18');
  assert.equal(cr(board('cosmic-dream')['focus-ring'], board('cosmic-dream')['focus-track']).toFixed(2), '3.50');
});

test('B6 도트가 아닌 테마: 집중 화면 그림 없음 · 도트 링 없음 (그림 · 도트 파일은 도트 테마에서만)', () => {
  for (const t of T.THEMES.filter((x) => x.skin !== 'pixel')) assert.equal(T.artFit('s3', 'x', 140, t.id), '', t.id);
  const app = fs.readFileSync(path.join(ROOT, 'js/app-focus.js'), 'utf8');
  assert.match(app, /host\.isPixel\(\) && root\.innerHeight >= 700/, 'S3 는 도트 테마 · 700px 이상에서만');
  assert.match(app, /pixelRing: host\.isPixel\(\)/, '픽셀 링은 도트 테마에서만');
});
