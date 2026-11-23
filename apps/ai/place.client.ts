// On a computer the open chat hangs below the top-right group and follows it as the page scrolls: it moves up with the group until it reaches the top (padded), then stays.
declare const signal: AbortSignal; // passed in by the panel (apps/ai/index.ts); aborts when the scripts run again

const GAP = 12, TOP = 16; // px below the group; px from the top of the screen once it gets there

function place() {
  const wrap = document.getElementById("claude-wrap"), group = document.querySelector(".top-group");
  if (!wrap || !group) return;
  const wide = matchMedia("(min-width: 768px)").matches;
  wrap.style.top = wide ? `${Math.max(TOP, group.getBoundingClientRect().bottom + GAP)}px` : "";
}

addEventListener("scroll", place, { passive: true, signal });
addEventListener("resize", place, { signal });
place();
