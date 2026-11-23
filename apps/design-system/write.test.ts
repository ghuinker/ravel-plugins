import assert from "node:assert/strict";
import { defaultThread, defaultTokens, markedSkin, themeCss } from "./write.ts";

const names = (path: string) =>
  [...Deno.readTextFileSync(new URL(path, import.meta.url)).matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]).sort();

Deno.test("both default modes set the same variables", () => {
  assert.deepEqual(names("./defaults.light.css"), names("./defaults.dark.css"));
});

Deno.test("theme.css: the skin's @import first, then defaults, components, and the skin's variables last", () => {
  const css = themeCss(`:root[data-mode=dark] { --accent: red; }\n@import url("https://fonts.example/a.css");`);
  assert.ok(css.startsWith("@import"));
  assert.ok(css.indexOf(":root[data-mode=dark] { --scheme") < css.indexOf(".t-card"));
  assert.ok(css.indexOf(".t-card") < css.indexOf(".hm-pop"));
  assert.ok(css.indexOf(".hm-pop") < css.indexOf("--accent: red"));
});

Deno.test("without a skin, the tokens and thread come from the defaults", () => {
  const tokens = defaultTokens();
  assert.equal(tokens.mode, "dark");
  assert.ok(tokens.accent);
  assert.equal(defaultThread().colors.length, 3);
});

Deno.test("the skin marker names the app, and only a trailing one counts", () => {
  assert.equal(markedSkin("a{}\n/* skin:theme */\n"), "theme");
  assert.equal(markedSkin("a{}\n"), null);
  assert.equal(markedSkin("/* skin:theme */\na{}\n"), null);
});
