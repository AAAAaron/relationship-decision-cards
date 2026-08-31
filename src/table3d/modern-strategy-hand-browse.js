const cssHref = new URL('./modern-strategy-hand-layout.css', import.meta.url).href;
if (!document.querySelector(`link[href="${cssHref}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  document.head.appendChild(link);
}

function applyArc(hand) {
  const cards = [...hand.querySelectorAll(':scope > .dom-strategy-card')];
  const count = cards.length;
  cards.forEach((card, index) => {
    const offset = index - (count - 1) / 2;
    const abs = Math.abs(offset);
    const drop = Math.min(24, abs * 8);
    const rotate = Math.max(-9, Math.min(9, offset * 3.6));
    const z = 30 - Math.round(abs * 3);
    card.style.setProperty('--hand-drop', `${drop}px`);
    card.style.setProperty('--hand-rot', `${rotate}deg`);
    card.style.setProperty('--hand-z', String(z));
  });

  const browseable = hand.scrollWidth > hand.clientWidth + 6;
  hand.dataset.canBrowse = browseable ? '1' : '0';
  return browseable;
}

function centerHand(hand, force = false) {
  if (!force && hand.dataset.userBrowsed === '1') return;
  const max = Math.max(0, hand.scrollWidth - hand.clientWidth);
  hand.scrollLeft = max / 2;
}

export function installCurvedHandBrowsing(domCardLayer) {
  const hand = domCardLayer?.layer?.querySelector('[data-dom-hand-layer]')
    || document.querySelector('[data-dom-hand-layer]');
  if (!hand || hand.dataset.curvedBrowseReady === '1') return null;
  hand.dataset.curvedBrowseReady = '1';

  let frame = 0;
  const refresh = (forceCenter = false) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      applyArc(hand);
      centerHand(hand, forceCenter);
    });
  };

  const observer = new MutationObserver(() => refresh(false));
  observer.observe(hand, { childList: true });

  // Initial render and viewport changes recalculate the shallow fan.
  refresh(true);
  const onResize = () => refresh(false);
  window.addEventListener('resize', onResize);

  let dragging = false;
  let moved = false;
  let suppressClick = false;
  let startX = 0;
  let startScroll = 0;
  let pointerId = null;

  const markBrowsed = () => {
    hand.dataset.userBrowsed = '1';
  };

  const onPointerDown = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.dom-card-flip')) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = hand.scrollLeft;
    hand.classList.add('is-dragging');
    try { hand.setPointerCapture(pointerId); } catch (_) {}
  };

  const onPointerMove = event => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    if (!moved) return;
    hand.scrollLeft = startScroll - dx;
    markBrowsed();
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
    if (hand.scrollWidth <= hand.clientWidth + 6) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    hand.scrollLeft += delta * 0.9;
    markBrowsed();
    event.preventDefault();
  };

  const onKeyDown = event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    hand.scrollBy({ left: direction * 150, behavior: 'smooth' });
    markBrowsed();
    event.preventDefault();
  };

  hand.tabIndex = 0;
  hand.setAttribute('aria-label', '应对手牌，可左右滑动浏览');
  hand.addEventListener('pointerdown', onPointerDown);
  hand.addEventListener('pointermove', onPointerMove, { passive: false });
  hand.addEventListener('pointerup', finishDrag);
  hand.addEventListener('pointercancel', finishDrag);
  hand.addEventListener('lostpointercapture', finishDrag);
  hand.addEventListener('click', onClickCapture, true);
  hand.addEventListener('wheel', onWheel, { passive: false });
  hand.addEventListener('keydown', onKeyDown);
  hand.addEventListener('scroll', markBrowsed, { passive: true });

  return {
    hand,
    refresh,
    dispose() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      hand.removeEventListener('pointerdown', onPointerDown);
      hand.removeEventListener('pointermove', onPointerMove);
      hand.removeEventListener('pointerup', finishDrag);
      hand.removeEventListener('pointercancel', finishDrag);
      hand.removeEventListener('lostpointercapture', finishDrag);
      hand.removeEventListener('click', onClickCapture, true);
      hand.removeEventListener('wheel', onWheel);
      hand.removeEventListener('keydown', onKeyDown);
      hand.removeEventListener('scroll', markBrowsed);
      delete hand.dataset.curvedBrowseReady;
    }
  };
}

export const modernStrategyHandBrowseInstalled = true;
