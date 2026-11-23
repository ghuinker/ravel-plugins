import type { Notification } from "@ravel/notify.ts";
import { logNotification, verdictFor } from "./db.ts";

/** The `notify` hook in the root app.ts: every notification passes here, whoever sent it. Its `thread` is its registered type id. */
export async function gate(note: Notification): Promise<Notification | null> {
  try {
    const verdict = await verdictFor(note.thread);
    logNotification({ type: note.thread ?? "(none)", title: note.title, verdict });
    return verdict.send ? note : null;
  } catch (error) {
    // A broken gate must not let a notification through (the hook sends unchanged if it throws).
    console.error("notification gate failed", error);
    return null;
  }
}
