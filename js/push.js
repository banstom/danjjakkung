/* 푸시 알림 — 이 기기를 알림 받는 기기로 등록하거나 뺀다.
   알림을 보내는 쪽은 서버(functions/)이고, 여기서는 "이 기기 주소(토큰)"만 저장소에 남긴다.
   기기마다 하나씩 저장하므로, 나중에 iOS · 안드로이드 앱이 생겨도 같은 자리에 platform만 달리해 넣으면 된다. */
(function (root) {
  'use strict';
  var RT = root.RT = root.RT || {};
  var LS_DEV = 'danjjakkung.device', LS_ON = 'danjjakkung.pushOn', LS_TOK = 'danjjakkung.pushToken', LS_UID = 'danjjakkung.pushUid';

  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }

  function isIOS() {
    var ua = root.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (root.navigator.platform === 'MacIntel' && root.navigator.maxTouchPoints > 1);
  }
  function standalone() {
    return (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || root.navigator.standalone === true;
  }
  function messaging() {
    try {
      var fb = root.firebase;
      if (!fb || !fb.messaging || !fb.messaging.isSupported()) return null;
      return fb.messaging();
    } catch (e) { return null; }
  }

  /** 'standalone-needed'(아이폰 사파리 탭) | 'unsupported' | 'denied' | 'ok' */
  function support() {
    if (isIOS() && !standalone()) return 'standalone-needed';
    if (!('Notification' in root) || !('serviceWorker' in root.navigator) || !messaging()) return 'unsupported';
    if (root.Notification.permission === 'denied') return 'denied';
    return 'ok';
  }
  function isOn() { return support() === 'ok' && root.Notification.permission === 'granted' && lsGet(LS_ON) === '1'; }

  function deviceId() {
    var id = lsGet(LS_DEV);
    if (!id) { id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); lsSet(LS_DEV, id); }
    return id;
  }
  function shortUA() {
    var ua = root.navigator.userAgent || '';
    return (isIOS() ? 'iOS' : /Android/.test(ua) ? 'Android' : 'Desktop') + (standalone() ? ' app' : ' web');
  }

  function token() {
    var m = messaging();
    if (!m) return Promise.reject({ code: 'unsupported' });
    return root.navigator.serviceWorker.register('sw.js')
      .then(function () { return root.navigator.serviceWorker.ready; })
      .then(function (reg) { return m.getToken({ vapidKey: root.DANJJAKKUNG_VAPID_KEY, serviceWorkerRegistration: reg }); });
  }
  function save(store, uid, t) {
    return store.saveDevice(uid, deviceId(), { token: t, platform: 'web', ua: shortUA() }).then(function () { lsSet(LS_ON, '1'); lsSet(LS_TOK, t); lsSet(LS_UID, uid); });
  }

  /** 알림 켜기 — 반드시 버튼을 누른 그 순간에 부른다 (아이폰 규칙) */
  function enable(store, uid) {
    var ask;
    try { ask = root.Notification.requestPermission(); } catch (e) { return Promise.reject({ code: 'unsupported' }); }
    return Promise.resolve(ask).then(function (p) {
      if (p !== 'granted') throw { code: p === 'denied' ? 'denied' : 'dismissed' };
      return token();
    }).then(function (t) {
      if (!t) throw { code: 'no-token' };
      return save(store, uid, t);
    });
  }

  /** 앱을 열 때마다: 켜 둔 기기면 주소를 다시 남긴다 (서버에서 지워졌거나 주소가 바뀌었어도 되살아나게).
      이 기기에서 다른 계정이 알림을 켰던 적이 있으면, 옛 주소를 버리고 새 주소를 받아 그 계정으로 알림이 가지 않게 한다. */
  function refresh(store, uid) {
    if (!isOn()) return Promise.resolve(false);
    var m = messaging();
    var other = lsGet(LS_UID) && lsGet(LS_UID) !== uid;
    var reset = other && m ? Promise.resolve(m.deleteToken()).catch(function () {}) : Promise.resolve();
    return reset.then(token).then(function (t) {
      return t ? save(store, uid, t).then(function () { return true; }) : false;
    }).catch(function () { return false; });
  }

  function disable(store, uid) {
    var m = messaging();
    var del = m ? Promise.resolve(m.deleteToken()).catch(function () {}) : Promise.resolve();
    return del.then(function () { return uid ? store.deleteDevice(uid, deviceId()) : null; })
      .then(function () { lsSet(LS_ON, '0'); lsSet(LS_TOK, ''); lsSet(LS_UID, ''); });
  }

  function errorText(e) {
    var c = e && e.code;
    if (c === 'denied') return '알림을 허용하지 않았어요. 휴대폰 설정에서 허용한 뒤 다시 눌러 주세요';
    if (c === 'dismissed') return '알림 허용 창이 닫혔어요. 다시 눌러 주세요';
    if (c === 'unsupported') return '이 브라우저에서는 알림을 받을 수 없어요';
    return '알림을 켜지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요';
  }

  RT.push = { support: support, isOn: isOn, enable: enable, refresh: refresh, disable: disable, errorText: errorText, deviceId: deviceId };
})(window);
