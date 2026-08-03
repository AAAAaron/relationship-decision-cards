const test = require('node:test');
const assert = require('node:assert/strict');

const ENGINE = require('../src/ai-engine.js');

const SAMPLE_PERSON = {
  id: 'li',
  name: '李总',
  role: '分管领导',
  current_state: { mood: '急迫', sensitivity: '延期与责任' },
  communication_preferences: ['先讲结论', '明确推荐加一个备用'],
  facts: ['分管数字政府相关建设', '接受条件化承诺'],
  ai_inferences: ['压力来自考核节点'],
  sensitive_points: ['只讲困难不给方案']
};

const SAMPLE_MATTER = {
  id: 'gov-data',
  name: '数据治理平台',
  main_conflict: '节点与质量底线冲突',
  current_goal: '月底前形成可展示结果',
  facts: ['一期系统已基本验证', '数据迁移质量未完全对齐']
};

const SAMPLE_SCENE = {
  id: 'li-gov-meeting',
  title: '正式会议上要求本周上线',
  quote: '这个项目不能再拖，本周必须上线。还有什么问题？',
  scene_type: 'meeting',
  constraints: ['多人在场', '时间紧', '需当场回应'],
  round_goal: '争取缩小一期范围并锁定责任人',
  confidence: '中高'
};

function makeFakeAi(json) {
  return {
    async chat() {
      return { text: JSON.stringify(json), raw: {} };
    }
  };
}

function makeFakeAiText(text) {
  return {
    async chat() {
      return { text, raw: {} };
    }
  };
}

function makeFailingAi(message) {
  return {
    async chat() {
      throw new Error(message);
    }
  };
}

// === buildSystemPrompt ===

test('buildSystemPrompt: 包含 PRD 协议与角色定位', () => {
  const prompt = ENGINE.buildSystemPrompt();
  assert.match(prompt, /AI 嘴替卡/);
  assert.match(prompt, /scene_assessment/);
  assert.match(prompt, /response_cards/);
  assert.match(prompt, /primary|backup|other|risk/);
  assert.match(prompt, /my_voice|partner|executive|host/);
});

// === buildUserPrompt ===

test('buildUserPrompt: 注入人物 / 事项 / 场景信息', () => {
  const prompt = ENGINE.buildUserPrompt({
    person: SAMPLE_PERSON,
    matter: SAMPLE_MATTER,
    scene: SAMPLE_SCENE
  });
  assert.match(prompt, /李总/);
  assert.match(prompt, /数据治理平台/);
  assert.match(prompt, /这个项目不能再拖/);
  assert.match(prompt, /多人在场/);
  assert.match(prompt, /延迟与责任|延期与责任/);
});

// === parseAiHandPlan ===

test('parseAiHandPlan: 解析合法 AI 输出，生成 hand_plan', () => {
  const aiOutput = {
    scene_assessment: {
      scene_type: 'commitment_decision',
      split_axis: '承诺与目标调整程度',
      coverage_note: '覆盖直接接受 / 条件接受 / 调整范围 / 澄清 / 风险'
    },
    response_cards: [
      {
        route_id: 'conditional_accept',
        rank: 'primary',
        title: '有条件接受',
        suggested_reply: '可以推进，但要锁条件。',
        reason: '兼顾节点与责任',
        style_variants: {
          my_voice: '可以推进，但要锁条件。',
          partner: '建议推进，同时锁定三件事。',
          executive: '可以，条件已锁定。',
          host: '推进没问题，但范围别超。'
        },
        logic: '接受目标，把承诺与条件绑定',
        invalid_when: '条件本身不可行时'
      },
      {
        route_id: 'shrink_scope',
        rank: 'backup',
        title: '缩小范围',
        suggested_reply: '建议先上已验证部门。',
        reason: '当风险不可控时切换',
        switch_condition: '风险不可控',
        style_variants: {
          my_voice: '建议先上已经验证的部门。',
          partner: '建议先完成核心范围。',
          executive: '范围收缩到已验证。',
          host: '先把过的那部分上。'
        },
        logic: '保留时间，缩小范围',
        invalid_when: '必须完整范围才能成立'
      }
    ]
  };
  const plan = ENGINE.parseAiHandPlan(aiOutput);
  assert.equal(plan.axis, '承诺与目标调整程度');
  assert.match(plan.coverage, /覆盖/);
  assert.equal(plan.candidates.length, 2);
  assert.equal(plan.candidates[0].rank, 'primary');
  assert.equal(plan.candidates[0].card_id, 'ai-conditional_accept');
  assert.equal(plan.candidates[0].front.partner, '建议推进，同时锁定三件事。');
  assert.equal(plan.candidates[1].rank, 'backup');
  assert.equal(plan.candidates[1].condition, '风险不可控');
});

test('parseAiHandPlan: 支持 markdown 代码块包裹的 JSON', () => {
  const text = '```json\n' + JSON.stringify({
    scene_assessment: { split_axis: 'A', coverage_note: 'B' },
    response_cards: [{
      route_id: 'x', rank: 'primary', title: 'T', suggested_reply: 'R', reason: 'W',
      style_variants: { my_voice: 'R', partner: 'R', executive: 'R', host: 'R' },
      logic: 'L', invalid_when: 'I'
    }]
  }) + '\n```';
  const plan = ENGINE.parseAiHandPlan(text);
  assert.equal(plan.axis, 'A');
  assert.equal(plan.candidates.length, 1);
});

test('parseAiHandPlan: 拒绝缺少 scene_assessment 的输入', () => {
  assert.throws(() => ENGINE.parseAiHandPlan({ response_cards: [] }), /scene_assessment/);
});

test('parseAiHandPlan: 拒绝 response_cards 为空', () => {
  assert.throws(() => ENGINE.parseAiHandPlan({
    scene_assessment: { split_axis: 'A', coverage_note: 'B' },
    response_cards: []
  }), /response_cards/);
});

test('parseAiHandPlan: 拒绝 rank 不在白名单的牌', () => {
  assert.throws(() => ENGINE.parseAiHandPlan({
    scene_assessment: { split_axis: 'A', coverage_note: 'B' },
    response_cards: [{
      route_id: 'x', rank: 'banana', title: 'T', suggested_reply: 'R', reason: 'W',
      style_variants: { my_voice: 'R', partner: 'R', executive: 'R', host: 'R' },
      logic: 'L', invalid_when: 'I'
    }]
  }), /rank/);
});

test('parseAiHandPlan: 拒绝少 4 种风格的 candidate', () => {
  assert.throws(() => ENGINE.parseAiHandPlan({
    scene_assessment: { split_axis: 'A', coverage_note: 'B' },
    response_cards: [{
      route_id: 'x', rank: 'primary', title: 'T', suggested_reply: 'R', reason: 'W',
      style_variants: { my_voice: 'R', partner: 'R', executive: 'R' },
      logic: 'L', invalid_when: 'I'
    }]
  }), /style_variants/);
});

// === generateHandPlan ===

test('generateHandPlan: 调 AI 客户端拿响应并解析', async () => {
  const fakeAi = makeFakeAi({
    scene_assessment: { split_axis: 'X', coverage_note: 'Y' },
    response_cards: [{
      route_id: 'one', rank: 'primary', title: 'T', suggested_reply: 'R', reason: 'W',
      style_variants: { my_voice: 'r1', partner: 'r2', executive: 'r3', host: 'r4' },
      logic: 'L', invalid_when: 'I'
    }]
  });
  const result = await ENGINE.generateHandPlan({
    person: SAMPLE_PERSON,
    matter: SAMPLE_MATTER,
    scene: SAMPLE_SCENE,
    aiClient: fakeAi
  });
  assert.equal(result.source, 'ai');
  assert.equal(result.plan.candidates.length, 1);
  assert.equal(result.plan.candidates[0].front.partner, 'r2');
});

test('generateHandPlan: AI 抛错时使用 fallback 并标 source=local', async () => {
  const fallback = { axis: '兜底', coverage: 'C', candidates: [] };
  const result = await ENGINE.generateHandPlan({
    person: SAMPLE_PERSON,
    matter: SAMPLE_MATTER,
    scene: SAMPLE_SCENE,
    aiClient: makeFailingAi('502: 网关挂了'),
    fallback
  });
  assert.equal(result.source, 'local');
  assert.equal(result.plan, fallback);
  assert.match(result.reason, /502/);
});

test('generateHandPlan: AI 返回结构不合法时使用 fallback', async () => {
  const fallback = { axis: '兜底', coverage: 'C', candidates: [] };
  const result = await ENGINE.generateHandPlan({
    person: SAMPLE_PERSON,
    matter: SAMPLE_MATTER,
    scene: SAMPLE_SCENE,
    aiClient: makeFakeAiText('not a json'),
    fallback
  });
  assert.equal(result.source, 'local');
  assert.equal(result.plan, fallback);
  assert.match(result.reason, /parse|格式|JSON/);
});

test('generateHandPlan: 未传 aiClient 直接 fallback', async () => {
  const fallback = { axis: '兜底', coverage: 'C', candidates: [] };
  const result = await ENGINE.generateHandPlan({
    person: SAMPLE_PERSON,
    matter: SAMPLE_MATTER,
    scene: SAMPLE_SCENE,
    aiClient: null,
    fallback
  });
  assert.equal(result.source, 'local');
  assert.equal(result.plan, fallback);
  assert.match(result.reason, /未启用|未配置|aiClient/);
});
