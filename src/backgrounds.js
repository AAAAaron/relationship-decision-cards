(function initBackgrounds(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipBackgrounds = api;
})(typeof window !== 'undefined' ? window : globalThis, function createBackgroundsApi() {
  'use strict';

  // 背景选择状态独立存储，便于将来迁移到后端 API 时只替换这一处。
  const STORAGE_KEY = 'relationship-decision-cards:background';
  const DEFAULT_BASE_URL = 'assets/backgrounds/';

  let manifest = null;
  let currentId = null;
  let storage = null;
  let storageProbed = false;
  const subscribers = new Set();

  function safeStorage() {
    if (storageProbed) return storage;
    storageProbed = true;
    try {
      storage = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null;
    } catch (error) {
      storage = null;
    }
    return storage;
  }

  function readStoredId() {
    const s = safeStorage();
    if (!s) return null;
    try {
      return s.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeStoredId(id) {
    const s = safeStorage();
    if (!s) return;
    try {
      s.setItem(STORAGE_KEY, id);
    } catch (error) {
      // 静默降级：localStorage 不可用（如隐私模式、quota）时不影响当前选择
    }
  }

  function parseManifest(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`背景清单 JSON 解析失败：${error.message}`);
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('背景清单格式错误。');
    if (!Array.isArray(parsed.backgrounds)) throw new Error('背景清单缺少 backgrounds 数组。');
    return {
      version: parsed.version ?? 1,
      default: parsed.default || null,
      backgrounds: parsed.backgrounds.map(entry => ({ ...entry }))
    };
  }

  function loadManifest({ fetcher } = {}) {
    if (fetcher) {
      return Promise.resolve(fetcher(`${DEFAULT_BASE_URL}manifest.json`))
        .then(response => {
          if (!response || !response.ok) throw new Error(`HTTP ${response && response.status}`);
          return response.text();
        })
        .then(text => parseManifest(text))
        .catch(() => ({ version: 1, default: null, backgrounds: [] }));
    }
    if (typeof fetch === 'undefined') return Promise.resolve({ version: 1, default: null, backgrounds: [] });
    return fetch(`${DEFAULT_BASE_URL}manifest.json`, { cache: 'no-cache' })
      .then(response => {
        if (!response || !response.ok) throw new Error(`HTTP ${response && response.status}`);
        return response.text();
      })
      .then(text => parseManifest(text))
      .catch(() => ({ version: 1, default: null, backgrounds: [] }));
  }

  function applyManifest(next) {
    manifest = next;
    const stored = readStoredId();
    const valid = next.backgrounds.find(b => b.id === stored);
    currentId = valid ? valid.id : next.default;
  }

  function getManifest() {
    return manifest;
  }

  function getCurrentId() {
    return currentId;
  }

  function setCurrentId(id) {
    let finalId = id;
    if (manifest) {
      const valid = manifest.backgrounds.find(b => b.id === id);
      if (!valid) finalId = manifest.default;
    }
    if (!finalId) return;
    currentId = finalId;
    writeStoredId(finalId);
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.background = finalId;
    }
    subscribers.forEach(fn => {
      try { fn(finalId); } catch (error) { /* 单个订阅者异常不影响其他 */ }
    });
  }

  function getCurrent() {
    if (!manifest) return null;
    const id = getCurrentId();
    if (!id) return null;
    return manifest.backgrounds.find(b => b.id === id) || null;
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function cycleNextId() {
    if (!manifest || manifest.backgrounds.length === 0) return null;
    const current = getCurrentId();
    const idx = manifest.backgrounds.findIndex(b => b.id === current);
    const nextIdx = idx < 0 ? 0 : (idx + 1) % manifest.backgrounds.length;
    const next = manifest.backgrounds[nextIdx];
    setCurrentId(next.id);
    return next.id;
  }

  function resolveBackgroundImageUrl({ baseUrl = DEFAULT_BASE_URL } = {}) {
    const entry = getCurrent();
    if (!entry) return null;
    return baseUrl.replace(/\/$/, '') + '/' + entry.file;
  }

  return {
    STORAGE_KEY,
    DEFAULT_BASE_URL,
    parseManifest,
    loadManifest,
    applyManifest,
    getManifest,
    getCurrentId,
    setCurrentId,
    getCurrent,
    subscribe,
    cycleNextId,
    resolveBackgroundImageUrl
  };
});
