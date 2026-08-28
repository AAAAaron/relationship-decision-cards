// table3d: 轻量补间器(依赖注入无, Node 可测)
// to(target, props, opts) 对 target 的数值属性做补间; update(dt) 推进; handle.cancel() 可取消
(function initTable3dTween(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dTween = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dTweenApi() {
  'use strict';

  const EASE = {
    linear: t => t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutBack: t => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
  };

  function createTweenEngine() {
    const active = new Set();
    function to(target, props, opts = {}) {
      const duration = Math.max(0.001, opts.duration || 0.3);
      const delay = opts.delay || 0;
      const ease = EASE[opts.ease || 'easeOutCubic'] || EASE.easeOutCubic;
      const from = {}, toVals = {};
      for (const key of Object.keys(props)) {
        from[key] = Number(target[key]) || 0;
        toVals[key] = Number(props[key]);
      }
      let elapsed = 0;
      let cancelled = false;
      const handle = {
        cancel() { cancelled = true; active.delete(handle); },
        get active() { return !cancelled && active.has(handle); }
      };
      const tween = {
        update(dt) {
          if (cancelled) return false;
          elapsed += dt;
          const t = Math.min(1, Math.max(0, (elapsed - delay) / duration));
          const k = ease(t);
          for (const key of Object.keys(toVals)) {
            target[key] = from[key] + (toVals[key] - from[key]) * k;
          }
          if (typeof opts.onUpdate === 'function') opts.onUpdate(t);
          if (t >= 1) {
            active.delete(handle);
            if (typeof opts.onComplete === 'function') opts.onComplete();
            return false;
          }
          return true;
        }
      };
      active.add(handle);
      handle._tween = tween;
      return handle;
    }
    function update(dt) {
      for (const handle of [...active]) {
        const alive = handle._tween.update(dt);
        if (!alive) active.delete(handle);
      }
    }
    return {
      to,
      update,
      activeCount() { return active.size; },
      clear() { active.clear(); }
    };
  }

  return { createTweenEngine, EASE };
});
