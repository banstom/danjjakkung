// 결산 카드 8 「교환 쪽지」 시험 자료(tests/fixtures/recap-note-2026-11.json — 참조 그대로)를 결산 시험 사람(jm · dj) 모양으로
'use strict';
const fs = require('fs');
const path = require('path');
function noteFixture() {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures/recap-note-2026-11.json'), 'utf8').replace(/u_junmin/g, 'jm').replace(/u_danjjak/g, 'dj');
  const f = JSON.parse(raw);
  const qdays = f.days.map((d) => ({ date: d.date, text: d.text || '', done: Object.keys(d.done || {}).reduce((o, u) => { if (d.done[u]) o[u] = 1; return o; }, {}), likes: d.likes || {} }));
  return { qdays, qanswers: f.answers || {}, raw: f };
}
/** 가짜 저장소에 qdays · 쪽지 문서로 */
function seedNotes(db) {
  const { raw } = noteFixture();
  raw.days.forEach((d) => db.put('qdays/' + d.date, { q: 'x', text: d.text || '', src: 'base', by: null, skipped: [], done: d.done || {}, likes: d.likes || {} }));
  Object.keys(raw.answers || {}).forEach((date) => Object.keys(raw.answers[date]).forEach((u) => db.put('qdays/' + date + '/a/' + u, raw.answers[date][u])));
}
module.exports = { noteFixture, seedNotes };
