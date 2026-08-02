const test = require('node:test');
const assert = require('node:assert/strict');

// 测试 createEffect 工厂和 effect 生命周期，不依赖 three.js
const effectsMod = require('../src/stage-fx-effects.js');

function makeMockThree() {
  return {
    Vector2: class { constructor(x, y) { this.x = x; this.y = y; } },
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
    BufferGeometry: class { setAttribute() {} get attributes() { return { position: { needsUpdate: false } }; } },
    BufferAttribute: class {},
    Points: class { constructor() { this.material = {}; this.geometry = {}; } },
    PointsMaterial: class { constructor(opts) { Object.assign(this, opts || {}); } },
    Line: class { constructor() { this.material = {}; this.geometry = {}; } },
    LineBasicMaterial: class { constructor(opts) { Object.assign(this, opts || {}); } },
    RingGeometry: class {},
    Mesh: class { constructor() { this.material = {}; this.geometry = {}; this.position = new this.constructor.Vector3(); this.scale = new this.constructor.Vector3(1,1,1); this.rotation = new this.constructor.Vector3(); } },
    MeshBasicMaterial: class { constructor(opts) { Object.assign(this, opts || {}); this.transparent = opts && opts.transparent; this.opacity = opts && opts.opacity || 1; } },
    Color: class { constructor(hex) { this.hex = hex; } }
  };
}

test('createOpponentPlayEffect 返回一个 effect 对象', () => {
  const effect = effectsMod.createOpponentPlayEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  assert.equal(typeof effect.start, 'function');
  assert.equal(typeof effect.update, 'function');
  assert.equal(typeof effect.isAlive, 'function');
  assert.equal(effect.isAlive(), false);
});

test('createOpponentPlayEffect start 后 isAlive 为 true，update 推进到结束', () => {
  const effect = effectsMod.createOpponentPlayEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  effect.start({
    sourceRect: { left: 10, top: 200, width: 60, height: 60, right: 70, bottom: 260 },
    targetRect: { left: 400, top: 100, width: 100, height: 140, right: 500, bottom: 240 }
  });
  assert.equal(effect.isAlive(), true);
  // 推进 0.5s（总时长 0.9s）
  effect.update(0.5);
  assert.equal(effect.isAlive(), true);
  // 推进 0.5s（累计 1.0s，已超过 0.9s）
  effect.update(0.5);
  assert.equal(effect.isAlive(), false);
});

test('createOpponentPlayEffect start 不带 detail 不会爆错', () => {
  const effect = effectsMod.createOpponentPlayEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  effect.start({});
  assert.equal(effect.isAlive(), true);
});

test('domRectToCanvasPoint 把 DOM 坐标转换到 canvas 坐标', () => {
  const pt = effectsMod.domRectToCanvasPoint(
    { left: 100, top: 50, width: 60, height: 60, right: 160, bottom: 110 },
    { left: 0, top: 0, width: 800, height: 400 }
  );
  assert.ok(pt, '应返回点');
  // canvas 800x400，DOM 中心 130,80 应映射到 -1..1 NDC 大致 (130/800*2-1, -80/400*2+1)
  assert.equal(typeof pt.x, 'number');
  assert.equal(typeof pt.y, 'number');
});

test('createHandDealEffect 接受 ranks 并在 update 推进后结束', () => {
  const effect = effectsMod.createHandDealEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  effect.start({ count: 3, ranks: ['primary', 'backup', 'other'] });
  assert.equal(effect.isAlive(), true);
  effect.update(1.0);
  assert.equal(effect.isAlive(), false);
});

test('createPlayerPlayEffect 接受 rank 决定颜色', () => {
  const effect = effectsMod.createPlayerPlayEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  effect.start({ rank: 'primary' });
  effect.update(0.5);
  effect.update(0.6);
  assert.equal(effect.isAlive(), false);
});

test('createRoundSaveEffect 在 update 推进后结束', () => {
  const effect = effectsMod.createRoundSaveEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  effect.start({
    sourceRect: { left: 200, top: 100, width: 100, height: 140, right: 300, bottom: 240 },
    targetRect: { left: 400, top: 100, width: 100, height: 140, right: 500, bottom: 240 },
    packRect: { left: 700, top: 200, width: 60, height: 200, right: 760, bottom: 400 }
  });
  effect.update(1.0);
  assert.equal(effect.isAlive(), true);
  effect.update(0.5);
  assert.equal(effect.isAlive(), false);
});

test('createEffectBus 管理多个 effect 的生命周期', () => {
  const bus = effectsMod.createEffectBus();
  assert.equal(bus.activeCount(), 0);
  const e1 = effectsMod.createHandDealEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  e1.start({ count: 3, ranks: ['primary'] });
  const e2 = effectsMod.createHandDealEffect({ THREE: makeMockThree(), canvas: { getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }) } });
  e2.start({ count: 3, ranks: ['backup'] });
  bus.add(e1);
  bus.add(e2);
  assert.equal(bus.activeCount(), 2);
  bus.update(1.0);
  assert.equal(bus.activeCount(), 0, '推进超过时长后所有 effect 结束');
});
