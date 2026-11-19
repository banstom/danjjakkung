/* 월말 · 연말결산 숫자 계산 (docs/recap/spec.md) — 서버 함수 monthlyRecap 이 결과를 recaps/{key} 에 그대로 저장하고,
   카드 화면은 그 문서만 읽는다 (문구는 앱 js/recap-text.js).
   날짜는 모두 서울 기준 'YYYY-MM-DD' 문자열.

   computeRecap(data, prevData) — data = {
     period:      { kind: 'month', key: '2026-11' } | { kind: 'year', key: '2026' }
     people:      [{ uid, name }, { uid, name }]       순서 상관없음 (화면이 보는 사람을 먼저)
     coupleSince: 'YYYY-MM-DD'
     routines:    routines 문서 그대로 [{ key, owner, name, start, end?, rest? }]   (저장소 모양 — 요일 없음, 쉬기 기간)
     checks:      [{ key, date }]                        해낸 기록만 (checks 문서의 routine → key)
     todos:       [{ id, doneAt: 'YYYY-MM-DD' | null, doneBy, shared }]
     kungs:       [{ at: 'YYYY-MM-DD', from }]
     events:      [{ start: 'YYYY-MM-DDTHH:mm', end, shared }]   기간 안의 실제 일정 (매주 일정은 읽기 모듈이 펼쳐 줌)
     places:      [{ code, name, visits: [{ id, date }], entries: { uid: { visitId: { stars, note } } } }]
     meals:       [{ date, shared }]
     goalDays:    { uid: ['YYYY-MM-DD'] }               식단 기능이 판단한 '목표 맞춘 날'만 (몸 정보 없음)
     spends:      단짝 영수증 기록 (아직 없으면 [])
   }
   prevData = 바로 앞 기간의 같은 모양 (없으면 null → 비교 숫자 없음) */
'use strict';
const N = require('./notify');
const L = require('./ledger-sum');

// ── 날짜 ──
const D = (s) => new Date(s + 'T00:00:00Z');
const S = (d) => d.toISOString().slice(0, 10);
function addDays(s, n) { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return S(d); }
/** 월요일 0 … 일요일 6 */
function weekday(s) { return (D(s).getUTCDay() + 6) % 7; }
function daysBetween(a, b) { return Math.round((D(b) - D(a)) / 86400000); }
/** 기간 → { start, end, days[] } */
function periodRange(period) {
  let start, end;
  if (period.kind === 'month') {
    const [y, m] = period.key.split('-').map(Number);
    start = `${period.key}-01`;
    end = S(new Date(Date.UTC(y, m, 0)));
  } else {
    start = `${period.key}-01-01`;
    end = `${period.key}-12-31`;
  }
  const days = [];
  for (let s = start; s <= end; s = addDays(s, 1)) days.push(s);
  return { start, end, days };
}
/** 바로 앞 기간 */
function prevPeriod(period) {
  if (period.kind === 'year') return { kind: 'year', key: String(Number(period.key) - 1) };
  const [y, m] = period.key.split('-').map(Number);
  return { kind: 'month', key: `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}` };
}
const inRange = (s, r) => typeof s === 'string' && s >= r.start && s <= r.end;
/** '가장 많은 날' — 같으면 이른 날 */
function busiestDay(dates) {
  const n = {};
  for (const d of dates) n[d] = (n[d] || 0) + 1;
  let best = null;
  for (const [d, c] of Object.entries(n)) if (!best || c > best.count || (c === best.count && d < best.date)) best = { date: d, count: c };
  return best;
}

// ── 카드 2 · 3 루틴 ── 「모두」 = 루틴 탭 달력과 같은 규칙 (js/model.js dayLevel, 서버 쪽 규칙은 functions/notify.js)
const doneSet = (checks) => new Set((checks || []).map((c) => c.key + '|' + c.date));

/** 하루 「모두」 단계 — js/model.js dayLevel 과 같은 값: 'full' | 'half' | 'none' | 'rest' | 'pre' */
function dayLevel(routines, persons, d, done) {
  const active = routines.filter((r) => N.activeOn(r, d));
  if (!active.length) return routines.some((r) => N.aliveOn(r, d) && N.restOn(r, d)) ? 'rest' : 'pre';
  const doneN = active.filter((r) => done.has(r.key + '|' + d)).length;
  // 그날 참여 중인 사람 = 그만두지 않은 루틴이 있는 사람 (시작 전 루틴 포함), 그날 루틴이 모두 쉬는 사람은 뺀다
  const joined = persons.filter((p) => {
    const mine = routines.filter((r) => r.owner === p && (!r.end || r.end >= d));
    if (!mine.length) return false;
    const alive = mine.filter((r) => N.aliveOn(r, d));
    return !(alive.length && alive.every((r) => N.restOn(r, d)));
  });
  const everyone = joined.every((p) => {
    const mine = active.filter((r) => r.owner === p);
    return mine.length > 0 && mine.every((r) => done.has(r.key + '|' + d));
  });
  return everyone ? 'full' : doneN > 0 ? 'half' : 'none';
}

/** 날마다 단계. 해야 할 루틴이 하나도 없는 날(쉬기 · 시작 전)은 state = null (달력 빈 칸) */
function dayStates(range, rawRoutines, checks, uids) {
  const routines = N.cleanRoutines(rawRoutines);
  const done = doneSet(checks);
  return range.days.map((date) => {
    const lv = dayLevel(routines, uids, date, done);
    return { date, state: lv === 'rest' || lv === 'pre' ? null : lv };
  });
}

function togetherCard(period, data) {
  const states = dayStates(periodRange(period), data.routines, data.checks, data.uids);
  const counted = states.filter((s) => s.state !== null);
  if (!counted.length) return null;
  let streak = 0, best = 0;
  for (const s of states) {
    if (s.state === 'full') { streak++; best = Math.max(best, streak); }
    else if (s.state !== null) streak = 0; // 해야 할 루틴이 없던 날은 이어짐을 끊지 않음
  }
  const out = { id: 'together', fullDays: states.filter((s) => s.state === 'full').length, countedDays: counted.length, longestStreak: best, states };
  if (period.kind === 'year') {
    // 가장 잘 해낸 달 = 「모두」 해낸 날이 가장 많은 달 (같으면 이른 달)
    const byMonth = {};
    for (const s of states) if (s.state === 'full') byMonth[s.date.slice(0, 7)] = (byMonth[s.date.slice(0, 7)] || 0) + 1;
    const top = Object.entries(byMonth).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    out.bestMonth = top ? { month: Number(top[0].slice(5)), fullDays: top[1] } : null;
  }
  return out;
}

/** 루틴 하나의 기간 성적 — 해야 했던 날 = 하고 있던 날 (시작 후 · 그만두기 전 · 쉬는 날 아님) */
function routineScore(r, range, done) {
  const due = range.days.filter((d) => N.activeOn(r, d));
  const ok = due.filter((d) => done.has(r.key + '|' + d)).length;
  return { due: due.length, done: ok, pct: due.length ? Math.round(ok / due.length * 100) : 0 };
}

/** 사람마다 가장 잘 지킨 루틴 — 해야 했던 날 4일 이상 중 % 높은 것 (같으면 해야 했던 날 많은 것 → 이름) */
function bestRoutine(period, data, uid) {
  const range = periodRange(period);
  const done = doneSet(data.checks);
  const rows = N.cleanRoutines(data.routines).filter((r) => r.owner === uid)
    .map((r) => Object.assign({ key: r.key, name: String(r.name || '') }, routineScore(r, range, done)))
    .filter((x) => x.due >= 4);
  rows.sort((a, b) => b.pct - a.pct || b.due - a.due || a.name.localeCompare(b.name, 'ko'));
  return rows[0] || null;
}

function routinesCard(period, data, prevData) {
  const people = data.uids.map((uid) => {
    const best = bestRoutine(period, data, uid);
    if (!best) return null;
    let diff = null;
    if (prevData) {
      const r = N.cleanRoutines(prevData.routines).find((x) => x.key === best.key);
      if (r) {
        const p = routineScore(r, periodRange(prevData.period), doneSet(prevData.checks));
        if (p.due >= 4) diff = best.pct - p.pct;
      }
    }
    return Object.assign({ uid }, best, { diff });
  });
  if (people.every((p) => p === null)) return null;
  return { id: 'routines', people };
}

// ── 카드 4 · 5 · 6 ──
function todosCard(period, data) {
  const r = periodRange(period);
  const done = (data.todos || []).filter((t) => t.doneAt && inRange(t.doneAt, r));
  if (!done.length) return null;
  const by = {};
  data.uids.forEach((u) => { by[u] = done.filter((t) => t.doneBy === u).length; });
  return { id: 'todos', total: done.length, shared: done.filter((t) => t.shared).length, byPerson: by, busiest: busiestDay(done.map((t) => t.doneAt)) };
}

function kungsCard(period, data) {
  const r = periodRange(period);
  const ks = (data.kungs || []).filter((k) => inRange(k.at, r));
  if (!ks.length) return null;
  const by = {};
  data.uids.forEach((u) => { by[u] = ks.filter((k) => k.from === u).length; });
  return { id: 'kungs', total: ks.length, byPerson: by, busiest: busiestDay(ks.map((k) => k.at)) };
}

const mins = (s) => Date.parse(s + ':00Z') / 60000;
/** 함께 일정 시간(분) — 겹치면 합쳐 한 번만, 기간 밖은 잘라 냄 */
function sharedMinutes(period, events) {
  const r = periodRange(period);
  const lo = mins(`${r.start}T00:00`);
  const hi = mins(`${r.end}T00:00`) + 24 * 60;
  const iv = (events || []).filter((e) => e.shared)
    .map((e) => [Math.max(lo, mins(e.start)), Math.min(hi, mins(e.end))])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0, cur = null;
  for (const [a, b] of iv) {
    if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b]; }
    else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

function timeCard(period, data) {
  const m = sharedMinutes(period, data.events);
  if (m <= 0) return null;
  const r = periodRange(period);
  const count = (data.events || []).filter((e) => e.shared && inRange(String(e.start).slice(0, 10), r)).length;
  return { id: 'time', minutes: m, hours: Math.round(m / 60), count };
}

// ── 카드 7 지도 ── 방문마다 각자 별점 + 메모 (v55 구조)
function placesCard(period, data) {
  const r = periodRange(period);
  const visits = [];
  const newPlaces = [];
  for (const p of data.places || []) {
    const sorted = (p.visits || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (sorted.length && inRange(sorted[0].date, r)) newPlaces.push(p.name);
    for (const v of sorted) {
      if (!inRange(v.date, r)) continue;
      const per = data.uids.map((u) => {
        const e = p.entries && p.entries[u] && p.entries[u][v.id];
        return { uid: u, stars: e && typeof e.stars === 'number' ? e.stars : null, note: (e && e.note) || '' };
      });
      const st = per.map((x) => x.stars).filter((x) => x !== null);
      visits.push({ code: p.code, name: p.name, date: v.date, per, avg: st.length ? st.reduce((a, b) => a + b, 0) / st.length : null });
    }
  }
  if (!visits.length) return null;
  const rated = (v) => v.per.filter((x) => x.stars !== null).length;
  // 별점 가장 높은 방문: 평균 → 별점 개수 → 늦은 날
  const best = visits.filter((v) => v.avg !== null).sort((a, b) => b.avg - a.avg || rated(b) - rated(a) || (a.date < b.date ? 1 : -1))[0] || null;
  const out = { id: 'places', visits: visits.length, places: new Set(visits.map((v) => v.code)).size, newPlaces, best };
  if (period.kind === 'year') {
    // 올해 별점 1위 지역 = 그 해 별점 전체 평균 (같으면 방문 많은 곳)
    const by = {};
    for (const v of visits) for (const x of v.per) if (x.stars !== null) {
      by[v.code] = by[v.code] || { name: v.name, sum: 0, n: 0, visits: new Set() };
      by[v.code].sum += x.stars; by[v.code].n++; by[v.code].visits.add(v.date);
    }
    const top = Object.values(by).sort((a, b) => b.sum / b.n - a.sum / a.n || b.visits.size - a.visits.size)[0];
    out.topRegion = top ? { name: top.name, avg: Math.round(top.sum / top.n * 10) / 10 } : null;
  }
  return out;
}

// ── 카드 8 식탁 ── 몸 정보 · 체중 · 칼로리 숫자는 넣지 않는다
function mealsCard(period, data) {
  const r = periodRange(period);
  const shared = (data.meals || []).filter((m) => m.shared && inRange(m.date, r)).length;
  const goal = {};
  data.uids.forEach((u) => { goal[u] = ((data.goalDays && data.goalDays[u]) || []).filter((d) => inRange(d, r)).length; });
  if (shared === 0 && Object.values(goal).every((n) => n === 0)) return null;
  return { id: 'meals', sharedMeals: shared, goalDays: goal };
}

// ── 카드 9 단짝 영수증 ── 영수증 화면과 같은 모듈 (functions/ledger-sum.js = js/ledger-sum.js)
function spendsCard(period, data) {
  const r = periodRange(period);
  const list = (data.spends || []).filter((s) => inRange(s.date, r));
  if (!list.length) return null;
  const [a, b] = data.people;
  const s = L.monthSummary(list, { me: a, partner: b });
  const top = s.cats[0];
  return {
    id: 'spends', total: s.total, count: list.length,
    byPerson: { [a.uid]: { amount: s.me.amount, pct: s.me.pct }, [b.uid]: { amount: s.partner.amount, pct: s.partner.pct } },
    topCat: s.topCat, topCatAmount: top ? top.amount : 0,
    topCatCount: top ? list.filter((x) => (L.CATS.indexOf(x.cat) >= 0 ? x.cat : 'etc') === top.cat).length : 0
  };
}

/** 비교 숫자: 앞 기간이 없으면 null */
function diff(cur, prev) { return prev === null || prev === undefined ? null : cur - prev; }

function withUids(d) { return d && Object.assign({}, d, { uids: d.people.map((p) => p.uid) }); }

function computeRecap(rawData, rawPrev) {
  const data = withUids(rawData);
  const prev = withUids(rawPrev || null);
  const p = data.period;
  const range = periodRange(p);
  const [y, m] = p.key.split('-').map(Number);

  const cards = [{
    id: 'cover',
    dateLabel: p.kind === 'month' ? `${y}년 ${m}월` : `${y}년`,
    title: p.kind === 'month' ? '이번 달의 단짝꿍' : '이번 해의 단짝꿍',
    daysTogether: daysBetween(data.coupleSince, range.end) + 1 // 기간 마지막 날 기준, 단짝이 된 날 = 1일
  }];
  const together = togetherCard(p, data);
  if (together) {
    const pt = prev ? togetherCard(prev.period, prev) : null;
    together.diffPrev = prev ? diff(together.fullDays, pt ? pt.fullDays : 0) : null;
    cards.push(together);
  }
  const routines = routinesCard(p, data, prev);
  if (routines) cards.push(routines);
  for (const [fn, key] of [[todosCard, 'total'], [kungsCard, 'total'], [timeCard, 'hours']]) {
    const c = fn(p, data);
    if (!c) continue;
    const pc = prev ? fn(prev.period, prev) : null;
    c.diffPrev = prev ? diff(c[key], pc ? pc[key] : 0) : null;
    cards.push(c);
  }
  for (const fn of [placesCard, mealsCard, spendsCard]) {
    const c = fn(p, data);
    if (c) cards.push(c);
  }
  // 마무리: 위 숫자를 한 장에 (있는 카드만)
  const pick = (id) => cards.find((c) => c.id === id);
  const tiles = [];
  if (pick('together')) tiles.push({ id: 'together', value: pick('together').fullDays, unit: '일', label: '둘 다 해낸 날' });
  if (pick('todos')) tiles.push({ id: 'todos', value: pick('todos').total, unit: '개', label: '함께 끝낸 일' });
  if (pick('kungs')) tiles.push({ id: 'kungs', value: pick('kungs').total, unit: '번', label: '주고받은 꿍' });
  if (pick('time')) tiles.push({ id: 'time', value: pick('time').hours, unit: '시간', label: '함께 보낸 시간' });
  const pl = pick('places');
  if (pl) tiles.push({ id: 'places', value: pl.newPlaces.length || pl.places, unit: '곳', label: pl.newPlaces.length ? '새로 칠한 곳' : '다녀온 곳' });
  if (pick('meals') && pick('meals').sharedMeals) tiles.push({ id: 'meals', value: pick('meals').sharedMeals, unit: '번', label: '함께 먹은 끼니' });
  const sp = pick('spends');
  cards.push({ id: 'final', tiles, spends: sp ? { total: sp.total, byPerson: sp.byPerson } : null });

  return { v: 1, period: p, range: { start: range.start, end: range.end }, people: data.people, cards };
}

module.exports = { addDays, weekday, daysBetween, periodRange, prevPeriod, busiestDay, dayLevel, dayStates, bestRoutine, sharedMinutes, computeRecap };
