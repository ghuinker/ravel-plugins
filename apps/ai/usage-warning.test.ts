import { assertEquals } from "jsr:@std/assert";
import { highLimits } from "./usage-warning.ts";

Deno.test("no warning below 90%", () => {
  assertEquals(highLimits({ session: { percent: 89.9 }, week: { percent: 10 }, opus: null, sonnet: null }), []);
});

Deno.test("warns for each limit at or above 90%", () => {
  const resetsAt = "2026-10-22T18:00:00Z";
  assertEquals(
    highLimits({ session: { percent: 95.2, resetsAt }, week: { percent: 90, resetsAt }, opus: null, sonnet: { percent: 12, resetsAt } }),
    [{ label: "5-hour session", percent: 95, resetsAt }, { label: "weekly", percent: 90, resetsAt }],
  );
});

Deno.test("marks full limits as using credits when credits are on", () => {
  const resetsAt = "2026-10-22T18:00:00Z";
  const limits = { session: { percent: 100, resetsAt }, week: { percent: 92, resetsAt }, opus: null, sonnet: null };
  assertEquals(highLimits({ ...limits, usingCredits: true }), [
    { label: "5-hour session", percent: 100, resetsAt, credits: true },
    { label: "weekly", percent: 92, resetsAt },
  ]);
  assertEquals(highLimits({ ...limits, usingCredits: false })[0].credits, undefined);
});
