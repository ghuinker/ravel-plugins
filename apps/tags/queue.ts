import { job } from "@ravel/job.ts";

const DELAY_MS = 60_000; // lets a burst of edits settle into one sweep

/** Asks for a sweep soon, unless one is already waiting. Call it from any app that adds or edits items. Never throws. */
export async function queueSweep(delayMs = DELAY_MS) {
  try {
    const at = new Date(Date.now() + delayMs);
    const [latest] = await job.runs("tag-sweep", 1);
    if (latest?.state === "queued") {
      if (new Date(latest.run_at) <= at) return;
      await job.cancel(latest.id); // a later sweep is waiting, but this one is wanted sooner
    }
    await job.start("tag-sweep", {}, { at });
  } catch (error) {
    console.error("tag sweep not queued:", error);
  }
}
