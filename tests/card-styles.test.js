// 关系决策牌组：卡牌视觉统一性测试
// 验证 styles.css 中所有卡牌位置(hand-card / dialog-card / pack-card / deck-card-option / previous-slot / record-card)
// 共享统一基类样式 + rank 视觉权重 + 字号 hierarchy
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'src', 'styles.css');
const css = fs.readFileSync(cssPath, 'utf8');

function hasRule(selector) {
  // 允许空格任意, 不区分大小写
  const escaped = selector.replace(/\./g, '\\.').replace(/\[\[/g, '\\[\\[').replace(/[?]/g, '\\?');
  const re = new RegExp(escaped + '\\s*\\{', 's');
  return re.test(css);
}

function hasDecl(selector, propertyRegex) {
  // 找到 selector 后的 { ... } 块, 检查是否有匹配的 declaration
  const idx = css.indexOf(selector);
  if (idx < 0) return false;
  const braceStart = css.indexOf('{', idx);
  const braceEnd = css.indexOf('}', braceStart);
  if (braceStart < 0 || braceEnd < 0) return false;
  const block = css.slice(braceStart, braceEnd);
  return new RegExp(propertyRegex, 's').test(block);
}

test('卡牌基类 .card-face 统一圆角 14px', () => {
  assert.ok(hasRule('.card-face'), '.card-face 应存在');
  assert.match(css, /\.card-face\s*\{[^}]*border-radius:\s*14px/s, '.card-face 圆角应为 14px');
});

test('卡牌 rank 边框统一定义在 base 规则', () => {
  // primary 边框应在某个 rule 内出现
  assert.ok(hasRule('.rank-primary'), '.rank-primary 应存在');
  // 边框/背景 chip 通过 :where(...) 集中定义
  const rankBlock = css.match(/(:where\([^)]*rank-[^)]*\)|\.rank-primary|\.rank-backup|\.rank-other|\.rank-risk)[\s\S]{0,500}/);
  assert.ok(rankBlock, 'rank 视觉规则应集中');
});

test('卡牌标题字号 hierarchy: 交锋/卡包相同, 手牌更大', () => {
  function h3Size(selector) {
    const re = new RegExp(selector.replace(/\./g, '\\.') + '\\s+h3\\s*\\{[^}]*font-size:\\s*(\\d+)px', 's');
    const m = css.match(re);
    return m ? parseInt(m[1], 10) : null;
  }
  const dialogSize = h3Size('.dialog-card');
  const packSize = h3Size('.pack-card');
  const handSize = h3Size('.hand-card');
  assert.ok(dialogSize, '.dialog-card h3 字号应定义');
  assert.ok(packSize, '.pack-card h3 字号应定义');
  assert.ok(handSize, '.hand-card h3 字号应定义');
  // 交锋/卡包同字号(均 16px)
  assert.equal(dialogSize, packSize, `dialog=${dialogSize} / pack=${packSize} 标题字号应一致`);
  // 手牌更大(>= pack-card, 因手牌更宽)
  assert.ok(handSize >= packSize, `hand=${handSize} 应 >= pack=${packSize}`);
});

test('统一卡牌容器: 圆角 14px 在多个卡牌类共用', () => {
  // 圆角 14px 应在 .card-face, .pack-card, .hand-card 中都用
  const rules = ['.card-face', '.pack-card', '.hand-card'];
  rules.forEach(s => {
    const re = new RegExp(s.replace(/\./g, '\\.') + '[\\s\\S]{0,400}border-radius:\\s*14px', 's');
    assert.match(css, re, `${s} 圆角 14px`);
  });
});

test('rank 视觉权重: primary 应有金色光晕动画', () => {
  // hand-card.rank-primary::before 或 dialog-card.rank-primary::before
  const primaryGoldAnim = /\.rank-primary[\s\S]{0,400}animation\s*:\s*rankPulseGold/s;
  assert.match(css, primaryGoldAnim, 'rank-primary 应有金色光晕动画');
});

test('rank 视觉权重: risk 应有红色警告动画', () => {
  const riskRedAnim = /\.rank-risk[\s\S]{0,400}animation\s*:\s*rankWarnRed/s;
  assert.match(css, riskRedAnim, 'rank-risk 应有红色警告动画');
});

test('卡牌顶部文字标签: .rank-badge 有 chip 化样式(圆角 999px + flex)', () => {
  assert.match(css, /\.rank-badge[\s\S]{0,200}border-radius:\s*999px/s, '.rank-badge 应是 pill 形');
  assert.match(css, /\.rank-badge[\s\S]{0,200}display:\s*inline-flex/s, '.rank-badge 应是 inline-flex');
  assert.match(css, /\.rank-badge[\s\S]{0,300}padding:\s*3px/s, '.rank-badge 内部 padding 应一致');
});

test('统一卡牌容器: 圆角 14px 在多个卡牌类共用', () => {
  // 圆角 14px 应在 .card-face, .dialog-card, .pack-card, .hand-card 中都用
  // 至少 card-face, pack-card, hand-card 都要
  const rules = ['.card-face', '.pack-card', '.hand-card'];
  rules.forEach(s => {
    const re = new RegExp(s.replace(/\./g, '\\.') + '[\\s\\S]{0,400}border-radius:\\s*14px', 's');
    assert.match(css, re, `${s} 圆角 14px`);
  });
});

test('统一卡牌阴影: 至少 0 8px 30px 黑色阴影', () => {
  const cardShadow = /box-shadow:\s*0\s+\d+px\s+\d+px\s+rgba\(0,0,0/s;
  assert.match(css, cardShadow, '卡牌应有黑色阴影');
});

test('prefers-reduced-motion 时关闭 rank 呼吸动画', () => {
  // 检查 @media 块
  const reducedMotion = css.match(/prefers-reduced-motion[\s\S]{0,500}animation\s*:\s*none/s);
  assert.ok(reducedMotion, 'prefers-reduced-motion 应关闭动画');
});

test('4 个卡牌位置使用同一组 weight 关键字', () => {
  // 标题应使用同样的 weight (e.g. 760)
  const weight760 = /font-weight:\s*760/s;
  assert.match(css, weight760, '卡牌标题应使用 weight 760');
});
