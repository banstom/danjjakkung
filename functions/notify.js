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
  return { partner: n.partner !== false, remindAt: typeof n.remindAt === 'string' ? n.remindAt : null, hide: n.hide === true, weekly: !(doc && doc.weekly === false),
    todo: !(doc && doc.todoNotify === false), // 함께 할 일 알림 (v38, users.todoNotify — 없으면 켬)
    miss: !(doc && doc.missNotify === false) }; // 아침 8시 어제 놓친 루틴 알림 (v41, users.missNotify — 없으면 켬)
}

/** 짝꿍이 체크했을 때 문구. 오늘 · 어제 기록만 알린다 (지난 기록을 몰아서 채울 때 알림이 쏟아지지 않게). */
function checkMessage({ who, routine, date, today, hide }) {
  if (date !== today && date !== addDays(today, -1)) return null;
  if (hide) return { title: TITLE, body: `💌 ${who} 님이 새 기록을 남겼어요` };
  const name = (routine && routine.name) || '루틴';
  if (date === today) return { title: TITLE, body: `🎉 ${who} 님이 ${name} 완료!` };
  return { title: TITLE, body: `${who} 님이 어제 ${name} 기록을 남겼어요` };
}

/** 시작했고 그만두기 전인지 (쉬는 날 포함) */
function aliveOn(r, dateKey) {
  return typeof r.start === 'string' && r.start <= dateKey && (!r.end || r.end >= dateKey);
}
/** 쉬기 기간 안인지 — 앱(js/model.js restFrom · restOn)과 같은 규칙: 30개까지, 끝이 앞이거나 이상한 기간은 무시, 시작일 앞은 잘라 냄 */
const REST_DATE = /^\d{4}-\d{2}-\d{2}$/;
function restOn(r, dateKey) {
  if (!Array.isArray(r.rest)) return false;
  return r.rest.slice(0, 30).some((p) => {
    if (!p || typeof p.from !== 'string' || !REST_DATE.test(p.from)) return false;
    const to = p.to == null || p.to === '' ? null : p.to;
    if (to !== null && (typeof to !== 'string' || !REST_DATE.test(to) || to < p.from)) return false;
    const from = typeof r.start === 'string' && p.from < r.start ? r.start : p.from;
    if (to !== null && to < from) return false;
    return from <= dateKey && (to === null || dateKey <= to);
  });
}
/** 그날 하고 있는 루틴인지 (시작 전 · 그만둔 뒤 · 쉬는 날은 빼고) */
function activeOn(r, dateKey) {
  return aliveOn(r, dateKey) && !restOn(r, dateKey);
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

/** 언제 할지 (v41) — 앱 js/model.js whenFrom 과 같은 규칙. 없거나 이상하면 null */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
function whenOf(r) {
  const w = r && r.when;
  if (!w || typeof w !== 'object') return null;
  const cue = typeof w.cue === 'string' ? w.cue.trim().slice(0, 20) : '';
  const at = typeof w.at === 'string' && HHMM.test(w.at) ? w.at : '';
  if (!cue && !at) return null;
  return { cue, at, remind: !!at && w.remind === true };
}
const toMin = (hhmm) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10);
/** 정해 둔 시각 알림을 지금 보낼 때인가: 그 시각부터 45분 안 (15분마다 돌므로 한 번은 걸림, 늦게 만든 루틴이 몇 시간 뒤 울리지 않게) */
function dueAt(at, hhmm) {
  if (!HHMM.test(at || '') || !HHMM.test(hhmm || '')) return false;
  const d = toMin(hhmm) - toMin(at);
  return d >= 0 && d < 45;
}
/** 아침 8시 알림 때인가 (08:00 ~ 08:44) */
function dueMorning(hhmm) { return dueAt('08:00', hhmm); }
/** 정해 둔 시각 알림 문구 */
function atMessage({ r, hide }) {
  const w = whenOf(r) || {};
  if (hide) return { title: TITLE, body: '⏰ 정해 둔 루틴 할 시간이에요' };
  return { title: TITLE, body: `${r.icon || '⏰'} ${w.cue ? w.cue + ' · ' : ''}${r.name} 할 시간이에요` };
}
/** 어제 놓친 루틴 문구 (없으면 null) */
function missMessage({ missed, hide }) {
  if (!missed || !missed.length) return null;
  if (hide) return { title: TITLE, body: '🌅 어제 못 한 루틴이 있어요 · 오늘은 꼭! 💪' };
  return { title: TITLE, body: `🌅 어제 못 한 루틴이 ${missed.length}개 있어요 · ${missed.map((r) => r.name).join(', ')} · 오늘은 꼭! 💪` };
}

/** 꿍 보내기 문구 — 남은 루틴 개수를 함께 알린다 (다 했거나 모르면 개수 없이) */
function kungMessage({ who, remaining }) {
  const base = `💌 ${who} 님이 꿍을 보냈어요`;
  if (typeof remaining === 'number' && remaining > 0) return { title: TITLE, body: `${base} · 오늘 루틴 ${remaining}개 남았어요` };
  return { title: TITLE, body: base };
}

/** 함께 할 일 알림 문구 (v38) — type: 'add' | 'done'. 숨기기면 할 일 이름 없이 */
function todoMessage({ type, who, title, hide }) {
  const name = typeof title === 'string' && title.trim() ? title.trim().slice(0, 40) : '';
  const head = type === 'done' ? `✅ ${who} 님이 함께 할 일을 끝냈어요` : `📝 ${who} 님이 함께 할 일을 추가했어요`;
  return { title: TITLE, body: hide || !name ? head : `${head} · ${name}` };
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
    // 그날 루틴이 모두 쉬는 사람은 뺀다 (앱 dayLevel 과 같음)
    const joined = persons.filter((p) => {
      const mine = routines.filter((r) => r.owner === p && (!r.end || r.end >= d));
      if (!mine.length) return false;
      const alive = mine.filter((r) => aliveOn(r, d));
      return !(alive.length && alive.every((r) => restOn(r, d)));
    });
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

module.exports = { TITLE, kstParts, addDays, prefsOf, checkMessage, activeOn, aliveOn, restOn, dueRemind, remindMessage, kungMessage, cleanRoutines, allDoneDays, weeklyMessage, todoMessage, whenOf, dueAt, dueMorning, atMessage, missMessage };
