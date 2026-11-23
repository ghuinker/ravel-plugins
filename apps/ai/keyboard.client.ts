// On phones the keyboard covers the fixed panel; lift it above the keyboard and keep it within the visible area.
declare const signal: AbortSignal; // passed in by the panel (apps/ai/index.ts); aborts when the scripts run again

const viewport = window.visualViewport;

function lift() {
  const wrap = document.getElementById("claude-wrap"), panel = document.getElementById("claude-panel");
  if (!wrap || !panel || !viewport) return;
  const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
  const phone = matchMedia("(max-width: 767px)").matches; // full screen, no margin
  wrap.style.bottom = keyboard ? `${keyboard + (phone ? 0 : 16)}px` : "";
  panel.style.maxHeight = keyboard && !phone ? `${viewport.height - 32}px` : "";
}

if (viewport) {
  viewport.addEventListener("resize", lift, { signal });
  viewport.addEventListener("scroll", lift, { signal });
  lift(); // the scripts run again when the page re-renders, which resets the styles
}
