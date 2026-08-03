# AI 嘴替卡 V0.9 — 设计规范

> 统一颜色 / 字体 / 间距 / 阴影 / 组件的设计语言。
> 修改时优先用 CSS 变量, 避免硬编码; 写新组件前先查本规范。

---

## 1. 颜色 Token

### 1.1 基础色板（:root CSS 变量）

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#06101e` | 页面底色（深蓝黑） |
| `--panel` | `#101d33` | 弹窗 / 卡片底色 |
| `--panel2` | `#172945` | 次级面板 / 输入框 |
| `--line` | `rgba(217,228,246,.14)` | 细分隔线（暗色背景上） |
| `--line2` | `rgba(217,228,246,.28)` | 强分隔线 / 边框 |
| `--text` | `#f5f7fb` | 主要文字（亮色，dark theme） |
| `--soft` | `#c8d2e0` | 次要文字（柔和浅蓝） |
| `--muted` | `#8491a7` | 注脚 / 提示文字 |
| `--ink` | `#172137` | 主要文字（亮卡纸背景上） |
| `--ink2` | `#6f6a60` | 次要文字（亮卡纸背景上） |

### 1.2 品牌色

| Token | 值 | 用途 |
|---|---|---|
| `--gold` | `#e7bd65` | 品牌金（高亮、激活） |
| `--gold2` | `#f6dda0` | 浅金（柔和强调） |
| `--blue` | `#7594ff` | 品牌蓝（次级操作） |
| `--teal` | `#50d3c0` | 提示绿 |
| `--red` | `#d7868d` | 风险红 |
| `--paper` | `#f5ead4` | 暖卡纸（米黄） |
| `--paper2` | `#fffaf0` | 浅卡纸 |

### 1.3 主题色（stage-fx preset 覆盖 `--accent`）

| Preset | accent | mood | 适用 |
|---|---|---|---|
| `meeting` | `#f6dda0` | 冷/沉静 | 正式会议 |
| `elevator` | `#c8d2e0` | 冷/简洁 | 短平快 |
| `dinner` | `#ffb366` | 暖/亲密 | 感谢/关系 |
| `default` | `#7da3ff` | 中性 | 通用 |

> 用法: `var(--accent)` 跟当前主题色, 切换桌面风格时自动联动。

### 1.4 Rank 颜色（卡牌推荐等级）

| Rank | 颜色 | 含义 | light bg text | dark bg text |
|---|---|---|---|---|
| `primary` | gold `#e7bd65` | AI 主推荐 | `#182039` (深) | `#f6dda0` (浅) |
| `backup` | blue `#7594ff` | 条件备选 | `#1a2b4d` (深) | `#dbe4ff` (浅) |
| `other` | gray `#586475` | 其他可行 | `#dde4ee` (浅) | `#dde4ee` (浅) |
| `risk` | red `#9f5057` | AI 不推荐 | `#fff0f0` (浅) | `#fff0f0` (浅) |

---

## 2. 字体 Hierarchy

### 2.1 字号 Scale

| Token | Size | Weight | Line-height | Letter-spacing | 用途 |
|---|---|---|---|---|---|
| display | 24-26px | 800 | 1.15 | -.02em | 极少用（场景/对话框大标题） |
| h1 | 20px | 800 | 1.18 | -.015em | 手牌标题 |
| h2 | 18px | 800 | 1.2 | -.015em | 交锋/卡包/记录标题 |
| h3 | 15-16px | 720 | 1.25 | -.01em | 二级标题 |
| body-lg | 14px | 600 | 1.5 | 0 | 大段正文 |
| body | 13-13.5px | 600 | 1.55 | .005em | 段落正文 |
| body-sm | 12-12.5px | 600 | 1.55 | 0 | 紧凑正文（手牌） |
| caption | 11-11.5px | 600-700 | 1.5 | .02em | 注脚/时间戳 |
| micro | 9.5-10.5px | 760 | 1.4 | .02em | rank chip / 小标签 |

### 2.2 字体规则

- **永远不要** 用 Inter（前端 dev 默认禁）
- **优先** Outfit / Geist / Satoshi (UI 标题) + Lora (正文，可选)
- 副标题用 Outfit 几何字体, 避免 Serif
- letter-spacing: 标题 -.015em (紧凑), 注脚 +.02em (宽松)
- font-weight 范围: 500-800, 避免 400(太细) 和 900(太粗)

---

## 3. 间距 Scale

8px 基础单位。

| Token | Value | 用途 |
|---|---|---|
| xs | 4px | 元素内边距 |
| sm | 8px | 段落间小间距 |
| md | 12px | 区块内小间距 |
| lg | 16px | 区块间距 |
| xl | 24px | 大区块间距 |
| 2xl | 32px | 章节间距 |
| 3xl | 48px | 页面边距 |

---

## 4. 圆角 Scale

| Token | Value | 用途 |
|---|---|---|
| pill | 999px | chip / 标签 |
| sm | 9px | 小标签内框 |
| md | 14px | 卡片 / 弹窗 |
| lg | 17px | 翻面克隆体 |
| xl | 22px | 大面板 |

---

## 5. 阴影 Scale

| Token | Value | 用途 |
|---|---|---|
| shadow-sm | `0 8px 24px rgba(0,0,0,.24)` | hover 提示 |
| shadow-md | `0 16px 40px rgba(0,0,0,.32)` | 卡片默认 |
| shadow-lg | `0 24px 60px rgba(0,0,0,.5)` | focused / 弹窗 |
| shadow-pad | `0 24px 70px rgba(0,0,0,.34)` | 弹窗外层 |
| glow-gold | `0 0 24px rgba(231,189,101,.7)` | rank-primary 强调 |
| glow-blue | `0 0 20px rgba(117,148,255,.58)` | rank-backup |
| glow-red | `0 0 22px rgba(215,134,141,.65)` | rank-risk |

---

## 6. 组件规范

### 6.1 卡牌 (`.dialog-card`, `.hand-card`, `.pack-card`, `.record-card`)

```
┌─────────────────────┐
│ [rank chip]    [opponent-avatar] │  ← 头部
│                      │
│ Title (h1/h2)         │  ← 标题: 18-20px / 800
│                      │
│ Body paragraph       │  ← 正文: 13px / 600
│ (blockquote)         │
│                      │
│ ─── divider ───       │  ← 章节分隔
│                      │
│ [tags] [tags] [tags]  │  ← 章节标签
│                      │
│ Note (warning/safe)  │  ← 注脚: 11.5px / 620
└─────────────────────┘
```

- 圆角: `var(--card-radius, 14px)`
- 阴影: `var(--card-shadow, 0 16px 40px rgba(0,0,0,.32))`
- 内部: `display: flex; flex-direction: column; gap: 6px;`
- 顶部 3px 高亮条: `::after` 伪元素
- 边框主题色: `::before` 伪元素
- hover: `translateY(-8px) scale(1.02)` + 阴影加深
- focused (手牌): `translateY(-14px) scale(1.08)` + `drop-shadow`

### 6.2 Rank chip (`.rank-badge`)

- 圆角: `999px` (pill)
- 内边距: `3px 9px 3px 7px`
- 字号: 9.5-10.5px
- 字重: 760
- letter-spacing: `.02em`
- 图标: `::before` 13x13 PNG
- 背景: rank 主题色

### 6.3 按钮

| 类型 | 用途 | 样式 |
|---|---|---|
| primary | 主操作 | 金色背景, 暗色文字 |
| secondary | 次操作 | 透明背景, 边框 1px line2 |
| ghost | 顶部操作 | 透明 + 1px line |
| tab | 弹窗内 tab | 选中金色底, 未选中透明 |

### 6.4 Modal

- 宽度: `min(760px, 100%)` (常规) / `min(1220px, 100%)` (卡包) / `min(1080px, 100%)` (历史)
- 圆角: `23px`
- 阴影: `var(--shadow-pad)`
- 背景: 面板渐变
- backdrop: `blur(11px)` 黑色半透明

---

## 7. 动效规范

| 元素 | 触发 | 效果 | 时长 |
|---|---|---|---|
| rank chip 边框 | 静态 | 呼吸光晕 | 1.9-2.8s |
| card hover | hover | translateY -6 ~ -14px + scale | 0.18-0.25s |
| card flip | 点击 | rotateY 180° | 0.6s |
| modal open | 点击 | scale + opacity | 0.3s |
| scene switch | preset 切换 | 卸载旧 Group, 加载新 Group | 即时 |
| theme accent | preset 切换 | CSS var 同步 | 0.55s |

**永远**:
- `prefers-reduced-motion` 时关闭所有循环动画
- 只动画 `transform / opacity` (GPU 友好)
- transition 缓动用 `cubic-bezier(.16, 1, .3, 1)` (smooth decel)

---

## 8. 无障碍

- 文字对比度 ≥ 4.5:1 (正文) / 3:1 (大文字)
- 焦点环: `outline: 2px solid var(--gold); outline-offset: 2px`
- 键盘: 弹窗 Esc 关闭, Tab 顺序合理
- 动效: prefers-reduced-motion 必须尊重

---

## 9. 资源

- `assets/icons/` - rank PNG (1024x1024, 透明背景)
- `assets/backgrounds/manifest.json` - 桌面风格清单
- `vendor/three/three.module.js` - three.js r170

---

## 10. 维护清单

- [ ] 字号 / 字重统一用 token
- [ ] 颜色统一用 token, 避免 hex 散落
- [ ] 圆角统一用 token
- [ ] 阴影统一用 token
- [ ] 新组件前先查本规范
- [ ] PR 改动同时更新 DESIGN.md
