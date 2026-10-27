/* 서비스 워커 — 앱 화면(파일들)을 기기에 저장해 두고, 오프라인에서도 열리게 한다.
   기록(Firestore)은 Firebase가 따로 기기에 보관하므로 여기서는 손대지 않는다.
   파일을 바꿔서 올릴 때마다 VERSION을 올리면 새 파일로 바뀐다. */
var VERSION = 'danjjakkung-v6';
var FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'styles/tokens.css', 'styles/app.css',
  'js/firebase-config.js', 'js/firebase.js', 'js/dates.js', 'js/seasons.js', 'js/streak.js', 'js/icons.js',
  'js/people.js', 'js/model.js', 'js/news.js', 'js/view.js', 'js/store.js', 'js/app.js',
  'vendor/firebase/firebase-app-compat.js', 'vendor/firebase/firebase-auth-compat.js', 'vendor/firebase/firebase-firestore-compat.js',
  'fonts/PretendardVariable.woff2', 'fonts/tossface-00.woff2', 'fonts/tossface-04.woff2', 'fonts/tossface-05.woff2',
  'fonts/tossface-06.woff2', 'fonts/tossface-07.woff2', 'fonts/tossface-09.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// 우리 사이트 파일만: 먼저 인터넷에서 새로 받고(3초 안에), 안 되면 저장해 둔 것을 쓴다
var TIMEOUT_MS = 3000;
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function fromCache() {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        // 화면 이동(페이지 열기)일 때만 첫 화면을 대신 보여 준다. 그림 · 스크립트에 HTML을 주지 않는다.
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    }
    var timer = setTimeout(function () {
      fromCache().then(function (res) { if (!done && res && res.type !== 'error') { done = true; resolve(res); } });
    }, TIMEOUT_MS);
    // 배포 직후 옛 파일이 섞이지 않게 브라우저 캐시를 건너뛰고 확인한다
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (res) { if (!done) { done = true; resolve(res); } });
    });
  }));
});
