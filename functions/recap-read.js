/* 결산 읽기 모듈 (docs/recap/spec.md 4절) — 저장소 컬렉션 → computeRecap 입력 모양. 컬렉션 이름 · 필드를 맞추는 곳은 여기 한 곳.
   fetchRaw(db, range): Firestore 에서 한 기간치 문서를 읽는다 (한 칸 범위 조건만 → 색인 추가 없음)
   toInput(raw, period): 읽은 문서 → 입력 모양 (순수 함수, 시험하기 쉽게)
   몸 정보(private/*)는 읽지 않는다. 식탁은 끼니의 「함께」 표시와 하루 칼로리 합만 본다. */
'use strict';
const N = require('./notify');
const R = require('./recap');
const D = require('./shared/dates');
const S = require('./shared/schedule');
const REGIONS = require('./regions.json');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const inRange = (s, r) => typeof s === 'string' && DATE.test(s) && s >= r.start && s <= r.end;
/** 「목표 맞춘 날」(가정): 끼니 기록이 있고 하루 칼로리가 목표의 90~110% (docs/recap/spec.md 「바뀐 것」) */
const GOAL_LO = 0.9, GOAL_HI = 1.1;

/** 시군구코드 → 카드에 쓸 이름 (「서울 성동구」 → 「성동구」, 「경기 수원시 장안구」 → 「수원시 장안구」) */
function regionName(code) {
  const full = REGIONS[code];
  if (!full) return String(code);
  const parts = full.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : full;
}

/** ISO 시각 → 서울 날짜 (이상하면 null) */
function kstDay(iso) {
  const t = new Date(iso);
  return typeof iso === 'string' && !isNaN(t.getTime()) ? N.kstParts(t).dateKey : null;
}

/**
 * @param raw { members: [{id, name}], couple: {start}|null, routines, checks, todos, kungs, events, places, meals, goals: [{id, kcal}], spends }
 *            (문서마다 { id, ...data })
 */
function toInput(raw, period) {
  const range = R.periodRange(period);
  const people = (raw.members || []).map((m) => ({ uid: m.id, name: m.name || '짝꿍' }));
  const uids = people.map((p) => p.uid);
  const coupleSince = raw.couple && DATE.test(String(raw.couple.start || '')) ? raw.couple.start : null;

  const routines = (raw.routines || []).map((r) => ({ key: r.id, owner: r.owner, name: r.name, start: r.start, end: r.end || null, rest: r.rest }));
  const checks = (raw.checks || []).filter((c) => c.done === true && typeof c.routine === 'string' && inRange(c.date, range)).map((c) => ({ key: c.routine, date: c.date }));

  const todos = (raw.todos || []).filter((t) => t.done === true).map((t) => ({ id: t.id, doneAt: kstDay(t.doneAt), doneBy: t.doneBy || null, shared: t.scope === 'together' }))
    .filter((t) => inRange(t.doneAt, range));

  const kungs = (raw.kungs || []).filter((k) => inRange(k.date, range)).map((k) => ({ at: k.date, from: k.from }));

  // 함께 일정: 매주 일정을 앱과 같은 규칙(functions/shared/schedule.js = js/schedule.js)으로 그날그날 펼친다
  const evs = S.fromDocs(raw.events || []);
  const events = [];
  for (const key of range.days) {
    for (const e of S.on(evs, D.parse(key))) {
      if (e.owner === 'both') events.push({ start: key + 'T' + e.start, end: key + 'T' + e.end, shared: true });
    }
  }

  const places = (raw.places || []).filter((p) => Array.isArray(p.visits) && p.visits.length).map((p) => ({
    code: p.id, name: regionName(p.id),
    visits: p.visits.filter((v) => v && typeof v.id === 'string' && DATE.test(String(v.date || ''))).map((v) => ({ id: v.id, date: v.date })),
    entries: p.entries && typeof p.entries === 'object' ? p.entries : {}
  }));

  // 식탁: 하루 문서 meals/{uid}_{date}. 함께 먹은 끼니 = 그날 두 사람 중 「함께」 끼니가 많은 쪽 수 (각자 적어도 두 번 세지 않게)
  const goalKcal = {};
  (raw.goals || []).forEach((g) => { if (typeof g.kcal === 'number' && g.kcal > 0) goalKcal[g.id] = g.kcal; });
  const togetherByDay = {};
  const goalDays = {};
  uids.forEach((u) => { goalDays[u] = []; });
  for (const doc of raw.meals || []) {
    if (!inRange(doc.date, range) || uids.indexOf(doc.uid) < 0 || !Array.isArray(doc.meals) || !doc.meals.length) continue;
    const n = doc.meals.filter((m) => m && m.together === true).length;
    togetherByDay[doc.date] = Math.max(togetherByDay[doc.date] || 0, n);
    const kcal = doc.meals.reduce((s, m) => s + ((m && m.total && typeof m.total.kcal === 'number') ? m.total.kcal : 0), 0);
    const g = goalKcal[doc.uid];
    if (g && kcal >= g * GOAL_LO && kcal <= g * GOAL_HI) goalDays[doc.uid].push(doc.date);
  }
  const meals = [];
  Object.keys(togetherByDay).sort().forEach((d) => { for (let i = 0; i < togetherByDay[d]; i++) meals.push({ date: d, shared: true }); });

  const spendCats = (raw.spendCats || []).filter((c) => typeof c.name === 'string' && /^c[a-z0-9]{2,23}$/.test(c.id)).map((c) => ({ id: c.id, label: c.name }));
  const spends = (raw.spends || []).filter((s) => inRange(s.date, range) && Number.isInteger(s.amount)).map((s) => ({
    date: s.date, amount: s.amount, paidBy: s.paidBy, shares: s.shares || undefined, cat: s.cat
  }));

  return { period, people, coupleSince, routines, checks, todos, kungs, events, places, meals, goalDays, spends, spendCats };
}

const docs = (q) => q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
async function getAll(ref) { return docs(await ref.get()); }

/** 한 기간치 문서 읽기. 기간마다: 날짜 범위 4번(checks · kungs · meals · spends) + 끝낸 일 1번 + 전체 7번 */
async function fetchRaw(db, range) {
  const between = (name, field) => db.collection(name).where(field, '>=', range.start).where(field, '<=', range.end);
  const startIso = new Date(range.start + 'T00:00:00+09:00').toISOString();
  const endIso = new Date(R.addDays(range.end, 1) + 'T00:00:00+09:00').toISOString();
  const couple = await db.doc('couple/main').get();
  const [members, routines, checks, todos, kungs, events, places, meals, goals, spends, spendCats] = await Promise.all([
    getAll(db.collection('members')),
    getAll(db.collection('routines')),
    getAll(between('checks', 'date')),
    getAll(db.collection('todos').where('doneAt', '>=', startIso).where('doneAt', '<', endIso)),
    getAll(between('kungs', 'date')),
    getAll(db.collection('events')),
    getAll(db.collection('places')),
    getAll(between('meals', 'date')),
    getAll(db.collection('goals')),
    getAll(between('spends', 'date')),
    getAll(db.collection('spendCats'))
  ]);
  return { members, couple: couple.exists ? couple.data() : null, routines, checks, todos, kungs, events, places, meals, goals, spends, spendCats };
}

async function loadPeriod(db, period) { return toInput(await fetchRaw(db, R.periodRange(period)), period); }

module.exports = { toInput, fetchRaw, loadPeriod, regionName, kstDay, GOAL_LO, GOAL_HI };
