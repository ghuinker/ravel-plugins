import assert from "node:assert/strict";
import { cleanTitle, titleNotes } from "./title.ts";
import { readNote, upsertNote } from "./db.ts";

Deno.test("a reply is cleaned to one short line", () => {
  assert.equal(cleanTitle('"Ask landlord about the tap."\nextra'), "Ask landlord about the tap");
  assert.equal(cleanTitle(""), "");
});

Deno.test("only notes with no short first line get a title, once", async () => {
  const run = "Remember to ask the landlord about the leaking tap in the upstairs bathroom before the end of the month";
  upsertNote("ktl1", run, Date.now());
  upsertNote("ktl2", "Groceries\nmilk", Date.now());
  let asked = 0;
  assert.equal(await titleNotes(async () => (asked++, "Leaking tap")), 1);
  assert.equal(await titleNotes(async () => (asked++, "Again")), 0);
  assert.equal(asked, 1);
  assert.equal((readNote("ktl1") as { auto_title: string }).auto_title, "Leaking tap");
});
