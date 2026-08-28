// table3d 引导: 拿到 three 后创建全局桥 Table3dBridge, 失败时标记 body.table3d-unavailable
(async function bootstrapTable3d() {
  try {
    const THREE = await import('three');
    const index = window.Table3dIndex;
    const canvas = document.getElementById('table3dCanvas');
    if (!index || !canvas) throw new Error('table3d 缺少挂载点');
    const missing = ['Table3dTween','Table3dCardTexture','Table3dCard3d','Table3dScene','Table3dHand','Table3dBoard','Table3dInteract','Table3dIndex']
      .filter(k => !(k in window));
    if (missing.length) throw new Error('table3d 全局模块缺失: ' + missing.join(','));
    const bridge = index.createTable3dBridge({
      THREE,
      canvas,
      callbacks: {
        onHandHover: (id) => window.dispatchEvent(new CustomEvent('table3d:hand-hover', { detail: { id } })),
        onHandSelect: (id, data) => window.dispatchEvent(new CustomEvent('table3d:hand-select', { detail: { id, data } })),
        onBoardClick: (kind) => window.dispatchEvent(new CustomEvent('table3d:board-click', { detail: { kind } }))
      }
    });
    if (!bridge) throw new Error('WebGL 初始化失败');
    window.Table3dBridge = bridge;
    document.body.classList.add('table3d-live');
    bridge.start();
    window.dispatchEvent(new CustomEvent('table3d:ready'));
    window.addEventListener('resize', () => bridge.handleResize());
  } catch (error) {
    document.body.classList.add('table3d-unavailable');
    document.body.dataset.table3dError = String((error && (error.stack || error.message)) || error).slice(0, 400);
    if (typeof console !== 'undefined') console.warn('[table3d] 降级为平面视图:', error && error.message);
  }
})();
