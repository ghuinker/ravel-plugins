import { appFolder, db, table } from "@ravel/db.ts";
import { plugModules } from "../../lib/plugs.ts";

const TABLE = table(import.meta, "", "key TEXT PRIMARY KEY, value TEXT NOT NULL");

/** Raw key/value access to the settings table, for state that isn't a declared value (zones, job state). */
export const getSetting = (key: string) => (db.prepare(`SELECT value FROM ${TABLE} WHERE key = ?`).get(key) as { value: string } | undefined)?.value;

export const setSetting = (key: string, value: string) => db.prepare(`INSERT OR REPLACE INTO ${TABLE} (key, value) VALUES (?, ?)`).run(key, value);

export type NumberValue = { type: "number"; label: string; hint: string; fallback: number; min: number; max: number };
export type SwitchValue = { type: "switch"; label: string; hint: string; fallback: boolean };
export type Value = NumberValue | SwitchValue;

export type Spec<V extends Record<string, Value> = Record<string, Value>> = {
  label: string;
  icon: string;
  blurb: string;
  /** Rail position on the settings page; lower comes first. */
  order?: number;
  /** A fragment that draws this app's whole section, its values included. Without one, the values show under Preferences. */
  pane?: string;
  values: V;
};

type Typed<T extends Value> = T extends NumberValue ? number : boolean;

export type Settings<V extends Record<string, Value> = Record<string, Value>> = {
  app: string;
  spec: Spec<V>;
  /** The stored key for a value: `<app>.<name>`. */
  key: (name: keyof V & string) => string;
  get: <K extends keyof V & string>(name: K) => Typed<V[K]>;
  set: <K extends keyof V & string>(name: K, value: Typed<V[K]>) => boolean;
};

const registry = new Map<string, { value: Value; settings: Settings }>();

const clamp = (value: NumberValue, n: number) => Math.min(value.max, Math.max(value.min, Math.round(n)));

function load(key: string, value: Value): number | boolean {
  const row = getSetting(key);
  if (row === undefined) return value.fallback;
  if (value.type === "switch") return row === "1";
  const n = Number(row);
  return Number.isFinite(n) ? clamp(value, n) : value.fallback;
}

function save(key: string, value: Value, next: unknown): boolean {
  if (value.type === "switch") {
    if (typeof next !== "boolean") return false;
    setSetting(key, next ? "1" : "0");
    return true;
  }
  const n = Number(next);
  if (next === null || next === "" || !Number.isFinite(n)) return false;
  setSetting(key, String(clamp(value, n)));
  return true;
}

/** Declares an app's settings, from the file its `app.ts` plugs in as `settings: "./settings"`, as `export const settings = define(import.meta, {...})`. */
export function define<V extends Record<string, Value>>(meta: ImportMeta, spec: Spec<V>): Settings<V> {
  const app = appFolder(meta);
  if (!app) throw new Error(`define(): ${meta.url} is outside apps/`);
  const key = (name: string) => `${app}.${name}`;
  const settings: Settings<V> = {
    app,
    spec,
    key,
    get: (name) => load(key(name), spec.values[name]) as never,
    set: (name, value) => save(key(name), spec.values[name], value),
  };
  for (const [name, value] of Object.entries(spec.values)) registry.set(key(name), { value, settings: settings as unknown as Settings });
  return settings;
}

/** Every app's declared settings, by `order`. */
export async function list(): Promise<Settings[]> {
  const found = (await plugModules<{ settings?: Settings }>("settings")).map(({ mod }) => mod.settings).filter((s): s is Settings => !!s?.spec);
  return found.sort((a, b) => (a.spec.order ?? 50) - (b.spec.order ?? 50) || a.spec.label.localeCompare(b.spec.label));
}

/** Any declared value by its full key, for pages that show settings from many apps. */
export async function getValue(key: string): Promise<number | boolean | undefined> {
  if (!registry.has(key)) await list();
  const found = registry.get(key);
  return found ? load(key, found.value) : undefined;
}

/** Saves a declared value by its full key; unknown keys and wrong types are ignored. */
export async function setValue(key: string, next: unknown): Promise<boolean> {
  if (!registry.has(key)) await list();
  const found = registry.get(key);
  return found ? save(key, found.value, next) : false;
}

/** An app's own undeclared key/value state (sync cursors, one-time flags), stored as `<app>.<key>`. */
export function state(meta: ImportMeta) {
  const app = appFolder(meta);
  if (!app) throw new Error(`state(): ${meta.url} is outside apps/`);
  return {
    get: (key: string) => getSetting(`${app}.${key}`),
    set: (key: string, value: string) => setSetting(`${app}.${key}`, value),
  };
}
