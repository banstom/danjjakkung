/* Firebase 연결 — 로그인(이메일 · 비밀번호)과 Firestore만 여기서 만진다.
   설정 값은 js/firebase-config.js 의 window.DANJJAKKUNG_FIREBASE_CONFIG. */
(function (root) {
  'use strict';
  var RT = root.RT = root.RT || {};
  var cfg = root.DANJJAKKUNG_FIREBASE_CONFIG;
  var fb = root.firebase;

  var ERRORS = {
    'auth/invalid-email': '이메일 주소를 다시 확인해 주세요',
    'auth/missing-password': '비밀번호를 적어 주세요',
    'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요',
    'auth/wrong-password': '이메일이나 비밀번호가 맞지 않아요',
    'auth/user-not-found': '이메일이나 비밀번호가 맞지 않아요',
    'auth/email-already-in-use': '이미 가입한 이메일이에요. 로그인해 주세요',
    'auth/weak-password': '비밀번호는 6자 이상으로 만들어 주세요',
    'auth/too-many-requests': '여러 번 틀려서 잠시 막혔어요. 조금 뒤 다시 해 주세요',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
    'auth/operation-not-allowed': 'Firebase에서 이메일/비밀번호 로그인을 켜 주세요'
  };

  function errorText(e) {
    return (e && ERRORS[e.code]) || '잠시 문제가 생겼어요. 다시 해 주세요';
  }

  if (!fb || !cfg || !cfg.apiKey) {
    RT.firebase = { configured: false, errorText: errorText };
    return;
  }

  fb.initializeApp(cfg);
  var auth = fb.auth();
  var db = fb.firestore();
  // 오프라인에서도 보이게: 기기에 기록을 같이 둔다 (안 되면 그냥 넘어간다)
  try { db.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) { /* 지원 안 하는 브라우저 */ }
  auth.setPersistence(fb.auth.Auth.Persistence.LOCAL).catch(function () {});

  RT.firebase = {
    configured: true,
    db: db,
    onAuth: function (cb) { return auth.onAuthStateChanged(cb); },
    signIn: function (email, pw) { return auth.signInWithEmailAndPassword(email, pw); },
    // 가입하면 바로 인증 메일을 보낸다 (남의 이메일로 먼저 가입하는 것을 막기 위해 규칙이 인증을 요구한다)
    signUp: function (email, pw) {
      return auth.createUserWithEmailAndPassword(email, pw).then(function (cred) {
        return cred.user.sendEmailVerification().catch(function () {}).then(function () { return cred; });
      });
    },
    sendVerification: function () { return auth.currentUser ? auth.currentUser.sendEmailVerification() : Promise.reject({ code: 'auth/no-user' }); },
    /** 인증했는지 다시 확인. 인증됐으면 새 토큰을 받아 규칙에 바로 반영되게 한다. */
    checkVerified: function () {
      var u = auth.currentUser;
      if (!u) return Promise.resolve(false);
      return u.reload().then(function () {
        if (!auth.currentUser.emailVerified) return false;
        return auth.currentUser.getIdToken(true).then(function () { return true; });
      });
    },
    reset: function (email) { return auth.sendPasswordResetEmail(email); },
    /** 서버 함수(onCall) 부르기 — SDK 없이 callable 약속대로 (서울, Bearer 토큰). 성공하면 result, 실패하면 { code, message } */
    callFn: function (name, data) {
      var u = auth.currentUser;
      if (!u) return Promise.reject({ code: 'unauthenticated', message: '로그인해 주세요' });
      if (root.navigator && root.navigator.onLine === false) return Promise.reject({ code: 'unavailable', message: 'offline' }); // 오프라인이면 바로
      var url = 'https://asia-northeast3-' + cfg.projectId + '.cloudfunctions.net/' + name;
      var once = function (fresh) {
        return u.getIdToken(fresh).then(function (tok) {
          var ctl = root.AbortController ? new root.AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 30000) : null; // 30초면 포기 (점검 AI)
          return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ data: data }), signal: ctl ? ctl.signal : undefined })
            .then(function (res) { if (timer) clearTimeout(timer); return res; }, function (e) { if (timer) clearTimeout(timer); throw e; });
        }).then(function (res) {
          return res.json().catch(function () { return null; }).then(function (j) {
            if (res.ok && j && typeof j === 'object' && 'result' in j) return j.result;
            var e = (j && j.error) || {};
            var code = e.status ? String(e.status).toLowerCase().replace(/_/g, '-')
              : res.status === 401 ? 'unauthenticated' : res.status === 403 ? 'permission-denied' : res.status === 429 ? 'resource-exhausted' : res.ok ? 'internal' : 'unavailable';
            throw { code: code, message: e.message || '' };
          });
        }, function () { throw { code: 'unavailable', message: '' }; });
      };
      return once(false).catch(function (e) { if (e && e.code === 'unauthenticated') return once(true); throw e; }); // 토큰이 막 만료됐으면 새로 받아 한 번 더
    },
    // 로그아웃: 이 기기에 남은 기록까지 지우고 처음 화면으로
    signOut: function () {
      return auth.signOut()
        .then(function () { return db.terminate(); })
        .then(function () { return db.clearPersistence(); })
        .catch(function () {})
        .then(function () { root.location.reload(); });
    },
    errorText: errorText
  };
})(window);
