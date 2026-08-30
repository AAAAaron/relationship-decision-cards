const g = window;
const Scene = g.Table3dScene;
const Hand = g.Table3dHand;
const Card3d = g.Table3dCard3d;
if (!Scene || !Hand || !Card3d) throw new Error('Modern Strategy tuning: base modules missing');

const FINAL_LAYOUT = {
  opponent: { x: 0, z: -2.65 },
  player: { x: 0, z: -0.30 },
  deckPos: { x: -3.55, z: -2.45 },
  packPos: { x: 3.55, z: 2.15 },
  handZ: 2.82,
  camera: { fov: 40, pos: [0, 4.55, 10.55], lookAt: [0, 0.42, -0.72] }
};

// Apply exported constants early for modules that read LAYOUT before scene creation.
if (Scene.LAYOUT) {
  Object.assign(Scene.LAYOUT.opponent, FINAL_LAYOUT.opponent);
  Object.assign(Scene.LAYOUT.player, FINAL_LAYOUT.player);
  Object.assign(Scene.LAYOUT.deckPos, FINAL_LAYOUT.deckPos);
  Object.assign(Scene.LAYOUT.packPos, FINAL_LAYOUT.packPos);
  Scene.LAYOUT.hand.z = FINAL_LAYOUT.handZ;
  Object.assign(Scene.LAYOUT.camera, FINAL_LAYOUT.camera);
}

// modern-strategy.js itself wraps createScene3D and sets several positions.
// Re-apply the final composition *after* that wrapper runs so this tuning layer is
// authoritative, then update the real camera (not only the exported constants).
const createSceneBase = Scene.createScene3D.bind(Scene);
Scene.createScene3D = function createTunedStrategyScene(opts) {
  const scene = createSceneBase(opts);
  if (!scene) return scene;

  Object.assign(scene.LAYOUT.opponent, FINAL_LAYOUT.opponent);
  Object.assign(scene.LAYOUT.player, FINAL_LAYOUT.player);
  Object.assign(scene.LAYOUT.deckPos, FINAL_LAYOUT.deckPos);
  Object.assign(scene.LAYOUT.packPos, FINAL_LAYOUT.packPos);
  scene.LAYOUT.hand.z = FINAL_LAYOUT.handZ;
  Object.assign(scene.LAYOUT.camera, FINAL_LAYOUT.camera);

  scene.camera.fov = FINAL_LAYOUT.camera.fov;
  scene.camera.position.set(...FINAL_LAYOUT.camera.pos);
  scene.camera.updateProjectionMatrix();

  // The base scene keeps its look-at vector privately, so use the public camera
  // here for the home framing. focusOn/resetView still use the same semantic center.
  scene.camera.lookAt(...FINAL_LAYOUT.camera.lookAt);
  return scene;
};

// Calm the hand: less arcade-like jump, tighter overlap, stronger hierarchy.
if (Hand.IDLE) Object.assign(Hand.IDLE, { lift: -0.24, scale: 1.02, rx: -0.08 });
if (Hand.HOVER) Object.assign(Hand.HOVER, { lift: 0.56, scale: 1.14, rx: -0.015 });
if (Hand.SELECT) Object.assign(Hand.SELECT, { lift: 0.92, scale: 1.20, rx: 0.015 });

const createHandBase = Hand.createHand3D.bind(Hand);
Hand.createHand3D = function createModernHand(args) {
  return createHandBase({
    ...args,
    hand: {
      ...(args.hand || {}),
      z: FINAL_LAYOUT.handZ,
      spacing: 0.52,
      curve: 0.12,
      ry: 0.115,
      rz: 0.055,
      yDrop: 0.052
    }
  });
};

// Reduce all 3D cards slightly. Board cards still read larger because board3d
// applies its own 1.32 scale, while the hand stays compact near the viewport edge.
const createCardBase = Card3d.createCard3D.bind(Card3d);
Card3d.createCard3D = function createModernSizedCard(args) {
  const options = args.options || {};
  const width = options.width || 0.92;
  return createCardBase({
    ...args,
    options: {
      ...options,
      width,
      height: options.height || width * 1.60
    }
  });
};

// CSS for the second-pass HUD/edge-control tuning. Resolve relative to this
// module so source and built GitHub Pages paths both work.
if (!document.querySelector('link[data-modern-strategy-tuning]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./modern-strategy-tuning.css', import.meta.url).href;
  link.dataset.modernStrategyTuning = '1';
  document.head.appendChild(link);
}

export const modernStrategyTuningInstalled = true;
