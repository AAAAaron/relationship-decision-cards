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
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 6;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !reduced });
    } catch (error) {
      return showFallbackAndReturn();
    }
    const pixelRatio = Math.min((typeof globalThis !== 'undefined' && globalThis.devicePixelRatio) || 1, isLowPerf ? 1 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);

    const particleCountBase = isLowPerf ? 60 : (reduced ? 90 : 160);
    const particles = createParticleField(THREE, scene, particleCountBase);
    applyPresetBackground(THREE, scene, controller.getCurrentPreset());

    let rafId = null;
    let lastFrame = 0;
    function loop(time) {
      rafId = null;
      if (!controller.isAnimating() && documentHidden()) {
        stopLoop();
        return;
      }
      const dt = lastFrame ? (time - lastFrame) / 1000 : 0.016;
      lastFrame = time;
      advanceParticles(particles, dt, controller.getCurrentPreset());
      if (controller.isAnimating()) controller.releaseRender();
      renderer.render(scene, camera);
      if (controller.isAnimating()) rafId = raf(loop);
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
        applyPresetBackground(THREE, scene, next);
        scene.background = null;
        startLoop();
      });
    } catch (error) { /* noop */ }

    function handleResize() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
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
      if (typeof document !== 'undefined' && document.removeEventListener) {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      try { renderer.dispose(); } catch (error) { /* noop */ }
      try { scene.traverse && scene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) obj.material.dispose(); }); } catch (error) { /* noop */ }
    }

    handleResize();

    return {
      isAnimating: () => controller.isAnimating(),
      requestRender: () => { controller.requestRender(); startLoop(); },
      releaseRender: () => controller.releaseRender(),
      handleResize,
      setPreset: (id) => controller.setPreset(id),
      dispose
    };
  }

  function createParticleField(THREE, scene, count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x7da3ff, size: 0.045, transparent: true, opacity: 0.6, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    return { points, positions, geometry, material, baseCount: count };
  }

  function applyPresetBackground(THREE, scene, preset) {
    if (!preset || !THREE.Color) return;
    const tint = parseColor(preset.tint, THREE);
    scene.background = tint;
  }

  function parseColor(hex, THREE) {
    try { return new THREE.Color(hex); } catch (error) { return new THREE.Color('#0a1626'); }
  }

  function advanceParticles(state, dt, preset) {
    if (!state || !preset || !state.positions) return;
    const drift = preset.motion ? preset.motion.drift : 0.0008;
    const positions = state.positions;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += drift * 60 * dt;
      if (positions[i + 1] > 3) positions[i + 1] = -3;
    }
    state.geometry.attributes.position.needsUpdate = true;
  }

  return { createStageFx };
});
