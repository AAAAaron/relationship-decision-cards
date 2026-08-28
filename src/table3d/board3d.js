// table3d: 战场
// 对方/我方牌位 + 上轮深度堆叠 + 牌堆/卡包摆件 + 出牌飞行/粒子迸发/收藏光点
(function initTable3dBoard(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dBoard = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dBoardApi() {
  'use strict';

  const STAND = { rx: -0.62, lift: 0.12 };   // 场上牌立起后仰
  const LYING = { rx: -1.35, lift: 0.03 };   // 上轮牌几乎躺平

  function createBoard3D({ THREE, painter, card3d, tweenEngine, parentGroup, LAYOUT }) {
    const root = new THREE.Group();
    root.name = 'board';
    parentGroup.add(root);

    let opponentCard = null;  // group
    let playerCard = null;
    let previousOpponent = null;
    let previousPlayer = null;

    function standPose(pos, mode = STAND) {
      return { x: pos.x, y: mode.lift, z: pos.z, rx: mode.rx, ry: 0, rz: 0 };
    }
    const BOARD_SCALE = 1.32;

    function placeAt(group, pose) {
      group.position.set(pose.x, pose.y, pose.z);
      group.rotation.set(pose.rx, pose.ry, pose.rz);
      group.scale.setScalar(BOARD_SCALE);
    }

    function ensureCard(current, spec, pos, mode) {
      if (current) {
        current.userData.card.updateSpec(spec);
        return current;
      }
      const group = card3d.createCard3D({ THREE, painter, spec });
      placeAt(group, standPose(pos, mode));
      root.add(group);
      return group;
    }

    // 上轮深度堆叠: 更小/躺平/向外后方错开, 与当前牌形成清晰层次
    function previousPose(pos) {
      return { x: pos.x + Math.sign(pos.x || 1) * 0.7, y: LYING.lift, z: pos.z - 0.9, rx: LYING.rx, ry: 0, rz: 0 };
    }
    function setPreviousCard(holder, spec, pos) {
      if (holder.group) {
        root.remove(holder.group);
        holder.group.userData.card.dispose();
        holder.group = null;
      }
      if (!spec) return;
      const group = card3d.createCard3D({ THREE, painter, spec });
      const pose = previousPose(pos);
      placeAt(group, pose);
      group.scale.setScalar(0.66);
      root.add(group);
      holder.group = group;
    }

    // 牌位刻痕: 桌面上发光圆角虚线框, 空位时也提示"这里放牌"
    function paintSlotCanvas() {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 400;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 256, 400);
      ctx.strokeStyle = 'rgba(231,189,101,0.55)';
      ctx.lineWidth = 5;
      ctx.setLineDash([18, 12]);
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(14, 14, 228, 372, 26);
        ctx.stroke();
      } else {
        ctx.strokeRect(14, 14, 228, 372);
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(231,189,101,0.16)';
      ctx.lineWidth = 2;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(6, 6, 244, 388, 30);
        ctx.stroke();
      }
      return canvas;
    }
    function buildSlotMarker(pos) {
      const canvas = paintSlotCanvas();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace || 'srgb';
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(LAYOUT.cardW * 1.18, LAYOUT.cardH * 1.18),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.85, depthWrite: false })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, 0.012, pos.z);
      root.add(mesh);
      return mesh;
    }
    buildSlotMarker(LAYOUT.opponent);
    buildSlotMarker(LAYOUT.player);

    // 牌堆: 一叠卡背(细盒体堆叠)
    function buildDeckPile() {
      const pile = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x172945, roughness: 0.7 });
      for (let i = 0; i < 4; i += 1) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(LAYOUT.cardW, 0.018, LAYOUT.cardH), mat);
        slab.position.set(LAYOUT.deckPos.x, 0.012 + i * 0.02, LAYOUT.deckPos.z);
        slab.rotation.y = (Math.random() - 0.5) * 0.12;
        pile.add(slab);
      }
      root.add(pile);
      return pile;
    }
    // 卡包: 右下角一个金色小块
    function buildPackGem() {
      const gem = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.09, 0.72),
        new THREE.MeshStandardMaterial({ color: 0x8a6a1f, roughness: 0.4, metalness: 0.5 })
      );
      gem.position.set(LAYOUT.packPos.x, 0.05, LAYOUT.packPos.z);
      gem.rotation.y = -0.35;
      root.add(gem);
      return gem;
    }

    buildDeckPile();
    buildPackGem();

    // 出牌飞行: 手牌组 → 我方牌位弧线, 完成后回调
    function playFromHand(group, onComplete) {
      const dst = standPose(LAYOUT.player);
      dst.scale = BOARD_SCALE;
      const mid = { x: (group.position.x + dst.x) / 2, y: 1.7, z: (group.position.z + dst.z) / 2 - 0.4 };
      // 第一段: 升空到弧顶
      tweenEngine.to(group.position, { x: mid.x, y: mid.y, z: mid.z }, { duration: 0.3, ease: 'easeOutCubic' });
      tweenEngine.to(group.rotation, { x: -1.1, y: 0.5, z: 0 }, { duration: 0.3, ease: 'easeOutCubic' });
      tweenEngine.to(group.scale, { x: BOARD_SCALE, y: BOARD_SCALE, z: BOARD_SCALE }, { duration: 0.3, delay: 0.1 });
      // 第二段: 落到牌位
      tweenEngine.to(group.position, { x: dst.x, y: dst.y, z: dst.z }, { duration: 0.34, delay: 0.3, ease: 'easeOutCubic', onComplete: () => {
        tweenEngine.to(group.rotation, { x: dst.rx, y: 0, z: 0 }, { duration: 0.2 });
        if (typeof onComplete === 'function') onComplete();
      } });
      return group;
    }

    // 对方出牌: 从牌堆翻转飞入对方位
    function opponentPlay(spec) {
      opponentCard = ensureCard(opponentCard, spec, LAYOUT.opponent);
      const g = opponentCard;
      g.position.set(LAYOUT.deckPos.x + 0.6, 0.6, LAYOUT.deckPos.z + 0.8);
      g.rotation.set(-1.3, -0.8, 0.2);
      const dst = standPose(LAYOUT.opponent);
      tweenEngine.to(g.position, { x: dst.x, y: dst.y, z: dst.z }, { duration: 0.6, ease: 'easeOutCubic' });
      tweenEngine.to(g.rotation, { x: dst.rx, y: 0, z: 0 }, { duration: 0.6, ease: 'easeOutCubic' });
      return g;
    }

    // 落点粒子迸发
    let burst = null;
    function burstAt(pos) {
      if (burst) {
        root.remove(burst.points);
        burst.points.geometry.dispose();
        burst = null;
      }
      const count = 26;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.12 + Math.random() * 0.16;
        positions[i * 3] = pos.x + Math.cos(a) * r;
        positions[i * 3 + 1] = 0.1;
        positions[i * 3 + 2] = pos.z + Math.sin(a) * r;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ color: 0xf6dda0, size: 0.05, transparent: true, opacity: 0.95, depthWrite: false });
      const points = new THREE.Points(geom, mat);
      points.userData.card = null; // 不参与拾取
      root.add(points);
      burst = { points, mat, t: 0 };
    }

    // 收藏: 两个光点从双方牌位汇合飞向卡包; 到达时回调
    function saveFlight(onArrive) {
      const sparks = [];
      [LAYOUT.opponent, LAYOUT.player].forEach((src, idx) => {
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xf6dda0, transparent: true, opacity: 0.95 })
        );
        spark.position.set(src.x, 0.4, src.z);
        root.add(spark);
        sparks.push(spark);
        tweenEngine.to(spark.position, {
          x: (src.x + LAYOUT.packPos.x) / 2 + (idx ? 0.3 : -0.3),
          y: 1.3,
          z: (src.z + LAYOUT.packPos.z) / 2
        }, { duration: 0.34, delay: idx * 0.05, ease: 'easeOutCubic' });
        tweenEngine.to(spark.position, {
          x: LAYOUT.packPos.x, y: 0.25, z: LAYOUT.packPos.z
        }, { duration: 0.36, delay: 0.36 + idx * 0.05, ease: 'easeOutCubic', onComplete: () => {
          tweenEngine.to(spark.material, { opacity: 0 }, { duration: 0.25, onComplete: () => {
            root.remove(spark);
            spark.geometry.dispose();
            spark.material.dispose();
            if (idx === 1 && typeof onArrive === 'function') onArrive();
          } });
        } });
      });
    }

    function update(dt) {
      if (burst) {
        burst.t += dt;
        const k = Math.min(1, burst.t / 0.55);
        burst.points.scale.set(1 + k * 2.6, 1, 1 + k * 2.6);
        burst.mat.opacity = 0.95 * (1 - k);
        if (k >= 1) {
          root.remove(burst.points);
          burst.points.geometry.dispose();
          burst = null;
        }
      }
    }

    // 战场牌 hover: 抬起并转向相机, 文字可读; 移开回落
    let hoveredBoard = null;
    function hover(group) {
      if (hoveredBoard === group) return;
      const restore = (card) => {
        if (!card) return;
        const pose = standPose(card === playerCard ? LAYOUT.player : LAYOUT.opponent);
        tweenEngine.to(card.position, { y: pose.y }, { duration: 0.25 });
        tweenEngine.to(card.rotation, { x: pose.rx }, { duration: 0.25 });
      };
      restore(hoveredBoard);
      hoveredBoard = group;
      if (group) {
        tweenEngine.to(group.position, { y: standPose(LAYOUT.player).y + 0.55 }, { duration: 0.25 });
        tweenEngine.to(group.rotation, { x: -0.18 }, { duration: 0.25 });
      }
    }

    function getBoardMeshes() {
      const meshes = [];
      if (playerCard) meshes.push(playerCard);
      if (opponentCard) meshes.push(opponentCard);
      return meshes;
    }

    function dispose() {
      [opponentCard, playerCard, previousOpponent && previousOpponent.group, previousPlayer && previousPlayer.group]
        .filter(Boolean).forEach(g => {
          g.userData.card.dispose();
          root.remove(g);
        });
      parentGroup.remove(root);
    }

    return {
      root,
      get playerGroup() { return playerCard; },
      get opponentGroup() { return opponentCard; },
      setOpponent(spec) { opponentCard = ensureCard(opponentCard, spec, LAYOUT.opponent); return opponentCard; },
      setPlayer(spec) { playerCard = ensureCard(playerCard, spec, LAYOUT.player); return playerCard; },
      setPrevious({ opponent, player }) {
        setPreviousCard(previousOpponent = previousOpponent || {}, opponent, LAYOUT.opponent);
        setPreviousCard(previousPlayer = previousPlayer || {}, player, LAYOUT.player);
      },
      playFromHand,
      opponentPlay,
      burstAt,
      saveFlight,
      update,
      getBoardMeshes,
      clearPlayer() {
        if (playerCard) {
          playerCard.userData.card.dispose();
          root.remove(playerCard);
          playerCard = null;
        }
      },
      dispose
    };
  }

  return { createBoard3D, STAND, LYING };
});
