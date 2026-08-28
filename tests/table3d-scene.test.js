const test = require('node:test');
const assert = require('node:assert/strict');

const sceneApi = require('../src/table3d/scene3d.js');

test('LAYOUT: 卡位/手牌/符文圈坐标齐备且成构图', () => {
  const L = sceneApi.LAYOUT;
  assert.equal(L.opponent.z, L.rune.z, '对方/我方牌位应与符文圈同心');
  assert.ok(Math.abs(L.opponent.x - L.player.x) >= 1.5, '双方牌位应左右分开');
  assert.ok(L.hand.z > 0, '手牌应在近端');
  assert.equal(L.cardH, L.cardW * 1.6);
  assert.ok(L.packPos.x > 0 && L.deckPos.x < 0, '卡包在右, 牌堆在左');
});

test('paintTableCanvas: 桌面纹理可绘制且上色', () => {
  const calls = { fillRect: 0, stroke: 0 };
  const gradient = { addColorStop() {} };
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    measureText: () => ({ width: 0 }),
    fillRect() { calls.fillRect += 1; },
    beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {},
    stroke() { calls.stroke += 1; },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient
  };
  const fakeCanvas = { width: 256, height: 256, getContext: () => ctx };
  sceneApi.paintTableCanvas(fakeCanvas);
  assert.equal(calls.fillRect, 2, '底色 + 光池各一次');
  assert.ok(calls.stroke > 10, '应有木纹条');
});
