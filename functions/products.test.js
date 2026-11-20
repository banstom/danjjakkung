// node --test functions/products.test.js — 가공식품 찾기 (findProduct)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const P = require('./products');

const ROWS = [
  ['신라면', '(주)농심', 'g', '100', '417', '63', '9', '14', '', ''],
  ['신라면컵', '(주)농심', 'g', '100', '462', '60', '9', '20', '', '65'],
  ['오레오오즈', '동서식품(주)', 'g', '100', '400', '80', '6', '8', '30', '250'],
  ['비타500', '광동제약주식회사', 'ml', '100', '50', '12', '0', '0', '200', '100'],
  ['반값 기준 우유', '서울우유', 'ml', '200', '130', '10', '6', '8', '200', '200'],
  ['새우깡', '(주)농심', 'g', '100', '517', '64', '6', '26', '30', '90']
];
const file = path.join(os.tmpdir(), 'products-test.tsv.gz');
fs.writeFileSync(file, zlib.gzipSync(ROWS.map((r) => r.join('\t')).join('\n') + '\n'));

test('찾기: 낱말이 모두 이름 · 제조사에 · 이름이 같은 것 > 앞부분 > 포함 · 10개까지 · 100g(ml)당으로', () => {
  P.reset();
  assert.deepEqual(P.search('신라면', 10, file).map((x) => x.name), ['신라면', '신라면컵']);
  assert.deepEqual(P.search('농심 깡', 10, file).map((x) => x.name), ['새우깡'], '제조사 낱말도');
  assert.deepEqual(P.search('오레오 오즈', 10, file)[0], { name: '오레오오즈', maker: '동서식품(주)', base: 'g', kcal: 400, carb: 80, protein: 6, fat: 8, serve: 30, size: 250 });
  assert.equal(P.search('비타500', 1, file)[0].base, 'ml');
  assert.deepEqual(P.search('기준 우유', 1, file)[0].kcal, 65, '기준량 200ml → 100ml당');
  assert.deepEqual(P.search('없는것', 10, file), []);
  assert.deepEqual(P.search('   ', 10, file), []);
  assert.equal(P.search('농심', 1, file).length, 1);
});

test('찾을 말 확인 · 서버 연결', () => {
  assert.equal(P.badQuery({ q: '신라면' }), null);
  assert.ok(P.badQuery({})); assert.ok(P.badQuery({ q: '' })); assert.ok(P.badQuery({ q: 'ㄱ'.repeat(41) })); assert.ok(P.badQuery({ q: 3 }));
  const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  assert.match(src, /exports\.findProduct = onCall\(\{[^}]*memory: '1GiB'/);
  assert.match(src, /exports\.findProduct[\s\S]{0,400}members\/\$\{uid\}[\s\S]{0,200}P\.badQuery/, '멤버만 · 값 확인');
  assert.ok(fs.statSync(path.join(__dirname, 'data', 'products-kr.tsv.gz')).size > 5e6, '가공식품 파일이 함수에 들어 있음');
});
