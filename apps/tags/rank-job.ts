// Nightly: re-ranks tags by recent activity so lists and filters show the live ones first.
import { cron } from "@ravel/job.ts";
import type { JobCtx } from "@ravel/types.ts";
import { rankTags } from "./rank.ts";

export const schedule = cron("30 9 * * *"); // after tag-suggest, still the middle of the night in the Americas

export default function (_ctx: JobCtx) {
  return { ranked: rankTags().size };
}
