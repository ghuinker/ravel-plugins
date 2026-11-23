import assert from "node:assert/strict";
import { clientCode } from "@ravel/client.ts";

// richScript() sends rich.client.ts bundled into one classic script; it must run before the page has a DOM to work on.
Deno.test("the editor script runs and exposes ravelRich", async () => {
  new Function(await clientCode(import.meta.resolve("./rich.client.ts")))();
  const rich = (globalThis as unknown as Record<string, Record<string, unknown>>).ravelRich;
  for (const name of ["richLoad", "richInline", "richBlock", "richTable", "richLink", "richFocus", "richFocusEnd"]) assert.equal(typeof rich[name], "function", name);
});
