// Writes theme-preview/, which only Claude's browser reads, so a look can be tried without changing the owner's pages.
// From the space root: `RAVEL_SPACE=$PWD deno run -A apps/theme/preview.ts [theme] [kind=value ...]` (kinds as in
// picks.ts: mode, palette, day, style, dials), or `--clear` to delete it. Unset picks keep the owner's current ones.
import { writeTheme } from "@app/design-system/api.ts";
import { tryLook, validPick } from "./picks.ts";
import { listThemes } from "./site-theme.ts";
import { skin } from "./skin.ts";

const FOLDER = "theme-preview";

/** The overrides from the command line, or an error naming the bad argument. */
export function parseLook(args: string[], themes: string[]): Record<string, string> | string {
  const look: Record<string, string> = {};
  for (const arg of args) {
    const [kind, value] = arg.includes("=") ? arg.split("=", 2) : ["theme", arg];
    const ok = kind === "theme" ? themes.includes(value) : validPick(kind, value);
    if (!ok) return `not a theme or pick: ${arg}`;
    look[kind] = value;
  }
  return look;
}

if (import.meta.main) {
  const dir = new URL(`../../${FOLDER}/`, import.meta.url);
  if (Deno.args[0] === "--clear") {
    Deno.removeSync(dir, { recursive: true });
  } else {
    const look = parseLook(Deno.args, listThemes());
    if (typeof look === "string") {
      console.error(look);
      Deno.exit(1);
    }
    tryLook(look);
    await writeTheme(FOLDER, skin);
    console.log(`wrote ${FOLDER}/; reload the page in your browser`);
  }
}
