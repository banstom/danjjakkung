/* 결산 만들기 · 알림 (docs/recap/spec.md 4절) — index.js 의 monthlyRecap(매달 1일 03:00) · recapNotify(1일 09:00)가 부른다.
   시각 · 보내기 · 한 번만 기록을 밖에서 받아서 에뮬레이터 · 가짜 저장소로 시험한다 (functions/emu/recap.emu.js, tests/recap-server.test.js). */
'use strict';
const N = require('./notify');
const R = require('./recap');
const RD = require('./recap-read');

/** 지금(서울) 기준으로 만들 결산: 지난달 + 1월 1일이면 작년 한 해 */
function targetsFor(now) {
  const { dateKey } = N.kstParts(now);
  const month = R.prevPeriod({ kind: 'month', key: dateKey.slice(0, 7) });
  const year = dateKey.slice(5) === '01-01' ? { kind: 'year', key: String(Number(dateKey.slice(0, 4)) - 1) } : null;
  return { month, year };
}

/** 알림 문구 · 누르면 열 주소 */
function recapMessage(period) {
  const label = period.kind === 'year' ? `${period.key}년` : `${Number(period.key.slice(5))}월`;
  return { title: `${label}의 단짝꿍이 나왔어요`, body: '한 장씩 넘겨 보세요' };
}
const recapLink = (appUrl, key) => `${appUrl}?tab=all&open=look&recap=${key}`; // FT1: 전체 탭 위 돌아보기(결산) — 예전 ?tab=look 도 앱이 받음

/** 한 기간 결산을 계산해 recaps/{key} 에 덮어쓴다. 단짝이 된 날보다 이른 기간이면 만들지 않고 null.
    단짝이 된 달은 만들되 비교 없음(앞 기간 = null) */
async function buildOne(db, period, now) {
  const data = await RD.loadPeriod(db, period);
  if (data.people.length !== 2) { console.warn(`결산 ${period.key}: members 가 ${data.people.length}명이라 만들지 않음 (둘이어야 함)`); return null; } // 11-23 점검 AI: 셋 이상이면 카드 8 계산이 throw 해서 결산 전체가 멈췄음
  const range = R.periodRange(period);
  if (data.coupleSince && range.end < data.coupleSince) return null;
  const pp = R.prevPeriod(period);
  const prev = data.coupleSince && R.periodRange(pp).end < data.coupleSince ? null : await RD.loadPeriod(db, pp);
  const recap = JSON.parse(JSON.stringify(R.computeRecap(data, prev))); // undefined 칸 없이
  recap.createdAt = now.toISOString();
  await db.doc(`recaps/${period.key}`).set(recap);
  return recap;
}

/** monthlyRecap: 지난달 (+ 1월 1일이면 작년). 12월 월말결산도 따로 저장 */
async function runMonthly(db, now) {
  const t = targetsFor(now);
  const out = {};
  out[t.month.key] = await buildOne(db, t.month, now);
  if (t.year) out[t.year.key] = await buildOne(db, t.year, now);
  return out;
}

/** recapNotify: 결산 문서가 있으면 users.recap 이 false 가 아닌 사람에게. 1월 1일엔 연말결산 알림 하나만 (12월 알림 없음)
    deps = { send(uid, msg, kind, tag, link), once(id) → bool, appUrl } */
async function runNotify(db, now, deps) {
  const t = targetsFor(now);
  const period = t.year || t.month;
  const doc = await db.doc(`recaps/${period.key}`).get();
  if (!doc.exists) return [];
  const msg = recapMessage(period);
  const sent = [];
  const members = await db.collection('members').get();
  for (const m of members.docs) {
    const u = await db.doc(`users/${m.id}`).get();
    if (u.exists && u.data().recap === false) continue;
    if (!(await deps.once(`recap_${m.id}_${period.key}`))) continue;
    try { await deps.send(m.id, msg, 'recap', `recap-${period.key}`, recapLink(deps.appUrl, period.key)); sent.push(m.id); }
    catch (e) { console.warn(`결산 알림 실패 ${m.id}`, e && e.message); } // 11-23 점검 AI: 한 사람이 실패해도 다음 사람에게는 보낸다
  }
  return sent;
}

module.exports = { targetsFor, recapMessage, recapLink, buildOne, runMonthly, runNotify };
