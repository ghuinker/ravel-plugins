import { job } from "@ravel/job.ts";

/** Asks for a sorting run now, unless one is already waiting. Call it after adding a task. Never throws. */
export async function queueTriage() {
  try {
    await job.start("todo-sort", null, { once: true });
  } catch (error) {
    console.error("todo sort not queued:", error);
  }
}
