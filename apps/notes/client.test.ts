import assert from "node:assert/strict";
import { clientCode } from "@ravel/client.ts";

// The browser gets notes.client.ts bundled into one classic script; it must run before the page has a DOM to work on.
Deno.test("the browser script runs and exposes the list helpers", async () => {
  new Function(await clientCode(import.meta.resolve("./notes.client.ts")))();
  const view = (globalThis as unknown as Record<string, Record<string, unknown>>).notesView;
  for (const name of ["toggleTag", "hasTag", "listHTML"]) assert.equal(typeof view[name], "function", name);
});
