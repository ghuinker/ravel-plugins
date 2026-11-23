import { app } from "@ravel/app.ts";
import { enabledJobs } from "@app/settings/api.ts";

export const jobs = { "tag-sweep": "./sweep", "tag-suggest": "./suggest", "tag-rank": "./rank-job" };

export const plugs = {
  settings: "./settings",
  ai: "./chat.client",
};

export default app({
  jobs: enabledJobs(jobs),
});
