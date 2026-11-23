import assert from "node:assert/strict";
import { askAction, kebabOptions, rowKey, swipeRow } from "./row-actions.ts";
import { html } from "@ravel/html.ts";

const row = (extra = {}) => swipeRow({
  key: "r-1",
  content: html`<span class="ask-title">Milk</span>`,
  actions: [
    { label: "Pin", side: "leading", run: "pin()" },
    { label: "Open", href: "/x", swipe: false },
    { label: "Delete", run: "del()", danger: true },
  ],
  ask: { kind: "todo", id: "abc1" },
  ...extra,
}).value;

Deno.test("swipe buttons, long-press items and the ⋮ come from one list", () => {
  const out = row();
  assert.match(out, /data-side="leading"[\s\S]*Pin/);
  assert.match(out, /data-side="trailing"[\s\S]*Ask AI[\s\S]*Delete/);
  assert.doesNotMatch(out.split('class="row-kebab"')[0].split("ravel-row-menu")[0], /href="\/x"/); // Open stays out of the swipes
  assert.match(out, /class="row-kebab"/);
  assert.match(out, /ravelAsk\(el, &#39;todo&#39;, &#39;abc1&#39;\)/);
});

Deno.test("the ⋮ lists destructive actions last", () => {
  const options = kebabOptions([{ label: "Delete", run: "d()", danger: true }, { label: "Pin", run: "p()" }, askAction("todo", "a1")]);
  assert.deepEqual(options.map((option) => ("label" in option ? option.label : "")), ["Pin", "Ask AI", "Delete"]);
});

Deno.test("keys and Ask AI references are checked", () => {
  assert.throws(() => row({ key: "Bad Key" }));
  assert.throws(() => askAction("todo", "a'); alert(1); ('"));
  assert.notEqual(rowKey("w"), rowKey("w"));
});
