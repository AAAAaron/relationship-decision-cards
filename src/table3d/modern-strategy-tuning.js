const g = window;
const Scene = g.Table3dScene;
const Hand = g.Table3dHand;
const Card3d = g.Table3dCard3d;
if (!Scene || !Hand || !Card3d) throw new Error('Modern Strategy tuning: base modules missing');

// Second-pass composition tuning. This module intentionally mutates only exported
// visual constants/factories before Table3dBridge is created.
if (Scene.LAYOUT) {
  Object.assign(Scene.LAYOUT.opponent, { x: 0, z: -2.65 });
  Object.assign(Scene.LAYOUT.player, { x: 0, z: -0.30 });
  Object.assign(Scene.LAYOUT.deckPos, { x: -3.55, z: -2.45 });
  Object.assign(Scene.LAYOUT.packPos, { x: 3.55, z: 2.15 });
  Scene.LAYOUT.hand.z = 2.82;
  Object.assign(Scene.LAYOUT.camera, {
    fov: 40,
    pos: [0, 4.55, 10.55],
    lookAt: [0, 0.42, -0.72]
  });
}

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
