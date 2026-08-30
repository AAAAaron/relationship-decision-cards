// table3d: Raycaster 拾取
// 统一处理 pointermove/pointerdown: 命中手牌/战场牌/桌边控件回调, 光标反馈
(function initTable3dInteract(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dInteract = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dInteractApi() {
  'use strict';

  // ndcFromEvent(event, canvas): 事件坐标 → 归一化设备坐标(供 raycaster)
  function ndcFromEvent(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (cx / rect.width) * 2 - 1,
      y: -(cy / rect.height) * 2 + 1
    };
  }

  function createInteract3D({ THREE, canvas, domElement, targets, onHover, onClick }) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let currentHit = null;

    function pick(event) {
      const ndc = ndcFromEvent(event, canvas);
      if (!ndc) return null;
      pointer.set(ndc.x, ndc.y);
      raycaster.setFromCamera(pointer, targets.camera);
      const meshes = targets.getMeshes();
      const hits = raycaster.intersectObjects(meshes, true);
      return hits.length ? hits[0].object : null;
    }

    function resolveInteractive(object) {
      // 沿父链找到带 userData.card 或 userData.tableControl 的交互组
      let obj = object;
      while (obj) {
        if (obj.userData && (obj.userData.card || obj.userData.tableControl)) return obj;
        obj = obj.parent;
      }
      return null;
    }

    let rafPending = false;
    let lastEvent = null;
    function scheduleHover(event) {
      lastEvent = event;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const hit = pick(lastEvent);
        const target = hit ? resolveInteractive(hit) : null;
        if (target !== currentHit) {
          currentHit = target;
          if (domElement) domElement.style.cursor = target ? 'pointer' : '';
          if (typeof onHover === 'function') onHover(target, lastEvent);
        }
      });
    }

    function pointerDown(event) {
      const hit = pick(event);
      const target = hit ? resolveInteractive(hit) : null;
      if (typeof onClick === 'function') onClick(target, event);
    }

    if (domElement) {
      domElement.addEventListener('pointermove', scheduleHover);
      domElement.addEventListener('pointerdown', pointerDown);
    }

    return {
      pick,
      resolveCard: resolveInteractive,
      resolveInteractive,
      dispose() {
        if (domElement) {
          domElement.removeEventListener('pointermove', scheduleHover);
          domElement.removeEventListener('pointerdown', pointerDown);
        }
      }
    };
  }

  return { createInteract3D, ndcFromEvent };
});
