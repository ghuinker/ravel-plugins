// The task list in the browser (bundled by todo.client.ts as `todoView`): rendering, checking, editing the open task and
// parsing what was typed. `splitLines` also runs on the server (triage.ts).
import { dueLabel, firstDue, nextDue, parseDate, parseRepeat, parseTask, repeatText, today } from "./dates.ts";
import { escapeHtml, list, renderInline, section } from "@app/design-system/api.ts";
import { itemHasTag, itemNoTags, itemTagNames, matchesTag, type PickedTag, pickTag, toggledTags } from "../../lib/tag-pick.ts";

/** A task as the page holds it in `$_todos` (see `toItem` in index.ts). */
export type TodoItem = {
  body: string;
  done: boolean;
  due: string;
  soft: boolean;
  repeat: string;
  priority: number;
  notes: string;
  lane: string;
  auto: boolean;
  created: number;
  updated: number;
  tags?: PickedTag[];
  images?: string[];
  plan?: string;
  planHref?: string;
  source?: string;
  href?: string;
  tick?: boolean;
  gone?: boolean;
};
export type Todos = Record<string, TodoItem>;
type Entry = [string, TodoItem];
export type NewTask = Omit<TodoItem, "tags" | "gone"> & { tags?: PickedTag[] };
type Filter = { tag?: string | number; query?: string };

const ID = /^[a-z][a-z0-9]*$/;
const SUBTASK = /^\s*[-*+]\s+\[( |x|X)\]\s/;
const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const HEADER_LINE = /^(?:to-?do(?: list)?|to do|tasks?)\s*:?\s*$/i;
const HEADER_PREFIX = /^to-?do\s*:\s*/i;
const SUBTASK_INDENT = 2;
const LOW = 0;
const NORMAL = 1;
const HIGH = 2;
const SECTIONS = [["unsorted", "Unsorted"], ["priority", "High priority"], ["today", "Today"], ["week", "Upcoming"], ["someday", "Someday"], ["done", "Done"]];
const TODAY_EMPTY = "Nothing due today. Add something with a date, or look below.";

/** A field of the open task, or undefined. Reading $_todos[id] for a missing id would create it. */
export function field<K extends keyof TodoItem>(todos: Todos, open: string, name: K): TodoItem[K] | undefined {
  Object.keys(todos);
  if (!open || !Object.hasOwn(todos, open) || todos[open].gone) return undefined;
  return todos[open][name];
}

export function edit<K extends keyof TodoItem>(todos: Todos, open: string, name: K, value: TodoItem[K]) {
  if (field(todos, open, name) === undefined || todos[open][name] === value) return;
  todos[open][name] = value;
  todos[open].updated = Date.now();
}

// Browser code can't find the folder Todo is installed in, so the page passes the editor's ref (`data-task` on its script tag).
let taskRef = "";
export const setTaskRef = (ref: string) => void (taskRef = ref);

/** Opens a task in the editor sheet. The slot id is the server's (`slotId` in the SDK: FNV-1a over `id=<id>&`), so the fetched fragment lands in the sheet. */
export function openTask(id: string) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`id=${id}&`)) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  const slot = `slot-${taskRef.replaceAll("/", "-")}-${h.toString(16).padStart(8, "0")}`;
  const url = `${taskRef}?id=${id}`;
  return (globalThis as any).ravel.sheet(taskRef, url, slot, "large") && url;
}

/** True for the empty "New task" that More… files, while nothing has been filled in. */
export function isBlank(todos: Todos, open: string) {
  if (field(todos, open, "body") !== "New task") return false;
  const item = todos[open];
  return !item.notes && !item.due && !item.soft && !item.repeat && !item.done && item.priority === NORMAL && itemNoTags(item);
}

/** Shows a tag toggled on the task right away (see `pickTag`); the server saves it. */
export function toggleTag(todos: Todos, id: string, tagId: number, label: string, max: number) {
  return field(todos, id, "body") === undefined ? "full" : pickTag(todos[id], tagId, label, max);
}

export function toggled(list: PickedTag[], tag: PickedTag, max: number) {
  return toggledTags(list, tag, max);
}
export function hasTag(todos: Todos, id: string, tagId: number) {
  return itemHasTag(todos[id], tagId);
}
export function noTags(todos: Todos, id: string) {
  return itemNoTags(todos[id]);
}

/** Tells the page to send this task to the server. */
export function save(id: string) {
  dispatchEvent(new CustomEvent("todo-save", { detail: { id } }));
}

export function payload(todos: Todos, id: string) {
  const item = todos[id];
  return { id, body: item.body, done: item.done, due: item.due, soft: item.soft, repeat: item.repeat, priority: item.priority, notes: item.notes, images: item.images ?? [], lane: item.lane, auto: item.auto, created: item.created };
}

// ---- photos: shrunk in the browser, saved through the chat's upload, listed on the task as private/uploads paths

const MAX_PHOTOS = 10;
const PHOTO_SIDE = 1600;

async function shrink(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no image"))), "image/jpeg", 0.85));
}

/** Adds the picked files to the open task and saves it. Needs the connection to upload; offline it buzzes. */
export function addPhotos(todos: Todos, id: string, files: Iterable<File>) {
  return uploadPhotos(todos, id, files);
}

/** A paste with images in it (a screenshot, a copied picture) becomes photos on the open task; plain text pastes as usual. */
export function pastePhotos(todos: Todos, id: string, event: ClipboardEvent) {
  const images = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
  if (!images.length) return;
  event.preventDefault();
  uploadPhotos(todos, id, images);
}

async function uploadPhotos(todos: Todos, id: string, files: Iterable<File>) {
  const item = todos[id];
  if (!item) return;
  const paths = [...(item.images ?? [])];
  for (const file of [...files]) {
    if (paths.length >= MAX_PHOTOS) return ravel.haptic("warning");
    try {
      paths.push(await globalThis.ravelChat!.upload(await shrink(file)));
    } catch {
      ravel.haptic("warning");
      break;
    }
  }
  edit(todos, id, "images", paths);
  ravel.haptic("success");
  save(id);
}

export function removePhoto(todos: Todos, id: string, path: string) {
  edit(todos, id, "images", (todos[id].images ?? []).filter((one) => one !== path));
  save(id);
}

export function photos(todos: Todos, id: string) {
  return (todos[id]?.images ?? []).map((path) => `
    <div class="todo-photo">
      <a href="/${escapeHtml(path)}" target="_blank" rel="noopener"><img src="/${escapeHtml(path)}" alt="" loading="lazy" /></a>
      <button type="button" aria-label="Remove photo" data-on:click="ravel.haptic('warning'); todoView.removePhoto($_todos, $open, '${escapeHtml(path)}')">✕</button>
    </div>`).join("");
}

// ---- which section a task is in

export function sectionOf(item: Pick<TodoItem, "done" | "priority" | "due" | "lane">, now = today()) {
  if (item.done) return "done";
  if (item.priority === HIGH) return "priority";
  if (item.due) return item.due <= now ? "today" : "week";
  if (item.lane === "soon") return "today";
  return item.lane === "unsorted" ? "unsorted" : "someday";
}

// ---- subtasks live in the notes as markdown checkboxes

export function subtasks(notes: string) {
  const boxes = notes.split("\n").map((line) => line.match(SUBTASK)).filter((box) => box !== null);
  return { done: boxes.filter((box) => box[1] !== " ").length, total: boxes.length };
}

function hasNotes(notes: string) {
  return notes.split("\n").some((line) => line.trim() && !SUBTASK.test(line));
}

export function addSubtask(todos: Todos, open: string, text: string) {
  const line = text.trim().replace(/\s+/g, " ");
  if (!line) return;
  const notes = field(todos, open, "notes") ?? "";
  edit(todos, open, "notes", `${notes}${notes && !notes.endsWith("\n") ? "\n" : ""}- [ ] ${line}`);
  save(open);
}

/** The editor changed the notes; `toggled` is {done} when a subtask's circle was tapped, which saves at once. */
export function setNotes(todos: Todos, open: string, notes: string, toggled: { done: boolean } | null) {
  edit(todos, open, "notes", notes);
  if (!toggled) return;
  save(open);
  if (toggled.done) completeWhenAllSubtasksDone(todos, open, "[x]");
}

/** Checking the last open subtask finishes the parent (a repeating one moves to its next date). */
function completeWhenAllSubtasksDone(todos: Todos, id: string, toggledRow: string) {
  const item = todos[id];
  if (!item || item.done || !/\[[xX]\]/.test(toggledRow)) return;
  const { done, total } = subtasks(item.notes);
  if (total > 0 && done === total) toggle(todos, id);
}

// ---- changing a task

const CELEBRATE_MS = 520;

/** The title is struck through, then the row fades and collapses (the CSS in todo.css). Returns false when there's nothing to wait for. */
function celebrate(id: string) {
  navigator.vibrate?.([12, 40, 24]);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const box = document.querySelector(`input[data-on\\:change*="todoView.toggle($_todos, '${id}')"]`);
  const row = box?.closest(".todo-row");
  if (!row) return false;
  row.classList.add("todo-complete");
  return true;
}

/** Checking a repeating task moves it to its next date and clears its subtasks instead of finishing it. */
export function toggle(todos: Todos, id: string, now = today()) {
  const item = field(todos, id, "body") === undefined ? null : todos[id];
  if (!item) return;
  if (item.source) return tickLinked(item, id);
  if (!item.done && typeof document !== "undefined" && celebrate(id)) {
    setTimeout(() => finishToggle(todos, id, now), CELEBRATE_MS);
    return;
  }
  finishToggle(todos, id, now);
}

/** A linked task is finished by the app it belongs to: the server asks that app, and the list shows the result. */
function tickLinked(item: TodoItem, id: string) {
  if (!item.tick || item.done) return;
  if (typeof document === "undefined" || !celebrate(id)) return void dispatchEvent(new CustomEvent("todo-tick", { detail: { id } }));
  setTimeout(() => dispatchEvent(new CustomEvent("todo-tick", { detail: { id } })), CELEBRATE_MS);
}

function finishToggle(todos: Todos, id: string, now: string) {
  const item = todos[id];
  if (!item) return;
  if (item.repeat && !item.done) {
    edit(todos, id, "due", nextDue(item.repeat, item.due, now));
    edit(todos, id, "notes", item.notes.replace(/\[[xX]\]/g, "[ ]"));
  } else {
    edit(todos, id, "done", !item.done);
  }
  save(id);
}

const UNDATED: Record<string, string> = { someday: "someday", soon: "soon" };

/** Moves the open task to a date written in words ("tomorrow", "next week"), or to Today ("soon") or Someday without a date. */
export function moveTo(todos: Todos, open: string, words: string, now = today()) {
  const lane = UNDATED[words];
  const parsed = lane ? { due: "", soft: false } : parseDate(words, now);
  if (!parsed) return;
  edit(todos, open, "due", parsed.due);
  edit(todos, open, "soft", parsed.soft);
  // Whatever the owner picks counts as sorted, and Claude won't second-guess it.
  edit(todos, open, "lane", lane ?? "someday");
  edit(todos, open, "auto", false);
  save(open);
}

export function hasUnsorted(todos: Todos, now = today()) {
  return Object.values(todos).some((item) => !item.gone && sectionOf(item, now) === "unsorted");
}

export function setRepeat(todos: Todos, open: string, words: string, now = today()) {
  const repeat = words.trim() ? parseRepeat(words) : "";
  if (repeat === null) return false;
  edit(todos, open, "repeat", repeat);
  if (repeat && !field(todos, open, "due")) edit(todos, open, "due", firstDue(repeat, now));
  save(open);
  return true;
}

/** The current values shown on the editor's setting rows. */
export function dateValue(todos: Todos, open: string) {
  const due = field(todos, open, "due");
  return due ? `${field(todos, open, "soft") ? "by " : ""}${dueLabel(due, today())}` : "None";
}
export function repeatValue(todos: Todos, open: string) {
  return repeatText(field(todos, open, "repeat") ?? "") || "Never";
}
export function priorityValue(todos: Todos, open: string) {
  return ["Low", "Normal", "High"][field(todos, open, "priority") ?? NORMAL];
}
export function tagValue(todos: Todos, open: string) {
  return itemTagNames(todos[open]);
}

export function repeatInput(todos: Todos, open: string) {
  return repeatText(field(todos, open, "repeat") ?? "");
}

// ---- adding

function lineIndent(line: string) {
  return (line.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "  ").length;
}

function cleanTitle(line: string) {
  return line.replace(LIST_MARKER, "").replace(HEADER_PREFIX, "").trim();
}

/** One entry per line of text; lines indented under another become its subtasks. Used when a pasted block turns out to be a list. */
export function splitLines(text: string, now = today(), at = Date.now()): NewTask[] {
  const lines = text.split("\n").filter((line) => line.trim() && !HEADER_LINE.test(line.trim()));
  const base = lines.length ? lineIndent(lines[0]) : 0;
  const found: (ReturnType<typeof parseTask> & { subtasks: string[] })[] = [];
  for (const line of lines) {
    const title = cleanTitle(line);
    if (!title) continue;
    if (found.length && lineIndent(line) >= base + SUBTASK_INDENT) found.at(-1)!.subtasks.push(title);
    else found.push({ ...parseTask(title, now), subtasks: [] });
  }
  const tasks = found.filter((entry) => entry.body);
  return tasks.map((entry, index) => {
    const priority = entry.priority ?? (tasks.length > 1 && !entry.due ? LOW : NORMAL);
    const notes = entry.subtasks.map((subtask) => `- [ ] ${subtask}`).join("\n");
    // Earlier lines get later creation times, so a pasted list shows in the order it was written.
    return { body: entry.body, done: false, due: entry.due, soft: entry.soft, repeat: entry.repeat, priority, notes, lane: entry.due || priority === HIGH ? "someday" : "unsorted", auto: false, created: at + tasks.length - index, updated: at };
  });
}

/**
 * What the typed or pasted text becomes. Several lines are one task for now (first line is the title, the rest its notes, untouched);
 * the sorting job asks Claude whether it was really a list and splits it then (`splitUnsorted` in triage.ts).
 */
export function parseLines(text: string, now = today(), at = Date.now()): NewTask[] {
  const entries = splitLines(text, now, at);
  if (entries.length < 2) return entries;
  const lines = text.split("\n").filter((line) => line.trim());
  const first = lines.findIndex((line) => cleanTitle(line) && !HEADER_LINE.test(line.trim()));
  const [head] = splitLines(lines[first], now, at);
  if (!head) return entries;
  const notes = lines.slice(first + 1).join("\n").trim();
  const priority = head.priority === LOW && !head.due ? NORMAL : head.priority;
  return [{ ...head, priority, notes, lane: head.due || priority === HIGH ? "someday" : "unsorted", created: at }];
}

/** The date and tags picked on the new-task row go onto what was typed; a date written in the text wins. */
export function withExtras(entry: NewTask, due: string, tags: { id: number | string; label: string }[] | undefined) {
  const out = { ...entry };
  if (due && !out.due) {
    Object.assign(out, { due, soft: false, lane: "someday", priority: out.priority === LOW ? NORMAL : out.priority });
  }
  if (tags?.length) out.tags = tags.map((tag) => ({ id: Number(tag.id), label: tag.label }));
  return out;
}

/** The date for a quick chip ("tomorrow"); picking the one already chosen (`current`) clears it. */
export function quickDue(words: string, current = "") {
  const due = parseDate(words, today())?.due ?? "";
  return due === current ? "" : due;
}

/** A short line under the input saying what the typed text will become. */
export function hint(text: string, now = today()) {
  const entries = parseLines(text, now);
  if (!entries.length) return "";
  const [first] = entries;
  const parts: string[] = [];
  if (first.due) parts.push(`${first.soft ? "by " : ""}${dueLabel(first.due, now)}`);
  if (first.repeat) parts.push(`↻ ${repeatText(first.repeat)}`);
  if (first.priority === HIGH) parts.push("high priority");
  if (first.priority === LOW) parts.push("low priority");
  const subtaskTotal = subtasks(first.notes).total;
  if (subtaskTotal) parts.push(`${subtaskTotal} subtasks`);
  else if (first.notes) parts.push("rest goes in notes");
  if (entries.length > 1) return `${entries.length} tasks${parts.length ? ` · first: ${parts.join(" · ")}` : ""}`;
  return parts.join(" · ");
}

// ---- the list

function byImportance([, a]: Entry, [, b]: Entry) {
  return b.priority - a.priority || b.created - a.created;
}

function chip(text: string, extra = "") {
  return `<span class="rounded-full px-2.5 py-0.5 t-pill ${extra || "t-chip t-muted"}">${escapeHtml(text)}</span>`;
}

/** The chip for a linked task opens its app. `href` is checked to be a path on this site when the task is stored. */
function sourceLink(item: TodoItem) {
  const label = escapeHtml(`${item.source} ↗`);
  return `<a href="${escapeHtml(item.href ?? "")}" class="rounded-full px-2.5 py-0.5 t-pill t-chip t-accent">${label}</a>`;
}

/** A task added from a Planit trip or date links back to it. */
function planLink(item: TodoItem) {
  return `<a href="${escapeHtml(item.planHref ?? "")}" class="rounded-full px-2.5 py-0.5 t-pill t-chip t-accent">${escapeHtml(item.plan ?? "")} ↗</a>`;
}

function lead(id: string, item: TodoItem) {
  if (item.source && !item.tick) {
    return item.done
      ? `<span class="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] t-accent-bg" aria-label="Done">✓</span>`
      : `<a href="${escapeHtml(item.href ?? "")}" class="flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] t-accent" aria-label="Open to finish">↗</a>`;
  }
  return `<input type="checkbox" ${item.done ? "checked" : ""} data-on:change="ravel.haptic(el.checked ? 'success' : 'tap'), todoView.toggle($_todos, '${id}')" aria-label="Done" class="t-check" />`;
}

/** The due date and repeat as plain text under the title (accent when overdue). */
function meta(item: TodoItem, now: string) {
  const parts: string[] = [];
  if (item.due) parts.push(`${item.soft ? "by " : ""}${dueLabel(item.due, now)}`);
  if (item.repeat) parts.push(`↻ ${repeatText(item.repeat)}`);
  if (!parts.length) return "";
  const late = item.due && item.due < now && !item.done;
  return `<div class="mt-0.5 text-xs ${late ? "t-accent font-medium" : "t-muted"}">${escapeHtml(parts.join(" · "))}</div>`;
}

function chips(item: TodoItem) {
  const found: string[] = [];
  for (const tag of item.tags ?? []) found.push(chip(tag.label, "t-accent-tint"));
  if (item.plan && item.planHref) found.push(planLink(item));
  if (item.source) found.push(sourceLink(item));
  if (item.lane === "soon" && item.auto && !item.due) found.push(chip("✦ soon"));
  const progress = subtasks(item.notes);
  if (progress.total) found.push(chip(`${progress.done}/${progress.total}`));
  if (hasNotes(item.notes)) found.push(chip("≡ notes"));
  if (item.images?.length) found.push(chip(`${item.images.length} ${item.images.length === 1 ? "photo" : "photos"}`));
  return found.length ? `<div class="mt-1 flex flex-wrap gap-1.5 text-xs">${found.join("")}</div>` : "";
}

function row(id: string, item: TodoItem, now: string) {
  const title = item.priority === HIGH ? `<span class="t-accent font-bold">! </span>${renderInline(item.body)}` : renderInline(item.body);
  const open = `evt.target.closest('a') || (ravel.haptic('tap'), (todoView.openTask('${id}') && @get('/_s/${taskRef}?id=${id}')))`;
  const gone = `$_todos['${id}'].gone = true; dispatchEvent(new CustomEvent('todo-remove', {detail: {id: '${id}'}}))`;
  const move = (label: string, words: string) => `<button type="button" class="ravel-row-action" aria-label="${label}" data-on:click="ravel.haptic('select'); todoView.moveTo($_todos, '${id}', '${words}')"><span>${label}</span></button>`;
  return `<div class="row-wrap ask-item"><ravel-row class="todo-row">
    <div class="ravel-row-side" data-side="leading">${move("Today", "today")}${move("Someday", "someday")}</div>
    <div class="ravel-row-side" data-side="trailing"><button type="button" class="ravel-row-action" aria-label="Ask AI" data-on:click="ravel.haptic('select'); ravelAsk(el, 'todo', '${id}')"><span>Ask AI</span></button><button type="button" class="ravel-row-action ravel-row-destructive" aria-label="Delete" data-on:click="ravel.haptic('warning'); ${gone}"><span>Delete</span></button></div>
    <div class="ravel-row-content flex items-center gap-3 px-4 py-2.5">
      ${lead(id, item)}
      <div class="min-w-0 flex-1" data-on:click="${open}">
        <div class="ask-title break-words ${item.done ? "t-muted line-through" : ""}">${title}</div>
        ${meta(item, now)}${chips(item)}
      </div>
    </div>
  </ravel-row></div>`;
}

function sorted(key: string, entries: Entry[], now: string): Entry[] {
  if (key === "today") {
    const late = ([, item]: Entry) => (item.due && item.due < now ? 0 : 1);
    return entries.sort((a, b) => late(a) - late(b) || byImportance(a, b));
  }
  if (key === "priority") return entries.sort(([, a], [, b]) => (a.due || "9").localeCompare(b.due || "9") || b.created - a.created);
  if (key === "week") return entries.sort((a, b) => a[1].due.localeCompare(b[1].due) || byImportance(a, b));
  if (key === "done") return entries.sort(([, a], [, b]) => b.updated - a.updated);
  return entries.sort(byImportance);
}

function sectionHTML(key: string, title: string, entries: Entry[], now: string, first: boolean) {
  const rows = sorted(key, entries, now).map(([id, item]) => row(id, item, now));
  if (key === "done") {
    return `<details class="group t-group ${first ? "" : "mt-7"}" ${doneOpen ? "open" : ""} data-on:toggle="todoView.setDoneOpen(el.open)">
    <summary class="flex items-center gap-2 px-4 py-3 font-medium"><span>Completed</span><span class="t-muted">${entries.length}</span><span class="ml-auto text-xl leading-none t-muted transition-transform group-open:rotate-90">›</span></summary>
    <div class="todo-group">${rows.join("")}</div>
  </details>`;
  }
  const body = entries.length ? list(rows, { class: "todo-group" }) : `<p class="px-1 t-muted">${TODAY_EMPTY}</p>`;
  return section(title, body, { count: entries.length, class: first ? "" : "mt-7" }).value;
}

/** Whether the Done section is expanded; kept here so list re-renders don't collapse it again. */
let doneOpen = false;
export function setDoneOpen(open: boolean) {
  doneOpen = Boolean(open);
}

/** `tag` is "all", 0 (no tag) or a tag id (a task with several tags matches each of them); `query` matches the title or notes, ignoring case. */
export function matches(item: { body: string; notes?: string; tags?: PickedTag[] }, { tag = "all", query = "" }: Filter = {}) {
  if (!matchesTag(item, tag)) return false;
  const needle = String(query).trim().toLowerCase();
  return !needle || `${item.body}\n${item.notes ?? ""}`.toLowerCase().includes(needle);
}

/** Every section on one page, each after a divider. Today always shows; the others only when they have tasks (all of them, when `compact`). */
export function listHTML(todos: Todos, now = today(), compact = false, filter: Filter = {}) {
  const entries = Object.entries(todos).filter(([id, item]) => ID.test(id) && !item.gone && matches(item, filter));
  const shown = SECTIONS.map(([section, title]) => [section, title, entries.filter(([, item]) => sectionOf(item, now) === section)] as const)
    .filter(([section, , mine]) => (section === "today" && !compact) || mine.length);
  return shown.map(([section, title, mine], index) => sectionHTML(section, title, mine, now, index === 0)).join("");
}
