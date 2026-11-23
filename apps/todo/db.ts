import { db, ensureColumn, table } from "@ravel/db.ts";
import { newId } from "@ravel/offline.ts";
import { nextDue } from "./dates.ts";

export type Todo = {
  id: string;
  body: string;
  done: number;
  due: string;
  soft: number;
  repeat: string;
  priority: number;
  notes: string;
  images: string;
  created_at: number;
  updated_at: number;
  lane: Lane;
  auto: number;
  source: string;
  ref: string;
  href: string;
  tick: number;
};

export type Lane = "unsorted" | "soon" | "someday";

// An undated task is "unsorted" until Claude or the owner puts it in Today ("soon") or Someday. `auto` marks Claude's choice.
export type Fields = { body: string; done: boolean; due: string; soft: boolean; repeat: string; priority: number; notes: string; lane: Lane; auto: boolean; images?: string[] };

const DONE_KEPT_DAYS = 30;
const DAY_MS = 86_400_000;
const NORMAL = 1;

const TODO = table(import.meta, "", "id TEXT PRIMARY KEY, body TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0");
ensureColumn(TODO, "due", "TEXT NOT NULL DEFAULT ''");
ensureColumn(TODO, "soft", "INTEGER NOT NULL DEFAULT 0");
ensureColumn(TODO, "repeat", "TEXT NOT NULL DEFAULT ''");
ensureColumn(TODO, "priority", `INTEGER NOT NULL DEFAULT ${NORMAL}`);
ensureColumn(TODO, "notes", "TEXT NOT NULL DEFAULT ''");
ensureColumn(TODO, "images", "TEXT NOT NULL DEFAULT '[]'"); // JSON array of private/uploads paths
ensureColumn(TODO, "created_at", "INTEGER NOT NULL DEFAULT 0");
ensureColumn(TODO, "lane", "TEXT NOT NULL DEFAULT 'someday'");
ensureColumn(TODO, "auto", "INTEGER NOT NULL DEFAULT 0");
// A linked task belongs to another app (`source`, e.g. "planit"; `ref` is its id there). That app creates and finishes it; `href` is where it opens.
// `tick` means the checkbox here works too, by asking the owning app (see linked.ts).
ensureColumn(TODO, "source", "TEXT NOT NULL DEFAULT ''");
ensureColumn(TODO, "ref", "TEXT NOT NULL DEFAULT ''");
ensureColumn(TODO, "href", "TEXT NOT NULL DEFAULT ''");
ensureColumn(TODO, "tick", "INTEGER NOT NULL DEFAULT 0");
// `split_check` marks a task that came in as several lines: the sort job asks Claude once whether it is one task or a list (see triage.ts).
ensureColumn(TODO, "split_check", "INTEGER NOT NULL DEFAULT 0");
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS todos_linked ON ${TODO} (source, ref) WHERE source != ''`);

// The page keeps tasks in a list keyed by id, so an id must be lowercase letters and digits starting with a letter.
// This stops any writer (including raw SQL) from adding one that would break the page.
const BAD_ID = "NEW.id NOT GLOB '[a-z]*' OR NEW.id GLOB '*[^a-z0-9]*'";
const BAD_ID_MESSAGE = `${TODO}.id must be lowercase letters and digits starting with a letter: use newId() from @ravel/offline.ts`;
for (const [name, when] of [["insert", "INSERT"], ["update", "UPDATE OF id"]]) {
  db.exec(`CREATE TRIGGER IF NOT EXISTS todos_good_id_${name} BEFORE ${when} ON ${TODO} WHEN ${BAD_ID} BEGIN SELECT RAISE(ABORT, '${BAD_ID_MESSAGE}'); END`);
}

export function listTodos(): Todo[] {
  return db.prepare(`SELECT * FROM ${TODO} ORDER BY done, priority DESC, rowid DESC`).all() as Todo[];
}

const SUBTASK_LINE = /^\s*(?:[-*]\s+)?\[[ xX]\]/;

export function addTodo(body: string, id = newId(), at = Date.now(), extra: Partial<Fields> & { created?: number } = {}) {
  const lane = extra.lane ?? "someday";
  const notes = extra.notes ?? "";
  // Notes with text beyond subtask checkboxes on a new unsorted task may be a pasted list.
  const splitCheck = lane === "unsorted" && notes.split("\n").some((line) => line.trim() && !SUBTASK_LINE.test(line)) ? 1 : 0;
  db.prepare(
    `INSERT OR IGNORE INTO ${TODO} (id, body, due, soft, repeat, priority, notes, lane, auto, created_at, updated_at, split_check, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, body, extra.due ?? "", extra.soft ? 1 : 0, extra.repeat ?? "", extra.priority ?? NORMAL, notes, lane, extra.auto ? 1 : 0, extra.created ?? at, at, splitCheck, JSON.stringify(extra.images ?? []));
}

// An older change arriving late (from a device that was offline) loses to a newer one.
export function saveTodo(id: string, fields: Fields, at: number) {
  db.prepare(
    `UPDATE ${TODO} SET body = CASE WHEN source = '' THEN ? ELSE body END, done = CASE WHEN source = '' THEN ? ELSE done END, due = ?, soft = ?,
     repeat = CASE WHEN source = '' THEN ? ELSE '' END, priority = ?, notes = ?, lane = ?, auto = ?, images = ?, updated_at = ? WHERE id = ? AND updated_at <= ?`,
  ).run(fields.body, fields.done ? 1 : 0, fields.due, fields.soft ? 1 : 0, fields.repeat, fields.priority, fields.notes, fields.lane, fields.auto ? 1 : 0, JSON.stringify(fields.images ?? []), at, id, at);
}

export function removeTodo(id: string) {
  db.prepare(`DELETE FROM ${TODO} WHERE id = ?`).run(id);
}

export function purgeOldDone(now = Date.now()) {
  db.prepare(`DELETE FROM ${TODO} WHERE done = 1 AND updated_at < ?`).run(now - DONE_KEPT_DAYS * DAY_MS);
}

const HIGH = 2;
const TRIAGE_BATCH = 30;
const TODAY_CONTEXT = 30;

/** Open tasks with no date that nobody has placed yet, oldest first. */
export function listUnsorted(): Pick<Todo, "id" | "body" | "notes">[] {
  return db.prepare(`SELECT id, body, notes FROM ${TODO} WHERE lane = 'unsorted' AND done = 0 AND due = '' AND priority < ? AND split_check = 0 ORDER BY created_at, rowid LIMIT ?`)
    .all(HIGH, TRIAGE_BATCH) as Pick<Todo, "id" | "body" | "notes">[];
}

/** New unsorted tasks that came in as several lines and haven't been checked yet. */
export function listSplitChecks(): Pick<Todo, "id" | "body" | "notes">[] {
  return db.prepare(`SELECT id, body, notes FROM ${TODO} WHERE split_check = 1 AND lane = 'unsorted' AND done = 0 ORDER BY created_at, rowid LIMIT ?`)
    .all(TRIAGE_BATCH) as Pick<Todo, "id" | "body" | "notes">[];
}

/** Keeps a checked task as it is. */
export function clearSplitCheck(id: string) {
  db.prepare(`UPDATE ${TODO} SET split_check = 0 WHERE id = ?`).run(id);
}

/** Replaces a pasted list with its tasks: the first rewrites the original, the rest are new. Nothing changes if the owner already moved or finished the original. */
export function replaceWithTasks(id: string, parts: (Partial<Fields> & { body: string; created?: number })[], now = Date.now()): boolean {
  const [first, ...rest] = parts;
  db.exec("BEGIN");
  try {
    const changed = db.prepare(
      `UPDATE ${TODO} SET body = ?, notes = ?, priority = ?, due = ?, soft = ?, repeat = ?, lane = ?, split_check = 0, updated_at = MAX(?, updated_at + 1)
       WHERE id = ? AND lane = 'unsorted' AND done = 0 AND split_check = 1`,
    ).run(first.body, first.notes ?? "", first.priority ?? NORMAL, first.due ?? "", first.soft ? 1 : 0, first.repeat ?? "", first.lane ?? "unsorted", now, id).changes;
    if (!changed) {
      db.exec("ROLLBACK");
      return false;
    }
    for (const part of rest) addTodo(part.body, newId(), now, { ...part, created: part.created ?? now });
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Titles of what's already in Today, so a second opinion can judge how full it is. */
export function todayTitles(today: string): string[] {
  const rows = db.prepare(
    `SELECT body FROM ${TODO} WHERE done = 0 AND ((due != '' AND due <= ?) OR (due = '' AND (lane = 'soon' OR priority = ?))) ORDER BY rowid DESC LIMIT ?`,
  ).all(today, HIGH, TODAY_CONTEXT) as { body: string }[];
  return rows.map((row) => row.body);
}

/** Places tasks Claude chose. A task the owner placed in the meantime keeps their choice. */
export function placeUnsorted(placements: { id: string; lane: Lane }[]) {
  const place = db.prepare(`UPDATE ${TODO} SET lane = ?, auto = 1, updated_at = MAX(?, updated_at + 1) WHERE id = ? AND lane = 'unsorted'`);
  for (const { id, lane } of placements) place.run(lane, Date.now(), id);
}

/** Open tasks in the Today section: due today or overdue, or undated and high priority or placed in Today. */
export function listTodayTasks(today: string): Pick<Todo, "id" | "body" | "due" | "priority" | "notes">[] {
  return db.prepare(
    `SELECT id, body, due, priority, notes FROM ${TODO} WHERE done = 0 AND ((due != '' AND due <= ?) OR (due = '' AND (lane = 'soon' OR priority = ?)))
     ORDER BY priority DESC, due = '', due, rowid DESC`,
  ).all(today, HIGH) as Pick<Todo, "id" | "body" | "due" | "priority" | "notes">[];
}

/** Open tasks with a date after today, soonest first. */
export function listUpcomingTasks(today: string, limit: number): Pick<Todo, "id" | "body" | "due" | "soft">[] {
  return db.prepare(
    `SELECT id, body, due, soft FROM ${TODO} WHERE done = 0 AND due > ? ORDER BY due, priority DESC, rowid DESC LIMIT ?`,
  ).all(today, limit) as Pick<Todo, "id" | "body" | "due" | "soft">[];
}

/** Tasks checked off since a moment (ms). A repeating task moves to its next date instead, so it isn't counted. */
export function countDoneSince(since: number): number {
  return (db.prepare(`SELECT COUNT(*) AS total FROM ${TODO} WHERE done = 1 AND updated_at >= ?`).get(since) as { total: number }).total;
}

/** Titles of tasks checked off from a moment (ms) up to another, newest first. */
export function listDoneSince(since: number, limit: number, until = Number.MAX_SAFE_INTEGER): string[] {
  const rows = db.prepare(`SELECT body FROM ${TODO} WHERE done = 1 AND updated_at >= ? AND updated_at < ? ORDER BY updated_at DESC LIMIT ?`).all(since, until, limit) as { body: string }[];
  return rows.map((row) => row.body);
}

/** Moves open tasks to a date, or to Someday when `due` is empty. Bumps `updated_at` so devices that were offline pick it up. */
export function moveTasks(ids: string[], due: string, now = Date.now()): number {
  const move = db.prepare(
    due
      ? `UPDATE ${TODO} SET due = ?, soft = 0, updated_at = MAX(?, updated_at + 1) WHERE id = ? AND done = 0`
      : `UPDATE ${TODO} SET due = '', soft = 0, lane = 'someday', auto = 0, updated_at = MAX(?, updated_at + 1) WHERE id = ? AND done = 0`,
  );
  let moved = 0;
  for (const id of ids) moved += Number((due ? move.run(due, now, id) : move.run(now, id)).changes);
  return moved;
}

/** Which of these task ids exist (done or not). */
export function existingTaskIds(ids: string[]): Set<string> {
  const find = db.prepare(`SELECT 1 FROM ${TODO} WHERE id = ?`);
  return new Set(ids.filter((id) => find.get(id) !== undefined));
}

/** The ids among `ids` that are open tasks, whatever their date. */
export function openTaskIds(ids: string[]): Set<string> {
  const find = db.prepare(`SELECT 1 FROM ${TODO} WHERE id = ? AND done = 0`);
  return new Set(ids.filter((id) => find.get(id) !== undefined));
}

/** Checks a task off the way the Todo page does: a repeating one moves to its next date and clears its subtasks instead of finishing. Null when it isn't an open task. */
export function completeTask(id: string, today: string, now = Date.now()): "done" | "moved" | null {
  const task = db.prepare(`SELECT repeat, due, notes FROM ${TODO} WHERE id = ? AND done = 0 AND source = ''`).get(id) as Pick<Todo, "repeat" | "due" | "notes"> | undefined;
  if (!task) return null;
  if (task.repeat) {
    db.prepare(`UPDATE ${TODO} SET due = ?, notes = ?, updated_at = MAX(?, updated_at + 1) WHERE id = ?`)
      .run(nextDue(task.repeat, task.due, today), task.notes.replace(/\[[xX]\]/g, "[ ]"), now, id);
    return "moved";
  }
  db.prepare(`UPDATE ${TODO} SET done = 1, updated_at = MAX(?, updated_at + 1) WHERE id = ?`).run(now, id);
  return "done";
}

const SAFE_HREF = /^\/(?!\/)[\w\-/?=&.%]*$/;

export type LinkedTask = { ref: string; body: string; href: string; due?: string; lane?: Lane; priority?: number; tick?: boolean };

/**
 * An app says which tasks it wants in the list right now (`wanted`). New ones are added; an existing one gets the app's title and link
 * (and its date, when the app gives one) and is reopened if it had been finished; the owner's own lane, priority and notes stay.
 * Open ones the app no longer wants are checked off. Safe to run as often as you like.
 */
export function syncLinkedTasks(source: string, wanted: LinkedTask[], now = Date.now()) {
  const find = db.prepare(`SELECT id, body, href, due, done, tick FROM ${TODO} WHERE source = ? AND ref = ?`);
  const update = db.prepare(
    `UPDATE ${TODO} SET body = ?, href = ?, due = ?, tick = ?, done = 0, updated_at = MAX(?, updated_at + 1) WHERE id = ?`,
  );
  const finish = db.prepare(`UPDATE ${TODO} SET done = 1, updated_at = MAX(?, updated_at + 1) WHERE source = ? AND ref = ? AND done = 0`);
  db.exec("BEGIN");
  try {
    for (const task of wanted) {
      if (!SAFE_HREF.test(task.href)) throw new Error(`linked task link must be a path on this site: ${task.href}`);
      const found = find.get(source, task.ref) as Pick<Todo, "id" | "body" | "href" | "due" | "done" | "tick"> | undefined;
      const tick = task.tick ? 1 : 0;
      if (!found) {
        const id = newId();
        addTodo(task.body, id, now, { due: task.due, lane: task.lane ?? "soon", priority: task.priority });
        db.prepare(`UPDATE ${TODO} SET source = ?, ref = ?, href = ?, tick = ? WHERE id = ?`).run(source, task.ref, task.href, tick, id);
        continue;
      }
      const due = task.due || found.due;
      if (found.done || found.body !== task.body || found.href !== task.href || found.due !== due || found.tick !== tick) update.run(task.body, task.href, due, tick, now, found.id);
    }
    const keep = new Set(wanted.map((task) => task.ref));
    const open = db.prepare(`SELECT ref FROM ${TODO} WHERE source = ? AND done = 0`).all(source) as { ref: string }[];
    for (const { ref } of open) if (!keep.has(ref)) finish.run(now, source, ref);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function linkedTask(id: string): Pick<Todo, "source" | "ref" | "tick" | "done"> | undefined {
  return db.prepare(`SELECT source, ref, tick, done FROM ${TODO} WHERE id = ? AND source != ''`).get(id) as Pick<Todo, "source" | "ref" | "tick" | "done"> | undefined;
}

/** The tasks with these ids (missing ones are skipped), in the order given. */
export function getTodos(ids: string[]): Todo[] {
  const find = db.prepare(`SELECT * FROM ${TODO} WHERE id = ?`);
  return ids.map((id) => find.get(id) as Todo | undefined).filter((todo): todo is Todo => todo !== undefined);
}

/** Puts a finished task back on the list. */
export function reopenTask(id: string, now = Date.now()) {
  db.prepare(`UPDATE ${TODO} SET done = 0, updated_at = MAX(?, updated_at + 1) WHERE id = ? AND done = 1 AND source = ''`).run(now, id);
}

/** Replaces a task's notes and, when `done` is given, whether it's done. For apps that keep a checklist in a task they made. */
export function setTaskNotes(id: string, notes: string, done?: boolean, now = Date.now()) {
  db.prepare(`UPDATE ${TODO} SET notes = ?, done = COALESCE(?, done), updated_at = MAX(?, updated_at + 1) WHERE id = ?`)
    .run(notes, done === undefined ? null : done ? 1 : 0, now, id);
}

/** When the newest finished task with a tag was finished (the time it was last saved as done), for "days since" counters. */
export const lastDoneWithTag = (tagId: number): number | null =>
  (db.prepare("SELECT MAX(todo.updated_at) AS at FROM todo JOIN tags_items ON tags_items.kind = 'todo' AND tags_items.item_id = todo.id WHERE todo.done = 1 AND tags_items.tag_id = ? AND tags_items.state = 'attached'").get(tagId) as { at: number | null }).at;
