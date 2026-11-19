// node --test tests/shared.test.js — 서버 함수가 함께 쓰는 앱 모듈 사본 (functions/shared/) 이 js/ 원본과 글자 하나까지 같은지
// 다르면: bash scripts/sync-shared.sh
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'functions/shared');

test('functions/shared 의 파일마다 js/ 원본과 같다 (sync-shared.sh 목록과도 같다)', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();
  const listed = /for f in ([^;]+);/.exec(fs.readFileSync(path.join(ROOT, 'scripts/sync-shared.sh'), 'utf8'))[1].trim().split(/\s+/).sort();
  assert.deepEqual(files, listed);
  for (const f of files) assert.equal(fs.readFileSync(path.join(DIR, f), 'utf8'), fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), f + ' — bash scripts/sync-shared.sh');
});

test('사본만으로 서버에서 불러와진다 (js/ 없이)', () => {
  const S = require('../functions/shared/schedule.js');
  const evs = S.fromDocs([{ id: 'e', owner: 'both', title: '산책', weekly: true, weekdays: [0, 2], weekday: null, start: '20:00', end: '21:00', from: '2026-11-01' }]);
  const D = require('../functions/shared/dates.js');
  assert.equal(S.on(evs, D.parse('2026-11-16')).length, 1); // 월
  assert.equal(S.on(evs, D.parse('2026-11-17')).length, 0); // 화
});
