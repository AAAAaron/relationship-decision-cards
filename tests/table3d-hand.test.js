const test = require('node:test');
const assert = require('node:assert/strict');

const handApi = require('../src/table3d/hand3d.js');
const interactApi = require('../src/table3d/interact3d.js');

test('computeFanSlots: 扇形左右对称且边牌后收', () => {
  const slots = handApi.computeFanSlots(5);
  assert.equal(slots.length, 5);
  assert.equal(slots[2].offset, 0);
  assert.ok(Math.abs(slots[0].x + slots[4].x) < 1e-9, '左右对称');
  assert.ok(Math.abs(slots[1].x + slots[3].x) < 1e-9, '内层对称');
  assert.ok(slots[0].z < slots[2].z, '边牌比中牌更靠后(更小 z)');
  assert.ok(slots[0].ry < 0 && slots[4].ry > 0, '边牌外旋');
});

test('computeFanSlots: 张数多时自动收紧间距', () => {
  const few = handApi.computeFanSlots(3);
  const many = handApi.computeFanSlots(8);
  assert.ok(Math.abs(many[7].x - many[0].x) < Math.abs(few[2].x - few[0].x) * 2.4, '8 张总宽不应线性爆炸');
});

test('ndcFromEvent: 事件坐标归一化到 -1..1', () => {
  const canvas = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 400 }) };
  const ndc = interactApi.ndcFromEvent({ clientX: 500, clientY: 250 }, canvas);
  assert.deepEqual(ndc, { x: 0, y: 0 });
  const corner = interactApi.ndcFromEvent({ clientX: 900, clientY: 50 }, canvas);
  assert.deepEqual(corner, { x: 1, y: 1 });
});
