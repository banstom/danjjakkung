// 테마 시트 C안 (11/23) — docs/themes-sheet/tests.md 자동 S1 ~ S9
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/themes.js');
const V = require('../js/view.js');

const GROUP_IDS = ['season', 'travel', 'outing', 'basic'];
// spec 2절 표 (묶음 안 순서) — 아직 안 들어간 테마는 빠지고 순서만 지킴
const SPEC_ORDER = {
  season: ['spring-picnic', 'summer-sea', 'autumn-forest', 'winter-snack', 'merry-xmas'],
  travel: ['airport', 'train-trip', 'porto', 'prague', 'tuscany'],
  outing: ['observatory', 'tennis-court', 'amusement-park', 'camping']
};
// spec 3절 표
const SPEC_MONTH = {
  1: ['winter-snack', 'observatory'], 2: ['winter-snack', 'train-trip'], 3: ['spring-picnic', 'prague'], 4: ['spring-picnic', 'amusement-park'],
  5: ['spring-picnic', 'tennis-court'], 6: ['summer-sea', 'airport'], 7: ['summer-sea', 'camping'], 8: ['summer-sea', 'porto'],
  9: ['autumn-forest', 'tuscany'], 10: ['autumn-forest', 'camping'], 11: ['autumn-forest', 'winter-snack'], 12: ['merry-xmas', 'winter-snack']
};
const has = (id) => !!T.byId(id);

// app.js themeModel 과 같은 모양으로 시트 모델을 만든다
function model(current, open, date) {
  const card = (th) => Object.assign({}, th, { board: T.board(th.id, 'light'), day: T.dayBoard(th.id) });
  return {
    themes: T.THEMES.map(card),
    groups: T.groups().map((g) => ({ id: g.id, name: g.name, themes: g.themes.map(card) })),
    monthly: T.monthly(date || new Date('2026-11-23T03:00:00Z')).map((id) => card(T.byId(id))),
    month: T.seoulMonth(date || new Date('2026-11-23T03:00:00Z')),
    open: open === undefined ? T.groupOf(current) : open,
    current, colors: null, hasModes: T.hasModes(current), mode: 'auto', night: false, pixel: (T.byId(current) || {}).skin === 'pixel', font: 'pixel'
  };
}
const rows = (html) => [...html.matchAll(/<button type="button" class="tgl__row" data-act="theme-group" data-v="([a-z]+)" aria-expanded="(true|false)"( aria-controls="([^"]+)")?/g)]
  .map((m) => ({ id: m[1], open: m[2] === 'true', controls: m[4] || null }));
const groupCards = (html) => { const m = /<div class="tgrid tgl__cards" id="tg-([a-z]+)"[^>]*>([\s\S]*?)<\/div><(?:div|\/section)/.exec(html); return m ? { id: m[1], ids: [...m[2].matchAll(/data-act="pick-theme" data-v="([a-z-]+)"/g)].map((x) => x[1]) } : null; };

test('S1 모든 테마에 group — season · travel · outing · basic 중 하나', () => {
  for (const t of T.THEMES) assert.ok(GROUP_IDS.includes(t.group), t.id + ' group=' + t.group);
  // 도트가 아닌 기존 테마는 모두 basic, 도트 테마는 basic 이 아님
  for (const t of T.THEMES) assert.equal(t.group === 'basic', t.skin !== 'pixel', t.id);
  assert.equal(T.THEMES.filter((t) => t.group === 'basic').length, 14);
});

test('S2 묶음 순서 = 계절 · 기념일 → 여행 → 나들이 → 기본, 묶음 안 순서 = spec 2절 표', () => {
  assert.deepEqual(T.GROUPS.map((g) => g.id), GROUP_IDS);
  assert.deepEqual(T.GROUPS.map((g) => g.name), ['계절 · 기념일', '여행', '나들이', '기본']);
  const gs = T.groups();
  const ids = gs.map((g) => g.id);
  assert.deepEqual(ids, GROUP_IDS.filter((g) => ids.includes(g)), '빈 묶음은 빠져도 순서는 그대로');
  for (const g of gs) {
    const got = g.themes.map((t) => t.id);
    if (g.id === 'basic') assert.deepEqual(got, T.THEMES.filter((t) => t.group === 'basic').map((t) => t.id), '기본은 지금 목록 순서');
    else assert.deepEqual(got, SPEC_ORDER[g.id].filter(has), g.id);
  }
});

test('S3 시트를 열면 지금 테마가 든 묶음만 펼쳐짐 · S9 줄은 button + aria-expanded/aria-controls', () => {
  for (const cur of ['winter-snack', 'soft-pastel', 'cosmic-dream']) {
    const html = V.themeSheet(model(cur));
    const r = rows(html);
    assert.equal(r.filter((x) => x.open).length, 1, cur);
    assert.equal(r.find((x) => x.open).id, T.groupOf(cur));
    for (const x of r) assert.equal(x.controls, x.open ? 'tg-' + x.id : null, 'aria-controls 는 펼친 줄만');
    const gc = groupCards(html);
    assert.equal(gc.id, T.groupOf(cur));
    assert.ok(gc.ids.includes(cur), '펼친 카드에 지금 테마');
    assert.ok(html.includes('id="tg-' + gc.id + '"'), 'aria-controls 가 가리키는 칸이 있음');
  }
});

test('S4 다른 줄을 누르면 그 묶음만 · 펼친 줄을 다시 누르면 접힘 (펼침 값 하나)', () => {
  // app.js: state.themeGroup = 같은 값이면 '' 아니면 그 값 → 시트는 그 값 하나만 펼침
  const toggle = (now, g) => (now === g ? '' : g);
  let open = T.groupOf('winter-snack');
  open = toggle(open, 'basic');
  let r = rows(V.themeSheet(model('winter-snack', open)));
  assert.deepEqual(r.filter((x) => x.open).map((x) => x.id), ['basic']);
  assert.equal(groupCards(V.themeSheet(model('winter-snack', open))).ids.length, 14);
  open = toggle(open, 'basic');
  r = rows(V.themeSheet(model('winter-snack', open)));
  assert.equal(r.filter((x) => x.open).length, 0, '다시 누르면 접힘');
  assert.equal(groupCards(V.themeSheet(model('winter-snack', open))), null);
});

test('S5 이번 달 카드 = spec 3절 표, 서울 날짜 기준 (UTC 자정 근처)', () => {
  for (let m = 1; m <= 12; m++) {
    assert.deepEqual(T.MONTHLY[m], SPEC_MONTH[m], m + '월 표');
    // 서울 그달 1일 00:30 = UTC 전날 15:30 → 그달
    const first = new Date(Date.UTC(2026, m - 1, 1, 0, 30) - 9 * 3600000);
    assert.equal(T.seoulMonth(first), m, m + '월 1일 00:30 서울');
    // 서울 그달 1일 08:59 = UTC 그날 23:59 전날 → 그달
    assert.equal(T.seoulMonth(new Date(Date.UTC(2026, m - 1, 1, 8, 59) - 9 * 3600000)), m);
    // 서울 그달 1일 직전(전달 말일 23:59) → 전달
    assert.equal(T.seoulMonth(new Date(first.getTime() - 31 * 60000)), m === 1 ? 12 : m - 1);
    assert.deepEqual(T.monthly(first), SPEC_MONTH[m].filter(has));
  }
  // 12월 → 크리스마스 · 겨울 간식 (둘 다 들어가 있음)
  assert.deepEqual(T.monthly(new Date('2026-11-30T15:00:00Z')), ['merry-xmas', 'winter-snack']);
});

test('S6 표의 테마가 없으면 그 칸만 빠지고, 둘 다 없으면 「○월에 어울리는 테마」가 안 보임', () => {
  const nov = new Date('2026-11-10T03:00:00Z');
  const html = V.themeSheet(model('soft-pastel', undefined, nov));
  const monthCards = (h) => { const m = /<section class="tset tset--month"[\s\S]*?<\/section>/.exec(h); return m ? [...m[0].matchAll(/data-v="([a-z-]+)"/g)].map((x) => x[1]) : null; };
  assert.match(html, /11월에 어울리는 테마/);
  assert.deepEqual(monthCards(html), SPEC_MONTH[11].filter(has));
  // 둘 다 없는 달을 흉내: 모델의 monthly 를 비움 → 칸 전체가 없음
  const empty = Object.assign(model('soft-pastel', undefined, nov), { monthly: [] });
  assert.equal(monthCards(V.themeSheet(empty)), null);
  assert.doesNotMatch(V.themeSheet(empty), /어울리는 테마/);
  // 지금 있는 테마로 둘 다 빠지는 달이 있다면 monthly() 도 빈 배열
  for (let m = 1; m <= 12; m++) if (!SPEC_MONTH[m].some(has)) assert.deepEqual(T.monthly(new Date(Date.UTC(2026, m - 1, 15))), []);
});

test('S7 묶음 줄 개수 · 이름 나열 · 색 띠 칸 수 = 실제 들어간 테마 수', () => {
  const html = V.themeSheet(model('soft-pastel', ''));
  const blocks = [...html.matchAll(/<button type="button" class="tgl__row"[\s\S]*?<\/button>/g)].map((m) => m[0]);
  const gs = T.groups();
  assert.equal(blocks.length, gs.length);
  gs.forEach((g, i) => {
    const b = blocks[i];
    assert.match(b, new RegExp('<span class="tgl__title">' + g.name + ' · ' + g.themes.length + '</span>'));
    const strip = (b.match(/<i data-theme="[^"]+"><\/i>/g) || []).length;
    assert.equal(strip, Math.min(5, g.themes.length), g.id + ' 색 띠');
    // 색 띠 칸 = 그 테마 낮 판
    const boards = [...b.matchAll(/<i data-theme="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(boards, g.themes.slice(0, 5).map((t) => T.dayBoard(t.id)));
    const names = /<small class="tgl__names">([^<]*)<\/small>/.exec(b)[1];
    if (g.id === 'basic') assert.equal(names, g.themes.slice(0, 2).map((t) => t.ko).join(' · ') + ' 외 ' + (g.themes.length - 2));
    else assert.equal(names, g.themes.map((t) => t.ko).join(' · '));
  });
});

test('S8 「다른 테마 더 보기」 없음 · 「앞 네 장」 코드 없음', () => {
  const html = V.themeSheet(model('winter-snack'));
  assert.doesNotMatch(html, /더 보기|theme-more|tset__more/);
  const fs = require('fs'), path = require('path');
  for (const f of ['js/view.js', 'js/app.js', 'styles/app.css', 'styles/pixel.css']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.doesNotMatch(src, /FEATURED|theme-more|themeMore|tset__more/, f);
  }
});

test('시트 위에서 아래 순서: 낮 · 밤 → 이번 달 → 모든 테마 → 글씨체 → 사람 색', () => {
  const html = V.themeSheet(Object.assign(model('winter-snack'), { colors: null }));
  const at = (s) => html.indexOf(s);
  assert.ok(at('tmode-title') < at('tmonth-title') && at('tmonth-title') < at('tpick-title') && at('tpick-title') < at('tfont-title'));
  assert.match(html, /<h3 id="tpick-title" class="tset__sec">모든 테마<\/h3>/);
});
