// 关系决策牌组：Three.js 关键动作特效（依赖注入 THREE，便于测试）
// 8.2 对方出牌 / 8.3 手牌重新发出 / 8.4 我方出牌 / 8.5 回合收藏
// 每个 effect 暴露 start(detail) / update(dt) / isAlive() 三个方法
(function initStageFxEffects(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipStageFxEffects = api;
})(typeof window !== 'undefined' ? window : globalThis, function createStageFxEffectsApi() {
  'use strict';

  // DOM 矩形 → canvas 归一化坐标 (-1..1 范围)
  function domRectToCanvasPoint(rect, canvasRect) {
    if (!rect || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;
    const cx = rect.left + rect.width / 2 - canvasRect.left;
    const cy = rect.top + rect.height / 2 - canvasRect.top;
    return {
      x: (cx / canvasRect.width) * 2 - 1,
      y: -(cy / canvasRect.height) * 2 + 1
    };
  }

  function createEffectBus() {
    const effects = new Set();
    return {
      add(effect) { if (effect) effects.add(effect); },
      remove(effect) { effects.delete(effect); },
      clear() {
        for (const e of effects) {
          try { if (typeof e.dispose === 'function') e.dispose(); } catch (error) { /* noop */ }
        }
        effects.clear();
      },
      activeCount() { return effects.size; },
      getEffects() { return [...effects]; },
      update(dt) {
        for (const e of effects) {
          try { e.update(dt); } catch (error) { /* 单个 effect 异常不影响其他 */ }
        }
        for (const e of [...effects]) {
          if (!e.isAlive()) {
            try { if (typeof e.dispose === 'function') e.dispose(); } catch (error) { /* noop */ }
            effects.delete(e);
          }
        }
      },
      render(THREE, scene) {
        for (const e of effects) {
          if (typeof e.render === 'function') {
            try { e.render(THREE, scene); } catch (error) { /* noop */ }
          }
        }
      }
    };
  }

  // 8.2 对方出牌：弧形光轨 + 落点波纹
  // 总时长 900ms
  function createOpponentPlayEffect(ctx) {
    const THREE = ctx && ctx.THREE;
    const canvas = ctx && ctx.canvas;
    let elapsed = 0;
    let alive = false;
    let objects = null;
    const DURATION = 0.9;
    function rectToPoint(rect, canvasRect) {
      if (!rect || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;
      const cx = rect.left + rect.width / 2 - canvasRect.left;
      const cy = rect.top + rect.height / 2 - canvasRect.top;
      return { x: (cx / canvasRect.width) * 2 - 1, y: -(cy / canvasRect.height) * 2 + 1 };
    }
    const effect = {
      start(detail) {
        elapsed = 0;
        alive = true;
        effect.detail = detail || {};
        if (!THREE) return;
        const canvasRect = canvas && typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
        const src = rectToPoint(detail && detail.sourceRect, canvasRect);
        const dst = rectToPoint(detail && detail.targetRect, canvasRect);
        if (!src || !dst) return;
        const curvePoints = THREE.QuadraticBezierCurve3
          ? new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(src.x, src.y, 0),
              new THREE.Vector3((src.x + dst.x) / 2, Math.max(src.y, dst.y) + 0.6, 0),
              new THREE.Vector3(dst.x, dst.y, 0)
            ).getPoints(32)
          : [
              new THREE.Vector3(src.x, src.y, 0),
              new THREE.Vector3((src.x + dst.x) / 2, Math.max(src.y, dst.y) + 0.6, 0),
              new THREE.Vector3(dst.x, dst.y, 0)
            ];
        // 用 Points 沿曲线分布（Line linewidth 在 WebGL 固定 1px 不可见）
        const arcGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const arcMat = new THREE.PointsMaterial({
          color: 0xf6dda0,
          size: 0.05,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0
        });
        const arc = new THREE.Points(arcGeom, arcMat);
        // 落点波纹：用 Points 沿环分布（RingGeometry 在 WebGL 单面）
        const ringSegments = 40;
        const ringPositions = new Float32Array(ringSegments * 3);
        for (let i = 0; i < ringSegments; i += 1) {
          const a = (i / ringSegments) * Math.PI * 2;
          const r = 0.08;
          ringPositions[i * 3] = dst.x + Math.cos(a) * r;
          ringPositions[i * 3 + 1] = dst.y + Math.sin(a) * r;
          ringPositions[i * 3 + 2] = -0.1;
        }
        const ringGeom = new THREE.BufferGeometry();
        ringGeom.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
        const ringMat = new THREE.PointsMaterial({
          color: 0x7594ff,
          size: 0.06,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0
        });
        const ring = new THREE.Points(ringGeom, ringMat);
        objects = { arc, arcMat, ring, ringMat };
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getDuration() { return DURATION; },
      getElapsed() { return elapsed; },
      render(THREE, scene) {
        if (!objects || !THREE) return;
        if (objects.arc && !objects.arc.parent) scene.add(objects.arc);
        if (objects.ring && !objects.ring.parent) scene.add(objects.ring);
        const p = effect.getProgress();
        if (objects.arcMat) {
          if (p < 0.78) objects.arcMat.opacity = Math.min(0.95, p / 0.4);
          else objects.arcMat.opacity = Math.max(0, 0.95 * (1 - (p - 0.78) / 0.22));
        }
        if (objects.ringMat && objects.ring) {
          if (p >= 0.55) {
            const k = (p - 0.55) / 0.45;
            // Points 通过 scale 整体放大 + 调整 size
            objects.ring.scale.set(1 + k * 8, 1 + k * 8, 1);
            objects.ringMat.opacity = Math.max(0, 0.9 * (1 - k));
          }
        }
      },
      dispose(scene) {
        if (!objects) return;
        ['arc', 'arcMat', 'ring', 'ringMat'].forEach(k => {
          const obj = objects[k];
          if (!obj) return;
          if (scene && scene.remove) scene.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        objects = null;
      }
    };
    return effect;
  }

  // 8.3 手牌重新发出：上方短暂流光 + 主推荐金色光束 + 备选蓝光
  // 总时长 700ms
  function createHandDealEffect(ctx) {
    const THREE = ctx && ctx.THREE;
    const canvas = ctx && ctx.canvas;
    let elapsed = 0;
    let alive = false;
    let objects = null;
    let ranks = [];
    const DURATION = 0.7;
    const RANK_COLOR = {
      primary: 0xf6dda0,
      backup: 0x7594ff,
      other: 0xc8d2e0,
      risk: 0xd7868d
    };
    function rectToPoint(rect, canvasRect) {
      if (!rect || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;
      const cx = rect.left + rect.width / 2 - canvasRect.left;
      const cy = rect.top + rect.height / 2 - canvasRect.top;
      return { x: (cx / canvasRect.width) * 2 - 1, y: -(cy / canvasRect.height) * 2 + 1 };
    }
    const effect = {
      start(detail) {
        elapsed = 0;
        alive = true;
        ranks = (detail && detail.ranks) || [];
        effect.detail = detail || {};
        if (!THREE) return;
        const canvasRect = canvas && typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
        const rects = (detail && detail.rects) || [];
        const beams = [];
        rects.forEach((rect, i) => {
          const rank = ranks[i] || 'other';
          if (rank === 'other') return; // 其他牌不做持续高亮
          const pt = rectToPoint(rect, canvasRect);
          if (!pt) return;
          // 短光束：从牌位上方 (y + 0.4) 向下 (y + 0.1)
          const points = [
            new THREE.Vector3(pt.x, pt.y + 0.4, 0),
            new THREE.Vector3(pt.x, pt.y + 0.1, 0)
          ];
          const geom = new THREE.BufferGeometry().setFromPoints(points);
          const mat = new THREE.LineBasicMaterial({ color: RANK_COLOR[rank] || RANK_COLOR.other, transparent: true, opacity: 0 });
          beams.push({ line: new THREE.Line(geom, mat), mat });
        });
        // 上方流光：横贯整个手牌区的金色细线
        let topLine = null;
        if (rects.length) {
          const first = rectToPoint(rects[0], canvasRect);
          const last = rectToPoint(rects[rects.length - 1], canvasRect);
          if (first && last) {
            const points = [
              new THREE.Vector3(first.x - 0.1, first.y + 0.55, 0),
              new THREE.Vector3(last.x + 0.1, last.y + 0.55, 0)
            ];
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: 0xe7bd65, transparent: true, opacity: 0 });
            topLine = { line: new THREE.Line(geom, mat), mat };
          }
        }
        objects = { beams, topLine };
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getDuration() { return DURATION; },
      getRanks() { return ranks.slice(); },
      render(THREE, scene) {
        if (!objects) return;
        const p = effect.getProgress();
        if (objects.topLine) {
          if (!objects.topLine.line.parent) scene.add(objects.topLine.line);
          // 流光：0-0.4 渐显，0.4-0.7 渐隐
          if (p < 0.4) objects.topLine.mat.opacity = p / 0.4 * 0.7;
          else objects.topLine.mat.opacity = Math.max(0, 0.7 * (1 - (p - 0.4) / 0.3));
        }
        objects.beams.forEach(b => {
          if (!b.line.parent) scene.add(b.line);
          if (p < 0.6) b.mat.opacity = p / 0.6 * 0.9;
          else b.mat.opacity = Math.max(0, 0.9 * (1 - (p - 0.6) / 0.4));
        });
      },
      dispose(scene) {
        if (!objects) return;
        if (objects.topLine) {
          if (scene) scene.remove(objects.topLine.line);
          if (objects.topLine.line.geometry) objects.topLine.line.geometry.dispose();
          objects.topLine.line.material.dispose();
        }
        objects.beams.forEach(b => {
          if (scene) scene.remove(b.line);
          if (b.line.geometry) b.line.geometry.dispose();
          b.line.material.dispose();
        });
        objects = null;
      }
    };
    return effect;
  }

  // 8.4 我方出牌：DOM 卡抬起 + 沿曲线移 + 关系光路 + 落点光圈
  // 总时长 800ms
  function createPlayerPlayEffect(ctx) {
    const THREE = ctx && ctx.THREE;
    const canvas = ctx && ctx.canvas;
    let elapsed = 0;
    let alive = false;
    let rank = 'other';
    let objects = null;
    const DURATION = 0.8;
    const RANK_COLOR = {
      primary: 0xf6dda0,
      backup: 0x7594ff,
      other: 0xc8d2e0,
      risk: 0xd7868d
    };
    function rectToPoint(rect, canvasRect) {
      if (!rect || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;
      const cx = rect.left + rect.width / 2 - canvasRect.left;
      const cy = rect.top + rect.height / 2 - canvasRect.top;
      return { x: (cx / canvasRect.width) * 2 - 1, y: -(cy / canvasRect.height) * 2 + 1 };
    }
    const effect = {
      start(detail) {
        elapsed = 0;
        alive = true;
        rank = (detail && detail.rank) || 'other';
        effect.detail = detail || {};
        if (!THREE) return;
        const canvasRect = canvas && typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
        const src = rectToPoint(detail && detail.sourceRect, canvasRect);
        const dst = rectToPoint(detail && detail.targetRect, canvasRect);
        if (!src || !dst) return;
        const color = RANK_COLOR[rank] || RANK_COLOR.other;
        // 主推荐和备选用双段曲线（top arc + bottom arc）
        const lines = [];
        if (rank === 'primary' || rank === 'backup') {
          const topCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(src.x, src.y, 0),
            new THREE.Vector3((src.x + dst.x) / 2, Math.max(src.y, dst.y) + 0.35, 0),
            new THREE.Vector3(dst.x, dst.y, 0)
          );
          const botCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(src.x, src.y, 0),
            new THREE.Vector3((src.x + dst.x) / 2, Math.min(src.y, dst.y) - 0.35, 0),
            new THREE.Vector3(dst.x, dst.y, 0)
          );
          [topCurve, botCurve].forEach(curve => {
            const pts = curve.getPoints(24);
            const geom = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
            lines.push({ line: new THREE.Line(geom, mat), mat });
          });
        } else {
          // other / risk：单条曲线
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(src.x, src.y, 0),
            new THREE.Vector3((src.x + dst.x) / 2, rank === 'risk' ? src.y + 0.15 : Math.max(src.y, dst.y) + 0.3, 0),
            new THREE.Vector3(dst.x, dst.y, 0)
          );
          const pts = curve.getPoints(24);
          const geom = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
          lines.push({ line: new THREE.Line(geom, mat), mat });
        }
        // 落点光圈
        const ringGeom = new THREE.RingGeometry(0.04, 0.06, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide || 0, transparent: true, opacity: 0 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.set(dst.x, dst.y, -0.1);
        objects = { lines, ring, ringMat };
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getDuration() { return DURATION; },
      getRank() { return rank; },
      render(THREE, scene) {
        if (!objects) return;
        const p = effect.getProgress();
        if (objects.lines) {
          objects.lines.forEach(l => {
            if (!l.line.parent) scene.add(l.line);
            if (p < 0.7) l.mat.opacity = Math.min(0.9, p / 0.3);
            else l.mat.opacity = Math.max(0, 0.9 * (1 - (p - 0.7) / 0.3));
          });
        }
        if (objects.ring && objects.ringMat) {
          if (!objects.ring.parent) scene.add(objects.ring);
          if (p >= 0.55) {
            const k = (p - 0.55) / 0.45;
            objects.ring.scale.set(1 + k * 6, 1 + k * 6, 1);
            objects.ringMat.opacity = Math.max(0, 0.85 * (1 - k));
          }
        }
      },
      dispose(scene) {
        if (!objects) return;
        if (objects.lines) {
          objects.lines.forEach(l => {
            if (scene) scene.remove(l.line);
            if (l.line.geometry) l.line.geometry.geometry ? l.line.geometry.geometry.dispose() : l.line.geometry.dispose();
            l.line.material.dispose();
          });
        }
        if (objects.ring) {
          if (scene) scene.remove(objects.ring);
          if (objects.ring.geometry) objects.ring.geometry.dispose();
          if (objects.ring.material) objects.ring.material.dispose();
        }
        objects = null;
      }
    };
    return effect;
  }

  // 8.5 回合收藏：场景牌和回应牌连接光 + 中央金色星点 + 飞向卡包
  // 总时长 1200ms
  function createRoundSaveEffect(ctx) {
    const THREE = ctx && ctx.THREE;
    const canvas = ctx && ctx.canvas;
    let elapsed = 0;
    let alive = false;
    let objects = null;
    const DURATION = 1.2;
    function rectToPoint(rect, canvasRect) {
      if (!rect || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return null;
      const cx = rect.left + rect.width / 2 - canvasRect.left;
      const cy = rect.top + rect.height / 2 - canvasRect.top;
      return { x: (cx / canvasRect.width) * 2 - 1, y: -(cy / canvasRect.height) * 2 + 1 };
    }
    const effect = {
      start(detail) {
        elapsed = 0;
        alive = true;
        effect.detail = detail || {};
        if (!THREE) return;
        const canvasRect = canvas && typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
        const opp = rectToPoint(detail && detail.sourceRect, canvasRect);
        const player = rectToPoint(detail && detail.targetRect, canvasRect);
        const pack = rectToPoint(detail && detail.packRect, canvasRect);
        if (!opp || !player || !pack) return;
        // 连接光：场景牌 ↔ 我方牌
        const connectPoints = [
          new THREE.Vector3(opp.x, opp.y, 0),
          new THREE.Vector3(player.x, player.y, 0)
        ];
        const connectGeom = new THREE.BufferGeometry().setFromPoints(connectPoints);
        const connectMat = new THREE.LineBasicMaterial({ color: 0xe7bd65, transparent: true, opacity: 0 });
        const connectLine = new THREE.Line(connectGeom, connectMat);
        // 中央金色星点
        const midX = (opp.x + player.x) / 2;
        const midY = (opp.y + player.y) / 2;
        const starGeom = new THREE.SphereGeometry(0.04, 12, 12);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xf6dda0, transparent: true, opacity: 0 });
        const star = new THREE.Mesh(starGeom, starMat);
        star.position.set(midX, midY, 0.1);
        // 星点飞向卡包的轨迹
        const flightPoints = [
          new THREE.Vector3(midX, midY, 0),
          new THREE.Vector3((midX + pack.x) / 2, Math.max(midY, pack.y) + 0.4, 0),
          new THREE.Vector3(pack.x, pack.y, 0)
        ];
        const flightGeom = new THREE.BufferGeometry().setFromPoints(flightPoints);
        const flightMat = new THREE.LineBasicMaterial({ color: 0xf6dda0, transparent: true, opacity: 0 });
        const flightLine = new THREE.Line(flightGeom, flightMat);
        objects = { connectLine, connectMat, star, starMat, flightLine, flightMat, midX, midY, packX: pack.x, packY: pack.y, startX: midX, startY: midY };
      },
      update(dt) {
        if (!alive) return;
        elapsed += dt;
        if (elapsed >= DURATION) alive = false;
      },
      isAlive() { return alive; },
      getProgress() { return alive ? Math.min(1, elapsed / DURATION) : 1; },
      getDuration() { return DURATION; },
      getElapsed() { return elapsed; },
      render(THREE, scene) {
        if (!objects) return;
        const p = effect.getProgress();
        // 0-0.3s 连接光渐显，0.3-0.5s 星点出现
        if (objects.connectLine && !objects.connectLine.parent) scene.add(objects.connectLine);
        if (objects.connectMat) {
          if (p < 0.3) objects.connectMat.opacity = p / 0.3 * 0.9;
          else if (p < 0.5) objects.connectMat.opacity = 0.9;
          else objects.connectMat.opacity = Math.max(0, 0.9 * (1 - (p - 0.5) / 0.5));
        }
        // 星点：0.3-0.5s 出现，0.5-1.0s 沿轨迹飞向 pack
        if (objects.star && !objects.star.parent) scene.add(objects.star);
        if (objects.starMat) {
          if (p < 0.3) objects.starMat.opacity = 0;
          else if (p < 0.5) objects.starMat.opacity = (p - 0.3) / 0.2;
          else if (p < 1.0) objects.starMat.opacity = 1;
          else objects.starMat.opacity = 0;
          // 沿弧线飞向 packRect
          if (p >= 0.5 && p < 1.0) {
            const k = (p - 0.5) / 0.5;
            objects.star.position.x = objects.startX + (objects.packX - objects.startX) * k;
            objects.star.position.y = objects.startY + (objects.packY - objects.startY) * k + Math.sin(k * Math.PI) * 0.4;
          }
        }
        // 飞行轨迹：0.5-1.0s 渐显
        if (objects.flightLine && !objects.flightLine.parent) scene.add(objects.flightLine);
        if (objects.flightMat) {
          if (p >= 0.5 && p < 0.9) objects.flightMat.opacity = (p - 0.5) / 0.4 * 0.7;
          else if (p >= 0.9) objects.flightMat.opacity = Math.max(0, 0.7 * (1 - (p - 0.9) / 0.1));
        }
      },
      dispose(scene) {
        if (!objects) return;
        ['connectLine', 'star', 'flightLine'].forEach(k => {
          const obj = objects[k];
          if (!obj) return;
          if (scene) scene.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        objects = null;
      }
    };
    return effect;
  }

  return {
    createEffectBus,
    createOpponentPlayEffect,
    createHandDealEffect,
    createPlayerPlayEffect,
    createRoundSaveEffect,
    domRectToCanvasPoint
  };
});
