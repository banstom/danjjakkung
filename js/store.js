/* 저장소 — Firestore(웹)와 artifact db 둘 다 같은 모양으로 쓴다.
   members/<uid>         : { name, joinedAt }   (웹: 로그인한 사람의 이름)
   config/app            : { ownerPerson, guestPerson, people }   (artifact 판에서만)
   routines/<key>        : { icon, name, who, owner, start:'YYYY-MM-DD', end:'YYYY-MM-DD'|null, order, rest?: [{ from, to|null }], when?: { cue?, at?, remind? } | null }
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

  // 서버 시각 (Firestore 웹 SDK compat) · 칸 지우기. 시험용 가짜 저장소도 같은 이름을 준다
  function fv() { return root.firebase && root.firebase.firestore && root.firebase.firestore.FieldValue; }
  function ts() { var f = fv(); return f ? f.serverTimestamp() : Date.now(); }
  function del() { var f = fv(); return f ? f.delete() : null; }
  var EST = { serverTimestamps: 'estimate' }; // 막 쓴 서버 시각도 기기 추정값으로 바로 보이게
  /** Timestamp · Date · ms · ISO 글 → ms (없으면 null) */
  function msOf(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'string') { var t = Date.parse(v); return isFinite(t) ? t : null; }
    if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6);
    return null;
  }
  function msMap(m) { var o = {}; Object.keys(m || {}).forEach(function (k) { if (m[k] != null) o[k] = msOf(m[k]) || 1; }); return o; }
  /** 집중 문서 ↔ 앱 모양: segs [{ s, e }] ↔ [[s, e]] */
  function focusIn(d) {
    var o = Object.assign({}, d || {});
    o.segs = Array.isArray(o.segs) ? o.segs.map(function (x) { return Array.isArray(x) ? [x[0], x[1]] : [Number(x && x.s), Number(x && x.e)]; }).filter(function (x) { return isFinite(x[0]) && isFinite(x[1]); }) : [];
    delete o.updatedAt; delete o.createdAt; delete o.editedAt;
    return o;
  }
  function focusOut(d) {
    var o = {};
    Object.keys(d || {}).forEach(function (k) { if (k !== 'id' && d[k] !== undefined) o[k] = d[k]; });
    if (Array.isArray(o.segs)) o.segs = o.segs.map(function (x) { return { s: Math.round(x[0]), e: Math.round(x[1]) }; });
    return o;
  }
  /** qdays 문서 → 계산 모듈 모양 */
  function qDayOf(date, d) {
    d = d || {};
    return { date: date, q: d.q, text: String(d.text || ''), src: d.src, by: d.by || null, skipped: Array.isArray(d.skipped) ? d.skipped : [],
      done: msMap(d.done), likes: Object.assign({}, d.likes || {}), swappedAt: d.swappedAt ? msOf(d.swappedAt) : null, swappedBy: d.swappedBy || null };
  }
  /** eats 문서 → 계산 모듈 모양 (시각은 ms) */
  function eatOf(id, d) {
    var c = Object.assign({}, d, { id: id, at: msOf(d.at) || 0 });
    if (d.editedAt) c.editedAt = msOf(d.editedAt);
    if (d.pick) c.pick = Object.assign({}, d.pick, { at: msOf(d.pick.at) });
    if (d.eaten) c.eaten = Object.assign({}, d.eaten, { at: msOf(d.eaten.at) || 0 });
    return c;
  }

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
      //   + cat (카테고리 id | null), short, memo (메모 | null, 200자까지), ui: { <uid>: { u, i, at } } (u&I 평면 위치 — 각자 자기 칸만)
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
      // 메모(memo)는 있을 때 · 지울 때(clearMemo)만 쓴다 — 메모 없는 할 일은 v30 이전 규칙에서도 저장되게
      saveTodo: function (t) {
        var fields = ['scope', 'title', 'due', 'done', 'doneBy', 'doneAt', 'createdBy', 'createdAt', 'updatedAt', 'cat', 'short'];
        var data = {
          scope: t.scope, title: t.title, due: t.due || null, done: !!t.done, doneBy: t.done ? t.doneBy : null, doneAt: t.done ? t.doneAt : null,
          createdBy: t.createdBy, createdAt: t.createdAt, updatedAt: new Date().toISOString(), cat: t.cat || null, short: t.short || null
        };
        if (t.memo || t.clearMemo) { data.memo = t.memo || null; fields.push('memo'); }
        return db.doc('todos/' + t.id).set(data, { mergeFields: fields });
      },
      /** 돌아보기: [fromIso, toIso) 사이에 완료한 일 (한 필드 범위 조건이라 색인이 따로 필요 없다) */
      loadDoneBetween: function (fromIso, toIso) {
        return db.collection('todos').where('doneAt', '>=', fromIso).where('doneAt', '<', toIso).get().then(function (q) {
          return q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); });
        });
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
        // 그날만 바뀐 시간: { 'YYYY-MM-DD': 'HH:MM-HH:MM' } (없으면 필드 없음)
        var mk = e.weekly && e.moved ? Object.keys(e.moved) : [];
        var sp = function (t) { return t.start + '-' + t.end; };
        // 다른 날로 옮겼으면 앞에 옮긴 날: 'YYYY-MM-DD HH:MM-HH:MM,…'
        if (mk.length) { doc.moved = {}; mk.forEach(function (k) { var m = e.moved[k]; doc.moved[k] = (m.to ? m.to + ' ' : '') + m.spans.map(sp).join(','); }); }
        // 함께 일정에서 그날만 혼자: { 'YYYY-MM-DD': <uid> } (없으면 필드 없음)
        var sk = e.owner === 'both' && e.solo ? Object.keys(e.solo) : [];
        if (sk.length) { doc.solo = {}; sk.forEach(function (k) { doc.solo[k] = e.solo[k]; }); }
        if (e.more && e.more.length) doc.more = e.more.map(sp); // 하루에 한 번 더 (없으면 필드 없음)
        if (e.weekly && e.last) doc.last = e.last; // 마지막 날 (이 날 포함, 없으면 계속). 예전 until 은 이걸로 바뀐다
        if (e.weekly && e.from) doc.from = e.from; // 이 날짜(그 주 월요일)부터 매주 (없으면 앱을 처음 쓴 주부터)
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
      // places/<시군구코드> — 단짝 지도 (v48). 지도 화면이 열려 있는 동안만 듣고, 「전체」 카드는 한 번만 읽는다
      watchPlaces: function (next, fail) {
        return db.collection('places').onSnapshot(function (q) {
          var out = {}; q.docs.forEach(function (doc) { out[doc.id] = doc.data(); }); next(out);
        }, fail);
      },
      loadPlaces: function () {
        return db.collection('places').get().then(function (q) {
          var out = {}; q.docs.forEach(function (doc) { out[doc.id] = doc.data(); }); return out;
        });
      },
      /** 문서 하나를 읽어 change(지금 값 | null) → 새 값으로 바꾼다 (둘이 동시에 고쳐도 꼬이지 않게 트랜잭션) */
      updatePlace: function (code, uid, change) {
        var ref = db.doc('places/' + code);
        return db.runTransaction(function (tx) {
          return tx.get(ref).then(function (snap) {
            var next = change(snap.exists ? snap.data() : null);
            next.code = code; next.updatedBy = uid; next.updatedAt = new Date().toISOString();
            tx.set(ref, next);
            return next; // 저장한 값 → 화면에 바로 반영
          });
        });
      },
      /** 여러 places 문서를 한 트랜잭션에서 읽고 고친다. fn({ code: 지금 값 | 없음 }) → { code: 바꿀 칸 } (v50 순위 · 다시 매기기) */
      transactPlaces: function (codes, uid, fn) {
        var refs = {}, at = new Date().toISOString();
        codes.forEach(function (c) { refs[c] = db.doc('places/' + c); });
        return db.runTransaction(function (tx) {
          var list = Object.keys(refs);
          return Promise.all(list.map(function (c) { return tx.get(refs[c]); })).then(function (snaps) {
            var data = {}; snaps.forEach(function (sn, i) { if (sn.exists) data[list[i]] = sn.data(); });
            var writes = fn(data), done = {};
            Object.keys(writes).forEach(function (c) {
              // v54: 옛 칸(지역 stars · visits[].note)은 지운 모양으로 — 규칙이 옛 칸을 받지 않는다
              var cur = root.RT && root.RT.places ? root.RT.places.tidy(data[c] || {}) : (data[c] || {});
              var next = Object.assign({ visits: [], entries: {} }, cur, writes[c], { code: c, updatedBy: uid, updatedAt: at });
              tx.set(refs[c] || db.doc('places/' + c), next);
              done[c] = next;
            });
            return done;
          });
        });
      },
      // 단짝 식탁 (D2): goals/<uid> = 목표 숫자(둘 다 읽음) · private/<uid> = 몸 정보(본인만)
      watchGoals: function (next, fail) {
        return db.collection('goals').onSnapshot(function (q) { var out = {}; q.docs.forEach(function (doc) { out[doc.id] = doc.data(); }); next(out); }, fail);
      },
      loadGoals: function () {
        return db.collection('goals').get().then(function (q) { var out = {}; q.docs.forEach(function (doc) { out[doc.id] = doc.data(); }); return out; });
      },
      watchPrivate: function (uid, next, fail) {
        return db.doc('private/' + uid).onSnapshot(function (snap) { next(snap.exists ? snap.data() : null); }, fail);
      },
      /** 몸 정보와 목표를 한 번에 (둘 중 하나만 저장되지 않게) */
      saveDietGoal: function (uid, priv, goal) {
        var b = db.batch();
        // 적은 칸만 통째로 바꾼다(mergeFields) — 몸 정보 · 확인한 때는 지우지 않고, 고친 값 목록(edits)은 안쪽까지 새 것으로 (merge 는 안쪽 map 을 합쳐 옛 값이 남았다 — 점검 AI)
        b.set(db.doc('private/' + uid), priv, { mergeFields: Object.keys(priv) });
        b.set(db.doc('goals/' + uid), goal);
        return b.commit();
      },
      // meals/<uid>_<YYYY-MM-DD> = { uid, date, meals: [끼니], updatedAt } — 단짝 식탁 하루 기록 (D3). 둘 다 읽고 본인만 고침
      /** 내 식품 (foods/*) — 둘이 함께 씀. 이름 → 1단위 값 */
      watchFoods: function (next, fail) {
        return db.collection('foods').onSnapshot(function (q) { var out = {}; q.docs.forEach(function (doc) { var d = doc.data(); if (d && d.name) out[d.name] = d; }); next(out); }, fail);
      },
      setFood: function (id, food) { return db.doc('foods/' + id).set(food); },
      deleteFood: function (id) { return db.doc('foods/' + id).delete(); },
      /** 그 기간에 기록이 있는 날 { 'YYYY-MM-DD': true } (둘 다 — 짝꿍 식탁 달력의 점) */
      mealMonth: function (from, to) {
        return db.collection('meals').where('date', '>=', from).where('date', '<=', to).get().then(function (q) {
          var out = {}; q.docs.forEach(function (doc) { var d = doc.data(); if (d && d.date && d.meals && d.meals.length) out[d.date] = true; }); return out;
        });
      },
      watchMealDay: function (uid, date, next, fail) {
        return db.doc('meals/' + uid + '_' + date).onSnapshot(function (snap) { next(snap.exists ? snap.data() : null); }, fail);
      },
      /** 오늘 문서를 통째로 (앱이 가진 목록으로) — 오프라인이어도 바로 화면에 반영되고 나중에 올라감 (트랜잭션은 오프라인에서 실패 — 점검 AI). 쓰는 사람은 본인뿐 */
      setMealDay: function (uid, date, meals) {
        return db.doc('meals/' + uid + '_' + date).set({ uid: uid, date: date, meals: meals, updatedAt: new Date().toISOString() });
      },
      /** 끼니 하나 더하기 / 바꾸기(같은 id) — 시각 순으로 (지난 날짜처럼 앱에 그날 목록이 없을 때) */
      saveMeal: function (uid, date, meal) {
        var ref = db.doc('meals/' + uid + '_' + date), add = Array.isArray(meal) ? meal : [meal];
        var ids = add.map(function (m) { return m.id; });
        return db.runTransaction(function (tx) {
          return tx.get(ref).then(function (snap) {
            var list = ((snap.exists && snap.data().meals) || []).filter(function (m) { return ids.indexOf(m.id) < 0; });
            if (list.length + add.length > 20) throw new Error('too-many');
            list = list.concat(add);
            list.sort(function (a, b) { return String(a.at || '').localeCompare(String(b.at || '')); });
            tx.set(ref, { uid: uid, date: date, meals: list, updatedAt: new Date().toISOString() });
          });
        });
      },
      deleteMeal: function (uid, date, id) {
        var ref = db.doc('meals/' + uid + '_' + date);
        return db.runTransaction(function (tx) {
          return tx.get(ref).then(function (snap) {
            if (!snap.exists) return;
            var list = (snap.data().meals || []).filter(function (m) { return m.id !== id; });
            tx.set(ref, { uid: uid, date: date, meals: list, updatedAt: new Date().toISOString() });
          });
        });
      },
      // avatars/<uid> = { img: 'data:image/jpeg;base64,…'(256px), updatedAt } — 프로필 사진 (v51). 둘 다 읽고 본인만 고침
      watchAvatars: function (next, fail) {
        return db.collection('avatars').onSnapshot(function (q) { var out = {}; q.docs.forEach(function (doc) { out[doc.id] = doc.data(); }); next(out); }, fail);
      },
      saveAvatar: function (uid, img) { return db.doc('avatars/' + uid).set({ img: img, updatedAt: new Date().toISOString() }); },
      deleteAvatar: function (uid) { return db.doc('avatars/' + uid).delete(); },
      // couple/main : { start: 'YYYY-MM-DD', label, box?, updatedBy, updatedAt } — 우리 기념일 (v46, 둘이 같이 쓰고 둘 다 고친다)
      watchCouple: function (next, fail) {
        return db.doc('couple/main').onSnapshot(function (snap) { next(snap.exists ? snap.data() : null); }, fail);
      },
      saveCouple: function (c, uid) {
        // merge: 박스 모양(box)은 그대로 둔다 (v52)
        return db.doc('couple/main').set({ start: c.start, label: c.label, updatedBy: uid, updatedAt: new Date().toISOString() }, { merge: true });
      },
      // ── 알림 ──
      // users/<uid>                 : { notify: { partner, remindAt, hide }, weekly, todoNotify, tz, colors, updatedAt }  — 내 모든 기기에 같이 적용 (weekly: 일요일 돌아보기, 없으면 켬)
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
      /** 일요일 저녁 돌아보기 알림 (v37) — notify 밖에 따로 둔다: 옛 버전 앱이 notify 를 통째로 저장해도 지워지지 않게. 없으면 켬 */
      saveWeekly: function (uid, on) {
        return db.doc('users/' + uid).set({ weekly: !!on, updatedAt: new Date().toISOString() }, { mergeFields: ['weekly', 'updatedAt'] });
      },
      /** 값 설정 하나 (v44 routineView) */
      saveValue: function (uid, field, v) {
        var body = { updatedAt: new Date().toISOString() }; body[field] = v;
        return db.doc('users/' + uid).set(body, { mergeFields: [field, 'updatedAt'] });
      },
      /** 루틴 순서만 바꾸기 (v44) */
      setRoutineOrder: function (key, order) {
        return db.doc('routines/' + key).update({ order: order, updatedAt: new Date().toISOString() });
      },
      /** 켬 · 끔 설정 하나 (v41 missNotify 등) — notify 밖에 따로 */
      saveFlag: function (uid, field, on) {
        var body = { updatedAt: new Date().toISOString() }; body[field] = !!on;
        return db.doc('users/' + uid).set(body, { mergeFields: [field, 'updatedAt'] });
      },
      /** 함께 할 일 알림 (v38) — weekly 처럼 notify 밖에 따로. 없으면 켬 */
      saveTodoNotify: function (uid, on) {
        return db.doc('users/' + uid).set({ todoNotify: !!on, updatedAt: new Date().toISOString() }, { mergeFields: ['todoNotify', 'updatedAt'] });
      },
      /** 색 전체를 통째로 바꾼다 (테마 하나를 기본으로 되돌리면 그 칸이 빠진다). */
      saveColors: function (uid, colors) {
        return db.doc('users/' + uid).set({ colors: colors, updatedAt: new Date().toISOString() }, { mergeFields: ['colors', 'updatedAt'] });
      },
      saveDevice: function (uid, deviceId, d) {
        return db.doc('users/' + uid + '/devices/' + deviceId).set({ token: d.token, platform: d.platform || 'web', ua: String(d.ua || '').slice(0, 80), updatedAt: new Date().toISOString() });
      },
      deleteDevice: function (uid, deviceId) { return db.doc('users/' + uid + '/devices/' + deviceId).delete(); },
      // ── 꿍 보내기 ──
      // kungs/<날짜>_<보낸 사람 uid> : { from, to, date, at } — 하루 한 번 (같은 이름이라 두 번째는 규칙이 막음), 남기기만
      /** 돌아보기: [fromKey, toKey) 날짜의 꿍 (둘이 보낸 것 모두) */
      /** 단짝 영수증 (docs/ledger) — 그 달 기록. 날짜 문자열 범위 한 칸 조건이라 색인 추가 없음. 이번 달은 구독, 지난달은 한 번 읽기 */
      watchSpends: function (month, next, fail) {
        return db.collection('spends').where('date', '>=', month + '-01').where('date', '<', month + '-32').onSnapshot(function (q) {
          next(q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); }));
        }, fail);
      },
      loadSpends: function (month) {
        return db.collection('spends').where('date', '>=', month + '-01').where('date', '<', month + '-32').get().then(function (q) {
          return q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); });
        });
      },
      /** 통째로 쓴다 (나눔 → 혼자로 바꾸면 shares 가 지워지게). id 가 없으면 새 기록 */
      saveSpend: function (id, data) { return db.doc('spends/' + (id || newKey())).set(data); },
      deleteSpend: function (id) { return db.doc('spends/' + id).delete(); },
      /** 직접 만든 영수증 분류 spendCats/<c…> = { name, order, createdBy, createdAt } — 둘이 같은 목록 */
      watchSpendCats: function (next, fail) {
        return db.collection('spendCats').onSnapshot(function (q) { next(q.docs.map(function (doc) { return Object.assign({}, doc.data(), { id: doc.id }); })); }, fail);
      },
      addSpendCat: function (id, data) { return db.doc('spendCats/' + id).set(data); },
      deleteSpendCat: function (id) { return db.doc('spendCats/' + id).delete(); },
      // ── 교환 쪽지 (docs/question) ── qdays/{서울 날짜} · qdays/{date}/a/{uid} · ourQuestions/{id}
      //   시각(done · at · editedAt · createdAt)은 서버 시각 → 앱에는 ms 로 넘긴다 (msOf). 쪽지 글은 문서 하나씩 get/구독 (목록 조회는 규칙이 막음)
      watchQDay: function (date, next, fail) {
        return listen(db.doc('qdays/' + date), function (snap) { next(snap.exists ? qDayOf(date, snap.data(EST)) : null, !!(snap.metadata && snap.metadata.fromCache)); }, fail);
      },
      /** 지난 기록 전부 (그날 질문 고르기 · 지난 쪽지) — 날짜 순 */
      loadQDays: function () {
        return db.collection('qdays').get().then(function (q) { return q.docs.map(function (doc) { return qDayOf(doc.id, doc.data(EST)); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
      },
      /** 쪽지 하나 (내 것은 늘, 단짝 것은 내 쪽지가 있을 때만 — 그 밖엔 부르지 않는다) */
      watchAnswer: function (date, uid, next, fail) {
        return db.doc('qdays/' + date + '/a/' + uid).onSnapshot(function (snap) {
          var d = snap.exists ? snap.data(EST) : null;
          next(d ? { text: String(d.text || ''), at: msOf(d.at), editedAt: d.editedAt ? msOf(d.editedAt) : null } : null);
        }, fail);
      },
      watchOurs: function (next, fail) {
        return db.collection('ourQuestions').onSnapshot(function (q) {
          next(q.docs.map(function (doc) { var d = doc.data(EST); return { id: doc.id, text: String(d.text || ''), by: d.by, ask: !!d.ask, createdAt: msOf(d.createdAt) }; }));
        }, fail);
      },
      /** 그날 질문 만들기: 트랜잭션으로 읽고 없을 때만 (두 기기가 동시에 열어도 문서 하나). pick = pickQuestion 결과 */
      createQDay: function (date, pick) {
        var ref = db.doc('qdays/' + date);
        return db.runTransaction(function (tx) {
          return tx.get(ref).then(function (snap) {
            if (snap.exists) return false;
            tx.set(ref, { q: pick.q, text: pick.text, src: pick.src, by: pick.by || null, skipped: [], done: {}, likes: {}, createdAt: ts() });
            return true;
          });
        });
      },
      /** 다른 질문: 트랜잭션 안에서 다시 확인 → change(지금 문서) 가 바꿀 칸(또는 null)을 돌려줌 */
      swapQDay: function (date, change) {
        var ref = db.doc('qdays/' + date);
        return db.runTransaction(function (tx) {
          return tx.get(ref).then(function (snap) {
            if (!snap.exists) throw { code: 'not-found' };
            var patch = change(qDayOf(date, snap.data(EST)));
            if (!patch) throw { code: 'blocked' };
            patch.swappedAt = ts();
            tx.update(ref, patch);
            return patch;
          });
        });
      },
      /** 쪽지 남기기: 내 쪽지 + done 표시를 한 묶음으로 (규칙이 같이 오는지 확인) */
      saveAnswer: function (date, uid, text) {
        var b = db.batch(), done = {};
        done['done.' + uid] = ts();
        b.set(db.doc('qdays/' + date + '/a/' + uid), { text: text, at: ts() });
        b.update(db.doc('qdays/' + date), done);
        return b.commit();
      },
      editAnswer: function (date, uid, text) { return db.doc('qdays/' + date + '/a/' + uid).update({ text: text, editedAt: ts() }); },
      setLike: function (date, uid, on) { var p = {}; p['likes.' + uid] = on ? true : del(); return db.doc('qdays/' + date).update(p); },
      // ── 짝꿍과의 연말 문답 (docs/yearqa) ── yearqa/{YYYY} = { sealed: { uid: 시각 } } · yearqa/{YYYY}/a/{uid} = { answers, sealed, updatedAt, sealedAt? }
      //   짝꿍 답은 둘 다 봉투를 붙이고 1월 1일(서울)이 지나야 get 가능 (규칙). 그 전엔 부르지도 않는다 (js/app-yearqa.js)
      watchYearQa: function (year, next, fail) {
        return db.doc('yearqa/' + year).onSnapshot(function (snap) {
          var d = snap.exists ? snap.data(EST) : null, sealed = {};
          Object.keys((d && d.sealed) || {}).forEach(function (u) { sealed[u] = msOf(d.sealed[u]) || 1; });
          next({ sealed: sealed });
        }, fail);
      },
      watchYearAnswer: function (year, uid, next, fail) {
        return db.doc('yearqa/' + year + '/a/' + uid).onSnapshot(function (snap) {
          var d = snap.exists ? snap.data(EST) : null;
          next(d ? { answers: Object.assign({}, d.answers || {}), sealed: d.sealed === true, updatedAt: msOf(d.updatedAt) } : null);
        }, fail);
      },
      getYearAnswer: function (year, uid) {
        return db.doc('yearqa/' + year + '/a/' + uid).get().then(function (snap) { var d = snap.exists ? snap.data() : null; return d ? { answers: Object.assign({}, d.answers || {}), sealed: d.sealed === true } : null; });
      },
      /** 임시 저장 · 고치기: 답 전체를 덮어씀 (붙인 봉투는 그대로 붙어 있음) */
      saveYearAnswers: function (year, uid, answers, sealed) {
        return db.doc('yearqa/' + year + '/a/' + uid).set({ answers: answers, sealed: !!sealed, updatedAt: ts() });
      },
      /** 봉투 붙이기: 내 답(sealed) + 표시(yearqa/{year}.sealed.{나})를 한 묶음으로 — 규칙이 둘이 같이 오는지 확인 */
      sealYear: function (year, uid, answers) {
        var b = db.batch(), mark = {};
        mark[uid] = ts();
        b.set(db.doc('yearqa/' + year + '/a/' + uid), { answers: answers, sealed: true, updatedAt: ts(), sealedAt: ts() });
        b.set(db.doc('yearqa/' + year), { sealed: mark }, { merge: true });
        return b.commit();
      },
      addOurs: function (uid, text, ask) { return db.doc('ourQuestions/' + newKey().replace(/^r/, 'o')).set({ text: text, by: uid, ask: !!ask, createdAt: ts() }); },
      editOurs: function (id, text, ask) { return db.doc('ourQuestions/' + id).update({ text: text, ask: !!ask }); },
      deleteOurs: function (id) { return db.doc('ourQuestions/' + id).delete(); },
      // ── 집중 F1 (docs/focus) ── focus/{uid} 지금 상태 · focusLogs/{id} 끝낸 기록 (시각은 모두 ms 숫자)
      //  Firestore 는 배열 안 배열을 못 담아서 구간은 [{ s, e }] 로 저장하고, 앱에는 [[s, e]] 로 준다
      watchFocus: function (uid, next, fail) {
        return db.doc('focus/' + uid).onSnapshot(function (snap) { next(snap.exists ? focusIn(snap.data()) : null); }, fail);
      },
      setFocus: function (uid, body) { return db.doc('focus/' + uid).set(Object.assign(focusOut(body), { updatedAt: ts() })); },
      watchFocusLogs: function (fromDay, next, fail) {
        return db.collection('focusLogs').where('day', '>=', fromDay).onSnapshot(function (q) {
          next(q.docs.map(function (doc) { return Object.assign(focusIn(doc.data()), { id: doc.id }); }));
        }, fail);
      },
      /** 끝내기: 기록(하루별로 나눈 것) 만들기 + 지금 상태를 쉬는 중으로 — 한 묶음 */
      endFocus: function (uid, logs, idle) {
        var b = db.batch(), ids = [];
        (logs || []).forEach(function (l) { var id = newKey().replace(/^r/, 'f'); ids.push(id); b.set(db.doc('focusLogs/' + id), Object.assign(focusOut(l), { createdAt: Date.now() })); });
        b.set(db.doc('focus/' + uid), Object.assign(focusOut(idle), { updatedAt: ts() }));
        return b.commit().then(function () { return ids; });
      },
      updateFocusLog: function (id, body) { return db.doc('focusLogs/' + id).set(Object.assign(focusOut(body), { editedAt: Date.now() })); },
      deleteFocusLog: function (id) { return db.doc('focusLogs/' + id).delete(); },
      // ── 출출 쿠키 (docs/eat) ── eats/{id} · eatState/today · eatDraws/{id}. 시각은 서버 시각 → 앱에는 ms
      watchEats: function (next, fail) {
        return db.collection('eats').onSnapshot(function (q) { next(q.docs.map(function (doc) { return eatOf(doc.id, doc.data(EST)); })); }, fail);
      },
      watchEatToday: function (next, fail) {
        return db.doc('eatState/today').onSnapshot(function (snap) { var d = snap.exists ? snap.data(EST) : null; next(d ? { eatId: d.eatId, by: d.by, at: msOf(d.at) } : null); }, fail);
      },
      /** 쿠키 넣기 — doc 은 js/eat.js newCookie 값 (at 은 서버 시각으로 바꿔 씀). 새 id 를 돌려줌 */
      addEat: function (doc) {
        var id = newKey().replace(/^r/, 'k'), body = Object.assign({}, doc, { at: ts() });
        return db.doc('eats/' + id).set(body).then(function () { return id; });
      },
      editEat: function (id, patch) { return db.doc('eats/' + id).update(Object.assign({}, patch, { editedAt: ts() })); },
      removeEat: function (id) { return db.doc('eats/' + id).update({ state: 'out' }); },
      /** 깨기 기록 */
      addDraw: function (uid, n, who, shown) {
        var id = newKey().replace(/^r/, 'd');
        return db.doc('eatDraws/' + id).set({ by: uid, at: ts(), n: n, who: who, shown: shown }).then(function () { return id; });
      },
      updateDraw: function (id, patch) { return db.doc('eatDraws/' + id).update(patch); },
      /** 고르기: 쿠키 jar → today + eatState/today 만들기를 한 트랜잭션. 이미 있으면 { taken: 지금 값 } */
      pickEat: function (id, uid, drawId) {
        var ref = db.doc('eats/' + id), st = db.doc('eatState/today');
        return db.runTransaction(function (tx) {
          return Promise.all([tx.get(st), tx.get(ref)]).then(function (s) {
            if (s[0].exists) return { taken: s[0].data().eatId };
            if (!s[1].exists || s[1].data().state !== 'jar') return { gone: true };
            tx.update(ref, { state: 'today', pick: { by: uid, at: ts(), drawId: drawId || null } });
            tx.set(st, { eatId: id, by: uid, at: ts() });
            return { ok: true };
          });
        });
      },
      /** 돌려놓기 (직접 · 자동): today → jar + eatState/today 지우기 */
      returnEat: function (id) {
        var ref = db.doc('eats/' + id), st = db.doc('eatState/today');
        return db.runTransaction(function (tx) {
          return Promise.all([tx.get(st), tx.get(ref)]).then(function (s) {
            if (!s[0].exists || s[0].data().eatId !== id || !s[1].exists || s[1].data().state !== 'today') return { gone: true };
            tx.update(ref, { state: 'jar', pick: null });
            tx.delete(st);
            return { ok: true };
          });
        });
      },
      /** 오늘 먹을 것 표시만 지우기 — 가리키는 쿠키가 이미 통 안 · 먹은 것일 때 (규칙: eatState 지우기는 그 쿠키가 jar · eaten 일 때만) */
      clearEatToday: function () { return db.doc('eatState/today').delete(); },
      /** 먹었어요: today → eaten + 내 별점 · 한 줄 + eatState/today 지우기 (+ 또 먹고 싶어요 새 쿠키) — 한 트랜잭션 */
      eatEat: function (id, uid, r) {
        var ref = db.doc('eats/' + id), st = db.doc('eatState/today');
        return db.runTransaction(function (tx) {
          return Promise.all([tx.get(st), tx.get(ref)]).then(function (s) {
            if (!s[0].exists || s[0].data().eatId !== id || !s[1].exists || s[1].data().state !== 'today') return { gone: true };
            var patch = { state: 'eaten', eaten: { at: ts(), by: uid, together: !!r.together } };
            patch['stars.' + uid] = r.stars;
            if (r.note) patch['notes.' + uid] = r.note;
            tx.update(ref, patch);
            tx.delete(st);
            var againId = null;
            if (r.againDoc) { againId = newKey().replace(/^r/, 'k'); tx.set(db.doc('eats/' + againId), Object.assign({}, r.againDoc, { at: ts() })); }
            return { ok: true, againId: againId };
          });
        });
      },
      /** 꿍으로 알려 주기 (spec 8절): eatPings/<쿠키 id>_<나> — 쿠키 하나에 한 번, 만들기만. 서버가 단짝에게 「단짝이 ○○를 깼어요 · 오늘은 ○○ 어때요?」 */
      eatPing: function (uid, eatId, food) { return db.doc('eatPings/' + eatId + '_' + uid).set({ by: uid, eatId: eatId, food: food, at: ts() }); },
      /** 먹은 뒤 별점 · 한 줄 (자기 칸만) */
      rateEat: function (id, uid, stars, note) {
        var p = {}; p['stars.' + uid] = stars; if (note) p['notes.' + uid] = note;
        return db.doc('eats/' + id).update(p);
      },
      /** users/<uid> 의 몇 칸만 (출출 쿠키 개수 · 범위 · 연 시각, 교환 쪽지 알림 스위치) — 다른 칸은 그대로 */
      saveUserFields: function (uid, fields) { return db.doc('users/' + uid).set(fields, { mergeFields: Object.keys(fields) }); },
      /** 월말 · 연말결산 (docs/recap) — recaps/<YYYY-MM | YYYY> 전부 (한 해에 13개 정도). 서버만 쓰고 앱은 읽기만 */
      loadRecaps: function () {
        return db.collection('recaps').get().then(function (q) {
          return q.docs.map(function (doc) { return { key: doc.id, doc: doc.data() }; });
        });
      },
      loadKungs: function (fromKey, toKey) {
        return db.collection('kungs').where('date', '>=', fromKey).where('date', '<', toKey).get().then(function (q) {
          return q.docs.map(function (doc) { return doc.data(); });
        });
      },
      watchKungs: function (dateKey, next, fail) {
        return db.collection('kungs').where('date', '==', dateKey).onSnapshot(function (q) {
          next(q.docs.map(function (doc) { return doc.data(); }));
        }, fail);
      },
      sendKung: function (from, to, dateKey) {
        return db.doc('kungs/' + dateKey + '_' + from).set({ from: from, to: to, date: dateKey, at: new Date().toISOString() });
      },
      ping: function (uid) { return db.doc('users/' + uid + '/pings/' + newKey()).set({ at: new Date().toISOString() }); },
      /** 루틴 목록: routines/<key> 문서들 → next([{ key, icon, name, who, owner, start, end, order }]) */
      watchRoutines: function (next, fail) {
        return db.collection('routines').onSnapshot(function (q) {
          next(q.docs.map(function (doc) { return Object.assign({}, doc.data(), { key: doc.id }); }));
        }, fail);
      },
      /** 루틴 하나 저장 (새로 만들기 · 고치기 · 그만하기 · 쉬기 모두 이것으로).
       *  아는 칸만 덮어쓴다 (mergeFields, v38) — 쉬기(rest)는 바꿀 때만 넣고, 더 새 버전이 넣은 칸은 그대로 남는다 */
      saveRoutine: function (r) {
        var body = { icon: r.icon, name: r.name, who: r.who, owner: r.owner, start: r.start, end: r.end || null, order: r.order, updatedAt: new Date().toISOString() };
        var fields = Object.keys(body);
        if (Array.isArray(r.rest)) { body.rest = r.rest.map(function (p) { return { from: p.from, to: p.to || null }; }); fields.push('rest'); }
        // 언제 할지 (v41): 고친 때만 넣는다. null = 언제든
        if ('when' in r) { body.when = r.when && root.RT.model ? root.RT.model.whenFrom(r.when) : null; fields.push('when'); }
        if ('kind' in r) { body.kind = r.kind || null; fields.push('kind'); } // 종류 (v44): null = 아이콘대로
        return db.doc('routines/' + r.key).set(body, { mergeFields: fields });
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

  var api = { createStore: createStore, checkId: checkId, mergeChecks: mergeChecks, newKey: newKey, msOf: msOf, qDayOf: qDayOf, eatOf: eatOf };
  root.RT = root.RT || {};
  root.RT.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
