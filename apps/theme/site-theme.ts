import { state } from "@app/settings/api.ts";
import { parseVars } from "@ravel/theme.ts";
import { currentMode, dialValues, lookedTheme } from "./picks.ts";
import type { Mode } from "./picks.ts";
import { installedThemes, themeFolder } from "./installed.ts";

/** The theme every site starts with: it ships in `themes/ravel/`. */
export const DEFAULT_THEME = "ravel";

const appsUrl = (path: string) => new URL(`../${path}`, import.meta.url);
const readText = (path: string) => Deno.readTextFileSync(appsUrl(path));
const exists = (path: string) => {
  try {
    Deno.statSync(appsUrl(path));
    return true;
  } catch {
    return false;
  }
};

// Every theme is an installed theme (installed.ts), Ravel included: its folder has vars.light.css and vars.dark.css
// (the same variables in both modes), and optionally extra.css (rules for it alone) and extra.client.ts (scenery).
const themePath = (name: string, file: string) => `${themeFolder(name)}/${file}`;
const themeVars = (name: string, mode: Mode = currentMode()) => readText(themePath(name, `vars.${mode}.css`));
const themeExtra = (name: string) => exists(themePath(name, "extra.css")) ? readText(themePath(name, "extra.css")) : "";

/** Every theme, Ravel first. */
export function listThemes(): string[] {
  const names = installedThemes().map((theme) => theme.name);
  return [DEFAULT_THEME, ...names.filter((name) => name !== DEFAULT_THEME)];
}

export function currentTheme(): string {
  const stored = lookedTheme() ?? state(import.meta).get("name");
  return stored && listThemes().includes(stored) ? stored : DEFAULT_THEME;
}

export function setTheme(name: string): boolean {
  if (!listThemes().includes(name)) return false;
  state(import.meta).set("name", name);
  return true;
}

export const themeLabel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export const previewClass = (name: string) => `theme-preview-${name}`;

const MODES: Mode[] = ["light", "dark"];

// Both modes are in the file, and the site serves the page with data-mode from tokens.json, so a mode switch is one attribute.
// Every theme also gets a `.theme-preview-<name>` class for the picker. Its extra.css adds rules while it is active;
// @import lines move to the top, where CSS requires them.
export function themeCss(): string {
  const active = currentTheme();
  const perMode = MODES.flatMap((mode) => [
    `:root[data-mode=${mode}] { ${themeVars(active, mode)} }`,
    ...listThemes().map((name) => `:root[data-mode=${mode}] .${previewClass(name)} { ${themeVars(name, mode)} }`),
  ]);
  const extra = themeExtra(active).split("\n");
  const imports = extra.filter((line) => line.startsWith("@import"));
  const rules = extra.filter((line) => !line.startsWith("@import"));
  return [...imports, ...perMode, ...rules].join("\n");
}

const extraScript = (theme: string) => themePath(theme, "extra.client.ts");

/** The active theme's tokens in its current mode, for the iOS app. */
export function themeTokens(): Record<string, string> {
  const { scheme: _, ...tokens } = parseVars(themeVars(currentTheme()));
  return { mode: currentMode(), ...tokens } as Record<string, string>;
}

/** The browser files for theme/: `theme.client.ts` loads the page-change motion (`apps/shell/transition.client.ts`, when the shell is installed; which has to be listening before the first paint, so it can't live in the layout), and for a theme with scenery also `dials.client.ts` (sets `window.__themeDials`) and its `extra.client.ts`. */
export function themeClient(): Record<string, string> {
  const active = currentTheme();
  const motion = exists("shell/transition.client.ts") ? `import "../apps/shell/transition.client.ts";\n` : "";
  if (!exists(extraScript(active))) return { "theme.client.ts": motion };
  return {
    "dials.client.ts": `(globalThis as { __themeDials?: unknown }).__themeDials = ${JSON.stringify(dialValues(active))};\n`,
    "theme.client.ts": `${motion}import "./dials.client.ts";\nimport "../apps/${extraScript(active)}";\n`,
  };
}

/** The active theme's three thread colors (--r-t1..3), and whether it is light (the loaders blend differently there). */
export function themeThread(): { colors: string[]; light: boolean } {
  const active = currentTheme();
  const css = themeVars(active);
  const color = (n: number) => new RegExp(`--r-t${n}\\s*:\\s*([^;]+);`).exec(css)?.[1].trim() ?? "#ffffff";
  return { colors: [color(1), color(2), color(3)], light: currentMode() === "light" };
}
