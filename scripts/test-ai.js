#!/usr/bin/env node
/* 시험 A — 실제 Claude Haiku 로 docs/diet/ai/cases.md 를 3번 돌리고 grade.py 로 채점 (3번 다 맞아야 통과)
   Cloud Shell 에서:
     ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project jjakkung-grid) npm run test:ai
   - 서버 함수와 같은 지시문 · 같은 요청 (functions/meal.js) — 키는 화면이나 파일에 안 남김
   - 결과: /tmp/diet-ai/run1..3/<case>.json */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const M = require('../functions/meal');

const ROOT = path.join(__dirname, '..');
const RUNS = +(process.env.RUNS || 3);
const TODAY = '2026-11-17';
// 시험 상태의 식품표 = fixtures/foods.json 이름 (실제 앱은 식약처 식품표)
const TABLE = '달걀(=계란), 카놀라유, 사과, 바나나, 카카오파우더, 햇반, 진간장, 깨, 참기름, 오뎅국, 갓김치, 조기구이, 김치꽁치찌개, 멸치볶음, 마이프로틴 임팩트 웨이, 크레아틴';

/** cases.md → [{ name, state, input }] */
function parseCases(md) {
  return md.split(/^## /m).slice(1).map((blk) => {
    const lines = blk.split('\n');
    const name = lines[0].split(/\s/)[0];
    const st = lines.findIndex((l) => l.startsWith('상태:'));
    const inp = lines.findIndex((l) => l.startsWith('입력'));
    return { name, state: lines.slice(st, inp).join('\n').replace(/^상태:\s*/, '').trim(), input: lines.slice(inp + 1).join('\n').trim() };
  }).filter((c) => c.name && c.input);
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error('ANTHROPIC_API_KEY 가 없어요 (파일 맨 위 주석의 명령으로 실행)'); process.exit(2); }
  const cases = parseCases(fs.readFileSync(path.join(ROOT, 'docs/diet/ai/cases.md'), 'utf8'));
  const sys = M.systemPrompt(TABLE);
  let tokens = { in: 0, out: 0 };
  for (let r = 1; r <= RUNS; r++) {
    const dir = path.join('/tmp/diet-ai', 'run' + r);
    fs.mkdirSync(dir, { recursive: true });
    for (const c of cases) {
      const out = await M.callModel(key, sys, M.userMessage(TODAY, c.state, c.input));
      if (out.usage) { tokens.in += out.usage.input_tokens || 0; tokens.out += out.usage.output_tokens || 0; }
      const j = M.sanitize(M.extractJson(out.text));
      fs.writeFileSync(path.join(dir, c.name + '.json'), j ? JSON.stringify(j, null, 2) : out.text);
      process.stdout.write('run' + r + ' ' + c.name + (j ? ' ✓ ' : ' (JSON 아님) '));
    }
    process.stdout.write('\n');
  }
  const cost = (tokens.in * 0.10 + tokens.out * 0.50) / 1e6;
  console.log('토큰 입력 ' + tokens.in + ' · 출력 ' + tokens.out + ' · 약 $' + cost.toFixed(4) + ' (Haiku 5.5 $0.10/$0.50 per 1M)');
  const runs = Array.from({ length: RUNS }, (_, i) => 'run' + (i + 1));
  const rep = execFileSync('python3', [path.join(ROOT, 'docs/diet/ai/grade.py')].concat(runs), { encoding: 'utf8' });
  console.log(rep);
  const fails = (rep.match(/❌/g) || []).length;
  console.log(fails ? '시험 A 실패 ' + fails + '개 (위 X 줄)' : '시험 A 통과 ✅ (' + RUNS + '번 모두)');
  process.exit(fails ? 1 : 0);
}

if (require.main === module) main().catch((e) => { console.error('실패:', e.message); process.exit(1); });
module.exports = { parseCases };
