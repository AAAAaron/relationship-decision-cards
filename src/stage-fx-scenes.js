// 关系决策牌组：Three.js 舞台场景预设（纯数据，无 three.js 依赖，便于测试）
// 第一阶段仅定义 meeting / elevator / dinner 三个核心场景，
// 其余 sceneType 在 resolveScenePresetFromEvent 中回退到 default。
(function initStageFxScenes(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipStageFxScenes = api;
})(typeof window !== 'undefined' ? window : globalThis, function createStageFxScenesApi() {
  'use strict';

  // 每个预设字段：
  //   id          预设 id
  //   title       中文标题（供 UI 调试用）
  //   tone        冷/暖/中性，影响背景调色
  //   tint        背景色 hex
  //   particleColor 粒子颜色 hex
  //   particleCount 粒子数量
  //   pulse       { speed, intensity } 低频呼吸光
  //   motion      { drift, swirl } 粒子运动参数
  //   transitionMs    切换过渡时长（ms）
  const SCENE_PRESETS = {
    meeting: {
      id: 'meeting',
      title: '正式会议',
      tone: 'cold',
      tint: '#0d1c34',
      accentColor: '#f6dda0',
      particleColor: '#7594ff',
      particleCount: 200,
      pulse: { speed: 0.4, intensity: 0.18 },
      motion: { drift: 0.0008, swirl: 0.0003 },
      transitionMs: 600
    },
    elevator: {
      id: 'elevator',
      title: '电梯里',
      tone: 'cool',
      tint: '#102236',
      accentColor: '#c8d2e0',
      particleColor: '#c8d2e0',
      particleCount: 90,
      pulse: { speed: 1.2, intensity: 0.22 },
      motion: { drift: 0.004, swirl: 0.0 },
      transitionMs: 450
    },
    dinner: {
      id: 'dinner',
      title: '饭局',
      tone: 'warm',
      tint: '#241912',
      accentColor: '#ffb366',
      particleColor: '#f6dda0',
      particleCount: 140,
      pulse: { speed: 0.6, intensity: 0.16 },
      motion: { drift: 0.0006, swirl: 0.0008 },
      transitionMs: 700
    },
    default: {
      id: 'default',
      title: '默认氛围',
      tone: 'neutral',
      tint: '#0a1626',
      accentColor: '#7da3ff',
      particleColor: '#7da3ff',
      particleCount: 120,
      pulse: { speed: 0.5, intensity: 0.15 },
      motion: { drift: 0.0007, swirl: 0.0004 },
      transitionMs: 600
    }
  };

  // 把 data/demo-data.js 中的 scene_type 映射到 3 个核心预设
  // meeting 直接命中；encounter → elevator；meal → dinner；其余 → default
  const SCENE_TYPE_ALIASES = {
    encounter: 'elevator',
    meal: 'dinner',
    private: 'default',
    phone: 'default',
    async_message: 'default',
    event: 'default'
  };

  function getScenePreset(sceneType) {
    if (!sceneType || !SCENE_PRESETS[sceneType]) return SCENE_PRESETS.default;
    return SCENE_PRESETS[sceneType];
  }

  function resolveScenePresetFromEvent(detail) {
    if (!detail || typeof detail !== 'object') return SCENE_PRESETS.default;
    if (detail.presetId && SCENE_PRESETS[detail.presetId]) return SCENE_PRESETS[detail.presetId];
    if (detail.sceneType) {
      const aliasKey = SCENE_TYPE_ALIASES[detail.sceneType] || detail.sceneType;
      if (SCENE_PRESETS[aliasKey]) return SCENE_PRESETS[aliasKey];
    }
    return SCENE_PRESETS.default;
  }

  return {
    SCENE_PRESETS,
    getScenePreset,
    resolveScenePresetFromEvent
  };
});
