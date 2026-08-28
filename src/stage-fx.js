// AI 嘴替卡：Three.js 舞台视觉层（依赖注入 THREE，便于测试）
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
    let currentAccentColor = null;
    // 淡入淡出动画状态
    const FADE_DURATION = 0.42; // 420ms
    const FADE_STAGGER = 0.06;  // 60ms 间隔, 周边物件各自淡入
    let fadeStart = 0;
    let fadeFromGroup = null;
    let fadeToGroup = null;
    function makeGroupTransparent(g, opacity) {
      if (!g || !g.traverse) return;
      g.traverse(obj => {
        if (obj.material) {
          obj.material.transparent = true;
          obj.material.opacity = opacity;
        }
      });
    }
    // 给 Group 的子节点标记 stagger 索引(按深度遍历, 同级共享一个 index)
    function annotateFadeIndex(group) {
      if (!group) return;
      let idx = 0;
      group.children.forEach(child => {
        if (child.traverse) {
          // 子 Group (props) 整体共享一个 stagger (场景根 + 桌垫 + props)
          child.userData.fadeIndex = idx;
          // 子 Group 内部 mesh 不再单独 stagger (随 Group 一起淡入)
          idx += 1;
        }
      });
    }
    function startFadeIn(newGroup) {
      if (!newGroup) return;
      annotateFadeIndex(newGroup);
      makeGroupTransparent(newGroup, 0);
      scene.add(newGroup);
      fadeStart = performance.now() / 1000;
      fadeFromGroup = null;
      fadeToGroup = newGroup;
      currentSceneGroup = newGroup;
    }

    function applyScenePreset(preset) {
      if (!sceneFactory || typeof sceneFactory.createScene !== 'function') return;
      // 卸载旧 Group (同步 dispose)
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
      // 构建新 Group + 淡入
      try {
        const newGroup = sceneFactory.createScene(THREE, preset.id, preset, textureMap);
        if (typeof console !== 'undefined') {
          console.log('[stage-fx] preset', preset.id, 'textureMap keys:', Object.keys(textureMap), 'dinner has tex:', !!textureMap.dinner, 'image loaded:', !!(textureMap.dinner && textureMap.dinner.image && textureMap.dinner.image.complete));
        }
        startFadeIn(newGroup);
      } catch (error) { /* noop */ }
      // 同步当前 preset 的 accentColor 到 CSS 变量, 让 UI 主题色联动
      const accent = preset && preset.accentColor ? preset.accentColor : null;
      currentAccentColor = accent;
      try {
        if (typeof document !== 'undefined' && document.body && document.body.style) {
          if (accent) {
            document.body.style.setProperty('--accent', accent);
            document.body.style.setProperty('--accent-soft', accent + '33'); // 20% alpha
          } else {
            document.body.style.removeProperty('--accent');
            document.body.style.removeProperty('--accent-soft');
          }
        }
      } catch (e) { /* noop */ }
    }

    // 关键动作特效总线
    const fx = effectsApi();
    const bus = (fx && fx.createEffectBus) ? fx.createEffectBus() : null;

    // 桌面纹理预加载(异步, 加载完后用 textureMap 重新生成场景)
    const textureMap = {};
    const TEXTURE_PRESETS = {
      meeting: '../assets/textures/wood-oak.png',
      dinner: '../assets/textures/wood-walnut.png',
      elevator: '../assets/textures/marble-blue.png'
    };
    function loadImageTexture(threeArg, url) {
      return new Promise((resolve) => {
        if (typeof threeArg === 'undefined' || typeof threeArg.TextureLoader === 'undefined') {
          resolve(null);
          return;
        }
        // 先用 HTMLImageElement 验证可达, 再传给 TextureLoader
        const img = new Image();
        img.onload = () => {
          try {
            const loader = new threeArg.TextureLoader();
            loader.load(url, (tex) => {
              if (tex) {
                tex.colorSpace = threeArg.SRGBColorSpace || 'srgb';
                tex.wrapS = tex.wrapT = threeArg.RepeatWrapping || 1000;
                tex.repeat.set(1, 1);
                tex.needsUpdate = true;
                resolve(tex);
              } else {
                resolve(null);
              }
            }, undefined, () => resolve(null));
          } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }
    (async () => {
      try {
        const entries = await Promise.all(
          Object.entries(TEXTURE_PRESETS).map(async ([k, url]) => {
            const tex = await loadImageTexture(THREE, url);
            return [k, tex];
          })
        );
        for (const [k, tex] of entries) {
          if (tex) textureMap[k] = tex;
        }
        if (typeof console !== 'undefined') {
          console.log('[stage-fx] textureMap loaded:', Object.keys(textureMap));
        }
        // 纹理加载完, 重新刷一次当前场景(用新贴图)
        if (Object.keys(textureMap).length > 0) {
          applyScenePreset(controller.getCurrentPreset());
        }
      } catch (e) { /* noop */ }
    })();

    applyScenePreset(controller.getCurrentPreset());

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
      // 推进淡入动画(周边物件 stagger 各自淡入)
      if (fadeToGroup) {
        const elapsed = time / 1000 - fadeStart;
        // 周边物件(从 index=1 开始) 各自延迟 stagger
        if (fadeToGroup.traverse) {
          fadeToGroup.traverse(obj => {
            if (obj.material) {
              const idx = (obj.userData && obj.userData.fadeIndex != null) ? obj.userData.fadeIndex : 0;
              const start = idx * FADE_STAGGER;
              const localT = Math.max(0, Math.min(1, (elapsed - start) / FADE_DURATION));
              const ease = localT * (2 - localT); // ease-out
              obj.material.opacity = ease;
            }
          });
        }
        // 检查是否所有 mesh 全部完成
        let allDone = true;
        if (fadeToGroup.traverse) {
          fadeToGroup.traverse(obj => {
            if (obj.material) {
              const idx = (obj.userData && obj.userData.fadeIndex != null) ? obj.userData.fadeIndex : 0;
              const localT = (elapsed - idx * FADE_STAGGER) / FADE_DURATION;
              if (localT < 1) allDone = false;
            }
          });
        }
        if (allDone) {
          // 动画结束, 恢复 opacity=1
          if (fadeToGroup.traverse) {
            fadeToGroup.traverse(obj => {
              if (obj.material) {
                obj.material.opacity = 1;
                obj.material.needsUpdate = true;
              }
            });
          }
          fadeToGroup = null;
        }
      }
      if (bus) {
        bus.update(dt);
        bus.render(THREE, scene);
      }
      if (controller.isAnimating()) controller.releaseRender();
      renderer.render(scene, camera);
      const keepAlive = controller.isAnimating() || (bus && bus.activeCount() > 0) || !!fadeToGroup;
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
      else if (kind === 'player-play') effect = fx.createPlayerPlayEffect({ THREE, canvas, lowPerf: isLowPerf });
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
          document.body.classList.remove('stage-fx-static');
          document.body.classList.remove('stage-fx-fallback');
          startLoop();
        } else {
          // 关闭动效: 保留 canvas 最后一帧作为静态桌面, 停止 rAF 循环
          stopLoop();
          document.body.classList.remove('stage-fx-active');
          document.body.classList.remove('stage-fx-fallback');
          document.body.classList.add('stage-fx-static');
          if (bus) bus.clear();
        }
      },
      getStats: () => ({
        controllerAnimating: controller.isAnimating(),
        busActive: bus ? bus.activeCount() : 0,
        sceneChildren: scene.children ? scene.children.length : 0
      }),
      getAccentColor: () => currentAccentColor,
      getScene: () => scene,
      getTextureMap: () => textureMap,
      dispose
    };
  }

  return { createStageFx };
});
