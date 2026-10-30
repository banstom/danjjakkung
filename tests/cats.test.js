// 시간표 카테고리: 기본 6개 + 둘이 같이 고친 목록 (js/cats.js), 일정에 붙는 아이콘 (js/schedule.js)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../js/cats.js');
const S = require('../js/schedule.js');

test('문서가 없으면 기본 6개', () => {
  assert.deepStrictEqual(C.fromDocs([]).map((c) => c.icon + c.name), ['📚수업', '🏃운동', '📝공부', '💼과외·일', '💞약속', '📌기타']);
  assert.ok(C.fromDocs([]).every((c) => c.isDefault));
});

test('기본 카테고리 이름 · 아이콘 바꾸기 · 지우기 · 새로 만들기', () => {
  const list = C.fromDocs([
    { id: 'class', name: '강의', icon: '🎓', order: 0 },
    { id: 'meet', deleted: true },
    { id: 'cabc123', name: '동아리', icon: '⚽', order: 6 },
    { id: 'cfirst', name: '맨 앞', icon: '⭐', order: 0 }, // 같은 순서면 id 순
    { id: 'BAD id', name: 'x', icon: '⭐', order: 1 },     // 이상한 id 는 무시
    { id: 'cempty', name: '  ', icon: '⭐', order: 1 },     // 이름 없으면 무시
    { id: 'clong', name: '아주아주긴이름입니다', icon: '⭐', order: 1 } // 8자 넘으면 무시
  ]);
  assert.deepStrictEqual(list.map((c) => c.id), ['cfirst', 'class', 'exercise', 'study', 'work', 'etc', 'cabc123']);
  assert.strictEqual(C.find(list, 'class').name, '강의');
  assert.strictEqual(C.find(list, 'class').isDefault, true);
  assert.strictEqual(C.find(list, 'cabc123').isDefault, false);
  assert.strictEqual(C.find(list, 'meet'), null);
  assert.strictEqual(C.nextOrder(list), 7);
  assert.strictEqual(C.nextOrder(C.fromDocs([])), 6);
});

test('폼 확인: 이름 · 같은 이름 · 아이콘 · 개수', () => {
  const list = C.fromDocs([]);
  assert.strictEqual(C.validate({ name: ' ', icon: '⭐' }, list), '이름을 적어 주세요');
  assert.strictEqual(C.validate({ name: '아홉글자짜리이름', icon: '⭐' }, list), '');
  assert.strictEqual(C.validate({ name: '아홉 글자짜리이름', icon: '⭐' }, list), '이름은 8자까지 쓸 수 있어요');
  assert.strictEqual(C.validate({ name: '수업', icon: '⭐' }, list), '같은 이름의 카테고리가 있어요');
  assert.strictEqual(C.validate({ id: 'class', name: '수업', icon: '🎓' }, list), ''); // 자기 이름은 그대로 둬도 된다
  assert.strictEqual(C.validate({ name: '동아리', icon: '' }, list), '아이콘을 골라 주세요');
  assert.strictEqual(C.validate({ name: '동아리', icon: '🦄' }, list), '아이콘을 골라 주세요'); // 목록 밖
  const full = C.fromDocs(Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, name: '카' + i, icon: '⭐', order: 10 + i })));
  assert.strictEqual(full.length, C.MAX);
  assert.strictEqual(C.validate({ name: '하나 더', icon: '⭐' }, full), '카테고리는 16개까지 만들 수 있어요');
  assert.strictEqual(C.validate({ id: 'c1', name: '고친 이름', icon: '⭐' }, full), ''); // 고치기는 된다
});

test('새 id 는 규칙 모양(영문 소문자 · 숫자 24자까지)', () => {
  for (let i = 0; i < 50; i++) assert.ok(C.isId(C.newId()));
  C.DEFAULTS.forEach((c) => assert.ok(C.isId(c.id)));
});

test('아이콘 목록: 40개, 겹치지 않고, 모두 토스페이스 글꼴 묶음에 있다', () => {
  assert.strictEqual(C.ICONS.length, 40);
  assert.strictEqual(new Set(C.ICONS).size, 40);
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'tokens.css'), 'utf8');
  const cps = new Set();
  for (const m of css.matchAll(/font-family: 'Tossface'[^}]*unicode-range: ([^;]+);/g)) m[1].split(',').forEach((u) => cps.add(parseInt(u.trim().slice(2), 16)));
  C.ICONS.concat(C.DEFAULTS.map((c) => c.icon)).forEach((ic) => assert.ok(cps.has(ic.codePointAt(0)), ic + ' 이 글꼴 묶음에 없어요'));
  // sw.js 가 글꼴 파일을 모두 미리 받는다
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  for (const m of css.matchAll(/url\('\.\.\/(fonts\/tossface-\d\d\.woff2)'\)/g)) assert.ok(sw.includes("'" + m[1] + "'"), m[1] + ' 이 sw.js 에 없어요');
});

test('저장 규칙: 이름 8자 · 일정 cat 은 id 모양', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.ok(rules.includes("d.name.size() <= " + C.NAME_MAX));
  assert.ok(rules.includes("d.cat.matches('^[a-z0-9]{1,24}$')"));
  assert.ok(rules.includes("match /cats/{id}"));
});

test('일정: 지금 카테고리 목록의 아이콘 · 이름이 붙는다', () => {
  const cats = C.fromDocs([{ id: 'class', name: '강의', icon: '🎓', order: 0 }, { id: 'cclub', name: '동아리', icon: '⚽', order: 6 }, { id: 'meet', deleted: true }]);
  const base = { owner: 'jm', title: '일정', weekly: true, weekday: 1, start: '10:00', end: '11:00', createdBy: 'jm' };
  const list = S.fromDocs([
    Object.assign({ id: 'a', cat: 'class' }, base), Object.assign({ id: 'b', cat: 'cclub' }, base),
    Object.assign({ id: 'c', cat: 'meet' }, base), Object.assign({ id: 'd' }, base), Object.assign({ id: 'e', cat: 'Bad!' }, base)
  ], cats);
  assert.deepStrictEqual(list.map((e) => [e.id, e.cat, e.catIcon, e.catName]), [
    ['a', 'class', '🎓', '강의'], ['b', 'cclub', '⚽', '동아리'], ['c', 'meet', '', ''], ['d', null, '', ''], ['e', null, '', '']]);
  assert.ok(S.whenText(list[1]).startsWith('⚽ 동아리 · 매주 화요일'));
  assert.ok(S.whenText(list[2]).startsWith('매주 화요일'));
  // 목록을 안 주면 기본 6개
  assert.strictEqual(S.fromDocs([Object.assign({ id: 'a', cat: 'class' }, base)])[0].catIcon, '📚');
});

test('순서 바꾸기: 바뀌는 카테고리만 0부터 다시 매긴다', () => {
  const list = C.fromDocs([{ id: 'cclub', name: '동아리', icon: '⚽', order: 6 }]);
  // 맨 아래 동아리를 위로 → 기타(5)와 자리 바꿈
  assert.deepStrictEqual(C.move(list, 'cclub', -1).map((c) => [c.id, c.order]), [['cclub', 5], ['etc', 6]]);
  // 저장할 값에 이름 · 아이콘도 (기본 카테고리는 이때 문서가 생긴다)
  assert.deepStrictEqual(C.move(list, 'class', 1)[0], { id: 'exercise', name: '운동', icon: '🏃', order: 0 });
  // 끝에서는 못 옮김
  assert.deepStrictEqual(C.move(list, 'class', -1), []);
  assert.deepStrictEqual(C.move(list, 'cclub', 1), []);
  assert.deepStrictEqual(C.move(list, 'nope', 1), []);
  // 빈 번호(지운 기본 카테고리)가 있으면 아래 것들도 같이 당겨진다
  const gap = C.fromDocs([{ id: 'work', deleted: true }]);
  assert.deepStrictEqual(C.move(gap, 'class', 1).map((c) => [c.id, c.order]), [['exercise', 0], ['class', 1], ['meet', 3], ['etc', 4]]);
  // 저장한 뒤 다시 읽으면 바뀐 순서
  const after = C.fromDocs([{ id: 'cclub', name: '동아리', icon: '⚽', order: 6 }].concat(C.move(list, 'cclub', -1)));
  assert.deepStrictEqual(after.slice(-2).map((c) => c.id), ['cclub', 'etc']);
});

test('저장 규칙: order 는 0~999 정수', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.ok(rules.includes('d.order is int && d.order >= 0 && d.order <= 999'));
});
