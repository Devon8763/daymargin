import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../local-first/index.html', import.meta.url), 'utf8');
const page = await readFile(new URL('../local-first/page.mjs', import.meta.url), 'utf8');
const source = page.slice(page.indexOf("if (['/local-first/', '/local-first/index.html']"));
class Events {
  handlers = new Map();
  addEventListener(type, callback) { this.handlers.set(type, [...(this.handlers.get(type) || []), callback]); }
  fire(type) { for (const callback of this.handlers.get(type) || []) callback(); }
}
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function setup({waiting = null, installing = null, online = true, reject = false} = {}) {
  const elements = new Map(['offline-status', 'update-status', 'page-version', 'draft'].map(id =>
    ['#' + id, {textContent: id === 'page-version' ? '目前使用頁面版本：0.13.13' : '', value: '未送出草稿'}]));
  const registration = Object.assign(new Events(), {waiting, installing});
  const serviceWorker = Object.assign(new Events(), {
    controller: {scriptURL: 'http://127.0.0.1:19060/local-first/sw.js',
      postMessage: (_message, ports) => ports[0].postMessage(true)},
    register: async () => { if (reject) throw new Error('PRIVATE-UPDATE-DETAIL'); return registration; },
  });
  const window = new Events(), document = Object.assign(new Events(), {hidden: false, querySelector: id => elements.get(id)});
  const navigator = {onLine: online, serviceWorker};
  class Channel {
    port1 = {close() {}};
    port2 = {postMessage: data => queueMicrotask(() => this.port1.onmessage?.({data}))};
  }
  vm.runInNewContext(source, {navigator, window, document, location: {pathname: '/local-first/'}, URL,
    MessageChannel: Channel, setTimeout, clearTimeout});
  return {elements, registration, navigator, serviceWorker, window, text: () => elements.get('#update-status').textContent};
}
const worker = state => Object.assign(new Events(), {state});
const waitingText = '新版已下載，關閉此來源所有頁籤／視窗後重新開啟才會使用新版';

test('loaded HTML owns the page version and recovery guidance has no destructive shortcut', () => {
  assert.match(html, /id="page-version"[^>]*>目前使用頁面版本：0\.20\.0</);
  const guidance = html.match(/<div id="recovery-guidance"[^>]*>[\s\S]*?<\/div>/)?.[0];
  assert.ok(guidance, 'Missing recovery guidance');
  for (const text of ['不要清除', '覆蓋', '原瀏覽器設定檔', '全新', '空白', '同一個固定網址', '沒有可用備份', '停止操作']) assert.ok(guidance.includes(text), text);
  assert.doesNotMatch(guidance, /<(?:button|a|input|form)\b/);
  assert.match(page, /recovery-guidance/);
});

test('installed waiting worker is distinct from offline readiness and preserves the old page and draft', async () => {
  const app = setup({waiting: worker('installed')}); await tick();
  assert.ok(app.text().includes(waitingText));
  assert.match(app.elements.get('#offline-status').textContent, /可離線重新開啟/);
  assert.equal(app.elements.get('#page-version').textContent, '目前使用頁面版本：0.13.13');
  assert.equal(app.elements.get('#draft').value, '未送出草稿');
  assert.doesNotMatch(source, /skipWaiting|location\.reload|caches\.delete|indexedDB/);
});

test('installing is not announced as downloaded; installed waiting is detected without reload', async () => {
  const installing = worker('installing'), app = setup({installing}); await tick();
  assert.match(app.text(), /下載|安裝/); assert.ok(!app.text().includes(waitingText));
  installing.state = 'installed'; app.registration.waiting = installing; app.registration.installing = null;
  installing.fire('statechange'); await tick();
  assert.ok(app.text().includes(waitingText));
});

test('updatefound observes failed installs and exposes no underlying exception', async () => {
  const app = setup(); await tick();
  const installing = worker('installing'); app.registration.installing = installing; app.registration.fire('updatefound'); await tick();
  installing.state = 'redundant'; app.registration.installing = null; installing.fire('statechange'); await tick();
  assert.match(app.text(), /未完成|失敗/); assert.ok(!app.text().includes(waitingText));
  assert.ok(!app.text().includes('PRIVATE-UPDATE-DETAIL'));
});

test('rejected registration and unavailable state are conservative', async () => {
  const app = setup({reject: true}); await tick();
  assert.match(app.text(), /無法確認|無法判定/); assert.ok(!app.text().includes(waitingText));
  assert.ok(!app.text().includes('PRIVATE-UPDATE-DETAIL'));
  assert.match(html, /id="update-status"[^>]*>[^<]*(?:無法確認|無法判定)/);
});

test('offline does not claim an update check; fully installed waiting remains accurate', async () => {
  const app = setup({online: false}); await tick();
  assert.match(app.text(), /離線/); assert.ok(!app.text().includes(waitingText));
  app.registration.waiting = worker('installed'); app.window.fire('offline'); await tick();
  assert.ok(app.text().includes(waitingText));
  app.navigator.onLine = true; app.window.fire('online'); await tick();
  assert.ok(app.text().includes(waitingText));
});

test('controller changes update status without replacing the actual page version or draft', async () => {
  const app = setup({waiting: worker('installed')}); await tick();
  app.registration.waiting = null; app.serviceWorker.fire('controllerchange'); await tick();
  assert.ok(!app.text().includes(waitingText));
  assert.match(app.text(), /目前頁面|無法確認|無法判定/);
  assert.equal(app.elements.get('#page-version').textContent, '目前使用頁面版本：0.13.13');
  assert.equal(app.elements.get('#draft').value, '未送出草稿');
});
