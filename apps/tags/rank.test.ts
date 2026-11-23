import assert from "node:assert/strict";
import { addTag, attach, isDormant, listTags, setPinned } from "./db.ts";
import { addKind, forgetItems, type Item } from "./items.ts";
import { rankTags } from "./rank.ts";

const things: Item[] = [];
addKind("thing", { label: "Thing", plural: "Things", icon: "🔹", list: () => things });
const addThing = (title: string, id: string, at = Date.now()) => void things.push({ kind: "thing", id, title, text: "", done: false, href: "/", at });

const DAY = 86_400_000;

Deno.test("tags that moved lately rank above ones that went quiet, and a pin wins", () => {
  const now = Date.now();
  const [old, hot, pinned] = ["Old", "Hot", "Pinned"].map((name) => addTag({ name, emoji: "🚀", hue: 200 }));
  addThing("open but ancient", "rka", now - 120 * DAY);
  addThing("open and new", "rkb", now - DAY);
  forgetItems();
  attach("thing", "rka", old);
  attach("thing", "rkb", hot);
  const heats = rankTags(now);
  assert.ok(heats.get(hot)! > heats.get(old)!);
  const tags = listTags();
  assert.ok(tags.findIndex((tag) => tag.id === hot) < tags.findIndex((tag) => tag.id === old));
  assert.equal(isDormant(tags.find((tag) => tag.id === old)!), true);
  setPinned(pinned, true);
  assert.equal(listTags()[0].id, pinned);
  assert.equal(isDormant(listTags()[0]), false);
});
