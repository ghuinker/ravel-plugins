import { installedThemes } from "./installed.ts";

// Numeric dials a fixed theme can have, shown in Settings → Appearance while that theme is active (declared in the theme's theme.json). Ravel's own dials (style, colour) are cards in `dials.ts`.
export type Dial = { kind: string; label: string; hint: string; min: number; max: number; fallback: number };

export const themeDials = (name: string): Dial[] => installedThemes().find((theme) => theme.name === name)?.dials ?? [];
export const allDials = (): Dial[] => installedThemes().flatMap((theme) => theme.dials);
