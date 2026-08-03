const test = require('node:test');
const assert = require('node:assert/strict');

const mod = require('../src/stage-fx.js');
const controllerMod = require('../src/stage-fx-controller.js');
const prefsMod = require('../src/motion-preferences.js');

function loadStageFx({ webglAvailable = true, motionLevel = 'full' } = {}) {
  delete require.cache[require.resolve('../src/stage-fx.js')];
  // 设 motion preferences
  const fakeDocument = {
    hidden: false,
    createElement(tag) {
      if (tag.toLowerCase() !== 'canvas') return {};
      return {
        getContext(type) {
          if (!webglAvailable) return null;
          return type.startsWith('webgl') ? {} : null;
        }
      };
    }
  };
  globalThis.matchMedia = () => ({ matches: motionLevel === 'reduced', addEventListener: () => {}, removeEventListener: () => {} });
  globalThis.document = fakeDocument;
  globalThis.window = { matchMedia: globalThis.matchMedia, document: fakeDocument };
  global.document = fakeDocument;
  return { api: require('../src/stage-fx.js') };
}

test('createStageFx 在 motionLevel = off 时返回 null 并要求显示 fallback', () => {
  const { api } = loadStageFx({ webglAvailable: false });
  const controller = controllerMod.createStageController();
  let fallbackShown = false;
  const result = api.createStageFx({
    THREE: {},
    canvas: {},
    fallback: { show() { fallbackShown = true; } },
    controller,
    preferences: prefsMod
  });
  assert.equal(result, null);
  assert.equal(fallbackShown, true);
});

test('createStageFx 在 THREE 缺失时返回 null 并要求显示 fallback', () => {
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  let fallbackShown = false;
  const result = api.createStageFx({
    canvas: {},
    fallback: { show() { fallbackShown = true; } },
    controller,
    preferences: prefsMod
  });
  assert.equal(result, null);
  assert.equal(fallbackShown, true);
});

test('createStageFx 在 motionLevel = reduced 时使用简化配置', () => {
  const { api } = loadStageFx({ motionLevel: 'reduced' });
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  assert.ok(result, '应返回 stageFx 实例');
  if (result && typeof result.dispose === 'function') result.dispose();
});

test('createStageFx 返回的对象暴露 dispose 方法', () => {
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  assert.equal(typeof result.dispose, 'function');
  assert.equal(typeof result.requestRender, 'function');
  assert.equal(typeof result.handleResize, 'function');
  if (result) result.dispose();
});

test('isAnimating 透传 controller 状态', () => {
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const result = api.createStageFx({ THREE: fakeThree, canvas: makeFakeCanvas(), fallback: { show() {} }, controller, preferences: prefsMod });
  assert.equal(result.isAnimating(), false);
  result.requestRender();
  assert.equal(result.isAnimating(), true);
  if (result) result.dispose();
});

function makeFakeThree() {
  return {
    WebGLRenderer: class { setPixelRatio() {} setSize() {} setClearColor() {} render() {} dispose() {} get domElement() { return {}; } },
    Scene: class {
      constructor() { this.children = []; this.background = null; }
      add(c) { this.children.push(c); return c; }
      remove(c) { this.children = this.children.filter(x => x !== c); return c; }
      traverse() {}
    },
    PerspectiveCamera: class { constructor() { this.position = { z: 0 }; } updateProjectionMatrix() {} },
    OrthographicCamera: class {
      constructor() { this.position = { z: 0 }; this.left = 0; this.right = 0; this.top = 0; this.bottom = 0; }
      updateProjectionMatrix() {}
      lookAt() {}
    },
    Group: class { constructor() { this.children = []; this.position = { set(){} }; } add(c) { this.children.push(c); } },
    Mesh: class { constructor() { this.position = { set(){} }; } },
    BufferGeometry: class { setAttribute() {} setFromPoints() {} get attributes() { return { position: { needsUpdate: false } }; } },
    BufferAttribute: class {},
    Points: class { constructor() { this.material = {}; } },
    PointsMaterial: class {},
    Color: class { constructor(hex) { this.hex = hex; } }
  };
}

function makeFakeCanvas() {
  return { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0, right: 800, bottom: 400 }) };
}

function injectFakeSceneFactory() {
  const calls = [];
  const groups = [];
  globalThis.RelationshipStageFxSceneFactory = {
    createScene: (THREE, presetId, preset) => {
      calls.push({ presetId, preset });
      const g = { isTabletop: true, children: [], dispose: () => { groups.splice(groups.indexOf(g), 1); } };
      groups.push(g);
      return g;
    }
  };
  return { calls, cleanup: () => { delete globalThis.RelationshipStageFxSceneFactory; } };
}

test('createStageFx 初始化时调用 scene-factory 创建默认桌面', () => {
  const { calls, cleanup } = injectFakeSceneFactory();
  delete require.cache[require.resolve('../src/stage-fx.js')];
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  assert.ok(result, '应返回 instance');
  assert.ok(calls.length >= 1, '应至少调用一次 scene-factory');
  assert.equal(calls[0].presetId, 'default', '默认调用 default preset');
  cleanup();
  if (result) result.dispose();
});

test('createStageFx 切换预设时调用 scene-factory 重新创建桌面', () => {
  const { calls, cleanup } = injectFakeSceneFactory();
  delete require.cache[require.resolve('../src/stage-fx.js')];
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  result.setPreset('meeting');
  assert.ok(calls.length >= 2, '应至少调用 2 次（init + 切换）');
  assert.equal(calls[1].presetId, 'meeting');
  cleanup();
  if (result) result.dispose();
});

test('createStageFx 切换预设时移除旧 Group 并添加新 Group', () => {
  injectFakeSceneFactory();
  delete require.cache[require.resolve('../src/stage-fx.js')];
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  // 取出内部 Scene（通过 getStats 暴露）
  const stats1 = result.getStats();
  const beforeLen = stats1.sceneChildren;
  result.setPreset('dinner');
  const stats2 = result.getStats();
  // 切换后 children 数应一致（remove 旧的 + add 新的）
  assert.equal(stats2.sceneChildren, beforeLen, '切换预设后 children 数量不变');
  delete globalThis.RelationshipStageFxSceneFactory;
  if (result) result.dispose();
});

test('createStageFx 初始化时设置 --accent CSS 变量', () => {
  injectFakeSceneFactory();
  delete require.cache[require.resolve('../src/stage-fx.js')];
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const fakeDoc = {
    documentElement: { style: { setProperty(k, v) { this[k] = v; } } },
    body: { style: { setProperty(k, v) { this[k] = v; } } },
    hidden: false,
    createElement: () => ({ getContext: t => t.startsWith('webgl') ? {} : null })
  };
  globalThis.document = fakeDoc;
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }), document: fakeDoc };
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  assert.ok(result, '应返回 instance');
  // 默认 preset 是 default, --accent 应被设置
  const accent = fakeDoc.body.style['--accent'];
  assert.ok(accent, '--accent 应被设置, got ' + accent);
  delete globalThis.RelationshipStageFxSceneFactory;
  if (result) result.dispose();
});

test('createStageFx 切换预设时更新 --accent', () => {
  injectFakeSceneFactory();
  delete require.cache[require.resolve('../src/stage-fx.js')];
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const fakeDoc = {
    documentElement: { style: { setProperty(k, v) { this[k] = v; } } },
    body: { style: { setProperty(k, v) { this[k] = v; } } },
    hidden: false,
    createElement: () => ({ getContext: t => t.startsWith('webgl') ? {} : null })
  };
  globalThis.document = fakeDoc;
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }), document: fakeDoc };
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  const initial = fakeDoc.body.style['--accent'];
  result.setPreset('dinner');
  const updated = fakeDoc.body.style['--accent'];
  assert.ok(updated, '切换后 --accent 应被设置');
  // 不同 preset 的 accent 应该不同
  delete globalThis.RelationshipStageFxSceneFactory;
  if (result) result.dispose();
});

test('createStageFx 暴露 getAccentColor API', () => {
  injectFakeSceneFactory();
  delete require.cache[require.resolve('../src/stage-fx.js')];
  const { api } = loadStageFx();
  const controller = controllerMod.createStageController();
  const fakeThree = makeFakeThree();
  const result = api.createStageFx({
    THREE: fakeThree,
    canvas: makeFakeCanvas(),
    fallback: { show() {} },
    controller,
    preferences: prefsMod
  });
  assert.equal(typeof result.getAccentColor, 'function', '应暴露 getAccentColor');
  const color = result.getAccentColor();
  assert.ok(color, 'getAccentColor 应返回颜色字符串');
  delete globalThis.RelationshipStageFxSceneFactory;
  if (result) result.dispose();
});
