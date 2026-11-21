// 교환 쪽지 시험 (참조 reference/test/tools.test.js 그대로 — import 줄만 저장소 모듈로)
// 회귀: 질문 원본 중간에 끼워 넣어도 기존 id가 밀리지 않아야 함 (지난 기록이 id를 가리킴)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const q = join(dirname(fileURLToPath(import.meta.url)), '../docs/question');

test('Q-D1 빌드 도구: 끼워 넣기 → 새 번호, `#id`로 고치기 → id 유지, 빼기 → retired', () => {
  const t = mkdtempSync(join(tmpdir(), 'bq-'));
  for (const d of ['tools', 'data-src', 'data']) mkdirSync(join(t, d));
  cpSync(join(q, 'tools/build-questions.mjs'), join(t, 'tools/build-questions.mjs'));
  cpSync(join(q, 'data/questions.json'), join(t, 'data/questions.json'));
  cpSync(join(q, 'data-src/date-questions.json'), join(t, 'data-src/date-questions.json'));
  const before = JSON.parse(readFileSync(join(q, 'data/questions.json'), 'utf8')).base;
  const byId = new Map(before.map((x) => [x.id, x.text]));
  let src = readFileSync(join(q, 'data-src/questions-src.md'), 'utf8');
  src = src.replace(`${byId.get('daily-001')}\n`, `${byId.get('daily-001')}\n새로 끼운 질문은 뭐예요?\n`);
  src = src.replace(byId.get('daily-002'), `고친 문장은 뭐예요? #daily-002`);
  src = src.replace(`${byId.get('daily-003')}\n`, '');
  writeFileSync(join(t, 'data-src/questions-src.md'), src);
  execFileSync(process.execPath, [join(t, 'tools/build-questions.mjs')], { stdio: 'pipe' });
  const after = new Map(JSON.parse(readFileSync(join(t, 'data/questions.json'), 'utf8')).base.map((x) => [x.id, x]));
  assert.equal(after.get('daily-002').text, '고친 문장은 뭐예요?');
  assert.equal(after.get('daily-003').retired, true);
  assert.equal(after.get('daily-004').text, byId.get('daily-004'));
  assert.equal(after.get('daily-051').text, '새로 끼운 질문은 뭐예요?');
  for (const x of before) if (!['daily-002', 'daily-003'].includes(x.id)) assert.equal(after.get(x.id).text, x.text, x.id);
});
