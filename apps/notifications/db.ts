import { db, table } from "@ravel/db.ts";
import { state, userZone } from "@app/settings/api.ts";
import { settings } from "./settings.ts";
import { decide, type GateState, type Verdict } from "./rules.ts";
import { type NotificationType, typeById } from "./types.ts";
import { hourIn } from "../../lib/time.ts";

const LOG = table(import.meta, "log", "id INTEGER PRIMARY KEY, at INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, sent INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT ''");

const KEEP = 300;
const kv = state(import.meta);
const key = (id: string) => `type.${id}`;

/** Per-type switch, or the type's default. */
export function typeEnabled(type: NotificationType): boolean {
  const saved = kv.get(key(type.id));
  return saved !== undefined ? saved === "1" : type.fallback;
}

export async function setTypeEnabled(id: string, on: boolean): Promise<boolean> {
  const type = await typeById(id);
  if (!type || type.asked) return false;
  kv.set(key(id), on ? "1" : "0");
  return true;
}

const stateAt = (at: number): GateState => ({
  paused: !settings.get("on"),
  quiet: settings.get("quiet"),
  quietStart: settings.get("quietStart"),
  quietEnd: settings.get("quietEnd"),
  hour: hourIn(userZone(), at),
  typeOn: typeEnabled,
});

export const verdictFor = async (typeId: string | undefined, at = Date.now()): Promise<Verdict> => decide(await typeById(typeId), stateAt(at));

export function logNotification(entry: { type: string; title: string; verdict: Verdict }) {
  db.prepare(`INSERT INTO ${LOG} (at, type, title, sent, reason) VALUES (?, ?, ?, ?, ?)`)
    .run(Date.now(), entry.type, entry.title, entry.verdict.send ? 1 : 0, entry.verdict.send ? "" : entry.verdict.reason);
  db.prepare(`DELETE FROM ${LOG} WHERE id <= (SELECT MAX(id) FROM ${LOG}) - ?`).run(KEEP);
}

export type LogRow = { id: number; at: number; type: string; title: string; sent: number; reason: string };

export const recentLog = (limit = 20) => db.prepare(`SELECT * FROM ${LOG} ORDER BY id DESC LIMIT ?`).all(limit) as LogRow[];

