// 출출 쿠키 시험 (참조 reference/test/text.test.js 그대로 — import 줄만 저장소 모듈로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import E_josa from '../js/eat.js';
const { josa, withJosa } = E_josa;
import E_format from '../js/eat.js';
const { writtenAt, ago, listDate, monthDay } = E_format;
import ET from '../js/eat-text.js';
const { makeText, NAME } = ET;
import { seoul, NOW } from './fixtures/eat/fixtures.mjs';

test('T1 조사 으로/로: ㄹ 받침과 받침 없음은 「로」, 그 밖의 받침은 「으로」', () => {
  assert.equal(withJosa('김치찌개', '으로/로'), '김치찌개로');
  assert.equal(withJosa('칼국수', '으로/로'), '칼국수로');
  assert.equal(withJosa('순대국', '으로/로'), '순대국으로');
  assert.equal(withJosa('비빔밥', '으로/로'), '비빔밥으로');
  assert.equal(withJosa('냉면', '으로/로'), '냉면으로');
  assert.equal(withJosa('불고기', '으로/로'), '불고기로');
  assert.equal(withJosa('갈비탕', '으로/로'), '갈비탕으로');
  // 회귀: ㄹ 받침은 「로」 (일부러 망가뜨린 M4를 처음엔 못 잡았음)
  assert.equal(withJosa('곱창전골', '으로/로'), '곱창전골로');
  assert.equal(withJosa('순살', '으로/로'), '순살로');
  assert.equal(josa('2', '으로/로'), '로');
});

test('T2 조사 을/를 · 숫자 · 영문 끝', () => {
  assert.equal(withJosa('출출 쿠키', '을/를'), '출출 쿠키를');
  assert.equal(withJosa('성북구', '을/를'), '성북구를');
  assert.equal(withJosa('오늘 뭐 먹지', '을/를'), '오늘 뭐 먹지를');
  assert.equal(josa('서울', '을/를'), '을');
  assert.equal(josa('BBQ', '을/를'), '를');
});

test('T3 작성 시각 「2026년 11월 21일 오전 9:21」 · 자정 · 정오', () => {
  assert.equal(writtenAt(seoul(2026, 11, 21, 9, 21)), '2026년 11월 21일 오전 9:21');
  assert.equal(writtenAt(seoul(2026, 11, 21, 0, 5)), '2026년 11월 21일 오전 12:05');
  assert.equal(writtenAt(seoul(2026, 11, 21, 12, 0)), '2026년 11월 21일 오후 12:00');
  assert.equal(writtenAt(seoul(2026, 11, 9, 22, 42)), '2026년 11월 9일 오후 10:42');
  assert.equal(monthDay(seoul(2026, 11, 15, 19, 30)), '11월 15일');
});

test('T4 며칠 전은 서울 날짜로 센다 (UTC 날짜가 바뀌는 오전 9시 앞뒤)', () => {
  // 서울 08:00 = UTC 전날 23:00, 서울 10:00 = UTC 01:00 → 서울로는 같은 날
  assert.equal(ago(seoul(2026, 11, 21, 8, 0), seoul(2026, 11, 21, 10, 0)), '오늘');
  assert.equal(ago(seoul(2026, 11, 20, 23, 59), seoul(2026, 11, 21, 0, 1)), '어제');
  assert.equal(ago(seoul(2026, 11, 7, 13, 12), NOW), '14일 전');
  assert.equal(listDate(seoul(2026, 11, 19, 21, 10), NOW), '11월 19일');
  assert.equal(listDate(seoul(2026, 11, 20, 22, 0), NOW), '어제');
});

test('T5 화면 글이 목업과 같다', () => {
  const t = makeText();
  assert.equal(t.name, '출출 쿠키');
  assert.equal(t.pickFood('김치찌개'), '김치찌개로 할래요');
  assert.equal(t.pickFood('쌀국수'), '쌀국수로 할래요');
  assert.equal(t.pickFood('순대국'), '순대국으로 할래요');
  assert.equal(t.pickFood('곱창전골'), '곱창전골로 할래요');
  assert.equal(t.crackButton(3), '쿠키 3개 깨기');
  assert.equal(t.written(seoul(2026, 11, 21, 9, 21)), '2026년 11월 21일 오전 9:21 작성');
  assert.equal(t.added(13), '쿠키 통에 넣었어요 · 13개째');
  assert.equal(t.crackingSub(3), '세 개가 차례로 펴져요 · 누르면 바로 다 펴기');
  assert.equal(t.resultTitle(3), '쿠키 3개를 깼어요');
  assert.equal(t.singleSubMine('14일 전'), '14일 전의 내가 남긴 쿠키예요');
  assert.equal(t.todayFrom(false, seoul(2026, 11, 15, 19, 30)), '단짝이 11월 15일에 적은 쿠키');
  assert.equal(t.paintAsk('성북구'), '단짝 지도에 성북구를 칠할까요?');
  assert.equal(t.placeNameOnly('솔뫼'), '「솔뫼」 이름만 적기');
  assert.equal(t.pushTitle, '단짝이 출출 쿠키를 깼어요');
  assert.equal(t.pushBody('김치찌개'), '오늘은 김치찌개 어때요?');
});

test('T6 이름은 text.js의 NAME 한 곳 — 바꾸면 알림 조사까지 맞춰진다', () => {
  assert.equal(NAME, '출출 쿠키');
  assert.equal(makeText('오늘 뭐 먹지').pushTitle, '단짝이 오늘 뭐 먹지를 깼어요');
  assert.equal(makeText('냠냠 쿠키').name, '냠냠 쿠키');
  // 저장소: 이름은 js/eat-text.js 한 곳 — 계산 · 그림 · 화면 · 서버 파일에 글자로 없음
  const dir = new URL('../js/', import.meta.url);
  for (const f of ['eat.js', 'eat-cookie-svg.js', 'view-eat.js', 'app-eat.js', 'app.js', 'view-all.js']) {
    assert.ok(!readFileSync(new URL(f, dir), 'utf8').includes(NAME), `${f}에 이름이 들어 있음`);
  }
});
