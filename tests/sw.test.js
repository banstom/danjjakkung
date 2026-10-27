// 서비스 워커의 알림 처리: 받은 알림은 언제나 띄우고(아이폰 규칙), 누르면 열린 창으로 간다
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const handlers = {};
  const shown = [];
  const focused = [], opened = [];
  const self = {
    addEventListener: (t, fn) => { handlers[t] = fn; },
    registration: { showNotification: (title, opts) => { shown.push({ title, opts }); return Promise.resolve(); } },
    clients: {
      list: [],
      matchAll() { return Promise.resolve(this.list); },
      openWindow: (u) => { opened.push(u); return Promise.resolve(); },
      claim: () => Promise.resolve()
    },
    location: { origin: 'https://banstom.github.io' },
    skipWaiting: () => Promise.resolve()
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), { self, caches: {}, fetch: () => {}, setTimeout, clearTimeout, URL, Promise, Response: {} });
  return { handlers, shown, focused, opened, self };
}
function evt(extra) { let p; return Object.assign({ waitUntil: (x) => { p = x; }, get done() { return p; } }, extra); }

test('FCM data 알림을 그대로 띄운다', async () => {
  const s = load();
  const e = evt({ data: { json: () => ({ data: { kind: 'check', title: '단짝꿍', body: '🎉 다진 님이 스쿼트 100개 완료!', tag: 'check-x', link: 'https://banstom.github.io/danjjakkung/' } }) } });
  s.handlers.push(e); await e.done;
  assert.strictEqual(s.shown.length, 1);
  assert.strictEqual(s.shown[0].title, '단짝꿍');
  assert.strictEqual(s.shown[0].opts.body, '🎉 다진 님이 스쿼트 100개 완료!');
  assert.strictEqual(s.shown[0].opts.tag, 'check-x');
});
test('내용이 이상해도 알림은 띄운다 (아이폰이 구독을 끊지 않게)', async () => {
  const s = load();
  const e = evt({ data: { json: () => { throw new Error('bad'); } } });
  s.handlers.push(e); await e.done;
  assert.strictEqual(s.shown.length, 1);
  assert.strictEqual(s.shown[0].title, '단짝꿍');
});
test('알림을 누르면 열린 창으로, 없으면 새 창', async () => {
  const s = load();
  let closed = 0;
  const n = { close: () => { closed++; }, data: { link: 'https://banstom.github.io/danjjakkung/' } };
  let e = evt({ notification: n }); s.handlers.notificationclick(e); await e.done;
  assert.deepStrictEqual(s.opened, ['https://banstom.github.io/danjjakkung/']);
  let f = 0; s.self.clients.list = [{ focus: () => { f++; return Promise.resolve(); } }];
  e = evt({ notification: n }); s.handlers.notificationclick(e); await e.done;
  assert.strictEqual(f, 1); assert.strictEqual(closed, 2);
});
