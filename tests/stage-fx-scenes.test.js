const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mod = require('../src/stage-fx-scenes.js');

test('getScenePreset 对已知 sceneType 返回完整预设', () => {
  const preset = mod.getScenePreset('meeting');
  assert.ok(preset, 'meeting 应有预设');
  assert.equal(preset.id, 'meeting');
  assert.equal(typeof preset.tint, 'string');
  assert.equal(typeof preset.particleColor, 'string');
  assert.equal(typeof preset.particleCount, 'number');
  assert.equal(typeof preset.pulse, 'object');
  assert.equal(typeof preset.pulse.speed, 'number');
});

test('getScenePreset 对未知 sceneType 返回 default', () => {
  const preset = mod.getScenePreset('totally-unknown');
  assert.equal(preset.id, 'default');
});

test('SCENE_PRESETS 中三个核心场景的视觉差异显著', () => {
  const meeting = mod.getScenePreset('meeting');
  const elevator = mod.getScenePreset('elevator');
  const dinner = mod.getScenePreset('dinner');
  // 冷蓝 vs 暖金 + 至少一个参数不同
  assert.notEqual(meeting.particleColor, dinner.particleColor, 'meeting 与 dinner 粒子色应不同');
  assert.notEqual(elevator.pulse.speed, dinner.pulse.speed, 'elevator 与 dinner 脉冲速度应不同');
  assert.ok(['cold', 'cool', 'neutral', 'warm'].includes(meeting.tone));
  assert.ok(['warm', 'intimate'].includes(dinner.tone));
  assert.ok(['cool', 'cold', 'neutral'].includes(elevator.tone) || elevator.tone !== dinner.tone);
});

test('resolveScenePresetFromEvent 把 rdc:scene-change 的 detail 映射到预设', () => {
  const preset = mod.resolveScenePresetFromEvent({ sceneType: 'elevator' });
  assert.equal(preset.id, 'elevator');
  const fallback = mod.resolveScenePresetFromEvent({});
  assert.equal(fallback.id, 'default');
  const explicit = mod.resolveScenePresetFromEvent({ presetId: 'dinner' });
  assert.equal(explicit.id, 'dinner');
});

test('resolveScenePresetFromEvent 把 demo-data 中的 scene_type 经别名映射到核心预设', () => {
  assert.equal(mod.resolveScenePresetFromEvent({ sceneType: 'meeting' }).id, 'meeting');
  assert.equal(mod.resolveScenePresetFromEvent({ sceneType: 'encounter' }).id, 'elevator');
  assert.equal(mod.resolveScenePresetFromEvent({ sceneType: 'meal' }).id, 'dinner');
  assert.equal(mod.resolveScenePresetFromEvent({ sceneType: 'private' }).id, 'default');
  assert.equal(mod.resolveScenePresetFromEvent({ sceneType: 'phone' }).id, 'default');
  assert.equal(mod.resolveScenePresetFromEvent({ sceneType: 'async_message' }).id, 'default');
  assert.equal(mod.resolveScenePresetFromEvent({ sceneType: 'event' }).id, 'default');
});

test('每个预设至少 30 个粒子且不超过 400', () => {
  Object.values(mod.SCENE_PRESETS).forEach(preset => {
    assert.ok(preset.particleCount >= 30, `${preset.id} 粒子数 ${preset.particleCount} 过少`);
    assert.ok(preset.particleCount <= 400, `${preset.id} 粒子数 ${preset.particleCount} 过多`);
  });
});
