// 关系决策牌组：Three.js 舞台视觉层（依赖注入 THREE，便于测试）
// 第一阶段：唯一 Renderer + 基础粒子 + 按需渲染 + resize + reduced-motion
// 浏览器中通过 import('three') 拿到 THREE 后调 createStageFx({ THREE, ... })
(function initStageFx(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipStageFx = api;
})(typeof window !== 'undefined' ? window : globalThis, function createStageFxApi(globalScope) {
  'use strict';

  // 容错：Node 测试 / 旧浏览器 / Web Worker 中 requestAnimationFrame 可能不存在
  const raf = (typeof requestAnimationFrame !== 'undefined')
    ? requestAnimationFrame.bind(typeof globalThis !== 'undefined' ? globalThis : null)
    : (cb) => setTimeout(() => cb(Date.now()), 16);
  const caf = (typeof cancelAnimationFrame !== 'undefined')
    ? cancelAnimationFrame.bind(typeof globalThis !== 'undefined' ? globalThis : null)
    : (id) => clearTimeout(id);

  // 延迟取 effects 模块（避免在 Node 测试中循环依赖）
  function effectsApi() {
    if (typeof require === 'function') {
      try { return require('./stage-fx-effects.js'); } catch (e) { return globalScope && globalScope.RelationshipStageFxEffects; }
    }
    return globalScope && globalScope.RelationshipStageFxEffects;
  }

  // 程序生成桌面场景工厂：globalThis 优先(便于测试注入), 再降级到 require
  function sceneFactoryApi() {
    if (typeof globalThis !== 'undefined' && globalThis.RelationshipStageFxSceneFactory) {
      return globalThis.RelationshipStageFxSceneFactory;
    }
    if (typeof require === 'function') {
      try { return require('./stage-fx-scene-factory.js'); } catch (e) { return null; }
    }
    return null;
  }

  function createStageFx({ THREE, canvas, fallback, controller, preferences } = {}) {
    function showFallbackAndReturn() {
      if (fallback && typeof fallback.show === 'function') fallback.show();
      return null;
    }
    if (!THREE || !canvas || !controller || !preferences) return showFallbackAndReturn();
    const motionLevel = preferences.getMotionLevel();
    if (motionLevel === 'off' || !preferences.isWebGLAvailable()) return showFallbackAndReturn();
    const reduced = motionLevel === 'reduced';
    const isLowPerf = preferences.isLowPerformance();

    const scene = new THREE.Scene();
    // 俯视正交相机：中央桌面 y=0 平面，z>0 朝向相机
    const VIEW_SIZE = 4.5;
    const aspect = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
    const camera = new THREE.OrthographicCamera(
      -VIEW_SIZE * aspect, VIEW_SIZE * aspect,
      VIEW_SIZE, -VIEW_SIZE,
      0.1, 100
    );
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !reduced });
    } catch (error) {
      return showFallbackAndReturn();
    }
    const pixelRatio = Math.min((typeof globalThis !== 'undefined' && globalThis.devicePixelRatio) || 1, isLowPerf ? 1 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);

    // 程序生成桌面场景：中央固定牌桌垫 + 周边装饰按 preset 切换
    const sceneFactory = sceneFactoryApi();
    let currentSceneGroup = null;
    function applyScenePreset(preset) {
      if (!sceneFactory || typeof sceneFactory.createScene !== 'function') return;
      // 卸载旧 Group
      if (currentSceneGroup) {
        try { scene.remove(currentSceneGroup); } catch (e) { /* noop */ }
        try {
          if (currentSceneGroup.traverse) {
            currentSceneGroup.traverse(obj => {
              if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
              if (obj.material && obj.material.dispose) obj.material.dispose();
            });
          }
        } catch (e) { /* noop */ }
      }
      // 构建新 Group
      try {
        currentSceneGroup = sceneFactory.createScene(THREE, preset.id, preset);
        if (currentSceneGroup) scene.add(currentSceneGroup);
      } catch (error) { /* noop */ }
    }
    applyScenePreset(controller.getCurrentPreset());

    // 关键动作特效总线
    const fx = effectsApi();
    const bus = (fx && fx.createEffectBus) ? fx.createEffectBus() : null;

    let rafId = null;
    let lastFrame = 0;
    function loop(time) {
      rafId = null;
      if (!controller.isAnimating() && documentHidden() && (!bus || bus.activeCount() === 0)) {
        stopLoop();
        return;
      }
      const dt = lastFrame ? (time - lastFrame) / 1000 : 0.016;
      lastFrame = time;
      if (bus) {
        bus.update(dt);
        bus.render(THREE, scene);
      }
      if (controller.isAnimating()) controller.releaseRender();
      renderer.render(scene, camera);
      const keepAlive = controller.isAnimating() || (bus && bus.activeCount() > 0);
      if (keepAlive) rafId = raf(loop);
    }
    function startLoop() {
      if (rafId !== null) return;
      lastFrame = 0;
      rafId = raf(loop);
    }
    function stopLoop() {
      if (rafId !== null) { caf(rafId); rafId = null; }
    }

    function documentHidden() {
      return typeof document !== 'undefined' && document.hidden === true;
    }

    let unsubController = null;
    try {
      unsubController = controller.subscribe((next) => {
        applyScenePreset(next);
        startLoop();
      });
    } catch (error) { /* noop */ }

    // 订阅关键动作事件
    function triggerEffect(kind, detail) {
      if (!bus || !fx) return;
      let effect = null;
      if (kind === 'opponent-play') effect = fx.createOpponentPlayEffect({ THREE, canvas });
      else if (kind === 'hand-deal') effect = fx.createHandDealEffect({ THREE, canvas });
      else if (kind === 'player-play') effect = fx.createPlayerPlayEffect({ THREE, canvas });
      else if (kind === 'round-save') effect = fx.createRoundSaveEffect({ THREE, canvas });
      else if (kind === 'card-flip') effect = fx.createCardFlipEffect({ THREE, canvas });
      if (!effect) return;
      try { effect.start(detail || {}); } catch (error) { /* noop */ }
      bus.add(effect);
      startLoop();
    }
    const eventUnsubs = [];
    if (typeof window !== 'undefined' && window.addEventListener) {
      ['rdc:opponent-play', 'rdc:hand-deal', 'rdc:player-play', 'rdc:round-save', 'rdc:card-flip'].forEach(name => {
        const handler = (e) => triggerEffect(name.replace('rdc:', ''), (e && e.detail) || {});
        window.addEventListener(name, handler);
        eventUnsubs.push(() => window.removeEventListener(name, handler));
      });
    }

    function handleResize() {
      const width = Math.max(1, (typeof window !== 'undefined' && window.innerWidth) || (canvas && canvas.clientWidth) || 1);
      const height = Math.max(1, (typeof window !== 'undefined' && window.innerHeight) || (canvas && canvas.clientHeight) || 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (canvas && canvas.style) { canvas.style.width = width + 'px'; canvas.style.height = height + 'px'; }
    }

    function onVisibility() {
      if (documentHidden()) stopLoop();
      else if (controller.isAnimating()) startLoop();
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibility);
    }

    function dispose() {
      stopLoop();
      if (typeof unsubController === 'function') unsubController();
      eventUnsubs.forEach(fn => { try { fn(); } catch (e) { /* noop */ } });
      if (bus) bus.clear();
      if (typeof document !== 'undefined' && document.removeEventListener) {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      try { renderer.dispose(); } catch (error) { /* noop */ }
      if (currentSceneGroup) {
        try {
          if (currentSceneGroup.traverse) {
            currentSceneGroup.traverse(obj => {
              if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
              if (obj.material && obj.material.dispose) obj.material.dispose();
            });
          }
        } catch (error) { /* noop */ }
        try { scene.remove(currentSceneGroup); } catch (error) { /* noop */ }
      }
    }

    handleResize();

    return {
      isAnimating: () => controller.isAnimating() || (bus && bus.activeCount() > 0),
      requestRender: () => { controller.requestRender(); startLoop(); },
      releaseRender: () => controller.releaseRender(),
      handleResize,
      setPreset: (id) => controller.setPreset(id),
      setEnabled(on) {
        if (on) {
          document.body.classList.add('stage-fx-active');
          document.body.classList.remove('stage-fx-fallback');
          startLoop();
        } else {
          stopLoop();
          document.body.classList.remove('stage-fx-active');
          document.body.classList.add('stage-fx-fallback');
          if (bus) bus.clear();
        }
      },
      getStats: () => ({
        controllerAnimating: controller.isAnimating(),
        busActive: bus ? bus.activeCount() : 0,
        sceneChildren: scene.children ? scene.children.length : 0
      }),
      dispose
    };
  }

  return { createStageFx };
});
