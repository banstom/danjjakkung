/* 단짝 식탁 · 가공식품 찾기 (findProduct). 식약처 가공식품 32만 건을 함수가 직접 들고 찾는다 — Firestore 색인 없이.
   data/products-kr.tsv.gz (scripts/products-build.py 로 만듦): 이름 \t 제조사 \t g|ml \t 기준량 \t kcal \t 탄수 \t 단백질 \t 지방 \t 1회 제공량 \t 내용량
   처음 부를 때 한 번 읽어 메모리에 둔다 (인스턴스가 살아 있는 동안). */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let ROWS = null, KEYS = null;
const norm = (s) => String(s || '').toLowerCase().replace(/㈜/g, '주').replace(/[\s·ㆍ()\[\]{}.,_\-/+&'"!?~]+/g, '');

function load(file) {
  if (ROWS) return;
  const text = zlib.gunzipSync(fs.readFileSync(file || path.join(__dirname, 'data', 'products-kr.tsv.gz'))).toString('utf8');
  const lines = text.split('\n').filter(Boolean);
  ROWS = new Array(lines.length); KEYS = new Array(lines.length);
  lines.forEach((ln, i) => { const c = ln.split('\t'); ROWS[i] = c; KEYS[i] = norm(c[0]) + '|' + norm(c[1]); });
}
function reset() { ROWS = null; KEYS = null; }

const num = (x) => { const v = parseFloat(x); return isFinite(v) ? v : null; };
function toItem(c) {
  const per = num(c[3]) || 100, f = (x) => Math.round((num(x) || 0) / per * 100 * 100) / 100; // 100g(ml)당으로 맞춤
  return { name: c[0], maker: c[1] || null, base: c[2] === 'ml' ? 'ml' : 'g', kcal: f(c[4]), carb: f(c[5]), protein: f(c[6]), fat: f(c[7]), serve: num(c[8]), size: num(c[9]) };
}

/** q 의 낱말이 모두 이름 · 제조사에 들어 있는 것. 이름이 q 로 시작 > 이름에 q 통째로 > 낱말만 · 짧은 이름 먼저. 많아야 n 개 */
function search(q, n, file) {
  load(file);
  const words = String(q || '').split(/\s+/).map(norm).filter(Boolean).slice(0, 6);
  const whole = norm(q);
  if (!whole) return [];
  const hits = [];
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    let all = true;
    for (let w = 0; w < words.length; w++) if (k.indexOf(words[w]) < 0) { all = false; break; }
    if (!all) continue;
    const bar = k.indexOf('|'), nm = k.slice(0, bar), mk = k.slice(bar + 1);
    // 이름 전체가 같음 > 이름이 q 로 시작 > 이름에 q > 제조사 낱말을 빼면 이름이 맞음 > 낱말만 · 짧은 이름 먼저
    const rest = words.filter((w) => mk.indexOf(w) < 0 || nm.indexOf(w) >= 0).join('');
    const sc = (nm === whole ? 5 : nm.indexOf(whole) === 0 ? 4 : nm.indexOf(whole) >= 0 ? 3 : rest && nm === rest ? 3 : rest && nm.indexOf(rest) === 0 ? 2.5 : 1) - nm.length / 1000;
    hits.push([sc, i]);
  }
  hits.sort((a, b) => b[0] - a[0]);
  const out = [], seen = new Set();
  for (const h of hits) { // 같은 이름 · 제조사(표기만 다른 것)는 하나만
    if (seen.has(KEYS[h[1]])) continue; seen.add(KEYS[h[1]]);
    out.push(toItem(ROWS[h[1]])); if (out.length >= (n || 10)) break;
  }
  return out;
}

/** 앱이 보낸 값 확인: { q: 1~40자 } */
function badQuery(d) {
  if (!d || typeof d.q !== 'string') return 'q 가 없어요';
  const q = d.q.trim();
  if (q.length < 1 || q.length > 40) return '찾을 말은 1~40자예요';
  return null;
}

module.exports = { search, badQuery, load, reset, norm, toItem };
