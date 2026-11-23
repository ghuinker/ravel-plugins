// What a tag can go on. An app makes its things taggable by adding `tags: "./tag-items"` to the `plugs` in its `app.ts`: a
// file exporting `tagKinds`, each kind's name, label and how to list its items. Tags never imports those apps. Two apps may
// give the same kind; their items are listed together.
import { plugModules } from "../../lib/plugs.ts";

export type Item = { kind: string; id: string; title: string; text: string; done: boolean; href: string; at: number };

export type Kind = { label: string; plural: string; icon: string; list: () => Item[] };

export const KINDS: Record<string, Kind> = {};

let cache: { at: number; byKey: Map<string, Item> } | null = null;
const CACHE_MS = 1000;

/** Adds a kind, or more items to one already given. Tests add kinds of their own with it. */
export function addKind(name: string, kind: Kind) {
  const had = KINDS[name];
  KINDS[name] = had ? { ...had, list: () => [...had.list(), ...kind.list()] } : kind;
  cache = null;
}

for (const { mod } of await plugModules<{ tagKinds?: Record<string, Kind> }>("tags")) {
  for (const [name, kind] of Object.entries(mod.tagKinds ?? {})) addKind(name, kind);
}

export const isKind = (kind: string) => Object.hasOwn(KINDS, kind);

export const keyOf = (item: { kind: string; id: string }) => `${item.kind}:${item.id}`;

/** Drops the one-second cache, so an item added a moment ago is seen (tests, and anything that adds then immediately tags). */
export const forgetItems = () => void (cache = null);

/** Every item of every kind by "kind:id". Kept for a second so one render reads each app once. */
export function allItems(): Map<string, Item> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byKey;
  const byKey = new Map<string, Item>();
  for (const kind of Object.values(KINDS)) for (const item of kind.list()) byKey.set(keyOf(item), item);
  cache = { at: Date.now(), byKey };
  return byKey;
}
