import assert from "node:assert/strict";
import { dateGroup, firstLineLong, isBlank, joinBody, noteTitle, notePreview, splitBody, wantsTitle } from "./format.ts";

Deno.test("the title falls back, and the preview is the first non-empty line", () => {
  assert.equal(noteTitle("Groceries"), "Groceries");
  assert.equal(noteTitle("  "), "New Note");
  assert.equal(noteTitle("## **Plan**"), "Plan");
  assert.equal(notePreview("\nmilk\neggs"), "milk");
  assert.equal(notePreview(""), "No additional text");
  assert.equal(notePreview("## **Plan** for [x](https://a.b)"), "Plan for x");
  assert.equal(notePreview("- [ ] buy \\*milk\\*"), "buy *milk*");
  assert.equal(notePreview("| a | b |\n| --- | --- |"), "a b");
});

Deno.test("split and join round-trip", () => {
  for (const body of ["a", "a\nb", "a\n\nb\n"]) assert.equal(joinBody(splitBody(body)), body);
});

Deno.test("dates group like the Notes app", () => {
  const now = new Date(2026, 9, 20, 15);
  const ago = (days: number) => new Date(2026, 9, 20 - days, 9);
  assert.equal(dateGroup(ago(0), now), "Today");
  assert.equal(dateGroup(ago(1), now), "Yesterday");
  assert.equal(dateGroup(ago(5), now), "Previous 7 Days");
  assert.equal(dateGroup(ago(20), now), "Previous 30 Days");
  assert.equal(dateGroup(new Date(2026, 5, 1), now), "June");
  assert.equal(dateGroup(new Date(2024, 5, 1), now), "2024");
});

Deno.test("a long first line has no title of its own, and wants one once the note runs on", () => {
  const paragraph = "Remember to ask the landlord about the leaking tap in the upstairs bathroom before the end of the month";
  assert.ok(firstLineLong(paragraph) && !firstLineLong("Groceries\n" + paragraph));
  assert.ok(wantsTitle(paragraph) && !wantsTitle("Remember to ask the landlord about the leaking tap soon") && !wantsTitle("Groceries\nmilk"));
  assert.ok(isBlank(" \n ") && !isBlank("a"));
});
