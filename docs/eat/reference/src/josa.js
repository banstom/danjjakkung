// 조사 붙이기. 마지막 글자의 받침으로 고른다. 한글이 아니면(숫자 · 영문) 받침 없는 쪽.
// pair: '을/를' · '이/가' · '은/는' · '과/와' · '으로/로'
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

function lastHangul(word) {
  const s = String(word).trim();
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s.charCodeAt(i);
    if (c >= HANGUL_START && c <= HANGUL_END) return c;
    if (/[0-9A-Za-z]/.test(s[i])) return null;
  }
  return null;
}

/** 받침 번호 (0 = 없음, 8 = ㄹ) */
export function jong(word) {
  const c = lastHangul(word);
  return c === null ? 0 : (c - HANGUL_START) % 28;
}

export function josa(word, pair) {
  const [withJong, withoutJong] = pair.split('/');
  const j = jong(word);
  if (pair === '으로/로') return j === 0 || j === 8 ? '로' : '으로';
  return j === 0 ? withoutJong : withJong;
}

/** 단어 + 조사 */
export function withJosa(word, pair) {
  return `${word}${josa(word, pair)}`;
}
