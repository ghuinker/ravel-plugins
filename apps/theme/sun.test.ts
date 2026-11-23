import assert from "node:assert/strict";
import { isNight, sunTimes } from "./sun.ts";
import { placeOf } from "./zone-place.ts";

const minutes = (ms: number) => Math.round(ms / 60_000);

Deno.test("Denver sunrise and sunset in early November", () => {
  const at = Date.parse("2026-11-02T18:00:00Z"); // noon in Denver
  const { rise, set } = sunTimes(at, placeOf("America/Denver"));
  // about 6:30 and 4:45 MST, give or take a few minutes
  assert.ok(Math.abs(minutes(rise - Date.parse("2026-11-02T13:40:00Z"))) < 15, new Date(rise).toISOString());
  assert.ok(Math.abs(minutes(set - Date.parse("2026-11-02T23:55:00Z"))) < 15, new Date(set).toISOString());
});

Deno.test("it is night in Zurich when it is midday in Denver's night", () => {
  const at = Date.parse("2026-11-02T22:00:00Z"); // 3pm Denver, 11pm Zurich
  assert.equal(isNight(at, "America/Denver"), false);
  assert.equal(isNight(at, "Europe/Zurich"), true);
});

Deno.test("an unlisted zone falls back to its offset's meridian", () => {
  const place = placeOf("Asia/Kathmandu");
  assert.ok(Math.abs(place.lon - 86) < 3, String(place.lon));
});
