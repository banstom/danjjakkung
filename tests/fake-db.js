// 시험용 가짜 Firestore — 결산 서버가 쓰는 만큼만 (collection · where(>=, <=, <, ==) · get · doc get/set)
// seedFromFixture: 결산 시험 자료(tests/fixtures/recap-*.json)를 저장소 문서 모양으로 펼친다 — 에뮬레이터 시험도 같은 것을 씀
'use strict';

function fakeDb() {
  const store = new Map(); // 'col/id' → data
  const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => (store.has(p) ? JSON.parse(JSON.stringify(store.get(p))) : undefined) });
  const OPS = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '<': (a, b) => a < b, '>': (a, b) => a > b, '==': (a, b) => a === b };
  function query(col, conds) {
    return {
      where: (f, op, v) => query(col, conds.concat([[f, op, v]])),
      get: async () => ({
        docs: [...store.keys()].filter((p) => p.split('/').length === 2 && p.startsWith(col + '/'))
          .filter((p) => conds.every(([f, op, v]) => { const x = store.get(p)[f]; return x !== undefined && x !== null && OPS[op](x, v); }))
          .sort().map(snap)
      })
    };
  }
  return {
    collection: (col) => query(col, []),
    doc: (p) => ({ get: async () => snap(p), set: async (d) => { store.set(p, JSON.parse(JSON.stringify(d))); },
      create: async (d) => { if (store.has(p)) { const e = new Error('exists'); e.code = 6; throw e; } store.set(p, JSON.parse(JSON.stringify(d))); } }),
    put: (p, d) => store.set(p, d),
    get: (p) => store.get(p),
    count: (col) => [...store.keys()].filter((p) => p.startsWith(col + '/')).length
  };
}

/** 결산 시험 자료 → 저장소 문서. db.put(path, data) 만 있으면 된다 */
function seedFromFixture(db, fx) {
  fx.people.forEach((p) => db.put('members/' + p.uid, { name: p.name }));
  db.put('couple/main', { start: fx.coupleSince, label: '단짝', updatedBy: fx.people[0].uid, updatedAt: '2026-01-01T00:00:00Z' });
  fx.routines.forEach((r, i) => {
    const d = { icon: '✅', name: r.name, owner: r.owner, start: r.start, end: r.end || null, order: i };
    if (r.rest) d.rest = r.rest;
    db.put('routines/' + r.key, d);
  });
  const owner = {};
  fx.routines.forEach((r) => { owner[r.key] = r.owner; });
  fx.checks.forEach((c) => db.put('checks/' + c.key + '_' + c.date, { routine: c.key, date: c.date, done: true, by: owner[c.key], at: c.date + 'T21:00:00+09:00' }));
  fx.todos.forEach((t) => db.put('todos/' + t.id, { title: '할 일', scope: t.shared ? 'together' : t.doneBy, done: !!t.doneAt, doneBy: t.doneBy, createdBy: t.doneBy,
    doneAt: t.doneAt ? new Date(t.doneAt + 'T12:00:00+09:00').toISOString() : null }));
  const seen = {};
  fx.kungs.forEach((k) => {
    const id = k.at + '_' + k.from;
    seen[id] = (seen[id] || 0) + 1;
    db.put('kungs/' + id + (seen[id] > 1 ? '_' + seen[id] : ''), { from: k.from, to: fx.people.find((p) => p.uid !== k.from).uid, date: k.at, at: k.at + 'T12:00:00+09:00' });
  });
  fx.events.forEach((e, i) => {
    if (e.start.slice(0, 10) !== e.end.slice(0, 10)) return; // 앱 일정은 하루 안에서 끝남 (자정 넘는 일정은 펼칠 수 없음)
    db.put('events/' + fx.period.key + '-' + i, { owner: e.shared ? 'both' : fx.people[0].uid, title: '일정', weekly: false, date: e.start.slice(0, 10), start: e.start.slice(11), end: e.end.slice(11), createdBy: fx.people[0].uid });
  });
  fx.places.forEach((p) => db.put('places/' + p.code, { code: p.code, visits: p.visits, entries: p.entries }));
  // 식탁: 함께 끼니는 첫 사람 문서에, 목표 맞춘 날은 칼로리 = 목표(2000)
  const GOAL = 2000;
  fx.people.forEach((p) => db.put('goals/' + p.uid, { kind: 'keep', kcal: GOAL, carb: 250, protein: 100, fat: 60 }));
  const days = {};
  const key = (u, d) => u + '_' + d;
  fx.meals.filter((m) => m.shared).forEach((m) => { const k = key(fx.people[0].uid, m.date); days[k] = days[k] || { together: 0, goal: false }; days[k].together++; });
  Object.keys(fx.goalDays || {}).forEach((u) => fx.goalDays[u].forEach((d) => { const k = key(u, d); days[k] = days[k] || { together: 0, goal: false }; days[k].goal = true; }));
  Object.keys(days).forEach((k) => {
    const [u, d] = k.split('_');
    const info = days[k];
    const n = Math.max(1, info.together);
    const kcal = (info.goal ? GOAL : 500) / n;
    const meals = Array.from({ length: n }, (_, i) => ({ id: 'm' + i, at: '12:00', kind: 'meal', together: i < info.together, status: 'done', items: [], total: { kcal, carb: 0, protein: 0, fat: 0 } }));
    db.put('meals/' + k, { uid: u, date: d, meals, updatedAt: d + 'T22:00:00+09:00' });
  });
  (fx.spends || []).forEach((s) => db.put('spends/' + s.id, Object.assign({}, s)));
}

module.exports = { fakeDb, seedFromFixture };
