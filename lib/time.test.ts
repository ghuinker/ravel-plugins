import assert from "node:assert/strict";
import { addDays, dateIn, dayStart, hourIn, isZone, wallToInstant, zoneOffset } from "./time.ts";

const HOUR = 3_600_000;

Deno.test("a date depends on the zone it is read in", () => {
  const at = Date.parse("2026-11-02T05:00:00Z");
  assert.equal(dateIn(at, "America/Denver"), "2026-11-01"); // 10pm the night before
  assert.equal(dateIn(at, "Europe/Zurich"), "2026-11-02"); // 6am
  assert.equal(hourIn("America/Denver", at), 22);
  assert.equal(hourIn("Europe/Zurich", at), 6);
});

Deno.test("days start at local midnight across daylight saving", () => {
  assert.equal(dayStart("2026-11-01", "America/Denver"), Date.parse("2026-11-01T06:00:00Z")); // still MDT
  assert.equal(dayStart("2026-11-02", "America/Denver"), Date.parse("2026-11-02T07:00:00Z")); // MST after the change
  assert.equal(dayStart("2026-11-02", "Europe/Zurich"), Date.parse("2026-11-01T23:00:00Z"));
  assert.equal(zoneOffset(Date.parse("2026-07-01T00:00:00Z"), "America/Denver"), -6 * HOUR);
  assert.equal(wallToInstant(Date.UTC(2026, 0, 1), "UTC"), Date.UTC(2026, 0, 1));
});

Deno.test("addDays steps calendar days", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

Deno.test("only real zone names count", () => {
  assert.equal(isZone("Europe/Zurich"), true);
  assert.equal(isZone("Mars/Base"), false);
  assert.equal(isZone(""), false);
  assert.equal(isZone(null), false);
});
