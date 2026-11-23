import assert from "node:assert/strict";
import { allMeta, isChatId, saveSummary, setHidden, setPinned } from "./db.ts";
import { groupOf, heatGrid, heatLevel, whenLabel } from "./format.ts";
import { analyze, touchedApp } from "./stats.ts";
import { cleanSummary, needsSummary } from "./summary.ts";

const ID = "01900000-0000-7000-8000-000000000001";
const ZONE = "America/Denver";
const NOW = Date.parse("2026-11-01T18:00:00Z");

Deno.test("touchedApp reads the app from edited paths only", () => {
  assert.equal(touchedApp("Edit /x/space/apps/habits/view.ts"), "habits");
  assert.equal(touchedApp("Write apps/notes/db.ts"), "notes");
  assert.equal(touchedApp("Read apps/notes/db.ts"), null);
  assert.equal(touchedApp("Edit /x/space/main.ts"), "main");
});

Deno.test("analyze counts messages, apps, active time and errors", () => {
  const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();
  const result = analyze([
    { at: at(0), role: "you", text: "Fix habits" },
    { at: at(2), role: "tool", text: "Edit apps/habits/view.ts" },
    { at: at(3), role: "ai", text: "Done." },
    { at: at(60), role: "you", text: "Again" },
    { at: at(61), role: "error", text: "boom" },
  ], ZONE);
  assert.equal(result.sent, 2);
  assert.deepEqual(result.touched, ["habits"]);
  assert.equal(result.activeMinutes, 4);
  assert.equal(result.errored, true);
  assert.equal(result.preview, "Done.");
});

Deno.test("a stopped chat is not an error", () => {
  assert.equal(analyze([{ at: new Date(NOW).toISOString(), role: "error", text: "Stopped." }], ZONE).errored, false);
});

Deno.test("pin, hide and summary persist; hiding unpins; bad ids are ignored", () => {
  setPinned(ID, true);
  assert.equal(allMeta().get(ID)?.pinned, 1);
  setHidden(ID, true);
  assert.deepEqual([allMeta().get(ID)?.hidden, allMeta().get(ID)?.pinned], [1, 0]);
  saveSummary(ID, "Redid a page", 6);
  assert.equal(allMeta().get(ID)?.summary, "Redid a page");
  setPinned("x'; DROP TABLE chat_meta;--", true);
  assert.equal(isChatId("nope"), false);
  assert.equal(allMeta().size, 1);
});

Deno.test("chats group by Denver day and month", () => {
  assert.equal(groupOf("2026-11-01T17:00:00Z", ZONE, NOW), "Today");
  assert.equal(groupOf("2026-10-31T17:00:00Z", ZONE, NOW), "Yesterday");
  assert.equal(groupOf("2026-10-28T17:00:00Z", ZONE, NOW), "This week");
  assert.equal(groupOf("2026-10-01T17:00:00Z", ZONE, NOW), "October 2026");
  assert.equal(whenLabel("2026-10-01T17:00:00Z", ZONE, NOW), "Oct 1");
});

Deno.test("heat grid is 12 weeks ending today, with levels", () => {
  const grid = heatGrid({ "2026-10-27": 4 }, "2026-10-27");
  assert.equal(grid.length, 12);
  assert.equal(grid[11][0]?.day, "2026-10-26"); // weeks start on Monday
  assert.equal(grid[11][1]?.count, 4);
  assert.equal(grid[11][2], null);
  assert.deepEqual([heatLevel(0, 4), heatLevel(1, 4), heatLevel(4, 4)], [0, 1, 4]);
});

Deno.test("summaries wait for a quiet chat and are cleaned", () => {
  const old = new Date(NOW - 3_600_000).toISOString();
  assert.equal(needsSummary({ summary: "", messages: 4, updatedAt: old }, 0, NOW), true);
  assert.equal(needsSummary({ summary: "x", messages: 5, updatedAt: old }, 4, NOW), true);
  assert.equal(needsSummary({ summary: "x", messages: 4, updatedAt: old }, 4, NOW), false);
  assert.equal(needsSummary({ summary: "", messages: 4, updatedAt: new Date(NOW - 60_000).toISOString() }, 0, NOW), false);
  assert.equal(cleanSummary('"Fixed the sync."\nextra'), "Fixed the sync");
});
