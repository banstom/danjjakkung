// 교환 쪽지 시험 도우미 (참조 reference/test/helpers.js — 경로만 저장소에 맞춤)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

export const bank = read('../data/questions.json');
export const couple = read('fixtures/question/couple.json');
export const nov = read('fixtures/question/nov-2026.json');
export const [J, D] = couple.members;
export const at = (date, hh = 12, mm = 0) =>
  Date.parse(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+09:00`);
// 지난 기록 한 줄 만들기
export const day = (date, q, src = 'base', extra = {}) => ({ date, q, src, text: q, skipped: [], done: {}, likes: {}, ...extra });
