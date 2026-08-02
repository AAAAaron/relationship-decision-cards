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

  return {
    shouldReduceMotion,
    isWebGLAvailable,
    isDocumentHidden,
    isLowPerformance,
    getMotionLevel
  };
});
