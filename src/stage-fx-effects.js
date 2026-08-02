// 关系决策牌组：Three.js 关键动作特效（依赖注入 THREE，便于测试）
// 8.2 对方出牌 / 8.3 手牌重新发出 / 8.4 我方出牌 / 8.5 回合收藏
// 每个 effect 暴露 start(detail) / update(dt) / isAlive() 三个方法
(function initStageFxEffects(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipStageFxEffects = api;
})(typeof window !== 'undefined' ? window : globalThis, function createStageFxEffectsApi() {
  'use strict';

  // DOM 矩形 → canvas 归一化坐标 (-1..1 范围)
  function domRectToCanvasPoint(rect, canvasRect) {
    if (!rect || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;
    const cx = rect.left + rect.width / 2 - canvasRect.left;
    const cy = rect.top + rect.height / 2 - canvasRect.top;
    return {
      x: (cx / canvasRect.width) * 2 - 1,
      y: -(cy / canvasRect.height) * 2 + 1
    };
  }

  function createEffectBus() {
    const effects = new Set();
    return {
      add(effect) { if (effect) effects.add(effect); },
      remove(effect) { effects.delete(effect); },
      clear() {
        for (const e of effects) {
          try { if (typeof e.dispose === 'function') e.dispose(); } catch (error) { /* noop */ }
        }
        effects.clear();
      },
      activeCount() { return effects.size; },
      getEffects() { return [...effects]; },
      update(dt) {
        for (const e of effects) {
          try { e.update(dt); } catch (error) { /* 单个 effect 异常不影响其他 */ }
        }
        for (const e of [...effects]) {
          if (!e.isAlive()) {
            try { if (typeof e.dispose === 'function') e.dispose(); } catch (error) { /* noop */ }
            effects.delete(e);
          }
        }
      },
      render(THREE, scene) {
        for (const e of effects) {
          if (typeof e.render === 'function') {
            try { e.render(THREE, scene); } catch (error) { /* noop */ }
          }
        }
      }
    };
  }

  // 8.2 对方出牌：弧形光轨 + 落点波纹
  // 总时长 900ms
  function createOpponentPlayEffect(ctx) {
    const THREE = ctx && ctx.THREE;
    const canvas = ctx && ctx.canvas;
    let elapsed = 0;
    let alive = false;
    let objects = null;
    const DURATION = 0.9;
    function rectToPoint(rect, canvasRect) {
      if (!rect || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;
      const cx = rect.left + rect.width / 2 - canvasRect.left;
      const cy = rect.top + rect.height / 2 - canvasRect.top;
      return { x: (cx / canvasRect.width) * 2 - 1, y: -(cy / canvasRect.height) * 2 + 1 };
    }
    const effect = {
      start(detail) {
        elapsed = 0;
        alive = true;
        effect.detail = detail || {};
        if (!THREE) return;
        const canvasRect = canvas && typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
        const src = rectToPoint(detail && detail.sourceRect, canvasRect);
        const dst = rectToPoint(detail && detail.targetRect, canvasRect);
        if (!src || !dst) return;
        const points = THREE.QuadraticBezierCurve3
          ? new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(src.x, src.y, 0),
              new THREE.Vector3((src.x + dst.x) / 2, Math.max(src.y, dst.y) + 0.6, 0),
              new THREE.Vector3(dst.x, dst.y, 0)
            ).getPoints(32)
          : [
              new THREE.Vector3(src.x, src.y, 0),
              new THREE.Vector3((src.x + dst.x) / 2, Math.max(src.y, dst.y) + 0.6, 0),
              new THREE.Vector3(dst.x, dst.y, 0)
            ];
        const arcGeom = new THREE.BufferGeometry().setFromPoints(points);
        const arcMat = new THREE.LineBasicMaterial({ color: 0xf6dda0, transparent: true, opacity: 0 });
        const arc = new THREE.Line(arcGeom, arcMat);
        const ringGeom = new THREE.RingGeometry(0.05, 0.07, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x7594ff, side: THREE.DoubleSide || 0, transparent: true, opacity: 0 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.set(dst.x, dst.y, -0.1);
        objects = { arc, arcMat, ring, ringMat };
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getDuration() { return DURATION; },
      getElapsed() { return elapsed; },
      render(THREE, scene) {
        if (!objects || !THREE) return;
        if (objects.arc && !objects.arc.parent) scene.add(objects.arc);
        if (objects.ring && !objects.ring.parent) scene.add(objects.ring);
        const p = effect.getProgress();
        if (objects.arcMat) {
          if (p < 0.78) objects.arcMat.opacity = Math.min(0.9, p / 0.4);
          else objects.arcMat.opacity = Math.max(0, 0.9 * (1 - (p - 0.78) / 0.22));
        }
        if (objects.ringMat && objects.ring) {
          if (p >= 0.55) {
            const k = (p - 0.55) / 0.45;
            objects.ring.scale.set(1 + k * 8, 1 + k * 8, 1);
            objects.ringMat.opacity = Math.max(0, 0.85 * (1 - k));
          }
        }
      },
      dispose(scene) {
        if (!objects) return;
        ['arc', 'arcMat', 'ring', 'ringMat'].forEach(k => {
          const obj = objects[k];
          if (!obj) return;
          if (scene && scene.remove) scene.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        objects = null;
      }
    };
    return effect;
  }

  // 8.3 手牌重新发出：上方短暂流光 + 主推荐金色光束 + 备选蓝光
  // 总时长 700ms
  function createHandDealEffect(ctx) {
    let elapsed = 0;
    let alive = false;
    let ranks = [];
    const DURATION = 0.7;
    return {
      start(detail) {
        elapsed = 0;
        alive = true;
        ranks = (detail && detail.ranks) || [];
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getRanks() { return ranks.slice(); }
    };
  }

  // 8.4 我方出牌：DOM 卡抬起 + 沿曲线移 + 关系光路 + 落点光圈
  // 总时长 800ms
  function createPlayerPlayEffect(ctx) {
    let elapsed = 0;
    let alive = false;
    let rank = 'other';
    const DURATION = 0.8;
    return {
      start(detail) {
        elapsed = 0;
        alive = true;
        rank = (detail && detail.rank) || 'other';
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getRank() { return rank; }
    };
  }

  // 8.5 回合收藏：场景牌和回应牌连接光 + 中央金色星点 + 飞向卡包
  // 总时长 1200ms
  function createRoundSaveEffect(ctx) {
    let elapsed = 0;
    let alive = false;
    const DURATION = 1.2;
    return {
      start(detail) {
        elapsed = 0;
        alive = true;
        this.detail = detail || {};
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; }
    };
  }

  return {
    createEffectBus,
    createOpponentPlayEffect,
    createHandDealEffect,
    createPlayerPlayEffect,
    createRoundSaveEffect,
    domRectToCanvasPoint
  };
});
