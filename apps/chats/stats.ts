import { listChats, readChat } from "@ravel/chat.ts";
import { readEntries } from "./usage-log.ts";
import { allMeta } from "./db.ts";
import { dateIn } from "../../lib/time.ts";
import { userZone } from "@app/settings/api.ts";

type Entry = { at: string; role: string; text: string };

/** What can be read from a chat's own entries. */
export type Analysis = { sent: number; preview: string; firstAsk: string; haystack: string; touched: string[]; activeMinutes: number; errored: boolean; daily: Record<string, number> };

const IDLE_GAP_MS = 5 * 60_000; // a longer pause between entries isn't counted as time spent
const HAYSTACK_LENGTH = 3000;
const PREVIEW_LENGTH = 140;
const WRITES = new Set(["Edit", "Write", "MultiEdit"]);

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

/** "Edit /x/space/apps/habits/view.ts" → "habits"; a top-level file like main.ts → "main"; anything else → null. */
export function touchedApp(toolText: string): string | null {
  const [tool, path = ""] = toolText.split(/\s+/);
  if (!WRITES.has(tool)) return null;
  const inApps = path.match(/(?:^|\/)apps\/([\w-]+)\//);
  if (inApps) return inApps[1];
  const lib = path.match(/(?:^|\/)(lib)\//);
  if (lib) return lib[1];
  return /(?:^|\/)main\.ts$/.test(path) ? "main" : null;
}

export function analyze(entries: Entry[], zone = userZone()): Analysis {
  const touched = new Map<string, number>();
  const daily: Record<string, number> = {};
  const spoken: string[] = [];
  let sent = 0, activeMs = 0, previous = 0, lastReply = "", firstAsk = "";
  for (const entry of entries) {
    const time = Date.parse(entry.at);
    if (entry.role === "seen" || entry.role === "title" || entry.role === "close") continue;
    if (previous && time - previous <= IDLE_GAP_MS) activeMs += time - previous;
    previous = time;
    if (entry.role === "you") {
      sent++;
      firstAsk ||= oneLine(entry.text);
      const day = dateIn(time, zone);
      daily[day] = (daily[day] ?? 0) + 1;
      spoken.push(oneLine(entry.text));
    } else if (entry.role === "ai" && entry.text.trim()) {
      lastReply = oneLine(entry.text);
      spoken.push(lastReply);
    } else if (entry.role === "tool") {
      const app = touchedApp(entry.text);
      if (app) touched.set(app, (touched.get(app) ?? 0) + 1);
    }
  }
  // A chat "errored" when its last real entry is an error other than the owner pressing stop.
  const last = entries.filter((entry) => !["seen", "title", "close", "done"].includes(entry.role)).at(-1);
  return {
    sent,
    preview: clip(lastReply, PREVIEW_LENGTH),
    firstAsk: clip(firstAsk, PREVIEW_LENGTH),
    haystack: clip(spoken.join(" "), HAYSTACK_LENGTH).toLowerCase(),
    touched: [...touched].sort((a, b) => b[1] - a[1]).map(([app]) => app),
    activeMinutes: Math.round(activeMs / 60_000),
    errored: last?.role === "error" && last.text !== "Stopped.",
    daily,
  };
}

export type ChatRow = Analysis & {
  id: string; title: string; startedAt: string; updatedAt: string; messages: number;
  pinned: boolean; hidden: boolean; system: boolean; summary: string; costUsd: number;
};

const cache = new Map<string, { updatedAt: string; analysis: Analysis }>();

function analysisOf(id: string, updatedAt: string): Analysis {
  const hit = cache.get(id);
  if (hit?.updatedAt === updatedAt) return hit.analysis;
  const analysis = analyze(readChat(id) as Entry[]);
  cache.set(id, { updatedAt, analysis });
  return analysis;
}

/** Cost of each chat's own runs, from the usage log. */
export function costByChat(): Map<string, number> {
  const costs = new Map<string, number>();
  for (const entry of readEntries()) if (entry.chat) costs.set(entry.chat, (costs.get(entry.chat) ?? 0) + entry.costUsd);
  return costs;
}

/** Every chat, newest first, with what we know about it. Hidden ones are included (the page filters). */
export function chatRows(): ChatRow[] {
  const meta = allMeta();
  const costs = costByChat();
  return listChats()
    .map((chat) => {
      const extra = meta.get(chat.id);
      return {
        ...analysisOf(chat.id, chat.updatedAt),
        id: chat.id, title: chat.title, startedAt: chat.startedAt, updatedAt: chat.updatedAt, messages: chat.messages,
        pinned: Boolean(extra?.pinned), hidden: Boolean(extra?.hidden), system: chat.labels.includes("system"), summary: extra?.summary ?? "", costUsd: costs.get(chat.id) ?? 0,
      };
    })
    .sort((first, second) => second.startedAt.localeCompare(first.startedAt));
}
