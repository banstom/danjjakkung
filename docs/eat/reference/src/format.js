import { seoulParts, dayDiff } from './time.js';

function ampm(hh, mm) {
  const pm = hh >= 12;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${pm ? '오후' : '오전'} ${h12}:${String(mm).padStart(2, '0')}`;
}

/** 쪽지 아래 · 쿠키 넣기 화면: 「2026년 11월 21일 오전 9:21」 (뒤에 「 작성」은 text.js가 붙임) */
export function writtenAt(ms) {
  const { y, m, d, hh, mm } = seoulParts(ms);
  return `${y}년 ${m}월 ${d}일 ${ampm(hh, mm)}`;
}

/** 「11월 15일」 */
export function monthDay(ms) {
  const { m, d } = seoulParts(ms);
  return `${m}월 ${d}일`;
}

/** 쪽지 머리 · 통 줄: 「오늘」 「어제」 「12일 전」 */
export function ago(ms, nowMs) {
  const n = dayDiff(ms, nowMs);
  if (n <= 0) return '오늘';
  if (n === 1) return '어제';
  return `${n}일 전`;
}

/** 넣어 둔 쿠키 목록: 「오늘」 「어제」 「11월 19일」 */
export function listDate(ms, nowMs) {
  const n = dayDiff(ms, nowMs);
  if (n <= 0) return '오늘';
  if (n === 1) return '어제';
  return monthDay(ms);
}
