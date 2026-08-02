const test = require('node:test');
const assert = require('node:assert/strict');

const mod = require('../src/stage-fx-controller.js');

function newController() {
  return mod.createStageController();
}

test('初始 currentPreset 为 default', () => {
  const c = newController();
  assert.equal(c.getCurrentPreset().id, 'default');
});

test('setPreset 更新 currentPreset 并通知订阅者', () => {
  const c = newController();
  const events = [];
  const unsubscribe = c.subscribe((next, prev) => events.push([prev.id, next.id]));
  c.setPreset('meeting');
  c.setPreset('elevator');
  unsubscribe();
  c.setPreset('dinner'); // 取消订阅后不再通知，但预设仍会切换
  assert.deepEqual(events, [['default', 'meeting'], ['meeting', 'elevator']]);
  assert.equal(c.getCurrentPreset().id, 'dinner');
});

test('setPreset 对未知 preset 静默忽略', () => {
  const c = newController();
  const events = [];
  c.subscribe((next, prev) => events.push([prev.id, next.id]));
  c.setPreset('totally-unknown');
  assert.equal(events.length, 0);
  assert.equal(c.getCurrentPreset().id, 'default');
});

test('requestRender / releaseRender 维护 activeAnimations 计数', () => {
  const c = newController();
  assert.equal(c.isAnimating(), false);
  c.requestRender();
  c.requestRender();
  assert.equal(c.isAnimating(), true);
  c.releaseRender();
  assert.equal(c.isAnimating(), true);
  c.releaseRender();
  assert.equal(c.isAnimating(), false);
});

test('releaseRender 不会让计数变负', () => {
  const c = newController();
  c.releaseRender();
  c.releaseRender();
  assert.equal(c.isAnimating(), false);
  assert.equal(c.getActiveAnimations(), 0);
});

test('setPreset 触发一次 requestRender 以驱动切换过渡', () => {
  const c = newController();
  c.releaseRender(); // 归零
  c.setPreset('meeting');
  assert.equal(c.isAnimating(), true, '切换后应处于动画中');
  // 测试结束时不需要手动 release，测试间隔离
});

test('subscribe 抛错不影响其他订阅者', () => {
  const c = newController();
  let good = 0;
  c.subscribe(() => { throw new Error('boom'); });
  c.subscribe(() => { good += 1; });
  c.setPreset('meeting');
  assert.equal(good, 1);
});
