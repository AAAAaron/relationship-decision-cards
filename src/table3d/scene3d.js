// table3d: 桌面环境场景
// 透视相机 + 暗色酒馆桌面(程序纹理) + 双侧聚光 + 战场符文圈 + 漂浮金尘 + 雾
// 依赖注入 THREE; world 布局常量在此定义, 其余模块引用
(function initTable3dScene(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dScene = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dSceneApi() {
  'use strict';

  // 世界布局: 桌面为 XZ 平面(y=0), 对方在 -z, 我方手牌在 +z
  const LAYOUT = {
    cardW: 1.0,
    cardH: 1.6,
    opponent: { x: -0.78, z: -1.75 },
    player: { x: 0.78, z: -1.75 },
    previousLift: 0.06,
    hand: { z: 3.0, radius: 4.6, spread: 1.05 },
    rune: { x: 0, z: -1.75, radius: 1.55 },
    deckPos: { x: -3.2, z: -1.9 },
    packPos: { x: 3.6, z: 2.2 },
    camera: { fov: 44, pos: [0, 3.6, 9.6], lookAt: [0, 0.9, -1.1] }
  };

  // 程序桌面纹理: 深色木纹 + 中央渐亮
  function paintTableCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1c1109');
    g.addColorStop(0.5, '#251710');
    g.addColorStop(1, '#130b06');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 木纹条
    for (let i = 0; i < 46; i += 1) {
      const y = (i / 46) * h + Math.random() * 6;
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + (Math.random() * 14 - 7), w * 0.7, y + (Math.random() * 14 - 7), w, y);
      ctx.stroke();
    }
    // 中央暖光池(战场被照亮, 边缘暗)
    const pool = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.05, w / 2, h * 0.45, w * 0.55);
    pool.addColorStop(0, 'rgba(255,196,120,0.13)');
    pool.addColorStop(0.6, 'rgba(255,184,104,0.04)');
    pool.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);
    return canvas;
  }

  // 符文圈: 主环 + 刻度环 + 内圈, update 时缓慢旋转/呼吸
  function buildRuneCircle(THREE) {
    const group = new THREE.Group();
    const mkRing = (radius, tube, color, opacity) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 8, 96),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
      );
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    };
    const main = mkRing(LAYOUT.rune.radius, 0.012, 0xe7bd65, 0.5);
    const inner = mkRing(LAYOUT.rune.radius * 0.82, 0.006, 0xc89a4a, 0.35);
    const ticks = new THREE.Group();
    const tickCount = 24;
    for (let i = 0; i < tickCount; i += 1) {
      const a = (i / tickCount) * Math.PI * 2;
      const len = 0.1;
      const tick = new THREE.Mesh(
        new THREE.PlaneGeometry(0.02, len),
        new THREE.MeshBasicMaterial({ color: 0xe7bd65, transparent: true, opacity: 0.35 })
      );
      tick.position.set(Math.cos(a) * LAYOUT.rune.radius, 0, Math.sin(a) * LAYOUT.rune.radius);
      tick.rotation.y = -a;
      ticks.add(tick);
    }
    ticks.rotation.x = 0; // 刻度躺倒在桌面
    group.add(main, inner, ticks);
    // 柔光垫底
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(LAYOUT.rune.radius * 1.15, 48),
      new THREE.MeshBasicMaterial({ color: 0x3a2a12, transparent: true, opacity: 0.55 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.002;
    group.add(glow);
    group.position.set(LAYOUT.rune.x, 0.005, LAYOUT.rune.z);
    return { group, main, inner, ticks };
  }

  // 漂浮金尘
  function buildDust(THREE, count) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 1] = 0.2 + Math.random() * 2.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xf6dda0, size: 0.026, transparent: true, opacity: 0.55, depthWrite: false
    });
    const points = new THREE.Points(geom, mat);
    return { points, seeds, base: positions.slice() };
  }

  function createScene3D({ THREE, canvas, quality = 'high' }) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x130d08, 11, 24);
    scene.background = new THREE.Color(0x130d08);

    const aspect = (canvas.clientWidth || 16) / (canvas.clientHeight || 9);
    const camera = new THREE.PerspectiveCamera(LAYOUT.camera.fov, aspect, 0.1, 60);
    camera.position.set(...LAYOUT.camera.pos);
    camera.lookAt(...LAYOUT.camera.lookAt);

    // 相机运镜: 点击桌上牌 → 滑翔到牌跟前"拿起牌看"; resetView 滑回
    const CAM_HOME = { pos: [...LAYOUT.camera.pos], look: [...LAYOUT.camera.lookAt] };
    const curLook = new THREE.Vector3(...LAYOUT.camera.lookAt);
    let camAnim = null;
    let reviewing = false;
    function flyCam(toPos, toLook, duration = 0.5) {
      camAnim = {
        t: 0, duration,
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(toPos[0], toPos[1], toPos[2]),
        fromLook: curLook.clone(),
        toLook: new THREE.Vector3(toLook[0], toLook[1], toLook[2])
      };
    }
    function focusOn(center) {
      reviewing = true;
      flyCam([center.x, center.y + 0.95, center.z + 2.45], [center.x, center.y, center.z]);
    }
    function resetView() {
      reviewing = false;
      flyCam(CAM_HOME.pos, CAM_HOME.look);
    }
    function stepCamera(dt) {
      if (!camAnim) return;
      camAnim.t += dt;
      const k = Math.min(1, camAnim.t / camAnim.duration);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
      curLook.lerpVectors(camAnim.fromLook, camAnim.toLook, e);
      camera.lookAt(curLook);
      if (k >= 1) camAnim = null;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low' });
    } catch (error) {
      return null;
    }
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, quality === 'low' ? 1 : 2));
    renderer.setClearColor(0x0a0805, 1);
    // 电影级色调映射 + sRGB 输出: 高光不过曝、暗部有层次, 质感关键
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
    }
    if (THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 灯光: 暖环境底光 + 半球天光 + 战场主聚光 + 双侧卡位聚光
    scene.add(new THREE.AmbientLight(0xc9a875, 0.6));
    if (THREE.HemisphereLight) {
      const hemi = new THREE.HemisphereLight(0xffe2b0, 0x2a180c, 0.5);
      scene.add(hemi);
    }
    const mainSpot = new THREE.SpotLight(0xffcf96, 55, 20, 0.66, 0.5, 1.5);
    mainSpot.position.set(0, 7.5, -1.4);
    mainSpot.target.position.set(LAYOUT.rune.x, 0, LAYOUT.rune.z);
    scene.add(mainSpot, mainSpot.target);
    // 手牌主光: 正上方偏后, 保证手牌卡面被照亮
    const handKey = new THREE.SpotLight(0xffe8c4, 95, 16, 0.72, 0.45, 1.4);
    handKey.position.set(0, 6.2, 6.4);
    handKey.target.position.set(0, 0.6, LAYOUT.hand.z);
    scene.add(handKey, handKey.target);
    const playerSpot = new THREE.SpotLight(0xffe6bb, 70, 14, 0.5, 0.6, 1.7);
    playerSpot.position.set(0.4, 6.5, 4.4);
    playerSpot.target.position.set(0, 0, LAYOUT.hand.z - 0.6);
    scene.add(playerSpot, playerSpot.target);
    const opponentSpot = new THREE.SpotLight(0xaebbe8, 22, 14, 0.5, 0.65, 1.7);
    opponentSpot.position.set(-0.6, 6.5, -4.2);
    opponentSpot.target.position.set(LAYOUT.opponent.x, 0, LAYOUT.opponent.z);
    scene.add(opponentSpot, opponentSpot.target);

    // 桌面
    const tableCanvas = paintTableCanvas(document.createElement('canvas'));
    tableCanvas.width = 1024; tableCanvas.height = 1024;
    paintTableCanvas(tableCanvas);
    const tableTexture = new THREE.CanvasTexture(tableCanvas);
    tableTexture.colorSpace = THREE.SRGBColorSpace || 'srgb';
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: tableTexture, roughness: 0.9, metalness: 0.05 })
    );
    table.rotation.x = -Math.PI / 2;
    scene.add(table);

    const rune = buildRuneCircle(THREE);
    scene.add(rune.group);

    const dust = buildDust(THREE, quality === 'low' ? 60 : 130);
    scene.add(dust.points);

    let elapsed = 0;
    function update(dt) {
      elapsed += dt;
      stepCamera(dt);
      // 符文圈呼吸 + 缓转
      const breath = 0.42 + Math.sin(elapsed * 1.2) * 0.12;
      rune.main.material.opacity = breath;
      rune.inner.material.opacity = breath * 0.7;
      rune.group.rotation.y = elapsed * 0.05;
      // 金尘缓浮
      const pos = dust.points.geometry.attributes.position;
      for (let i = 0; i < dust.seeds.length; i += 1) {
        const s = dust.seeds[i];
        pos.array[i * 3] = dust.base[i * 3] + Math.sin(elapsed * 0.25 + s) * 0.25;
        pos.array[i * 3 + 1] = dust.base[i * 3 + 1] + Math.sin(elapsed * 0.18 + s * 2) * 0.2;
      }
      pos.needsUpdate = true;
    }

    function runePulse() {
      // 出牌落点脉冲: 临时提高主环亮度, 由 update 呼吸自然回落
      rune.main.material.opacity = 1;
      rune.main.scale.set(1.06, 1.06, 1.06);
      setTimeout(() => rune.main.scale.set(1, 1, 1), 180);
    }

    function handleResize() {
      const width = Math.max(1, globalThis.innerWidth || canvas.clientWidth || 1);
      const height = Math.max(1, globalThis.innerHeight || canvas.clientHeight || 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (canvas.style) { canvas.style.width = width + 'px'; canvas.style.height = height + 'px'; }
    }

    function dispose() {
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
      renderer.dispose();
    }

    handleResize();

    return {
      scene, camera, renderer, LAYOUT, update, runePulse, handleResize, dispose,
      focusOn, resetView,
      isReviewing: () => reviewing,
      getCamHome: () => CAM_HOME
    };
  }

  return { createScene3D, LAYOUT, paintTableCanvas, buildRuneCircle, buildDust };
});
