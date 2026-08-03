// 关系决策牌组：Three.js 场景工厂（程序生成桌面）
// 设计原则：中央固定牌桌垫（所有场景共享），周边装饰按场景切换。
// 适配俯视相机：桌面 y=0 平面，正面朝 +z。
(function initStageFxSceneFactory(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipStageFxSceneFactory = api;
})(typeof window !== 'undefined' ? window : globalThis, function createSceneFactoryApi(globalScope) {
  'use strict';

  const PI = Math.PI;

  // 固定牌桌垫: 中央凸起牌桌垫(顶面+侧面) + 边缘暖橙光环
  // 不再画外圈深色底盘, 让圆盘自然淡出到背景纹理
  function createTabletop(THREE, texture) {
    const group = new THREE.Group();
    const TOP_Y = 0.18;
    // 1. 中央凸起: 顶面 (CircleGeometry) + 侧面 (LatheGeometry)
    // 顶面 - CircleGeometry (有贴图, DoubleSide 因为旋转后法线可能朝下)
    const topMaterial = texture
      ? new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      : new THREE.MeshBasicMaterial({ color: 0x1a2c4a, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const top = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 64),
      topMaterial
    );
    top.rotation.x = -PI / 2;
    top.position.y = TOP_Y;
    group.add(top);
    // 2. 侧面 - LatheGeometry 旋转体(透明柔和)
    const lathePoints = [];
    const STEPS = 24;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const r = t * 2.5;
      const y = TOP_Y * (1 - t * t);
      lathePoints.push(new THREE.Vector2(r, y));
    }
    const side = new THREE.Mesh(
      new THREE.LatheGeometry(lathePoints, 64),
      new THREE.MeshBasicMaterial({ color: 0x142840, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
    );
    group.add(side);
    // 3. 边缘光环(暖橙, 透明柔和)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.48, 2.65, 64),
      new THREE.MeshBasicMaterial({ color: 0xf6dda0, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    ring.rotation.x = -PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
    return group;
  }

  // 物件沿圆盘边缘环(半径 2.2)放射状布置
  // 圆盘半径 2.5, 物件在 2.2 半径圈环, 避开 UI 中央
  function placeOnRing(THREE, mesh, radius, angle) {
    mesh.position.x = radius * Math.cos(angle);
    mesh.position.z = radius * Math.sin(angle);
    return mesh;
  }

  // ===== 通用物件工厂函数 =====

  // ExtrudeGeometry 笔记本: 圆角矩形 + 厚度 + 倒角
  function makeNotebook(THREE) {
    const w = 0.7, h = 1.0, depth = 0.12, bevel = 0.04;
    const shape = new THREE.Shape();
    const r = 0.08; // 圆角半径
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const cover = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3 }),
      new THREE.MeshBasicMaterial({ color: 0xb8956a })
    );
    cover.rotation.x = -PI / 2; // 躺平
    cover.position.z = depth / 2; // 把 extruded depth 调整到 0..depth
    // 第二本: 浅色页面叠在封面上
    const pageShape = new THREE.Shape();
    pageShape.moveTo(-w / 2 + r * 1.4, -h / 2 + r * 0.6);
    pageShape.lineTo(w / 2 - r * 1.4, -h / 2 + r * 0.6);
    pageShape.lineTo(w / 2 - r * 1.4, h / 2 - r * 0.6);
    pageShape.lineTo(-w / 2 + r * 1.4, h / 2 - r * 0.6);
    pageShape.lineTo(-w / 2 + r * 1.4, -h / 2 + r * 0.6);
    const page = new THREE.Mesh(
      new THREE.ExtrudeGeometry(pageShape, { depth: 0.01, bevelEnabled: false }),
      new THREE.MeshBasicMaterial({ color: 0xf5ead4 })
    );
    page.rotation.x = -PI / 2;
    page.position.y = depth + 0.005;
    const group = new THREE.Group();
    group.add(cover);
    group.add(page);
    return group;
  }

  // 钢笔: 笔身 + 笔尖 + 笔帽
  function makePen(THREE) {
    const group = new THREE.Group();
    // 笔身(深色, 中间最粗)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.85, 16),
      new THREE.MeshBasicMaterial({ color: 0x2a3344 })
    );
    body.rotation.z = PI / 2; // 横向
    body.position.x = -0.1;
    group.add(body);
    // 笔帽(银色, 一端)
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.15, 16),
      new THREE.MeshBasicMaterial({ color: 0xc8c8d6 })
    );
    cap.rotation.z = PI / 2;
    cap.position.x = -0.65;
    group.add(cap);
    // 笔尖(金属锥形)
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.12, 8),
      new THREE.MeshBasicMaterial({ color: 0xd4af37 })
    );
    tip.rotation.z = -PI / 2; // 笔尖朝右
    tip.position.x = 0.46;
    group.add(tip);
    return group;
  }

  // 文件(纸张): ExtrudeGeometry 圆角矩形 + 厚度
  function makeFile(THREE) {
    const w = 0.85, h = 1.1, depth = 0.02;
    const shape = new THREE.Shape();
    const r = 0.05;
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }),
      new THREE.MeshBasicMaterial({ color: 0xf6dda0 })
    );
    mesh.rotation.x = -PI / 2;
    mesh.position.z = depth / 2;
    return mesh;
  }

  // 楼层按钮: CylinderGeometry + 顶部高亮 (金属面板)
  function makeElevatorButton(THREE, isActive) {
    const group = new THREE.Group();
    // 按钮底座(深色金属)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24),
      new THREE.MeshBasicMaterial({ color: 0x3a4452 })
    );
    base.position.y = 0.03;
    group.add(base);
    // 按钮顶部圆盘(高亮/普通)
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.025, 24),
      new THREE.MeshBasicMaterial({ color: isActive ? 0xf6dda0 : 0x6a7a8a })
    );
    top.position.y = 0.07;
    group.add(top);
    return group;
  }

  // 烛台: LatheGeometry 旋转体(底座/杆/碟分层)
  function makeCandlestick(THREE) {
    const points = [
      new THREE.Vector2(0.25, 0),     // 底盘底
      new THREE.Vector2(0.28, 0.02),  // 底盘
      new THREE.Vector2(0.22, 0.04),  // 底盘
      new THREE.Vector2(0.05, 0.06),  // 杆
      new THREE.Vector2(0.05, 0.32),  // 杆顶
      new THREE.Vector2(0.10, 0.34),  // 碟
      new THREE.Vector2(0.16, 0.36),  // 碟边
      new THREE.Vector2(0.10, 0.38),  // 烛托
      new THREE.Vector2(0.06, 0.4)    // 烛托顶
    ];
    const candle = new THREE.Mesh(
      new THREE.LatheGeometry(points, 32),
      new THREE.MeshBasicMaterial({ color: 0xb8956a })
    );
    return candle;
  }

  // 烛光: SphereGeometry 顶部 + 内部小球 + 底部圆柱
  function makeFlame(THREE) {
    const group = new THREE.Group();
    // 外焰(暖色光晕)
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffb366, transparent: true, opacity: 0.7 })
    );
    group.add(outer);
    // 内焰(亮黄)
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc })
    );
    group.add(inner);
    return group;
  }

  // 酒杯: LatheGeometry 旋转体(杯口/杯身/杯脚/底盘)
  function makeWineglass(THREE) {
    const points = [
      new THREE.Vector2(0.22, 0.5),   // 杯口边
      new THREE.Vector2(0.20, 0.48),   // 杯口内
      new THREE.Vector2(0.18, 0.4),    // 杯身
      new THREE.Vector2(0.12, 0.25),   // 杯身下
      new THREE.Vector2(0.05, 0.18),   // 杯身收
      new THREE.Vector2(0.04, 0.16),   // 杯脚顶
      new THREE.Vector2(0.04, 0.04),   // 杯脚
      new THREE.Vector2(0.18, 0.02),   // 底盘
      new THREE.Vector2(0.18, 0)       // 盘底
    ];
    const glass = new THREE.Mesh(
      new THREE.LatheGeometry(points, 32),
      new THREE.MeshBasicMaterial({ color: 0x8aa6c8, transparent: true, opacity: 0.65 })
    );
    return glass;
  }

  // 笔筒 / 钢笔放置器: 简单圆柱
  function makePenHolder(THREE) {
    const group = new THREE.Group();
    const holder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.3, 24),
      new THREE.MeshBasicMaterial({ color: 0x4a3a2c })
    );
    holder.position.y = 0.15;
    group.add(holder);
    return group;
  }

  // 会议室周边：笔记本 + 钢笔 + 文件（沿圆盘边缘环）
  function createMeetingProps(THREE) {
    const group = new THREE.Group();
    // 笔记本(右上)
    const notebook = makeNotebook(THREE);
    placeOnRing(THREE, notebook, 2.1, -PI / 4);
    notebook.rotation.y = -PI / 2;
    group.add(notebook);
    // 钢笔(左下)
    const pen = makePen(THREE);
    placeOnRing(THREE, pen, 2.1, 3 * PI / 4);
    pen.rotation.y = PI / 4;
    group.add(pen);
    // 文件(右下)
    const file = makeFile(THREE);
    placeOnRing(THREE, file, 2.1, PI / 4);
    file.rotation.y = -PI / 2 + 0.3;
    group.add(file);
    return group;
  }

  // 电梯周边：6 个楼层按钮（沿圆盘下方弧形）
  function createElevatorProps(THREE) {
    const group = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const t = i / 5; // 0..1
      const angle = PI * 0.55 + t * PI * 0.9; // 从 0.55π 到 1.45π (下方大半圆)
      const btn = makeElevatorButton(THREE, i === 2);
      placeOnRing(THREE, btn, 2.05, angle);
      group.add(btn);
    }
    return group;
  }

  // 晚餐周边：烛台 + 烛光 + 酒杯（沿圆盘两侧）
  function createDinnerProps(THREE) {
    const group = new THREE.Group();
    // 烛台 + 烛光(左侧)
    const candle = makeCandlestick(THREE);
    placeOnRing(THREE, candle, 2.1, 3 * PI / 4);
    candle.position.y = 0;
    group.add(candle);
    const flame = makeFlame(THREE);
    placeOnRing(THREE, flame, 2.1, 3 * PI / 4);
    flame.position.y = 0.5;
    group.add(flame);
    // 酒杯(右侧)
    const glass = makeWineglass(THREE);
    placeOnRing(THREE, glass, 2.1, PI / 4);
    glass.position.y = 0;
    group.add(glass);
    return group;
  }

  // 默认场景: 一个笔筒 + 一张便签(避免空荡)
  function createDefaultProps(THREE) {
    const group = new THREE.Group();
    const penHolder = makePenHolder(THREE);
    placeOnRing(THREE, penHolder, 2.0, -PI / 4);
    group.add(penHolder);
    const file = makeFile(THREE);
    placeOnRing(THREE, file, 2.0, PI / 4);
    file.rotation.y = -PI / 2 + 0.4;
    group.add(file);
    return group;
  }

  // 桌面粒子层（按 preset 调色和数量）
  function createAmbientParticles(THREE, preset) {
    const count = (preset && preset.particleCount) || 100;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 4;
      const theta = Math.random() * PI * 2;
      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = Math.random() * 3 - 0.5;
      positions[i * 3 + 2] = r * Math.sin(theta);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: (preset && preset.particleColor) || 0x7da3ff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    return new THREE.Points(geom, mat);
  }

  // 4 个场景工厂：每个 = 牌桌 + 周边装饰 + 粒子
  // textureMap: { meeting: Texture, dinner: Texture, ... } 按 presetId 索引
  function createMeetingScene(THREE, preset, textureMap) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE, textureMap && textureMap.meeting));
    g.add(createMeetingProps(THREE));
    g.add(createAmbientParticles(THREE, preset));
    return g;
  }
  function createElevatorScene(THREE, preset, textureMap) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE, textureMap && textureMap.elevator));
    g.add(createElevatorProps(THREE));
    g.add(createAmbientParticles(THREE, preset));
    return g;
  }
  function createDinnerScene(THREE, preset, textureMap) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE, textureMap && textureMap.dinner));
    g.add(createDinnerProps(THREE));
    g.add(createAmbientParticles(THREE, preset));
    return g;
  }
  function createDefaultScene(THREE, preset, textureMap) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE, textureMap && textureMap.default));
    g.add(createDefaultProps(THREE));
    g.add(createAmbientParticles(THREE, preset));
    return g;
  }

  const SCENE_FACTORIES = {
    meeting: createMeetingScene,
    elevator: createElevatorScene,
    dinner: createDinnerScene,
    default: createDefaultScene
  };

  // textureMap 预加载: { meeting: Texture, dinner: Texture, ... }
  // 不传则纯色桌垫
  function createScene(THREE, presetId, preset, textureMap) {
    const factory = SCENE_FACTORIES[presetId] || SCENE_FACTORIES.default;
    return factory(THREE, preset, textureMap);
  }

  return {
    createScene,
    createTabletop,
    createMeetingProps,
    createElevatorProps,
    createDinnerProps,
    createDefaultProps,
    createAmbientParticles,
    SCENE_FACTORIES
  };
});
