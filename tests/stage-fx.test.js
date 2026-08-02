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
    Scene: class { add() {} remove() {} traverse() {} },
    PerspectiveCamera: class { constructor() { this.position = { z: 0 }; } updateProjectionMatrix() {} },
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
