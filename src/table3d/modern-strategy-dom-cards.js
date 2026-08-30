const g = window;
const Card3d = g.Table3dCard3d;
if (!Card3d) throw new Error('DOM card layer: Table3dCard3d missing');

const cssHref = new URL('./modern-strategy-dom-cards.css', import.meta.url).href;
if (!document.querySelector(`link[href="${cssHref}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  document.head.appendChild(link);
}

// Keep the WebGL card geometry as a subtle physical shadow/effect target, but do
// not ask a rasterized CanvasTexture to be the primary reading surface.
const createCard3DBase = Card3d.createCard3D.bind(Card3d);
Card3d.createCard3D = function createMutedWebGLCard(args) {
  const group = createCard3DBase(args);
  const card = group?.userData?.card;
  [card?.frontMaterial, card?.backMaterial].filter(Boolean).forEach(material => {
    material.transparent = true;
    material.opacity = 0.10;
    material.depthWrite = false;
    material.needsUpdate = true;
  });
  if (card?.body?.material) {
    card.body.material.transparent = true;
    card.body.material.opacity = 0.18;
    card.body.material.depthWrite = false;
    card.body.material.needsUpdate = true;
  }
  return group;
};

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const rankLabel = rank => ({
  primary: 'AI 首选',
  backup: '条件备选',
  other: '其他路线',
  risk: '当前不选'
}[rank] || '其他路线');

const metaValue = (spec, label) => (Array.isArray(spec?.meta)
  ? spec.meta.find(item => item?.label === label)?.value
  : '') || '';

function reasonFor(spec) {
  if (!spec?.back) return '';
  return String(spec.back.invalid || spec.back.logic || '').trim();
}

function backRows(spec) {
  const rows = [];
  if (spec?.back?.logic) rows.push(['为什么', spec.back.logic]);
  if (spec?.back?.invalid) rows.push(['切换/风险', spec.back.invalid]);
  if (spec?.back?.source) rows.push(['依据', spec.back.source]);
  return rows;
}

function cardMarkup(spec, { id = '', hand = false, selected = false, side = '' } = {}) {
  if (!spec) return '';
  const isScene = spec.kind === 'scene';
  const rank = spec.rank || 'other';
  const source = metaValue(spec, '来源');
  const scene = metaValue(spec, '场景');
  const tone = metaValue(spec, '语气');
  const reason = reasonFor(spec);
  const rows = backRows(spec);
  const classes = [
    'dom-strategy-card',
    isScene ? 'scene' : 'reply',
    `rank-${rank}`,
    selected ? 'selected' : ''
  ].filter(Boolean).join(' ');

  const headLabel = isScene ? (source || '场景') : rankLabel(rank);
  const kindLabel = isScene ? (scene || '当前场景') : (tone || '回应路线');

  return `<article class="${classes}" tabindex="0" data-dom-card-id="${esc(id)}" data-dom-side="${esc(side)}" data-dom-hand="${hand ? '1' : '0'}">
    <div class="dom-card-inner">
      <section class="dom-card-face dom-card-front">
        <button class="dom-card-flip" type="button" aria-label="查看卡背" title="查看卡背">↻</button>
        <header class="dom-card-head">
          <span class="dom-card-rank">${esc(headLabel)}</span>
          <span class="dom-card-kind">${esc(kindLabel)}</span>
        </header>
        <h3 class="dom-card-title">${esc(spec.title || (isScene ? '当前场景' : '回应'))}</h3>
        ${isScene ? `<div class="dom-card-scene-art"><span>${esc(scene || '沟通场景')}</span></div>` : ''}
        <p class="dom-card-quote">“${esc(spec.quote || '')}”</p>
        ${!isScene && !hand && reason ? `<p class="dom-card-reason"><strong>AI判断：</strong>${esc(reason)}</p>` : ''}
      </section>
      <section class="dom-card-face dom-card-back" aria-hidden="true">
        <button class="dom-card-flip" type="button" aria-label="返回卡面" title="返回卡面">↻</button>
        <header class="dom-card-back-head"><span>${isScene ? '场景依据' : 'AI 分析'}</span><strong>${esc(spec.title || '')}</strong></header>
        <div class="dom-card-back-rows">
          ${rows.length ? rows.map(([label,value]) => `<div><em>${esc(label)}</em><p>${esc(value)}</p></div>`).join('') : '<p class="dom-card-back-empty">暂无更多分析。</p>'}
        </div>
      </section>
    </div>
  </article>`;
}

function createLayer() {
  const layer = document.createElement('div');
  layer.className = 'dom-card-layer';
  layer.innerHTML = `
    <div class="dom-card-slot opponent" data-dom-opponent></div>
    <div class="dom-card-slot player" data-dom-player></div>
    <div class="dom-hand-layer" data-dom-hand-layer></div>`;
  document.body.appendChild(layer);
  document.body.classList.add('dom-readable-cards');
  return layer;
}

export function installDomCardLayer(bridge) {
  if (!bridge || document.querySelector('.dom-card-layer')) return null;
  const layer = createLayer();
  const opponentRoot = layer.querySelector('[data-dom-opponent]');
  const playerRoot = layer.querySelector('[data-dom-player]');
  const handRoot = layer.querySelector('[data-dom-hand-layer]');
  let snapshot = null;
  let selectedId = null;

  function render(nextSnapshot) {
    snapshot = nextSnapshot || {};
    selectedId = snapshot.selectedId ?? bridge.getSelectedId?.() ?? selectedId;
    opponentRoot.innerHTML = cardMarkup(snapshot.opponent, { side: 'opponent' });
    playerRoot.innerHTML = cardMarkup(snapshot.player, { side: 'player' });
    handRoot.innerHTML = (snapshot.hand || []).map(entry => cardMarkup(entry.data, {
      id: entry.id,
      hand: true,
      selected: entry.id === selectedId,
      side: 'hand'
    })).join('');
  }

  function selectHand(id) {
    const entry = (snapshot?.hand || []).find(item => item.id === id);
    const nextId = selectedId === id ? null : id;
    selectedId = nextId;
    bridge.selectHand(nextId);
    handRoot.querySelectorAll('.dom-strategy-card').forEach(card => {
      card.classList.toggle('selected', Boolean(nextId) && card.dataset.domCardId === nextId);
    });
    window.dispatchEvent(new CustomEvent('table3d:hand-select', {
      detail: { id: nextId, data: nextId ? entry?.data || null : null }
    }));
  }

  layer.addEventListener('click', event => {
    const flip = event.target.closest('.dom-card-flip');
    const card = event.target.closest('.dom-strategy-card');
    if (!card) return;
    if (flip) {
      event.stopPropagation();
      const flipped = card.classList.toggle('is-flipped');
      card.querySelector('.dom-card-back')?.setAttribute('aria-hidden', flipped ? 'false' : 'true');
      return;
    }
    if (card.dataset.domHand === '1') {
      selectHand(card.dataset.domCardId);
      return;
    }
    const side = card.dataset.domSide;
    if (side === 'opponent' || side === 'player') {
      window.dispatchEvent(new CustomEvent('table3d:board-click', { detail: { kind: side } }));
    }
  });

  layer.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.dom-strategy-card');
    if (!card || event.target.closest('.dom-card-flip')) return;
    event.preventDefault();
    if (card.dataset.domHand === '1') selectHand(card.dataset.domCardId);
  });

  const syncBase = bridge.sync.bind(bridge);
  bridge.sync = nextSnapshot => {
    const result = syncBase(nextSnapshot);
    render(nextSnapshot);
    return result;
  };

  return {
    layer,
    render,
    dispose() { layer.remove(); document.body.classList.remove('dom-readable-cards'); }
  };
}

export const modernStrategyDomCardsInstalled = true;
