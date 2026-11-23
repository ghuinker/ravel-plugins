import assert from "node:assert/strict";
import { countTag, itemHasTag, itemNoTags, itemTagNames, matchesTag, pickTag, toggledTags } from "./tag-pick.ts";

Deno.test("picking tags toggles them, stops at the limit, and clearing empties the item", () => {
  const item: { tags: { id: number; label: string }[] } = { tags: [] };
  assert.equal(pickTag(item, 1, "🏠 House", 2), "on");
  assert.equal(pickTag(item, 2, "🛠️ Garage", 2), "on");
  assert.equal(pickTag(item, 3, "🚀 Ravel", 2), "full");
  assert.deepEqual(item.tags.map((tag) => tag.id), [1, 2]);
  assert.equal(itemTagNames(item), "🏠 House, 🛠️ Garage");
  assert.equal(pickTag(item, 1, "🏠 House", 2), "off");
  assert.equal(itemHasTag(item, 1), false);
  assert.equal(pickTag(item, 0, "", 2), "off");
  assert.equal(itemNoTags(item), true);
  assert.equal(itemTagNames(item), "None");
  assert.equal(pickTag(undefined, 1, "x", 2), "full");
  assert.deepEqual(toggledTags([], { id: 4, label: "x" }, 3), [{ id: 4, label: "x" }]);
});

Deno.test("an item with several tags matches each of them; 0 matches the untagged", () => {
  const both = { tags: [{ id: 3, label: "a" }, { id: 5, label: "b" }] };
  const none = {};
  assert.deepEqual([matchesTag(both), matchesTag(both, 3), matchesTag(both, "5"), matchesTag(both, 4), matchesTag(both, 0)], [true, true, true, false, false]);
  assert.deepEqual([matchesTag(none, 0), matchesTag(none, 3)], [true, false]);
  assert.equal(countTag([both, none, both], 3), 2);
});

Deno.test("a picked list is made of plain objects, so it can be cloned for other tabs", () => {
  const proxy = new Proxy({ id: 1, label: "a" }, {});
  const next = toggledTags([proxy], { id: 2, label: "b" }, 3);
  assert.doesNotThrow(() => structuredClone(next));
  assert.deepEqual(next, [{ id: 1, label: "a" }, { id: 2, label: "b" }]);
  assert.notEqual(next[0], proxy);
});
