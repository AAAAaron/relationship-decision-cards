// table3d: Canvas 卡面绘制器 (炉石式装饰)
// 牌面结构: 深色框带(渐变+金线+角钉) + 内窗(羊皮纸/夜蓝) + rank 徽记 + 标题饰线 + 引语 + 底部 rank 宝石
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
    primary: { label: '主推荐', color: '#6b4d0d', bg: '#f2cf6e', edge: '#c9a44c', gem: '#e9bf56', gemDark: '#8a6a1f' },
    backup: { label: '条件备选', color: '#223a72', bg: '#b9c9f2', edge: '#7e97d6', gem: '#8fa7e8', gemDark: '#3d5aa8' },
    risk: { label: '不推荐', color: '#7c2e36', bg: '#f0c3c8', edge: '#cf8d94', gem: '#e09aa2', gemDark: '#a04a54' },
    other: { label: '其他可行', color: '#3d4a60', bg: '#ccd6e4', edge: '#9aa8bd', gem: '#aebad0', gemDark: '#5d6b84' }
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

  function diamond(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
  }

  // 框带配色: 米黄牌 = 深棕木框, 场景牌 = 藏蓝框
  function frameColors(dark) {
    return dark
      ? { top: '#26395f', bottom: '#101c33', pin: 'rgba(159,180,232,0.85)', pinSoft: 'rgba(159,180,232,0.35)', stud: '#c7d4f2' }
      : { top: '#3d2c16', bottom: '#191007', pin: 'rgba(224,190,120,0.9)', pinSoft: 'rgba(224,190,120,0.38)', stud: '#eed9a4' };
  }

  // 内窗底色: 羊皮纸 / 夜蓝
  function windowFill(ctx, x, y, w, h, dark) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 20 * SCALE);
    ctx.clip();
    if (dark) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#233757');
      g.addColorStop(0.6, '#182743');
      g.addColorStop(1, '#101c31');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      const glow = ctx.createRadialGradient(x + w * 0.85, y + h * 0.08, 0, x + w * 0.85, y + h * 0.08, h * 0.5);
      glow.addColorStop(0, 'rgba(126,151,214,0.25)');
      glow.addColorStop(1, 'rgba(126,151,214,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, w, h);
    } else {
      const g = ctx.createLinearGradient(0, y, w, y + h);
      g.addColorStop(0, '#fffaf0');
      g.addColorStop(0.55, '#f7ecd6');
      g.addColorStop(1, '#eedcb9');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      const glow = ctx.createRadialGradient(x + w * 0.9, y, 0, x + w * 0.9, y, h * 0.45);
      glow.addColorStop(0, 'rgba(246,221,160,0.5)');
      glow.addColorStop(1, 'rgba(246,221,160,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, w, h);
      // 纸纹
      ctx.strokeStyle = 'rgba(119,91,42,0.04)';
      ctx.lineWidth = 1 * SCALE;
      for (let yy = y; yy < y + h; yy += 4 * SCALE) {
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + w, yy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 整牌绘制: 框带 + 内窗 + 装饰, 返回窗口区域; body 回调在窗口 clip 内画内容
  function paintCardChrome(ctx, spec, body) {
    const w = PIXEL_W, h = PIXEL_H;
    const dark = spec.kind === 'scene';
    const fc = frameColors(dark);

    // 1. 框带
    const band = ctx.createLinearGradient(0, 0, 0, h);
    band.addColorStop(0, fc.top);
    band.addColorStop(0.5, dark ? '#1a2a49' : '#2b1f0f');
    band.addColorStop(1, fc.bottom);
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, w, h);

    // 2. 内窗
    const pad = 46 * SCALE;
    windowFill(ctx, pad, pad, w - pad * 2, h - pad * 2, dark);

    // 3. 金色双层描边(窗沿)
    ctx.strokeStyle = fc.pin;
    ctx.lineWidth = 3 * SCALE;
    roundRect(ctx, pad - 9 * SCALE, pad - 9 * SCALE, w - (pad - 9 * SCALE) * 2, h - (pad - 9 * SCALE) * 2, 26 * SCALE);
    ctx.stroke();
    ctx.strokeStyle = fc.pinSoft;
    ctx.lineWidth = 1.6 * SCALE;
    roundRect(ctx, pad - 18 * SCALE, pad - 18 * SCALE, w - (pad - 18 * SCALE) * 2, h - (pad - 18 * SCALE) * 2, 32 * SCALE);
    ctx.stroke();

    // 4. 四角菱形铆钉
    const stud = pad / 2;
    [[stud, stud], [w - stud, stud], [stud, h - stud], [w - stud, h - stud]].forEach(([cx, cy]) => {
      ctx.fillStyle = fc.stud;
      diamond(ctx, cx, cy, 7 * SCALE);
      ctx.fill();
      ctx.strokeStyle = fc.pinSoft;
      ctx.lineWidth = 1.2 * SCALE;
      ctx.stroke();
    });

    // 5. 窗口内容(clip)
    ctx.save();
    roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 20 * SCALE);
    ctx.clip();
    body({ w, h, pad, dark, innerW: w - pad * 2, winH: h - pad * 2 });
    ctx.restore();

    // 6. 底部中央 rank 宝石(嵌在框带上)
    if (spec.rank) paintGem(ctx, spec.rank, w / 2, h - pad / 2);
  }

  function paintGem(ctx, rank, cx, cy) {
    const s = RANK_STYLE[rank] || RANK_STYLE.other;
    const size = 26 * SCALE;
    // 底衬暗圈
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 1.35, 0, Math.PI * 2);
    ctx.fill();
    // 菱形宝石
    const g = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
    g.addColorStop(0, s.gem);
    g.addColorStop(1, s.gemDark);
    ctx.fillStyle = g;
    diamond(ctx, cx, cy, size);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,214,0.85)';
    ctx.lineWidth = 2.4 * SCALE;
    ctx.stroke();
    // 高光切面
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    diamond(ctx, cx - size * 0.28, cy - size * 0.3, size * 0.3);
    ctx.fill();
  }

  function paintBadge(ctx, rank, x, y, dark) {
    const s = RANK_STYLE[rank] || RANK_STYLE.other;
    ctx.font = `700 ${14 * SCALE}px ${FONT_STACK}`;
    const text = s.label;
    const tw = ctx.measureText(text).width;
    const padX = 12 * SCALE, h = 26 * SCALE;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, s.bg);
    g.addColorStop(1, s.gemDark);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, tw + padX * 2, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,214,0.8)';
    ctx.lineWidth = 1.6 * SCALE;
    roundRect(ctx, x, y, tw + padX * 2, h, h / 2);
    ctx.stroke();
    ctx.fillStyle = '#fff8e8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 ${12.5 * SCALE}px ${FONT_STACK}`;
    ctx.fillText(text, x + padX, y + h / 2 + 1 * SCALE);
    return h;
  }

  // 标题下饰线: 金色渐变线 + 中央菱形
  function paintFlourish(ctx, cx, y, halfW, fc) {
    const g = ctx.createLinearGradient(cx - halfW, y, cx + halfW, y);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, fc.pin);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - halfW, y - 1.2 * SCALE, halfW * 2, 2.4 * SCALE);
    ctx.fillStyle = fc.pin;
    diamond(ctx, cx, y, 6 * SCALE);
    ctx.fill();
  }

  // 画面区: 大幅装饰徽记填充牌面中部(炉石的 art box)
  function paintArt(ctx, x, y, w, h, dark, spec) {
    const fc = frameColors(dark);
    const rank = RANK_STYLE[spec.rank] || RANK_STYLE.other;
    ctx.save();
    roundRect(ctx, x, y, w, h, 16 * SCALE);
    ctx.clip();
    // 底色: 深一档的渐变 + 斜纹
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    if (dark) {
      g.addColorStop(0, '#16233d');
      g.addColorStop(1, '#0d1829');
    } else {
      g.addColorStop(0, '#f3e6c8');
      g.addColorStop(1, '#e3cd9d');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = dark ? 'rgba(159,180,232,0.14)' : 'rgba(119,91,42,0.1)';
    ctx.lineWidth = 1.2 * SCALE;
    for (let i = -h; i < w; i += 22 * SCALE) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    // 中央光晕
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w * 0.55);
    glow.addColorStop(0, dark ? 'rgba(126,151,214,0.4)' : 'rgba(246,221,160,0.65)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    // 大徽记: 双层菱形 + 大字符
    const cx = x + w / 2, cy = y + h / 2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = dark ? 'rgba(10,18,32,0.55)' : 'rgba(60,42,16,0.18)';
    diamond(ctx, cx, cy, w * 0.34);
    ctx.fill();
    const gem = ctx.createLinearGradient(cx, cy - w * 0.3, cx, cy + w * 0.3);
    gem.addColorStop(0, rank.gem);
    gem.addColorStop(1, rank.gemDark);
    ctx.fillStyle = gem;
    diamond(ctx, cx, cy, w * 0.26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,214,0.9)';
    ctx.lineWidth = 3 * SCALE;
    ctx.stroke();
    // 徽记内大字: 场景用类型首字, 应对用 ✦
    const artChar = spec.artChar || '✦';
    ctx.fillStyle = '#fff8e8';
    ctx.font = `800 ${58 * SCALE}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(artChar, cx, cy + 3 * SCALE);
    ctx.globalAlpha = 1;
    // 四角小菱形
    ctx.fillStyle = fc.pin;
    [[x + 18 * SCALE, y + 18 * SCALE], [x + w - 18 * SCALE, y + 18 * SCALE], [x + 18 * SCALE, y + h - 18 * SCALE], [x + w - 18 * SCALE, y + h - 18 * SCALE]]
      .forEach(([px, py]) => { diamond(ctx, px, py, 5 * SCALE); ctx.fill(); });
    ctx.restore();
    // 边框
    ctx.strokeStyle = fc.pin;
    ctx.lineWidth = 2.4 * SCALE;
    roundRect(ctx, x, y, w, h, 16 * SCALE);
    ctx.stroke();
  }

  // 正面
  // spec: { kind:'scene'|'reply'|'hand', rank, title, quote, meta:[{label,value}], back:{logic,invalid,source} }
  function drawCardFace(ctx, spec) {
    paintCardChrome(ctx, spec, ({ w, h, pad, dark, innerW }) => {
      const ink = dark ? '#f0f4ff' : '#141d2e';
      const soft = dark ? 'rgba(206,218,242,0.9)' : '#5f584c';
      const fc = frameColors(dark);
      const ix = pad + 14 * SCALE;
      let y = pad + 18 * SCALE;

      // rank 徽记(左上)
      const rank = spec.rank || (dark ? 'backup' : 'other');
      y += paintBadge(ctx, rank, ix, y, dark) + 14 * SCALE;

      // 摘要模式(桌上牌): 大标题 + 画面区占满, 详情看悬停浮卡/详情面板
      if (spec.summary) {
        let sumSize = 46;
        let sumLines;
        for (;;) {
          ctx.font = `800 ${sumSize * SCALE}px ${FONT_STACK}`;
          sumLines = wrapText(ctx, spec.title, innerW - 24 * SCALE, 2);
          if (sumLines.length <= 2 || sumSize <= 30) break;
          sumSize -= 2;
        }
        ctx.fillStyle = ink;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        sumLines.forEach(line => {
          ctx.fillText(line, ix, y + sumSize * SCALE);
          y += sumSize * SCALE * 1.26;
        });
        y += 10 * SCALE;
        paintFlourish(ctx, w / 2, y + 4 * SCALE, innerW / 2 - 24 * SCALE, fc);
        y += 20 * SCALE;
        const sumArtH = h - pad * 2 - (y - pad) - 22 * SCALE;
        paintArt(ctx, ix, y, innerW, sumArtH, dark, spec);
        return;
      }

      // 标题(自动缩字号到两行内) — 大字主导
      let titleSize = 34;
      let titleLines;
      for (;;) {
        ctx.font = `800 ${titleSize * SCALE}px ${FONT_STACK}`;
        titleLines = wrapText(ctx, spec.title, innerW - 28 * SCALE, 2);
        if (titleLines.length <= 2 || titleSize <= 22) break;
        titleSize -= 2;
      }
      ctx.fillStyle = ink;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      titleLines.forEach(line => {
        ctx.fillText(line, ix, y + titleSize * SCALE);
        y += titleSize * SCALE * 1.28;
      });
      y += 12 * SCALE;
      paintFlourish(ctx, w / 2, y + 4 * SCALE, innerW / 2 - 24 * SCALE, fc);
      y += 22 * SCALE;

      // 画面区: 大幅装饰徽记, 填满牌面中部
      const metaH = (Array.isArray(spec.meta) && spec.meta.length) ? 46 * SCALE : 0;
      const quoteReserve = spec.quote ? 170 * SCALE : 0;
      const artH = Math.max(150 * SCALE, h - pad * 2 - (y - pad) - quoteReserve - metaH - 24 * SCALE);
      paintArt(ctx, ix, y, innerW, artH, dark, spec);
      y += artH + 20 * SCALE;

      // 引语: 大号字, 实际要说的话是主角
      if (spec.quote) {
        const quoteSize = 19;
        ctx.font = `600 ${quoteSize * SCALE}px ${FONT_STACK}`;
        const quoteLines = wrapText(ctx, `“${spec.quote}”`, innerW - 16 * SCALE, 5);
        ctx.fillStyle = dark ? 'rgba(235,241,252,0.96)' : '#33291a';
        quoteLines.forEach(line => {
          ctx.fillText(line, ix, y + quoteSize * SCALE);
          y += quoteSize * SCALE * 1.5;
        });
      }

      // 底部信息条(窗口内底部)
      if (Array.isArray(spec.meta) && spec.meta.length) {
        const barY = h - pad - 26 * SCALE;
        ctx.strokeStyle = dark ? 'rgba(126,151,214,0.4)' : 'rgba(119,91,42,0.35)';
        ctx.lineWidth = 1.2 * SCALE;
        ctx.beginPath();
        ctx.moveTo(ix, barY - 14 * SCALE);
        ctx.lineTo(w - ix, barY - 14 * SCALE);
        ctx.stroke();
        ctx.font = `600 ${13 * SCALE}px ${FONT_STACK}`;
        let x = ix;
        spec.meta.forEach(m => {
          ctx.textAlign = 'left';
          ctx.fillStyle = soft;
          ctx.fillText(`${m.label} `, x, barY);
          x += ctx.measureText(`${m.label} `).width;
          ctx.fillStyle = ink;
          ctx.fillText(` ${m.value}`, x, barY);
          x += ctx.measureText(` ${m.value}`).width + 14 * SCALE;
        });
      }
    });
  }

  // 背面: 行动逻辑/不适用/依据, 同款框饰 + 顶部缎带
  function drawCardBack(ctx, spec) {
    paintCardChrome(ctx, spec, ({ w, h, pad, dark, innerW }) => {
      const ink = dark ? '#e8eefc' : '#172137';
      const soft = dark ? 'rgba(200,214,240,0.78)' : '#6f6a60';
      const fc = frameColors(dark);
      let y = pad + 24 * SCALE;

      // 顶部小缎带
      const ribbonText = dark ? '场景牌 · 拆解' : '应对牌 · 拆解';
      ctx.font = `700 ${12.5 * SCALE}px ${FONT_STACK}`;
      const rw = ctx.measureText(ribbonText).width + 28 * SCALE;
      ctx.fillStyle = dark ? 'rgba(126,151,214,0.28)' : 'rgba(201,164,76,0.3)';
      roundRect(ctx, w / 2 - rw / 2, y, rw, 26 * SCALE, 13 * SCALE);
      ctx.fill();
      ctx.fillStyle = dark ? '#c7d4f2' : '#8a6a1f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ribbonText, w / 2, y + 13 * SCALE + 1 * SCALE);
      y += 48 * SCALE;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';

      ctx.font = `800 ${24 * SCALE}px ${FONT_STACK}`;
      const titleLines = wrapText(ctx, spec.title, innerW - 28 * SCALE, 2);
      ctx.fillStyle = ink;
      titleLines.forEach(line => {
        ctx.fillText(line, pad + 14 * SCALE, y + 24 * SCALE);
        y += 24 * SCALE * 1.3;
      });
      y += 12 * SCALE;
      paintFlourish(ctx, w / 2, y + 4 * SCALE, innerW / 2 - 24 * SCALE, fc);
      y += 26 * SCALE;

      const sections = [
        ['行动逻辑', spec.back && spec.back.logic],
        ['为什么不适用', spec.back && spec.back.invalid],
        ['依据', spec.back && spec.back.source]
      ].filter(([, text]) => text);

      sections.forEach(([label, text]) => {
        ctx.font = `700 ${14.5 * SCALE}px ${FONT_STACK}`;
        ctx.fillStyle = dark ? '#a9bdf0' : '#8a6a1f';
        ctx.fillText(label, pad + 14 * SCALE, y + 14 * SCALE);
        y += 28 * SCALE;
        ctx.font = `500 ${14.5 * SCALE}px ${FONT_STACK}`;
        const lines = wrapText(ctx, text, innerW - 28 * SCALE, 8);
        ctx.fillStyle = dark ? 'rgba(235,241,252,0.92)' : '#40392c';
        lines.forEach(line => {
          ctx.fillText(line, pad + 14 * SCALE, y + 14 * SCALE);
          y += 14.5 * SCALE * 1.55;
        });
        y += 14 * SCALE;
      });
    });
  }

  // 面向浏览器的贴图工厂: 缓存 + THREE.CanvasTexture
  function createCardTexturePainter({ THREE }) {
    const cache = new Map();
    function keyOf(spec) {
      return JSON.stringify([spec.kind, spec.rank, spec.title, spec.quote, spec.meta, spec.back]);
    }
    function paintToCanvas(spec, isBack) {
      const canvas = document.createElement('canvas');
      canvas.width = PIXEL_W;
      canvas.height = PIXEL_H;
      const ctx = canvas.getContext('2d');
      if (isBack) drawCardBack(ctx, spec); else drawCardFace(ctx, spec);
      return canvas;
    }
    function makeTexture(canvas) {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace || 'srgb';
      tex.anisotropy = 8;
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
        if (!cache.has(key)) cache.set(key, makeTexture(paintToCanvas(spec, false)));
        return cache.get(key);
      },
      backTexture(spec) {
        const key = 'B' + keyOf(spec);
        if (!cache.has(key)) cache.set(key, makeTexture(paintToCanvas(spec, true)));
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
