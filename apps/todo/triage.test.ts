import assert from "node:assert/strict";
import { addTodo, listTodos, listUnsorted, saveTodo } from "./db.ts";
import { parseKept, parseKinds, parseLanes, sortUnsorted, splitPasted } from "./triage.ts";

const WED = "2026-10-21";

const add = (id: string, body: string, lane = "unsorted") => addTodo(body, id, Date.now(), { lane: lane as "unsorted" });
const lanes = () => Object.fromEntries(listTodos().map((todo) => [todo.id, `${todo.lane}${todo.auto ? "*" : ""}`]));

Deno.test("replies are read loosely, and bad entries are ignored", () => {
  const reply = 'Sure!\n[{"n":1,"lane":"soon"},{"n":2,"lane":"maybe"},{"n":9,"lane":"soon"},{"n":3,"lane":"someday"}]';
  assert.deepEqual([...parseLanes(reply, 3)], [[1, "soon"], [3, "someday"]]);
  assert.equal(parseLanes("no json", 3).size, 0);
  assert.deepEqual([...parseKept("[1, 3, 7]", 3) ?? []], [1, 3]);
  assert.equal(parseKept("sorry", 3), null);
});

Deno.test("a few tasks are placed by one Haiku call", async () => {
  add("kt1", "Cut nails");
  add("kt2", "Build a shed in the backyard");
  const asked: string[] = [];
  const placed = await sortUnsorted((prompt, model) => {
    asked.push(model);
    assert.match(prompt, /1\. Cut nails\n2\. Build a shed/);
    return Promise.resolve('[{"n":1,"lane":"soon"},{"n":2,"lane":"someday"}]');
  }, WED);
  assert.equal(placed, 2);
  assert.deepEqual(asked, ["haiku"]);
  assert.deepEqual([lanes().kt1, lanes().kt2], ["soon*", "someday*"]);
});

Deno.test("an owner's choice is kept, dated tasks are skipped, and unreadable replies leave tasks unsorted", async () => {
  add("kt3", "Mow lawn");
  addTodo("Dentist", "kt4", Date.now(), { lane: "unsorted", due: WED });
  assert.deepEqual(listUnsorted().map((todo) => todo.id), ["kt3"]);
  const placed = await sortUnsorted(() => Promise.resolve("I can't do that"), WED);
  assert.equal(placed, 0);
  assert.equal(lanes().kt3, "unsorted");
  await sortUnsorted(() => {
    saveTodo("kt3", { body: "Mow lawn", done: false, due: "", soft: false, repeat: "", priority: 1, notes: "", lane: "someday", auto: false }, Date.now() + 5);
    return Promise.resolve('[{"n":1,"lane":"soon"}]');
  }, WED);
  assert.equal(lanes().kt3, "someday");
});

Deno.test("a big batch for Today gets a second opinion from Sonnet", async () => {
  for (let index = 1; index <= 6; index++) add(`kb${index}`, `chore ${index}`);
  const asked: string[] = [];
  await sortUnsorted((prompt, model) => {
    asked.push(model);
    if (model === "haiku") return Promise.resolve(JSON.stringify([1, 2, 3, 4, 5, 6].map((n) => ({ n, lane: "soon" }))));
    assert.match(prompt, /Already in Today/);
    return Promise.resolve("[1,2]");
  }, WED);
  assert.deepEqual(asked, ["haiku", "sonnet"]);
  assert.deepEqual(["kb1", "kb2", "kb3", "kb6"].map((id) => lanes()[id]), ["soon*", "soon*", "someday*", "someday*"]);
});

Deno.test("a pasted block is kept as one task or split into a task per line, as Haiku says", async () => {
  addTodo("Chat is broken", "sp1", Date.now(), { lane: "unsorted", notes: "Error: boom\nat line 3" });
  addTodo("Groceries", "sp2", Date.now(), { lane: "unsorted", notes: "milk\neggs" });
  assert.deepEqual(listUnsorted().map((todo) => todo.id).filter((id) => id.startsWith("sp")), []);
  const asked: string[] = [];
  const split = await splitPasted((prompt, model) => {
    asked.push(model);
    return Promise.resolve('[{"n":1,"kind":"one"},{"n":2,"kind":"many"}]');
  }, WED);
  assert.deepEqual(asked, ["haiku"]);
  assert.equal(split, 3);
  const todos = listTodos().filter((todo) => todo.id === "sp1" || todo.body === "Groceries" || todo.body === "milk" || todo.body === "eggs");
  assert.deepEqual(todos.map((todo) => todo.body).sort(), ["Chat is broken", "Groceries", "eggs", "milk"]);
  assert.equal(todos.find((todo) => todo.id === "sp1")?.notes, "Error: boom\nat line 3");
  assert.equal(await splitPasted(() => Promise.reject(new Error("not asked again"))), 0);
  assert.equal(parseKinds("nope", 2).size, 0);
});

Deno.test("an unreadable one-or-many answer keeps the task waiting", async () => {
  addTodo("Pasted", "sp3", Date.now(), { lane: "unsorted", notes: "more\nlines" });
  assert.equal(await splitPasted(() => Promise.resolve("hmm")), 0);
  assert.equal(listUnsorted().some((todo) => todo.id === "sp3"), false);
  assert.equal(await splitPasted(() => Promise.resolve('[{"n":1,"kind":"one"}]')), 0);
  assert.equal(listUnsorted().some((todo) => todo.id === "sp3"), true);
});
