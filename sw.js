/* 서비스 워커 — 앱 화면(파일들)을 기기에 저장해 두고, 오프라인에서도 열리게 한다.
   기록(Firestore)은 Firebase가 따로 기기에 보관하므로 여기서는 손대지 않는다.
   파일을 바꿔서 올릴 때마다 VERSION을 올리면 새 파일로 바뀐다. */
var VERSION = 'danjjakkung-v31';

/* 푸시 알림: 서버(functions/)가 보낸 알림을 휴대폰 알림으로 띄운다.
   아이폰은 받은 알림을 화면에 띄우지 않으면 몇 번 뒤 알림 구독을 끊어 버리므로,
   앱을 보고 있을 때도 언제나 띄운다. (서버는 data만 보내고, 문구는 여기서 그린다) */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  var m = (d && d.data) || d || {};
  var title = m.title || '단짝꿍';
  e.waitUntil(self.registration.showNotification(title, {
    body: m.body || '새 소식이 있어요',
    icon: 'icons/icon-192.png',
    tag: m.tag || m.kind || 'danjjakkung',
    renotify: true,
    data: { link: m.link || './' }
  }));
});
// 알림을 누르면: 열려 있는 단짝꿍 창으로, 없으면 새로 연다
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var link = (e.notification.data && e.notification.data.link) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) { try { list[i].postMessage({ type: 'open', link: link }); } catch (err) {} return list[i].focus(); }
    }
    return self.clients.openWindow ? self.clients.openWindow(link) : null;
  }));
});
var FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'styles/tokens.css', 'styles/app.css',
  'js/firebase-config.js', 'js/firebase.js', 'js/dates.js', 'js/seasons.js', 'js/themes.js', 'js/streak.js', 'js/icons.js',
  'js/people.js', 'js/model.js', 'js/news.js', 'js/view.js', 'js/todos.js', 'js/uni.js', 'js/cats.js', 'js/schedule.js', 'js/view-plan.js', 'js/store.js', 'js/app.js',
  'vendor/firebase/firebase-app-compat.js', 'vendor/firebase/firebase-auth-compat.js', 'vendor/firebase/firebase-firestore-compat.js', 'vendor/firebase/firebase-messaging-compat.js', 'js/push.js',
  'fonts/PretendardVariable.woff2', 'fonts/tossface-00.woff2', 'fonts/tossface-02.woff2', 'fonts/tossface-04.woff2', 'fonts/tossface-05.woff2',
  'fonts/tossface-06.woff2', 'fonts/tossface-07.woff2', 'fonts/tossface-08.woff2', 'fonts/tossface-09.woff2',
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
