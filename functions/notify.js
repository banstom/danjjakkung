/* 알림 문구 · 시간 계산 — 저장소 없이 계산만 (테스트하기 쉽게 따로 둔다) */
'use strict';

const TITLE = '단짝꿍';

/** 지금 한국 날짜 · 시각 → { dateKey: 'YYYY-MM-DD', hhmm: 'HH:MM' } */
function kstParts(date) {
  const iso = new Date(date.getTime() + 9 * 3600 * 1000).toISOString();
  return { dateKey: iso.slice(0, 10), hhmm: iso.slice(11, 16) };
}
function addDays(dateKey, n) {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 내 알림 설정 (문서가 없으면 기본값: 짝꿍 알림 켬, 저녁 알림 끔, 이름 보임) */
function prefsOf(doc) {
  const n = (doc && doc.notify) || {};
  return { partner: n.partner !== false, remindAt: typeof n.remindAt === 'string' ? n.remindAt : null, hide: n.hide === true };
}

/** 짝꿍이 체크했을 때 문구. 오늘 · 어제 기록만 알린다 (지난 기록을 몰아서 채울 때 알림이 쏟아지지 않게). */
function checkMessage({ who, routine, date, today, hide }) {
  if (date !== today && date !== addDays(today, -1)) return null;
  if (hide) return { title: TITLE, body: `💌 ${who} 님이 새 기록을 남겼어요` };
  const name = (routine && routine.name) || '루틴';
  if (date === today) return { title: TITLE, body: `🎉 ${who} 님이 ${name} 완료!` };
  return { title: TITLE, body: `${who} 님이 어제 ${name} 기록을 남겼어요` };
}

/** 그날 하고 있는 루틴인지 (시작 전 · 그만둔 뒤는 빼고) */
function activeOn(r, dateKey) {
  return typeof r.start === 'string' && r.start <= dateKey && (!r.end || r.end >= dateKey);
}

/** 저녁 알림 시간이 됐는지 (30분마다 확인하므로 정해 둔 시각이 지났으면 보냄, 하루 한 번은 기록으로 막는다) */
function dueRemind(remindAt, hhmm) {
  return typeof remindAt === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(remindAt) && remindAt <= hhmm;
}

/** 아직 안 한 루틴 → 문구 (다 했으면 null) */
function remindMessage({ missing, hide }) {
  if (!missing || !missing.length) return null;
  if (hide) return { title: TITLE, body: '⏰ 오늘 기록이 아직 남아 있어요' };
  if (missing.length === 1) return { title: TITLE, body: `${missing[0].icon || '⏰'} 오늘 ${missing[0].name} 아직이에요` };
  return { title: TITLE, body: `⏰ 오늘 루틴 ${missing.length}개가 아직이에요 · ${missing.map((r) => r.name).join(', ')}` };
}

module.exports = { TITLE, kstParts, addDays, prefsOf, checkMessage, activeOn, dueRemind, remindMessage };
