/* 저장소 — Firestore(웹)와 artifact db 둘 다 같은 모양으로 쓴다.
   members/<uid>         : { name, joinedAt }   (웹: 로그인한 사람의 이름)
   config/app            : { ownerPerson, guestPerson, people }   (artifact 판에서만)
   routines/<key>        : { icon, name, who, owner, start:'YYYY-MM-DD', end:'YYYY-MM-DD'|null, order }
   checks/<루틴>_<날짜>   : { routine, date:'YYYY-MM-DD', done:true, by:'사람 키', byUid, at:ISO }  (안 한 날은 문서 없음) */
(function (root) {
  'use strict';

  function checkId(routine, dateKey) { return routine + '_' + dateKey; }

  /** 저장소 값 위에 아직 저장 중인 내 탭을 덮어 보여 준다. */
  function mergeChecks(server, pending) {
    var out = Object.assign({}, server);
    Object.keys(pending).forEach(function (id) {
      if (pending[id]) out[id] = true; else delete out[id];
    });
    return out;
  }

  function valid(v) {
    if (!v || v.done !== true || typeof v.routine !== 'string' || typeof v.date !== 'string') return null;
    return { routine: v.routine, date: v.date, done: true, by: typeof v.by === 'string' ? v.by : null, at: typeof v.at === 'string' ? v.at : null };
  }

  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function createStore(db, opts) {
    var retryDelay = (opts && opts.retryDelay) || function () { return 400 + Math.random() * 600; };
    var queues = {}; // 문서마다 쓰기를 한 줄로 세워 순서가 뒤바뀌지 않게
    // Firestore는 '캐시 → 서버 확인'을 알리려면 옵션이 필요하다 (artifact db는 옵션을 받지 않는다)
    var withMeta = !!(opts && opts.metadataChanges);
    function listen(ref, next, fail) {
      return withMeta ? ref.onSnapshot({ includeMetadataChanges: true }, next, fail) : ref.onSnapshot(next, fail);
    }

    function write(ref, done, routine, dateKey, who) {
      return done
        ? ref.set({ routine: routine, date: dateKey, done: true, by: (who && who.person) || null, byUid: (who && who.uid) || null, at: new Date().toISOString() })
        : ref.delete();
    }

    return {
      watchConfig: function (next, fail) {
        return db.doc('config/app').onSnapshot(function (snap) { next(snap.exists ? snap.data() : null); }, fail);
      },
      /** 사람 목록: members/<uid> → next({ uid: { name } }) */
      watchMembers: function (next, fail) {
        return listen(db.collection('members'), function (q) {
          var out = {};
          q.docs.forEach(function (doc) { var v = doc.data(); if (v && typeof v.name === 'string') out[doc.id] = { name: v.name }; });
          next(out, !!(q.metadata && q.metadata.fromCache));
        }, fail);
      },
      saveMember: function (uid, name) {
        return db.doc('members/' + uid).set({ name: name, joinedAt: new Date().toISOString() });
      },
      // ── 알림 ──
      // users/<uid>                 : { notify: { partner, remindAt, hide }, tz, updatedAt }  — 내 모든 기기에 같이 적용
      // users/<uid>/devices/<기기>   : { token, platform, ua, updatedAt }                     — 기기마다 하나 (웹 · 나중에 iOS/안드로이드 앱)
      // users/<uid>/pings/<id>      : { at }                                                — 테스트 알림 요청 (서버가 보내고 지운다)
      watchUser: function (uid, next, fail) {
        return listen(db.doc('users/' + uid), function (snap) {
          next(snap.exists ? snap.data() : null, !!(snap.metadata && snap.metadata.fromCache));
        }, fail);
      },
      saveNotify: function (uid, notify) {
        return db.doc('users/' + uid).set({
          notify: { partner: !!notify.partner, remindAt: notify.remindAt || null, hide: !!notify.hide },
          tz: 'Asia/Seoul', updatedAt: new Date().toISOString()
        });
      },
      saveDevice: function (uid, deviceId, d) {
        return db.doc('users/' + uid + '/devices/' + deviceId).set({ token: d.token, platform: d.platform || 'web', ua: String(d.ua || '').slice(0, 80), updatedAt: new Date().toISOString() });
      },
      deleteDevice: function (uid, deviceId) { return db.doc('users/' + uid + '/devices/' + deviceId).delete(); },
      ping: function (uid) { return db.doc('users/' + uid + '/pings/' + newKey()).set({ at: new Date().toISOString() }); },
      /** 루틴 목록: routines/<key> 문서들 → next([{ key, icon, name, who, owner, start, end, order }]) */
      watchRoutines: function (next, fail) {
        return db.collection('routines').onSnapshot(function (q) {
          next(q.docs.map(function (doc) { return Object.assign({}, doc.data(), { key: doc.id }); }));
        }, fail);
      },
      /** 루틴 하나 저장 (새로 만들기 · 고치기 · 그만하기 모두 이것으로). */
      saveRoutine: function (r) {
        var body = { icon: r.icon, name: r.name, who: r.who, owner: r.owner, start: r.start, end: r.end || null, order: r.order, updatedAt: new Date().toISOString() };
        return db.doc('routines/' + r.key).set(body);
      },
      deleteRoutine: function (key) { return db.doc('routines/' + key).delete(); },
      /** next(map, meta, changes)
       *  map:     { 'squat|2026-10-18': true }
       *  meta:    { 'squat|2026-10-18': { by, at } }   누가 · 언제
       *  changes: 이번에 새로 생기거나 바뀐 체크 [{ routine, date, done, by, at }] (첫 전달은 first=true) */
      watchChecks: function (next, fail) {
        var first = true;
        return listen(db.collection('checks'), function (q) {
          var map = {}, meta = {};
          q.docs.forEach(function (doc) {
            var v = valid(doc.data());
            if (!v) return;
            map[v.routine + '|' + v.date] = true;
            meta[v.routine + '|' + v.date] = { by: v.by, at: v.at };
          });
          var changes = [];
          if (typeof q.docChanges === 'function') {
            q.docChanges().forEach(function (c) {
              if (c.type === 'removed') return;
              var v = valid(c.doc.data());
              if (v) changes.push(v);
            });
          }
          next(map, meta, changes, first, !!(q.metadata && q.metadata.fromCache));
          first = false;
        }, fail);
      },
      /** 같은 문서에 대한 쓰기는 앞의 것이 끝난 뒤에 나간다. 일시 오류는 한 번만 다시 시도. */
      setDone: function (routine, dateKey, done, who) {
        var id = checkId(routine, dateKey);
        var ref = db.doc('checks/' + id);
        var prev = queues[id] || Promise.resolve();
        var run = prev.catch(function () {}).then(function () {
          return write(ref, done, routine, dateKey, who).catch(function (e) {
            if (!e || e.code !== 'unavailable') throw e;
            return wait(retryDelay()).then(function () { return write(ref, done, routine, dateKey, who); });
          });
        });
        queues[id] = run;
        run.then(function () { if (queues[id] === run) delete queues[id]; }, function () { if (queues[id] === run) delete queues[id]; });
        return run;
      }
    };
  }

  /** 새 루틴 키: 시간 + 무작위 (영문·숫자만) */
  function newKey() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var api = { createStore: createStore, checkId: checkId, mergeChecks: mergeChecks, newKey: newKey };
  root.RT = root.RT || {};
  root.RT.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
