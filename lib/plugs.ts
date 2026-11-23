// How apps plug into each other. An app lists what it gives other apps in its `app.ts`:
// `export const plugs = { notifications: [...], assistant: "./assistant" }`, keyed by the target app's folder. Data goes
// inline; anything with code is a "./file" in the app's folder, which the target imports.
import { appModules } from "@ravel/apps.ts";

const space = Deno.env.get("RAVEL_SPACE") ?? Deno.cwd();

/** Every app's `plugs[target]`, as written. */
export async function plugsFor<T>(target: string): Promise<{ app: string; value: T }[]> {
  const found = await appModules<{ plugs?: Record<string, unknown> }>("app.ts");
  return found.flatMap(({ app, mod }) => mod.plugs?.[target] === undefined ? [] : [{ app, value: mod.plugs[target] as T }]);
}

/** Every app's `plugs[target]` that names a "./file", imported. One that fails to import is logged and skipped. */
export async function plugModules<M>(target: string): Promise<{ app: string; mod: M }[]> {
  const found: { app: string; mod: M }[] = [];
  for (const { app, value } of await plugsFor<unknown>(target)) {
    if (typeof value !== "string" || !value.startsWith("./")) continue;
    const file = /\.[jt]sx?$/.test(value) ? value.slice(2) : `${value.slice(2)}.ts`;
    try {
      found.push({ app, mod: await import(`file://${space}/apps/${app}/${file}`) as M });
    } catch (error) {
      console.error(`apps/${app}/${file} not loaded:`, error);
    }
  }
  return found;
}
