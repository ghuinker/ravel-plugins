import type { Dial } from "./theme-dials.ts";

// A fixed theme is a folder `<app>/themes/<name>/` in any app, with `vars.light.css` and `vars.dark.css`, and optionally `theme.json` (`name`, `dials`), `extra.css` and `extra.client.ts`. Read from disk each
// time, so a newly added theme shows up at once and this app never imports one.
export type InstalledTheme = { name: string; path: string; dials: Dial[] };

const appsDir = new URL("../", import.meta.url);

const dirs = (url: URL) => {
  try {
    return [...Deno.readDirSync(url)].filter((entry) => entry.isDirectory).map((entry) => entry.name);
  } catch {
    return [];
  }
};

const readJson = (url: URL): Record<string, unknown> => {
  try {
    return JSON.parse(Deno.readTextFileSync(url));
  } catch {
    return {};
  }
};
const hasVars = (url: URL) => ["light", "dark"].every((mode) => {
  try {
    return Deno.statSync(new URL(`vars.${mode}.css`, url)).isFile;
  } catch {
    return false;
  }
});

export function installedThemes(): InstalledTheme[] {
  const found: InstalledTheme[] = [];
  for (const app of dirs(appsDir)) {
    for (const dir of dirs(new URL(`${app}/themes/`, appsDir))) {
      const url = new URL(`${app}/themes/${dir}/`, appsDir);
      if (!hasVars(url)) continue;
      // theme.json is optional: older themes (apps/theme/themes/<name>/ before themes moved out) have none and are named by their folder.
      const json = readJson(new URL("theme.json", url));
      const name = typeof json.name === "string" ? json.name : dir;
      if (!/^[a-z][a-z0-9-]*$/.test(name) || found.some((theme) => theme.name === name)) continue;
      found.push({
        name,
        path: `${app}/themes/${dir}`,
        dials: Array.isArray(json.dials) ? json.dials as Dial[] : [],
      });
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** The path under apps/ of a theme's folder. */
export const themeFolder = (name: string) => installedThemes().find((theme) => theme.name === name)?.path;
