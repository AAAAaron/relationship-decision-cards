(function initStorage(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function createStorageApi() {
  'use strict';

  const STORAGE_VERSION = 2;
  const STORAGE_KEY = 'relationship-decision-cards:v2';
  const LEGACY_STORAGE_KEY = 'relationship-decision-cards:v1';
  const STATE_FIELDS = ['currentPersonId', 'currentMatterByPerson', 'sessions', 'pack', 'aiConfig'];

  const clone = value => JSON.parse(JSON.stringify(value));

  function createSnapshot(state, data, options = {}) {
    const storedState = {};
    STATE_FIELDS.forEach(field => {
      if (state[field] !== undefined) storedState[field] = clone(state[field]);
    });
    if (storedState.aiConfig && (!options.includeSecrets || !storedState.aiConfig.rememberKey)) delete storedState.aiConfig.apiKey;
    return {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      state: storedState,
      data: {
        people: clone(data.people || []),
        matters: clone(data.matters || []),
        person_matter_links: clone(data.person_matter_links || [])
      }
    };
  }

  function migrateSnapshot(source) {
    const snapshot = clone(source);
    if (snapshot.version === STORAGE_VERSION) return snapshot;
    if (snapshot.version !== 1) throw new Error(`不支持的状态文件版本：${snapshot.version ?? '未知'}。`);
    const links = new Map();
    (snapshot.data?.people || []).forEach(person => {
      (person.related_matter_ids || []).forEach(matterId => {
        links.set(`${person.id}:${matterId}`, {
          person_id: person.id,
          matter_id: matterId,
          role: '相关人员'
        });
      });
    });
    (snapshot.data?.matters || []).forEach(matter => {
      if (!matter.person_id) return;
      const key = `${matter.person_id}:${matter.id}`;
      if (!links.has(key)) links.set(key, {
        person_id: matter.person_id,
        matter_id: matter.id,
        role: '相关人员'
      });
    });
    snapshot.version = STORAGE_VERSION;
    snapshot.data ||= {};
    snapshot.data.person_matter_links = [...links.values()];
    snapshot.state ||= {};
    snapshot.state.aiConfig ||= {
      baseUrl: 'https://api.openai.com/v1',
      model: '',
      rememberKey: false,
      enabled: false
    };
    return snapshot;
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('状态文件必须是 JSON 对象。');
    if (snapshot.version !== STORAGE_VERSION) throw new Error(`不支持的状态文件版本：${snapshot.version ?? '未知'}。`);
    if (!snapshot.state || typeof snapshot.state !== 'object') throw new Error('状态文件缺少有效状态。');
    if (!Array.isArray(snapshot.data?.people) || snapshot.data.people.length === 0) throw new Error('状态文件缺少人物数据。');
    if (!Array.isArray(snapshot.data?.matters) || snapshot.data.matters.length === 0) throw new Error('状态文件缺少事项数据。');
    if (!Array.isArray(snapshot.data?.person_matter_links)) throw new Error('状态文件缺少人物事项关联数据。');
    if (typeof snapshot.state.currentPersonId !== 'string') throw new Error('状态文件缺少当前人物状态。');
    if (!snapshot.state.currentMatterByPerson || typeof snapshot.state.currentMatterByPerson !== 'object') throw new Error('状态文件缺少人物事项状态。');
    if (!snapshot.state.sessions || typeof snapshot.state.sessions !== 'object') throw new Error('状态文件缺少会话状态。');
    if (!Array.isArray(snapshot.state.pack)) throw new Error('状态文件缺少卡包状态。');
    return snapshot;
  }

  function parseSnapshot(text) {
    let snapshot;
    try {
      snapshot = JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON 解析失败：${error.message}`);
    }
    return clone(validateSnapshot(migrateSnapshot(snapshot)));
  }

  function saveSnapshot(storage, state, data) {
    const snapshot = createSnapshot(state, data, { includeSecrets: true });
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  }

  function loadSnapshot(storage) {
    const raw = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    try {
      return parseSnapshot(raw);
    } catch {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  return {
    STORAGE_KEY,
    STORAGE_VERSION,
    createSnapshot,
    loadSnapshot,
    parseSnapshot,
    saveSnapshot,
    validateSnapshot,
    migrateSnapshot
  };
});
