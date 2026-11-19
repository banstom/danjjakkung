'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const M = require('./meal');
const { parseCases } = require('../scripts/test-ai');

test('D4 지시문: docs/diet/ai/parse-prompt.md 와 같은 내용 · 사용자 글은 지시문에 안 들어감', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'diet', 'ai', 'parse-prompt.md'), 'utf8');
  const head = doc.slice(0, doc.indexOf('## 식품표 이름'));
  assert.ok(M.PROMPT.startsWith(head), '규칙 · 출력 모양 · 짝짓기 · 정정 부분이 그대로');
  assert.equal(M.systemPrompt(), M.PROMPT.replace('{{TABLE}}', M.TABLE_RULE), '지시문은 고정');
  assert.equal(M.systemPrompt.length, 0, '받는 값 없음 (회귀: 사용자 table 이 지시문 자리에 들어가던 것)');
  const u = M.userMessage('2026-11-17', '상태', '입력', "달걀(=계란), $` $& 사과");
  assert.match(u, /^오늘은 2026-11-17\.\n식품표: 달걀\(=계란\), \$` \$& 사과\n상태: 상태\n입력:\n입력$/, '식품표는 사용자 글에 · $ 기호 그대로');
  assert.match(M.PROMPT, /영양 숫자\(kcal · 탄수 · 단백질 · 지방\)를 절대 내지 않는다/);
});

test('D4 받은 값 확인: 글 · 날짜 필수 · 길이 상한 · 몸 정보 칸 없음', () => {
  assert.equal(M.badInput({ text: '사과 1개', today: '2026-11-19' }), null);
  assert.ok(M.badInput(null)); assert.ok(M.badInput({ text: ' ', today: '2026-11-19' }));
  assert.ok(M.badInput({ text: 'a', today: '11/19' }));
  assert.ok(M.badInput({ text: 'a'.repeat(2001), today: '2026-11-19' }));
  assert.ok(M.badInput({ text: 'a', today: '2026-11-19', state: 'x'.repeat(6001) }));
  assert.ok(M.badInput({ text: 'a', today: '2026-11-19', state: {} }));
  const u = M.userMessage('2026-11-19', '', '사과');
  assert.doesNotMatch(u, /식품표:/);
  assert.match(u, /^오늘은 2026-11-19\.\n상태: .+\n입력:\n사과$/);
  const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const body = src.slice(src.indexOf('exports.parseMeal'));
  assert.doesNotMatch(body, /private\/|body\b|weightKg|heightCm/, '몸 정보는 읽지도 보내지도 않음');
  assert.match(body, /members\/\$\{uid\}/, '멤버만');
  assert.match(body, /secrets: \[ANTHROPIC_API_KEY\]/, '키는 Secret Manager');
});

test('D4 JSON 꺼내기: 코드펜스 · 앞뒤 말 · 깨진 것', () => {
  assert.deepEqual(M.extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(M.extractJson('여기요 {"a":{"b":2}} 끝'), { a: { b: 2 } });
  assert.equal(M.extractJson('{"a":'), null); assert.equal(M.extractJson(null), null); assert.equal(M.extractJson('없음'), null);
  // 회귀(T3 0/3): 주석 · 끝 쉼표 · 뒤에 붙은 말이나 두 번째 객체 — 문자열 안의 // 와 괄호는 그대로
  assert.deepEqual(M.extractJson('{\n  "a": 1, // 설명\n  "b": [1, 2,],\n  "u": "http://x.y/{z}"\n}\n설명 {끝}'), { a: 1, b: [1, 2], u: 'http://x.y/{z}' });
  assert.deepEqual(M.extractJson('{"a":"그\\"}"} {"b":2}'), { a: '그"}' });
  assert.deepEqual(M.extractJson('/* 앞 */ {"a": /* 안 */ 1}'), { a: 1 });
});

test('D4 정리: 남길 칸만 (영양 숫자 칸은 이름이 달라도 없음) · kcalRange 는 unknowns 에만 · 상한', () => {
  const r = M.sanitize({
    date: '2026-11-17', extra: 'x',
    meals: [{ at: '8:20', kind: 'meal', label: '아침', items: [
      { name: '사과', amount: 1, unit: '개', kcal: 105, carbohydrate: 27, '열량(kcal)': 105, 'Kcal ': 1, totalKcal: 3, nutrition: [105, 27], kcalRange: [1, 2], match: { kind: 'table', key: '사과', kcal: 1 },
        ingredients: [{ name: '설탕', amount: '2', protein: 3, '탄수화물(g)': 9 }], overrides: [{ name: '밥', grams: 420, fats: 1 }], portion: { num: 9, den: 16 }, memo: '오븐 170도', __proto__: { polluted: 1 } },
      { amount: 2 }] },
      { at: '1815', items: 'no' }, { at: '18:15:00' }, { at: '25:00' }],
    unknowns: [{ path: '아침/사과', what: 'amount', kcalRange: [120, 40] }, { item: '무당초콜릿', what: 'product_and_grams', kcalRange: ['0', '300'] }, { path: 'a', kcalRange: ['x', 2] }],
    corrections: [{ path: '아침/스크램블', set: { oil: '카놀라유', name: '파베글라스', grams: 40, fat: 9, ingredients: [{ name: '초코칩', grams: 40, kcal: 190 }] } }],
    learn: [{ type: 'food_unit', product: '파베글라스', unit: '줌', grams: 20, kcal: 96 }, { type: 'my_unit', unit: '공기', grams: '315' }, { name: 'type 없음' }].concat(Array.from({ length: 30 }, () => ({ type: 'product', name: 'x' })))
  });
  assert.equal(r.extra, undefined);
  const it = r.meals[0].items[0];
  assert.deepEqual(Object.keys(it).sort(), ['amount', 'grams', 'ingredients', 'match', 'memo', 'name', 'overrides', 'portion', 'unit']);
  assert.deepEqual(it.match, { kind: 'table', key: '사과' }); assert.deepEqual(it.portion, { num: 9, den: 16 });
  assert.deepEqual(it.ingredients, [{ name: '설탕', amount: 2, unit: null, grams: null, match: null }]);
  assert.deepEqual(it.overrides, [{ name: '밥', amount: null, unit: null, grams: 420, match: null }]);
  assert.equal({}.polluted, undefined);
  assert.equal(r.meals[0].items.length, 1, '이름 없는 항목은 버림');
  assert.deepEqual(r.meals.map((m) => m.at), ['08:20', '18:15', '18:15', null], '1815 · 18:15:00 도 읽음 · 25시는 버림');
  assert.deepEqual(r.unknowns[0].kcalRange, [40, 120]);
  assert.deepEqual(r.unknowns[1], { path: '무당초콜릿', what: 'product_and_grams', kcalRange: [0, 300] }, 'path 대신 item · 글자 숫자 범위도');
  assert.equal(r.unknowns[2].kcalRange, null);
  const set = r.corrections[0].set;
  assert.equal(set.oil, '카놀라유'); assert.equal(set.name, '파베글라스'); assert.equal(set.grams, 40); assert.equal(set.fat, undefined); assert.equal(set.ingredients[0].kcal, undefined);
  assert.deepEqual(r.learn[0], { type: 'food_unit', product: '파베글라스', unit: '줌', grams: 20 });
  assert.deepEqual(r.learn[1], { type: 'my_unit', unit: '공기', grams: 315 });
  const eq = M.sanitize({ learn: [{ type: 'my_unit', unit: '공기', equals: { amount: 1.5, unit: '개', match: { kind: 'table', key: '햇반' } } }, { type: 'my_unit', unit: '공기', grams: 315, means: { amount: 1.5, unit: '개', food: '햇반', kcal: 9 } }] }).learn;
  assert.deepEqual(eq[0].equals, { amount: 1.5, unit: '개', food: '햇반' }, '회귀(T7-2): 다른 음식 기준 내 단위가 지워지지 않음');
  assert.deepEqual(eq[1].equals, { amount: 1.5, unit: '개', food: '햇반' });
  assert.equal(r.learn.length, 19, 'type 없는 건 버림 · 20개까지');
  assert.doesNotMatch(JSON.stringify(r).replace(/"kcalRange":(\[[^\]]*\]|null)/g, ''), /kcal|carb|protein|fat|열량|탄수|단백질|지방|nutrition/i);
  assert.equal(M.sanitize(null), null); assert.equal(M.sanitize([1]), null);
});

test('D4 모델 부르기: 헤더 · 모델 · 온도 안 보냄 · 오류', async () => {
  let seen;
  const ok = async (url, o) => { seen = { url, o: o, b: JSON.parse(o.body) }; return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"meals":[]}' }], usage: { input_tokens: 10, output_tokens: 5 } }) }; };
  const out = await M.callModel('k', 'sys', 'user', ok);
  assert.equal(out.text, '{"meals":[]}'); assert.equal(out.stop, null);
  assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(seen.o.headers['x-api-key'], 'k'); assert.equal(seen.o.headers['anthropic-version'], '2023-06-01');
  assert.equal(seen.b.model, 'claude-haiku-5-5'); assert.equal(seen.b.temperature, undefined, 'Haiku 5.5 는 temperature 를 안 받음 (400)'); assert.equal(seen.b.system, 'sys');
  await assert.rejects(M.callModel('k', 's', 'u', async () => ({ ok: false, status: 529, json: async () => ({ error: { type: 'overloaded_error' } }) })), /529/);
});

test('D4 하루 횟수 키는 서울 날짜', () => {
  assert.equal(M.dayKey('u', Date.parse('2026-11-18T15:30:00Z')), 'u_2026-11-19');
  assert.equal(M.dayKey('u', Date.parse('2026-11-18T14:59:00Z')), 'u_2026-11-18');
});

test('D4 시험 A 문제 읽기: cases.md 7문제 · 상태 · 입력', () => {
  const cs = parseCases(fs.readFileSync(path.join(__dirname, '..', 'docs', 'diet', 'ai', 'cases.md'), 'utf8'));
  assert.deepEqual(cs.map((c) => c.name), ['T1', 'T2', 'T3', 'T4', 'T6', 'T7-1', 'T7-2']);
  assert.match(cs[0].input, /^11\.17\.\n아침 08:20/); assert.match(cs[0].input, /:\(바나나2개/);
  assert.match(cs[2].state, /앱이 물은 질문 3개/); assert.match(cs[2].input, /^스크램블 할 때/);
  assert.match(cs[4].input, /^1815 저녁/);
  // 회귀(점검 AI): 「T1과 같음」 「T4와 같음. …」 은 그 문제의 상태를 펼침
  assert.equal(cs[1].state, cs[0].state);
  assert.match(cs[4].state, /특 간계밥\(계란5 · 진간장2스푼 · 깨2꼬집 · 참기름1스푼 · 밥 630g\)/);
  assert.match(cs[5].state, /특 간계밥[^]*\(내 단위 공기는 아직 기본값 210g/);
  assert.match(cs[6].state, /특 간계밥[^]*오늘 기록에 점심/);
  assert.ok(cs.every((c) => !/^T[\w-]+(과|와) 같음/.test(c.state)));
});

test('D4 서버 함수: 실패 · 잘림이면 횟수 돌려줌 · 잘림은 따로 안내', () => {
  const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const body = src.slice(src.indexOf('exports.parseMeal'));
  assert.equal((body.match(/await refund\(\)/g) || []).length, 3, '모델 오류 · 잘림 · JSON 못 읽음');
  assert.match(body, /out\.stop === 'max_tokens'/);
  assert.ok(M.LIMITS.maxTokens >= 8000, '회귀(시험 A 2차): 2500 이면 T2 · T3 답이 잘림');
  assert.match(body, /M\.systemPrompt\(\)/, '지시문에 사용자 값 안 넣음');
});

test('D4 하루 횟수 문서(aiUse)는 앱이 못 읽고 못 씀 — 규칙에 없고 모두 열어 두는 규칙도 없음', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.doesNotMatch(rules, /aiUse/); assert.doesNotMatch(rules, /document=\*\*\}[^]*allow/);
});

test('D4 레시피 재료를 고친 정정 → learn 에도 (모델이 빠뜨려도) · 이미 있으면 안 겹침', () => {
  const r = M.sanitize({ corrections: [
    { path: '점심/특 간계밥/밥', set: { name: '밥', amount: 3, unit: '개', match: { kind: 'table', key: '햇반' } } },
    { path: '아침/달걀스크램블', set: { name: '달걀', amount: 3 } },
    { path: '아침/셀프메이드 브라우니/무당초콜릿', set: { name: '파베글라스', grams: 40 } }],
    learn: [{ type: 'recipe_ingredient', recipe: '셀프메이드 브라우니', ingredient: '무당초콜릿', grams: 40 }] });
  const ri = r.learn.filter((l) => l.type === 'recipe_ingredient');
  assert.equal(ri.length, 2, '항목 자체를 고친 건 레시피 재료 아님 · 이미 있는 건 안 겹침');
  assert.deepEqual(ri[1], { type: 'recipe_ingredient', recipe: '특 간계밥', ingredient: '밥', auto: true, amount: 3, unit: '개', food: '햇반' });
});

test('D4 모델이 적은 레시피 재료 learn 에 기준이 빠지면 정정에서 채움 (시험 A 5차 T3)', () => {
  const r = M.sanitize({ corrections: [{ path: '점심/특 간계밥/밥', set: { name: '밥', amount: 3, unit: '개', match: { kind: 'table', key: '햇반' } } }],
    learn: [{ type: 'recipe_ingredient', recipe: '특 간계밥', ingredient: '밥', amount: 3, unit: '개' }] });
  assert.deepEqual(r.learn, [{ type: 'recipe_ingredient', recipe: '특 간계밥', ingredient: '밥', amount: 3, unit: '개', food: '햇반' }]);
});
