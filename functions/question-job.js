/* 교환 쪽지 서버 일 (docs/question/spec.md 8절) — index.js 의 questionDaily(매일 18:00) · questionAnswered(쪽지가 처음 생길 때)가 부른다.
   그날 질문은 앱과 같은 모듈(functions/shared/question.js = js/question.js)로 고른다. 알림 글에 쪽지 내용은 넣지 않는다.
   보내기 · 한 번만 기록은 밖에서 받아서 가짜 저장소로 시험한다 (tests/question-server.test.js). */
'use strict';
const Q = require('./shared/question');
const QT = require('./shared/question-text');
const BANK = require('./shared/questions.json');

const msOf = (v) => (v == null ? null : typeof v === 'number' ? v : typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : null);
function dayOf(id, d) {
  const done = {};
  Object.keys((d && d.done) || {}).forEach((u) => { if (d.done[u] != null) done[u] = msOf(d.done[u]) || 1; });
  return { date: id, q: d.q, text: String(d.text || ''), src: d.src, by: d.by || null, skipped: Array.isArray(d.skipped) ? d.skipped : [], done, likes: Object.assign({}, d.likes || {}) };
}

/** 오늘(서울) 질문 문서가 없으면 만든다. 이미 있으면(앱이 먼저 만듦) 그대로. → 그날 문서 */
async function ensureDay(db, date, deps) {
  const ref = db.doc(`qdays/${date}`);
  const cur = await ref.get();
  if (cur.exists) return dayOf(date, cur.data());
  const history = (await db.collection('qdays').get()).docs.map((d) => dayOf(d.id, d.data())).filter((d) => d.date < date);
  const ours = (await db.collection('ourQuestions').get()).docs.map((d) => { const v = d.data(); return { id: d.id, text: v.text, by: v.by, ask: !!v.ask, createdAt: msOf(v.createdAt) || 0 }; });
  const couple = await db.doc('couple/main').get();
  const since = couple.exists && /^\d{4}-\d{2}-\d{2}$/.test(String(couple.data().start || '')) ? couple.data().start : null;
  const pick = Q.pickQuestion({ date, since, bank: BANK, history, ours });
  const doc = { q: pick.q, text: pick.text, src: pick.src, by: pick.by || null, skipped: [], done: {}, likes: {}, createdAt: deps.serverTime() };
  try { await ref.create(doc); }
  catch (e) { if (e.code === 6 || e.code === 'already-exists') return dayOf(date, (await ref.get()).data()); throw e; } // 그 사이 앱이 만듦
  return dayOf(date, doc);
}

/** questionDaily: 저녁 6시 — 없으면 만들고, 안 남긴 사람(qRemind !== false)에게 「교환 쪽지 · 그날 질문」
    deps = { send(uid, msg, kind, tag, link), once(id) → bool, serverTime(), appUrl } */
async function runDaily(db, now, deps) {
  const date = Q.dateKey(now.getTime());
  const day = await ensureDay(db, date, deps);
  const members = (await db.collection('members').get()).docs.map((d) => d.id);
  const prefs = {};
  for (const u of members) { const s = await db.doc(`users/${u}`).get(); prefs[u] = s.exists ? s.data() : {}; }
  const msg = Q.reminderMessage(day);
  const sent = [];
  for (const u of Q.reminderTargets(day, members, prefs)) {
    if (!(await deps.once(`qremind_${u}_${date}`))) continue;
    await deps.send(u, { title: msg.title, body: msg.body }, 'question', `question-${date}`, `${deps.appUrl}?tab=all&open=question`);
    sent.push(u);
  }
  return { date, sent };
}

/** questionAnswered: qdays/{date}/a/{author} 가 처음 생겼을 때 — 오늘 질문이면 단짝(qPartner !== false)에게. 지난 날(늦게 남기기)은 알림 없음 */
async function runAnswered(db, { date, author }, now, deps) {
  const today = Q.dateKey(now.getTime());
  const daySnap = await db.doc(`qdays/${date}`).get();
  if (!daySnap.exists) return null;
  const members = (await db.collection('members').get()).docs.map((d) => d.id);
  const prefs = {};
  for (const u of members) { const s = await db.doc(`users/${u}`).get(); prefs[u] = s.exists ? s.data() : {}; }
  const push = Q.answerPush({ date, today, dayAfter: dayOf(date, daySnap.data()), author, members, prefs });
  if (!push) return null;
  if (!(await deps.once(`qans_${date}_${author}`))) return null;
  await deps.send(push.to, { title: push.title, body: push.body }, 'question', `question-${date}`, `${deps.appUrl}?tab=all&open=question`);
  return push;
}

module.exports = { ensureDay, runDaily, runAnswered, NAME: QT.NAME };
