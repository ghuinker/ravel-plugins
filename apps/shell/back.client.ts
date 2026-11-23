// The layout stays put across pages, so the pill watches the page pane: it shows when the page registered a parent with backTo() and links there.
const pill = document.getElementById("back-pill") as HTMLAnchorElement | null;
const pane = document.querySelector("[data-page-pane]");
if (pill && pane && !(pill as any).wired) {
  (pill as any).wired = true;
  let moved = false;
  const sync = () => {
    const to = pane.querySelector<HTMLElement>("[data-back-to]")?.dataset.backTo;
    pill.hidden = !to;
    if (to) pill.href = to;
  };
  sync();
  new MutationObserver(sync).observe(pane, { childList: true, subtree: true });
  addEventListener("ravel-navigate", () => { moved = true; });
  pill.addEventListener("click", (e) => {
    (window as any).ravel?.haptic?.("tap");
    // Came from another page of this site: go back to it, not up.
    if (moved && history.length > 1) { e.preventDefault(); history.back(); }
  });
}
