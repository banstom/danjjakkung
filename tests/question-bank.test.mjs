// 교환 쪽지 시험 (참조 reference/test/bank.test.js 그대로 — import 줄만 저장소 모듈로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bank } from './question-helpers.mjs';

test('Q-B1 기본 묶음 300~500개 · id 겹침 없음 · 모두 물음표로 끝', () => {
  const live = bank.base.filter((q) => !q.retired);
  assert.ok(live.length >= 300 && live.length <= 500, `개수 ${live.length}`);
  assert.equal(new Set(bank.base.map((q) => q.id)).size, bank.base.length);
  for (const q of live) assert.match(q.text, /[?？]$/, q.id);
});

test('Q-B2 질문 42자 이하 · 주제 키가 topics 목록에 있음', () => {
  const keys = new Set(bank.topics.map((t) => t.key));
  for (const q of bank.base) {
    assert.ok([...q.text].length <= 42, q.id);
    assert.ok(keys.has(q.topic), q.id);
  }
});

test('Q-B3 날짜 질문: 첫날 · 기념일 3변형 · 100일 4변형 · 정해진 날 9개', () => {
  assert.equal(bank.dates.first.id, 'first');
  assert.equal(bank.dates.anniv.length, 3);
  assert.equal(bank.dates.hundred.length, 4);
  assert.equal(Object.keys(bank.dates.fixed).length, 9);
  for (const t of bank.dates.anniv) assert.ok(t.includes('{years}'));
  for (const t of bank.dates.hundred) assert.ok(t.includes('{days}'));
});
