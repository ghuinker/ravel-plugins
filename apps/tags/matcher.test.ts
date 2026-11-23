import assert from "node:assert/strict";
import { buildPrompt, decide, hasEnoughText, parseMatches } from "./matcher.ts";

const item = { kind: "note", id: "kone", title: "Name ideas", text: "Try a few new names for the site", done: false, href: "/notes", at: 0 };

Deno.test("parseMatches keeps clear answers and drops unknown tags and bad numbers", () => {
  const reply = 'Sure! [{"n":1,"tags":[{"tag":3,"confidence":0.9},{"tag":99,"confidence":1},{"tag":4,"confidence":"high"}]},{"n":2,"tags":[]},{"n":3},{"n":9,"tags":[{"tag":3,"confidence":1}]},{"n":4,"tags":"none"}]';
  const matches = parseMatches(reply, 4, [3, 4]);
  assert.deepEqual([...matches.keys()], [1, 2]);
  assert.deepEqual(matches.get(1), [{ tagId: 3, confidence: 0.9 }]);
  assert.deepEqual(matches.get(2), []);
  assert.equal(parseMatches("no json here", 2, [3]).size, 0);
});

Deno.test("decide attaches when sure, suggests when unsure, rules out the rest", () => {
  assert.deepEqual(decide([{ tagId: 3, confidence: 0.9 }], 3), [{ tagId: 3, confidence: 0.9, state: "attached" }]);
  assert.deepEqual(decide([{ tagId: 3, confidence: 0.6 }], 3), [{ tagId: 3, confidence: 0.6, state: "suggested" }]);
  assert.deepEqual(decide([{ tagId: 3, confidence: 0.2 }], 3), []);
  assert.deepEqual(decide([], 3), []);
});

Deno.test("extra tags need to be very confident, never ride on a middling first tag, and respect the limit", () => {
  const strong = [{ tagId: 1, confidence: 0.95 }, { tagId: 2, confidence: 0.9 }, { tagId: 3, confidence: 0.86 }, { tagId: 4, confidence: 0.85 }];
  assert.deepEqual(decide(strong, 3).map((tag) => tag.tagId), [1, 2, 3]);
  assert.deepEqual(decide(strong, 1).map((tag) => tag.tagId), [1]);
  assert.deepEqual(decide([{ tagId: 1, confidence: 0.9 }, { tagId: 2, confidence: 0.8 }], 3).map((tag) => tag.tagId), [1]);
  assert.deepEqual(decide([{ tagId: 1, confidence: 0.6 }, { tagId: 2, confidence: 0.99 }], 3).map((tag) => [tag.tagId, tag.state]), [[2, "attached"]]);
  assert.deepEqual(decide([{ tagId: 1, confidence: 0.6 }, { tagId: 2, confidence: 0.55 }], 3).map((tag) => [tag.tagId, tag.state]), [[1, "suggested"]]);
});

Deno.test("items with too little text wait, and the prompt lists tags and items", () => {
  assert.equal(hasEnoughText({ title: "Hi", text: "" }), false);
  assert.equal(hasEnoughText(item), true);
  const prompt = buildPrompt([item], [{ id: 3, name: "Ravel", samples: ["Setup"] }]);
  assert.match(prompt, /id 3: Ravel\. Already holds: Setup/);
  assert.match(prompt, /1\. \[note\] Name ideas: Try a few new names/);
});
