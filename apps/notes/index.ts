import { html } from "@ravel/html.ts";
import { state } from "@ravel/offline.ts";
import type { Ctx } from "@ravel/types.ts";
import { joinBody, wantsTitle } from "./format.ts";
import { job } from "@ravel/job.ts";
import { clientScript, clientVersion, styles } from "@ravel/client.ts";
import * as notes from "./db.ts";
import { listTags, queueSweep, tagLabel, tagsOf, toggleTag } from "@app/tags/api.ts";
import { composeButtons, editor, leftBar } from "./view.ts";
import { bar } from "@ravel/nav.ts";
import { richScript, richSignals } from "@app/design-system/api.ts";

const CLIENT = new URL("./notes.client.ts", import.meta.url);
const ID = /^[a-z][a-z0-9]*$/;
const TITLE_DELAY_MS = 20_000; // lets the owner keep typing before a title is written

function noteId(ctx: Ctx): string {
  const id = String(ctx.signals.id ?? "");
  return ID.test(id) ? id : "";
}

export function create(ctx: Ctx) {
  const id = noteId(ctx);
  if (id) notes.addNote("", id, ctx.at);
}

/** The note's whole text arrives as `body` (its first line is the title); an older queued save still sends `title` and `text`. */
export function save(ctx: Ctx) {
  const id = noteId(ctx);
  if (!id) return;
  const body = typeof ctx.signals.body === "string"
    ? ctx.signals.body
    : joinBody({ title: String(ctx.signals.title ?? "").replace(/\n/g, " "), text: String(ctx.signals.text ?? "") });
  notes.upsertNote(id, body, ctx.at);
  if (!body.trim()) return;
  void queueSweep();
  if (wantsTitle(body)) void job.start("notes-title", {}, { once: true, at: new Date(Date.now() + TITLE_DELAY_MS) }).catch(() => {});
}

/** The owner left a note with nothing in it: it goes, unless it carries a tag. */
export function discard(ctx: Ctx) {
  const id = noteId(ctx);
  if (id && !tagsOf("note", id).length) notes.dropIfBlank(id);
}

// Plain action: the owner adds a tag to a note, or takes one off (`on` 0; tag 0 takes them all off). Needs the connection.
export function setTag(ctx: Ctx) {
  const id = String(ctx.query.get("id") ?? ctx.signals.id ?? "");
  const on = String(ctx.query.get("on") ?? ctx.signals.on ?? "1") !== "0";
  if (ID.test(id)) toggleTag("note", id, Number(ctx.query.get("tag") ?? ctx.signals.tag), on);
}

export function pin(ctx: Ctx) {
  const id = noteId(ctx);
  if (id) notes.setPinned(id, ctx.signals.pinned === true);
}

export function trash(ctx: Ctx) {
  const id = noteId(ctx);
  if (id) notes.trashNote(id, ctx.at);
}

export function restore(ctx: Ctx) {
  const id = noteId(ctx);
  if (id) notes.restoreNote(id, ctx.at);
}

export function erase(ctx: Ctx) {
  const id = noteId(ctx);
  if (id) notes.eraseNote(id);
}

function toItem(note: notes.Note) {
  return {
    body: note.body,
    auto: note.auto_title,
    pinned: Boolean(note.pinned),
    trashed: note.deleted_at !== null,
    updated: note.updated_at,
    tags: tagsOf("note", note.id).map((tag) => ({ id: tag.id, label: tagLabel(tag) })),
  };
}

const NOTE_ID = /^[a-z][a-z0-9]*$/;
const blankNote = (at: number) => ({ body: "", auto: "", pinned: false, trashed: false, updated: at, tags: [] });

export default async (ctx: Ctx) => {
  notes.purgeOldTrash();
  notes.eraseNotes(notes.blankNoteIds().filter((id) => !tagsOf("note", id).length));
  const noteId = NOTE_ID.test(ctx.params.id ?? "") ? ctx.params.id : "";
  const inApp = ctx.client === "ios";
  const tags = listTags();
  const items: Record<string, ReturnType<typeof toItem>> = Object.fromEntries(notes.readNotes().map((note) => [note.id, toItem(note)]));
  // A note made a moment ago on this device can open before its create action arrives.
  if (noteId && !items[noteId]) items[noteId] = blankNote(ctx.at);
  const signals = `{open: '', view: 'all', tag: 'all', q: '', fmenu: false, tagmenu: false, ${richSignals}, _build: 0}`;
  // A morphed-in <script> doesn't run, so a changed version makes the page evaluate the new one and redraw.
  const rerun = `(0, eval)(document.getElementById('notes-view').textContent); $_build = ${clientVersion(CLIENT)}`;
  const restoreView = noteId ? `$open = '${noteId}'` : inApp ? "$open = ''" : "const saved = notesView.savedView($_notes); $view = saved.view; $open = saved.open";
  const header = noteId ? bar({ title: "" }) : bar({ title: "Notes", nativeTitle: true });
  return html`
    ${await clientScript(CLIENT, { id: "notes-view" })}
    ${await richScript()}
    ${styles(import.meta.resolve("./notes.css"))}
    <section class="notes-page t-stagger space-y-3" ${state("_notes", items)} data-signals__ifmissing="${signals}">
      <div hidden data-init="${rerun}"></div>
      <div data-init="${restoreView}" ${inApp ? "" : html`data-effect="notesView.saveView($open, $view)"`}></div>
      ${header}
      <div class="grid gap-4 md:grid-cols-[20rem_minmax(0,1fr)]">
        <div class="min-w-0" data-class="{hidden: $open, 'md:block': $open}">${leftBar(tags)}</div>
        <div class="min-w-0" data-class="{hidden: !$open, 'md:block': !$open}">${editor(ctx, tags, Boolean(noteId))}</div>
      </div>
    </section>
    ${composeButtons()}
  `;
};

export const actions = { create, discard, erase, pin, restore, save, setTag, trash };
