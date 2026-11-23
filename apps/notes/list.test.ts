import assert from "node:assert/strict";
import { count, dropBlank, leaving, listHTML, tagCount } from "./list.ts";

const day = (date: number, hour = 9) => new Date(2026, 9, date, hour).getTime();
const notes = {
  ka: { body: "Groceries\nmilk", pinned: false, trashed: false, updated: day(20), gone: false },
  kb: { body: "Wifi\n<b>pw</b>", pinned: true, trashed: false, updated: day(1), gone: false },
  kc: { body: "Old", pinned: false, trashed: true, updated: day(19), gone: false },
  kd: { body: "Erased", pinned: false, trashed: false, updated: day(20), gone: true },
};
const now = new Date(2026, 9, 20, 15);

Deno.test("the list groups pinned first, escapes text and skips trashed and gone notes", () => {
  const list = listHTML(notes, "all", "", "", now);
  assert.ok(list.indexOf("Pinned") < list.indexOf("Today"));
  assert.ok(list.includes("&lt;b&gt;pw&lt;/b&gt;"));
  assert.ok(!list.includes("Old") && !list.includes("Erased"));
  assert.match(listHTML(notes, "trash", "", "", now), /Old/);
  assert.match(listHTML(notes, "all", "MILK", "", now), /Results[\s\S]*Groceries/);
  assert.match(listHTML(notes, "notes", "nothing", "", now), /No results/);
});

Deno.test("counts for all notes, deleted ones and each tag", () => {
  assert.deepEqual(["all", "trash"].map((view) => count(notes, view)), [2, 1]);
  const tagged = { ...notes, ka: { ...notes.ka, tags: [{ id: 2, label: "🌱 Garden" }, { id: 3, label: "🏠 House" }] } };
  assert.deepEqual([2, 0].map((tag) => tagCount(tagged, tag)), [1, 1]);
});

Deno.test("the tag filter shows a tag's notes, or untagged ones for 0", () => {
  const tagged = { ...notes, ka: { ...notes.ka, tags: [{ id: 2, label: "🌱 Garden" }, { id: 3, label: "🏠 House" }] } };
  const list = listHTML(tagged, "all", "", "", now, 2);
  assert.match(list, /Groceries/);
  assert.match(list, /🌱 Garden/);
  assert.ok(!list.includes("Wifi"));
  assert.match(listHTML(tagged, "all", "", "", now, 3), /Groceries[\s\S]*🏠 House/); // shown under each of its tags, with every chip
  assert.match(listHTML(tagged, "all", "", "", now, 0), /Wifi/);
});

Deno.test("an empty note leaves the list and is dropped when left; the server is told only if it may hold it", () => {
  const draft = { ...notes, ke: { body: "", pinned: false, trashed: false, updated: day(20) }, kf: { body: " ", pinned: false, trashed: false, updated: day(20), sent: true }, kg: { body: "", pinned: true, trashed: false, updated: day(20) } };
  assert.equal(count(draft, "all"), 2); // the blank ones aren't counted
  assert.ok(!listHTML(draft, "all", "", "ke", now).includes("notes/ke"));
  assert.equal(leaving(draft, "ke"), "");
  assert.equal(leaving(draft, "kf"), ""); // ke was never sent
  assert.equal(leaving(draft, ""), "kf");
  assert.ok((draft.ke as { gone?: boolean }).gone === true);
  assert.equal(dropBlank(draft, "kg"), false); // pinned notes stay
  assert.equal(dropBlank(draft, "ka"), false);
});
