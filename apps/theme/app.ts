import { app } from "@ravel/app.ts";
import { enabledJobs } from "@app/settings/api.ts";

export const jobs = { "theme-schedule": "./schedule" };

export const plugs = {
  settings: "./settings",
  "design-system": "./skin",
};

export default app({
  routes: { "/design-system": "./design-system-page" },
  jobs: enabledJobs(jobs),
});
