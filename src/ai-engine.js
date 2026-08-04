(function initAiEngine(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipAiEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAiEngineApi() {
  'use strict';

  const VALID_RANKS = ['primary', 'backup', 'other', 'risk'];
  const REQUIRED_STYLES = ['my_voice', 'partner', 'executive', 'host'];
  const SYSTEM_PROMPT = [
    '你是关系决策牌组的发牌助手，帮助用户在一段沟通场景里从 3-5 个并列解法中选一个最合适的回应。',
    '',
    '## 角色',
    '- 输入：当前人物画像、当前事项背景、对方刚提出的场景（含原话与约束）。',
    '- 输出：必须严格按下面的 JSON 协议作答，单一 JSON，不要夹杂解释。',
    '',
    '## 切分维度（MECE）',
    '先选定一个统一的切分轴（比如"承诺与目标调整程度"、"当场可说 vs 需会后补充"、"风险披露程度"、"先共情还是先方案"、"请求支持的时机"）。',
    '同一回合的所有牌必须沿同一轴展开；切勿混入表达风格、后续动作或沟通渠道。',
    '',
    '## 推荐身份',
    '一个回合最多 1 张 primary（AI 主推荐）+ 1 张 backup（条件备选）+ 1-3 张 other（其他可行）或 risk（AI 不推荐）。',
    'rank 必须是下面之一：primary | backup | other | risk。',
    '',
    '## 风格变体（每张牌都要给 4 种风格的最终话术）',
    '- my_voice：保留用户口吻，只增强清晰度。',
    '- partner：咨询合伙人，结论先行 + 依据 + 下一步。',
    '- executive：冷静负责人，坚定克制、明确条件。',
    '- host：机智主持人，轻松但不离目标。',
    '4 种风格要说同一件事的核心，但语气、节奏、强调点必须不同。',
    '',
    '## 输出 JSON 协议（严格遵守）',
    '{',
    '  "scene_assessment": { "scene_type": "<短标签>", "split_axis": "<一句话描述切分轴>", "coverage_note": "<一句话说明覆盖范围>" },',
    '  "response_cards": [',
    '    {',
    '      "route_id": "<kebab-case 路由 id>",',
    '      "rank": "primary|backup|other|risk",',
    '      "title": "<8-14 字路线名>",',
    '      "suggested_reply": "<用户原声版默认话术>",',
    '      "reason": "<为什么这张牌是这个 rank，单句>",',
    '      "switch_condition": "<backup 触发条件，可省略>",',
    '      "logic": "<解法逻辑，1 句>",',
    '      "invalid_when": "<不适用场景，1 句>",',
    '      "style_variants": { "my_voice": "...", "partner": "...", "executive": "...", "host": "..." }',
    '    }',
    '  ]',
    '}',
    '',
    '## 重要约束',
    '1. 一次只输出一个 JSON，不要任何前言、不要解释。',
    '2. 候选数 3-5 张；candidate 太少或缺字段会被视为不合法。',
    '3. 所有中文不要夹杂英文引号；中文双引号 「」『』和 ASCII 直引号都可接受。',
    '4. 切勿编造对方没说过的原话；建议里的事实必须基于输入。',
    '5. 当人物敏感点触发时（如延期、责任、情绪），把边界 / 底线 / 风险显式写进 logic 或 invalid_when。'
  ].join('\n');

  function buildSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  function safeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  function buildFactsBlock(label, items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    const lines = items.map(item => `  - ${safeText(item)}`).join('\n');
    return `${label}\n${lines}\n`;
  }

  function buildUserPrompt(input) {
    const person = input?.person || {};
    const matter = input?.matter || {};
    const scene = input?.scene || {};
    const history = Array.isArray(input?.history) ? input.history : [];

    const personState = person.current_state || {};
    const sections = [];

    sections.push('# 当前人物');
    sections.push(`- 姓名：${safeText(person.name, '未知')}`);
    sections.push(`- 角色：${safeText(person.role, '未注明')}`);
    sections.push(`- 当前情绪：${safeText(personState.mood, '未注明')}`);
    sections.push(`- 沟通窗口：${safeText(personState.communication_window, '未注明')}`);
    sections.push(`- 敏感点：${safeText(personState.sensitivity, '未注明')}`);
    sections.push(buildFactsBlock('已知事实：', person.facts));
    sections.push(buildFactsBlock('AI 推断（仅作参考）：', person.ai_inferences));
    sections.push(buildFactsBlock('沟通偏好：', person.communication_preferences));
    sections.push(buildFactsBlock('敏感话题：', person.sensitive_points));

    sections.push('\n# 当前事项');
    sections.push(`- 名称：${safeText(matter.name, '未注明')}`);
    sections.push(`- 主要矛盾：${safeText(matter.main_conflict, '未注明')}`);
    sections.push(`- 当前目标：${safeText(matter.current_goal, '未注明')}`);
    sections.push(buildFactsBlock('事项事实：', matter.facts));

    sections.push('\n# 对方当前场景');
    sections.push(`- 标题：${safeText(scene.title, '未注明')}`);
    sections.push(`- 原话：${safeText(scene.quote, '（未提供原话）')}`);
    sections.push(`- 场景类型：${safeText(scene.scene_type, '未注明')}`);
    sections.push(`- 约束：${Array.isArray(scene.constraints) && scene.constraints.length ? scene.constraints.map(safeText).join('、') : '无'}`);
    sections.push(`- 本回合目标：${safeText(scene.round_goal, '未注明')}`);
    sections.push(`- 信心：${safeText(scene.confidence, '中')}`);

    if (history.length) {
      sections.push('\n# 历史上下文（仅参考最近 2 条）');
      history.slice(-2).forEach((item, index) => {
        sections.push(`- 上轮 ${index + 1}：${safeText(item.title || '')} — ${safeText(item.outcome || '')}`);
      });
    }

    sections.push('\n请按系统提示中的 JSON 协议返回手牌。');
    return sections.join('\n');
  }

  function stripCodeFence(text) {
    if (typeof text !== 'string') return text;
    let trimmed = text.trim();
    // 去除 thinking 标签 (支持 多种模型: <think>...</think>, <thinking>...</thinking>, 《think》...《/think》)
    for (let i = 0; i < 3; i++) {
      const before = trimmed;
      trimmed = trimmed.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>|〈think〉[\s\S]*?〈\/think〉/g, '').trim();
      if (trimmed === before) break;
    }
    const fence = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/);
    return fence ? fence[1] : trimmed;
  }

  function safeParse(text) {
    if (typeof text === 'object' && text !== null) return text;
    const cleaned = stripCodeFence(text);
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      throw new Error(`AI 响应格式无法解析（${error.message.slice(0, 80)}）。`);
    }
  }

  function validateCard(card, index) {
    if (!card || typeof card !== 'object') throw new Error(`response_cards[${index}] 不是对象。`);
    if (!card.route_id || typeof card.route_id !== 'string') throw new Error(`response_cards[${index}].route_id 缺失。`);
    if (!VALID_RANKS.includes(card.rank)) throw new Error(`response_cards[${index}].rank 必须是 ${VALID_RANKS.join('/')} 之一。`);
    if (!card.title) throw new Error(`response_cards[${index}].title 缺失。`);
    if (!card.suggested_reply) throw new Error(`response_cards[${index}].suggested_reply 缺失。`);
    if (!card.reason) throw new Error(`response_cards[${index}].reason 缺失。`);
    const variants = card.style_variants;
    if (!variants || typeof variants !== 'object') throw new Error(`response_cards[${index}].style_variants 缺失。`);
    for (const style of REQUIRED_STYLES) {
      if (!variants[style]) throw new Error(`response_cards[${index}].style_variants.${style} 缺失。`);
    }
  }

  function toHandPlan(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('AI 响应不是对象。');
    const assessment = payload.scene_assessment;
    if (!assessment || typeof assessment !== 'object') throw new Error('AI 响应缺少 scene_assessment。');
    if (!Array.isArray(payload.response_cards) || payload.response_cards.length === 0) {
      throw new Error('AI 响应缺少 response_cards。');
    }
    payload.response_cards.forEach(validateCard);
    return {
      axis: safeText(assessment.split_axis, '按一个统一维度展开'),
      coverage: safeText(assessment.coverage_note, ''),
      candidates: payload.response_cards.map(card => ({
        card_id: `ai-${card.route_id}`,
        title: safeText(card.title, card.route_id),
        rank: card.rank,
        reason: safeText(card.reason),
        condition: card.switch_condition ? safeText(card.switch_condition) : undefined,
        front: {
          my_voice: safeText(card.style_variants.my_voice, card.suggested_reply),
          partner: safeText(card.style_variants.partner, card.suggested_reply),
          executive: safeText(card.style_variants.executive, card.suggested_reply),
          host: safeText(card.style_variants.host, card.suggested_reply)
        },
        back: {
          logic: safeText(card.logic, ''),
          why: safeText(card.reason, ''),
          invalid: safeText(card.invalid_when, ''),
          source: 'AI 生成 · 待验证'
        }
      }))
    };
  }

  function parseAiHandPlan(payload) {
    return toHandPlan(safeParse(payload));
  }

  async function generateHandPlan(input) {
    const fallback = input?.fallback || { axis: '本地规则兜底', coverage: '', candidates: [] };
    const aiClient = input?.aiClient;
    if (!aiClient) {
      return { source: 'local', plan: fallback, reason: 'AI 客户端未启用，已使用本地规则。' };
    }
    try {
      const messages = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(input) }
      ];
      const text = await callAiChat(aiClient, messages);
      const plan = parseAiHandPlan(text);
      return { source: 'ai', plan, reason: '' };
    } catch (error) {
      return { source: 'local', plan: fallback, reason: `AI 调用失败：${error.message}` };
    }
  }

  async function callAiChat(aiClient, messages) {
    if (typeof aiClient.chat === 'function') {
      const result = await aiClient.chat(messages, {
        temperature: 0.6,
        // M3 支持 thinking:disabled 跳过思考段；M2.x 不支持但会被服务端忽略,
        // 这里仍依赖 stripCodeFence 兜底清洗, 兼容两个模型家族。
        thinking: { type: 'disabled' }
      });
      if (result && typeof result.text === 'string') return result.text;
      if (typeof result === 'string') return result;
      throw new Error('AI 客户端返回缺少 text 字段。');
    }
    throw new Error('AI 客户端不支持 chat()。');
  }

  async function quickAnalysis(input) {
    const fallback = input?.fallback || '';
    const aiClient = input?.aiClient;
    if (!aiClient) return { source: 'local', text: fallback, reason: 'AI 客户端未启用。' };
    try {
      const messages = [
        { role: 'system', content: input.systemPrompt || '你是关系决策牌组的人物/事项分析助手。' },
        { role: 'user', content: input.userPrompt || '' }
      ];
      const result = await aiClient.chat(messages, {
        temperature: 0.5,
        thinking: { type: 'disabled' }
      });
      const text = typeof result === 'string' ? result : (result?.text || '');
      const cleaned = String(text).trim();
      if (!cleaned) throw new Error('AI 返回空内容。');
      return { source: 'ai', text: cleaned, reason: '' };
    } catch (error) {
      return { source: 'local', text: fallback, reason: `AI 调用失败：${error.message}` };
    }
  }

  return {
    buildSystemPrompt,
    buildUserPrompt,
    parseAiHandPlan,
    generateHandPlan,
    quickAnalysis,
    VALID_RANKS,
    REQUIRED_STYLES
  };
});
