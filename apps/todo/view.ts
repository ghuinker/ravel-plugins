import { action as post, js } from "@ravel/action.ts";
import { html, raw } from "@ravel/html.ts";
import { barButton, hideKeyboard, keyboardBar } from "@ravel/nav.ts";
import { action, add } from "@ravel/offline.ts";
import type { Ctx } from "@ravel/types.ts";
import { fab, richBar, richField, richToolbar } from "@app/design-system/api.ts";
import { isDormant, listTags, maxTags, recentTags } from "@app/tags/api.ts";

const PRIORITIES = [[0, "Low"], [1, "Normal"], [2, "High"]];
const QUICK_DATES = [["Today", "today"], ["Tomorrow", "tomorrow"], ["This week", "this week"], ["Next week", "next week"], ["Do soon", "soon"], ["Someday", "someday"]];
const REPEAT_SUGGESTIONS = ["every day", "every weekday", "every Mon", "every week", "every 2 weeks", "every month"];

const openField = (name: string) => `todoView.field($_todos, $open, '${name}')`;
const edit = (name: string, value: string) => `todoView.edit($_todos, $open, '${name}', ${value})`;
const TAGS_SHOWN = 5;
const SORT_DELAYS_MS = [1500, 8000];
const saveOpen = "todoView.save($open)";
const focus = (id: string) => `setTimeout(() => document.getElementById('${id}').focus())`;
const input = "w-full rounded-xl border t-input px-3 py-2 text-sm outline-none";
const smallButton = "rounded-lg border t-chip px-2.5 py-1 text-xs font-medium";

/** Asks the server to place unsorted tasks, if the browser has any. */
export const sortUnsorted = (ctx: Ctx) => `todoView.hasUnsorted($_todos) && ${post(ctx, "triage")}`;

export function addForm(ctx: Ctx) {
  const entry = add(ctx, "_todos", "add", "entry");
  const submit = [
    "$todo.trim() && ravel.haptic('success')",
    "const entries = todoView.parseLines($todo).map((entry) => todoView.withExtras(entry, $newDue, $newTags))",
    `entries.forEach((entry) => ${entry})`,
    "$todo = ''; $newDue = ''; $newTags = []",
    // On a touch screen the keyboard closes after adding; on a desktop focus stays for the next task.
    "matchMedia('(pointer: coarse)').matches && document.getElementById('todo-new').blur()",
    // The add is still on its way to the server, so ask a moment later, and once more in case it was slow.
    ...SORT_DELAYS_MS.map((delay) => `setTimeout(() => { ${sortUnsorted(ctx)} }, ${delay})`),
  ].join("; ");
  // "More" files the task as typed (or an empty "New task") and opens it in the full editor sheet.
  const more = [
    "ravel.haptic('tap')",
    "const entries = todoView.parseLines($todo).map((entry) => todoView.withExtras(entry, $newDue, $newTags))",
    "const first = entries[0] ?? {body: 'New task', done: false}",
    `const id = ${add(ctx, "_todos", "add", "first")}`,
    "$todo = ''; $newDue = ''; $newTags = []; $newFocus = false; $adding = false; $open = id",
    "const task = todoView.openTask(id)",
    "task && @get('/_s/' + task)",
  ].join("; ");
  // On a touch screen Return is a new line (the first line is the title, the rest notes); the bar's check adds the task.
  const enter = `if (evt.key === 'Enter' && !evt.shiftKey && !matchMedia('(pointer: coarse)').matches) { evt.preventDefault(); ${submit} }`;
  // A new task is a row at the top of the list: always there on a wide screen, opened by the round + on a phone.
  const dateChip = (label: string, words: string) => {
    const picked = `$newDue === todoView.quickDue('${words}')`;
    return html`<button data-on:click="ravel.haptic('select'); $newDue = todoView.quickDue('${words}', $newDue)" data-class="{'t-active': ${picked}, 't-hover': !(${picked})}" class="shrink-0 rounded-full border t-chip t-pill px-3 py-1 text-xs font-medium">${label}</button>`;
  };
  const tagChip = (tag: { id: number; emoji: string; name: string }) => {
    const picked = `$newTags.some((tag) => tag.id === ${tag.id})`;
    return html`<button data-on:click="ravel.haptic('select'); $newTags = todoView.toggled($newTags, {id: ${tag.id}, label: el.textContent.trim()}, ${max})" data-class="{'t-active': ${picked}, 't-hover': !(${picked})}" class="shrink-0 rounded-full border t-chip t-pill px-3 py-1 text-xs font-medium">${tag.name.trim()}</button>`;
  };
  const tags = recentTags(3);
  const max = maxTags();
  return html`
    <div class="todo-newwrap space-y-1.5" data-class="{'todo-collapsed': !$adding}">
      <div class="todo-newrow t-group cursor-text px-4 py-2.5" data-on:click="${focus("todo-new")}">
        <div class="flex items-center gap-3">
          <span class="t-check" aria-hidden="true"></span>
          <textarea id="todo-new" data-bind:todo rows="1" placeholder="New task" data-on:keydown="${enter}" data-on:focus="$newFocus = true"
            data-on:blur="$todo.trim() || $newDue || $newTags.length || ($newFocus = false, $adding = false)" aria-label="New task"
            class="min-w-0 flex-1 resize-none self-center bg-transparent outline-none [field-sizing:content] max-h-40"></textarea>
        </div>
        <div class="t-expand" data-class="{'is-open': $newFocus}">
          <div>
            <div class="flex flex-wrap gap-1.5 pl-9 pt-2" data-on:mousedown="evt.preventDefault()">
              ${dateChip("Today", "today")}${dateChip("Tomorrow", "tomorrow")}${dateChip("Next week", "next week")}
              ${tags.map(tagChip)}
              <button data-on:click="${more}" class="shrink-0 rounded-full border t-chip t-pill t-hover px-3 py-1 text-xs font-medium">More…</button>
            </div>
          </div>
        </div>
      </div>
      <div class="hidden">${keyboardBar({ for: "#todo-new", leading: [hideKeyboard()], trailing: [barButton({ label: "Add task", icon: "arrow-up", on: submit, prominent: true })] },
        barButton({ label: "Today", icon: "sun", on: "ravel.haptic('select'); $newDue = todoView.quickDue('today', $newDue)", checked: "$newDue === todoView.quickDue('today')" }),
        barButton({ label: "Tomorrow", icon: "calendar", on: "ravel.haptic('select'); $newDue = todoView.quickDue('tomorrow', $newDue)", checked: "$newDue === todoView.quickDue('tomorrow')" }))}</div>
      <div class="px-4 text-xs t-muted" style="display: none" data-show="todoView.hint($todo)" data-text="todoView.hint($todo)"></div>
    </div>`;
}

/** The round glass + on a phone. The new-task field stays collapsed rather than display:none so the focus can raise the keyboard. */
export const addButton = () =>
  fab({ label: "New task", class: "todo-fab", on: "document.getElementById('todo-new').focus({preventScroll: true}); $adding = true; scrollTo({top: 0, behavior: 'smooth'})" });

/** Date and repeat as two buttons side by side, each showing its value; a tap slides that one's options open underneath (`$sec`). */
function whenRows() {
  const setDate = `ravel.haptic('select'); ${edit("due", "el.value")}; ${saveOpen}`;
  const setSoft = `ravel.haptic('select'); ${edit("soft", "el.checked")}; ${saveOpen}`;
  const repeat = `todoView.setRepeat($_todos, $open, el.value) || (el.value = todoView.repeatInput($_todos, $open))`;
  const toggle = (key: string, icon: string, value: string) => {
    const open = `$sec === '${key}'`;
    return html`<button data-on:click="ravel.haptic('tap'); $sec = ${open} ? '' : '${key}'" data-class="{'t-active': ${open}}" class="todo-when-btn t-chip flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm">
      <span class="min-w-0 flex-1 truncate" data-text="${value}"></span>
      <span class="text-lg leading-none t-muted transition-transform" data-class="{'rotate-90': ${open}}">›</span>
    </button>`;
  };
  const panel = (key: string, body: unknown) => html`<div class="t-expand" data-class="{'is-open': $sec === '${key}'}"><div><div class="pt-2.5">${body}</div></div></div>`;
  return html`
    <div>
      <div class="grid grid-cols-2 gap-2">
        ${toggle("date", "", "todoView.dateValue($_todos, $open)")}
        ${toggle("repeat", "", "todoView.repeatValue($_todos, $open)")}
      </div>
      ${panel("date", html`<div class="space-y-2.5">
        <div class="flex items-center justify-between gap-3">
          <input type="date" aria-label="Date" data-on:change="${setDate}" data-effect="el.value = ${openField("due")} ?? ''" class="rounded-xl border t-input px-3 py-1.5 text-sm outline-none" />
          <label class="flex items-center gap-2 text-sm t-muted">By
            <input type="checkbox" class="t-switch" aria-label="By (soft deadline)" data-on:change="${setSoft}" data-effect="el.checked = ${openField("soft")} === true" />
          </label>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${QUICK_DATES.map(([label, words]) => html`<button data-on:click="ravel.haptic('tap'); todoView.moveTo($_todos, $open, '${words}')" class="${smallButton}">${label}</button>`)}
        </div>
      </div>`)}
      ${panel("repeat", html`<div class="space-y-2.5">
        <input list="todo-repeats" aria-label="Repeat" placeholder="Repeat: every Mon, every 2 weeks…" data-on:change="${repeat}" data-effect="el.value = todoView.repeatInput($_todos, $open)" class="${input}" />
        <datalist id="todo-repeats">${REPEAT_SUGGESTIONS.map((suggestion) => html`<option value="${suggestion}"></option>`)}</datalist>
        <div class="flex flex-wrap gap-1.5">
          <button data-on:click="ravel.haptic('tap'); todoView.setRepeat($_todos, $open, '')" class="${smallButton}">Never</button>
          ${REPEAT_SUGGESTIONS.map((suggestion) => html`<button data-on:click="ravel.haptic('tap'); todoView.setRepeat($_todos, $open, '${suggestion}')" class="${smallButton}">${suggestion}</button>`)}
        </div>
      </div>`)}
    </div>`;
}

function priorityButtons() {
  return html`
    <div class="flex gap-1 rounded-xl border t-chip p-1" role="group" aria-label="Priority">
      ${PRIORITIES.map(([level, label]) => {
        const picked = `${openField("priority")} === ${level}`;
        return html`<button data-on:click="ravel.haptic('select'); ${edit("priority", String(level))}; ${saveOpen}" data-class="{'t-active': ${picked}, 't-hover': !(${picked})}" class="flex-1 rounded-lg px-2 py-1 text-sm">${label}</button>`;
      })}
    </div>`;
}

function notesEditor() {
  const addSubtask = `evt.key === 'Enter' && (evt.preventDefault(), todoView.addSubtask($_todos, $open, el.value), el.value = '')`;
  const text = `data-effect="ravelRich.richLoad(el, ${openField("notes")} ?? '', true, $open)"
    data-on:rich-change="todoView.setNotes($_todos, $open, evt.detail.md, evt.detail.toggled)" data-on:rich-change__debounce.600ms="${saveOpen}"`;
  return html`
    <div class="space-y-2">
      <input placeholder="+ Add subtask" data-on:keydown="${addSubtask}" class="w-full bg-transparent py-1 text-sm outline-none" />
      <div class="flex items-center gap-2 border-t t-border pt-2"><span class="text-xs font-semibold uppercase tracking-wide t-muted">Notes</span>${richToolbar("todo-notes")}</div>
      <div data-ignore-morph>
        ${richField({ id: "todo-notes", placeholder: "Notes and subtasks", attrs: text, onBlur: saveOpen, classes: "todo-notes min-h-32" })}
      </div>
      ${richBar("todo-notes")}
    </div>`;
}

/** Photos added before pictures went inline in the notes: shown as thumbnails while the task still has any, and removable. New pictures go into the notes. */
function photoCard() {
  return html`
    <div class="t-group px-4 py-3" data-ignore-morph style="display: none" data-show="todoView.photos($_todos, $open) !== ''">
      <div class="todo-photos" data-effect="el.innerHTML = todoView.photos($_todos, $open)"></div>
    </div>`;
}

/** One chip per tag, plus "None". The label comes from the button's own text, never from an attribute. */
function tagPanel(ctx: Ctx, tags: ReturnType<typeof listTags>) {
  const max = maxTags();
  // A tap adds or removes that tag on the task at once, then tells the server; a full task just buzzes.
  const choose = (tagId: number | string) =>
    `const now = todoView.toggleTag($_todos, $open, ${tagId}, el.textContent.trim(), ${max}); now === 'full' ? ravel.haptic('warning') : (ravel.haptic('select'), ${post(ctx, "setTag", { id: js("$open"), tag: tagId, on: js("now === 'on' ? 1 : 0") })})`;
  // Five tags show; the rest sit behind "Show more" (a tag that is on the task always shows).
  const chip = (tagId: number, label: string, extra = false) => {
    const picked = tagId ? `todoView.hasTag($_todos, $open, ${tagId})` : "todoView.noTags($_todos, $open)";
    const hide = extra ? ` style="display: none" data-show="$tagsAll || ${picked}"` : "";
    return html`<button data-on:click="${choose(tagId)}" data-class="{'t-active': ${picked}, 't-hover': !(${picked})}" class="${smallButton}"${raw(hide)}>${label}</button>`;
  };
  return html`
    <div class="flex flex-wrap gap-1.5">
      ${chip(0, "None")}
      ${tags.map((tag, n) => chip(tag.id, tag.name.trim(), n >= TAGS_SHOWN))}
      ${tags.length > TAGS_SHOWN ? html`<button data-on:click="ravel.haptic('tap'); $tagsAll = !$tagsAll" class="${smallButton} t-accent" data-text="$tagsAll ? 'Show less' : 'Show more'"></button>` : ""}
    </div>`;
}

/** Search box and one chip per tag. Only the page's own list uses it; the filter lives in `$fp` and `$q`. */
export function filterBar() {
  const tags = listTags();
  const sleeping = tags.filter(isDormant);
  const chip = (value: number | string, label: string) => {
    const picked = `$fp === ${typeof value === "string" ? `'${value}'` : value}`;
    const shown = typeof value === "string" ? `'${value}'` : value;
    return html`<button data-on:click="ravel.haptic('select'); $fp = ${shown}; $fmenu = false" data-class="{'t-active': ${picked}, 't-hover': !(${picked})}" class="todo-filter block w-full shrink-0 truncate px-4 py-2.5 text-left text-sm">${label}</button>`;
  };
  return html`
    <aside data-filter class="relative space-y-3 md:sticky md:top-4">
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
        <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 t-muted" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input data-bind:q type="search" placeholder="Search" class="t-pill w-full rounded-full border t-input py-2.5 pl-10 pr-4 outline-none" />
      </div>
        ${tags.length
          ? html`<button data-on:click="ravel.haptic('tap'); $fmenu = !$fmenu" aria-label="Filter by tag" data-class="{'t-active': $fmenu || $fp !== 'all'}" class="t-pill flex size-11 shrink-0 items-center justify-center rounded-full border t-chip md:hidden">
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>
            </button>`
          : ""}
      </div>
      ${tags.length
        ? html`<div data-class="{'max-md:hidden': !$fmenu}" data-on:click__window="evt.target.closest('[data-filter]') || ($fmenu = false)" class="t-group absolute right-0 top-12 z-20 w-64 max-w-full shadow-xl md:static md:w-auto md:shadow-none">
          <div class="flex max-h-72 flex-col overflow-y-auto md:max-h-none md:overflow-visible">
            ${chip("all", "All")}${chip(0, "No tag")}
            ${tags.filter((tag) => !isDormant(tag)).map((tag) => chip(tag.id, tag.name.trim()))}
            ${sleeping.length ? html`<details class="group" data-effect="$fp; if ($fp !== 'all') el.open = el.open || ${JSON.stringify(sleeping.map((tag) => tag.id))}.includes($fp)">
              <summary class="flex shrink-0 list-none items-center justify-between px-4 py-2.5 text-sm t-muted" data-on:click="ravel.haptic('tap')">More<span class="text-xl leading-none transition-transform group-open:rotate-90">›</span></summary>
              ${sleeping.map((tag) => chip(tag.id, tag.name.trim()))}
            </details>` : ""}
          </div>
        </div>`
        : ""}
    </aside>`;
}

/** The list page's own posts for tasks changed from a row. */
export function saveListeners(ctx: Ctx) {
  return html`
    <div data-on:todo-tick__window="${post(ctx, "tickLinkedTask", { id: js("evt.detail.id") })}"></div>
    <div data-on:todo-remove__window="${action(ctx, "remove", "{id: evt.detail.id}")}"></div>
    <div data-on:todo-save__window="${action(ctx, "save", "todoView.payload($_todos, evt.detail.id)")}"></div>`;
}

/** One labelled row of the details card: a small label above the control. */
const detail = (label: string, body: unknown) => html`<div class="todo-detail"><div class="todo-label">${label}</div><div class="min-w-0">${body}</div></div>`;

/** The task editor, shown in a sheet: the title and notes in one card, then a details card (date and repeat on one line, priority and tags always showing). On a wide screen the details sit beside the notes. It's bound to `$open`, so a re-render without the query keeps showing the same task. */
export function editor(ctx: Ctx) {
  const remove = `ravel.haptic('warning'); $_todos[$open].gone = true; ${action(ctx, "remove", "{id: $open}")}; dispatchEvent(new CustomEvent('todo-removed', {detail: {id: $open}})); ravel.close()`;
  const tags = listTags();
  return html`
    <div class="todo-editor">
      <div class="todo-main">
      <div class="todo-card t-group space-y-2 px-5 py-4" data-ignore-morph>
        <textarea id="todo-title" rows="1" placeholder="Task" data-effect="el.value = ${openField("body")} ?? ''; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'"
          data-on:input="el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; ${edit("body", "el.value")}" data-on:input__debounce.600ms="${saveOpen}" data-on:blur="${saveOpen}"
          data-on:keydown="if (evt.key === 'Enter') { evt.preventDefault(); el.blur() }"
          class="block w-full resize-none overflow-hidden bg-transparent text-xl font-bold outline-none"></textarea>
        ${notesEditor()}
      </div>
      ${photoCard()}
      </div>
      <div class="todo-side">
      <div class="todo-details t-group">
        ${detail("When", whenRows())}
        ${detail("Priority", priorityButtons())}
        ${tags.length ? detail("Tags", tagPanel(ctx, tags)) : ""}
      </div>
      <button data-on:click="${remove}" class="todo-delete t-group w-full px-4 py-3 text-center font-medium t-accent">Delete task</button>
      </div>
    </div>`;
}
