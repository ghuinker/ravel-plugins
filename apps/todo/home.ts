import { action, argText } from "@ravel/action.ts";
import { clientScript, styles } from "@ravel/client.ts";
import { component } from "@ravel/component.ts";
import { live } from "@ravel/job.ts";
import { html } from "@ravel/html.ts";
import { newId } from "@ravel/offline.ts";
import { ref, slot } from "@ravel/slot.ts";
import type { Ctx } from "@ravel/types.ts";
import { CHEV, homeCard, type HomeCard } from "@app/home/api.ts";
import { queueSweep } from "@app/tags/api.ts";
import { formatDay } from "../../lib/time.ts";
import { addTodo, completeTask, listTodos } from "./db.ts";
import { queueTriage } from "./queue.ts";
import { openTaskSheet } from "./sheet.ts";
import { ownerToday } from "./today.ts";

const PAGE = ref(import.meta, "./home");
const TAP = "ravel.haptic('tap')";
const TASKS_SHOWN = 8;
const BODY_MAX = 500;
const NEW_TASK_SWEEP_MS = 3000;
const ID = /^[a-z][a-z0-9]*$/;

const plain = (text: string) => text.replace(/[*_`~]/g, "");

/** The add field on the Tasks card: a new task like the Todo page's (undated, Haiku places it). */
export function addTask(ctx: Ctx) {
  const body = String(ctx.signals.newtask ?? "").trim().slice(0, BODY_MAX);
  if (!body) return;
  addTodo(body, newId(), ctx.at, { created: ctx.at });
  void queueTriage();
  void queueSweep(NEW_TASK_SWEEP_MS);
}

/** The round check on a task: finishes it like the Todo page does (a repeating one moves to its next date). */
export function doneTask(ctx: Ctx) {
  const id = argText(ctx, "id");
  if (ID.test(id)) completeTask(id, ownerToday(ctx.at), ctx.at);
}

/** A deleted task: the Tasks card drops its row, then asks for a fresh render. */
export const refresh = () => {};

export const addField = () => html`<form class="bt-add" data-signals__ifmissing="{newtask: ''}" data-on:submit__prevent="const text = $newtask.trim(); text && (ravel.haptic('success'), ${action(PAGE, "addTask")}, window.bentoAddTask(text), $newtask = '')"><span class="bt-plus" aria-hidden="true">+</span><input type="text" class="bt-input" placeholder="New task" aria-label="New task" maxlength="${BODY_MAX}" autocomplete="off" data-bind:newtask /></form>`;

const SECTIONS = ["High priority", "Unsorted", "Today", "Upcoming", "Someday"];
const SECTION_CHIP = ["h2-hot", "", "h2-ok", "", ""];

/** Every open task in Todo's order (see apps/todo/README.md), one table row each. */
function tasksCard(index: number) {
  const date = ownerToday();
  const open = listTodos().filter((todo) => !todo.done);
  const rest = open.filter((todo) => todo.priority !== 2);
  const groups = [
    open.filter((todo) => todo.priority === 2).sort((a, b) => ((a.due || "9") < (b.due || "9") ? -1 : 1)),
    rest.filter((todo) => todo.lane === "unsorted" && !todo.due),
    rest.filter((todo) => (todo.due ? todo.due <= date : todo.lane === "soon")),
    rest.filter((todo) => todo.due > date).sort((a, b) => (a.due < b.due ? -1 : 1)),
    rest.filter((todo) => !todo.due && todo.lane === "someday"),
  ];
  const rows = groups.flatMap((list, group) => list.map((todo) => ({ todo, group }))).slice(0, TASKS_SHOWN);
  const table = rows.length ? html`<div class="h2-table" style="--cols:1.5rem minmax(0,1fr) auto auto 1rem">
    <div class="h2-th"><span></span><span>Task</span><span class="h2-hide">Due</span><span>Priority</span><span></span></div>
    ${rows.map(({ todo, group }, n) => html`<div class="h2-row h2-task" data-task="${todo.id}" style="--n:${n}">
      <input type="checkbox" class="t-check" aria-label="Done" data-on:change="ravel.haptic('success'); ${action(PAGE, "doneTask", { id: todo.id })}; el.closest('.h2-row').classList.add('h2-done')" />
      <a class="h2-name" href="/todo" data-on:click="evt.preventDefault(); ${TAP}; ${openTaskSheet(todo.id)}"><b>${plain(todo.body)}</b></a>
      <span class="h2-hide t-muted">${todo.due ? formatDay(todo.due) : ""}</span>
      <span class="h2-chip ${SECTION_CHIP[group]}">${SECTIONS[group]}</span>
      <span></span>
    </div>`)}
  </div>` : html`<p class="h2-empty">No open tasks.</p>`;
  const more = open.length > rows.length ? html`<a class="h2-more" href="/todo" data-on:click="${TAP}">All ${open.length} open tasks ${CHEV}</a>` : "";
  return homeCard(index, "Tasks", html`<div class="h2-addwrap">${addField()}</div>${table}${more}`, { count: `${open.length} open`, href: "/todo" });
}

/** The Tasks card as a slot that re-renders whenever a job run changes, so a new task shows in its place once the sorting run has placed it (and its row opens the editor). */
export const TasksLive = component((ctx: Ctx) => html`<div style="display:contents" ${live(ctx)} data-on:todo-removed__window="document.querySelectorAll('[data-task=&quot;' + evt.detail.id + '&quot;]').forEach((row) => row.remove()); setTimeout(() => ${action(ctx, "refresh")}, 700)">${tasksCard(Number(ctx.props.i ?? 0))}</div>`);

export const actions = { addTask, doneTask, refresh };

/** The Tasks card on Home (`plugs.home` in `app.ts`). */
export const cards: HomeCard[] = [
  { id: "tasks", order: 30, size: 8, tall: true, render: async (_ctx, index) => html`${styles(import.meta.resolve("./home.css"))}${slot(ref(import.meta, "./home.TasksLive"), { i: String(index) }, { skeleton: html`<section class="h2-card"></section>` })}${await clientScript(import.meta.resolve("./home.client.ts"), {}, { always: true })}` },
];
