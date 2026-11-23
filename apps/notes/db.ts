import { db, table } from "@ravel/db.ts";
import { newId } from "@ravel/offline.ts";

const TRASH_DAYS = 30;
const DAY_MS = 86_400_000;

const NOTES = table(import.meta, "", `
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  folder_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
`);
if (!(db.prepare(`PRAGMA table_info(${NOTES})`).all() as { name: string }[]).some((column) => column.name === "auto_title")) {
  db.exec(`ALTER TABLE ${NOTES} ADD COLUMN auto_title TEXT NOT NULL DEFAULT ''`);
}
// Folders were removed from the app (tags replace them); the `folder_id` column is left alone so no data is lost.

export type Note = { id: string; body: string; pinned: number; updated_at: number; deleted_at: number | null; auto_title: string };

export function purgeOldTrash(now = Date.now()) {
  db.prepare(`DELETE FROM ${NOTES} WHERE deleted_at < ?`).run(now - TRASH_DAYS * DAY_MS);
}

export function readNotes(): Note[] {
  return db.prepare(`SELECT id, body, pinned, updated_at, deleted_at, auto_title FROM ${NOTES} ORDER BY rowid`).all() as Note[];
}

export function readNote(id: string): Note | undefined {
  return db.prepare(`SELECT id, body, pinned, updated_at, deleted_at, auto_title FROM ${NOTES} WHERE id = ?`).get(id) as Note | undefined;
}

export function addNote(body: string, id = newId(), at = Date.now()) {
  db.prepare(`INSERT OR IGNORE INTO ${NOTES} (id, body, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(id, body, at, at);
}

/** Saves a note's text, making the note on the first save that has any. A blank note is never made, so opening a new note and leaving costs nothing. */
export function upsertNote(id: string, body: string, at: number) {
  if (body.trim()) addNote("", id, at);
  saveNote(id, body, at);
}

/** Removes a note that has been emptied, unless it is pinned or trashed. Returns whether it went. */
export function dropIfBlank(id: string): boolean {
  return db.prepare(`DELETE FROM ${NOTES} WHERE id = ? AND TRIM(body) = '' AND pinned = 0 AND deleted_at IS NULL`).run(id).changes > 0;
}

/** Blank notes left behind (by older versions, or an emptied note whose cleanup never arrived). */
export function blankNoteIds(): string[] {
  return (db.prepare(`SELECT id FROM ${NOTES} WHERE TRIM(body) = '' AND pinned = 0 AND deleted_at IS NULL`).all() as { id: string }[]).map((row) => row.id);
}

export function eraseNotes(ids: string[]) {
  for (const id of ids) db.prepare(`DELETE FROM ${NOTES} WHERE id = ?`).run(id);
}

export function setAutoTitle(id: string, title: string) {
  db.prepare(`UPDATE ${NOTES} SET auto_title = ? WHERE id = ?`).run(title, id);
}

/** Notes with enough text and no short first line that have not been given a title yet. */
export function untitled(): Pick<Note, "id" | "body">[] {
  return (db.prepare(`SELECT id, body FROM ${NOTES} WHERE auto_title = '' AND deleted_at IS NULL`).all() as Pick<Note, "id" | "body">[]);
}

// An edit made earlier on a device that was offline loses to a newer one.
export function saveNote(id: string, body: string, at: number) {
  db.prepare(`UPDATE ${NOTES} SET body = ?, updated_at = ? WHERE id = ? AND body != ? AND updated_at <= ? AND deleted_at IS NULL`).run(body, at, id, body, at);
}

export function setPinned(id: string, pinned: boolean) {
  db.prepare(`UPDATE ${NOTES} SET pinned = ? WHERE id = ?`).run(pinned ? 1 : 0, id);
}

export function trashNote(id: string, at: number) {
  db.prepare(`UPDATE ${NOTES} SET deleted_at = ?, updated_at = ?, pinned = 0 WHERE id = ? AND deleted_at IS NULL`).run(at, at, id);
}

export function restoreNote(id: string, at = Date.now()) {
  db.prepare(`UPDATE ${NOTES} SET deleted_at = NULL, updated_at = ? WHERE id = ?`).run(at, id);
}

export function eraseNote(id: string) {
  db.prepare(`DELETE FROM ${NOTES} WHERE id = ? AND deleted_at IS NOT NULL`).run(id);
}

export function noteTotal(): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM ${NOTES} WHERE deleted_at IS NULL`).get() as { count: number }).count;
}

/** Newest notes first, pinned ones before the rest. Trashed notes are left out. */
export function recentNotes(limit: number): Pick<Note, "id" | "body" | "pinned" | "updated_at">[] {
  return db.prepare(`SELECT id, body, pinned, updated_at FROM ${NOTES} WHERE deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC LIMIT ?`)
    .all(limit) as Pick<Note, "id" | "body" | "pinned" | "updated_at">[];
}
