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
      clear() { effects.clear(); },
      activeCount() { return effects.size; },
      update(dt) {
        for (const e of effects) {
          try { e.update(dt); } catch (error) { /* 单个 effect 异常不影响其他 */ }
          if (!e.isAlive()) effects.delete(e);
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

  // 8.2 对方出牌：左侧聚集粒子 + 弧形光轨 + 落点波纹
  // 总时长 900ms
  function createOpponentPlayEffect(ctx) {
    let elapsed = 0;
    let alive = false;
    let objects = null; // 渲染时由 stage-fx 注入
    const DURATION = 0.9;
    return {
      start(detail) {
        elapsed = 0;
        alive = true;
        this.detail = detail || {};
        this.targetPoint = null;
        this.sourcePoint = null;
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getDuration() { return DURATION; }
    };
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
