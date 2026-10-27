/* Firebase 연결 — 로그인(이메일 · 비밀번호)과 Firestore만 여기서 만진다.
   설정 값은 js/firebase-config.js 의 window.JJ_FIREBASE_CONFIG. */
(function (root) {
  'use strict';
  var RT = root.RT = root.RT || {};
  var cfg = root.JJ_FIREBASE_CONFIG;
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
    signUp: function (email, pw) { return auth.createUserWithEmailAndPassword(email, pw); },
    reset: function (email) { return auth.sendPasswordResetEmail(email); },
    signOut: function () { return auth.signOut(); },
    errorText: errorText
  };
})(window);
