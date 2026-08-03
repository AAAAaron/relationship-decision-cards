const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 为了保持 backgrounds.js 与 storage.js 在浏览器/Node 双环境可用的写法一致，
// 直接 require 触发其 IIFE，并把 window 全局替换成我们的 fake global。
function loadBackgroundsWith({ storage = new Map(), globalScope = {} } = {}) {
  delete require.cache[require.resolve('../src/backgrounds.js')];
  const fakeGlobal = {
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    document: {
      documentElement: { style: {} },
      body: { style: {}, dataset: {} }
    }
  };
  fakeGlobal.window = fakeGlobal;
  global.window = fakeGlobal;
  global.document = fakeGlobal.document;
  global.localStorage = fakeGlobal.localStorage;
  const api = require('../src/backgrounds.js');
  return { api, fakeGlobal };
}

const validManifest = {
  version: 2,
  default: 'meeting',
  styles: [
    { id: 'meeting', title: '正式会议', accentColor: '#f6dda0', mood: 'cold' },
    { id: 'elevator', title: '电梯偶遇', accentColor: '#c8d2e0', mood: 'cool' }
  ]
};

const legacyManifest = {
  version: 1,
  default: 'candlelit-table',
  backgrounds: [
    { id: 'candlelit-table', title: '烛光下的牌桌', file: 'candlelit-table.png', mood: 'warm-night' },
    { id: 'moonlit', title: '月色牌桌', file: 'moonlit.png', mood: 'cool-night' }
  ]
};

test('parseManifest 接受合法清单并返回不可变快照', () => {
  const { api } = loadBackgroundsWith();
  const parsed = api.parseManifest(JSON.stringify(validManifest));
  assert.equal(parsed.default, 'meeting');
  assert.equal(parsed.styles.length, 2);
  assert.equal(parsed.styles[0].id, 'meeting');
  assert.equal(parsed.styles[0].accentColor, '#f6dda0');
});

test('parseManifest 兼容旧版 backgrounds 字段', () => {
  const { api } = loadBackgroundsWith();
  const parsed = api.parseManifest(JSON.stringify(legacyManifest));
  assert.equal(parsed.default, 'candlelit-table');
  assert.equal(parsed.styles.length, 2);
  assert.equal(parsed.styles[0].id, 'candlelit-table');
  assert.equal(parsed.styles[0].file, 'candlelit-table.png');
});

test('parseManifest 拒绝非 JSON / 缺字段 / 数组字段', () => {
  const { api } = loadBackgroundsWith();
  assert.throws(() => api.parseManifest('not json'), /JSON/);
  assert.throws(() => api.parseManifest(JSON.stringify({ version: 1, default: 'x' })), /styles/);
  assert.throws(() => api.parseManifest(JSON.stringify({ version: 1, default: 'x', styles: {} })), /styles/);
});

test('loadManifest 支持注入的 fetcher，且失败时降级为空清单', () => {
  const { api } = loadBackgroundsWith();
  const ok = api.loadManifest({
    fetcher: () => Promise.resolve({ ok: true, text: () => JSON.stringify(validManifest) })
  });
  return ok.then(manifest => {
    assert.equal(manifest.default, 'meeting');
    assert.equal(manifest.styles.length, 2);

    return api.loadManifest({
      fetcher: () => Promise.reject(new Error('network down'))
    }).then(fallback => {
      assert.equal(fallback.styles.length, 0);
      assert.equal(fallback.default, null);
    });
  });
});

test('setCurrentId 写入存储后 getCurrentId 能读回，订阅者收到回调', () => {
  const { api } = loadBackgroundsWith();
  let called = 0;
  let lastPrev = null;
  let lastNext = null;
  const unsubscribe = api.subscribe((prev, next) => { called += 1; lastPrev = prev; lastNext = next; });
  api.setCurrentId('elevator');
  assert.equal(api.getCurrentId(), 'elevator');
  assert.equal(called, 1);
  assert.equal(lastPrev, null, '首次切换的 prev 应为 null');
  assert.equal(lastNext, 'elevator');
  unsubscribe();
  api.setCurrentId('meeting');
  assert.equal(called, 1, '取消订阅后不应再触发');
});

test('setCurrentId 连续切换时订阅者收到正确的 prev → next', () => {
  const { api } = loadBackgroundsWith();
  const events = [];
  api.subscribe((prev, next) => events.push([prev, next]));
  api.setCurrentId('meeting');
  api.setCurrentId('elevator');
  api.setCurrentId('meeting');
  assert.deepEqual(events, [[null, 'meeting'], ['meeting', 'elevator'], ['elevator', 'meeting']]);
});

test('setCurrentId 拒绝清单外的 id 并写入 fallback', () => {
  const { api, fakeGlobal } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  api.setCurrentId('not-in-list');
  assert.equal(api.getCurrentId(), 'meeting');
  assert.equal(fakeGlobal.document.body.dataset.background, 'meeting');
});

test('getCurrentId 在 localStorage 中的 id 已失效时回退到 default', () => {
  const storage = new Map([['relationship-decision-cards:background', 'obsolete']]);
  const { api } = loadBackgroundsWith({ storage });
  api.applyManifest(validManifest);
  assert.equal(api.getCurrentId(), 'meeting');
});

test('localStorage 抛错时 setCurrentId 静默降级不抛异常', () => {
  const throwingStorage = {
    getItem: () => { throw new Error('quota'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {}
  };
  const fakeGlobal = { localStorage: throwingStorage, document: { body: { dataset: {} } } };
  global.window = fakeGlobal;
  global.document = fakeGlobal.document;
  global.localStorage = throwingStorage;
  delete require.cache[require.resolve('../src/backgrounds.js')];
  const api = require('../src/backgrounds.js');
  api.applyManifest(validManifest);
  assert.doesNotThrow(() => api.setCurrentId('elevator'));
  assert.equal(api.getCurrentId(), 'elevator');
});

test('getCurrent 在尚未应用 manifest 时返回 null', () => {
  const { api } = loadBackgroundsWith();
  assert.equal(api.getCurrent(), null);
});

test('getCurrent 返回当前风格的完整条目', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  assert.deepEqual(api.getCurrent(), validManifest.styles[0]);
});

test('cycleNextId 在只有 1 个风格时返回当前 id', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest({ default: 'only', styles: [{ id: 'only', accentColor: '#fff' }] });
  assert.equal(api.cycleNextId(), 'only');
});

test('cycleNextId 在多个风格时切换到下一个', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  // 默认 meeting → elevator
  assert.equal(api.cycleNextId(), 'elevator');
  assert.equal(api.getCurrentId(), 'elevator');
  // 再切 → meeting
  assert.equal(api.cycleNextId(), 'meeting');
});

test('cyclePrevId 回到上一个，并支持多张环绕', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  // 当前 meeting → elevator
  assert.equal(api.cyclePrevId(), 'elevator');
  assert.equal(api.getCurrentId(), 'elevator');
  // 再 prev → meeting
  assert.equal(api.cyclePrevId(), 'meeting');
});

test('cycleStep 接受任意 delta 并按 length 取模', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  // delta = 2 等价于 next 两次
  assert.equal(api.cycleStep(2), 'meeting');
  // delta = -1 等价于 prev 一次
  api.applyManifest(validManifest);
  assert.equal(api.cycleStep(-1), 'elevator');
  // delta = -1000 也安全（多次取模）
  api.applyManifest(validManifest);
  const huge = api.cycleStep(-1000);
  assert.ok(huge === 'meeting' || huge === 'elevator', 'cycleStep 在大负值下仍返回合法 id');
});

test('resolveBackgroundImageUrl 在新格式无 file 字段时返回 null', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  assert.equal(api.resolveBackgroundImageUrl({ baseUrl: '/assets/backgrounds/' }), null);
});

test('resolveBackgroundImageUrl 在旧格式有 file 字段时返回 URL', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(legacyManifest);
  assert.equal(api.resolveBackgroundImageUrl({ baseUrl: '/assets/backgrounds/' }), '/assets/backgrounds/candlelit-table.png');
});

test('assets/backgrounds 目录与 manifest.json 物理存在', () => {
  const root = path.resolve(__dirname, '..');
  const dir = path.join(root, 'assets', 'backgrounds');
  assert.equal(fs.existsSync(dir), true, 'assets/backgrounds 目录应存在');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, 2);
  assert.ok(Array.isArray(manifest.styles), 'manifest.styles 数组应存在');
  const ids = new Set(manifest.styles.map(b => b.id));
  assert.equal(ids.size, manifest.styles.length, 'id 应互不重复');
});
