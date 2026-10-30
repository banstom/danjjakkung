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
      // ── 할 일 · 시간표 ──
      // todos/<id>  : { scope: 'together' | uid, title, due, done, doneBy, doneAt, createdBy, createdAt, updatedAt }
      // events/<id> : { owner: uid | 'both', title, (short), weekly, weekday, (weekdays), date, start, end, createdBy, updatedAt } — js/schedule.js 참고
      //   + cat (카테고리 id | null), ui: { <uid>: { u, i, at } } (u&I 평면 위치 — 각자 자기 칸만)
      // 할 일은 남은 일 + 오늘(sinceIso 이후) 완료한 일만 늘 듣는다 — 완료한 일이 쌓여도 여는 양은 그대로.
      // 그 전에 완료한 일은 보관함을 열 때만 loadDone 으로 조금씩.
      watchTodos: function (next, fail, sinceIso) {
        var open = null, done = null;
        function rows(q) { return q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); }); }
        function emit() {
          if (!open || !done) return;
          var byId = {};
          open.concat(done).forEach(function (t) { byId[t.id] = t; }); // 막 완료한 일은 두 쪽에 잠깐 같이 있을 수 있다 — 뒤(완료) 쪽이 이김
          next(Object.keys(byId).sort().map(function (k) { return byId[k]; }));
        }
        var col = db.collection('todos');
        var a = col.where('done', '==', false).onSnapshot(function (q) { open = rows(q); emit(); }, fail);
        var b = col.where('doneAt', '>=', sinceIso).onSnapshot(function (q) { done = rows(q); emit(); }, fail);
        return function () { a(); b(); };
      },
      /** 보관함: beforeIso 보다 앞에 완료한 일, 최근 것부터 n개 */
      loadDone: function (beforeIso, n) {
        return db.collection('todos').where('doneAt', '<', beforeIso).orderBy('doneAt', 'desc').limit(n).get().then(function (q) {
          return q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); });
        });
      },
      /** 아는 칸만 덮어쓴다 (mergeFields) — 평면 위치(ui)와 더 새 버전이 넣은 칸은 그대로 남는다 */
      saveTodo: function (t) {
        return db.doc('todos/' + t.id).set({
          scope: t.scope, title: t.title, due: t.due || null, done: !!t.done, doneBy: t.done ? t.doneBy : null, doneAt: t.done ? t.doneAt : null,
          createdBy: t.createdBy, createdAt: t.createdAt, updatedAt: new Date().toISOString(), cat: t.cat || null, short: t.short || null
        }, { mergeFields: ['scope', 'title', 'due', 'done', 'doneBy', 'doneAt', 'createdBy', 'createdAt', 'updatedAt', 'cat', 'short'] });
      },
      /** 내 평면 위치만 바꾼다 (짝꿍이 놓은 위치는 그대로) */
      placeTodo: function (id, uid, u, i) {
        var patch = { updatedAt: new Date().toISOString() };
        patch['ui.' + uid] = { u: u, i: i, at: patch.updatedAt };
        return db.doc('todos/' + id).update(patch);
      },
      /** u&I 기록 — 궤적 · 회고용 (남기기만) */
      logUi: function (e) {
        var doc = { todo: e.todo, by: e.by, type: e.type, at: new Date().toISOString() };
        if (typeof e.u === 'number') doc.u = e.u;
        if (typeof e.i === 'number') doc.i = e.i;
        return db.doc('uiLog/' + newKey()).set(doc);
      },
      deleteTodo: function (id) { return db.doc('todos/' + id).delete(); },
      watchEvents: function (next, fail) {
        return db.collection('events').onSnapshot(function (q) {
          next(q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); }));
        }, fail);
      },
      saveEvent: function (e) {
        // 요일이 하나면 예전 모양(weekday) 그대로, 여럿이면 weekdays 목록
        var days = e.weekly ? e.weekdays : [];
        // 더 새 버전 앱이 넣은 필드(extra)는 그대로 남긴다 — 옛 버전이 고쳐도 새 필드가 지워지지 않게
        var doc = Object.assign({}, e.extra || {});
        Object.assign(doc, { owner: e.owner, title: e.title, weekly: !!e.weekly, weekday: days.length === 1 ? days[0] : null, date: e.weekly ? null : e.date,
          start: e.start, end: e.end, createdBy: e.createdBy, updatedAt: new Date().toISOString() });
        if (e.weekly && e.skip && e.skip.length) doc.skip = e.skip.slice(); // 쉬는 날 (없으면 필드 없음)
        if (days.length > 1) doc.weekdays = days.slice();
        if (e.short) doc.short = e.short; // 표시할 이름 (일정 이름과 같거나 비면 필드 없음)
        if (e.cat) doc.cat = e.cat; // 카테고리 (없으면 필드 없음)
        // 요일마다 시간이 다를 때만: { '1': '10:00-11:00', '3': '16:00-17:00' }
        if (days.length > 1 && e.times) {
          doc.times = {};
          days.forEach(function (w) { doc.times[String(w)] = e.times[w].start + '-' + e.times[w].end; });
        }
        return db.doc('events/' + e.id).set(doc);
      },
      deleteEvent: function (id) { return db.doc('events/' + id).delete(); },
      // cats/<id> : { name, icon, order, updatedBy, updatedAt } 또는 { deleted: true, ... } — js/cats.js 참고 (둘이 같이 쓰는 목록)
      watchCats: function (next, fail) {
        return db.collection('cats').onSnapshot(function (q) {
          next(q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); }));
        }, fail);
      },
      saveCat: function (c, uid) {
        return db.doc('cats/' + c.id).set({ name: c.name, icon: c.icon, order: Math.max(0, Math.min(999, Math.round(c.order) || 0)), updatedBy: uid, updatedAt: new Date().toISOString() });
      },
      /** 기본 카테고리는 지운 표시를 남기고(문서가 없으면 기본값이 되살아나니까), 새로 만든 것은 문서를 지운다 */
      deleteCat: function (id, isDefault, uid) {
        return isDefault ? db.doc('cats/' + id).set({ deleted: true, updatedBy: uid, updatedAt: new Date().toISOString() }) : db.doc('cats/' + id).delete();
      },
      // ── 알림 ──
      // users/<uid>                 : { notify: { partner, remindAt, hide }, tz, colors, updatedAt }  — 내 모든 기기에 같이 적용
      //   colors: { '<테마 id>': { self, partner } } — 테마마다 내 화면의 나 · 상대 색 (없으면 그 테마 기본색)
      //   알림 설정과 색은 각자 자기 칸만 덮어쓴다 (mergeFields) — 한쪽을 저장해도 다른 쪽이 지워지지 않게
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
        }, { mergeFields: ['notify', 'tz', 'updatedAt'] });
      },
      /** 색 전체를 통째로 바꾼다 (테마 하나를 기본으로 되돌리면 그 칸이 빠진다). */
      saveColors: function (uid, colors) {
        return db.doc('users/' + uid).set({ colors: colors, updatedAt: new Date().toISOString() }, { mergeFields: ['colors', 'updatedAt'] });
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
