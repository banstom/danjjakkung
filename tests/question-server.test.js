// node --test tests/question-server.test.js — 교환 쪽지 서버 일 (functions/question-job.js) 을 가짜 저장소로
const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeDb } = require('./fake-db');
const QJ = require('../functions/question-job');
const Q = require('../js/question.js');

const J = 'u-junmin', D = 'u-danjjak';
const kst = (s) => new Date(s + '+09:00');
function base() {
  const db = fakeDb();
  db.put('members/' + J, { name: '준민' }); db.put('members/' + D, { name: '다진' });
  db.put('couple/main', { start: '2026-02-14' });
  return db;
}
function deps() {
  const sent = [], seen = new Set();
  return { sent, send: async (uid, msg, kind, tag, link) => { sent.push({ uid, msg, kind, tag, link }); }, once: async (id) => { if (seen.has(id)) return false; seen.add(id); return true; }, serverTime: () => 'TS', appUrl: 'https://x/' };
}

test('QS1 저녁 6시: 그날 질문이 없으면 앱과 같은 모듈로 만들고 둘 다에게 (질문 글 · 열면 교환 쪽지)', async () => {
  const db = base(); db.put('qdays/2026-11-19', { q: 'first', text: '첫', src: 'date', by: null, skipped: [], done: {}, likes: {} });
  const d = deps();
  const r = await QJ.runDaily(db, kst('2026-11-20T18:00:00'), d);
  const doc = db.get('qdays/2026-11-20');
  assert.ok(doc && doc.createdAt === 'TS' && doc.skipped.length === 0);
  const app = Q.pickQuestion({ date: '2026-11-20', since: '2026-02-14', bank: require('../data/questions.json'), history: [{ date: '2026-11-19', q: 'first', src: 'date', skipped: [] }], ours: [] });
  assert.equal(doc.q, app.q, '앱과 같은 질문');
  assert.deepEqual(r.sent.sort(), [D, J].sort());
  assert.equal(d.sent[0].msg.title, '교환 쪽지'); assert.equal(d.sent[0].msg.body, doc.text);
  assert.match(d.sent[0].link, /open=question/);
});

test('QS2 이미 남긴 사람 · 끈 사람은 빼고, 이미 있는 질문은 그대로, 같은 날 두 번 안 보냄', async () => {
  const db = base();
  db.put('qdays/2026-11-20', { q: 'pick-001', text: '바다 vs 산?', src: 'base', by: null, skipped: [], done: { [D]: 123 }, likes: {} });
  db.put('users/' + J, { qRemind: true });
  const d = deps();
  await QJ.runDaily(db, kst('2026-11-20T18:00:00'), d);
  assert.deepEqual(d.sent.map((x) => x.uid), [J]);
  assert.equal(db.get('qdays/2026-11-20').q, 'pick-001');
  await QJ.runDaily(db, kst('2026-11-20T18:00:00'), d);
  assert.equal(d.sent.length, 1, '한 번만');
  db.put('users/' + J, { qRemind: false });
  const d2 = deps(); await QJ.runDaily(db, kst('2026-11-20T18:00:00'), d2);
  assert.equal(d2.sent.length, 0);
});

test('QS3 쪽지를 남기면: 처음 → 「단짝이 쪽지를 남겼어요」, 둘째 → 「펼쳐 볼 수 있어요」, 지난 날 · 끈 사람은 없음, 글은 안 넣음', async () => {
  const db = base();
  db.put('qdays/2026-11-20', { q: 'x', text: '질문?', src: 'base', by: null, skipped: [], done: { [D]: 1 }, likes: {} });
  db.put('qdays/2026-11-20/a/' + D, { text: '비밀 쪽지 글', at: 1 });
  const d = deps();
  const p1 = await QJ.runAnswered(db, { date: '2026-11-20', author: D }, kst('2026-11-20T20:15:00'), d);
  assert.equal(p1.kind, 'partner-answered'); assert.equal(d.sent[0].uid, J);
  assert.ok(!JSON.stringify(d.sent).includes('비밀 쪽지 글'), '알림에 쪽지 글 없음');
  db.put('qdays/2026-11-20', { q: 'x', text: '질문?', src: 'base', by: null, skipped: [], done: { [D]: 1, [J]: 2 }, likes: {} });
  const p2 = await QJ.runAnswered(db, { date: '2026-11-20', author: J }, kst('2026-11-20T21:12:00'), d);
  assert.equal(p2.kind, 'both-open'); assert.equal(d.sent[1].uid, D);
  db.put('qdays/2026-11-18', { q: 'y', text: '?', src: 'base', by: null, skipped: [], done: { [J]: 1 }, likes: {} });
  assert.equal(await QJ.runAnswered(db, { date: '2026-11-18', author: J }, kst('2026-11-20T18:00:00'), deps()), null, '늦게 남기기는 알림 없음');
  db.put('users/' + D, { qPartner: false });
  db.put('qdays/2026-11-20', { q: 'x', text: '질문?', src: 'base', by: null, skipped: [], done: { [J]: 2 }, likes: {} });
  assert.equal(await QJ.runAnswered(db, { date: '2026-11-20', author: J }, kst('2026-11-20T21:12:00'), deps()), null);
});

test('QS4 서울 날짜: 00:30 서울(15:30Z)이면 다음 날 질문', async () => {
  const db = base(); const d = deps();
  const r = await QJ.runDaily(db, new Date('2026-11-20T15:30:00Z'), d);
  assert.equal(r.date, '2026-11-21');
  assert.equal(db.get('qdays/2026-11-21').q, 'first', '기록이 없으면 첫날 질문');
});
