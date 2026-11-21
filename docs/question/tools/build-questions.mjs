// 질문 원본(data-src/) → data/questions.json   실행: node docs/question/tools/build-questions.mjs
// 검사: 물음표 끝 · 42자 이하 · 겹침 · 비슷한 문장 · 쓰지 않을 낱말
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'); // docs/question
const src = readFileSync(join(root, 'data-src/questions-src.md'), 'utf8');
const dates = JSON.parse(readFileSync(join(root, 'data-src/date-questions.json'), 'utf8'));

const MAX = 42;
const BANNED = ['사귀', '연애', '애인', '남친', '여친', '키스', '결혼', '남자친구', '여자친구', '자기야'];

// id는 한 번 정하면 그대로 (지난 기록 qdays/{date}.q가 id를 가리킴)
// - 이미 questions.json에 있는 문장 → 그 id
// - 문장을 고치면서 id를 지키려면 줄 끝에 ` #daily-012`
// - 새 문장 → 그 주제의 가장 큰 번호 + 1
// - 원본에서 빠진 문장 → retired: true로 남김 (다시 나오지 않음)
const outPath = join(root, 'data/questions.json');
let prev = [];
try { prev = JSON.parse(readFileSync(outPath, 'utf8')).base; } catch { /* 처음 */ }
const idByText = new Map(prev.filter((q) => !q.retired).map((q) => [q.text, q.id]));
const maxNo = new Map();
for (const q of prev) {
  const [t, n] = [q.id.replace(/-\d+$/, ''), Number(q.id.match(/-(\d+)$/)[1])];
  maxNo.set(t, Math.max(maxNo.get(t) || 0, n));
}

const topics = [];
const base = [];
let cur = null;
for (const raw of src.split('\n')) {
  const line = raw.trim();
  const h = line.match(/^## (\w+) \| (.+)$/);
  if (h) { cur = { key: h[1], label: h[2], n: 0 }; topics.push(cur); continue; }
  if (!cur || !line || line.startsWith('>') || line.startsWith('#')) continue;
  cur.n += 1;
  const pin = line.match(/^(.*?)\s+#([a-z]+-\d{3})$/);
  const text = pin ? pin[1] : line;
  let id = pin ? pin[2] : idByText.get(text);
  if (!id) {
    const n = (maxNo.get(cur.key) || 0) + 1;
    maxNo.set(cur.key, n);
    id = `${cur.key}-${String(n).padStart(3, '0')}`;
  }
  base.push({ id, topic: cur.key, text });
}
const live = new Set(base.map((q) => q.id));
for (const q of prev) if (!live.has(q.id)) base.push({ ...q, retired: true });

const problems = [];
const seen = new Map();
const ids = new Set();
for (const q of base) {
  if (ids.has(q.id)) problems.push(`id 겹침: ${q.id}`);
  ids.add(q.id);
}
for (const q of base.filter((x) => !x.retired)) {
  if (!/[?？]$/.test(q.text)) problems.push(`물음표로 안 끝남: ${q.id} ${q.text}`);
  if ([...q.text].length > MAX) problems.push(`${MAX}자 넘음(${[...q.text].length}): ${q.id} ${q.text}`);
  for (const w of BANNED) if (q.text.includes(w)) problems.push(`쓰지 않을 낱말 '${w}': ${q.id}`);
  const k = q.text.replace(/\s/g, '');
  if (seen.has(k)) problems.push(`겹침: ${q.id} = ${seen.get(k)}`);
  seen.set(k, q.id);
}

// 비슷한 문장: 글자 두 개 묶음 자카드 유사도
const grams = (t) => { const s = t.replace(/[\s?,.!']/g, ''); const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
const sim = (a, b) => { let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
const all = [...base.filter((q) => !q.retired).map((q) => ({ id: q.id, text: q.text })),
  ...Object.entries(dates.fixed).map(([d, t]) => ({ id: `date:${d}`, text: t })),
  { id: 'first', text: dates.first.text }];
const G = all.map((q) => grams(q.text));
const similar = [];
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const s = sim(G[i], G[j]);
  if (s >= 0.55) similar.push(`${s.toFixed(2)}  ${all[i].id} 「${all[i].text}」 ~ ${all[j].id} 「${all[j].text}」`);
}

for (const t of [...Object.values(dates.fixed), dates.first.text, ...dates.anniv.variants, ...dates.hundred.variants]) {
  const filled = t.replace('{years}', '10').replace('{days}', '1000');
  if ([...filled].length > MAX + 4) problems.push(`날짜 질문 길이: ${filled}`);
  for (const w of BANNED) if (t.includes(w)) problems.push(`쓰지 않을 낱말 '${w}': ${t}`);
}

const out = {
  version: 1,
  note: '오늘의 질문 기본 묶음. id는 한 번 정하면 바꾸지 않아요(지난 기록이 id를 가리킴). 문장을 고쳐도 id는 그대로, 지울 땐 retired: true.',
  topics: topics.map(({ key, label, n }) => ({ key, label, count: n })),
  base,
  dates: { first: dates.first, anniv: dates.anniv.variants, hundred: dates.hundred.variants, fixed: dates.fixed },
};
const dest = join(root, 'data/questions.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');

console.log(`기본 ${base.filter((q) => !q.retired).length}개 (그만 쓴 질문 ${base.filter((q) => q.retired).length}개) · 날짜 ${Object.keys(dates.fixed).length + 1 + dates.anniv.variants.length + dates.hundred.variants.length}개`);
console.log(topics.map((t) => `${t.label} ${t.n}`).join(' · '));
console.log(`가장 긴 질문 ${Math.max(...base.map((q) => [...q.text].length))}자`);
if (similar.length) console.log(`\n비슷한 문장 ${similar.length}쌍:\n` + similar.join('\n'));
if (problems.length) { console.log(`\n문제 ${problems.length}개:\n` + problems.join('\n')); process.exitCode = 1; }
else console.log('\n문제 없음');
