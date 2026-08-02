# 关系决策牌组：Three.js 动效增量改造 Codex 提示词

> 目标仓库：`AAAAaron/relationship-decision-cards`
>
> 当前版本：V0.9，GitHub Pages 静态部署，现有技术栈为 HTML、CSS、原生 JavaScript。
>
> 本次是增量视觉升级，不是将整个项目重写为 3D 游戏。

---

## 一、任务目标

请基于现有仓库增加一套轻量 Three.js 舞台特效系统，使页面在以下动作中具有更明显的空间感与反馈：

1. 切换人物、项目和真实沟通场景；
2. 对方打出场景牌；
3. AI重新发出 3—5 张应对手牌；
4. 用户悬停、翻面和选择卡牌；
5. 用户确认出牌；
6. 回合结束；
7. 收藏“场景＋应对”回合卡进入卡包；
8. 查看卡牌背面时出现轻微材质、光泽和信息揭示效果。

最终视觉应有质感、带一点卡牌对局的仪式感，但不能过度游戏化。用户可能不是游戏人群，Three.js 只是增强沟通决策体验，不应喧宾夺主。

---

## 二、核心技术判断

采用：

```text
DOM 卡牌与文字
＋
CSS 翻面、材质和局部高光
＋
一个 Three.js 中央舞台 Canvas
＋
业务事件驱动的短时特效
```

不要采用：

- 把所有卡牌文字绘制到 Canvas；
- 每张牌各创建一个 WebGLRenderer；
- 把整个页面做成可自由旋转的 3D 牌桌；
- 引入 3D 人物模型、复杂场景模型或物理引擎；
- 让动画循环永久以 60fps 运行；
- 为了 Three.js 重写人物、项目、场景、回合和卡包业务逻辑。

### 原因

现有卡牌有大量动态文字、翻面信息、按钮和移动端交互。DOM 更适合：

- 保持文字清晰；
- 保持点击、滚动和无障碍能力；
- 保持现有数据渲染逻辑；
- 保持移动端响应式布局。

Three.js 只负责卡牌下方或周围的光、粒子、波纹、场景氛围和空间反馈。

---

## 三、实施前先检查现有代码

请先阅读并理解：

```text
index.html
src/styles.css
src/app.js
src/data-model.js
src/ai-client.js
src/storage.js
data/demo-data.js
```

重点识别现有函数和事件节点：

- `renderBoard()`；
- `renderHand()`；
- `openPlay()` 或出牌弹层；
- `confirmPlay()`；
- `finishRound()`；
- 人物切换；
- 项目切换；
- 新场景进入；
- 翻面按钮 `[data-flip]`；
- 收藏当前回合；
- 打开卡包。

不要重复实现现有业务功能，只在这些节点派发视觉事件。

---

## 四、建议文件结构

新增：

```text
src/
├── stage-fx.js
├── stage-fx-scenes.js
├── motion-controller.js
└── motion-preferences.js

vendor/
└── three/
    ├── three.module.js
    └── addons/              # 仅放实际使用的官方 addon
```

现有文件只做必要修改：

```text
index.html
src/styles.css
src/app.js
README.md
```

### 文件职责

#### `stage-fx.js`

- 初始化唯一的 Three.js Renderer；
- 创建相机、场景、基础粒子和光带；
- 管理按需渲染；
- 对外暴露少量视觉方法；
- 监听统一的业务事件。

#### `stage-fx-scenes.js`

定义不同沟通情境的视觉参数，不包含业务数据：

```js
export const SCENE_PRESETS = {
  meeting: {},
  elevator: {},
  dinner: {},
  private_chat: {},
  wechat: {},
  phone: {},
  review: {},
  default: {}
};
```

#### `motion-controller.js`

负责协调：

- DOM 卡牌动画；
- Three.js 舞台动画；
- 动画时间线；
- 元素坐标与 Canvas 坐标的转换。

#### `motion-preferences.js`

处理：

- `prefers-reduced-motion`；
- 低性能模式；
- 页面不可见时暂停；
- WebGL不可用时回退。

---

## 五、Three.js 接入方式

当前项目是静态 GitHub Pages。优先保持无构建部署。

### 推荐方案

将固定版本 Three.js 文件放进仓库，通过 import map 和 ES Module 使用：

```html
<script type="importmap">
{
  "imports": {
    "three": "./vendor/three/three.module.js",
    "three/addons/": "./vendor/three/addons/"
  }
}
</script>
```

在现有普通脚本之后或适当位置加入：

```html
<script type="module" src="./src/stage-fx.js"></script>
```

注意：

- Three.js 主包和 addons 必须来自完全相同版本；
- 不使用 `latest`；
- 不混用不同 CDN 或不同版本；
- 不依赖远程网络才能运行；
- GitHub Pages 路径必须使用相对路径；
- 本地通过 `python3 -m http.server` 测试。

若仓库后来已经引入 `package.json` 和 Vite，可改用 npm，但不要仅为本次动效强制重构整个项目。

---

## 六、页面结构修改

在中间牌桌 `.battlefield.board-stage` 内增加一个 Canvas：

```html
<section class="battlefield board-stage">
  <canvas id="stageFxCanvas" aria-hidden="true"></canvas>
  <div class="stage-fx-fallback" aria-hidden="true"></div>

  <div class="board-stage-content">
    <!-- 保留现有 board-head、round-row、round-controls -->
  </div>
</section>
```

CSS：

```css
.board-stage {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

#stageFxCanvas,
.stage-fx-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

#stageFxCanvas {
  z-index: 0;
}

.stage-fx-fallback {
  z-index: 0;
}

.board-stage-content {
  position: relative;
  z-index: 1;
}
```

要求：

- Canvas 只覆盖中间牌桌，不覆盖顶部、手牌区和弹层；
- 不阻挡鼠标或触摸操作；
- Canvas尺寸随容器变化；
- 页面缩放和移动端旋转后正确 resize；
- WebGL失败时保留 CSS fallback 背景。

---

## 七、统一事件协议

不要让 `stage-fx.js` 直接读取或修改业务状态。`app.js` 只负责派发事件。

建议统一事件：

```js
window.dispatchEvent(new CustomEvent('rdc:scene-change', {
  detail: {
    sceneType: scene.scene_type,
    source: scene.source,
    mood: person.current_state?.mood,
    constraints: scene.constraints || []
  }
}));
```

```js
window.dispatchEvent(new CustomEvent('rdc:opponent-play', {
  detail: {
    sourceRect,
    targetRect,
    sceneType: scene.scene_type
  }
}));
```

```js
window.dispatchEvent(new CustomEvent('rdc:hand-deal', {
  detail: {
    count: plan.candidates.length,
    ranks: plan.candidates.map(item => item.rank)
  }
}));
```

```js
window.dispatchEvent(new CustomEvent('rdc:card-flip', {
  detail: {
    side: 'opponent' | 'player' | 'hand' | 'record',
    face: 'front' | 'back',
    rank: candidate?.rank || null,
    rect: cardElement.getBoundingClientRect()
  }
}));
```

```js
window.dispatchEvent(new CustomEvent('rdc:player-play', {
  detail: {
    rank: playedResponse.ai_rank,
    sourceRect,
    targetRect
  }
}));
```

```js
window.dispatchEvent(new CustomEvent('rdc:round-end', {
  detail: {
    saved: current.saved,
    source: current.opponent.source
  }
}));
```

```js
window.dispatchEvent(new CustomEvent('rdc:round-save', {
  detail: {
    saved: true,
    sceneType: current.opponent.scene_type,
    sourceRect,
    targetRect
  }
}));
```

事件命名全部使用 `rdc:` 前缀。

---

## 八、首版必须实现的动效

本次只做高价值效果，不追求数量。

### 8.1 场景氛围切换

场景变化时，Three.js 舞台在 450—800ms 内柔和过渡。

#### 正式会议 `meeting`

- 冷蓝背景；
- 细弱水平数据线；
- 中央有稳定、低频光脉冲；
- 少量金色节点；
- 不出现会议室3D模型。

#### 电梯 `elevator`

- 竖向金属光带缓慢移动；
- 顶部或侧边有一条楼层指示感的细光；
- 场景进入时产生一次短促向上/向下运动；
- 体现“时间短、临时被问”，但不要闪烁刺眼。

#### 饭局 `dinner`

- 暖金色散景；
- 少量缓慢浮动的柔焦粒子；
- 背景更柔和、对比稍低；
- 不使用酒杯、酒瓶等具象模型。

#### 会后单聊 `private_chat`

- 两侧环境光逐渐减弱；
- 中间两张牌之间形成较窄的柔光区域；
- 粒子数量减少，强调私密感。

#### 微信/异步 `wechat` 或 `async_message`

- 小型矩形光点从一侧依次进入；
- 形成轻微信息流；
- 不绘制真实聊天气泡或文字。

#### 其他场景

使用 `default`，保持深蓝、轻微粒子和低频呼吸光。

### 8.2 对方出牌

流程：

1. 左侧“对方出牌”按钮附近聚集少量粒子；
2. 一条弧形光轨指向当前对方场景牌位置；
3. DOM场景牌沿现有入场动画出现；
4. 落点产生一次圆形波纹；
5. 波纹消失后重新发手牌。

时间控制：

- 总时长约 700—1000ms；
- 不能延迟用户过久；
- 动效完成前也不要锁死全部页面。

### 8.3 手牌重新发出

保留现有 CSS 扇形发牌动画，Three.js 只增加：

- 手牌区上方一条短暂的流光；
- 主推荐方向产生一束稍稳定的金色光；
- 条件备选为低饱和蓝光；
- 其他牌不做持续高亮。

不要给五张牌分别创建3D粒子场。

### 8.4 我方出牌

确认出牌后：

1. 当前选中DOM卡牌抬起；
2. 沿曲线移动到右侧我方出牌位；
3. Three.js在对方牌和我方牌之间形成一条短暂关系光路；
4. 牌落下后出现一次轻微光圈；
5. 其他手牌淡出或收回。

不同AI判断使用不同反馈，但差异应克制：

- `primary`：稳定金色光路；
- `backup`：蓝色双段光路；
- `other`：低亮白蓝光路；
- `risk`：短暂不规则扰动，不使用失败爆炸或大面积红光。

### 8.5 回合收藏进卡包

点击收藏或结束已收藏回合时：

1. 对方场景牌和我方回应牌之间出现一条连接光；
2. 两张牌轻微向中间靠拢；
3. 中央产生一个小型金色星点；
4. 星点沿弧线飞向右侧“我的卡包”；
5. 卡包脊柱轻微亮起；
6. 数量更新。

不要真的把两张DOM牌缩成贴图上传到 WebGL；Three.js只做象征性的连接与粒子运动。

---

## 九、卡牌背面动效方案

卡牌背面需要有一点效果，但必须避免为每张牌创建独立 Canvas。

采用两层方案：

```text
CSS负责牌面材质与局部光泽
＋
Three.js负责翻面瞬间的舞台响应
```

### 9.1 CSS背面材质

给 `.card-back` 增加三层伪元素或内部装饰层：

1. 极淡的几何纹理；
2. 随鼠标位置变化的柔和高光；
3. 翻面完成后一次短促边缘扫光。

示例方向：

```css
.card-back {
  position: absolute;
  overflow: hidden;
  background:
    radial-gradient(circle at var(--shine-x, 50%) var(--shine-y, 25%),
      rgba(246, 221, 160, .14), transparent 34%),
    linear-gradient(160deg, #172945, #0d1c32);
}

.card-back::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: .18;
  background-image:
    linear-gradient(60deg, transparent 46%, rgba(255,255,255,.08) 50%, transparent 54%),
    linear-gradient(-60deg, transparent 46%, rgba(117,148,255,.08) 50%, transparent 54%);
  background-size: 34px 34px;
  pointer-events: none;
}

.card-back::after {
  content: '';
  position: absolute;
  inset: -35%;
  transform: translateX(-65%) rotate(18deg);
  background: linear-gradient(90deg, transparent, rgba(246,221,160,.18), transparent);
  pointer-events: none;
}

.is-flipped .card-back::after {
  animation: cardBackSweep .65s ease-out .18s both;
}
```

扫光只执行一次，不持续循环。

### 9.2 鼠标视差

桌面端悬停背面时，根据指针在卡牌中的相对位置更新：

```css
--shine-x
--shine-y
--tilt-x
--tilt-y
```

限制：

- 最大旋转不超过 2.5deg；
- 离开后平滑回正；
- 移动端不启用指针视差；
- `prefers-reduced-motion` 下关闭。

### 9.3 背面信息分段揭示

背面内容不要同时全部跳出。翻面后可用 CSS 做 3 组轻微 stagger：

- AI判断；
- 适用与不适用；
- 依据或来源。

每组间隔 50—80ms，总时长不超过 450ms。

### 9.4 Three.js翻面响应

监听 `rdc:card-flip`：

- 翻到背面时，在对应卡牌位置后方产生一个很小的环形光；
- `primary` 使用金色；
- `backup` 使用蓝色；
- `risk` 使用低亮红褐色；
- 150—350ms 后消失；
- 不对历史卡包中的大量牌持续渲染。

### 9.5 不同牌背面的差异

不要设计完全不同的背面模板，只做细微身份差异：

- 场景牌：蓝色细线与位置感；
- 我方回应牌：暖金纸张纹理；
- 主推荐：中心纹章轻微高亮；
- 条件备选：双层边框；
- AI不推荐：边缘有轻微断续纹理；
- 收藏回合卡：星点纹样。

背面内容仍必须清晰可读，装饰不得穿过正文。

---

## 十、Three.js内部实现建议

### 10.1 基础对象

只使用低成本对象：

- `Points` 粒子；
- `BufferGeometry`；
- 简单 `Line` 或 `LineSegments`；
- 少量透明平面；
- 圆形波纹平面；
- 自定义简单 ShaderMaterial，可选；
- 不加载 glTF、OBJ 或大型纹理。

### 10.2 相机

使用固定正交相机或轻微透视相机。

不加入：

- OrbitControls；
- 用户拖动镜头；
- 自由缩放；
- 景深镜头漫游。

舞台只作为背景层。

### 10.3 坐标映射

DOM元素位置通过：

```js
const rect = element.getBoundingClientRect();
const stageRect = canvas.getBoundingClientRect();
```

换算到 Canvas 本地坐标和标准化设备坐标。

封装：

```js
function domRectToStagePoint(rect, stageRect) {}
```

避免在Three模块中通过固定像素猜测卡牌位置。

### 10.4 动画系统

第一版无需再引入 GSAP。使用：

- `requestAnimationFrame`；
- easing函数；
- 小型 tween 管理器；
- Promise 或回调通知动效完成。

只有当多个复杂时间线明显难以维护时，再评估 GSAP。

### 10.5 后期处理

第一版默认不开启完整 `EffectComposer`。

先用普通透明材质、加法混合和CSS实现。只有在桌面端性能测试通过后，才可增加一个非常轻的 Bloom，并必须满足：

- 移动端默认关闭；
- 低性能模式关闭；
- 不使用 GlitchPass；
- 不使用大范围景深；
- 不使用明显色差和故障效果；
- `EffectComposer`、`RenderPass`、`OutputPass`和其他addon保持同一Three版本。

---

## 十一、按需渲染与性能要求

本项目不是持续运行的游戏，必须采用按需渲染或短时动画循环。

### 11.1 渲染策略

初始化后只渲染一次。

只有这些情况启动帧循环：

- 场景氛围切换；
- 出牌；
- 发牌；
- 翻面反馈；
- 收藏；
- resize；
- 少量背景呼吸动画。

动画结束后停止循环。

可实现：

```js
let frameRequested = false;
let activeAnimations = 0;

function requestRender() {}
function startAnimation() {}
function stopAnimation() {}
```

### 11.2 像素比

不要直接：

```js
renderer.setPixelRatio(window.devicePixelRatio);
```

建议：

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
```

移动端或低性能模式可限制为 1。

### 11.3 粒子数量

建议上限：

- 桌面端：150—350；
- 移动端：60—140；
- 低性能模式：30—80。

不要使用数千粒子。

### 11.4 生命周期

必须在重建或禁用特效时释放：

- geometry；
- material；
- texture；
- render target；
- renderer；
- ResizeObserver；
- window事件监听器。

### 11.5 页面状态

- `document.hidden` 时暂停动画；
- 弹层覆盖牌桌时减少背景动画；
- 页面离开时停止；
- WebGL context lost 时展示CSS fallback，不使业务功能失效。

---

## 十二、可访问性与降级

### 12.1 减少动画

检测：

```js
window.matchMedia('(prefers-reduced-motion: reduce)')
```

开启时：

- 关闭粒子飞行；
- 关闭卡牌位移视差；
- 场景改为简单淡入淡出；
- 翻面保留但缩短；
- 收藏只做卡包按钮轻微高亮。

### 12.2 WebGL不可用

业务页面必须继续完整可用。

回退为：

- 原有CSS深蓝牌桌；
- CSS波纹；
- CSS出牌与翻面；
- 不显示错误弹窗打断用户。

可在控制台记录一次说明。

### 12.3 动效开关

在AI设置或数据设置附近增加一个非常轻的设置入口：

```text
视觉动效：完整 / 简化 / 关闭
```

默认：

- 桌面端：完整；
- 低性能移动端：简化；
- reduced-motion：关闭或简化。

状态可保存在现有本地存储中，但不要加入导出文件中的敏感内容。

---

## 十三、视觉约束

必须保持当前视觉体系：

- 深蓝主背景；
- 蓝金场景牌；
- 暖纸色回应牌；
- 金色为主推荐和收藏；
- 蓝色为条件备选；
- 红色只用于风险提示。

不要加入：

- 夸张爆炸；
- 火焰、雷电、刀剑；
- 血条和伤害数字；
- 频繁震屏；
- 过强 bloom；
- 霓虹赛博城市；
- 卡通金币；
- 炉石式重度游戏边框复制。

目标气质：

> 有卡牌仪式感的高品质沟通决策工具，而不是战斗游戏。

---

## 十四、分阶段实施

### 第一阶段：基础舞台

- 加入唯一Canvas；
- resize；
- WebGL和CSS fallback；
- `meeting`、`elevator`、`dinner` 三种场景氛围；
- 按需渲染；
- reduced-motion。

### 第二阶段：关键动作

- 对方出牌光轨和波纹；
- 我方出牌关系光路；
- 发牌短暂流光；
- 回合收藏星点飞入卡包。

### 第三阶段：卡牌背面

- 背面CSS纹理；
- 扫光；
- 桌面端轻微视差；
- 信息分段揭示；
- Three.js翻面环形反馈。

### 第四阶段：优化

- 简化/关闭动效设置；
- 移动端粒子降级；
- 内存释放；
- 自动测试；
- 性能记录。

不要一次提交过多互相耦合的效果。

---

## 十五、验收标准

### 功能不回退

- [ ] 人物切换正常；
- [ ] 同一人物多项目切换正常；
- [ ] 真实场景、电梯、饭局、会议、微信等场景正常；
- [ ] 3—5张MECE手牌正常；
- [ ] 主推荐、条件备选和其他牌原因正常；
- [ ] 翻面正常；
- [ ] 出牌正常；
- [ ] 回合推进正常；
- [ ] 收藏和卡包正常；
- [ ] AI和本地存储正常。

### 动效

- [ ] Three Canvas只覆盖中间牌桌；
- [ ] Canvas不阻挡任何点击；
- [ ] 场景切换有明显但克制的氛围变化；
- [ ] 对方和我方出牌有空间反馈；
- [ ] 收藏有明确的“进入卡包”反馈；
- [ ] 卡牌背面有材质、扫光和轻微揭示动画；
- [ ] 不出现多Canvas、文字模糊或交互失效；
- [ ] 动效可关闭。

### 性能

- [ ] 空闲时不持续高频渲染；
- [ ] 桌面端交互流畅；
- [ ] 中档手机无明显卡顿；
- [ ] 页面不可见时暂停；
- [ ] WebGL不可用仍能完整使用；
- [ ] resize后画面不拉伸；
- [ ] 无明显内存持续增长。

### 技术

- [ ] 浏览器控制台无错误；
- [ ] Three.js和addons版本一致；
- [ ] GitHub Pages路径正确；
- [ ] 本地HTTP服务器运行正常；
- [ ] 不依赖远程CDN；
- [ ] 业务状态与视觉状态分离。

---

## 十六、测试流程

1. 打开默认“正式会议”场景，检查冷蓝会议氛围；
2. 打开对方场景牌堆，切换到“电梯里突然被问进度”；
3. 检查竖向光带和短促进入反馈；
4. 对方出牌，检查光轨、DOM卡牌和落点波纹是否同步；
5. 检查手牌发出动画和主推荐轻度高亮；
6. 悬停一张手牌并翻到背面；
7. 检查背面纹理、扫光、轻微视差和信息分段出现；
8. 选择AI不推荐牌，确保风险提示仍正常；
9. 确认出牌，检查牌移动和两侧光路；
10. 收藏回合，检查星点飞向右侧卡包；
11. 切换饭局场景，检查暖金散景但文字仍清晰；
12. 打开人物详情、项目详情、卡包和AI设置，确认Three Canvas不覆盖弹层；
13. 开启“简化”和“关闭”动效；
14. 模拟 `prefers-reduced-motion`；
15. 在移动端尺寸测试；
16. 禁用WebGL后测试CSS回退。

---

## 十七、Codex交付要求

完成后请输出：

1. 修改文件清单；
2. Three.js版本和来源；
3. 新增事件清单；
4. 每种场景预设说明；
5. 动效降级策略；
6. 性能控制说明；
7. 手工测试结果；
8. 尚未实现的部分；
9. 不要只提交演示页面，必须整合进现有V0.9；
10. 不要重写现有业务系统；
11. 不要删除人物、项目、场景、AI、历史和卡包功能；
12. 每完成一个阶段先运行测试，再进入下一阶段。

---

## 十八、实现优先级结论

本次最重要的不是“页面变成3D”，而是让四个关键动作更有感觉：

```text
场景发生变化
→ 对方正式出牌
→ 用户选择并打出回应
→ 有价值的回合被收藏进卡包
```

Three.js负责空间与氛围，DOM负责信息和决策。

卡牌背面以CSS材质和揭示动效为主，Three.js只提供翻面瞬间的舞台反馈。这样能获得明显的质感提升，同时保持页面轻量、文字清晰、移动端可用和后续维护简单。

---

## 十九、技术参考

实施时以Three.js官方文档为准：

- Installation：ES Modules、import map、npm/Vite与静态CDN方案；
- Rendering on Demand：非游戏页面按需渲染；
- Responsive Design：Canvas尺寸与像素比控制；
- EffectComposer / Post Processing：仅在必要时加入轻量后期处理；
- 所有核心包和addons必须使用相同版本。
