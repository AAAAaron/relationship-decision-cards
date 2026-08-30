// table3d 引导: 拿到 three 后创建全局桥 Table3dBridge, 失败时标记 body.table3d-unavailable
(async function bootstrapTable3d() {
  try {
    const THREE = await import('three');

    // Modern Strategy Table 只覆盖视觉/布局模块，不改 app.js 的业务状态与回调协议。
    // 覆盖层加载失败时直接进入原有降级逻辑，避免出现半初始化牌桌。
    await import('./table3d/modern-strategy.js');
    await import('./table3d/modern-strategy-tuning.js');
    await import('./table3d/modern-strategy-art.js');
    await import('./table3d/modern-strategy-controls.js');
    await import('./table3d/modern-strategy-hero.js');

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
        onHandHover: (payload) => window.dispatchEvent(new CustomEvent('table3d:hover', { detail: payload })),
        onHandSelect: (id, data) => window.dispatchEvent(new CustomEvent('table3d:hand-select', { detail: { id, data } })),
        onBoardClick: (kind) => window.dispatchEvent(new CustomEvent('table3d:board-click', { detail: { kind } })),
        onTableControl: (control) => {
          const buttonId = control === 'opponent-deck'
            ? 'opponentDeckButton'
            : control === 'pack'
              ? 'packSpineButton'
              : null;
          if (buttonId) document.getElementById(buttonId)?.click();
          window.dispatchEvent(new CustomEvent('table3d:control', { detail: { control } }));
        },
        onTableControlHover: (payload) => window.dispatchEvent(new CustomEvent('table3d:control-hover', { detail: payload }))
      }
    });
    if (!bridge) throw new Error('WebGL 初始化失败');
    window.Table3dBridge = bridge;
    document.body.classList.add('table3d-live', 'modern-strategy-table');
    bridge.start();
    window.dispatchEvent(new CustomEvent('table3d:ready'));
    window.addEventListener('resize', () => bridge.handleResize());
  } catch (error) {
    document.body.classList.add('table3d-unavailable');
    document.body.dataset.table3dError = String((error && (error.stack || error.message)) || error).slice(0, 400);
    window.dispatchEvent(new CustomEvent('table3d:unavailable', { detail: { message: String((error && error.message) || error) } }));
    if (typeof console !== 'undefined') console.warn('[table3d] 降级为平面视图:', error && error.message);
  }
})();
