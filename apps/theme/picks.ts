import { db, table } from "@ravel/db.ts";
import { allDials, themeDials } from "./theme-dials.ts";

// The site-wide picks: `mode`, and the numeric dials of fixed themes (Branding also keeps its own favorites here).
export type Mode = "dark" | "light";
const DEFAULT_MODE: Mode = "light";
const PICKS = table(import.meta, "picks", "kind TEXT PRIMARY KEY, value TEXT NOT NULL");

// Picks that win over the saved ones, only in preview.ts's own process (it never saves them).
let look: Record<string, string> = {};
export const tryLook = (over: Record<string, string>) => { look = over; };
export const lookedTheme = (): string | undefined => look.theme;

export const getPick = (kind: string, fallback: string) =>
  look[kind] ?? (db.prepare(`SELECT value FROM ${PICKS} WHERE kind = ?`).get(kind) as { value: string } | undefined)?.value ?? fallback;

export const setPick = (kind: string, value: string) =>
  db.prepare(`INSERT INTO ${PICKS} (kind, value) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET value = excluded.value`).run(kind, value);

/** The site-wide mode: every theme has a light and a dark one. */
export const currentMode = (): Mode => (getPick("mode", DEFAULT_MODE) === "light" ? "light" : "dark");

/** A dial's value, kept inside its range. */
export const dialValue = (kind: string, fallback: number, min = 0, max = 99) => {
  const value = Number(getPick(kind, String(fallback)));
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

/** Every dial of the active theme, by kind, for the theme's browser script. */
export const dialValues = (theme: string): Record<string, number> =>
  Object.fromEntries(themeDials(theme).map((dial) => [dial.kind, dialValue(dial.kind, dial.fallback, dial.min, dial.max)]));

const VALID: Record<string, string[]> = {
  mode: ["dark", "light"],
  ...Object.fromEntries(allDials().map((dial) => [dial.kind, Array.from({ length: dial.max - dial.min + 1 }, (_, step) => String(dial.min + step))])),
};

export const validPick = (kind: string, value: string) => VALID[kind]?.includes(value) ?? false;

/** Saves one dial; false when the kind or value isn't one the theme offers. */
export function savePick(kind: string, value: string): boolean {
  if (!validPick(kind, value)) return false;
  setPick(kind, value);
  return true;
}
