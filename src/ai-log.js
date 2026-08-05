(function initAiLog(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipAILog = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAiLogApi() {
  'use strict';

  const MAX_ENTRIES = 20;
  const listeners = new Set();
  const entries = [];

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emit() {
    const copy = entries.slice();
    listeners.forEach(fn => {
      try { fn(copy); } catch (e) { /* swallow */ }
    });
  }

  function record(entry) {
    const e = Object.assign({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString().replace('T', ' ').slice(0, 19),
      kind: 'chat',
      model: '',
      duration: 0,
      source: 'ai',
      promptSummary: '',
      responseSummary: '',
      error: '',
      usage: null
    }, entry);
    entries.unshift(e);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    emit();
    return e;
  }

  function clear() {
    entries.length = 0;
    emit();
  }

  function getAll() {
    return entries.slice();
  }

  return { record, clear, getAll, subscribe, MAX_ENTRIES };
});
