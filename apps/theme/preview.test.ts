import assert from "node:assert/strict";
import { parseLook } from "./preview.ts";
import { listThemes } from "./site-theme.ts";

Deno.test({ name: "parseLook reads a theme and picks", ignore: !listThemes().includes("highland"), fn: () => {
  assert.deepEqual(parseLook(["highland", "mode=light", "cows=2"], ["ravel", "highland"]), { theme: "highland", mode: "light", cows: "2" });
} });

Deno.test("parseLook rejects unknown themes and values", () => {
  assert.equal(parseLook(["nope"], ["ravel"]), "not a theme or pick: nope");
  assert.equal(parseLook(["mode=purple"], ["ravel"]), "not a theme or pick: mode=purple");
});
