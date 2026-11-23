import assert from "node:assert/strict";
import todo, { add, remove, save } from "./index.ts";
import { addTodo, completeTask, existingTaskIds, listTodos } from "./db.ts";
import { fakeCtx } from "@ravel/test.ts";

const fields = { body: "buy milk", done: false, due: "", soft: false, repeat: "", priority: 1, notes: "", lane: "someday", auto: false };

Deno.test("add trims text, skips blanks, and ignores a replayed add", () => {
  add(fakeCtx({ signals: { id: "kmilk", body: "  buy milk " } }));
  add(fakeCtx({ signals: { id: "kmilk", body: "buy milk" } }));
  add(fakeCtx({ signals: { id: "kblank", body: "   " } }));
  assert.deepEqual(listTodos().map((item) => item.body), ["buy milk"]);
});

Deno.test("add keeps the date, repeat and priority, and drops bad values", () => {
  add(fakeCtx({ signals: { id: "kgym", body: "gym", due: "2026-10-21", repeat: "weekdays:1,4", priority: 2, notes: "- [ ] shoes", lane: "unsorted" } }));
  add(fakeCtx({ signals: { id: "kbad", body: "bad", due: "soon", repeat: "x", priority: 9 } }));
  const gym = listTodos().find((item) => item.id === "kgym");
  assert.deepEqual([gym?.due, gym?.repeat, gym?.priority, gym?.notes], ["2026-10-21", "weekdays:1,4", 2, "- [ ] shoes"]);
  assert.equal(gym?.lane, "unsorted");
  const bad = listTodos().find((item) => item.id === "kbad");
  assert.deepEqual([bad?.due, bad?.repeat, bad?.priority], ["", "", 1]);
});

Deno.test("save marks done, open high-priority items sort first, and an older change loses", () => {
  const now = Date.now();
  save(fakeCtx({ signals: { ...fields, id: "kmilk", done: true }, at: now + 2000 }));
  assert.equal(listTodos().at(-1)?.id, "kmilk");
  assert.equal(listTodos()[0].id, "kgym");
  save(fakeCtx({ signals: { ...fields, id: "kmilk", done: false }, at: now + 1000 }));
  assert.equal(listTodos().find((item) => item.id === "kmilk")?.done, 1);
});

Deno.test("remove deletes the item and the page lists the rest", async () => {
  remove(fakeCtx({ signals: { id: "kbad" } }));
  assert.ok(!listTodos().some((item) => item.id === "kbad"));
  assert.match((await todo(fakeCtx())).value, /kmilk/);
});

Deno.test("the database refuses an id the page can't use", () => {
  assert.throws(() => addTodo("bad", "08145d5f7ee74b0a"), /newId/);
  assert.throws(() => addTodo("bad", "has-dash"), /newId/);
  addTodo("fine", "k0abc");
  assert.ok(listTodos().some((item) => item.id === "k0abc"));
});

Deno.test("completeTask finishes a task, and moves a repeating one to its next date", () => {
  addTodo("One-off", "once1", 1000, { due: "2026-10-21" });
  addTodo("Weekly", "weekly1", 1000, { due: "2026-10-21", repeat: "weekdays:3", notes: "- [x] a" });
  assert.equal(completeTask("once1", "2026-10-21"), "done");
  assert.equal(completeTask("once1", "2026-10-21"), null);
  assert.equal(completeTask("weekly1", "2026-10-21"), "moved");
  const weekly = listTodos().find((todo) => todo.id === "weekly1");
  assert.equal(weekly?.done, 0);
  assert.equal(weekly?.due, "2026-10-28");
  assert.equal(weekly?.notes, "- [ ] a");
  assert.equal(completeTask("ghost", "2026-10-21"), null);
  assert.deepEqual([...existingTaskIds(["once1", "ghost"])], ["once1"]);
});
