import assert from "node:assert/strict";
import { addTag, attach, checkedKeys, deleteTag, detach, detachAll, dismiss, linksOf, mergeTags, proposals, addProposal, recordJudgment, unhomedKeys } from "./db.ts";
import { sweep } from "./matcher.ts";
import { acceptProposal, declineProposal, parseIdeas, repeatsOne, suggest } from "./proposals.ts";
import { tagItem, tagsOf, toggleTag, untagItem } from "./tags.ts";
import { addKind, forgetItems, type Item } from "./items.ts";

const things: Item[] = [];
addKind("thing", { label: "Thing", plural: "Things", icon: "🔹", list: () => things });
const addThing = (title: string, id: string, at = Date.now()) => void things.push({ kind: "thing", id, title, text: "", done: false, href: "/", at });

const hue = 200;
const ids = (kind: string, id: string) => linksOf(kind, id, "attached").map((link) => link.tag_id);

Deno.test("an item can carry several tags, up to the limit, and taking one off keeps it looked at", () => {
  const [one, two, three, four] = ["Ravel", "Garden", "House", "Trip"].map((name) => addTag({ name, emoji: "🚀", hue }));
  assert.equal(tagItem("thing", "ka", one), true);
  assert.equal(tagItem("thing", "ka", two), true);
  assert.equal(tagItem("thing", "ka", two), true); // already there
  assert.equal(tagItem("thing", "ka", three), true);
  assert.equal(tagItem("thing", "ka", four), false); // the default limit is 3
  assert.equal(tagItem("thing", "ka", 9999), false);
  assert.deepEqual(tagsOf("thing", "ka").map((tag) => tag.name).sort(), ["Garden", "House", "Ravel"]);
  untagItem("thing", "ka", two);
  assert.deepEqual(ids("thing", "ka").sort(), [one, three].sort());
  assert.ok(checkedKeys().has("thing:ka"));
  assert.equal(toggleTag("thing", "ka", four, true), true); // room again
  untagItem("thing", "ka", 0);
  assert.deepEqual(ids("thing", "ka"), []);
  assert.ok(unhomedKeys().has("thing:ka"), "looked at with no tag is a loose item");
});

Deno.test("yes confirms a suggestion, no dismisses it, deleting a tag removes it from items", () => {
  const trip = addTag({ name: "Journey", emoji: "✈️", hue });
  const other = addTag({ name: "Errands", emoji: "🛒", hue });
  recordJudgment("thing", "kb", [{ tagId: trip, state: "suggested", confidence: 0.6 }]);
  recordJudgment("thing", "kc", [{ tagId: trip, state: "suggested", confidence: 0.6 }]);
  assert.deepEqual(ids("thing", "kb"), []);
  attach("thing", "kb", trip);
  attach("thing", "kb", other);
  dismiss("thing", "kc");
  assert.deepEqual(linksOf("thing", "kb").map((link) => [link.state, link.source]), [["attached", "manual"], ["attached", "manual"]]);
  assert.deepEqual(linksOf("thing", "kc"), []);
  assert.ok(!unhomedKeys().has("thing:kc"), "a dismissed item is not proposed for a new tag");
  deleteTag(trip);
  assert.deepEqual(ids("thing", "kb"), [other]);
  assert.ok(checkedKeys().has("thing:kb"));
});

Deno.test("the AI judges an item once and never overrides what the owner did", () => {
  const tag = addTag({ name: "Solo", emoji: "1️⃣", hue });
  attach("thing", "kd", tag);
  detach("thing", "kd", tag);
  recordJudgment("thing", "kd", [{ tagId: tag, state: "attached", confidence: 0.99 }]);
  assert.deepEqual(ids("thing", "kd"), []);
  detachAll("thing", "kd");
});

Deno.test("merging tags keeps one link when an item had both, and the stronger state", () => {
  const from = addTag({ name: "Old", emoji: "📦", hue });
  const into = addTag({ name: "New", emoji: "📬", hue });
  recordJudgment("thing", "ke", [{ tagId: from, state: "attached", confidence: 0.9 }, { tagId: into, state: "suggested", confidence: 0.5 }]);
  recordJudgment("thing", "kf", [{ tagId: from, state: "attached", confidence: 0.9 }]);
  mergeTags(from, into);
  assert.deepEqual(linksOf("thing", "ke").map((link) => [link.tag_id, link.state]), [[into, "attached"]]);
  assert.deepEqual(ids("thing", "kf"), [into]);
});

Deno.test("a sweep tags each unlooked item once, with a second tag only when sure", async () => {
  const [garden, house] = ["Yard", "Home"].map((name) => addTag({ name, emoji: "🏡", hue }));
  addThing("Mow the lawn this weekend", "ksweepa");
  addThing("Fix the fence gate hinge", "ksweepb");
  addThing("Practice something different", "ksweepc");
  forgetItems();
  let asked = 0;
  // The prompt numbers the unchecked items; answer by number: 1 and 2 get two tags (one weak extra), 3 gets none.
  const answer = (prompt: string) => {
    asked++;
    const numbered = [...prompt.matchAll(/^(\d+)\. \[\w+\] (.*)$/gm)].map((found) => ({ n: Number(found[1]), text: found[2] }));
    return Promise.resolve(JSON.stringify(numbered.map(({ n, text }) => ({
      n,
      tags: text.startsWith("Mow") ? [{ tag: garden, confidence: 0.9 }, { tag: house, confidence: 0.9 }]
        : text.startsWith("Fix") ? [{ tag: house, confidence: 0.8 }, { tag: garden, confidence: 0.6 }] : [],
    }))));
  };
  await sweep(answer);
  assert.deepEqual(ids("thing", "ksweepa").sort(), [garden, house].sort());
  assert.deepEqual(ids("thing", "ksweepb"), [house]);
  assert.deepEqual(ids("thing", "ksweepc"), []);
  assert.ok(checkedKeys().has("thing:ksweepc"));
  const before = asked;
  await sweep(answer);
  assert.equal(asked, before, "everything was looked at, so nothing is asked again");
});

const items = ["a", "b", "c", "d"].map((id) => ({ kind: "thing", id: `k${id}`, title: `Item ${id}`, text: "something long enough", done: false, href: "/", at: 0 }));

Deno.test("parseIdeas needs three real items and a name", () => {
  const reply = '[{"name":"Garden","emoji":"🌱","description":"Backyard","items":[1,2,3]},{"name":"Tiny","items":[1,2]},{"name":"","items":[1,2,3]},{"name":"Far","items":[1,2,40]}]';
  const ideas = parseIdeas(reply, items);
  assert.deepEqual(ideas.map((idea) => idea.name), ["Garden"]);
  assert.deepEqual(ideas[0].items.map((item) => item.id), ["ka", "kb", "kc"]);
});

Deno.test("a declined idea is not proposed again, by name or by mostly the same items", () => {
  const declined = [{ name: "Garden Plans", items: [{ kind: "thing", id: "ka" }, { kind: "thing", id: "kb" }, { kind: "thing", id: "kc" }] }];
  const same = { name: "garden plans!", emoji: "🌱", description: "", items: [{ kind: "thing", id: "kd" }, { kind: "thing", id: "ke" }, { kind: "thing", id: "kf" }] };
  const overlap = { name: "Yard", emoji: "🌱", description: "", items: [{ kind: "thing", id: "ka" }, { kind: "thing", id: "kb" }, { kind: "thing", id: "kz" }] };
  const fresh = { name: "Taxes", emoji: "💸", description: "", items: [{ kind: "thing", id: "kx" }, { kind: "thing", id: "ky" }, { kind: "thing", id: "kz" }] };
  assert.equal(repeatsOne(same, declined), true);
  assert.equal(repeatsOne(overlap, declined), true);
  assert.equal(repeatsOne(fresh, declined), false);
});

Deno.test("accepting an idea makes the tag and files existing items; declining is remembered", () => {
  addThing("Clean up the garage today", "kgarage");
  forgetItems();
  addProposal({ name: "Garage", emoji: "🧰", description: "", items: [{ kind: "thing", id: "kgarage" }, { kind: "thing", id: "kgone" }] });
  addProposal({ name: "Nope", emoji: "🙅", description: "", items: [] });
  const [garage, nope] = proposals("pending");
  const tagId = acceptProposal(garage.id)!;
  declineProposal(nope.id);
  assert.deepEqual(ids("thing", "kgarage"), [tagId]);
  assert.deepEqual(linksOf("thing", "kgone"), []);
  assert.equal(acceptProposal(garage.id), null);
  assert.deepEqual(proposals("declined").map((idea) => idea.name), ["Nope"]);
});

Deno.test("two suggest runs at once add an idea once", async () => {
  for (const idea of proposals("pending")) declineProposal(idea.id);
  for (const id of ["kna", "knb", "knc"]) addThing(`Pick a name for the site ${id}`, id);
  forgetItems();
  let calls = 0;
  const ask = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const count = 3;
    return JSON.stringify([{ name: "Site Naming", emoji: "🏷️", description: "", items: Array.from({ length: count }, (_, i) => i + 1) }]);
  };
  const added = await Promise.all([suggest(ask), suggest(ask), suggest(ask)]);
  assert.equal(calls, 1);
  assert.deepEqual(added, [added[0], added[0], added[0]]);
  assert.equal(proposals("pending").filter((idea) => idea.name === "Site Naming").length <= 1, true);
});
