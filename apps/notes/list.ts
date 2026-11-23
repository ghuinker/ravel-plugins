// The notes list in the browser (bundled by notes.client.ts as `notesView`): rendering, filtering and editing the open note.
import { dateGroup, firstLineLong, isBlank, longDate, notePreview, noteTitle, shortDate, splitBody } from "./format.ts";
import { escapeHtml, list, section } from "@app/design-system/api.ts";
import { countTag, itemHasTag, itemNoTags, itemTagNames, matchesTag, type PickedTag, pickTag } from "../../lib/tag-pick.ts";

/** A note as the page holds it in `$_notes` (see `toItem` in index.ts). */
export type NoteItem = {
  /** The whole text: its first line is the title. */
  body: string;
  /** A title written for a note with no short first line. */
  auto?: string;
  pinned: boolean;
  trashed: boolean;
  updated: number;
  tags?: PickedTag[];
  gone?: boolean;
  /** The server may hold this note (it had text once). */
  sent?: boolean;
};
export type Notes = Record<string, NoteItem>;

const PINNED = "Pinned";
const ID = /^[a-z][a-z0-9]*$/;
const VIEW_KEY = "notes.view";

/** A field of the open note, or undefined. Reading $_notes[id] for a missing id would create it. */
export function field<K extends keyof NoteItem>(notes: Notes, open: string, name: K): NoteItem[K] | undefined {
  Object.keys(notes);
  if (!open || !Object.hasOwn(notes, open) || notes[open].gone) return undefined;
  return notes[open][name];
}

export function edit<K extends keyof NoteItem>(notes: Notes, open: string, name: K, value: NoteItem[K]) {
  if (field(notes, open, name) === undefined || notes[open][name] === value) return;
  notes[open][name] = value;
  notes[open].updated = Date.now();
  if (name === "body" && !isBlank(String(value))) notes[open].sent = true;
}

/** A note shown in the list and counted: not deleted from the page, and with something in it. */
const shown = (note: NoteItem) => !note.gone && !isBlank(note.body);

/** Opening a note and leaving it again with nothing in it removes it. Returns whether the server may hold it (so it needs telling). */
export function dropBlank(notes: Notes, id: string) {
  if (!id || field(notes, id, "body") === undefined) return false;
  const note = notes[id];
  if (!isBlank(note.body) || note.pinned || note.trashed || note.tags?.length) return false;
  note.gone = true;
  return Boolean(note.sent);
}

let lastOpen = "";
/** Called as the open note changes: returns the id of the note just left if it was empty and had reached the server, else "". */
export function leaving(notes: Notes, open: string) {
  const old = lastOpen;
  if (old === open) return "";
  lastOpen = open;
  return dropBlank(notes, old) ? old : "";
}

/** The text with a title line put on top: the written title when there is one, otherwise an empty line to type it in. */
export function addTitle(notes: Notes, open: string) {
  const body = field(notes, open, "body");
  if (body === undefined) return;
  edit(notes, open, "body", `${notes[open].auto ?? ""}\n${body}`);
}

/** Whether the open note's first line is a paragraph, so it has no title of its own. */
export function longFirst(notes: Notes, open: string) {
  return firstLineLong(field(notes, open, "body") ?? "");
}

export { firstLineLong };

/** `view` is "all" (every note that isn't deleted) or "trash". */
export function inView(note: Pick<NoteItem, "trashed">, view: string) {
  return view === "trash" ? note.trashed : !note.trashed;
}

export function count(notes: Notes, view: string) {
  return Object.values(notes).filter((note) => shown(note) && inView(note, view)).length;
}

/** How many notes (not deleted) carry a tag; 0 counts the untagged ones. */
export function tagCount(notes: Notes, tag: string | number) {
  return countTag(Object.values(notes).filter((note) => shown(note) && inView(note, "all")), tag);
}

/** `tag` is "all", 0 (no tag) or a tag id; a note with several tags shows under each. */
function matches(note: NoteItem, query: string, tag: string | number = "all") {
  if (!matchesTag(note, tag)) return false;
  return !query || `${note.auto ?? ""}\n${note.body}`.toLowerCase().includes(query);
}

/** Shows a tag toggled on the note right away (see `pickTag`); the server saves it. */
export function toggleTag(notes: Notes, id: string, tagId: number, label: string, max: number) {
  return field(notes, id, "body") === undefined ? "full" : pickTag(notes[id], tagId, label, max);
}

export function hasTag(notes: Notes, id: string, tagId: number) {
  return typeof notes[id] === "object" && itemHasTag(notes[id], tagId);
}
export function noTags(notes: Notes, id: string) {
  return typeof notes[id] === "object" && itemNoTags(notes[id]);
}
export function tagValue(notes: Notes, id: string) {
  return itemTagNames(notes[id]);
}

const PIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-4 top-3.5 size-3.5 opacity-70" aria-label="Pinned"><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>`;

/** `gutter`: the list has pinned notes, so every title leaves room for the pin icon, like iOS Notes. */
function row(id: string, note: NoteItem, open: string, now: Date, gutter: boolean, withTags: boolean) {
  const { title, text } = splitBody(note.body);
  const written = note.auto && firstLineLong(note.body) ? note.auto : "";
  const heading = written || noteTitle(title);
  const preview = notePreview(written ? note.body : text);
  return `<a href="/notes/${id}" data-on:click="ravel.haptic('tap'); evt.preventDefault(); $open = '${id}'" class="notes-row block w-full min-w-0 py-3 ${gutter ? "pl-11" : "pl-4"} pr-4 text-left ${id === open ? "t-active" : "t-hover"}">
    ${note.pinned ? PIN_ICON : ""}
    <div class="truncate font-semibold">${escapeHtml(heading)}</div>
    <div class="flex gap-2 text-sm opacity-70"><span class="shrink-0">${escapeHtml(shortDate(new Date(note.updated), now))}</span><span class="truncate">${escapeHtml(preview)}</span></div>
    ${withTags && note.tags?.length ? `<div class="mt-1 flex flex-wrap gap-1">${note.tags.map((tag) => `<span class="rounded-full t-pill t-accent-tint px-2.5 py-0.5 text-[11px] font-medium">${escapeHtml(tag.label)}</span>`).join("")}</div>` : ""}
  </a>`;
}

export function listHTML(notes: Notes, view: string, q: string, open: string, now = new Date(), tag: string | number = "all") {
  const query = q.trim().toLowerCase();
  const found = Object.entries(notes)
    .filter(([id, note]) => ID.test(id) && shown(note) && inView(note, view) && matches(note, query, tag))
    .sort(([, a], [, b]) => Number(b.pinned) - Number(a.pinned) || b.updated - a.updated);
  if (!found.length) {
    const empty = query ? "No results." : view === "trash" ? "Nothing deleted." : "No notes yet.";
    return `<p class="px-3 t-muted">${empty}</p>`;
  }
  const gutter = found.some(([, note]) => note.pinned);
  const groups = new Map<string, string[]>();
  for (const [id, note] of found) {
    const label = note.pinned ? PINNED : query ? "Results" : dateGroup(new Date(note.updated), now);
    groups.set(label, [...(groups.get(label) ?? []), row(id, note, open, now, gutter, tag !== "all")]);
  }
  return [...groups].map(([label, rows]) => section(label, list(rows)).value).join("");
}

export function editedAt(notes: Notes, open: string) {
  const updated = field(notes, open, "updated");
  return updated ? longDate(new Date(updated)) : "";
}

export function savedView(notes: Notes) {
  let saved: { view?: string; folder?: string; open?: string } = {};
  try {
    saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}");
  } catch {}
  return { view: saved.view === "trash" || saved.folder === "trash" ? "trash" : "all", open: field(notes, saved.open ?? "", "body") === undefined ? "" : saved.open };
}

export function saveView(open: string, view: string) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({ open, view }));
  } catch {}
}
