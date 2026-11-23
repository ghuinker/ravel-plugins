import assert from "node:assert/strict";
import page, { create, discard, erase, pin, restore, save, trash } from "./index.ts";
import { noteTotal, readNote } from "./db.ts";
import { fakeCtx } from "@ravel/test.ts";

const now = Date.now();

Deno.test("create adds an empty note once, even when replayed", () => {
  create(fakeCtx({ signals: { id: "kwifi" }, at: now }));
  create(fakeCtx({ signals: { id: "kwifi" }, at: now }));
  assert.equal(readNote("kwifi")?.body, "");
  assert.equal(noteTotal(), 1);
});

Deno.test("save writes the whole text, and an older save loses", async () => {
  save(fakeCtx({ signals: { id: "kwifi", body: "Wifi\nhunter2" }, at: now + 2000 }));
  save(fakeCtx({ signals: { id: "kwifi", body: "Wifi\nold" }, at: now + 1000 }));
  assert.equal(readNote("kwifi")?.body, "Wifi\nhunter2");
  assert.equal(readNote("kwifi")?.updated_at, now + 2000);
  assert.match((await page(fakeCtx())).value, /hunter2/);
});

Deno.test("pin sets the value it's given", () => {
  pin(fakeCtx({ signals: { id: "kwifi", pinned: true } }));
  pin(fakeCtx({ signals: { id: "kwifi", pinned: true } }));
  assert.equal(readNote("kwifi")?.pinned, 1);
  pin(fakeCtx({ signals: { id: "kwifi", pinned: false } }));
  assert.equal(readNote("kwifi")?.pinned, 0);
});

Deno.test("trash, restore and erase move a note through the trash", () => {
  const ctx = fakeCtx({ signals: { id: "kwifi" } });
  erase(ctx); // only trashed notes can be erased
  assert.equal(noteTotal(), 1);
  trash(ctx);
  assert.equal(noteTotal(), 0);
  assert.notEqual(readNote("kwifi")?.deleted_at, null);
  restore(ctx);
  assert.equal(noteTotal(), 1);
  trash(ctx);
  erase(ctx);
  assert.equal(readNote("kwifi"), undefined);
});

Deno.test("ids that aren't lowercase letters and digits are ignored", () => {
  create(fakeCtx({ signals: { id: "1; DROP" } }));
  assert.equal(noteTotal(), 0);
});

Deno.test("a blank note is never made, and an emptied one goes when the owner leaves it", () => {
  const before = noteTotal();
  save(fakeCtx({ signals: { id: "kblank", body: "  \n" }, at: now }));
  assert.equal(readNote("kblank"), undefined);
  save(fakeCtx({ signals: { id: "kemptied", body: "hi" }, at: now }));
  save(fakeCtx({ signals: { id: "kemptied", body: "" }, at: now + 1 }));
  assert.equal(readNote("kemptied")?.body, "");
  discard(fakeCtx({ signals: { id: "kemptied" } }));
  assert.equal(readNote("kemptied"), undefined);
  discard(fakeCtx({ signals: { id: "kwifi" } })); // a note with text stays
  assert.equal(noteTotal(), before);
});

Deno.test("an older save with a separate title and text still lands", () => {
  save(fakeCtx({ signals: { id: "kold", title: "Old", text: "queued" }, at: now }));
  assert.equal(readNote("kold")?.body, "Old\nqueued");
});
