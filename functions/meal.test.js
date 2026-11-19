'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const M = require('./meal');
const { parseCases } = require('../scripts/test-ai');

test('D4 지시문: docs/diet/ai/parse-prompt.md 와 같은 내용 (식품표 자리만 {{TABLE}})', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'diet', 'ai', 'parse-prompt.md'), 'utf8');
  const head = doc.slice(0, doc.indexOf('## 식품표 이름'));
  assert.ok(M.PROMPT.startsWith(head), '규칙 · 출력 모양 · 짝짓기 · 정정 부분이 그대로');
  assert.match(M.PROMPT, /\{\{TABLE\}\}/);
  assert.match(M.systemPrompt('달걀(=계란), 사과'), /달걀\(=계란\), 사과/);
  assert.match(M.systemPrompt(''), /식약처 식품표에서 찾는다/);
  assert.doesNotMatch(M.systemPrompt('x'), /\{\{TABLE\}\}/);
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
});

test('D4 정리: 영양 숫자는 어디서든 지움 · kcalRange 는 남김 · 모양 · 개수 상한', () => {
  const r = M.sanitize({
    date: '2026-11-17', extra: 'x',
    meals: [{ at: '8:20', kind: 'meal', label: '아침', items: [{ name: '사과', amount: 1, unit: '개', kcal: 105, match: { kind: 'table', key: '사과' }, ingredients: [{ name: '설탕', protein: 3, 탄수: 9 }] }, { amount: 2 }] }, { at: 'x', kind: 'weird', items: 'no' }],
    unknowns: [{ path: '아침/사과', what: 'amount', kcalRange: [120, 40] }, { path: 'a', what: 'b', kcalRange: ['1', 2] }],
    corrections: [{ path: 'p', set: { name: '파베글라스', grams: 40, fat: 9 } }],
    learn: Array.from({ length: 30 }, () => ({ type: 'product', name: 'x', calories: 1 }))
  });
  assert.equal(r.extra, undefined);
  assert.equal(r.meals[0].at, '08:20'); assert.equal(r.meals[0].items.length, 1, '이름 없는 항목은 버림');
  assert.equal(r.meals[0].items[0].kcal, undefined); assert.equal(r.meals[0].items[0].ingredients[0].protein, undefined); assert.equal(r.meals[0].items[0].ingredients[0]['탄수'], undefined);
  assert.equal(r.meals[1].at, null); assert.equal(r.meals[1].kind, 'meal'); assert.deepEqual(r.meals[1].items, []);
  assert.deepEqual(r.unknowns[0].kcalRange, [40, 120]); assert.equal(r.unknowns[1].kcalRange, null);
  assert.equal(r.corrections[0].set.fat, undefined); assert.equal(r.corrections[0].set.grams, 40);
  assert.equal(r.learn.length, 20); assert.equal(r.learn[0].calories, undefined);
  assert.equal(M.sanitize(null), null);
});

test('D4 모델 부르기: 헤더 · 모델 · 온도 0 · 오류', async () => {
  let seen;
  const ok = async (url, o) => { seen = { url, o: o, b: JSON.parse(o.body) }; return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"meals":[]}' }], usage: { input_tokens: 10, output_tokens: 5 } }) }; };
  const out = await M.callModel('k', 'sys', 'user', ok);
  assert.equal(out.text, '{"meals":[]}');
  assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(seen.o.headers['x-api-key'], 'k'); assert.equal(seen.o.headers['anthropic-version'], '2023-06-01');
  assert.equal(seen.b.model, 'claude-haiku-5-5'); assert.equal(seen.b.temperature, 0); assert.equal(seen.b.system, 'sys');
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
});

test('D4 하루 횟수 문서(aiUse)는 앱이 못 읽고 못 씀 — 규칙에 없고 모두 열어 두는 규칙도 없음', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.doesNotMatch(rules, /aiUse/); assert.doesNotMatch(rules, /document=\*\*\}[^]*allow/);
});
