// 테마: 목록 · 기본값 · 색표가 빠짐없는지 · 글자 대비
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = require('../js/themes.js');

const IDS = ['soft-pastel', 'cosmic-dream', 'ocean-breeze', 'forest-diary', 'vintage-film', 'blue-hour', 'golden-hour', 'sakura-dream', 'midnight-noir', 'arctic-frost', 'chocolate-noir', 'roast-nuts', 'winter-knit', 'harvest'];
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

test('테마 ID 14개 (기존 6 + 신규 8), 순서와 이름', () => {
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
  for (const m of appCss.matchAll(/(--[a-z-]+):/g)) used.delete(m[1].slice(2)); // app.css 안에서 정하는 변수(빗금 --hatch 등)
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
  for (const id of Object.keys(spec)) {
    const v = block(id);
    assert.deepStrictEqual([v.bg, v.surface, v.text, v.line], spec[id], id);
  }
});

test('신규 테마 8종: 요청서 5색이 블록 안에 모두 쓰이고, 바탕은 Background 그대로', () => {
  // [Primary, Secondary, Background, Accent, Surface]
  const spec = {
    'golden-hour': ['#D99055', '#F2B880', '#F6E5C9', '#C96F62', '#E8C5A4'],
    'sakura-dream': ['#E6A0B4', '#F4CCD6', '#F6F0E8', '#A7BDA5', '#E6DDF0'],
    'midnight-noir': ['#292A32', '#454650', '#1D1E27', '#7C414C', '#30313B'],
    'arctic-frost': ['#B9DDE8', '#D8E9EF', '#F1F5F5', '#778FA8', '#FFFFFF'],
    'chocolate-noir': ['#49352F', '#765447', '#F3E8D7', '#A77D61', '#D8B99B'],
    'roast-nuts': ['#9D745B', '#D6AC83', '#FFF0C2', '#F4C95D', '#E8D77D'],
    'winter-knit': ['#B2DCD6', '#E7EDF0', '#F7F5F2', '#E8B6C5', '#DCC9BC'],
    'harvest': ['#A6A477', '#B5B581', '#F8F3DF', '#EAB45B', '#F1E2A1']
  };
  for (const id of Object.keys(spec)) {
    const v = block(id), used = new Set(Object.values(v));
    assert.strictEqual(v.bg, spec[id][2], id + ' 바탕');
    for (const hex of spec[id]) assert.ok(used.has(hex), id + ' 에 ' + hex + ' 없음');
    assert.strictEqual(T.byId(id).dark, id === 'midnight-noir', id + ' 어두운 테마 표시');
  }
});

// ── 나 · 상대 색 (테마마다, 내 계정에 저장) ──
test('사람 색 후보: 테마마다 8개, 앞 둘은 그 테마 --her · --me, 글자 4.5:1 이상', () => {
  for (const id of IDS) {
    const v = block(id), list = T.palette(id);
    assert.strictEqual(list.length, 8, id);
    assert.strictEqual(new Set(list).size, 8, id + ' 겹치는 색');
    assert.strictEqual(list[0], v.her, id + ' 첫 후보 = --her');
    assert.strictEqual(list[1], v.me, id + ' 둘째 후보 = --me');
    for (const hex of list) {
      assert.match(hex, /^#[0-9A-F]{6}$/);
      const r = T.contrast(hex, T.inkFor(id, hex));
      assert.ok(r >= 4.5, `${id} ${hex} 글자 대비 ${r.toFixed(2)}`);
      assert.ok(T.colorName(hex) !== hex, hex + ' 이름 없음');
    }
  }
});

test('저장된 색 다듬기: 모르는 테마 · 후보 밖 색 · 같은 색 쌍은 버린다', () => {
  const out = T.cleanColors({
    'ocean-breeze': { self: '#f2a48c', partner: '#123456' },
    'nope': { self: '#F2A48C' },
    'blue-hour': { self: '#E8A3B4', partner: '#E8A3B4' },
    'forest-diary': 'x'
  });
  assert.deepStrictEqual(out, { 'ocean-breeze': { self: '#F2A48C' } });
  assert.deepStrictEqual(T.cleanColors(null), {});
});

test('색 고르기: 테마마다 따로, 기본색이면 칸을 비우고, 상대 색을 고르면 서로 바뀐다', () => {
  // 준민 = 둘째 자리(me). 기본: 나 #7FC5C0, 상대 #399DA8
  let c = T.withPick({}, 'ocean-breeze', 'me', 'self', '#F2A48C');
  assert.deepStrictEqual(c, { 'ocean-breeze': { self: '#F2A48C' } });
  assert.deepStrictEqual(T.pairFor('ocean-breeze', c, 'me'), { self: '#F2A48C', partner: '#399DA8' });
  // 다른 테마는 그대로 기본색
  assert.deepStrictEqual(T.pairFor('blue-hour', c, 'me'), { self: '#A6AEE3', partner: '#7F8CBF' });
  // 상대 색을 내 색으로 → 서로 바뀜
  c = T.withPick(c, 'ocean-breeze', 'me', 'self', '#399DA8');
  assert.deepStrictEqual(T.pairFor('ocean-breeze', c, 'me'), { self: '#399DA8', partner: '#F2A48C' });
  // 기본으로 되돌리기
  assert.deepStrictEqual(T.withReset(c, 'ocean-breeze'), {});
  // 첫째 자리(다진)에서 보면 기본이 반대
  assert.deepStrictEqual(T.pairFor('ocean-breeze', {}, 'her'), { self: '#399DA8', partner: '#7FC5C0' });
  // 후보 밖 색 · 모르는 테마는 무시
  assert.deepStrictEqual(T.withPick({}, 'ocean-breeze', 'me', 'self', '#000000'), {});
  assert.deepStrictEqual(T.withPick({}, 'nope', 'me', 'self', '#F2A48C'), {});
});

test('한쪽만 고른 색이 다른 쪽 기본색과 같으면 그쪽이 비켜 준다', () => {
  // 나(me)가 상대 기본색(#399DA8)을 골라 두었다면 상대는 내 기본색으로
  assert.deepStrictEqual(T.pairFor('ocean-breeze', { 'ocean-breeze': { self: '#399DA8' } }, 'me'), { self: '#399DA8', partner: '#7FC5C0' });
});

test('저장 규칙의 테마 목록 = js/themes.js 목록', () => {
  const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  const m = /c\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)/.exec(rules);
  assert.ok(m, 'validColors 가 있어야 해요');
  assert.deepStrictEqual(m[1].split(',').map((x) => x.trim().replace(/'/g, '')), IDS);
  for (const id of IDS) assert.ok(rules.includes(`validPair(c['${id}'])`), id + ' 검사 없음');
});

test('시간표 「오늘」은 글자색 계열 — 사람 색 후보 · 함께 색과 다르다', () => {
  assert.match(common.today, /var\(--text\)/);
  assert.match(common['on-today'], /var\(--surface\)/);
  for (const id of IDS) {
    const v = block(id);
    // 오늘 원(글자색)은 무채색에 가깝고, 사람 색 후보 · 함께 색과는 밝기(2:1 이상)나 색 진하기로 갈린다
    const sat = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255); return Math.max(...c) - Math.min(...c); }; // 색 진하기(chroma)
    const today = /^#/.test(v.today || '') ? v.today : v.text;
    assert.ok(sat(today) < 0.15, id + ' 오늘 색이 무채색에 가까워야 해요');
    assert.ok(T.contrast(today, v.surface) >= 4.5, id + ' 오늘 원 글자 대비');
    for (const hex of T.palette(id).concat([v.tint, v.accent])) {
      const r = T.contrast(today, hex), sd = Math.abs(sat(hex) - sat(today));
      assert.ok(r >= 2 || sd >= 0.3, `${id}: 오늘(${today}) vs ${hex} — 대비 ${r.toFixed(2)}, 진하기 차 ${sd.toFixed(2)}`);
    }
  }
  assert.doesNotMatch(appCss, /\.scol\.is-today \{[^}]*--tint/);
  assert.doesNotMatch(appCss, /\.sday\.is-today \.sday__date \{[^}]*--primary/);
});

test('시간표 함께 색: --both = js/themes.js 의 both, 후보 중 하나지만 기본 사람 색은 아니고, 사람 색으로 못 고른다', () => {
  for (const id of IDS) {
    const v = block(id), both = T.bothColor(id);
    assert.strictEqual(v.both, both, id + ' --both');
    assert.strictEqual(v['both-ink'], T.inkFor(id, both), id + ' --both-ink');
    assert.ok(T.contrast(both, v['both-ink']) >= 4.5, id + ' 함께 블록 글자 대비');
    assert.ok(T.contrast(both, v.surface) >= 1.5, id + ' 함께 블록이 카드 바탕에서 보여야 해요');
    assert.ok(T.palette(id).indexOf(both) >= 2, id + ' 함께 색은 후보 셋째 이후');
    assert.deepStrictEqual(T.cleanColors({ [id]: { self: both } }), {}, id + ' 저장된 함께 색은 버림');
    assert.deepStrictEqual(T.withPick({}, id, 'me', 'self', both), {}, id + ' 함께 색은 못 고름');
  }
  assert.match(appCss, /\.sblock--both \{ background: var\(--both\); color: var\(--both-ink\); border-color: var\(--both\); \}/);
});
