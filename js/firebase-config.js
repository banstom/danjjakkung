/* Firebase 웹 앱 설정 — Firebase 콘솔 › 프로젝트 설정 › 내 앱 에서 복사한 값.
   비밀번호가 아니라 "어느 프로젝트에 붙을지" 알려 주는 주소라서 공개돼도 괜찮다.
   누가 기록을 보고 쓸 수 있는지는 firestore.rules 가 막는다.
   jjakkung-grid 는 Firebase 프로젝트 ID라서 만든 뒤에는 바꿀 수 없다(화면에는 나오지 않는다).
   페이지와 서비스 워커가 같이 읽으므로 window 대신 self 에 둔다. */
self.DANJJAKKUNG_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB05rn4QLZelgyUTCiRx81grcqjNm9jT6M',
  authDomain: 'jjakkung-grid.firebaseapp.com',
  projectId: 'jjakkung-grid',
  storageBucket: 'jjakkung-grid.firebasestorage.app',
  messagingSenderId: '570851475931',
  appId: '1:570851475931:web:4cd5456e5e8758501627fe'
};
/* 웹 푸시 공개 키 (콘솔 › 클라우드 메시징 › 웹 푸시 인증서). 공개 키라서 올려도 된다. */
self.DANJJAKKUNG_VAPID_KEY = 'BCCu6np5T_LFYQoFcG8ojIQres0I1iFcnF9RKX_dCRSyuDOxzrNY_XwuecyBcKfKMomTd8eOdYaTvIjO-1ivlz0';
/* 알림 서버(functions/)가 올라가 있으면 true (🔔 버튼을 보인다). */
self.DANJJAKKUNG_PUSH_READY = true;
