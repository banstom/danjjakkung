/* 단짝 식탁 · 끼니 정리 (parseMeal) — 서버 함수가 쓰는 부분만 모은 순수 모듈 (시험하기 쉽게)
   - AI 는 구조 · 짝짓기 · 모르는 것만 낸다. 영양 숫자는 앱이 식품표에서 계산 (docs/diet/plan.md 「AI 처리」)
   - 몸 정보는 받지도 보내지도 않는다. 받는 것: 적은 글 · 오늘 날짜 · 상태(저장된 레시피 이름 · 내 단위 · 오늘 기록 · 물은 질문)
   - 지시문: functions/meal-prompt.md (docs/diet/ai/parse-prompt.md 와 같은 내용, {{TABLE}} 자리에 식품표 이름) */
'use strict';
const fs = require('fs');
const path = require('path');

const MODEL = 'claude-haiku-5-5';
const API = 'https://api.anthropic.com/v1/messages';
const LIMITS = { text: 2000, state: 6000, table: 3000, perDay: 40, maxTokens: 8000 };
const PROMPT = fs.readFileSync(path.join(__dirname, 'meal-prompt.md'), 'utf8');

/** 지시문은 고정 (사용자가 보낸 글은 지시문 자리에 넣지 않는다 — 점검 AI). 식품표 이름은 사용자 글의 「식품표:」 줄로 */
const TABLE_RULE = '사용자 글의 「식품표:」 줄에 적힌 이름. 그 줄이 없거나 거기 없는 일반 음식 · 재료는 흔히 부르는 이름을 그대로 key 로 쓴다 (예: 달걀, 사과, 햇반, 김치찌개). 앱이 식약처 식품표에서 찾는다.';
function systemPrompt() { return PROMPT.replace('{{TABLE}}', () => TABLE_RULE); }

/** 사용자 글 (docs/diet/ai/cases.md 와 같은 꼴 + 식품표 줄) */
function userMessage(today, state, text, table) {
  const t = typeof table === 'string' && table.trim() ? '식품표: ' + table.trim().slice(0, LIMITS.table) + '\n' : '';
  return '오늘은 ' + today + '.\n' + t + '상태: ' + (state || '저장된 레시피 · 내 식품 없음. 내 단위 모두 기본값') + '\n입력:\n' + text;
}

/** 받은 값 확인 — 틀리면 이유 문자열, 맞으면 null */
function badInput(d) {
  if (!d || typeof d !== 'object') return '내용이 없어요';
  if (typeof d.text !== 'string' || !d.text.trim()) return '적은 글이 없어요';
  if (d.text.length > LIMITS.text) return '글이 너무 길어요';
  if (typeof d.today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.today)) return '날짜가 이상해요';
  if (d.state != null && (typeof d.state !== 'string' || d.state.length > LIMITS.state)) return '상태가 너무 길어요';
  if (d.table != null && (typeof d.table !== 'string' || d.table.length > LIMITS.table)) return '식품표가 너무 길어요';
  return null;
}

/** 모델 답에서 JSON 하나를 꺼낸다 — 코드펜스 · 앞뒤 말 · 두 번째 객체 · // 주석 · 끝 쉼표가 붙어도 (T3 0/3 — 점검)
    문자열 안의 괄호 · // 는 건드리지 않는다 */
function firstObject(s) {
  const a = s.indexOf('{'); if (a < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = a; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) return s.slice(a, i + 1); }
  }
  return null;
}
function loosen(s) { // 문자열 밖의 // 주석 · /* */ 주석 · 끝 쉼표를 지운다
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 1; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}
function extractJson(t) {
  if (typeof t !== 'string') return null;
  const s = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const tries = [firstObject(s), firstObject(loosen(s))];
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) tries.push(s.slice(a, b + 1), loosen(s.slice(a, b + 1)));
  for (const x of tries) { if (!x) continue; try { const j = JSON.parse(x); if (j && typeof j === 'object' && !Array.isArray(j)) return j; } catch (e) { /* 다음 방법 */ } }
  return null;
}

/* 남길 칸만 정해 두고 나머지는 버린다 (점검 AI: 지울 키를 나열하면 carbohydrate · 열량(kcal) 같은 다른 이름이 샌다).
   영양 숫자 칸은 어디에도 없다. unknowns.kcalRange 만 숫자 범위로 남김 (물을지 정하는 데만 씀) */
const STR = 100;
const str = (x) => (typeof x === 'string' ? x.trim().slice(0, STR) : null);
const numv = (x) => { const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN; return isFinite(n) && n >= 0 && n < 1e6 ? n : null; };
const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);
const KINDS = ['table', 'food', 'new_recipe', 'new_product', 'supplement'];
function match(m) {
  if (!m || typeof m !== 'object') return null;
  return { kind: KINDS.indexOf(m.kind) >= 0 ? m.kind : null, key: str(m.key) };
}
function portion(p) {
  if (!p || typeof p !== 'object') return null;
  const num = numv(p.num), den = numv(p.den);
  return num != null && den ? { num, den } : null;
}
/** 항목 · 재료 · 바뀐 재료 한 줄 (deep = 재료 목록까지) */
function item(it, deep) {
  if (!it || typeof it !== 'object' || typeof it.name !== 'string' || !it.name.trim()) return null;
  const o = { name: str(it.name), amount: numv(it.amount), unit: str(it.unit), grams: numv(it.grams), match: match(it.match) };
  if (deep) {
    o.portion = portion(it.portion);
    o.ingredients = arr(it.ingredients, 30).map((x) => item(x, false)).filter(Boolean);
    o.overrides = arr(it.overrides, 30).map((x) => item(x, false)).filter(Boolean);
    o.memo = str(it.memo);
  }
  return o;
}
function setOf(x) { // 정정의 set: 끼니 · 항목 칸만
  if (!x || typeof x !== 'object') return {};
  const o = item(Object.assign({ name: x.name || '_' }, x), true) || {};
  if (!x.name) delete o.name;
  // 그 밖의 칸은 글자 값만 (예: { oil: '카놀라유' }) — 숫자는 amount · grams 같은 정해진 칸으로만
  Object.keys(x).forEach((k) => { if (!(k in o) && /^[A-Za-z_]{1,30}$/.test(k) && k !== '__proto__' && typeof x[k] === 'string') o[k] = str(x[k]); });
  return o;
}
const LEARN_STR = ['type', 'recipe', 'recipe_name', 'ingredient', 'ingredient_name', 'name', 'food', 'product', 'food_name', 'product_name', 'unit', 'unit_name', 'base', 'memo'];
const LEARN_NUM = ['amount', 'grams', 'count', 'value'];
function learnOf(x) {
  if (!x || typeof x !== 'object') return null;
  const o = {};
  LEARN_STR.forEach((k) => { if (typeof x[k] === 'string') o[k] = str(x[k]); });
  LEARN_NUM.forEach((k) => { if (x[k] != null && numv(x[k]) != null) o[k] = numv(x[k]); });
  // 「다른 음식 기준」 내 단위: equals (또는 means) = { amount, unit, food } (T7-2 — 정리하다 지워지던 것)
  const eq = x.equals && typeof x.equals === 'object' ? x.equals : x.means && typeof x.means === 'object' ? x.means : null;
  if (eq) {
    const m = match(eq.match);
    const e = { amount: numv(eq.amount), unit: str(eq.unit), food: str(eq.food) || str(eq.name) || (m && m.key) || null };
    if (e.amount != null || e.food) o.equals = e;
  }
  return o.type ? o : null;
}
function atOf(t) { // "8:20" · "08:20:00" · "1815" → "HH:MM", 범위 밖이면 null
  const m = typeof t === 'string' && (/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t.trim()) || /^(\d{2})(\d{2})$/.exec(t.trim()));
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return String(+m[1]).padStart(2, '0') + ':' + m[2];
}
function rangeOf(r) {
  if (!Array.isArray(r) || r.length !== 2) return null;
  const a = numv(r[0]), b = numv(r[1]);
  return a == null || b == null ? null : [Math.min(a, b), Math.max(a, b)];
}

/** 모양을 정리한다: 정해진 칸만, 개수 · 길이 상한, 영양 숫자 없음 */
function sanitize(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const meals = arr(d.meals, 12).filter((m) => m && typeof m === 'object').map((m) => ({
    at: atOf(m.at),
    kind: m.kind === 'snack' ? 'snack' : 'meal',
    label: str(m.label),
    items: arr(m.items, 30).map((it) => item(it, true)).filter(Boolean)
  }));
  const unknowns = arr(d.unknowns, 20).filter((u) => u && typeof u === 'object').map((u) => ({
    path: String(u.path || u.item || u.name || '').slice(0, 200), what: str(u.what) || '', kcalRange: rangeOf(u.kcalRange)
  }));
  const corrections = arr(d.corrections, 20).filter((c) => c && typeof c === 'object').map((c) => ({ path: String(c.path || '').slice(0, 200), set: setOf(c.set) }));
  const learn = arr(d.learn, 20).map(learnOf).filter(Boolean);
  // 레시피 재료를 고친 정정이면 learn 에도 (docs/diet/plan.md 11-18: 모델이 가끔 빠뜨림 → 앱 코드가 「레시피 재료를 고치면 레시피도 고침」).
  // 그 항목이 저장된(또는 이번에 만든) 레시피인지는 앱이 확인하고, 아니면 이 줄은 버린다 (auto: true)
  corrections.forEach((c) => {
    const seg = c.path.split('/').map((x) => x.trim()).filter(Boolean);
    if (seg.length !== 3 || (c.set.amount == null && c.set.grams == null)) return;
    const has = learn.find((l) => l.type === 'recipe_ingredient' && l.recipe && seg[1].indexOf(l.recipe) + l.recipe.indexOf(seg[1]) > -2 && l.ingredient === seg[2]);
    if (has) { // 모델이 적었지만 기준(햇반 등) · g 이 빠졌으면 정정에서 채움 (시험 A 5차 T3: 「밥 3개」만 있고 무엇 3개인지 없음)
      if (!has.food && c.set.match && c.set.match.key) has.food = c.set.match.key;
      if (has.grams == null && c.set.grams != null) has.grams = c.set.grams;
      if (has.amount == null && c.set.amount != null) { has.amount = c.set.amount; if (!has.unit && c.set.unit) has.unit = c.set.unit; }
      return;
    }
    if (learn.length >= 20) return;
    const l = { type: 'recipe_ingredient', recipe: seg[1].slice(0, STR), ingredient: seg[2].slice(0, STR), auto: true };
    if (c.set.amount != null) l.amount = c.set.amount;
    if (c.set.unit) l.unit = c.set.unit;
    if (c.set.grams != null) l.grams = c.set.grams;
    if (c.set.match && c.set.match.key) l.food = c.set.match.key;
    learn.push(l);
  });
  return {
    date: typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
    meals,
    unknowns,
    corrections,
    learn
  };
}

/** Anthropic Messages API 한 번 — fetchImpl 은 시험에서 바꿔 끼움 */
async function callModel(key, system, user, fetchImpl) {
  const f = fetchImpl || fetch;
  const res = await f(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: LIMITS.maxTokens, system, messages: [{ role: 'user', content: user }] })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { // 오류 이유(키는 들어 있지 않음)를 함께 — 크레딧 부족 · 모델 이름 등을 알 수 있게
    const er = body.error || {};
    const e = new Error('model ' + res.status + ' ' + (er.type || '') + ' ' + String(er.message || '').slice(0, 300)); e.status = res.status; throw e;
  }
  const text = (body.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { text, usage: body.usage || null, stop: body.stop_reason || null };
}

/** 하루 사용 횟수 문서 id (서울 날짜) */
function dayKey(uid, now) {
  const d = new Date((now || Date.now()) + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return uid + '_' + d;
}

module.exports = { MODEL, LIMITS, PROMPT, TABLE_RULE, systemPrompt, userMessage, badInput, extractJson, sanitize, callModel, dayKey };
