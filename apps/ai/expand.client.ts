// "Expand" in the chat's ⋮ menu: toggles a larger view of the panel in the middle of the screen (desktop only; phones are already full screen).
declare const signal: AbortSignal; // passed in by the panel (apps/ai/index.ts); aborts when the scripts run again

const STORAGE_KEY = "chatExpanded";
const wrap = () => document.getElementById("claude-wrap");

function setExpanded(on: boolean) {
  wrap()?.toggleAttribute("data-expanded", on);
  localStorage.setItem(STORAGE_KEY, on ? "1" : "");
}

function decorate(popup: Element) {
  if (popup.querySelector("[data-expand]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.expand = "";
  button.className = popup.querySelector("button")?.className ?? "";
  const sync = () => {
    button.textContent = wrap()?.hasAttribute("data-expanded") ? "Shrink chat" : "Expand chat";
  };
  sync();
  button.addEventListener("click", () => {
    setExpanded(!wrap()?.hasAttribute("data-expanded"));
    (document.activeElement as HTMLElement | null)?.blur();
  });
  popup.prepend(button);
}

const scan = () => document.querySelectorAll(".ravel-chat-menu .ravel-chat-popup").forEach(decorate);
setExpanded(localStorage.getItem(STORAGE_KEY) === "1");
scan();
const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });
signal.addEventListener("abort", () => observer.disconnect());
