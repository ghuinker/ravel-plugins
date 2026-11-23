import { appModules } from "@ravel/apps.ts";
import { parseVars } from "@ravel/theme.ts";
import type { Mode, Skin, Thread } from "./types.ts";

// What Ravel serves with every page comes from theme/: the default tokens and this app's CSS, then the skin (an app
// that lists `"design-system": "./file"` in its plugs and exports `skin` from that file) on top.
const CSS_FILES = ["base.css", "kebab.css", "markdown.css", "rich-edit.css", "heatmap.css"];
const MODES: Mode[] = ["light", "dark"];
const DEFAULT_MODE: Mode = "dark";

const here = (path: string) => new URL(path, import.meta.url);
const readText = (path: string) => Deno.readTextFileSync(here(path));
const defaults = (mode: Mode) => readText(`defaults.${mode}.css`);

let skinApp = "";

/** The installed skin; the first by folder name when there are several. */
export async function skin(): Promise<Skin | null> {
  const found = await appModules<{ plugs?: Record<string, unknown> }>("app.ts");
  for (const { app, mod } of found) {
    const value = mod.plugs?.["design-system"];
    if (typeof value !== "string" || !value.startsWith("./")) continue;
    const file = /\.[jt]sx?$/.test(value) ? value.slice(2) : `${value.slice(2)}.ts`;
    try {
      const plugged = await import(new URL(`../${app}/${file}`, import.meta.url).href) as { skin?: Skin };
      if (plugged.skin) {
        skinApp = app;
        return plugged.skin;
      }
    } catch (error) {
      console.error(`apps/${app}/${file} not loaded:`, error);
    }
  }
  return null;
}

/** The whole theme/theme.css: @import lines first (CSS requires it), then defaults, components, and the skin. */
export function themeCss(skinCss: string): string {
  const lines = skinCss.split("\n");
  const imports = lines.filter((line) => line.startsWith("@import"));
  const rest = lines.filter((line) => !line.startsWith("@import"));
  const base = MODES.map((mode) => `:root[data-mode=${mode}] { ${defaults(mode)} }`);
  return [...imports, ...base, ...CSS_FILES.map(readText), ...rest].join("\n");
}

/** Tokens for the iOS app (and `data-mode`) when no skin is installed. */
export function defaultTokens(): Record<string, string> {
  const { scheme: _, ...tokens } = parseVars(defaults(DEFAULT_MODE));
  return { mode: DEFAULT_MODE, ...tokens } as Record<string, string>;
}

const varOf = (css: string, name: string) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1].trim() ?? "#ffffff";

export function defaultThread(): Thread {
  const css = defaults(DEFAULT_MODE);
  return { colors: [varOf(css, "--r-t1"), varOf(css, "--r-t2"), varOf(css, "--r-t3")], light: false };
}

function writeIfChanged(dir: URL, name: string, text: string | null) {
  const file = new URL(name, dir);
  let old: string | null = null;
  try {
    old = Deno.readTextFileSync(file);
  } catch {
    old = null;
  }
  if (old === text) return;
  if (text === null) Deno.removeSync(file);
  else Deno.writeTextFileSync(file, text);
}

/**
 * Writes theme/ (or `folder`, like `theme-preview`): `theme.css`, `tokens.json`, and the skin's browser files
 * (`theme.client.ts` and what it imports). Files that didn't change are left alone, so open pages only update when something did.
 * Passing `given` skips finding the skin, which loads every app.ts (and this app's writes theme/).
 */
export async function writeTheme(folder = "theme", given?: Skin) {
  const dir = new URL(`../../${folder}/`, import.meta.url);
  Deno.mkdirSync(dir, { recursive: true });
  const active = given ?? await skinWhenReady(dir);
  if (!active && hadSkin(dir)) {
    // The skin failed to load (the site is reloading after an edit, say). Falling back to the defaults would flip every open page to Midnight, so the last good theme stays.
    console.error(`writeTheme: no skin loaded; keeping the current ${folder}/`);
    return;
  }
  writeIfChanged(dir, "theme.css", themeCss(active?.css() ?? "") + (active && !given ? skinMark(skinApp) : ""));
  writeIfChanged(dir, "tokens.json", JSON.stringify(active?.tokens() ?? defaultTokens(), null, 2) + "\n");
  const files = active?.client?.() ?? {};
  for (const entry of Deno.readDirSync(dir)) {
    if (entry.name.endsWith(".client.ts") && !(entry.name in files)) writeIfChanged(dir, entry.name, null);
  }
  for (const [name, text] of Object.entries(files)) writeIfChanged(dir, name, text);
}

const skinMark = (app: string) => `\n/* skin:${app} */\n`;

/** The app named by the trailing skin marker of a theme.css, or null when it was written without one. */
export function markedSkin(css: string): string | null {
  return /\/\* skin:([\w-]+) \*\/\n$/.exec(css)?.[1] ?? null;
}

/** Whether `dir`'s theme.css was last written with a skin on top and that skin's app is still installed (removing it on purpose clears this). */
function hadSkin(dir: URL) {
  try {
    const app = markedSkin(Deno.readTextFileSync(new URL("theme.css", dir)));
    return !!app && Deno.statSync(new URL(`../${app}/`, import.meta.url)).isDirectory;
  } catch {
    return false;
  }
}

/** The skin, trying again for a moment: while files are being edited the skin's modules can fail to load once and work a second later. */
async function skinWhenReady(dir: URL): Promise<Skin | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const found = await skin();
    if (found || !hadSkin(dir)) return found;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return null;
}

/** The three thread colours for the chat loader, and whether the mode is light. */
export async function thread(): Promise<Thread> {
  return (await skin())?.thread?.() ?? defaultThread();
}
