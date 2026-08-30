const g = window;
const Board = g.Table3dBoard;
if (!Board) throw new Error('Modern Strategy controls: board module missing');

const baseCreateBoard = Board.createBoard3D.bind(Board);

function labelTexture(THREE, text, color = '#d7c08a') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(256, 64, 10, 256, 64, 220);
  glow.addColorStop(0, 'rgba(8,13,20,.82)');
  glow.addColorStop(1, 'rgba(8,13,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = '700 40px "Outfit","PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace || 'srgb';
  return texture;
}

function addSpriteLabel(THREE, root, text, x, y, z, color) {
  const texture = labelTexture(THREE, text, color);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.72 });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(1.18, 0.295, 1);
  sprite.userData.decorative = true;
  root.add(sprite);
  return sprite;
}

Board.createBoard3D = function createInteractiveModernBoard(args) {
  const board = baseCreateBoard(args);
  const { THREE, LAYOUT, tweenEngine } = args;
  const root = board.root;

  // Identify the existing visible props created by board3d: the deck is the only
  // multi-slab group at initialization, the pack is the small box near packPos.
  const deckVisual = root.children.find(child => child.isGroup && child.children.filter(item => item.geometry?.type === 'BoxGeometry').length >= 4) || null;
  const packVisual = root.children.find(child => child.isMesh && child.geometry?.type === 'BoxGeometry' && Math.abs(child.position.x - LAYOUT.packPos.x) < 0.8 && Math.abs(child.position.z - LAYOUT.packPos.z) < 0.8) || null;

  function makeHitTarget(control, x, z, width, height, depth, visual) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, Math.max(0.14, height / 2), z);
    mesh.userData.tableControl = control;
    mesh.userData.controlTarget = visual || mesh;
    root.add(mesh);
    return mesh;
  }

  const deckHit = makeHitTarget('opponent-deck', LAYOUT.deckPos.x, LAYOUT.deckPos.z, 1.38, 0.34, 1.9, deckVisual);
  const packHit = makeHitTarget('pack', LAYOUT.packPos.x, LAYOUT.packPos.z, 1.22, 0.42, 1.48, packVisual);
  const deckLabel = addSpriteLabel(THREE, root, '对方牌堆', LAYOUT.deckPos.x, 0.33, LAYOUT.deckPos.z + 0.92, '#b9c9df');
  const packLabel = addSpriteLabel(THREE, root, '我的卡包', LAYOUT.packPos.x, 0.34, LAYOUT.packPos.z - 0.82, '#d8bc79');

  let hoveredControl = null;
  function resolveVisual(group) {
    if (!group) return null;
    return group.userData?.controlTarget || group;
  }
  function hoverControl(group) {
    const next = resolveVisual(group);
    if (next === hoveredControl) return;
    if (hoveredControl) {
      tweenEngine.to(hoveredControl.scale, { x: 1, y: 1, z: 1 }, { duration: 0.18, ease: 'easeOutCubic' });
    }
    hoveredControl = next;
    if (hoveredControl) {
      tweenEngine.to(hoveredControl.scale, { x: 1.08, y: 1.08, z: 1.08 }, { duration: 0.18, ease: 'easeOutCubic' });
    }
  }

  const baseGet = board.getBoardMeshes.bind(board);
  board.getBoardMeshes = () => [...baseGet(), deckHit, packHit];
  board.hoverControl = hoverControl;
  board.controlForGroup = group => group?.userData?.tableControl || null;

  const baseDispose = board.dispose.bind(board);
  board.dispose = () => {
    [deckHit, packHit].forEach(mesh => {
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
      root.remove(mesh);
    });
    [deckLabel, packLabel].forEach(sprite => {
      sprite.material?.map?.dispose?.();
      sprite.material?.dispose?.();
      root.remove(sprite);
    });
    baseDispose();
  };

  document.body.classList.add('table3d-controls-ready');
  return board;
};

export const modernStrategyControlsInstalled = true;
