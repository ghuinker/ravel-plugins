// Picks how a page change moves: sideways between tabs (toward the side the new tab sits on in the bar), in or out when
// going into or back out of a page. Ravel's router swaps the page in place, so the pane (`data-page-pane` in the layout) is
// animated here: `ravel-navigate` starts the exit and the swap starts the entrance. A full page load keeps the fade in base.css.
const tabs: string[][] = [];

/** Every tab's paths, in nav order (the bar lists each tab once before its More copies). */
function readTabs() {
  if (tabs.length) return tabs;
  const seen = new Set<string>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>("nav[data-tab-bar] a[href]")) {
    const path = new URL(link.href).pathname;
    if (seen.has(path)) continue;
    seen.add(path);
    tabs.push([path, ...(link.dataset.navAlso ?? "").split(" ").filter(Boolean)]);
  }
  return tabs;
}

const under = (path: string, base: string) => path === base || (base !== "/" && path.startsWith(`${base}/`));
const tabOf = (path: string) => readTabs().findIndex((paths) => paths.some((base) => under(path, base)));
const depth = (path: string) => path.split("/").filter(Boolean).length;

/** The transition type for going from one path to another, or none when it's the same page. */
function typeFor(from: string, to: string): string | null {
  if (from === to) return null;
  const a = tabOf(from), b = tabOf(to);
  if (a >= 0 && b >= 0 && a !== b) return b > a ? "to-right" : "to-left";
  return depth(to) === depth(from) ? null : depth(to) > depth(from) ? "deeper" : "shallower";
}

// ---- The router's in-place swap -------------------------------------------------------------------------------------

const MOVES: Record<string, { out: Keyframe; from: Keyframe }> = {
  "to-right": { out: { opacity: 0, transform: "translateX(-32px)" }, from: { opacity: 0, transform: "translateX(32px)" } },
  "to-left": { out: { opacity: 0, transform: "translateX(32px)" }, from: { opacity: 0, transform: "translateX(-32px)" } },
  deeper: { out: { opacity: 0, transform: "scale(1.03)" }, from: { opacity: 0, transform: "scale(.97)" } },
  shallower: { out: { opacity: 0, transform: "scale(.97)" }, from: { opacity: 0, transform: "scale(1.03)" } },
};
const SHOWN: Keyframe = { opacity: 1, transform: "none" };
const OUT_MS = 180, IN_MS = 420, GIVE_UP_MS = 2500;
const EASE_IN = "cubic-bezier(.4, 0, 1, 1)", EASE_OUT = "cubic-bezier(.16, .84, .3, 1)";

type Win = typeof globalThis & { __tTransition?: boolean };
if (!(globalThis as Win).__tTransition) {
  (globalThis as Win).__tTransition = true;
  let current = location.pathname;
  let leaving: Animation | null = null;
  let watcher: MutationObserver | null = null;
  let giveUp = 0;

  const settle = () => {
    watcher?.disconnect();
    watcher = null;
    clearTimeout(giveUp);
  };

  addEventListener("ravel-navigate", (event) => {
    const path = (event as CustomEvent<{ path: string }>).detail.path;
    const type = typeFor(current, path);
    current = path;
    const pane = document.querySelector<HTMLElement>("[data-page-pane]");
    settle();
    leaving?.cancel();
    leaving = null;
    if (!type || !pane || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = MOVES[type];
    const out = pane.animate([SHOWN, move.out], { duration: OUT_MS, easing: EASE_IN, fill: "forwards" });
    leaving = out;
    // The first change inside the pane after the click is the new page arriving.
    const arrive = () => {
      settle();
      if (leaving !== out) return;
      out.cancel();
      leaving = null;
      pane.animate([move.from, SHOWN], { duration: IN_MS, easing: EASE_OUT });
    };
    watcher = new MutationObserver(arrive);
    watcher.observe(pane, { childList: true, subtree: true });
    giveUp = window.setTimeout(arrive, GIVE_UP_MS); // the same page again: nothing arrives, so bring it back
  });
}
