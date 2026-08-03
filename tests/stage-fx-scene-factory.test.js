// AI 嘴替卡：Three.js 场景工厂的单测
// 覆盖固定牌桌垫 + 4 个场景周边装饰 + 粒子
const test = require('node:test');
const assert = require('node:assert/strict');

const mod = require('../src/stage-fx-scene-factory.js');

// 极简 mock Three.js：只覆盖 scene-factory 实际用到的几何 / 材质 / 容器
function createMockThree() {
  class Group {
    constructor() {
      this.children = [];
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { x: 1, y: 1, z: 1 };
    }
    add(child) { this.children.push(child); return child; }
    remove(child) { this.children = this.children.filter(c => c !== child); return child; }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { x: 1, y: 1, z: 1 };
    }
  }
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(key, attr) { this.attributes[key] = attr; }
  }
  class BufferAttribute { constructor(data, size) { this.data = data; this.size = size; } }
  class Points { constructor(geometry, material) { this.geometry = geometry; this.material = material; } }
  class CircleGeometry { constructor(r, segments) { this.r = r; this.segments = segments; } }
  class RingGeometry { constructor(inner, outer, segments) { this.inner = inner; this.outer = outer; this.segments = segments; } }
  class BoxGeometry { constructor(w, h, d) { this.w = w; this.h = h; this.d = d; } }
  class CylinderGeometry { constructor(rt, rb, h, segments) { this.rt = rt; this.rb = rb; this.h = h; this.segments = segments; } }
  class SphereGeometry { constructor(r, ws, hs) { this.r = r; this.ws = ws; this.hs = hs; } }
  class LatheGeometry { constructor(points, segments) { this.points = points; this.segments = segments; } }
  class ExtrudeGeometry { constructor(shape, opts) { this.shape = shape; this.opts = opts; } }
  class Shape {
    constructor() { this.segments = []; }
    moveTo(x, y) { this.segments.push(['M', x, y]); }
    lineTo(x, y) { this.segments.push(['L', x, y]); }
    quadraticCurveTo() { this.segments.push(['Q']); }
  }
  class ConeGeometry { constructor(r, h, segments) { this.r = r; this.h = h; this.segments = segments; } }
  class Vector2 { constructor(x, y) { this.x = x; this.y = y; } }
  class TubeGeometry { constructor() { this.kind = 'tube'; } }
  class MeshBasicMaterial { constructor(opts) { this.opts = opts || {}; } }
  class PointsMaterial { constructor(opts) { this.opts = opts || {}; } }
  class Color { constructor(hex) { this.hex = hex; } }
  return {
    Group, Mesh, BufferGeometry, BufferAttribute, Points,
    CircleGeometry, RingGeometry, BoxGeometry, CylinderGeometry, SphereGeometry,
    ConeGeometry, LatheGeometry, ExtrudeGeometry, Shape, Vector2, TubeGeometry,
    MeshBasicMaterial, PointsMaterial, Color,
    DoubleSide: 2
  };
}

const fakePreset = { id: 'meeting', particleColor: '#7594ff', particleCount: 80 };

test('createTabletop 包含底盘 + 牌桌垫顶面+侧面 + 边缘光环', () => {
  const THREE = createMockThree();
  const table = mod.createTabletop(THREE);
  assert.ok(table, '返回 group');
  assert.equal(table.children.length, 4, '底盘 + 顶面 + 侧面 + 边缘光环 = 4 个 mesh');
  assert.equal(table.children[0].geometry.constructor.name, 'CircleGeometry', '底盘是 CircleGeometry');
  assert.equal(table.children[1].geometry.constructor.name, 'CircleGeometry', '牌桌垫顶面是 CircleGeometry(贴木纹)');
  assert.equal(table.children[2].geometry.constructor.name, 'LatheGeometry', '牌桌垫侧面是 LatheGeometry(凸起)');
  assert.equal(table.children[3].geometry.constructor.name, 'RingGeometry', '光环是 RingGeometry');
});

test('每个场景的工厂函数都返回 Group', () => {
  const THREE = createMockThree();
  ['meeting', 'elevator', 'dinner', 'default'].forEach(id => {
    const scene = mod.createScene(THREE, id, fakePreset);
    assert.ok(scene, `${id} 返回 group`);
    assert.ok(scene.children.length >= 2, `${id} 至少包含牌桌 + 粒子`);
  });
});

test('createDefaultScene 周边装饰有笔筒 + 便签（牌桌 + 通用 props + 粒子）', () => {
  const THREE = createMockThree();
  const scene = mod.createScene(THREE, 'default', fakePreset);
  // 牌桌 + props group(含笔筒+便签) + 粒子 = 3 个 group
  assert.equal(scene.children.length, 3);
  const props = scene.children[1];
  assert.ok(props.children.length > 0, 'default 场景现在有通用物件(笔筒+便签), 不再为空');
});

test('createMeetingScene 包含笔记本 + 钢笔 + 文件', () => {
  const THREE = createMockThree();
  const scene = mod.createScene(THREE, 'meeting', fakePreset);
  // 牌桌 + 周边 props + 粒子 = 3 个 group；周边 props 包含 3 个 mesh
  assert.equal(scene.children.length, 3);
  const props = scene.children[1];
  assert.equal(props.children.length, 3, '会议室 props 应有 3 个物件');
});

test('createElevatorScene 包含 6 个楼层按钮', () => {
  const THREE = createMockThree();
  const scene = mod.createScene(THREE, 'elevator', fakePreset);
  // 牌桌 + 周边 props + 粒子 = 3 个 group；周边 props 包含 6 个 mesh
  assert.equal(scene.children.length, 3);
  const props = scene.children[1];
  assert.equal(props.children.length, 6, '电梯 props 应有 6 个按钮');
});

test('createDinnerScene 包含烛台 + 烛光 + 酒杯', () => {
  const THREE = createMockThree();
  const scene = mod.createScene(THREE, 'dinner', fakePreset);
  // 牌桌 + 周边 props + 粒子 = 3 个 group；周边 props 包含 3 个 mesh
  assert.equal(scene.children.length, 3);
  const props = scene.children[1];
  assert.equal(props.children.length, 3, '晚餐 props 应有 3 个物件');
});

test('createAmbientParticles 按 preset 数量生成粒子', () => {
  const THREE = createMockThree();
  const preset = { id: 'meeting', particleColor: '#fff', particleCount: 50 };
  const points = mod.createAmbientParticles(THREE, preset);
  assert.ok(points);
  assert.equal(points.geometry.attributes.position.data.length, 50 * 3);
  assert.equal(points.geometry.attributes.position.size, 3);
});

test('SCENE_FACTORIES 包含 4 个核心场景', () => {
  assert.equal(typeof mod.SCENE_FACTORIES.meeting, 'function');
  assert.equal(typeof mod.SCENE_FACTORIES.elevator, 'function');
  assert.equal(typeof mod.SCENE_FACTORIES.dinner, 'function');
  assert.equal(typeof mod.SCENE_FACTORIES.default, 'function');
});

test('createScene 未知 presetId 回退到 default', () => {
  const THREE = createMockThree();
  const scene = mod.createScene(THREE, 'totally-unknown', fakePreset);
  // unknown → default → 牌桌 + 空 props + 粒子 = 3 个
  assert.equal(scene.children.length, 3);
});
