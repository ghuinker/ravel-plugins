import assert from "node:assert/strict";
import { currentTheme, DEFAULT_THEME, listThemes, setTheme, themeCss, themeLabel, themeThread, themeTokens } from "./site-theme.ts";
import { currentMode, dialValues, savePick, setPick } from "./picks.ts";
import { themeDials } from "./theme-dials.ts";
import { installedThemes, themeFolder } from "./installed.ts";

const names = (css: string) => [...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);
const varsOf = (name: string, mode: string) => Deno.readTextFileSync(new URL(`../${themeFolder(name)}/vars.${mode}.css`, import.meta.url));
const noHighland = !listThemes().includes("highland"); // Highland lives in the owner's private my-themes app

Deno.test("defaults to Ravel, and a stored theme that no longer exists falls back to it", () => {
  assert.equal(currentTheme(), DEFAULT_THEME);
  assert.equal(DEFAULT_THEME, "ravel");
  assert.equal(listThemes()[0], "ravel");
  assert.equal(currentMode(), "light");
});

Deno.test({ name: "a theme's label comes from its theme.json", ignore: noHighland, fn: () => {
  assert.equal(themeLabel("highland"), "Highland");
} });

Deno.test("setTheme saves a known theme and rejects an unknown one", () => {
  assert.equal(setTheme("ravel"), true);
  assert.equal(currentTheme(), "ravel");
  assert.equal(setTheme("../etc"), false);
  assert.equal(currentTheme(), "ravel");
});

Deno.test("the CSS holds both modes of the active theme and a preview per theme and mode", () => {
  const css = themeCss();
  assert.ok(css.includes(":root[data-mode=light] { --"));
  assert.ok(css.includes(":root[data-mode=dark] { --"));
  for (const name of listThemes()) {
    assert.ok(css.includes(`:root[data-mode=light] .theme-preview-${name}`));
    assert.ok(css.includes(`:root[data-mode=dark] .theme-preview-${name}`));
  }
});

Deno.test("every theme has a light and a dark mode with the same variables, thread colors included", () => {
  const required = names(varsOf("ravel", "light"));
  assert.ok(required.includes("--radius-card") && required.includes("--font-design"));
  for (const name of listThemes()) {
    const light = names(varsOf(name, "light"));
    const dark = names(varsOf(name, "dark"));
    assert.deepEqual([...light].sort(), [...dark].sort(), `${name}: light and dark define different variables`);
    for (const variable of [...required.filter((variable) => !variable.startsWith("--rv-")), "--r-t1", "--r-t2", "--r-t3"]) assert.ok(light.includes(variable), `${name} lacks ${variable}`);
    assert.match(varsOf(name, "light"), /--scheme:\s*light/);
    assert.match(varsOf(name, "dark"), /--scheme:\s*dark/);
  }
});

Deno.test({ name: "the mode switches a fixed theme's variables, tokens and thread colors", ignore: noHighland, fn: () => {
  setTheme("highland");
  setPick("mode", "dark");
  const dark = themeTokens();
  assert.equal(dark.mode, "dark");
  assert.equal(themeThread().light, false);
  setPick("mode", "light");
  assert.notEqual(themeTokens().bg, dark.bg);
  assert.equal(themeTokens().mode, "light");
  assert.equal(themeThread().light, true);
  assert.equal(themeThread().colors.length, 3);
  setTheme("ravel");
} });

Deno.test({ name: "a dial is validated and saved", ignore: noHighland, fn: () => {
  const cows = themeDials("highland")[0];
  assert.equal(savePick("cows", String(cows.max + 1)), false);
  assert.equal(savePick("cows", "x"), false);
  assert.equal(savePick("nonsense", "1"), false);
  assert.equal(savePick("cows", "2"), true);
  assert.deepEqual(dialValues("highland"), { cows: 2 });
  assert.deepEqual(dialValues("ravel"), {});
} });

Deno.test("installed themes come from folders with a theme.json", () => {
  assert.deepEqual([...listThemes()].sort(), installedThemes().map((theme) => theme.name));
  assert.equal(themeFolder("ravel"), "theme/themes/ravel");
});

const canWriteThemes = Deno.permissions.querySync({ name: "write", path: new URL("./themes/", import.meta.url) }).state === "granted";

// Needs write access to apps/theme/themes (the test profile in deno.json grants it, but deno.json is not in git).
Deno.test({ name: "a theme folder without theme.json (the older layout) is found by its folder name", ignore: !canWriteThemes, fn: () => {
  const dir = new URL("./themes/legacy/", import.meta.url);
  Deno.mkdirSync(dir, { recursive: true });
  try {
    for (const mode of ["light", "dark"]) Deno.writeTextFileSync(new URL(`vars.${mode}.css`, dir), `--scheme: ${mode};`);
    const found = installedThemes().find((theme) => theme.name === "legacy");
    assert.equal(found?.path, "theme/themes/legacy");
    assert.deepEqual(found?.dials, []);
    assert.ok(themeCss().includes("theme-preview-legacy"));
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
}});
