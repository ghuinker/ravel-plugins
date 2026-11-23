import assert from "node:assert/strict";
import { hasTag, isBlank, hasUnsorted, hint, listHTML, matches, noTags, parseLines, splitLines, sectionOf, subtasks, tagValue, toggle, setNotes, toggleTag, type TodoItem, type Todos } from "./list.ts";

/** Tasks with only the fields a test needs. */
const asTodos = (items: Record<string, Partial<TodoItem>>) => items as Todos;

const WED = "2026-10-21";
const AT = 1_000_000;

const item = (fields: Record<string, unknown> = {}) => ({
  body: "task", done: false, due: "", soft: false, repeat: "", priority: 1, notes: "", lane: "someday", auto: false, created: 1, updated: 1, ...fields,
});

Deno.test("a list splits into low-priority tasks, with indented lines as subtasks", () => {
  const entries = splitLines("TODO\n- buy groceries\n- [ ] update thing\n  - milk\n  - eggs\nBuild X Wed\n!", WED, AT);
  assert.deepEqual(entries.map((entry) => entry.body), ["buy groceries", "update thing", "Build X"]);
  assert.deepEqual(entries.map((entry) => entry.priority), [0, 0, 1]);
  assert.equal(entries[1].notes, "- [ ] milk\n- [ ] eggs");
  assert.equal(entries[2].due, WED);
  assert.ok(entries[0].created > entries[1].created);
});

Deno.test("several pasted lines are one unsorted task: first line the title, the rest its notes", () => {
  const [task, ...more] = parseLines("Chat keeps failing\nError: boom at line 3\n  - stack frame\nbuy milk", WED, AT);
  assert.equal(more.length, 0);
  assert.equal(task.body, "Chat keeps failing");
  assert.equal(task.notes, "Error: boom at line 3\n  - stack frame\nbuy milk");
  assert.equal(task.lane, "unsorted");
  assert.equal(task.priority, 1);
});

Deno.test("one typed task is normal priority, and ! makes it high", () => {
  assert.equal(parseLines("buy milk", WED)[0].priority, 1);
  assert.equal(parseLines("call mom !", WED)[0].priority, 2);
  assert.equal(parseLines("a\nb on Fri", WED).length, 1);
  assert.equal(hint("Plan date before Monday", WED), "by Mon");
  assert.equal(hint("a\nb", WED), "rest goes in notes");
});

Deno.test("tasks sort into high priority, unsorted, today, upcoming, someday or done", () => {
  const sections = [item({ due: WED }), item({ due: "2026-10-30" }), item(), item({ priority: 2 }), item({ done: true }), item({ due: "2026-10-01" }), item({ lane: "unsorted" }), item({ lane: "soon" })]
    .map((task) => sectionOf(task, WED));
  assert.deepEqual(sections, ["today", "week", "someday", "priority", "done", "today", "unsorted", "today"]);
  assert.equal(hasUnsorted({ a: item({ lane: "unsorted" }) }, WED), true);
  assert.equal(hasUnsorted({ a: item() }, WED), false);
});

Deno.test("checking a repeating task moves it on and clears its subtasks; other tasks finish", () => {
  const todos = { a: item({ due: WED, repeat: "week:1", notes: "- [x] one\n- [ ] two" }), b: item() };
  toggle(todos, "a", WED);
  assert.equal(todos.a.due, "2026-10-28");
  assert.equal(todos.a.done, false);
  assert.deepEqual(subtasks(todos.a.notes), { done: 0, total: 2 });
  toggle(todos, "b", WED);
  assert.equal(todos.b.done, true);
});

Deno.test("the page lists every section in order, escapes text", () => {
  const todos = {
    a: item({ body: "<img src=x onerror=alert(1)>", due: "2026-10-22" }),
    b: item({ body: "old", due: "2026-10-01" }),
    c: item({ body: "groceries" }),
  };
  const out = listHTML(todos, WED);
  assert.ok(!out.includes("<img"));
  assert.ok(!out.includes("Overdue"));
  assert.ok(!out.includes("Thursday, Oct 22"));
  const order = ["Today", "Upcoming", "Someday"].map((title) => out.indexOf(`<span>${title}</span><span`));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(!out.includes("<span>Done</span>"));
  assert.match(listHTML({}, WED), /Nothing due today/);
});

Deno.test("filters match by tag (all, none or any one of its tags) and by text in the title or notes", () => {
  const gutters = { body: "Clean gutters", notes: "ladder in garage", tags: [{ id: 3, label: "🏠 House" }, { id: 5, label: "🛠️ Garage" }] };
  const loose = { body: "Buy milk", notes: "" };
  assert.equal(matches(gutters, {}), true);
  assert.equal(matches(loose, { tag: 0 }), true);
  assert.equal(matches(gutters, { tag: 0 }), false);
  assert.equal(matches(gutters, { tag: 3 }), true);
  assert.equal(matches(gutters, { tag: 5 }), true); // a task with several tags shows under each
  assert.equal(matches(gutters, { tag: 4 }), false);
  assert.equal(matches(loose, { tag: 3 }), false);
  assert.equal(matches(gutters, { query: " LADDER " }), true);
  assert.equal(matches(loose, { query: "ladder" }), false);
});

Deno.test("checking the last subtask finishes the task; unchecking one does not", () => {
  const todos = { a: item({ notes: "- [x] one\n- [ ] two" }), b: item({ notes: "- [ ] one\n- [ ] two" }) };
  setNotes(todos, "b", "- [x] one\n- [ ] two", { done: true });
  assert.equal(todos.b.done, false);
  setNotes(todos, "a", "- [x] one\n- [x] two", { done: true });
  assert.equal(todos.a.done, true);
  setNotes(todos, "a", "- [x] one\n- [ ] two", { done: false });
  assert.equal(todos.a.done, true);
});

Deno.test("the task sheet shows and changes a task's tags in place", () => {
  const todos = asTodos({ a: { body: "Clean gutters", tags: [] } });
  assert.equal(toggleTag(todos, "a", 1, "🏠 House", 2), "on");
  assert.equal(toggleTag(todos, "ghost", 1, "🏠 House", 2), "full");
  assert.equal(hasTag(todos, "a", 1), true);
  assert.equal(noTags(todos, "a"), false);
  assert.equal(tagValue(todos, "a"), "🏠 House");
  assert.equal(toggleTag(todos, "a", 0, "", 2), "off");
  assert.equal(tagValue(todos, "a"), "None");
});

Deno.test("isBlank is true only for an untouched New task", () => {
  const blank = { body: "New task", done: false, priority: 1, notes: "", due: "", soft: false, repeat: "", tags: [] };
  const todos = asTodos({ a: { ...blank }, b: { ...blank, notes: "x" }, c: { ...blank, body: "Milk" } });
  assert.deepEqual([isBlank(todos, "a"), isBlank(todos, "b"), isBlank(todos, "c")], [true, false, false]);
});
