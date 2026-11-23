// Tags items that were never looked at into tags; started a minute after something is added or edited.
import { claude } from "@ravel/claude.ts";
import type { JobCtx } from "@ravel/types.ts";
import { sweep } from "./matcher.ts";

export default async function (_ctx: JobCtx) {
  return { filed: await sweep((prompt) => claude(prompt, { model: "haiku" })) };
}
