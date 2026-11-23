import type { NotificationType } from "./types.ts";

/** Types that have a switch, grouped by the app that sends them, in registry order. */
export function groupByApp(types: NotificationType[]): [string, NotificationType[]][] {
  const groups = new Map<string, NotificationType[]>();
  for (const type of types.filter((candidate) => !candidate.asked)) groups.set(type.app, [...(groups.get(type.app) ?? []), type]);
  return [...groups];
}

/** "just now", "5 min ago", "2 h ago", else the day and time in the owner's zone. */
export function logAge(at: number, now: number, zone: string): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(at).toLocaleString("en-US", { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
