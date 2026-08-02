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

  // 固定牌桌垫：外圈深色底盘 + 中央牌桌垫 + 边缘暖橙光环
  // 三层叠加形成「打牌垫」质感，类似 Hearthstone 战场中央
  function createTabletop(THREE) {
    const group = new THREE.Group();
    // 1. 外圈深色底盘（半径 4，扩大视觉外延）
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(4, 64),
      new THREE.MeshBasicMaterial({ color: 0x0a1626 })
    );
    base.position.y = 0;
    group.add(base);
    // 2. 中央牌桌垫（半径 2.5，绒布感深蓝）
    const mat = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 64),
      new THREE.MeshBasicMaterial({ color: 0x1a2c4a })
    );
    mat.position.y = 0.01;
    group.add(mat);
    // 3. 边缘光环（暖橙 RingGeometry，区分牌桌边界）
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.48, 2.6, 64),
      new THREE.MeshBasicMaterial({ color: 0xf6dda0, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    ring.rotation.x = -PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
    return group;
  }

  // 会议室周边：笔记本 + 钢笔 + 文件
  function createMeetingProps(THREE) {
    const group = new THREE.Group();
    // 笔记本（左侧，木质封皮）
    const notebook = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.05, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x4a3a2c })
    );
    notebook.position.set(-3.2, 0.05, -1.5);
    group.add(notebook);
    // 钢笔（笔记本旁，黑色细长）
    const pen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1410 })
    );
    pen.position.set(-2.4, 0.08, -0.5);
    group.add(pen);
    // 文件（右上，米黄色纸）
    const file = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.02, 1.0),
      new THREE.MeshBasicMaterial({ color: 0xe8d8a6 })
    );
    file.position.set(3.0, 0.05, 1.8);
    group.add(file);
    return group;
  }

  // 电梯周边：4 个楼层按钮（第二个高亮表示当前层）
  function createElevatorProps(THREE) {
    const group = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const btn = new THREE.Mesh(
        new THREE.CircleGeometry(0.25, 16),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0xf6dda0 : 0x4a556a })
      );
      btn.rotation.x = -PI / 2;
      btn.position.set(-3.5 + i * 0.7, 0.05, -2.5);
      group.add(btn);
    }
    return group;
  }

  // 晚餐周边：烛台 + 烛光 + 酒杯
  function createDinnerProps(THREE) {
    const group = new THREE.Group();
    // 烛台（左侧，金属托盘）
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x8a6a3a })
    );
    candle.position.set(-3.0, 0.25, 1.8);
    group.add(candle);
    // 烛光（橙色小球）
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9500 })
    );
    flame.position.set(-3.0, 0.6, 1.8);
    group.add(flame);
    // 酒杯（右下，透明玻璃）
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.15, 0.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x6a8aa6, transparent: true, opacity: 0.7 })
    );
    glass.position.set(3.0, 0.25, 1.5);
    group.add(glass);
    return group;
  }

  // 默认场景：无周边装饰，纯净桌面
  function createDefaultProps(THREE) {
    return new THREE.Group();
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
  function createMeetingScene(THREE, preset) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE));
    g.add(createMeetingProps(THREE));
    g.add(createAmbientParticles(THREE, preset));
    return g;
  }
  function createElevatorScene(THREE, preset) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE));
    g.add(createElevatorProps(THREE));
    g.add(createAmbientParticles(THREE, preset));
    return g;
  }
  function createDinnerScene(THREE, preset) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE));
    g.add(createDinnerProps(THREE));
    g.add(createAmbientParticles(THREE, preset));
    return g;
  }
  function createDefaultScene(THREE, preset) {
    const g = new THREE.Group();
    g.add(createTabletop(THREE));
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

  function createScene(THREE, presetId, preset) {
    const factory = SCENE_FACTORIES[presetId] || SCENE_FACTORIES.default;
    return factory(THREE, preset);
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
