import { db, table } from "@ravel/db.ts";

// What the owner and the summary job add to a chat. The chat files themselves are never touched: "hidden" only keeps a chat out of the list.
const META = table(import.meta, "meta", `
  chat_id TEXT PRIMARY KEY,
  pinned INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  summary_messages INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
`);

export type ChatMeta = { chat_id: string; pinned: number; hidden: number; summary: string; summary_messages: number; updated_at: number };

// Chat ids are UUIDv7: the only shape that may reach SQL or markup.
export const isChatId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

export function allMeta(): Map<string, ChatMeta> {
  const rows = db.prepare(`SELECT * FROM ${META}`).all() as ChatMeta[];
  return new Map(rows.map((row) => [row.chat_id, row]));
}

const touch = (id: string) => db.prepare(`INSERT OR IGNORE INTO ${META} (chat_id) VALUES (?)`).run(id);

export function setPinned(id: string, pinned: boolean) {
  if (!isChatId(id)) return;
  touch(id);
  db.prepare(`UPDATE ${META} SET pinned = ?, updated_at = ? WHERE chat_id = ?`).run(pinned ? 1 : 0, Date.now(), id);
}

export function setHidden(id: string, hidden: boolean) {
  if (!isChatId(id)) return;
  touch(id);
  db.prepare(`UPDATE ${META} SET hidden = ?, pinned = CASE WHEN ? = 1 THEN 0 ELSE pinned END, updated_at = ? WHERE chat_id = ?`).run(hidden ? 1 : 0, hidden ? 1 : 0, Date.now(), id);
}

/** `messages` is how many messages the chat had when it was summarized, so the job can tell when it has grown. */
export function saveSummary(id: string, summary: string, messages: number) {
  if (!isChatId(id)) return;
  touch(id);
  db.prepare(`UPDATE ${META} SET summary = ?, summary_messages = ?, updated_at = ? WHERE chat_id = ?`).run(summary, messages, Date.now(), id);
}
