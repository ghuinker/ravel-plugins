import { addDays, dateIn, formatTime } from "../../lib/time.ts";

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

export type Group = "Pinned" | "Today" | "Yesterday" | "This week" | string;

/** "Today", "Yesterday", "This week", then one group per month ("October 2026"). Dates are days in the owner's zone. */
export function groupOf(startedAt: string, zone: string, now = Date.now()): Group {
  const today = dateIn(now, zone);
  const day = dateIn(Date.parse(startedAt), zone);
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  if (day > addDays(today, -WEEK_DAYS)) return "This week";
  return new Date(Date.parse(startedAt)).toLocaleDateString("en-US", { timeZone: zone, month: "long", year: "numeric" });
}

/** The time on today's rows, the weekday this week, a short date after that. */
export function whenLabel(at: string, zone: string, now = Date.now()): string {
  const instant = Date.parse(at);
  const today = dateIn(now, zone);
  const day = dateIn(instant, zone);
  if (day === today) return formatTime(instant, zone);
  if (day > addDays(today, -WEEK_DAYS)) return new Date(instant).toLocaleDateString("en-US", { timeZone: zone, weekday: "short" });
  return new Date(instant).toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric" });
}

export const longWhen = (at: string, zone: string) =>
  new Date(Date.parse(at)).toLocaleString("en-US", { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const money = (usd: number) => (usd > 0 && usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`);

export const minutesLabel = (minutes: number) => (minutes < 1 ? "<1 min" : minutes < 60 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} h`);

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Chats started in the 7 days ending now, and in the 7 days before. */
export function weekCounts(startedAts: string[], now = Date.now()) {
  const within = (from: number, to: number) => startedAts.filter((at) => Date.parse(at) > now - to * DAY_MS && Date.parse(at) <= now - from * DAY_MS).length;
  return { thisWeek: within(0, WEEK_DAYS), lastWeek: within(WEEK_DAYS, WEEK_DAYS * 2) };
}

/** Message counts per day for a heatmap: `weeks` columns of 7 days (Monday first) ending with this week. Days after today are null. */
export function heatGrid(daily: Record<string, number>, today: string, weeks = 12): (null | { day: string; count: number })[][] {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const first = addDays(today, -weekday - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, row) => {
      const day = addDays(first, week * 7 + row);
      return day > today ? null : { day, count: daily[day] ?? 0 };
    }));
}

/** 0 for a quiet day, then 1 to 4 by how busy it is against the busiest. */
export const heatLevel = (count: number, max: number) => (count === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((count / max) * 4)));
