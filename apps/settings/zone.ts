// The owner's two time zones, kept in the settings table:
//   home    (`tz.home`)    the owner's own zone, set on the account page: the day habits count in, nightly work, backups.
//   current (`tz.current`) where the owner is now, reported by the browser or the iOS app whenever they open it: what "today",
//                          clocks, quiet hours and sunset follow.
// Until a zone is saved, home is the first one a device reports; with none at all, UTC.
import { isZone } from "../../lib/time.ts";
import { getSetting, setSetting } from "./define.ts";

const saved = (key: string) => {
  const value = getSetting(key);
  return isZone(value) ? value : null;
};

/** The owner's own zone. */
export const homeZone = () => saved("tz.home") ?? saved("tz.current") ?? "UTC";

/** Where the owner is right now (the last zone a device reported), or home when none has. */
export const currentZone = () => saved("tz.current") ?? homeZone();

/** The zone for anything the owner sees or is told about right now. Same as `currentZone`. */
export const userZone = currentZone;

export const hasHomeZone = () => saved("tz.home") !== null;

/** Saves a zone a device reported. The first report also becomes home. Returns true when the current zone changed. */
export function reportZone(tz: unknown): boolean {
  if (!isZone(tz)) return false;
  if (!hasHomeZone()) setSetting("tz.home", tz);
  if (saved("tz.current") === tz) return false;
  setSetting("tz.current", tz);
  return true;
}

export function setHomeZone(tz: unknown): boolean {
  if (!isZone(tz)) return false;
  setSetting("tz.home", tz);
  return true;
}

/** Formats an instant in a zone (the owner's current one by default), e.g. `fmt(at, { month: "short", day: "numeric" })`. */
export const fmt = (instant: number | string | Date, options: Intl.DateTimeFormatOptions, tz = userZone()) =>
  new Date(instant).toLocaleString("en-US", { timeZone: tz, ...options });
