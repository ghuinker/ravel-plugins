const WIDE = "(min-width: 768px)";
const COUNT_MS = 900;

/** Does this row belong in the list for the search text and filter? Rows carry their flags as data attributes and their text in .conv-hay. */
function show(query: string, filter: string, row: HTMLElement) {
  const flags = row.dataset;
  const hidden = flags.cvHidden === "1";
  if (filter === "hidden") return hidden && matches(query, row);
  if (filter === "system") return flags.cvSystem === "1" && !hidden && matches(query, row);
  if (hidden || flags.cvSystem === "1") return false;
  if (filter === "pinned" && flags.cvPinned !== "1") return false;
  if (filter === "changed" && flags.cvChanged !== "1") return false;
  if (filter === "errored" && flags.cvErrored !== "1") return false;
  if (filter.startsWith("tag-") && !(flags.cvTags ?? "").includes(`,${filter.slice(4)},`)) return false;
  return matches(query, row);
}

function matches(query: string, row: HTMLElement) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = row.querySelector(".conv-hay")?.textContent?.toLowerCase() ?? "";
  return words.every((word) => text.includes(word));
}

const rows = (scope: ParentNode) => [...scope.querySelectorAll<HTMLElement>("[data-chat-row]")];

/** A section shows while any of its rows does. */
const any = (query: string, filter: string, section: HTMLElement) => rows(section).some((row) => show(query, filter, row));

/** True when nothing in the whole list is showing. */
const none = (query: string, filter: string) => !rows(document).some((row) => show(query, filter, row));

/** Phone: open the chat. Desktop: pick it for the preview card. */
const wide = () => matchMedia(WIDE).matches;

/** Counts a number up from zero. The element already holds the final text, so without motion nothing changes. */
function count(el: HTMLElement) {
  const target = Number(el.dataset.count);
  const places = Number(el.dataset.places || 0);
  if (!Number.isFinite(target) || target === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now();
  const format = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places });
  const tick = (now: number) => {
    const progress = Math.min(1, (now - start) / COUNT_MS);
    el.textContent = (el.dataset.prefix ?? "") + format(target * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

Object.assign(globalThis, { convView: { show, any, none, wide, count } });
