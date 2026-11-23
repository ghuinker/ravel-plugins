// Turns the core's red `.ravel-error` boxes into a calmer card. Most errors seen while the AI is editing fix themselves
// when it saves the next file, so for the first minute and a half the box says "Working on it" with the Ravel loop and
// hides the error text. If it is still there after that it becomes "Uh oh" with the error and an ask-AI button.
// A ⋮ menu is always on the card to ask AI, show the error or copy it.
declare const chat: RavelChatClient; // passed in by the panel (apps/ai/index.ts) with the abort signal below
declare const signal: AbortSignal;

type Parts = { card: HTMLElement; mark: HTMLElement; head: HTMLElement; sub: HTMLElement; ask: HTMLElement; toggle: HTMLElement };
type ErrorBox = HTMLElement & { __uhOh?: Parts };

const ANSI = /\u001b\[[0-9;]*m/g;
const GRACE_MS = 90_000;
const seen = new Map<string, number>(); // error key -> when this page first showed it (the box itself is replaced on every re-render)
const loader = () => (globalThis as typeof globalThis & { ravelLoader?: { scan(): void } }).ravelLoader;

const style = document.createElement("style");
style.textContent = `
.ravel-error[data-uh-oh-state=working]{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important}
.ravel-error[data-uh-oh-state=working]>:not([data-uh-oh-card]){display:none!important}
.ravel-error[data-uh-oh-state=working][data-uh-oh-open]>:not([data-uh-oh-card]):not([data-uh-oh-ask]){display:revert!important}
.ravel-error[data-uh-oh-state=working]>[data-uh-oh-ask]{display:none!important}
.ravel-error[data-uh-oh-state=stuck]>b{display:none}
`;
document.head.append(style);
signal.addEventListener("abort", () => style.remove());

const detailOf = (box: Element) => (box.querySelector("pre")?.textContent ?? "").replace(ANSI, "").trim();
const titleOf = (box: Element) => box.querySelector("b")?.textContent ?? "Something failed";

function report(box: Element) {
  return `Uh oh: ${titleOf(box)} on ${location.pathname}\n\n\`\`\`\n${detailOf(box)}\n\`\`\`\n\nPlease find the cause and fix it.`;
}

function loop(kind: string) {
  const canvas = document.createElement("canvas");
  canvas.dataset.ravelLoader = kind;
  canvas.dataset.key = "uh-oh";
  canvas.style.cssText = "display:block;width:56px;height:28px";
  return canvas;
}

function build(box: ErrorBox): Parts {
  const card = document.createElement("div");
  card.dataset.uhOhCard = "";
  card.className = "relative flex items-center gap-3 rounded-2xl border t-card px-4 py-3";
  const mark = document.createElement("span");
  mark.className = "t-accent";
  mark.style.cssText = "flex:none;display:inline-flex";
  const text = document.createElement("div");
  text.className = "min-w-0 flex-1";
  const head = document.createElement("div");
  head.className = "text-sm font-semibold t-ink";
  const sub = document.createElement("div");
  sub.className = "text-xs t-muted";
  const ask = document.createElement("button");
  ask.type = "button";
  ask.className = "mt-2 rounded-xl border t-accent-bg px-3 py-1.5 text-sm font-semibold";
  ask.textContent = "Ask AI to fix this";
  ask.addEventListener("click", () => {
    globalThis.ravel?.haptic?.("tap");
    chat.ask(report(box));
  });
  text.append(head, sub, ask);

  const wrap = document.createElement("div");
  wrap.className = "relative flex-none self-start";
  const dots = document.createElement("button");
  dots.type = "button";
  dots.setAttribute("aria-label", "More options");
  dots.setAttribute("aria-haspopup", "menu");
  dots.className = "flex size-8 items-center justify-center rounded-full";
  dots.style.color = "var(--accent, currentColor)";
  dots.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="size-6"><circle cx="12" cy="12" r="9.5" stroke-width="1.6" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>';
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  menu.className = "absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border t-nav py-1 text-sm shadow-lg";
  const item = (label: string, run: (button: HTMLButtonElement) => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.className = "block w-full px-3 py-2 text-left t-hover";
    button.textContent = label;
    button.addEventListener("click", () => {
      menu.hidden = true;
      globalThis.ravel?.haptic?.("tap");
      run(button);
    });
    return button;
  };
  const toggle = item("Show error", (button) => {
    const open = box.toggleAttribute("data-uh-oh-open");
    button.textContent = open ? "Hide error" : "Show error";
  });
  menu.append(
    item("Ask AI for help", () => chat.ask(report(box))),
    toggle,
    item("Copy error", () => navigator.clipboard?.writeText(`${titleOf(box)}\n${detailOf(box)}`)),
  );
  dots.addEventListener("click", (event) => {
    event.stopPropagation();
    globalThis.ravel?.haptic?.("tap");
    menu.hidden = !menu.hidden;
  });
  const close = () => {
    menu.hidden = true;
  };
  document.addEventListener("click", close, { signal });
  wrap.append(dots, menu);

  card.append(mark, text, wrap);
  box.prepend(card);
  return { card, mark, head, sub, ask, toggle };
}

function render(box: ErrorBox) {
  const key = `${location.pathname}\n${titleOf(box)}\n${detailOf(box).slice(0, 200)}`;
  if (!seen.has(key)) seen.set(key, Date.now());
  const stuck = Date.now() - seen.get(key)! >= GRACE_MS;
  const state = stuck ? "stuck" : "working";
  const parts = box.__uhOh ??= build(box);
  if (box.dataset.uhOhState === state) return;
  box.dataset.uhOhState = state;
  parts.mark.replaceChildren(loop(stuck ? "idle" : "unravel"));
  parts.head.textContent = stuck ? "Uh oh — this is still failing" : "Working on it…";
  parts.sub.textContent = stuck
    ? `${titleOf(box)}. Ask AI to take a look.`
    : "The AI is probably mid-edit; this usually fixes itself.";
  parts.ask.style.display = stuck ? "" : "none";
  parts.toggle.textContent = box.hasAttribute("data-uh-oh-open") ? "Hide error" : "Show error";
  loader()?.scan();
}

function scan() {
  const boxes = document.querySelectorAll<ErrorBox>(".ravel-error");
  if (!boxes.length) seen.clear();
  boxes.forEach(render);
}

scan();
const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });
const timer = setInterval(scan, 5000);
signal.addEventListener("abort", () => {
  observer.disconnect();
  clearInterval(timer);
});
