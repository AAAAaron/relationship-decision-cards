const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');

test('牌堆候选复用统一场景卡组件并展示对方头像', () => {
  assert.match(app, /sceneCardHtml\(s,\s*false,\s*['"]deck['"]\)/);
  assert.match(app, /opponent-avatar/);
  assert.doesNotMatch(app, /class="template-scene"/);
});

test('人物和事项详情各自保留，页签均压缩为三个', () => {
  const personSection = app.slice(app.indexOf('function renderPersonDetail'), app.indexOf('function openMatterDetail'));
  const matterSection = app.slice(app.indexOf('function renderMatterDetail'), app.indexOf('function bindDetailTabs'));

  assert.equal((personSection.match(/data-tab=/g) || []).length, 3);
  assert.equal((matterSection.match(/data-tab=/g) || []).length, 3);
  assert.match(personSection, /人物类型/);
  assert.match(matterSection, /当前判断/);
});

test('AI 主推荐牌固定插入手牌视觉中位', () => {
  assert.match(app, /function centerPrimaryCandidate/);
  assert.match(app, /plan\.candidates\s*=\s*centerPrimaryCandidate\(plan\.candidates\)/);
  assert.match(app, /Math\.floor\(candidates\.length\s*\/\s*2\)/);
});

test('首页遵循场景输入、当前交锋、右侧归档的布局语义', () => {
  assert.match(html, /class="[^"]*board-stage[^"]*"/);
  assert.match(html, /class="[^"]*duel-stack[^"]*"/);
  assert.match(html, /id="packSpineButton"/);
  assert.match(html, /class="archive-rail"/);
  assert.doesNotMatch(html, /我方牌堆/);
});

test('主推荐牌具有独立装饰层与粒子光效', () => {
  assert.match(app, /primary-ornament/);
  assert.match(styles, /\.hand-card\.rank-primary \.primary-ornament/);
  assert.match(styles, /@keyframes primarySpark/);
  assert.match(styles, /@keyframes primaryAura/);
});

test('顶部明确展示人物类型和可切换项目数量', () => {
  assert.match(html, /id="heroType"/);
  assert.match(html, /id="matterCount"/);
  assert.match(app, /relationshipTypeName\(p\.relationship_type\)/);
  assert.match(app, /matterIdsForPerson\(p\.id\)\.length/);
});

test('场景牌、手牌和收藏牌共享同一套正面信息层级', () => {
  assert.ok((app.match(/card-identity/g) || []).length >= 3);
  assert.ok((app.match(/card-core/g) || []).length >= 3);
  assert.ok((app.match(/card-insight/g) || []).length >= 3);
  assert.match(styles, /\.card-identity/);
  assert.match(styles, /\.card-core/);
  assert.match(styles, /\.card-insight/);
});

test('上一轮叠在当前牌后方，点击露出的旧牌放大查看', () => {
  assert.doesNotMatch(html, /id="previousRoundToggle"/);
  assert.match(html, /class="[^"]*previous-opponent-stack[^"]*"/);
  assert.match(html, /class="[^"]*previous-player-stack[^"]*"/);
  assert.match(html, /id="previousCardModal"/);
  assert.match(app, /data-previous-card/);
  assert.match(app, /openPreviousCard/);
  assert.doesNotMatch(app, /previousExpanded/);
  assert.match(styles, /\.previous-opponent-stack/);
  assert.match(styles, /\.previous-player-stack/);
  assert.match(styles, /\.duel-stack>\.current-slot\s*\{[^}]*z-index:4/s);
});

test('翻面后只有可见卡面响应点击，可再次转回正面', () => {
  assert.match(styles, /\[data-flippable-card\] \.card-face:not\(\.card-back\)/);
  assert.match(styles, /\[data-flippable-card\]\.is-flipped \.card-back/);
  assert.match(app, /classList\.toggle\('is-flipped'\)/);
});

test('卡包仅保留搜索，并使用与手牌同尺寸的统一收藏卡', () => {
  assert.doesNotMatch(html, /id="packFilters"/);
  assert.match(app, /pack-card/);
  assert.match(app, /pack-card-core/);
  assert.doesNotMatch(app, /data-pack-person/);
  assert.match(styles, /\.pack-grid \.pack-card/);
  assert.match(styles, /width:220px/);
});

test('移动端牌桌随内容收缩，手牌横向排列且文字不重叠', () => {
  assert.match(styles, /\/\* ===== 移动端可读性收口 ===== \*\//);
  assert.match(styles, /\.battlefield\.board-stage\s*\{[^}]*min-height:auto/s);
  assert.match(styles, /\.hand-viewport\s*\{[^}]*overflow-x:auto/s);
  assert.match(styles, /\.hand-fan\s*\{[^}]*display:flex/s);
  assert.match(styles, /\.hand-card\s*\{[^}]*position:relative!important/s);
  assert.match(styles, /\.current-row \.card-core blockquote\s*\{[^}]*font-size:8px/s);
  assert.match(app, /handViewport\.scrollLeft\s*=\s*Math\.max\(0,/);
});

test('移动端把小号横滑手牌放在卡包之前，卡包整行置底', () => {
  assert.match(styles, /\.board-zone\s*\{[^}]*display:contents/s);
  assert.match(styles, /\.hand-zone\s*\{[^}]*order:2/s);
  assert.match(styles, /\.archive-rail\s*\{[^}]*order:3/s);
  assert.match(styles, /\.hand-header\s*\{[^}]*display:none/s);
  assert.match(styles, /\.hand-card\s*\{[^}]*width:116px[^}]*height:154px/s);
  assert.match(styles, /\.archive-rail\s*\{[^}]*min-height:48px/s);
});

test('移动端对方出牌嵌入当前轮左上角，顶部上下文只突出人物和项目名', () => {
  assert.match(styles, /\.opponent-action-zone\s*\{[^}]*position:absolute/s);
  assert.match(styles, /\.opponent-action-button\s*\{[^}]*width:auto[^}]*min-height:28px/s);
  assert.match(styles, /\.opponent-action-button small\s*\{[^}]*display:none/s);
  assert.match(styles, /\.board-head span:first-child\s*\{[^}]*visibility:hidden/s);
  assert.match(styles, /\.hero-copy \.context-kicker,[^}]*#heroType,[^}]*#heroMeta,[^}]*#matterMeta,[^}]*\.matter-count\s*\{[^}]*display:none/s);
  assert.match(styles, /\.current-context \.round-icon\s*\{[^}]*width:26px[^}]*height:26px/s);
});

test('桌面端对方出牌使用卡背式入口，手牌只保留牌面不显示外框', () => {
  assert.match(styles, /\/\* V0\.9 桌面卡背入口与无框手牌 \*\//);
  assert.match(styles, /\.opponent-action-button::before\s*\{[^}]*content:""/s);
  assert.match(styles, /\.opponent-action-button::after\s*\{[^}]*content:"♠"/s);
  assert.match(styles, /\.hand-zone\s*\{[^}]*border:0[^}]*background:transparent[^}]*box-shadow:none/s);
  assert.match(styles, /\.hand-zone::before\s*\{[^}]*display:none/s);
});

test('首页使用无框沉浸式牌桌，仅让卡牌和交互入口浮在桌面上', () => {
  assert.match(styles, /\/\* V0\.9 无框沉浸式牌桌 \*\//);
  assert.match(styles, /\.app-shell\s*\{[^}]*border:0[^}]*background:transparent[^}]*box-shadow:none/s);
  assert.match(styles, /\.opponent-action-zone,\s*\.battlefield\.board-stage,\s*\.archive-rail\s*\{[^}]*border:0[^}]*background:transparent[^}]*box-shadow:none/s);
  assert.match(styles, /\.battlefield\.board-stage::before,\s*\.archive-rail::before\s*\{[^}]*display:none/s);
});

test('移动端牌宽和牌高随视口自适应，卡包进一步压薄', () => {
  assert.match(styles, /\.current-row \.dialog-card\.current,[^}]*\.current-row \.empty-slot\s*\{[^}]*width:clamp\([^}]*aspect-ratio:7\/10[^}]*height:auto/s);
  assert.match(styles, /\.hand-card\s*\{[^}]*width:clamp\([^}]*aspect-ratio:3\/4[^}]*height:auto/s);
  assert.match(styles, /\.archive-rail\s*\{[^}]*min-height:40px/s);
  assert.match(styles, /\.pack-spine\s*\{[^}]*min-height:32px/s);
});

test('首页把对方出牌压缩为按钮，当前轮两张牌均可放大', () => {
  assert.match(html, /class="opponent-action-button"/);
  assert.doesNotMatch(html, /class="deck-stack opponent-stack"/);
  assert.match(app, /openCurrentCard\('opponent'\)/);
  assert.match(app, /openCurrentCard\('player'\)/);
  assert.match(styles, /#currentOpponentSlot \.dialog-card/);
});

test('人物和项目支持人工编辑，项目阶段使用下拉并管理多对多人员', () => {
  assert.match(app, /id="personEditForm"/);
  assert.match(app, /id="matterEditForm"/);
  assert.match(app, /name="stage_id"/);
  assert.match(app, /data-link-person/);
  assert.match(app, /upsertPersonMatterLink/);
  assert.match(app, /otherMatterIds\.length/);
});

test('提供 OpenAI 兼容 AI 配置、连接测试和密钥保存选择', () => {
  assert.match(html, /id="aiModal"/);
  assert.match(html, /id="aiBaseUrl"/);
  assert.match(html, /id="aiRememberKey"/);
  assert.match(app, /testAiConnection/);
  assert.match(app, /createOpenAICompatibleClient/);
});
