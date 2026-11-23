import assert from "node:assert/strict";
import { homeCards } from "./cards.ts";
import { greeting } from "./hello.ts";
import { dots, homeCard } from "./api.ts";

Deno.test("the greeting follows the hour", () => {
  assert.equal(greeting(8), "Good morning");
  assert.equal(greeting(14), "Good afternoon");
  assert.equal(greeting(20), "Good evening");
});

Deno.test("the cards that apps plug in come in page order, one per id", async () => {
  const cards = await homeCards();
  assert.ok(cards.length > 0);
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
  assert.deepEqual(cards.map((card) => card.order), cards.map((card) => card.order).sort((a, b) => a - b));
  for (const card of cards) assert.ok([4, 6, 8, 12].includes(card.size), `${card.id} has size ${card.size}`);
});

Deno.test("a card has a title that links, a count and its body", () => {
  const html = homeCard(2, "Tasks", "body", { href: "/todo", count: "3 open" }).value;
  assert.match(html, /<a href="\/todo"[^>]*>Tasks<\/a>/);
  assert.match(html, /3 open/);
  assert.match(html, /--i:2/);
});

Deno.test("dots fills the first share of them", () => {
  assert.equal((dots(0.5, 4).value.match(/class="on"/g) ?? []).length, 2);
});
