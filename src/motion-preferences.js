(function initMotionPreferences(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipMotionPreferences = api;
})(typeof window !== 'undefined' ? window : globalThis, function createMotionPreferencesApi() {
  'use strict';

  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

  function getMatchMedia() {
    if (typeof globalThis === 'undefined' || !globalThis.matchMedia) return null;
    try {
      return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia : null;
    } catch (error) {
      return null;
    }
  }

  function shouldReduceMotion() {
    const mq = getMatchMedia();
    if (!mq) return false;
    try {
      return Boolean(mq(REDUCED_MOTION_QUERY).matches);
    } catch (error) {
      return false;
    }
  }

  function isWebGLAvailable() {
    if (typeof document === 'undefined' || !document.createElement) return false;
    let canvas;
    try {
      canvas = document.createElement('canvas');
    } catch (error) {
      return false;
    }
    if (!canvas || typeof canvas.getContext !== 'function') return false;
    try {
      return Boolean(canvas.getContext('webgl2')) || Boolean(canvas.getContext('webgl'));
    } catch (error) {
      return false;
    }
  }

  function isDocumentHidden() {
    if (typeof document === 'undefined' || typeof document.hidden !== 'boolean') return true;
    return document.hidden;
  }

  // 后续可扩展：deviceMemory、hardwareConcurrency、UA 嗅探
  function isLowPerformance() {
    if (typeof navigator === 'undefined') return false;
    const memory = navigator.deviceMemory;
    if (typeof memory === 'number' && memory > 0 && memory < 2) return true;
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === 'number' && cores > 0 && cores <= 2) return true;
    return false;
  }

  function getMotionLevel() {
    if (!isWebGLAvailable()) return 'off';
    if (shouldReduceMotion()) return 'reduced';
    return 'full';
  }

  const MOTION_STORAGE_KEY = 'relationship-decision-cards:motion-level';
  const MOTION_LEVELS = ['full', 'reduced', 'off'];

  function readStoredMotionLevel() {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return null;
    try {
      const v = globalThis.localStorage.getItem(MOTION_STORAGE_KEY);
      return MOTION_LEVELS.indexOf(v) >= 0 ? v : null;
    } catch (error) { return null; }
  }

  function writeStoredMotionLevel(level) {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return;
    try {
      if (level && MOTION_LEVELS.indexOf(level) >= 0) globalThis.localStorage.setItem(MOTION_STORAGE_KEY, level);
      else globalThis.localStorage.removeItem(MOTION_STORAGE_KEY);
    } catch (error) { /* noop */ }
  }

  // 计算实际生效的 level：用户设置 > reduced-motion > WebGL 探针
  function getEffectiveMotionLevel() {
    const stored = readStoredMotionLevel();
    if (stored === 'off') return 'off';
    if (!isWebGLAvailable()) return 'off';
    if (stored === 'reduced') return 'reduced';
    if (shouldReduceMotion()) return 'reduced';
    return 'full';
  }

  function setMotionLevel(level) {
    if (MOTION_LEVELS.indexOf(level) < 0) return null;
    writeStoredMotionLevel(level);
    if (typeof globalThis !== 'undefined' && globalThis.dispatchEvent) {
      try { globalThis.dispatchEvent(new CustomEvent('rdc:motion-level', { detail: { level } })); } catch (e) { /* noop */ }
    }
    return level;
  }

  return {
    shouldReduceMotion,
    isWebGLAvailable,
    isDocumentHidden,
    isLowPerformance,
    getMotionLevel,
    getEffectiveMotionLevel,
    setMotionLevel,
    MOTION_LEVELS
  };
});
