// table3d: 3D 卡牌网格
// 圆角挤出几何体(带厚度) + 正反面 CanvasTexture 材质; flip/lift 等动效由外部 tween 驱动
// 依赖注入 THREE, Node 环境可 mock 测试参数计算
(function initTable3dCard(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dCard3d = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dCard3dApi() {
  'use strict';

  // 圆角卡牌形状(单位卡: 宽1 高1.6, 圆角比例随短边)
  function roundedCardShape(THREE, w, h, r) {
    const x = -w / 2, y = -h / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  // createCard3D({ THREE, painter, spec, options })
  // spec: { kind, rank, title, quote, meta, back }
  // options: { width=1, height=1.6, depth=0.02 }
  // 返回 group: .mesh(体) .front/.back 材质, .baseY 等动画基准由外部维护
  function createCard3D({ THREE, painter, spec, options = {} }) {
    const width = options.width || 1;
    const height = options.height || width * 1.6;
    const depth = options.depth || 0.055;
    const radius = Math.min(width, height) * 0.055;

    const geometry = new THREE.ExtrudeGeometry(roundedCardShape(THREE, width, height, radius), {
      depth: depth - 0.008,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
      curveSegments: 8
    });
    geometry.center();

    // 正反面贴图: ExtrudeGeometry 的 UV 是按形状坐标的, 需要 UV 变换到 0..1
    // 简化方案: 用两个贴面 PlaneGeometry 贴正反面, 挤出体只做侧面/厚度
    const group = new THREE.Group();
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: options.sideColor || 0xb08a3e,
      roughness: 0.35,
      metalness: 0.45
    });
    const body = new THREE.Mesh(geometry, sideMaterial);
    body.name = 'card-body';
    group.add(body);

    const faceGeometry = new THREE.PlaneGeometry(width, height);
    const frontMaterial = new THREE.MeshStandardMaterial({
      map: painter.frontTexture(spec),
      roughness: 0.5,
      metalness: 0.08,
      emissive: 0x2a2115,
      emissiveIntensity: 0.55
    });
    const front = new THREE.Mesh(faceGeometry, frontMaterial);
    front.position.z = depth / 2 + 0.001;
    front.name = 'card-front';
    group.add(front);

    const backMaterial = new THREE.MeshStandardMaterial({
      map: painter.backTexture(spec),
      roughness: 0.5,
      metalness: 0.08,
      emissive: 0x2a2115,
      emissiveIntensity: 0.55
    });
    const back = new THREE.Mesh(faceGeometry, backMaterial);
    back.position.z = -(depth / 2 + 0.001);
    back.rotation.y = Math.PI;
    back.name = 'card-back';
    group.add(back);

    group.userData.card = {
      spec,
      body, front, back,
      frontMaterial, backMaterial,
      dispose() {
        geometry.dispose();
        faceGeometry.dispose();
        frontMaterial.dispose();
        backMaterial.dispose();
        sideMaterial.dispose();
      },
      // 内容不变时复用同一 group
      updateSpec(nextSpec) {
        frontMaterial.map = painter.frontTexture(nextSpec);
        backMaterial.map = painter.backTexture(nextSpec);
        frontMaterial.needsUpdate = true;
        backMaterial.needsUpdate = true;
        group.userData.card.spec = nextSpec;
      }
    };
    return group;
  }

  return { createCard3D, roundedCardShape };
});
