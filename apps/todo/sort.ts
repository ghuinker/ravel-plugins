// Places unsorted tasks (Today or Someday); started right after a task is added, so it doesn't need the todo page open.
import type { JobCtx } from "@ravel/types.ts";
import { askClaude, sortUnsorted } from "./triage.ts";

export default async function (_ctx: JobCtx) {
  return { placed: await sortUnsorted(askClaude) };
}
