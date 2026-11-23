import assert from "node:assert/strict";
import { groupBy, inRange, perDay, totals, type UsageEntry } from "./usage-log.ts";

const entry = (over: Partial<UsageEntry>): UsageEntry => ({
  at: "2026-10-28T18:00:00Z", kind: "chat", label: "chat", model: "sonnet", input: 10, output: 5, cacheRead: 100, cacheWrite: 1, costUsd: 0.5, ...over,
});

Deno.test("totals sums cost, runs and all token kinds", () => {
  assert.deepEqual(totals([entry({}), entry({ costUsd: 0.25 })]), { runs: 2, costUsd: 0.75, tokens: 232 });
});

Deno.test("groupBy orders by cost", () => {
  const groups = groupBy([entry({ kind: "ask", costUsd: 0.1 }), entry({ kind: "chat", costUsd: 2 }), entry({ kind: "ask", costUsd: 0.1 })], (item) => item.kind);
  assert.deepEqual(groups.map((group) => [group.name, group.runs]), [["chat", 1], ["ask", 2]]);
});

Deno.test("perDay fills quiet days and drops entries outside the window", () => {
  const now = new Date("2026-10-28T20:00:00Z");
  const days = perDay([entry({}), entry({ at: "2026-01-01T00:00:00Z" })], 3, now);
  assert.equal(days.length, 3);
  assert.equal(days.at(-1)?.runs, 1);
  assert.equal(days[0].runs, 0);
});

Deno.test("inRange keeps recent entries", () => {
  const now = new Date("2026-10-28T20:00:00Z");
  assert.equal(inRange([entry({}), entry({ at: "2026-08-01T00:00:00Z" })], 7, now).length, 1);
});
