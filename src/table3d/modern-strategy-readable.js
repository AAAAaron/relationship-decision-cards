const g = window;
const Texture = g.Table3dCardTexture;
if (!Texture) throw new Error('Readable card layer: texture module missing');

const baseFace = Texture.drawCardFace;
const baseBack = Texture.drawCardBack;
const W = Texture.PIXEL_W || 768;
const H = Texture.PIXEL_H || 1228;
const FONT = '"Outfit","PingFang SC","Microsoft YaHei",system-ui,sans-serif';

const RANK = {
  primary: { label: 'AI 首选', accent: '#c79842', ink: '#6f4c15', wash: '#f3e6c8' },
  backup:  { label: '条件备选', accent: '#6f8fc6', ink: '#36547f', wash: '#dfe8f6' },
  other:   { label: '其他路线', accent: '#8993a0', ink: '#4e5966', wash: '#e6e9ed' },
  risk:    { label: '当前不选', accent: '#b96d74', ink: '#78383e', wash: '#f1dde0' }
};

function rankOf(rank) { return RANK[rank] || RANK.other; }
function rr(ctx,x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else{ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}}

function truncate(text, maxChars) {
  const s = String(text || '').trim();
  return s.length > maxChars ? `${s.slice(0, Math.max(1, maxChars - 1))}…` : s;
}

function wrap(ctx, text, maxWidth, maxLines = 6) {
  const chars = [...String(text || '').trim()];
  const lines = [];
  let line = '';
  for (const ch of chars) {
    const next = line + ch;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const out = lines.slice(0, maxLines);
  let last = out[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  out[maxLines - 1] = `${last}…`;
  return out;
}

function quoteFontSize(text) {
  const n = [...String(text || '')].length;
  if (n <= 26) return 78;
  if (n <= 40) return 70;
  if (n <= 58) return 62;
  return 56;
}

function drawPill(ctx, text, style) {
  ctx.font = `700 22px ${FONT}`;
  const width = Math.min(190, ctx.measureText(text).width + 34);
  ctx.fillStyle = style.wash;
  rr(ctx, 52, 48, width, 42, 21);
  ctx.fill();
  ctx.strokeStyle = `${style.accent}88`;
  ctx.lineWidth = 1.5;
  rr(ctx, 52, 48, width, 42, 21);
  ctx.stroke();
  ctx.fillStyle = style.ink;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, 69, 69);
}

function drawReadableFace(ctx, spec) {
  if (spec.kind === 'scene') {
    baseFace(ctx, spec);
    return;
  }

  const rank = rankOf(spec.rank);
  const quote = String(spec.quote || '选择这条路线，再决定最终表达。').trim();
  const title = String(spec.title || '回应').trim();

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fffdf7');
  bg.addColorStop(.58, '#f4eee2');
  bg.addColorStop(1, '#e8dfd0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Only one quiet accent edge. No gems, rivets or fantasy ornaments.
  ctx.fillStyle = rank.accent;
  rr(ctx, 28, 30, 7, H - 60, 3.5);
  ctx.fill();

  ctx.strokeStyle = 'rgba(75,62,43,.14)';
  ctx.lineWidth = 2;
  rr(ctx, 28, 30, W - 56, H - 60, 24);
  ctx.stroke();

  drawPill(ctx, rank.label, rank);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2b2a27';
  ctx.font = `800 46px ${FONT}`;
  wrap(ctx, title, W - 112, 2).forEach((line, i) => ctx.fillText(line, 54, 158 + i * 55));

  ctx.strokeStyle = `${rank.accent}66`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(54, 250);
  ctx.lineTo(174, 250);
  ctx.stroke();

  // The actual sentence the user may say is the visual center of the card.
  const qSize = quoteFontSize(quote);
  ctx.font = `650 ${qSize}px ${FONT}`;
  ctx.fillStyle = '#211f1b';
  const lines = wrap(ctx, `“${quote}”`, W - 112, 6);
  const lineHeight = Math.round(qSize * 1.34);
  const blockHeight = lines.length * lineHeight;
  const availableTop = 305;
  const availableBottom = 940;
  const startY = Math.max(availableTop + qSize, availableTop + ((availableBottom - availableTop - blockHeight) / 2) + qSize);
  lines.forEach((line, i) => ctx.fillText(line, 54, startY + i * lineHeight));

  // One reason only. Full logic remains on the card back.
  const reason = truncate(spec.back?.logic || spec.back?.invalid || '', 48);
  if (reason) {
    ctx.fillStyle = 'rgba(58,50,40,.07)';
    rr(ctx, 52, 988, W - 104, 116, 18);
    ctx.fill();
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = rank.ink;
    ctx.fillText(spec.kind === 'reply' ? '本回合采用' : '为什么值得考虑', 70, 1027);
    ctx.font = `520 24px ${FONT}`;
    ctx.fillStyle = '#6b6257';
    wrap(ctx, reason, W - 144, 2).forEach((line, i) => ctx.fillText(line, 70, 1067 + i * 31));
  }

  // Reply cards may show the chosen speaking style, but only as a small footer.
  const styleMeta = Array.isArray(spec.meta) ? spec.meta.find(m => m.label === '语气') : null;
  if (styleMeta?.value) {
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = '#857c6f';
    ctx.fillText(`语气 · ${truncate(styleMeta.value, 16)}`, 54, H - 56);
  }
}

function createPainter({ THREE }) {
  const cache = new Map();
  const key = spec => JSON.stringify([spec.kind,spec.rank,spec.title,spec.quote,spec.summary,spec.meta,spec.back]);
  function make(spec, isBack) {
    const k = `${isBack ? 'B' : 'F'}${key(spec)}`;
    if (cache.has(k)) return cache.get(k);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (isBack) baseBack(ctx, spec);
    else drawReadableFace(ctx, spec);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace || 'srgb';
    texture.anisotropy = 6;
    cache.set(k, texture);
    return texture;
  }
  return {
    CARD_W: Texture.CARD_W,
    CARD_H: Texture.CARD_H,
    PIXEL_W: W,
    PIXEL_H: H,
    frontTexture: spec => make(spec, false),
    backTexture: spec => make(spec, true),
    clearCache() {
      for (const texture of cache.values()) texture.dispose?.();
      cache.clear();
    }
  };
}

Texture.drawCardFace = drawReadableFace;
Texture.createCardTexturePainter = createPainter;

export const modernStrategyReadableInstalled = true;
