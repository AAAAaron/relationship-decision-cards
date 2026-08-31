const cssHref = new URL('./modern-strategy-hand-layout.css', import.meta.url).href;
if (!document.querySelector(`link[href="${cssHref}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  document.head.appendChild(link);
}

function cardsOf(hand) {
  return [...hand.querySelectorAll(':scope > .dom-strategy-card')];
}

// Restored from the old DOM layoutHand():
// - primary/center sits highest
// - 138px center spacing for a normal 5-card hand
// - 5px vertical drop per half-step
// - 4.2deg rotation per half-step
// - focused card rises 46px, straightens and scales 1.05
// - every card to its left/right yields another 30px away from focus
function layoutOriginalHand(hand, focus = -1, browseShift = 0) {
  const cards = cardsOf(hand);
  const n = cards.length;
  if (!n) return { cards, spacing: 0, span: 0 };
  const spacing = Math.min(138, 760 / Math.max(1, n - 1));
  cards.forEach((card, i) => {
    const offset = i - (n - 1) / 2;
    let x = offset * spacing + browseShift;
    if (focus >= 0 && i < focus) x -= 30;
    if (focus >= 0 && i > focus) x += 30;
    const y = Math.abs(offset) * 5;
    const angle = offset * 4.2;
    const focused = i === focus;
    const transform = focused
      ? `translateX(calc(-50% + ${x}px)) translateY(${y - 46}px) rotate(0deg) scale(1.05)`
      : `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${angle}deg)`;
    card.style.transform = transform;
    card.style.setProperty('--z', focused ? '50' : String(i + 2));
    card.classList.toggle('focused', focused);
  });
  return { cards, spacing, span: spacing * Math.max(0, n - 1) + 200 };
}

export function installCurvedHandBrowsing(domCardLayer) {
  const hand = domCardLayer?.layer?.querySelector('[data-dom-hand-layer]')
    || document.querySelector('[data-dom-hand-layer]');
  if (!hand || hand.dataset.curvedBrowseReady === '1') return null;
  hand.dataset.curvedBrowseReady = '1';

  let frame = 0;
  let focus = -1;
  let browseShift = 0;
  let maxBrowse = 0;

  function refresh() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const { cards, span } = layoutOriginalHand(hand, focus, browseShift);
      const available = Math.max(240, hand.clientWidth - 30);
      const narrow = window.matchMedia('(max-width:720px)').matches;
      const browseable = narrow || cards.length > 5 || span > available;
      maxBrowse = browseable ? Math.max(0, (span - available) / 2 + 54) : 0;
      if (!browseable) browseShift = 0;
      hand.dataset.canBrowse = browseable ? '1' : '0';
      layoutOriginalHand(hand, focus, browseShift);
    });
  }

  function setFocus(card) {
    const cards = cardsOf(hand);
    const next = card ? cards.indexOf(card) : -1;
    if (next === focus) return;
    focus = next;
    layoutOriginalHand(hand, focus, browseShift);
  }

  // Event delegation survives hand innerHTML replacement on every sync.
  const onMouseOver = event => {
    const card = event.target.closest('.dom-strategy-card');
    if (!card || card.parentElement !== hand) return;
    setFocus(card);
  };
  const onMouseOut = event => {
    const from = event.target.closest('.dom-strategy-card');
    if (!from || from.parentElement !== hand) return;
    const to = event.relatedTarget?.closest?.('.dom-strategy-card');
    if (to && to.parentElement === hand) return;
    setFocus(null);
    from.style.setProperty('--tilt-rx', '0deg');
    from.style.setProperty('--tilt-ry', '0deg');
  };
  const onMouseMove = event => {
    const card = event.target.closest('.dom-strategy-card.focused');
    if (!card || card.parentElement !== hand) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--tilt-rx', `${(-y * 4).toFixed(1)}deg`);
    card.style.setProperty('--tilt-ry', `${(x * 4).toFixed(1)}deg`);
  };

  const observer = new MutationObserver(() => {
    focus = -1;
    browseShift = 0;
    refresh();
  });
  observer.observe(hand, { childList: true });
  const onResize = () => refresh();
  window.addEventListener('resize', onResize);
  refresh();

  // Overflow browsing is deliberately secondary. A standard 3–5 card hand does not move as a viewport.
  let dragging = false;
  let moved = false;
  let suppressClick = false;
  let startX = 0;
  let startShift = 0;
  let pointerId = null;

  function canBrowse() { return hand.dataset.canBrowse === '1' && maxBrowse > 0; }
  function applyBrowse(next) {
    browseShift = Math.max(-maxBrowse, Math.min(maxBrowse, next));
    layoutOriginalHand(hand, focus, browseShift);
  }
  const onPointerDown = event => {
    if (!canBrowse()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.dom-card-flip')) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startShift = browseShift;
    hand.classList.add('is-dragging');
    try { hand.setPointerCapture(pointerId); } catch (_) {}
  };
  const onPointerMove = event => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    if (!moved) return;
    applyBrowse(startShift + dx);
    event.preventDefault();
  };
  const finishDrag = event => {
    if (!dragging || (event?.pointerId != null && event.pointerId !== pointerId)) return;
    dragging = false;
    hand.classList.remove('is-dragging');
    try { if (pointerId != null) hand.releasePointerCapture(pointerId); } catch (_) {}
    if (moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 80);
    }
    pointerId = null;
  };
  const onClickCapture = event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onWheel = event => {
    if (!canBrowse()) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    applyBrowse(browseShift - delta * 0.55);
    event.preventDefault();
  };
  const onKeyDown = event => {
    if (!canBrowse() || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    applyBrowse(browseShift + (event.key === 'ArrowLeft' ? 120 : -120));
    event.preventDefault();
  };

  hand.tabIndex = 0;
  hand.setAttribute('aria-label', '应对手牌');
  hand.addEventListener('mouseover', onMouseOver);
  hand.addEventListener('mouseout', onMouseOut);
  hand.addEventListener('mousemove', onMouseMove);
  hand.addEventListener('pointerdown', onPointerDown);
  hand.addEventListener('pointermove', onPointerMove, { passive: false });
  hand.addEventListener('pointerup', finishDrag);
  hand.addEventListener('pointercancel', finishDrag);
  hand.addEventListener('lostpointercapture', finishDrag);
  hand.addEventListener('click', onClickCapture, true);
  hand.addEventListener('wheel', onWheel, { passive: false });
  hand.addEventListener('keydown', onKeyDown);

  return {
    hand,
    refresh,
    layout: () => layoutOriginalHand(hand, focus, browseShift),
    dispose() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      hand.removeEventListener('mouseover', onMouseOver);
      hand.removeEventListener('mouseout', onMouseOut);
      hand.removeEventListener('mousemove', onMouseMove);
      hand.removeEventListener('pointerdown', onPointerDown);
      hand.removeEventListener('pointermove', onPointerMove);
      hand.removeEventListener('pointerup', finishDrag);
      hand.removeEventListener('pointercancel', finishDrag);
      hand.removeEventListener('lostpointercapture', finishDrag);
      hand.removeEventListener('click', onClickCapture, true);
      hand.removeEventListener('wheel', onWheel);
      hand.removeEventListener('keydown', onKeyDown);
      delete hand.dataset.curvedBrowseReady;
    }
  };
}

export { layoutOriginalHand };
export const modernStrategyHandBrowseInstalled = true;
