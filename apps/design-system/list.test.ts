import assert from "node:assert/strict";
import { html } from "@ravel/html.ts";
import { linkRow, list, section } from "./list.ts";
import { segmented } from "./segmented.ts";

Deno.test("a list is one group; lines only when asked", () => {
  const plain = list(["<div>a</div>", html`<div>b</div>`]).value;
  assert.equal(plain.match(/t-group/g)?.length, 1);
  assert.doesNotMatch(plain, /t-group-lined/);
  assert.match(list(["<div>a</div>"], { lined: true, inset: "3rem" }).value, /t-group-lined[^>]*--t-inset: 3rem/);
});

Deno.test("sections inside one list get a full-width line between them only when lined", () => {
  const out = list([["<i>a</i>"], ["<i>b</i>"]], { lined: true }).value;
  assert.equal(out.match(/class="t-group/g)?.length, 1);
  assert.equal(out.match(/t-list-break/g)?.length, 1);
  assert.doesNotMatch(list([["<i>a</i>"], ["<i>b</i>"]]).value, /t-list-break/);
});

Deno.test("section titles are escaped and carry the count", () => {
  const out = section("<b>Today</b>", list([]), { count: 3 }).value;
  assert.match(out, /&lt;b&gt;Today/);
  assert.match(out, />3</);
});

Deno.test("linkRow and segmented", () => {
  assert.match(linkRow({ href: "/x", label: "X", chevron: "phone" }).value, /md:hidden">›/);
  assert.doesNotMatch(linkRow({ href: "/x", label: "X" }).value, /›/);
  assert.match(linkRow({ href: "/x", label: "X", chevron: true }).value, /›/);
  const auto = segmented([{ href: "/a", label: "A" }]).value;
  assert.match(auto, /data-seg-auto/);
  const fixed = segmented([{ href: "/a", label: "A" }, { href: "/b", label: "B" }], "/b").value;
  assert.doesNotMatch(fixed, /data-seg-auto/);
  assert.match(fixed, /t-seg-on">B/);
});
