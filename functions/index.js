/* 단짝꿍 알림 서버 (Cloud Functions 2세대, 서울 리전)
   - onCheckCreated : 체크가 저장되면 짝꿍에게 "OO 님이 OO 완료!"
   - eveningReminder: 30분마다, 정해 둔 시간까지 내 루틴을 안 했으면 나에게 알림 (하루 한 번)
   - onPing         : 앱의 「테스트 알림 보내기」
   기기 주소는 users/<uid>/devices/<기기> 에 있고, 못 쓰게 된 주소는 보낼 때 지운다. */
'use strict';
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const N = require('./notify');

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10, memory: '256MiB' });

const APP_URL = 'https://banstom.github.io/danjjakkung/';
const ICON = APP_URL + 'icons/icon-192.png';

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
async function sendTo(uid, msg, kind, tag) {
  const devs = await db.collection(`users/${uid}/devices`).get();
  const seen = new Set();
  const list = devs.docs.filter((d) => {
    const t = d.data().token;
    if (typeof t !== 'string' || !t || seen.has(t)) return false; // 같은 주소가 두 번 있으면 한 번만
    seen.add(t); return true;
  });
  if (!list.length) return 0;
  const data = { kind, title: msg.title, body: msg.body, tag: tag || kind, link: APP_URL, icon: ICON };
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

exports.onPing = onDocumentCreated('users/{uid}/pings/{pid}', async (event) => {
  if (event.data) await event.data.ref.delete().catch(() => {});
  const minute = new Date().toISOString().slice(0, 16);
  if (!(await once(`ping_${event.params.uid}_${minute}`))) return; // 1분에 한 번만
  await sendTo(event.params.uid, { title: N.TITLE, body: '🔔 알림이 잘 와요! 짝꿍이 체크하면 이렇게 알려 줄게요' }, 'test', 'test');
});
