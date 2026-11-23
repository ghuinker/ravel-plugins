// Dates, times and time zones. The owner's zones (`homeZone`, `userZone`, `fmt`) come from `@app/settings/api.ts`.

const DAY_MS = 86_400_000;

export const isZone = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Offset (ms) of a time zone from UTC at an instant. */
export function zoneOffset(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)!.value);
  const shown = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return shown - Math.floor(instant / 1000) * 1000;
}

/** Wall-clock time in a zone (as if it were UTC) to a real instant. */
export function wallToInstant(wall: number, tz: string): number {
  if (tz === "UTC") return wall;
  const guess = wall - zoneOffset(wall, tz);
  return wall - zoneOffset(guess, tz);
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export const dateIn = (instant: number, tz: string) => new Date(instant).toLocaleDateString("en-CA", { timeZone: tz });

/** The hour (0 to 23) in a time zone. */
export const hourIn = (tz: string, instant: number) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(instant)) % 24;

const wallOf = (date: string) => Date.parse(`${date}T00:00:00Z`);

export const addDays = (date: string, days: number) => new Date(wallOf(date) + days * DAY_MS).toISOString().slice(0, 10);

/** First instant of a calendar day in a time zone. */
export const dayStart = (date: string, tz: string) => wallToInstant(wallOf(date), tz);

export const formatTime = (instant: number, tz: string) =>
  new Date(instant).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

export const formatDay = (date: string) =>
  new Date(wallOf(date)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" });
