/* 단짝 식탁 · 끼니 정리 (parseMeal) — 서버 함수가 쓰는 부분만 모은 순수 모듈 (시험하기 쉽게)
   - AI 는 구조 · 짝짓기 · 모르는 것만 낸다. 영양 숫자는 앱이 식품표에서 계산 (docs/diet/plan.md 「AI 처리」)
   - 몸 정보는 받지도 보내지도 않는다. 받는 것: 적은 글 · 오늘 날짜 · 상태(저장된 레시피 이름 · 내 단위 · 오늘 기록 · 물은 질문)
   - 지시문: functions/meal-prompt.md (docs/diet/ai/parse-prompt.md 와 같은 내용, {{TABLE}} 자리에 식품표 이름) */
'use strict';
const fs = require('fs');
const path = require('path');

const MODEL = 'claude-haiku-5-5';
const API = 'https://api.anthropic.com/v1/messages';
const LIMITS = { text: 2000, state: 6000, table: 3000, perDay: 40, maxTokens: 2500 };
const DEFAULT_TABLE = '정해진 목록 없음 — 일반 음식 · 재료는 흔히 부르는 이름을 그대로 key 로 쓴다 (예: 달걀, 사과, 햇반, 김치찌개). 앱이 식약처 식품표에서 찾는다.';
const PROMPT = fs.readFileSync(path.join(__dirname, 'meal-prompt.md'), 'utf8');

/** 지시문: 식품표 이름 목록을 끼워 넣는다 (없으면 일반 안내) */
function systemPrompt(table) {
  const t = typeof table === 'string' && table.trim() ? table.trim().slice(0, LIMITS.table) : DEFAULT_TABLE;
  return PROMPT.replace('{{TABLE}}', t);
}

/** 사용자 글 (docs/diet/ai/cases.md 와 같은 꼴) */
function userMessage(today, state, text) {
  return '오늘은 ' + today + '.\n상태: ' + (state || '저장된 레시피 · 내 식품 없음. 내 단위 모두 기본값') + '\n입력:\n' + text;
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

/** 모델 답에서 JSON 하나를 꺼낸다 (코드펜스 · 앞뒤 말이 붙어도) */
function extractJson(t) {
  if (typeof t !== 'string') return null;
  let s = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

const NUM_KEYS = /^(kcal|carb|carbs|protein|fat|calories|energy|탄수|탄수화물|단백질|지방|열량|칼로리)$/i;
/** 영양 숫자는 어디에 있든 지운다 (unknowns 의 kcalRange 는 「물을지」 정하는 데만 씀 — 남김) */
function stripNumbers(o) {
  if (Array.isArray(o)) return o.map(stripNumbers);
  if (!o || typeof o !== 'object') return o;
  const out = {};
  Object.keys(o).forEach((k) => { if (!NUM_KEYS.test(k)) out[k] = stripNumbers(o[k]); });
  return out;
}

const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);
/** 모양을 정리한다: 정해진 칸만, 개수 상한, 영양 숫자 없음 */
function sanitize(d) {
  if (!d || typeof d !== 'object') return null;
  const meals = arr(d.meals, 12).filter((m) => m && typeof m === 'object').map((m) => ({
    at: typeof m.at === 'string' && /^\d{1,2}:\d{2}$/.test(m.at) ? m.at.padStart(5, '0') : null,
    kind: m.kind === 'snack' ? 'snack' : 'meal',
    label: typeof m.label === 'string' ? m.label.slice(0, 20) : null,
    items: arr(m.items, 30).filter((it) => it && typeof it === 'object' && typeof it.name === 'string').map((it) => stripNumbers(it))
  }));
  const unknowns = arr(d.unknowns, 20).filter((u) => u && typeof u === 'object').map((u) => {
    const r = Array.isArray(u.kcalRange) && u.kcalRange.length === 2 && u.kcalRange.every((x) => typeof x === 'number' && isFinite(x)) ? [Math.min(u.kcalRange[0], u.kcalRange[1]), Math.max(u.kcalRange[0], u.kcalRange[1])] : null;
    return { path: String(u.path || '').slice(0, 200), what: String(u.what || '').slice(0, 40), kcalRange: r };
  });
  return {
    date: typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
    meals,
    unknowns,
    corrections: stripNumbers(arr(d.corrections, 20)),
    learn: stripNumbers(arr(d.learn, 20))
  };
}

/** Anthropic Messages API 한 번 — fetchImpl 은 시험에서 바꿔 끼움 */
async function callModel(key, system, user, fetchImpl) {
  const f = fetchImpl || fetch;
  const res = await f(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: LIMITS.maxTokens, temperature: 0, system, messages: [{ role: 'user', content: user }] })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error('model ' + res.status + ' ' + ((body.error && body.error.type) || '')); e.status = res.status; throw e; }
  const text = (body.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { text, usage: body.usage || null };
}

/** 하루 사용 횟수 문서 id (서울 날짜) */
function dayKey(uid, now) {
  const d = new Date((now || Date.now()) + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return uid + '_' + d;
}

module.exports = { MODEL, LIMITS, DEFAULT_TABLE, PROMPT, systemPrompt, userMessage, badInput, extractJson, stripNumbers, sanitize, callModel, dayKey };
