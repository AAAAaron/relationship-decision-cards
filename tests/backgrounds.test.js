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
  assert.equal(parsed.default, 'candlelit-table');
  assert.equal(parsed.backgrounds.length, 2);
  assert.equal(parsed.backgrounds[0].id, 'candlelit-table');
});

test('parseManifest 拒绝非 JSON / 缺字段 / backgrounds 非数组', () => {
  const { api } = loadBackgroundsWith();
  assert.throws(() => api.parseManifest('not json'), /JSON/);
  assert.throws(() => api.parseManifest(JSON.stringify({ version: 1, default: 'x' })), /backgrounds/);
  assert.throws(() => api.parseManifest(JSON.stringify({ version: 1, default: 'x', backgrounds: {} })), /backgrounds/);
});

test('loadManifest 支持注入的 fetcher，且失败时降级为空清单', () => {
  const { api } = loadBackgroundsWith();
  const ok = api.loadManifest({
    fetcher: () => Promise.resolve({ ok: true, text: () => JSON.stringify(validManifest) })
  });
  return ok.then(manifest => {
    assert.equal(manifest.default, 'candlelit-table');
    assert.equal(manifest.backgrounds.length, 2);

    return api.loadManifest({
      fetcher: () => Promise.reject(new Error('network down'))
    }).then(fallback => {
      assert.equal(fallback.backgrounds.length, 0);
      assert.equal(fallback.default, null);
    });
  });
});

test('setCurrentId 写入存储后 getCurrentId 能读回，订阅者收到回调', () => {
  const { api } = loadBackgroundsWith();
  let called = 0;
  let lastId = null;
  const unsubscribe = api.subscribe(id => { called += 1; lastId = id; });
  api.setCurrentId('moonlit');
  assert.equal(api.getCurrentId(), 'moonlit');
  assert.equal(called, 1);
  assert.equal(lastId, 'moonlit');
  unsubscribe();
  api.setCurrentId('candlelit-table');
  assert.equal(called, 1, '取消订阅后不应再触发');
});

test('setCurrentId 拒绝清单外的 id 并写入 fallback', () => {
  const { api, fakeGlobal } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  api.setCurrentId('not-in-list');
  assert.equal(api.getCurrentId(), 'candlelit-table');
  assert.equal(fakeGlobal.document.body.dataset.background, 'candlelit-table');
});

test('getCurrentId 在 localStorage 中的 id 已失效时回退到 default', () => {
  const storage = new Map([['relationship-decision-cards:background', 'obsolete']]);
  const { api } = loadBackgroundsWith({ storage });
  api.applyManifest(validManifest);
  assert.equal(api.getCurrentId(), 'candlelit-table');
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
  assert.doesNotThrow(() => api.setCurrentId('moonlit'));
  assert.equal(api.getCurrentId(), 'moonlit');
});

test('getCurrent 在尚未应用 manifest 时返回 null', () => {
  const { api } = loadBackgroundsWith();
  assert.equal(api.getCurrent(), null);
});

test('getCurrent 返回当前背景的完整条目', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  assert.deepEqual(api.getCurrent(), validManifest.backgrounds[0]);
});

test('cycleNextId 在只有 1 个背景时返回当前 id', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest({ default: 'only', backgrounds: [{ id: 'only', file: 'x.png' }] });
  assert.equal(api.cycleNextId(), 'only');
});

test('cycleNextId 在多个背景时切换到下一张', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  // 默认 candlelit-table → moonlit
  assert.equal(api.cycleNextId(), 'moonlit');
  assert.equal(api.getCurrentId(), 'moonlit');
  // 再切 → candlelit-table
  assert.equal(api.cycleNextId(), 'candlelit-table');
});

test('resolveBackgroundImageUrl 根据 manifest 与 baseUrl 拼出正确 URL', () => {
  const { api } = loadBackgroundsWith();
  api.applyManifest(validManifest);
  assert.equal(api.resolveBackgroundImageUrl({ baseUrl: '/assets/backgrounds/' }), '/assets/backgrounds/candlelit-table.png');
});

test('assets/backgrounds 目录与 manifest.json 物理存在', () => {
  const root = path.resolve(__dirname, '..');
  const dir = path.join(root, 'assets', 'backgrounds');
  assert.equal(fs.existsSync(dir), true, 'assets/backgrounds 目录应存在');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, 1);
  manifest.backgrounds.forEach(entry => {
    const file = path.join(dir, entry.file);
    assert.equal(fs.existsSync(file), true, `${entry.file} 应存在`);
  });
});
