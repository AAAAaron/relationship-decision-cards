const g = window;
const Scene = g.Table3dScene;
const Board = g.Table3dBoard;
const Hand = g.Table3dHand;
if (!Scene || !Board || !Hand) throw new Error('Top-down strategy table: base modules missing');

const FLAT_RX = -Math.PI / 2;
const BOARD_SCALE = 1.18;

// A near-overhead camera keeps a tiny amount of depth without turning the table
// into a side-view game board. Positive Z remains the user's side of the table.
if (Scene.LAYOUT) {
  Object.assign(Scene.LAYOUT.opponent, { x: 0, z: -2.25 });
  Object.assign(Scene.LAYOUT.player, { x: 0, z: -0.10 });
  Object.assign(Scene.LAYOUT.deckPos, { x: -3.25, z: -2.15 });
  Object.assign(Scene.LAYOUT.packPos, { x: 3.35, z: 2.25 });
  Scene.LAYOUT.hand.z = 2.62;
  Object.assign(Scene.LAYOUT.camera, {
    fov: 35,
    pos: [0, 12.6, 2.2],
    lookAt: [0, 0, -0.35]
  });
}

// Hand cards stay on the table. Hover/select only lift and enlarge slightly.
if (Hand.IDLE) Object.assign(Hand.IDLE, { lift: 0.055, scale: 0.98, rx: FLAT_RX });
if (Hand.HOVER) Object.assign(Hand.HOVER, { lift: 0.18, scale: 1.07, rx: FLAT_RX });
if (Hand.SELECT) Object.assign(Hand.SELECT, { lift: 0.26, scale: 1.11, rx: FLAT_RX });

const createSceneBase = Scene.createScene3D.bind(Scene);
Scene.createScene3D = function createTopDownScene(args) {
  const scene3d = createSceneBase(args);
  if (!scene3d) return scene3d;

  // The tabletop should read as a flat workspace, not a foggy horizon.
  scene3d.scene.fog = null;

  // Keep one stable camera while reading cards. Clicking a played card still
  // triggers the existing detail callback, but no longer flies the camera down
  // to a side angle.
  scene3d.focusOn = () => {};
  scene3d.resetView = () => {};
  scene3d.isReviewing = () => false;

  return scene3d;
};

function flattenGroup(group, { scale } = {}) {
  if (!group) return group;
  group.rotation.x = FLAT_RX;
  group.rotation.y = 0;
  if (Math.abs(group.rotation.z) > 0.16) group.rotation.z = 0;
  if (scale) group.scale.setScalar(scale);
  return group;
}

function flattenCardChildren(root, currentOpponent, currentPlayer) {
  if (!root) return;
  root.traverse?.(obj => {
    if (!obj?.userData?.card) return;
    obj.rotation.x = FLAT_RX;
    obj.rotation.y = 0;
    if (obj !== currentOpponent && obj !== currentPlayer) {
      // Previous cards stay smaller; preserve their existing scale.
      obj.position.y = Math.min(Number(obj.position.y || 0.03), 0.04);
    }
  });
}

const createBoardBase = Board.createBoard3D.bind(Board);
Board.createBoard3D = function createTopDownBoard(args) {
  const board = createBoardBase(args);
  const tween = args.tweenEngine;
  const LAYOUT = args.LAYOUT;

  const setPlayerBase = board.setPlayer.bind(board);
  board.setPlayer = spec => {
    const group = setPlayerBase(spec);
    group.position.y = 0.05;
    return flattenGroup(group, { scale: BOARD_SCALE });
  };

  const opponentPlayBase = board.opponentPlay.bind(board);
  board.opponentPlay = spec => {
    const group = opponentPlayBase(spec);
    // Add the final flat pose after the existing deal animation. The last tween
    // wins, then the timeout guarantees the exact resting orientation.
    tween.to(group.rotation, { x: FLAT_RX, y: 0, z: 0 }, { duration: 0.46, ease: 'easeOutCubic' });
    tween.to(group.scale, { x: BOARD_SCALE, y: BOARD_SCALE, z: BOARD_SCALE }, { duration: 0.36 });
    setTimeout(() => {
      if (!group?.parent) return;
      group.rotation.set(FLAT_RX, 0, 0);
      group.position.y = 0.05;
      group.scale.setScalar(BOARD_SCALE);
    }, 540);
    return group;
  };

  const setPreviousBase = board.setPrevious.bind(board);
  board.setPrevious = previous => {
    const result = setPreviousBase(previous);
    flattenCardChildren(board.root, board.opponentGroup, board.playerGroup);
    return result;
  };

  // Replace the old airborne/standing finish with a short tabletop slide.
  board.playFromHand = (group, onComplete) => {
    const dst = { x: LAYOUT.player.x, y: 0.05, z: LAYOUT.player.z };
    const mid = {
      x: (group.position.x + dst.x) / 2,
      y: 0.30,
      z: (group.position.z + dst.z) / 2
    };
    tween.to(group.position, mid, { duration: 0.22, ease: 'easeOutCubic' });
    tween.to(group.rotation, { x: FLAT_RX, y: 0, z: 0 }, { duration: 0.22, ease: 'easeOutCubic' });
    tween.to(group.scale, { x: BOARD_SCALE, y: BOARD_SCALE, z: BOARD_SCALE }, { duration: 0.22 });
    tween.to(group.position, dst, {
      duration: 0.26,
      delay: 0.21,
      ease: 'easeOutCubic',
      onComplete: () => {
        group.rotation.set(FLAT_RX, 0, 0);
        if (typeof onComplete === 'function') onComplete();
      }
    });
    return group;
  };

  // Played-card hover should remain a small lift, not a tilt toward the camera.
  const hoverBase = board.hover?.bind(board);
  board.hover = group => {
    hoverBase?.(group);
    flattenGroup(board.opponentGroup);
    flattenGroup(board.playerGroup);
  };

  // Existing cards may already have been created during initial sync.
  flattenCardChildren(board.root, board.opponentGroup, board.playerGroup);
  flattenGroup(board.opponentGroup, { scale: BOARD_SCALE });
  flattenGroup(board.playerGroup, { scale: BOARD_SCALE });

  return board;
};

document.body.classList.add('topdown-strategy-table');

export const modernStrategyTopDownInstalled = true;
