/* 단짝꿍 알림 서버 (Cloud Functions 2세대, 서울 리전)
   - onCheckCreated : 체크가 저장되면 짝꿍에게 "OO 님이 OO 완료!"
   - eveningReminder: 30분마다, 정해 둔 시간까지 내 루틴을 안 했으면 나에게 알림 (하루 한 번)
   - onKungCreated  : 「꿍 보내기」 문서가 생기면 짝꿍에게 "OO 님이 꿍을 보냈어요 · 오늘 루틴 N개 남았어요"
   - onPing         : 앱의 「테스트 알림 보내기」
   - weeklyReview   : 일요일 밤 9시, 이번 주 「모두 해낸 날 · 함께 끝낸 일」을 알리고 누르면 돌아보기 탭 (v37)
   - onTodoCreated · onTodoUpdated : 함께 할 일이 생기거나 끝나면 짝꿍에게 (v38, 누르면 할 일 탭)
   - routineClock   : 15분마다 (v41) — 루틴에 정해 둔 시각 알림(아직 안 했으면), 아침 8시 「어제 못 한 루틴」 알림
   - onPlaceWritten : 단짝 지도에 새 방문이 저장되면 만든 사람이 아닌 쪽에게 「별점을 남겨 주세요」 (v54, 누르면 그 지역 시트)
   - monthlyRecap   : 매달 1일 03:00 지난달 결산(1월 1일엔 작년 한 해도) → recaps/{key} (docs/recap)
   - questionDaily  : 매일 18:00 교환 쪽지 — 그날 질문이 없으면 만들고(앱과 같은 모듈), 아직 안 남긴 사람에게 (users.qRemind=false 면 안 보냄)
   - questionAnswered: 교환 쪽지를 처음 남기면 단짝에게 (오늘 질문만, users.qPartner=false 면 안 보냄, 글은 안 넣음)
   - onEatPing      : 출출 쿠키 「꿍으로 알려 주기」 — 단짝에게 「단짝이 출출 쿠키를 깼어요 · 오늘은 ○○ 어때요?」
   - recapNotify    : 매달 1일 09:00 「11월의 단짝꿍이 나왔어요」 (1월 1일엔 연말결산 하나만, users.recap=false 면 안 보냄)
   기기 주소는 users/<uid>/devices/<기기> 에 있고, 못 쓰게 된 주소는 보낼 때 지운다. */
'use strict';
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const N = require('./notify');
const RJ = require('./recap-job');
const QJ = require('./question-job');
const ET = require('./shared/eat-text');
const SP = require('./search-place');
const SC = require('./shared/cats');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const KAKAO_REST_KEY = defineSecret('KAKAO_REST_KEY');

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10, memory: '256MiB' });

const APP_URL = 'https://banstom.github.io/danjjakkung/';
const OPEN_URL = APP_URL + '?tab=routine'; // 알림을 누르면 루틴 탭으로 연다
const LOOK_URL = APP_URL + '?tab=all&open=look&view=week'; // 일요일 돌아보기 알림 → 전체 탭 위 돌아보기 「주」 (FT1 — 예전 ?tab=look 도 앱이 받음)
const FOCUS_URL = APP_URL + '?tab=focus';   // 집중 알림은 집중 탭으로 (F2)
const TODO_URL = APP_URL + '?tab=todo';    // 함께 할 일 알림은 할 일 탭으로
const ICON = APP_URL + 'icons/icon-192.png';
const REGIONS = require('./regions.json'); // 시군구코드 → 「서울 종로구」 (data/kr-map.json 에서 만든 표)

/* 짝꿍 찾기 — 지금은 members 전체(두 사람)가 한 짝이다.
   여러 짝으로 넓힐 때는 이 함수만 pairs/<짝> 문서를 보도록 바꾸면 나머지는 그대로 쓴다. */
async function partnersOf(uid) {
  const q = await db.collection('members').get();
  return q.docs.map((d) => d.id).filter((id) => id !== uid);
}
async function nameOf(uid) {
  const d = await db.doc(`members/${uid}`).get();
  return (d.exists && d.data().name) || '짝꿍';
}
async function prefsFor(uid) {
  const d = await db.doc(`users/${uid}`).get();
  return N.prefsOf(d.exists ? d.data() : null);
}

/** 한 사람의 모든 기기로 보낸다.
    웹은 data만 보내고 서비스 워커(sw.js)가 언제나 알림을 띄운다 (아이폰은 안 띄운 알림이 쌓이면 구독을 끊는다).
    나중에 iOS·안드로이드 앱이 생기면 platform에 따라 apns/android 설정만 더하면 된다. */
async function sendTo(uid, msg, kind, tag, link) {
  const devs = await db.collection(`users/${uid}/devices`).get();
  const seen = new Set();
  const list = devs.docs.filter((d) => {
    const t = d.data().token;
    if (typeof t !== 'string' || !t || seen.has(t)) return false; // 같은 주소가 두 번 있으면 한 번만
    seen.add(t); return true;
  });
  if (!list.length) return 0;
  const data = { kind, title: msg.title, body: msg.body, tag: tag || kind, link: link || OPEN_URL, icon: ICON };
  const res = await admin.messaging().sendEachForMulticast({
    tokens: list.map((d) => d.data().token),
    data,
    webpush: { headers: { Urgency: 'high', TTL: '86400' }, data }
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(list[i].ref);
    else logger.warn('알림 실패', { uid, code });
  });
  await Promise.all(dead.map((ref) => ref.delete().catch(() => {})));
  return res.successCount;
}

/** 같은 일은 한 번만 하도록 기록을 먼저 남긴다 (이미 있으면 false). 기록은 30일 뒤 자동으로 지워진다(TTL: expireAt). */
const KEEP_DAYS = 30;
async function once(id, extra) {
  const expireAt = admin.firestore.Timestamp.fromMillis(Date.now() + KEEP_DAYS * 86400000);
  try { await db.doc(`notifyLog/${id}`).create(Object.assign({ at: new Date().toISOString(), expireAt }, extra || {})); return true; }
  catch (e) { if (e.code === 6 || e.code === 'already-exists') return false; throw e; }
}

exports.onCheckCreated = onDocumentCreated('checks/{id}', async (event) => {
  const c = event.data && event.data.data();
  if (!c || c.done !== true || !c.by || !c.routine) return;
  if (!(await once(`check_${event.params.id}`))) return; // 껐다 켰다 반복해도 한 번만
  const r = await db.doc(`routines/${c.routine}`).get();
  if (!r.exists) return;
  const { dateKey: today } = N.kstParts(new Date());
  const who = await nameOf(c.by);
  for (const p of await partnersOf(c.by)) {
    const pf = await prefsFor(p);
    if (!pf.partner) continue;
    const msg = N.checkMessage({ who, routine: r.data(), date: c.date, today, hide: pf.hide });
    if (msg) await sendTo(p, msg, 'check', `check-${event.params.id}`);
  }
});

exports.eveningReminder = onSchedule({ schedule: '0,30 * * * *', timeZone: 'Asia/Seoul' }, async () => {
  const { dateKey, hhmm } = N.kstParts(new Date());
  const users = await db.collection('users').get();
  for (const u of users.docs) {
    try {
      const pf = N.prefsOf(u.data());
      if (!N.dueRemind(pf.remindAt, hhmm)) continue;
      if (!(await once(`remind_${u.id}_${dateKey}`))) continue; // 하루 한 번 (같은 시각에 두 번 돌아도)
      const rs = await db.collection('routines').where('owner', '==', u.id).get();
      const active = rs.docs.map((d) => Object.assign({ key: d.id }, d.data())).filter((r) => N.activeOn(r, dateKey));
      const missing = [];
      for (const r of active) {
        const ck = await db.doc(`checks/${r.key}_${dateKey}`).get();
        if (!ck.exists) missing.push(r);
      }
      const msg = N.remindMessage({ missing, hide: pf.hide });
      if (msg) await sendTo(u.id, msg, 'remind', 'remind');
    } catch (e) {
      logger.error('저녁 알림 실패', { uid: u.id, err: String(e) }); // 한 사람에서 막혀도 다음 사람은 계속
    }
  }
});

exports.onKungCreated = onDocumentCreated('kungs/{id}', async (event) => {
  const k = event.data && event.data.data();
  if (!k || !k.from || !k.to || typeof k.date !== 'string') return;
  const { dateKey: today } = N.kstParts(new Date());
  if (k.date !== today) return; // 오늘 보낸 꿍만 알린다
  if (!(await once(`kung_${event.params.id}`))) return;
  const pf = await prefsFor(k.to);
  if (!pf.partner) return; // 짝꿍 알림을 꺼 둔 사람에게는 보내지 않는다
  const rs = await db.collection('routines').where('owner', '==', k.to).get();
  const active = rs.docs.map((d) => Object.assign({ key: d.id }, d.data())).filter((r) => N.activeOn(r, today));
  let remaining = 0;
  for (const r of active) {
    const ck = await db.doc(`checks/${r.key}_${today}`).get();
    if (!ck.exists || ck.data().done !== true) remaining++;
  }
  await sendTo(k.to, N.kungMessage({ who: await nameOf(k.from), remaining }), 'kung', `kung-${today}`);
});

// 함께 할 일 (v38): 만든 사람 · 끝낸 사람의 짝꿍에게. 할 일 하나에 「추가」 · 「끝냄」 각각 한 번만 (되돌렸다 다시 끝내도)
async function todoNotify(id, type, t, by) {
  if (!t || t.scope !== 'together' || !by) return;
  if (!(await once(`todo_${type}_${id}`))) return;
  const who = await nameOf(by);
  for (const p of await partnersOf(by)) {
    const pf = await prefsFor(p);
    if (!pf.partner || !pf.todo) continue; // 짝꿍 알림 · 함께 할 일 알림 둘 다 켜져 있어야
    // 같은 tag 라 연달아 여러 개면 폰에는 마지막 것만 남는다
    await sendTo(p, N.todoMessage({ type, who, title: t.title, hide: pf.hide }), 'todo', 'todo', TODO_URL);
  }
}
exports.onTodoCreated = onDocumentCreated('todos/{id}', async (event) => {
  const t = event.data && event.data.data();
  if (!t) return;
  await todoNotify(event.params.id, 'add', t, t.createdBy);
  if (t.done === true) await todoNotify(event.params.id, 'done', t, t.doneBy); // 만들면서 바로 끝낸 경우
});
exports.onTodoUpdated = onDocumentUpdated('todos/{id}', async (event) => {
  const before = event.data && event.data.before.data(), after = event.data && event.data.after.data();
  if (!before || !after || before.done === true || after.done !== true) return; // 안 끝남 → 끝남 일 때만
  await todoNotify(event.params.id, 'done', after, after.doneBy);
});

// 루틴 시계 (v41): 15분마다. ① 아침 8시 — 어제 해야 했는데 안 한 내 루틴이 있으면 (하루 한 번, users.missNotify 끄면 안 옴)
//                         ② 정해 둔 시각(when.at, remind) — 그 시각부터 45분 안에, 오늘 아직 안 했으면 (루틴마다 하루 한 번)
exports.routineClock = onSchedule({ schedule: '*/15 * * * *', timeZone: 'Asia/Seoul' }, async () => {
  const { dateKey, hhmm } = N.kstParts(new Date());
  const yesterday = N.addDays(dateKey, -1);
  const morning = N.dueMorning(hhmm);
  const rsAll = await db.collection('routines').get();
  const routines = N.cleanRoutines(rsAll.docs.map((d) => Object.assign({ key: d.id }, d.data())));
  const timed = routines.filter((r) => { const w = N.whenOf(r); return w && w.remind && N.dueAt(w.at, hhmm); });
  if (!morning && !timed.length) return;
  const checked = async (key, day) => (await db.doc(`checks/${key}_${day}`).get()).exists;
  const prefs = {};
  const prefOf = async (uid) => (prefs[uid] = prefs[uid] || await prefsFor(uid));
  for (const r of timed) {
    try {
      if (!N.activeOn(r, dateKey) || await checked(r.key, dateKey)) continue;
      if (!(await once(`at_${r.key}_${dateKey}`))) continue;
      const pf = await prefOf(r.owner);
      await sendTo(r.owner, N.atMessage({ r, hide: pf.hide }), 'at', `at_${r.key}`);
    } catch (e) { logger.error('routineClock at', r.key, e); }
  }
  if (!morning) return;
  const owners = [...new Set(routines.map((r) => r.owner).filter(Boolean))];
  for (const uid of owners) {
    try {
      const pf = await prefOf(uid);
      if (!pf.miss) continue;
      if (!(await once(`miss_${uid}_${dateKey}`))) continue;
      const missed = [];
      for (const r of routines.filter((x) => x.owner === uid && N.activeOn(x, yesterday) && N.activeOn(x, dateKey))) {
        if (!(await checked(r.key, yesterday))) missed.push(r);
      }
      const msg = N.missMessage({ missed, hide: pf.hide });
      if (msg) await sendTo(uid, msg, 'miss', 'miss');
    } catch (e) { logger.error('routineClock miss', uid, e); }
  }
});

exports.onPing = onDocumentCreated('users/{uid}/pings/{pid}', async (event) => {
  if (event.data) await event.data.ref.delete().catch(() => {});
  const minute = new Date().toISOString().slice(0, 16);
  if (!(await once(`ping_${event.params.uid}_${minute}`))) return; // 1분에 한 번만
  await sendTo(event.params.uid, { title: N.TITLE, body: '🔔 알림이 잘 와요! 짝꿍이 체크하면 이렇게 알려 줄게요' }, 'test', 'test');
});

// 일요일 밤 9시: 이번 주(월~일) 둘이 함께 해낸 것 — 두 사람에게 같은 숫자 (각자 「일요일 저녁 돌아보기」를 끄면 안 보냄)
exports.weeklyReview = onSchedule({ schedule: '0 21 * * 0', timeZone: 'Asia/Seoul' }, async () => {
  const { dateKey: sun } = N.kstParts(new Date());
  const mon = N.addDays(sun, -6);
  const dates = [0, 1, 2, 3, 4, 5, 6].map((i) => N.addDays(mon, i));
  const persons = (await db.collection('members').get()).docs.map((d) => d.id);
  const routines = (await db.collection('routines').get()).docs.map((d) => Object.assign({ key: d.id }, d.data()));
  const cks = await db.collection('checks').where('date', '>=', mon).where('date', '<=', sun).get();
  const done = new Set(cks.docs.map((d) => d.data()).filter((c) => c.done === true).map((c) => c.routine + '|' + c.date));
  const monIso = new Date(mon + 'T00:00:00+09:00').toISOString();
  const tds = await db.collection('todos').where('doneAt', '>=', monIso).get();
  const together = tds.docs.map((d) => d.data()).filter((t) => t.done === true && t.scope === 'together').length;
  const msg = N.weeklyMessage({ allDays: N.allDoneDays({ routines, done, persons, dates }), together });
  for (const uid of persons) {
    try {
      if (!N.prefsOf((await db.doc(`users/${uid}`).get()).data()).weekly) continue;
      if (!(await once(`weekly_${uid}_${sun}`))) continue; // 한 주에 한 번
      await sendTo(uid, msg, 'weekly', `weekly-${sun}`, LOOK_URL);
    } catch (e) {
      logger.error('돌아보기 알림 실패', { uid, err: String(e) });
    }
  }
});

// 월말 · 연말결산 (docs/recap): 1일 새벽에 숫자를 계산해 두고(카드 화면은 이 문서만 읽음), 아침 9시에 알린다
exports.monthlyRecap = onSchedule({ schedule: '0 3 1 * *', timeZone: 'Asia/Seoul', timeoutSeconds: 300, memory: '512MiB' }, async () => {
  const out = await RJ.runMonthly(db, new Date());
  logger.info('결산 만듦', Object.keys(out).map((k) => k + (out[k] ? '' : '(건너뜀)')).join(' '));
});
exports.recapNotify = onSchedule({ schedule: '0 9 1 * *', timeZone: 'Asia/Seoul' }, async () => {
  const sent = await RJ.runNotify(db, new Date(), { send: sendTo, once, appUrl: APP_URL });
  logger.info('결산 알림', sent.length);
});
// 교환 쪽지 (docs/question 8절) · 11-23 저녁 9시 → 6시 (사용자 결정)
exports.questionDaily = onSchedule({ schedule: '0 18 * * *', timeZone: 'Asia/Seoul' }, async () => {
  const r = await QJ.runDaily(db, new Date(), { send: sendTo, once, appUrl: APP_URL, serverTime: () => admin.firestore.FieldValue.serverTimestamp() });
  logger.info('교환 쪽지 저녁 알림', r.date, r.sent.length);
});
exports.questionAnswered = onDocumentCreated('qdays/{date}/a/{uid}', async (event) => {
  await QJ.runAnswered(db, { date: event.params.date, author: event.params.uid }, new Date(), { send: sendTo, once, appUrl: APP_URL });
});

// 출출 쿠키 · 꿍으로 알려 주기 (docs/eat 8절): eatPings 문서가 생기면 단짝에게 — 고른 음식 이름만 (메모 · 가게는 안 넣음). 짝꿍 알림을 끄면 안 보냄
exports.onEatPing = onDocumentCreated('eatPings/{id}', async (event) => {
  const d = event.data && event.data.data();
  if (!d || typeof d.by !== 'string' || typeof d.food !== 'string') return;
  if (!(await once(`eat_${event.params.id}`))) return;
  for (const p of await partnersOf(d.by)) {
    if (!(await prefsFor(p)).partner) continue;
    await sendTo(p, { title: ET.T.pushTitle, body: ET.T.pushBody(d.food.slice(0, 20)) }, 'eat', 'eat', `${APP_URL}?tab=all&open=eat`);
  }
});

// 출출 쿠키 E5 · 음식점 찾기 (docs/eat 6절): { q } → 카카오 장소 후보 (보여 주기만). 두 사람(members)만 · 한 사람 하루 100번
//  횟수는 placeUse/{uid_날짜} (앱 규칙에 없어 앱은 못 읽고 못 씀). 카카오가 실패하면 그 번은 돌려줌
exports.searchPlace = onCall({ secrets: [KAKAO_REST_KEY], timeoutSeconds: 20, maxInstances: 3 }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인해 주세요');
  if (!(await db.doc(`members/${uid}`).get()).exists) throw new HttpsError('permission-denied', '단짝꿍 멤버만 쓸 수 있어요');
  const bad = SP.badInput(req.data);
  if (bad) throw new HttpsError('invalid-argument', bad);
  const useRef = db.doc(`placeUse/${SP.useKey(uid, new Date())}`);
  const used = await db.runTransaction(async (tx) => {
    const d = await tx.get(useRef);
    const n = (d.exists && d.data().n) || 0;
    if (n >= SP.LIMITS.perDay) return -1;
    tx.set(useRef, { n: n + 1, uid, at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return n + 1;
  });
  if (used < 0) throw new HttpsError('resource-exhausted', '오늘은 많이 찾았어요. 이름만 적거나 내일 다시 찾아 주세요');
  try {
    const items = await SP.searchKakao(KAKAO_REST_KEY.value(), SP.cleanQuery(req.data.q));
    return { items, used, limit: SP.LIMITS.perDay };
  } catch (e) {
    logger.error('searchPlace kakao', { status: e.status, msg: String(e.message).slice(0, 200) });
    await db.runTransaction(async (tx) => {
      const d = await tx.get(useRef); const n = (d.exists && d.data().n) || 0;
      if (n > 0) tx.set(useRef, { n: n - 1 }, { merge: true });
    }).catch(() => {});
    throw new HttpsError('unavailable', '지금은 찾지 못했어요. 이름만 적어 주세요');
  }
});

// 단짝 식탁(parseMeal · findProduct)은 11-20에 폐기 — 함수를 지워 AI 비용을 멈춤 (docs/diet 기록, 데이터는 남김)

// 단짝 지도 (v54): 새 방문이 저장되면 만든 사람이 아닌 쪽에게 「OO 다녀온 기록이 생겼어요 · 별점을 남겨 주세요」 → 누르면 그 지역 시트.
//  방문 하나에 한 번만 (notifyLog place_<코드>_<방문 id>). 지도 알림(users.mapNudge)만 따름 — 짝꿍 알림을 꺼도 온다 (11-23 사용자 결정).
//  3일 안에 안 남겼을 때 다시 알리기는 하지 않는다 (나중 후보).
exports.onPlaceWritten = onDocumentWritten('places/{code}', async (event) => {
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;
  const code = event.params.code;
  for (const v of N.newVisits(before, after)) {
    if (!(await once(`place_${code}_${v.id}`))) continue;
    for (const p of await partnersOf(v.createdBy)) {
      const pf = await prefsFor(p);
      if (!pf.map) continue;
      await sendTo(p, N.mapMessage({ place: REGIONS[code] }), 'map', `map-${code}`, `${APP_URL}?tab=all&map=${code}`);
    }
  }
});

// 집중 F2: 짝꿍이 집중을 시작하면 · 「같이 하자」를 누르면 짝꿍에게 (users.focusStart · users.focusCall — 없으면 켬)
//  한 집중에 한 번 (notifyLog focusStart_<uid>_<start>), 같이 하자 한 번에 한 번 (focusCall_<uid>_<call>). 잠금 화면 숨김을 켜면 과목 이름은 뺀다.
exports.onFocusWritten = onDocumentWritten('focus/{uid}', async (event) => {
  const uid = event.params.uid;
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;
  const ev = N.focusEvents(before, after, Date.now());
  if (!ev.start && !ev.call) return;
  const who = await nameOf(uid);
  let catName = '';
  if (ev.start && after.cat) {
    try { const cs = await db.collection('cats').get(); const c = SC.find(SC.fromDocs(cs.docs.map((d) => Object.assign({ id: d.id }, d.data()))), after.cat); catName = (c && c.name) || ''; } catch (e) { catName = ''; }
  }
  for (const p of await partnersOf(uid)) {
    const pf = await prefsFor(p);
    if (ev.call && pf.focusCall && await once(`focusCall_${uid}_${after.call}`)) {
      await sendTo(p, N.focusCallMessage({ who }), 'focus', 'focus-call', FOCUS_URL);
    } else if (ev.start && pf.focusStart && await once(`focusStart_${uid}_${after.start}`)) {
      await sendTo(p, N.focusStartMessage({ who, cat: catName, label: typeof after.label === 'string' ? after.label : '', hide: pf.hide }), 'focus', 'focus-start', FOCUS_URL);
    }
  }
});
