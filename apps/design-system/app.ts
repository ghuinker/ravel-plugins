import { app } from "@ravel/app.ts";
import { writeTheme } from "./write.ts";

// Ravel loads every app.ts when the worker starts, so a fresh start (or a changed file here) brings theme/ up to date.
// Only the worker and job processes set RAVEL_SPACE; a test process has an empty db and would overwrite theme/ with the defaults.
if (Deno.env.get("RAVEL_SPACE")) writeTheme().catch((error) => console.error("theme/ not written:", error));

export default app({
});
