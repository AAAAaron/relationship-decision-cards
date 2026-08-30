const href = new URL('./modern-strategy-dom-card-flip.css', import.meta.url).href;
if (!document.querySelector(`link[href="${href}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
export const modernStrategyDomFlipCssLoaded = true;
