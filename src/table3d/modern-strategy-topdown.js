const g = window;
const Scene = g.Table3dScene;
const Board = g.Table3dBoard;
const Hand = g.Table3dHand;
if (!Scene || !Board || !Hand) throw new Error('Top-down strategy table: base modules missing');

const FLAT_RX = -Math.PI / 2;
const BOARD_SCALE = 1.14;
const BOARD_Y = 0.055;

// Communication-first tabletop: true overhead view. Perspective remains only to
// reuse the mature renderer/resize path; the camera itself is directly above the
// table so cards read like a physical decision workspace rather than a 3D arena.
if (Scene.LAYOUT) {
  Object.assign(Scene.LAYOUT.opponent, { x: 0, z: -2.15 });
  Object.assign(Scene.LAYOUT.player, { x: 0, z: -0.15 });
  Object.assign(Scene.LAYOUT.deckPos, { x: -3.25, z: -2.15 });
  Object.assign(Scene.LAYOUT.packPos, { x: 3.35, z: 2.20 });
  Scene.LAYOUT.hand.z = 2.20;
  Object.assign(Scene.LAYOUT.camera, {
    fov: 32,
    pos: [0, 13.4, 0.01],
    lookAt: [0, 0, 0]
  });
}

// Hand cards stay on the tabletop. Hover/select only change height and size.
if (Hand.IDLE) Object.assign(Hand.IDLE, { lift: 0.060, scale: 0.94, rx: FLAT_RX });
if (Hand.HOVER) Object.assign(Hand.HOVER, { lift: 0.145, scale: 1.035, rx: FLAT_RX });
if (Hand.SELECT) Object.assign(Hand.SELECT, { lift: 0.205, scale: 1.085, rx: FLAT_RX });

// Replace the remaining Hearthstone fan with a quiet row of alternatives. Cards
// may overlap a little on narrow layouts, but do not curve or rotate away from
// the reading direction.
const createHandBase = Hand.createHand3D.bind(Hand);
Hand.createHand3D = function createTabletopHand(args) {
  return createHandBase({
    ...args,
    hand: {
      ...(args.hand || {}),
      z: Scene.LAYOUT?.hand?.z ?? 2.20,
      spacing: 0.82,
      curve: 0.018,
      ry: 0,
      rz: 0,
      yDrop: 0
    }
  });
};

const createSceneBase = Scene.createScene3D.bind(Scene);
Scene.createScene3D = function createTopDownScene(args) {
  const scene3d = createSceneBase(args);
  if (!scene3d) return scene3d;

  scene3d.scene.fog = null;

  // Make the view genuinely overhead. Explicit camera.up avoids the singularity
  // caused by using the default Y-up vector while looking straight down Y.
  scene3d.camera.up.set(0, 0, -1);
  scene3d.camera.position.set(0, 13.4, 0);
  scene3d.camera.lookAt(0, 0, 0);
  scene3d.camera.updateProjectionMatrix();

  // Reading a played card should not change the global viewing angle. Detail and
  // card-back interactions remain available through the existing callbacks.
  scene3d.focusOn = () => {};
  scene3d.resetView = () => {};
  scene3d.isReviewing = () => false;

  return scene3d;
};

function flattenGroup(group, { scale, y = BOARD_Y } = {}) {
  if (!group) return group;
  group.position.y = y;
  group.rotation.set(FLAT_RX, 0, 0);
  if (scale) group.scale.setScalar(scale);
  return group;
}

function flattenCardChildren(root) {
  if (!root) return;
  root.traverse?.(obj => {
    if (!obj?.userData?.card) return;
    obj.rotation.set(FLAT_RX, 0, 0);
    obj.position.y = Math.min(Number(obj.position.y || 0.03), 0.04);
  });
}

const createBoardBase = Board.createBoard3D.bind(Board);
Board.createBoard3D = function createTopDownBoard(args) {
  const board = createBoardBase(args);
  const tween = args.tweenEngine;
  const LAYOUT = args.LAYOUT;

  // Both initial sync and animated opponent plays end in the same flat pose.
  const setOpponentBase = board.setOpponent.bind(board);
  board.setOpponent = spec => flattenGroup(setOpponentBase(spec), { scale: BOARD_SCALE });

  const setPlayerBase = board.setPlayer.bind(board);
  board.setPlayer = spec => flattenGroup(setPlayerBase(spec), { scale: BOARD_SCALE });

  const opponentPlayBase = board.opponentPlay.bind(board);
  board.opponentPlay = spec => {
    const group = opponentPlayBase(spec);
    tween.to(group.position, { y: BOARD_Y }, { duration: 0.36, ease: 'easeOutCubic' });
    tween.to(group.rotation, { x: FLAT_RX, y: 0, z: 0 }, { duration: 0.40, ease: 'easeOutCubic' });
    tween.to(group.scale, { x: BOARD_SCALE, y: BOARD_SCALE, z: BOARD_SCALE }, { duration: 0.32 });
    setTimeout(() => {
      if (!group?.parent) return;
      flattenGroup(group, { scale: BOARD_SCALE });
    }, 470);
    return group;
  };

  const setPreviousBase = board.setPrevious.bind(board);
  board.setPrevious = previous => {
    const result = setPreviousBase(previous);
    flattenCardChildren(board.root);
    return result;
  };

  // A short tabletop slide replaces the old airborne arc and standing finish.
  board.playFromHand = (group, onComplete) => {
    const dst = { x: LAYOUT.player.x, y: BOARD_Y, z: LAYOUT.player.z };
    const mid = {
      x: (group.position.x + dst.x) / 2,
      y: 0.16,
      z: (group.position.z + dst.z) / 2
    };
    tween.to(group.position, mid, { duration: 0.20, ease: 'easeOutCubic' });
    tween.to(group.rotation, { x: FLAT_RX, y: 0, z: 0 }, { duration: 0.18, ease: 'easeOutCubic' });
    tween.to(group.scale, { x: BOARD_SCALE, y: BOARD_SCALE, z: BOARD_SCALE }, { duration: 0.20 });
    tween.to(group.position, dst, {
      duration: 0.24,
      delay: 0.19,
      ease: 'easeOutCubic',
      onComplete: () => {
        flattenGroup(group, { scale: BOARD_SCALE });
        if (typeof onComplete === 'function') onComplete();
      }
    });
    return group;
  };

  // Do not call the legacy hover implementation: it deliberately tilts cards
  // toward a side-view camera. Overhead mode only lifts the target card.
  board.hover = group => {
    const groups = [board.opponentGroup, board.playerGroup].filter(Boolean);
    groups.forEach(card => {
      const targetY = card === group ? 0.125 : BOARD_Y;
      tween.to(card.position, { y: targetY }, { duration: 0.18, ease: 'easeOutCubic' });
      tween.to(card.rotation, { x: FLAT_RX, y: 0, z: 0 }, { duration: 0.16, ease: 'easeOutCubic' });
    });
  };

  flattenCardChildren(board.root);
  flattenGroup(board.opponentGroup, { scale: BOARD_SCALE });
  flattenGroup(board.playerGroup, { scale: BOARD_SCALE });

  return board;
};

document.body.classList.add('topdown-strategy-table');

export const modernStrategyTopDownInstalled = true;
