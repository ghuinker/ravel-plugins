import assert from "node:assert/strict";
import { heatmap } from "./heatmap.ts";

const week = (shade: number) => Array.from({ length: 7 }, () => ({ shade }));

Deno.test("a square per counted day, none for the future, a card only where there is something to say", () => {
  const cells = [...week(0), ...week(1).slice(0, 5), null, null];
  cells[3] = { shade: 0.5, title: "Thu", pop: "note" } as (typeof cells)[number];
  const out = heatmap({ cells, label: "Days" }).value;
  assert.equal(out.match(/<rect /g)?.length, 12);
  assert.equal(out.match(/class="hm-hit"/g)?.length, 1);
  assert.match(out, /aspect-ratio:27 \/ 102/);
});

Deno.test("weeks as rows turns the grid on its side", () => {
  const out = heatmap({ cells: [...week(0), ...week(0)], weeks: "rows", label: "Days" }).value;
  assert.match(out, /viewBox="0 0 102 27"/);
});
