import { dateIn } from "../../lib/time.ts";
import { userZone } from "@app/settings/api.ts";

// `usage/` sits in the space root, two levels up from apps/chats/.
const spacePath = (path: string) => new URL(`../../${path}`, import.meta.url);

export type UsageEntry = {
  at: string;
  kind: string;
  label: string;
  chat?: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
};

export type Totals = { runs: number; costUsd: number; tokens: number };
export type Group = Totals & { name: string };
export type Day = { day: string; costUsd: number; runs: number };

const MS_PER_DAY = 86_400_000;
export const RANGES = [7, 30, 90] as const;

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function parseLine(line: string): UsageEntry | null {
  try {
    const raw = JSON.parse(line);
    if (typeof raw.at !== "string" || Number.isNaN(Date.parse(raw.at))) return null;
    return {
      at: raw.at,
      kind: String(raw.kind ?? "other"),
      label: String(raw.label ?? "unknown"),
      chat: typeof raw.chat === "string" ? raw.chat : undefined,
      model: String(raw.model ?? "unknown"),
      input: num(raw.input),
      output: num(raw.output),
      cacheRead: num(raw.cacheRead),
      cacheWrite: num(raw.cacheWrite),
      costUsd: num(raw.costUsd),
    };
  } catch {
    return null;
  }
}

/** Every entry in `usage/*.jsonl`, oldest first. Returns [] before anything was tracked. */
export function readEntries(): UsageEntry[] {
  const entries: UsageEntry[] = [];
  try {
    for (const file of Deno.readDirSync(spacePath("usage"))) {
      if (!file.isFile || !/^\d{4}-\d{2}\.jsonl$/.test(file.name)) continue;
      for (const line of Deno.readTextFileSync(spacePath(`usage/${file.name}`)).split("\n")) {
        const entry = line.trim() && parseLine(line);
        if (entry) entries.push(entry);
      }
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export const tokensOf = (entry: UsageEntry) => entry.input + entry.output + entry.cacheRead + entry.cacheWrite;

export function totals(entries: UsageEntry[]): Totals {
  return {
    runs: entries.length,
    costUsd: entries.reduce((sum, entry) => sum + entry.costUsd, 0),
    tokens: entries.reduce((sum, entry) => sum + tokensOf(entry), 0),
  };
}

/** Groups by `key`, most expensive first. */
export function groupBy(entries: UsageEntry[], key: (entry: UsageEntry) => string): Group[] {
  const groups = new Map<string, UsageEntry[]>();
  for (const entry of entries) groups.set(key(entry), [...(groups.get(key(entry)) ?? []), entry]);
  return [...groups].map(([name, list]) => ({ name, ...totals(list) })).sort((a, b) => b.costUsd - a.costUsd || b.runs - a.runs);
}

/** One bucket per day in the owner's zone, ending today, with zeros for quiet days. */
export function perDay(entries: UsageEntry[], days: number, now = new Date()): Day[] {
  const zone = userZone();
  const buckets = new Map<string, Day>();
  for (let back = days - 1; back >= 0; back--) {
    const day = dateIn(now.getTime() - back * MS_PER_DAY, zone);
    buckets.set(day, { day, costUsd: 0, runs: 0 });
  }
  for (const entry of entries) {
    const bucket = buckets.get(dateIn(Date.parse(entry.at), zone));
    if (bucket) {
      bucket.costUsd += entry.costUsd;
      bucket.runs++;
    }
  }
  return [...buckets.values()];
}

export function inRange(entries: UsageEntry[], days: number, now = new Date()) {
  const since = now.getTime() - days * MS_PER_DAY;
  return entries.filter((entry) => Date.parse(entry.at) >= since);
}
