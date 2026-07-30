const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSnapshot,
  parseSnapshot,
  STORAGE_VERSION,
  migrateSnapshot
} = require('../src/storage.js');

test('createSnapshot 只保存业务状态，不保存弹窗和手牌焦点等临时状态', () => {
  const snapshot = createSnapshot({
    currentPersonId: 'li',
    currentMatterByPerson: { li: 'gov-data' },
    sessions: { 'li:gov-data': { turn: 2 } },
    pack: [{ id: 'round-1', saved: true }],
    handFocus: 3,
    selectedCardId: 'accept',
    packSearch: '测试'
  }, {
    people: [{ id: 'li', facts: ['事实'] }],
    matters: [{ id: 'gov-data', facts: ['事项事实'] }]
  });

  assert.equal(snapshot.version, STORAGE_VERSION);
  assert.deepEqual(snapshot.state.currentMatterByPerson, { li: 'gov-data' });
  assert.equal(snapshot.state.handFocus, undefined);
  assert.equal(snapshot.state.selectedCardId, undefined);
  assert.equal(snapshot.state.packSearch, undefined);
  assert.deepEqual(snapshot.data.people[0].facts, ['事实']);
});

test('parseSnapshot 接受合法导出文件并返回隔离副本', () => {
  const source = createSnapshot({
    currentPersonId: 'li',
    currentMatterByPerson: { li: 'gov-data' },
    sessions: {},
    pack: []
  }, {
    people: [{ id: 'li' }],
    matters: [{ id: 'gov-data', person_id: 'li' }]
  });
  const parsed = parseSnapshot(JSON.stringify(source));

  assert.deepEqual(parsed, source);
  parsed.data.people[0].id = 'changed';
  assert.equal(source.data.people[0].id, 'li');
});

test('parseSnapshot 拒绝错误 JSON、未知版本和缺失核心字段', () => {
  assert.throws(() => parseSnapshot('{'), /JSON/);
  assert.throws(() => parseSnapshot(JSON.stringify({ version: 999 })), /版本/);
  assert.throws(() => parseSnapshot(JSON.stringify({
    version: STORAGE_VERSION,
    state: {},
    data: {}
  })), /人物|事项|状态/);
});

test('V2 文件保存人物项目关联与 AI 非敏感配置', () => {
  const snapshot = createSnapshot({
    currentPersonId: 'li',
    currentMatterByPerson: { li: 'gov-data' },
    sessions: {},
    pack: [],
    aiConfig: { baseUrl: 'https://api.openai.com/v1', model: 'demo', apiKey: 'secret', rememberKey: false }
  }, {
    people: [{ id: 'li' }],
    matters: [{ id: 'gov-data' }],
    person_matter_links: [{ person_id: 'li', matter_id: 'gov-data', role: '决策人' }]
  });

  assert.equal(STORAGE_VERSION, 2);
  assert.deepEqual(snapshot.data.person_matter_links, [{ person_id: 'li', matter_id: 'gov-data', role: '决策人' }]);
  assert.equal(snapshot.state.aiConfig.apiKey, undefined);
  assert.equal(snapshot.state.aiConfig.model, 'demo');
});

test('V1 文件可自动迁移为 V2 多对多结构', () => {
  const migrated = migrateSnapshot({
    version: 1,
    state: {
      currentPersonId: 'li',
      currentMatterByPerson: { li: 'gov-data' },
      sessions: {},
      pack: []
    },
    data: {
      people: [{ id: 'li', related_matter_ids: ['gov-data'] }],
      matters: [{ id: 'gov-data', person_id: 'li' }]
    }
  });

  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.data.person_matter_links, [
    { person_id: 'li', matter_id: 'gov-data', role: '相关人员' }
  ]);
});
