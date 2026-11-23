import { html } from "@ravel/html.ts";
import { state } from "@ravel/offline.ts";
import type { Ctx } from "@ravel/types.ts";
import { clientScript, clientVersion, styles } from "@ravel/client.ts";
import { ref } from "@ravel/slot.ts";
import { isDate, isRepeat } from "./dates.ts";
import { addTodo, type Fields, type Lane, listTodos, purgeOldDone, removeTodo, saveTodo, type Todo } from "./db.ts";
import { queueSweep, tagItem, tagLabel, tagsOf, toggleTag } from "@app/tags/api.ts";
import { live } from "@ravel/job.ts";
import { richScript, richSignals } from "@app/design-system/api.ts";
import { queueTriage } from "./queue.ts";
import { linkedLabels } from "./links.ts";
import { sourceChip, tickLinked } from "./linked.ts";
import { ownerToday } from "./today.ts";
import { askClaude, sortUnsorted as sortUnsortedTodos } from "./triage.ts";
import { addButton, addForm, filterBar, saveListeners, sortUnsorted } from "./view.ts";
import { bar } from "@ravel/nav.ts";
export { ownerToday } from "./today.ts";

const ID = /^[a-z][a-z0-9]*$/;
const NEW_TASK_SWEEP_MS = 3000; // a new task gets its tag soon after it is placed, not a minute later
const CLIENT = new URL("./todo.client.ts", import.meta.url);
const BODY_MAX = 500;
const NOTES_MAX = 20_000;
const PRIORITIES = [0, 1, 2];
const MAX_IMAGES = 10;
const IMAGE_PATH = /^private\/uploads\/[A-Za-z0-9._-]+\.jpg$/;
const LANES: Lane[] = ["unsorted", "soon", "someday"];

function todoId(ctx: Ctx): string {
  const id = String(ctx.signals.id ?? "");
  return ID.test(id) ? id : "";
}

function readImages(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string" && IMAGE_PATH.test(path)).slice(0, MAX_IMAGES) : [];
}

function parseImages(raw: string): string[] {
  try {
    return readImages(JSON.parse(raw));
  } catch {
    return [];
  }
}

function readFields(ctx: Ctx): Fields {
  const { body, done, due, soft, repeat, priority, notes, lane, auto, images } = ctx.signals;
  return {
    body: String(body ?? "").trim().slice(0, BODY_MAX),
    done: done === true,
    due: isDate(due) ? String(due) : "",
    soft: soft === true,
    repeat: isRepeat(repeat) ? String(repeat) : "",
    priority: PRIORITIES.includes(Number(priority)) ? Number(priority) : 1,
    notes: String(notes ?? "").slice(0, NOTES_MAX),
    lane: LANES.includes(lane as Lane) ? lane as Lane : "someday",
    auto: auto === true,
    images: readImages(images),
  };
}

export function add(ctx: Ctx) {
  const id = todoId(ctx);
  const fields = readFields(ctx);
  const created = Number(ctx.signals.created);
  if (id && fields.body) addTodo(fields.body, id, ctx.at, { ...fields, created: Number.isFinite(created) ? created : ctx.at });
  // Picked by hand on the new-task row.
  if (id && fields.body && Array.isArray(ctx.signals.tags)) for (const tag of ctx.signals.tags) tagItem("todo", id, Number(tag?.id));
  if (id && fields.body) {
    void queueTriage();
    void queueSweep(NEW_TASK_SWEEP_MS);
  }
}

export function save(ctx: Ctx) {
  const id = todoId(ctx);
  const fields = readFields(ctx);
  if (id && fields.body) saveTodo(id, fields, ctx.at);
  if (id && fields.body) void queueSweep();
}

export function remove(ctx: Ctx) {
  const id = todoId(ctx);
  if (id) removeTodo(id);
}

// Plain action: the owner adds a tag to a task, or takes one off (`on` 0; tag 0 takes them all off). The web sends the id and tag in the query, the iOS app as a payload. Needs the connection.
export function setTag(ctx: Ctx) {
  const id = String(ctx.query.get("id") ?? ctx.signals.id ?? "");
  const on = String(ctx.query.get("on") ?? ctx.signals.on ?? "1") !== "0";
  if (ID.test(id)) toggleTag("todo", id, Number(ctx.query.get("tag") ?? ctx.signals.tag), on);
}

// Plain action: the checkbox of a linked task asks the app that owns it; the list re-renders with whatever that app decided.
export function tickLinkedTask(ctx: Ctx) {
  const id = String(ctx.query.get("id") ?? ctx.signals.id ?? "");
  if (ID.test(id)) tickLinked(id, ownerToday(ctx.at));
}

let sorting = false;

// Plain action: it needs the connection, and the page re-renders afterwards with the tasks in their new sections.
export async function triage() {
  if (sorting) return;
  sorting = true;
  try {
    await sortUnsortedTodos(askClaude);
  } catch (error) {
    console.error("todo triage failed:", error);
  } finally {
    sorting = false;
  }
}

function toItem(todo: Todo, plans: ReturnType<typeof linkedLabels>) {
  return {
    plan: plans.get(todo.id)?.label ?? "",
    planHref: plans.get(todo.id)?.href ?? "",
    tags: tagsOf("todo", todo.id).map((tag) => ({ id: tag.id, label: tagLabel(tag) })),
    body: todo.body,
    done: Boolean(todo.done),
    due: todo.due,
    soft: Boolean(todo.soft),
    repeat: todo.repeat,
    priority: todo.priority,
    notes: todo.notes,
    images: parseImages(todo.images),
    lane: todo.lane,
    auto: Boolean(todo.auto),
    source: todo.source ? sourceChip(todo.source) : "",
    href: todo.href,
    tick: Boolean(todo.tick),
    created: todo.created_at,
    updated: todo.updated_at,
  };
}

export function items() {
  const plans = linkedLabels();
  return Object.fromEntries(listTodos().map((todo) => [todo.id, toItem(todo, plans)]));
}

export default async (ctx: Ctx) => {
  purgeOldDone();
  // A morphed-in <script> doesn't run, so a changed version makes the page evaluate the new one and redraw the list.
  const rerun = `(0, eval)(document.getElementById('todo-view').textContent); $_build = ${clientVersion(CLIENT)}`;
  const signals = `{open: '', todo: '', ${richSignals}, _build: 0, fp: 'all', q: '', fmenu: false, adding: false, sec: '', tagsAll: false, newFocus: false, newDue: '', newTags: []}`;
  const list = "ravel.html(el, todoView.listHTML($_todos, undefined, false, {tag: $fp, query: $q}))";
  return html`
    ${await clientScript(CLIENT, { id: "todo-view", "data-task": ref(import.meta, "./task") })}
    ${await richScript()}
    ${styles(import.meta.resolve("./todo.css"))}
    <section class="todo-page t-stagger space-y-4" ${live(ctx)} ${state("_todos", items())} data-signals__ifmissing="${signals}">
      ${bar({ title: "Todo", nativeTitle: true })}
      <div hidden data-init="${rerun}"></div>
      <div data-init="${sortUnsorted(ctx)}"></div>
      <div class="space-y-4 md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0">
        ${filterBar()}
        <div class="relative flex flex-col gap-4">
          ${addForm(ctx)}
          <div data-ignore-morph data-effect="$_build; $fp; $q; ${list}"></div>
        </div>
      </div>
      ${saveListeners(ctx)}
    </section>
    ${addButton()}
  `;
};

export const actions = { add, remove, save, setTag, tickLinkedTask, triage };
