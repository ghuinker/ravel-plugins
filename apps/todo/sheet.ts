import { openSheet } from "@ravel/nav.ts";
import { ref } from "@ravel/slot.ts";

/** The expression that opens a task in the editor sheet from another page (Home): `standalone` makes the sheet bring its own script and listeners, since that page has none. */
export const openTaskSheet = (id: string) => openSheet(ref(import.meta, "./task"), { id, standalone: "1" }, "large");
