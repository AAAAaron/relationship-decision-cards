// table3d: Canvas 卡面绘制器
// 把卡牌(标题/引语/rank/正面信息或背面信息)画成高清 Canvas 贴图, 供 card3d 用作材质
// drawCardFace(ctx, spec) 为纯绘制函数(Node 环境传 mock ctx 可测布局逻辑)
(function initTable3dCardTexture(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.Table3dCardTexture = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTable3dCardTextureApi() {
  'use strict';

  // 卡面基准尺寸(比例 1:1.6), 贴图放大 3x 保证文字清晰
  const CARD_W = 512;
  const CARD_H = 819;
  const SCALE = 3;
  const PIXEL_W = CARD_W * SCALE;
  const PIXEL_H = CARD_H * SCALE;

  const RANK_STYLE = {
    primary: { label: 'AI 主推荐', color: '#8a6a1f', bg: '#f2d489', edge: '#c9a44c' },
    backup: { label: '条件备选', color: '#2c4a8f', bg: '#b9c9f2', edge: '#7e97d6' },
    risk: { label: 'AI 不推荐', color: '#8f3a42', bg: '#f0c3c8', edge: '#cf8d94' },
    other: { label: '其他可行', color: '#46536a', bg: '#ccd6e4', edge: '#9aa8bd' }
  };

  const FONT_STACK = '"Outfit","PingFang SC","Microsoft YaHei",sans-serif';

  // 文本自动换行: 返回行数组; maxLines 截断加省略号
  function wrapText(ctx, text, maxWidth, maxLines) {
    const lines = [];
    let current = '';
    for (const ch of String(text || '')) {
      if (ch === '\n') { lines.push(current); current = ''; continue; }
      const next = current + ch;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    if (maxLines && lines.length > maxLines) {
      const kept = lines.slice(0, maxLines - 1);
      const overflow = lines[maxLines - 1] || '';
      kept.push(overflow + '…');
      return kept;
    }
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 米黄羊皮纸底 + 纸纹
  function paintParchment(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#fffaf0');
    g.addColorStop(0.55, '#f7edd8');
    g.addColorStop(1, '#efe0c2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 右上暖光
    const glow = ctx.createRadialGradient(w * 0.9, 0, 0, w * 0.9, 0, h * 0.5);
    glow.addColorStop(0, 'rgba(246,221,160,0.5)');
    glow.addColorStop(1, 'rgba(246,221,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    // 细纸纹
    ctx.strokeStyle = 'rgba(119,91,42,0.035)';
    ctx.lineWidth = 1 * SCALE;
    for (let y = 0; y < h; y += 4 * SCALE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // 对方场景牌: 深蓝夜色底
  function paintNight(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b3154');
    g.addColorStop(1, '#0d1c32');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, h * 0.55);
    glow.addColorStop(0, 'rgba(117,148,255,0.22)');
    glow.addColorStop(1, 'rgba(117,148,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  // 金色双线画框 + 四角饰
  function paintFrame(ctx, w, h, edgeColor) {
    const m1 = 14 * SCALE, m2 = 22 * SCALE;
    ctx.strokeStyle = edgeColor || 'rgba(119,91,42,0.65)';
    ctx.lineWidth = 2.5 * SCALE;
    roundRect(ctx, m1, m1, w - m1 * 2, h - m1 * 2, 18 * SCALE);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,251,240,0.6)';
    ctx.lineWidth = 1.2 * SCALE;
    roundRect(ctx, m2, m2, w - m2 * 2, h - m2 * 2, 12 * SCALE);
    ctx.stroke();
    // 四角小菱形饰
    ctx.fillStyle = edgeColor || 'rgba(119,91,42,0.65)';
    [[m2, m2], [w - m2, m2], [m2, h - m2], [w - m2, h - m2]].forEach(([x, y]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      const s = 5 * SCALE;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    });
  }

  function paintBadge(ctx, rank, x, y) {
    const s = RANK_STYLE[rank] || RANK_STYLE.other;
    ctx.font = `600 ${13 * SCALE}px ${FONT_STACK}`;
    const text = s.label;
    const tw = ctx.measureText(text).width;
    const padX = 9 * SCALE, h = 24 * SCALE;
    ctx.fillStyle = s.bg;
    roundRect(ctx, x, y, tw + padX * 2, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = s.edge;
    ctx.lineWidth = 1.2 * SCALE;
    roundRect(ctx, x, y, tw + padX * 2, h, h / 2);
    ctx.stroke();
    ctx.fillStyle = s.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + padX, y + h / 2 + 1 * SCALE);
    return h;
  }

  // 正面
  // spec: { kind:'scene'|'reply'|'hand', rank, title, quote, meta:[{label,value}], back:{logic,invalid,source} }
  function drawCardFace(ctx, spec) {
    const w = PIXEL_W, h = PIXEL_H;
    const dark = spec.kind === 'scene';
    if (dark) paintNight(ctx, w, h); else paintParchment(ctx, w, h);
    paintFrame(ctx, w, h, dark ? 'rgba(126,151,214,0.55)' : undefined);
    const ink = dark ? '#e8eefc' : '#172137';
    const soft = dark ? 'rgba(200,210,224,0.8)' : '#6f6a60';
    const pad = 44 * SCALE;
    const innerW = w - pad * 2;
    let y = pad + 6 * SCALE;

    // rank 徽章
    const rank = spec.rank || (dark ? 'backup' : 'other');
    y += paintBadge(ctx, dark ? 'backup' : rank, pad, y) + 16 * SCALE;

    // 标题(自动缩字号到两行内)
    let titleSize = 26;
    let titleLines;
    for (;;) {
      ctx.font = `800 ${titleSize * SCALE}px ${FONT_STACK}`;
      titleLines = wrapText(ctx, spec.title, innerW, 3);
      if (titleLines.length <= 2 || titleSize <= 17) break;
      titleSize -= 2;
    }
    ctx.fillStyle = ink;
    ctx.textBaseline = 'alphabetic';
    titleLines.forEach(line => {
      ctx.fillText(line, pad, y + titleSize * SCALE);
      y += titleSize * SCALE * 1.3;
    });
    y += 14 * SCALE;

    // 引语(带引号, 主体区)
    if (spec.quote) {
      const quoteSize = 14.5;
      ctx.font = `600 ${quoteSize * SCALE}px ${FONT_STACK}`;
      const quoteLines = wrapText(ctx, `“${spec.quote}”`, innerW, 14);
      ctx.fillStyle = dark ? 'rgba(232,238,252,0.92)' : '#3f382c';
      quoteLines.forEach(line => {
        ctx.fillText(line, pad, y + quoteSize * SCALE);
        y += quoteSize * SCALE * 1.55;
      });
    }

    // 底部信息条(正面元信息)
    if (Array.isArray(spec.meta) && spec.meta.length) {
      const barY = h - pad - 26 * SCALE;
      ctx.strokeStyle = dark ? 'rgba(126,151,214,0.35)' : 'rgba(119,91,42,0.3)';
      ctx.lineWidth = 1 * SCALE;
      ctx.beginPath();
      ctx.moveTo(pad, barY - 12 * SCALE);
      ctx.lineTo(w - pad, barY - 12 * SCALE);
      ctx.stroke();
      ctx.font = `600 ${11.5 * SCALE}px ${FONT_STACK}`;
      ctx.fillStyle = soft;
      ctx.textBaseline = 'alphabetic';
      let x = pad;
      spec.meta.forEach(m => {
        const label = `${m.label} `;
        const value = ` ${m.value}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = soft;
        ctx.fillText(label, x, barY);
        x += ctx.measureText(label).width;
        ctx.fillStyle = ink;
        ctx.fillText(value, x, barY);
        x += ctx.measureText(value).width + 14 * SCALE;
      });
    }
  }

  // 背面: 一页排干净的行动逻辑/不适用/依据
  function drawCardBack(ctx, spec) {
    const w = PIXEL_W, h = PIXEL_H;
    const dark = spec.kind === 'scene';
    if (dark) paintNight(ctx, w, h); else paintParchment(ctx, w, h);
    paintFrame(ctx, w, h, dark ? 'rgba(126,151,214,0.55)' : undefined);
    const ink = dark ? '#e8eefc' : '#172137';
    const soft = dark ? 'rgba(200,210,224,0.75)' : '#6f6a60';
    const pad = 44 * SCALE;
    const innerW = w - pad * 2;
    let y = pad + 10 * SCALE;

    // 顶部小标
    ctx.font = `700 ${13 * SCALE}px ${FONT_STACK}`;
    ctx.fillStyle = soft;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(dark ? '场景牌 · 拆解' : '应对牌 · 拆解', pad, y + 12 * SCALE);
    y += 34 * SCALE;

    ctx.font = `800 ${20 * SCALE}px ${FONT_STACK}`;
    const titleLines = wrapText(ctx, spec.title, innerW, 2);
    ctx.fillStyle = ink;
    titleLines.forEach(line => {
      ctx.fillText(line, pad, y + 20 * SCALE);
      y += 20 * SCALE * 1.32;
    });
    y += 18 * SCALE;

    const sections = [
      ['行动逻辑', spec.back && spec.back.logic],
      ['为什么不适用', spec.back && spec.back.invalid],
      ['依据', spec.back && spec.back.source]
    ].filter(([, text]) => text);

    sections.forEach(([label, text]) => {
      ctx.font = `700 ${12.5 * SCALE}px ${FONT_STACK}`;
      ctx.fillStyle = dark ? '#a9bdf0' : '#8a6a1f';
      ctx.fillText(label, pad, y + 12 * SCALE);
      y += 24 * SCALE;
      ctx.font = `500 ${12.5 * SCALE}px ${FONT_STACK}`;
      const lines = wrapText(ctx, text, innerW, 8);
      ctx.fillStyle = dark ? 'rgba(232,238,252,0.88)' : '#4a4438';
      lines.forEach(line => {
        ctx.fillText(line, pad, y + 12 * SCALE);
        y += 12.5 * SCALE * 1.6;
      });
      y += 16 * SCALE;
    });
  }

  // 面向浏览器的贴图工厂: 缓存 + THREE.CanvasTexture
  function createCardTexturePainter({ THREE }) {
    const cache = new Map();
    function keyOf(spec) {
      return JSON.stringify([spec.kind, spec.rank, spec.title, spec.quote, spec.meta, spec.back]);
    }
    function paintToCanvas(spec) {
      const canvas = document.createElement('canvas');
      canvas.width = PIXEL_W;
      canvas.height = PIXEL_H;
      const ctx = canvas.getContext('2d');
      drawCardFace(ctx, spec);
      return canvas;
    }
    function paintBackToCanvas(spec) {
      const canvas = document.createElement('canvas');
      canvas.width = PIXEL_W;
      canvas.height = PIXEL_H;
      const ctx = canvas.getContext('2d');
      drawCardBack(ctx, spec);
      return canvas;
    }
    function makeTexture(canvas) {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace || 'srgb';
      tex.anisotropy = 4;
      return tex;
    }
    return {
      CARD_W,
      CARD_H,
      PIXEL_W,
      PIXEL_H,
      // frontTexture(spec) / backTexture(spec): spec 同 drawCardFace
      frontTexture(spec) {
        const key = 'F' + keyOf(spec);
        if (!cache.has(key)) cache.set(key, makeTexture(paintToCanvas(spec)));
        return cache.get(key);
      },
      backTexture(spec) {
        const key = 'B' + keyOf(spec);
        if (!cache.has(key)) cache.set(key, makeTexture(paintBackToCanvas(spec)));
        return cache.get(key);
      },
      clearCache() { cache.clear(); }
    };
  }

  return {
    CARD_W, CARD_H, PIXEL_W, PIXEL_H,
    RANK_STYLE,
    wrapText, roundRect,
    drawCardFace, drawCardBack,
    createCardTexturePainter
  };
});
