const test = require('node:test');
const assert = require('node:assert/strict');

const tween = require('../src/table3d/tween.js');
const cardTexture = require('../src/table3d/card-texture.js');
const card3d = require('../src/table3d/card3d.js');

function mockCtx() {
  const gradient = { addColorStop() {} };
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: 'left', textBaseline: 'alphabetic',
    measureText: (text) => ({ width: String(text).length * 10 }),
    fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {},
    quadraticCurveTo() {}, closePath() {}, fill() {}, stroke() {},
    save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillText() {}
  };
}

test('tween 引擎: 补间推进数值并收敛到目标', () => {
  const engine = tween.createTweenEngine();
  const obj = { x: 0 };
  engine.to(obj, { x: 10 }, { duration: 1, ease: 'linear' });
  engine.update(0.5);
  assert.equal(obj.x, 5);
  engine.update(0.5);
  assert.equal(obj.x, 10);
  assert.equal(engine.activeCount(), 0);
});

test('tween 引擎: cancel 停止补间', () => {
  const engine = tween.createTweenEngine();
  const obj = { y: 0 };
  const handle = engine.to(obj, { y: 10 }, { duration: 1, ease: 'linear' });
  handle.cancel();
  engine.update(2);
  assert.equal(obj.y, 0);
  assert.equal(engine.activeCount(), 0);
});

test('tween 引擎: easeOutBack 前段超过目标(回弹)', () => {
  const engine = tween.createTweenEngine();
  const obj = { s: 0 };
  engine.to(obj, { s: 1 }, { duration: 1, ease: 'easeOutBack' });
  engine.update(0.7);
  assert.ok(obj.s > 1, `0.7 处应超过 1, 实际 ${obj.s}`);
});

test('wrapText: 按宽度换行并支持省略号截断', () => {
  const ctx = mockCtx(); // 每字符宽 10
  const lines = cardTexture.wrapText(ctx, '一二三四五六七八九十', 45, 99);
  assert.deepEqual(lines, ['一二三四', '五六七八', '九十']);
  const truncated = cardTexture.wrapText(ctx, '一二三四五六七八九十', 45, 2);
  assert.equal(truncated.length, 2);
  assert.ok(truncated[1].endsWith('…'));
});

test('卡面常量与 rank 样式齐备', () => {
  assert.equal(cardTexture.CARD_H, Math.round(cardTexture.CARD_W * 1.6));
  for (const rank of ['primary', 'backup', 'risk', 'other']) {
    assert.ok(cardTexture.RANK_STYLE[rank].label, `${rank} 应有中文标签`);
  }
});

test('drawCardFace / drawCardBack 在 mock ctx 上可完整执行', () => {
  const ctx = mockCtx();
  cardTexture.drawCardFace(ctx, {
    kind: 'hand', rank: 'primary', title: '有条件接受', quote: '先试点, 再推开。',
    meta: [{ label: '语气', value: '我的原声' }],
    back: { logic: 'l', invalid: 'i', source: 's' }
  });
  cardTexture.drawCardBack(ctx, {
    kind: 'scene', title: '本周必须上线',
    back: { logic: 'l', invalid: 'i', source: 's' }
  });
  assert.ok(true);
});

test('card3d: 圆角形状按序构建路径', () => {
  const calls = [];
  const THREE = {
    Shape: class {
      moveTo(...a) { calls.push(['moveTo', ...a]); }
      lineTo(...a) { calls.push(['lineTo', ...a]); }
      quadraticCurveTo(...a) { calls.push(['quadraticCurveTo', ...a]); }
    }
  };
  const shape = card3d.roundedCardShape(THREE, 1, 1.6, 0.055);
  assert.ok(shape);
  assert.equal(calls[0][0], 'moveTo');
  assert.equal(calls[calls.length - 1][0], 'quadraticCurveTo');
});
