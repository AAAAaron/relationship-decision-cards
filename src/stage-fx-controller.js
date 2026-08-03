// AI 嘴替卡：Three.js 舞台纯逻辑控制器（无 three 依赖，可测）
// 负责：当前场景预设、按需渲染计数、订阅派发
// 视觉层（renderer / scene / camera / particles）由 stage-fx.js 负责
(function initStageFxController(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipStageFxController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createStageFxControllerApi(globalScope) {
  'use strict';

  const scenes = (globalScope && globalScope.RelationshipStageFxScenes)
    || (typeof require === 'function' ? require('./stage-fx-scenes.js') : null);

  function createStageController() {
    let currentPreset = scenes ? scenes.getScenePreset('default') : { id: 'default', transitionMs: 600 };
    let activeAnimations = 0;
    const subscribers = new Set();

    function getCurrentPreset() { return currentPreset; }
    function isAnimating() { return activeAnimations > 0; }
    function getActiveAnimations() { return activeAnimations; }

    function setPreset(presetId) {
      if (!scenes) return;
      const next = scenes.getScenePreset(presetId);
      if (!next || next.id === currentPreset.id) return;
      const prev = currentPreset;
      currentPreset = next;
      requestRender();
      subscribers.forEach(fn => {
        try { fn(next, prev); } catch (error) { /* 单个订阅者抛错不影响其他 */ }
      });
    }

    function requestRender() {
      activeAnimations += 1;
    }

    function releaseRender() {
      activeAnimations = Math.max(0, activeAnimations - 1);
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    }

    return {
      getCurrentPreset,
      setPreset,
      isAnimating,
      getActiveAnimations,
      requestRender,
      releaseRender,
      subscribe
    };
  }

  return { createStageController };
});
