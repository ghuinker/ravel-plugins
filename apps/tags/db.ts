import { db, table } from "@ravel/db.ts";

// `heat` is how alive the tag is (set nightly by rank.ts); `pinned` keeps it at the top whatever its heat.
export type Tag = { id: number; name: string; emoji: string; hue: number; created_at: number; heat: number; pinned: number };

// One row per item and tag. "attached": the item has the tag. "suggested": a likely match waiting for a yes/no in the inbox.
export type LinkState = "attached" | "suggested";
export type Source = "ai" | "manual";
export type Link = { kind: string; item_id: string; tag_id: number; state: LinkState; source: Source; confidence: number; updated_at: number };

// One row per item that was looked at, so it is never judged again; only a person changes its tags after that.
// "checked": looked at (it may have no tag). "dismissed": the owner said no to a suggestion, so nothing suggests it again.
export type CheckState = "checked" | "dismissed";
export type Check = { kind: string; item_id: string; state: CheckState; source: Source; updated_at: number };

export type ProposedItem = { kind: string; id: string };
export type Proposal = { id: number; name: string; emoji: string; description: string; items: ProposedItem[]; status: "pending" | "accepted" | "declined"; created_at: number };

const hasColumn = (table: string, column: string) => (db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as { name: string }[]).some((row) => row.name === column);


const TAGS = table(import.meta, "", `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✨',
  hue INTEGER NOT NULL DEFAULT 260,
  created_at INTEGER NOT NULL
`);
const ITEMS = table(import.meta, "items", `
  kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  state TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, item_id, tag_id)
`);
if (!hasColumn(TAGS, "heat")) db.exec(`ALTER TABLE ${TAGS} ADD COLUMN heat REAL NOT NULL DEFAULT 1`);
if (!hasColumn(TAGS, "pinned")) db.exec(`ALTER TABLE ${TAGS} ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
db.exec(`CREATE INDEX IF NOT EXISTS item_tags_by_tag ON ${ITEMS} (tag_id)`);
const CHECKS = table(import.meta, "checks", `
  kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  state TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, item_id)
`);
const PROPOSALS = table(import.meta, "proposals", `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✨',
  description TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
`);

/** Every tag in the order lists and filters show them: pinned first, then the hottest, then by name. */
export function listTags(): Tag[] {
  return db.prepare(`SELECT * FROM ${TAGS} ORDER BY pinned DESC, heat DESC, name COLLATE NOCASE, id`).all() as Tag[];
}

/** A tag nobody has touched in a while sinks into "More"; a pinned tag never does. */
export const DORMANT_BELOW = 0.3;
export const isDormant = (tag: Pick<Tag, "heat" | "pinned">) => !tag.pinned && tag.heat < DORMANT_BELOW;

/** The tags in use right now: the top of the ranking, skipping dormant ones. */
export function recentTags(limit: number): Tag[] {
  return listTags().filter((tag) => !isDormant(tag)).slice(0, limit);
}

export function setHeat(heats: Map<number, number>) {
  const update = db.prepare(`UPDATE ${TAGS} SET heat = ? WHERE id = ?`);
  for (const [id, heat] of heats) update.run(heat, id);
}

export function setPinned(id: number, pinned: boolean) {
  db.prepare(`UPDATE ${TAGS} SET pinned = ? WHERE id = ?`).run(pinned ? 1 : 0, id);
}

export function getTag(id: number): Tag | undefined {
  return db.prepare(`SELECT * FROM ${TAGS} WHERE id = ?`).get(id) as Tag | undefined;
}

export function addTag(fields: { name: string; emoji: string; hue: number }, at = Date.now()): number {
  const result = db.prepare(`INSERT INTO ${TAGS} (name, emoji, hue, created_at) VALUES (?, ?, ?, ?)`).run(fields.name, fields.emoji, fields.hue, at);
  return Number(result.lastInsertRowid);
}

export function renameTag(id: number, name: string) {
  db.prepare(`UPDATE ${TAGS} SET name = ? WHERE id = ?`).run(name, id);
}

/** Deleting a tag takes it off its items. They stay looked at, so they aren't judged all over again. */
export function deleteTag(id: number) {
  db.prepare(`DELETE FROM ${ITEMS} WHERE tag_id = ?`).run(id);
  db.prepare(`DELETE FROM ${TAGS} WHERE id = ?`).run(id);
}

/** Folds one tag into another: its items get the other tag (an item with both keeps one) and it is deleted. */
export function mergeTags(fromId: number, intoId: number, at = Date.now()) {
  if (fromId === intoId) return;
  db.prepare(`UPDATE ${ITEMS} SET state = 'attached', updated_at = ? WHERE tag_id = ? AND state = 'suggested'
    AND EXISTS (SELECT 1 FROM ${ITEMS} f WHERE f.kind = ${ITEMS}.kind AND f.item_id = ${ITEMS}.item_id AND f.tag_id = ? AND f.state = 'attached')`).run(at, intoId, fromId);
  db.prepare(`INSERT OR IGNORE INTO ${ITEMS} (kind, item_id, tag_id, state, source, confidence, updated_at) SELECT kind, item_id, ?, state, source, confidence, ? FROM ${ITEMS} WHERE tag_id = ?`)
    .run(intoId, at, fromId);
  db.prepare(`DELETE FROM ${ITEMS} WHERE tag_id = ?`).run(fromId);
  db.prepare(`DELETE FROM ${TAGS} WHERE id = ?`).run(fromId);
}

export function setHue(id: number, hue: number) {
  db.prepare(`UPDATE ${TAGS} SET hue = ? WHERE id = ?`).run(hue, id);
}

export function setEmoji(id: number, emoji: string) {
  db.prepare(`UPDATE ${TAGS} SET emoji = ? WHERE id = ?`).run(emoji, id);
}

/** Every link an item has, the most confident first. */
export function linksOf(kind: string, itemId: string, state?: LinkState): Link[] {
  const where = state ? "AND state = ?" : "";
  return db.prepare(`SELECT * FROM ${ITEMS} WHERE kind = ? AND item_id = ? ${where} ORDER BY confidence DESC, updated_at, tag_id`)
    .all(...(state ? [kind, itemId, state] : [kind, itemId])) as Link[];
}

export function checkOf(kind: string, itemId: string): Check | undefined {
  return db.prepare(`SELECT * FROM ${CHECKS} WHERE kind = ? AND item_id = ?`).get(kind, itemId) as Check | undefined;
}

function setCheck(kind: string, itemId: string, state: CheckState, source: Source, at: number) {
  db.prepare(
    `INSERT INTO ${CHECKS} (kind, item_id, state, source, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(kind, item_id) DO UPDATE SET state = excluded.state, source = excluded.source, updated_at = excluded.updated_at`,
  ).run(kind, itemId, state, source, at);
}

function setLink(kind: string, itemId: string, tagId: number, link: { state: LinkState; source: Source; confidence: number }, at: number) {
  db.prepare(
    `INSERT INTO ${ITEMS} (kind, item_id, tag_id, state, source, confidence, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind, item_id, tag_id) DO UPDATE SET state = excluded.state, source = excluded.source, confidence = excluded.confidence, updated_at = excluded.updated_at`,
  ).run(kind, itemId, tagId, link.state, link.source, link.confidence, at);
}

/** The owner gives an item a tag (also how a suggestion is accepted). The item's other tags stay. */
export function attach(kind: string, itemId: string, tagId: number, at = Date.now()) {
  setLink(kind, itemId, tagId, { state: "attached", source: "manual", confidence: 1 }, at);
  setCheck(kind, itemId, "checked", "manual", at);
}

/** The owner takes one tag off an item; it is not judged again. */
export function detach(kind: string, itemId: string, tagId: number, at = Date.now()) {
  db.prepare(`DELETE FROM ${ITEMS} WHERE kind = ? AND item_id = ? AND tag_id = ?`).run(kind, itemId, tagId);
  setCheck(kind, itemId, "checked", "manual", at);
}

/** The owner takes every tag off an item; it stays out. */
export function detachAll(kind: string, itemId: string, at = Date.now()) {
  db.prepare(`DELETE FROM ${ITEMS} WHERE kind = ? AND item_id = ?`).run(kind, itemId);
  setCheck(kind, itemId, "checked", "manual", at);
}

/** The owner says no to what was suggested for an item: the suggestions go and nothing suggests it again. */
export function dismiss(kind: string, itemId: string, at = Date.now()) {
  db.prepare(`DELETE FROM ${ITEMS} WHERE kind = ? AND item_id = ? AND state = 'suggested'`).run(kind, itemId);
  setCheck(kind, itemId, "dismissed", "manual", at);
}

/** Claude's one look at an item, whatever it found (no tags is an answer too). Never touches an item that was looked at already. */
export function recordJudgment(kind: string, itemId: string, tags: { tagId: number; state: LinkState; confidence: number }[], at = Date.now()) {
  if (checkOf(kind, itemId)) return;
  for (const tag of tags) setLink(kind, itemId, tag.tagId, { state: tag.state, source: "ai", confidence: tag.confidence }, at);
  setCheck(kind, itemId, "checked", "ai", at);
}

export function linksIn(tagId: number, state: LinkState = "attached"): Link[] {
  return db.prepare(`SELECT * FROM ${ITEMS} WHERE tag_id = ? AND state = ? ORDER BY updated_at DESC`).all(tagId, state) as Link[];
}

/** Every "kind:id" that has been looked at already. */
export function checkedKeys(): Set<string> {
  const rows = db.prepare(`SELECT kind, item_id FROM ${CHECKS}`).all() as { kind: string; item_id: string }[];
  return new Set(rows.map((row) => `${row.kind}:${row.item_id}`));
}

/** Items that were looked at and have no tag or suggestion, and that the owner hasn't dismissed. */
export function unhomedKeys(): Set<string> {
  const rows = db.prepare(
    `SELECT kind, item_id FROM ${CHECKS} WHERE state = 'checked'
     AND NOT EXISTS (SELECT 1 FROM ${ITEMS} t WHERE t.kind = ${CHECKS}.kind AND t.item_id = ${CHECKS}.item_id)`,
  ).all() as { kind: string; item_id: string }[];
  return new Set(rows.map((row) => `${row.kind}:${row.item_id}`));
}

const toProposal = (row: Omit<Proposal, "items"> & { items: string }): Proposal => ({ ...row, items: JSON.parse(row.items) });

export function addProposal(proposal: { name: string; emoji: string; description: string; items: ProposedItem[] }, at = Date.now()) {
  db.prepare(`INSERT INTO ${PROPOSALS} (name, emoji, description, items, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(proposal.name, proposal.emoji, proposal.description, JSON.stringify(proposal.items), at);
}

export function proposals(status: Proposal["status"]): Proposal[] {
  const rows = db.prepare(`SELECT * FROM ${PROPOSALS} WHERE status = ? ORDER BY id`).all(status) as (Omit<Proposal, "items"> & { items: string })[];
  return rows.map(toProposal);
}

export function getProposal(id: number): Proposal | undefined {
  const row = db.prepare(`SELECT * FROM ${PROPOSALS} WHERE id = ?`).get(id) as (Omit<Proposal, "items"> & { items: string }) | undefined;
  return row && toProposal(row);
}

export function setProposalStatus(id: number, status: Proposal["status"]) {
  db.prepare(`UPDATE ${PROPOSALS} SET status = ? WHERE id = ?`).run(status, id);
}
