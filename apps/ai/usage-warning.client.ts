// Checking costs a call, so check only now and then, and more often once usage is high.
import type { HighLimit } from "./usage-warning.ts";

declare const chat: RavelChatClient; // passed in by the panel (apps/ai/index.ts) with the abort signal below
declare const signal: AbortSignal;

type Check = { at: number; high: boolean; limits?: HighLimit[] };

const KEY = "senUsageCheck";
const NORMAL_MS = 30 * 60 * 1000;
const HIGH_MS = 5 * 60 * 1000;

function read(): Check {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") || { at: 0, high: false };
  } catch {
    return { at: 0, high: false };
  }
}

function senUsageDue() {
  const last = read();
  if (Date.now() - last.at < (last.high ? HIGH_MS : NORMAL_MS)) return false;
  localStorage.setItem(KEY, JSON.stringify({ ...last, at: Date.now() }));
  return true;
}

// Runs when a check's result arrives; every tab shows the saved result, since only the first tab to see a reply end checks.
const senUsageSeen = (limits: HighLimit[]) => localStorage.setItem(KEY, JSON.stringify({ ...read(), high: limits.length > 0, limits }));

const senUsageSaved = () => read().limits ?? [];

function resetsLabel(iso: string) {
  const at = new Date(iso);
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return at.toDateString() === new Date().toDateString() ? time : `${at.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

const senUsageText = (limits: HighLimit[] | null) => (limits || [])
  .map(({ label, percent, resetsAt, credits }) => `${credits ? "Now using usage credits" : `${percent}% of your ${label} limit used`}${resetsAt ? ` · resets ${resetsLabel(resetsAt)}` : ""}`)
  .join("; ");

Object.assign(globalThis, { senUsageDue, senUsageSeen, senUsageSaved, senUsageText });

// Check after a reply finishes, when usage has just changed.
const running = new Set(chat.running());
chat.on(({ type, chat: id }) => {
  if (type !== "status") return;
  const now = chat.status(id).running;
  if (running.has(id) && !now) document.getElementById("ai-usage-check")?.click();
  if (now) running.add(id);
  else running.delete(id);
}, { signal });
