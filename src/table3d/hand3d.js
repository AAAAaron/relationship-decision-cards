// table3d: 3D 手牌扇形
// 卡牌直立微后仰 + 弧形排布; hover 抬起转向相机, 选中升到前景; 发牌弧线入场
// 纯布局计算(computeFanSlots)独立导出便于测试
(function initTable3dHand(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dHand = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dHandApi() {
  'use strict';

  // 扇形槽位计算: n 张牌的 offset/x/y/z/rotationY/rotationZ
  // 炉石式: 大幅重叠(固定间距), 边牌沿弧线沉降外旋, 底边沉出屏幕下缘
  function computeFanSlots(count, hand = { z: 3.0, spacing: 0.58, curve: 0.17, ry: 0.17, rz: 0.085, yDrop: 0.09 }) {
    const slots = [];
    // 重叠度固定, 张数多时轻微收紧并限宽
    let spacing = hand.spacing;
    const maxSpan = 3.9;
    if (count > 1) spacing = Math.min(spacing, (maxSpan - 1.1) / (count - 1));
    for (let i = 0; i < count; i += 1) {
      const offset = i - (count - 1) / 2;
      slots.push({
        offset,
        x: offset * spacing,
        y: -Math.abs(offset) * hand.yDrop,
        z: hand.z - Math.abs(offset) * hand.curve,
        ry: offset * hand.ry,
        rz: offset * hand.rz
      });
    }
    return slots;
  }

  const IDLE = { lift: -0.28, scale: 1.22, rx: -0.1 };
  const HOVER = { lift: 0.95, scale: 1.36, rx: 0.0 };
  const SELECT = { lift: 1.62, scale: 1.42, rx: 0.06 };

  function createHand3D({ THREE, painter, card3d, tweenEngine, parentGroup, hand }) {
    const root = new THREE.Group();
    root.name = 'hand';
    parentGroup.add(root);
    const cards = []; // { id, data, group, base, mode }
    let hoveredId = null;
    let selectedId = null;

    function modeParams(id) {
      if (id === selectedId) return SELECT;
      if (id === hoveredId) return HOVER;
      return IDLE;
    }

    // 把一张卡 tween 到它的槽位姿态
    function applySlot(entry, immediate = false) {
      const slot = entry.slot;
      const m = modeParams(entry.id);
      const target = {
        x: slot.x,
        y: m.lift,
        z: slot.z,
        rx: m.rx,
        ry: slot.ry * (entry.id === selectedId || entry.id === hoveredId ? 0.3 : 1),
        rz: slot.rz * (entry.id === selectedId || entry.id === hoveredId ? 0.25 : 1),
        scale: m.scale
      };
      const g = entry.group;
      if (immediate) {
        Object.assign(g.position, { x: target.x, y: target.y, z: target.z });
        g.rotation.set(target.rx, target.ry, target.rz);
        g.scale.setScalar(target.scale);
        return;
      }
      tweenEngine.to(g.position, { x: target.x, y: target.y, z: target.z }, { duration: 0.32, ease: 'easeOutCubic' });
      tweenEngine.to(g.rotation, { x: target.rx, y: target.ry, z: target.rz }, { duration: 0.32, ease: 'easeOutCubic' });
      tweenEngine.to(g.scale, { x: target.scale, y: target.scale, z: target.scale }, { duration: 0.32, ease: 'easeOutBack' });
    }

    function layout() {
      const slots = computeFanSlots(cards.length, hand);
      cards.forEach((entry, i) => {
        entry.slot = slots[i];
        applySlot(entry);
      });
    }

    return {
      root,
      cards,
      get hoveredId() { return hoveredId; },
      get selectedId() { return selectedId; },
      layout,
      // setCards([{id, data}]): 增量同步; data 为卡面 spec
      setCards(list) {
        const nextIds = list.map(c => c.id);
        // 移除消失的
        for (const entry of [...cards]) {
          if (!nextIds.includes(entry.id)) this.remove(entry.id);
        }
        list.forEach(c => {
          const existing = cards.find(e => e.id === c.id);
          if (existing) {
            existing.group.userData.card.updateSpec(c.data);
            existing.data = c.data;
          } else {
            const group = card3d.createCard3D({ THREE, painter, spec: c.data });
            group.name = 'hand-card-' + c.id;
            const entry = { id: c.id, data: c.data, group, slot: null };
            cards.push(entry);
            root.add(group);
          }
        });
        this.layout();
      },
      remove(id) {
        const idx = cards.findIndex(e => e.id === id);
        if (idx < 0) return;
        const [entry] = cards.splice(idx, 1);
        entry.group.userData.card.dispose();
        root.remove(entry.group);
        if (hoveredId === id) hoveredId = null;
        if (selectedId === id) selectedId = null;
        this.layout();
      },
      // 发牌: 卡牌从牌堆位置弧线飞入槽位, 依次延迟
      dealIn(delays = 0.06) {
        const deck = { x: -3.4, y: 0.3, z: -2.1 };
        const slots = computeFanSlots(cards.length, hand);
        cards.forEach((entry, i) => {
          entry.slot = slots[i];
          const g = entry.group;
          g.position.set(deck.x, deck.y, deck.z);
          g.rotation.set(-1.2, 0.6, 0.3);
          g.scale.setScalar(0.86);
          const m = modeParams(entry.id);
          const slot = entry.slot;
          tweenEngine.to(g.position, { x: slot.x, y: m.lift, z: slot.z }, { duration: 0.55, delay: i * delays, ease: 'easeOutCubic' });
          tweenEngine.to(g.rotation, { x: m.rx, y: slot.ry, z: slot.rz }, { duration: 0.55, delay: i * delays, ease: 'easeOutCubic' });
        });
      },
      hover(id) {
        if (hoveredId === id) return;
        hoveredId = id;
        cards.forEach(e => applySlot(e));
      },
      select(id) {
        selectedId = id === selectedId ? null : id;
        cards.forEach(e => applySlot(e));
      },
      clearSelect() {
        selectedId = null;
        cards.forEach(e => applySlot(e));
      },
      getSelectedEntry() {
        return cards.find(e => e.id === selectedId) || null;
      },
      entryForGroup(group) {
        let obj = group;
        while (obj) {
          const found = cards.find(e => e.group === obj);
          if (found) return found;
          obj = obj.parent;
        }
        return null;
      },
      dispose() {
        [...cards].forEach(e => this.remove(e.id));
        parentGroup.remove(root);
      }
    };
  }

  return { createHand3D, computeFanSlots, IDLE, HOVER, SELECT };
});
