const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src', 'table3d', 'index.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'src', 'table3d-bootstrap.js'), 'utf8');

test('牌堆候选复用统一场景卡组件并展示对方头像', () => {
  assert.match(app, /sceneCardHtml\(s,\s*false,\s*['"]deck['"]\)/);
  assert.match(app, /opponent-avatar/);
  assert.doesNotMatch(app, /class="template-scene"/);
});

test('AI 主推荐牌固定插入手牌视觉中位', () => {
  assert.match(app, /function centerPrimaryCandidate/);
  assert.match(app, /plan\.candidates\s*=\s*centerPrimaryCandidate\(plan\.candidates\)/);
  assert.match(app, /Math\.floor\(candidates\.length\s*\/\s*2\)/);
});

test('3D 牌桌: 页面挂载 canvas + HUD, 不再有 DOM 牌桌布局', () => {
  assert.match(html, /id="table3dCanvas"/);
  assert.match(html, /id="playHud"/);
  assert.match(html, /id="cardDetail"/);
  assert.match(html, /id="roundControls"/);
  assert.doesNotMatch(html, /class="[^"]*game-table[^"]*"/);
  assert.doesNotMatch(html, /id="handFan"/);
  assert.doesNotMatch(html, /hero-tagline/);
});

test('3D 桥: app.js 通过 sync 同步状态, 交互经事件回环', () => {
  assert.match(app, /function syncTable/);
  assert.match(app, /function table3dActive/);
  assert.match(app, /handSpecs\(\)/);
  assert.match(bridge, /createTable3dBridge/);
  assert.match(bridge, /playSelectedHand/);
  assert.match(bootstrap, /table3d:ready/);
  assert.match(app, /table3d:hand-select/);
  assert.match(app, /table3d:board-click/);
});

test('出牌走内联确认条而非全屏弹窗', () => {
  assert.match(app, /function confirmPlayHud/);
  assert.match(app, /function openPlayHud/);
  assert.match(app, /playSelectedHand\(\)/);
  assert.match(styles, /\.play-hud-inner/);
  assert.match(styles, /\.style-chip\.active/);
});

test('战场牌详情为右侧滑入面板, 信息一页排干净', () => {
  assert.match(app, /function showCardDetail/);
  assert.match(app, /card-detail-list/);
  assert.match(styles, /\.card-detail\s*\{[^}]*position:fixed/s);
  assert.match(styles, /@keyframes detailIn/);
});

test('顶部明确展示人物类型和可切换项目数量', () => {
  assert.match(html, /id="heroType"/);
  assert.match(html, /id="matterCount"/);
  assert.match(app, /relationshipTypeName\(p\.relationship_type\)/);
  assert.match(app, /matterIdsForPerson\(p\.id\)\.length/);
});

test('桌面氛围: 符文圈/金尘/聚光由场景模块提供', () => {
  const scene = fs.readFileSync(path.join(root, 'src', 'table3d', 'scene3d.js'), 'utf8');
  assert.match(scene, /buildRuneCircle/);
  assert.match(scene, /buildDust/);
  assert.match(scene, /SpotLight/);
});

test('卡包与回合历史入口保留在桌边栏', () => {
  assert.match(html, /id="packSpineButton"/);
  assert.match(html, /id="archiveHistoryButton"/);
  assert.match(app, /pack-card/);
  assert.match(app, /pack-card-core/);
});

test('无 WebGL / 初始化失败时标记降级模式', () => {
  assert.match(bootstrap, /table3d-unavailable/);
});
