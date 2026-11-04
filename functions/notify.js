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

/** 내 알림 설정 (문서가 없으면 기본값: 짝꿍 알림 켬, 저녁 알림 끔, 이름 보임, 일요일 돌아보기 켬) */
function prefsOf(doc) {
  const n = (doc && doc.notify) || {};
  // weekly 는 notify 밖(users.weekly)에 있다 — 옛 버전 앱이 notify 를 통째로 저장해도 지워지지 않게
  return { partner: n.partner !== false, remindAt: typeof n.remindAt === 'string' ? n.remindAt : null, hide: n.hide === true, weekly: !(doc && doc.weekly === false) };
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

/** 꿍 보내기 문구 — 남은 루틴 개수를 함께 알린다 (다 했거나 모르면 개수 없이) */
function kungMessage({ who, remaining }) {
  const base = `💌 ${who} 님이 꿍을 보냈어요`;
  if (typeof remaining === 'number' && remaining > 0) return { title: TITLE, body: `${base} · 오늘 루틴 ${remaining}개 남았어요` };
  return { title: TITLE, body: base };
}

/** 한 주(dates: 'YYYY-MM-DD' 7개)에서 모두 해낸 날 수 — 앱 루틴 탭 달력의 「모두」와 같은 규칙 (js/model.js dayLevel).
    그날 하고 있는 루틴이 있고, 그날 참여 중인 사람(그만두지 않은 루틴이 있는 사람)이 각자 자기 루틴을 다 한 날. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 앱(js/model.js routinesFrom)과 같은 정리: 이상한 키 · 사람 · 시작일은 빼고, 그만둔 날이 시작일보다 앞이면 시작일 하루만 */
function cleanRoutines(list) {
  return (list || []).filter((r) => r && SAFE_ID.test(String(r.key || '')) && SAFE_ID.test(String(r.owner || '')) && r.owner !== 'all' && DATE.test(String(r.start || '')))
    .map((r) => {
      const end = typeof r.end === 'string' && DATE.test(r.end) ? r.end : null;
      return Object.assign({}, r, { end: end && end < r.start ? r.start : end });
    });
}
function allDoneDays({ routines: raw, done, persons, dates }) {
  const routines = cleanRoutines(raw);
  return dates.filter((d) => {
    const active = routines.filter((r) => activeOn(r, d));
    if (!active.length) return false;
    const joined = persons.filter((p) => routines.some((r) => r.owner === p && (!r.end || r.end >= d)));
    return joined.every((p) => {
      const mine = active.filter((r) => r.owner === p);
      return mine.length > 0 && mine.every((r) => done.has(r.key + '|' + d));
    });
  }).length;
}

/** 일요일 저녁 돌아보기 문구 */
function weeklyMessage({ allDays, together }) {
  if (allDays > 0 || together > 0) {
    const parts = [];
    if (allDays > 0) parts.push(`모두 해낸 날 ${allDays}일`);
    if (together > 0) parts.push(`함께 끝낸 일 ${together}개`);
    return { title: TITLE, body: `🎉 이번 주 우리 · ${parts.join(' · ')} · 한 주를 돌아볼까요?` };
  }
  return { title: TITLE, body: '📅 이번 주도 수고했어요 · 한 주를 돌아볼까요?' };
}

module.exports = { TITLE, kstParts, addDays, prefsOf, checkMessage, activeOn, dueRemind, remindMessage, kungMessage, cleanRoutines, allDoneDays, weeklyMessage };
