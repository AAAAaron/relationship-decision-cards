// table3d: 装配层
// 组合 scene3d/hand3d/board3d/interact3d, 对 app.js 暴露一个状态同步桥
// bridge.sync(snapshot) 把 session 状态映射到 3D 场景; 交互通过 callbacks 回到业务层
(function initTable3dIndex(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dIndex = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dIndexApi(globalScope) {
  'use strict';

  function createTable3dBridge({ THREE, canvas, tweenFactory, sceneFactory, handFactory, boardFactory, interactFactory, callbacks = {} }) {
    const tween = (tweenFactory || globalScope.Table3dTween).createTweenEngine();
    const scene3d = (sceneFactory || globalScope.Table3dScene).createScene3D({ THREE, canvas });
    if (!scene3d) return null;
    const LAYOUT = scene3d.LAYOUT;
    const painter = globalScope.Table3dCardTexture.createCardTexturePainter({ THREE });
    const card3d = (globalScope.Table3dCard3d);
    const hand3d = (handFactory || globalScope.Table3dHand).createHand3D({
      THREE, painter, card3d, tweenEngine: tween,
      parentGroup: scene3d.scene,
      hand: { z: LAYOUT.hand.z, spacing: 0.8, curve: 0.14, ry: 0.1, rz: 0.07 }
    });
    const board3d = (boardFactory || globalScope.Table3dBoard).createBoard3D({
      THREE, painter, card3d, tweenEngine: tween, parentGroup: scene3d.scene, LAYOUT
    });

    let selectedId = null;
    let flying = false;
    const seen = { opponent: '', player: '', previous: '' };

    // hover: 手牌抬起
    function handleHover(group) {
      if (!group) { hand3d.hover(null); if (callbacks.onHandHover) callbacks.onHandHover(null); return; }
      const entry = hand3d.entryForGroup(group);
      if (entry) {
        hand3d.hover(entry.id);
        if (callbacks.onHandHover) callbacks.onHandHover(entry.id);
        return;
      }
      hand3d.hover(null);
      if (callbacks.onHandHover) callbacks.onHandHover(null);
    }

    function handleClick(group) {
      if (flying) return;
      if (group) {
        const entry = hand3d.entryForGroup(group);
        if (entry) {
          selectedId = selectedId === entry.id ? null : entry.id;
          hand3d.select(entry.id);
          if (callbacks.onHandSelect) callbacks.onHandSelect(selectedId, entry.data, entry.id);
          return;
        }
        if (group === board3d.playerGroup && callbacks.onBoardClick) { callbacks.onBoardClick('player'); return; }
        if (group === board3d.opponentGroup && callbacks.onBoardClick) { callbacks.onBoardClick('opponent'); return; }
      }
      // 点空白: 取消选中
      if (selectedId) {
        selectedId = null;
        hand3d.clearSelect();
        if (callbacks.onHandSelect) callbacks.onHandSelect(null, null, null);
      }
    }

    const interact = (interactFactory || globalScope.Table3dInteract).createInteract3D({
      THREE, canvas, domElement: canvas,
      targets: {
        camera: scene3d.camera,
        getMeshes: () => [...hand3d.cards.map(c => c.group), ...board3d.getBoardMeshes()]
      },
      onHover: handleHover,
      onClick: handleClick
    });

    // 状态同步: 手牌集合 / 战场双方牌 / 上轮堆叠 / 发牌动画
    function sync(snapshot) {
      const snap = snapshot || {};
      hand3d.setCards(snap.hand || []);
      if (snap.deal) hand3d.dealIn(0.07);
      if (snap.selectedId !== undefined) {
        selectedId = snap.selectedId;
      }
      const oppKey = snap.opponent ? JSON.stringify(snap.opponent) : '';
      if (oppKey !== seen.opponent) {
        seen.opponent = oppKey;
        if (snap.opponent) board3d.opponentPlay(snap.opponent);
      }
      const playerKey = snap.player ? JSON.stringify(snap.player) : '';
      if (playerKey !== seen.player) {
        seen.player = playerKey;
        if (snap.player) board3d.setPlayer(snap.player);
        else board3d.clearPlayer();
      }
      const prevKey = JSON.stringify(snap.previous || null);
      if (prevKey !== seen.previous) {
        seen.previous = prevKey;
        board3d.setPrevious(snap.previous || {});
      }
    }

    // 出牌: 选中的手牌飞到我方牌位, 落地后迸发; 返回 Promise
    function playSelectedHand() {
      return new Promise(resolve => {
        const entry = hand3d.cards.find(e => e.id === selectedId);
        if (!entry || flying) { resolve(false); return; }
        flying = true;
        const spec = entry.data;
        hand3d.select(null);
        board3d.playFromHand(entry.group, () => {
          hand3d.remove(entry.id);       // 触发剩余手牌重新收拢
          flying = false;
          selectedId = null;
          scene3d.runePulse();
          board3d.burstAt({ x: LAYOUT.player.x, z: LAYOUT.player.z });
          resolve({ id: entry.id, spec });
        });
      });
    }

    function saveFlight(onArrive) {
      board3d.saveFlight(() => { if (typeof onArrive === 'function') onArrive(); });
    }

    // 渲染循环: 场景有常驻氛围动画, 连续渲染; 页面隐藏时暂停
    let rafId = null;
    let last = 0;
    function loop(time) {
      rafId = null;
      if (typeof document !== 'undefined' && document.hidden) return;
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 0.016;
      last = time;
      tween.update(dt);
      scene3d.update(dt);
      board3d.update(dt);
      scene3d.renderer.render(scene3d.scene, scene3d.camera);
      rafId = requestAnimationFrame(loop);
    }
    function start() {
      if (rafId === null) { last = 0; rafId = requestAnimationFrame(loop); }
    }
    function onVisibility() { if (typeof document === 'undefined' || !document.hidden) start(); }
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibility);
    }

    function dispose() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      interact.dispose();
      hand3d.dispose();
      board3d.dispose();
      scene3d.dispose();
    }

    return {
      sync, playSelectedHand, saveFlight, start, dispose,
      selectHand(id) {
        selectedId = id;
        hand3d.select(id);
      },
      getSelectedId: () => selectedId,
      isFlying: () => flying,
      handleResize: () => scene3d.handleResize(),
      getStats: () => ({ hand: hand3d.cards.length, flying })
    };
  }

  return { createTable3dBridge };
});
