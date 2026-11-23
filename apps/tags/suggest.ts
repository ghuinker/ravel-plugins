// Nightly: files anything new, then asks Sonnet whether loose items add up to a tag worth proposing (shown on the home page).
import { claude } from "@ravel/claude.ts";
import { cron } from "@ravel/job.ts";
import type { JobCtx } from "@ravel/types.ts";
import { sweep } from "./matcher.ts";
import { suggest } from "./proposals.ts";

export const schedule = cron("0 9 * * *"); // 9:00 UTC, the middle of the night in the Americas

export default async function (_ctx: JobCtx) {
  const filed = await sweep((prompt) => claude(prompt, { model: "haiku" }));
  const proposed = await suggest((prompt) => claude(prompt, { model: "sonnet" }));
  return { filed, proposed };
}
