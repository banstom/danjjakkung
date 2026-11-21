// 11월 시험 기록 만들기: 11-01(기능 첫날)부터 11-20까지 매일 pickQuestion으로 질문을 정하고,
// 답 · 다른 질문 · 마음에 남아요를 정해진 모양대로 채움. 목업 숫자도 이 파일에서 가져옴.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'); // docs/question
const { pickQuestion } = await import(join(root, 'reference/src/pick.js'));
const { swapDay } = await import(join(root, 'reference/src/swap.js'));
const { addDays } = await import(join(root, 'reference/src/kst.js'));
const bank = JSON.parse(readFileSync(join(root, 'data/questions.json'), 'utf8'));
const couple = JSON.parse(readFileSync(join(root, 'reference/fixtures/couple.json'), 'utf8'));
const [J, D] = couple.members;
const at = (date, hh, mm = 0) => Date.parse(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+09:00`);

const ours = [
  { id: 'o-1', text: '같이 본 영화 중에 다시 보고 싶은 건요?', by: J, ask: true, createdAt: at('2026-11-05', 22, 10) },
  { id: 'o-2', text: '요즘 나한테 제일 고마운 사람은 누구예요?', by: D, ask: false, createdAt: at('2026-11-09', 20, 0) },
  { id: 'o-3', text: '겨울에 꼭 같이 먹고 싶은 간식은요?', by: D, ask: true, createdAt: at('2026-11-14', 23, 30) },
  { id: 'o-4', text: '올해 가장 많이 웃은 날은 언제였어요?', by: J, ask: false, createdAt: at('2026-11-18', 21, 40) },
];

// 날마다: [준민 답 시각, 단짝 답 시각, 좋아요, 다른 질문]  (null = 안 답함)
const plan = {
  '01': [[21, 5], [22, 40], [J, D]], '02': [[20, 10], [23, 2], []], '03': [[8, 30], null, []],
  '04': [[21, 0], [21, 30], [D]], '05': [[22, 15], [20, 50], [J]], '06': [null, [19, 20], []],
  '07': [[13, 0], [14, 10], [], 'swap'], '08': [[21, 45], [22, 5], [J, D]], '09': [[21, 0], [22, 0], []],
  '10': [[20, 30], [21, 10], [D]], '11': [null, null, []], '12': [[21, 20], [21, 55], []],
  '13': [[22, 0], [20, 0], [J]], '14': [[19, 40], [23, 10], []], '15': [[11, 0], [12, 30], [J, D]],
  '16': [[21, 5], [21, 50], [], 'swap'], '17': [[20, 0], null, []], '18': [[21, 30], [22, 45], [D]],
  '19': [[22, 10], [21, 0], []], '20': [null, [20, 15], []],
};

const days = [];
for (let i = 0; i < 20; i++) {
  const date = addDays(couple.start, i);
  const [ja, da, likes, swap] = plan[date.slice(8)];
  const ctx = { date, since: couple.since, bank, history: days, ours };
  const p = pickQuestion(ctx);
  let day = { date, ...p, by: p.by || null, skipped: [], done: {}, likes: {}, createdAt: at(date, 7, 30) };
  if (swap) day = swapDay(ctx, day, { uid: J, now: at(date, 7, 45) });
  if (ja) day.done[J] = at(date, ...ja);
  if (da) day.done[D] = at(date, ...da);
  for (const u of likes) day.likes[u] = true;
  days.push(day);
}

// 목업에 쓰는 답 (날짜별로 그날 실제로 나온 질문에 맞춤 — 아래 console 출력으로 확인)
const answers = {
  '2026-11-15': {
    [J]: '호떡! 꿀이 흘러내리는 걸 반으로 나눠 먹기.',
    [D]: '붕어빵. 팥 하나 슈크림 하나 사서 바꿔 먹기.',
  },
  '2026-11-19': {
    [J]: '강릉 가는 KTX에서 둘 다 잠들었다가 내릴 역을 놓칠 뻔한 날.',
    [D]: '속초 케이블카에서 준민 모자가 날아가서 같이 뛰어다닌 날 ㅋㅋ',
  },
  '2026-11-20': {
    [D]: '「밥 먹었어?」 대신 「배 채웠어?」. 처음엔 오타였는데 이제 우리 말이 됐어요.',
    // 목업 「둘 다 답함」 화면에서만 쓰는 준민 답 (기록상 11-20 준민은 아직 안 답함)
    [`${J}:mock`]: '「꿍 하나만 보내 줘」 — 힘든 날 신호. 다른 사람은 무슨 뜻인지 모를걸요.',
  },
};

const out = { note: 'make-fixture.mjs로 만든 11월 1~20일 시험 기록. 오늘 = 2026-11-20. 손으로 고치지 말고 스크립트를 다시 돌리기', today: '2026-11-20', ours, days, answers };
writeFileSync(join(root, 'reference/fixtures/nov-2026.json'), JSON.stringify(out, null, 1) + '\n');
for (const d of days) console.log(d.date, d.src.padEnd(4), (d.q + '').padEnd(12), Object.keys(d.done).length, d.swappedAt ? 'swap' : '', d.text);
