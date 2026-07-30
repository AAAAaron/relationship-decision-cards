const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeData,
  linkedMatterIds,
  linkedPersonIds,
  upsertPersonMatterLink,
  removePersonMatterLink
} = require('../src/data-model.js');

test('normalizeData 把旧人物和项目单向字段迁移为去重的多对多关联', () => {
  const data = normalizeData({
    people: [
      { id: 'p1', related_matter_ids: ['m1', 'm2'] },
      { id: 'p2', related_matter_ids: ['m1'] }
    ],
    matters: [
      { id: 'm1', person_id: 'p1', participants: [{ name: '甲', role: '决策' }] },
      { id: 'm2', person_id: 'p1' }
    ]
  });

  assert.deepEqual(linkedMatterIds(data, 'p1'), ['m1', 'm2']);
  assert.deepEqual(linkedPersonIds(data, 'm1'), ['p1', 'p2']);
  assert.equal(data.person_matter_links.length, 3);
});

test('多对多关联支持新增角色、修改角色和解除关系', () => {
  const data = normalizeData({
    people: [{ id: 'p1' }, { id: 'p2' }],
    matters: [{ id: 'm1' }]
  });

  upsertPersonMatterLink(data, 'p1', 'm1', '决策人');
  upsertPersonMatterLink(data, 'p2', 'm1', '协作方');
  upsertPersonMatterLink(data, 'p2', 'm1', '执行人');
  assert.equal(data.person_matter_links.find(link => link.person_id === 'p2').role, '执行人');

  removePersonMatterLink(data, 'p1', 'm1');
  assert.deepEqual(linkedPersonIds(data, 'm1'), ['p2']);
});
