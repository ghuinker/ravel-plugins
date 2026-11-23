import { app } from "@ravel/app.ts";
import { enabledJobs } from "@app/settings/api.ts";

export const jobs = { "memory-change": "./memory-change" };

export const plugs = {
  settings: "./settings",
};

export default app({
  layout: "./frame",
  routes: {
    "/settings": "./index",
    "/settings/:section": "./index.Section",
    "/settings/background/:job": "./index.JobRuns",
  },
  jobs: enabledJobs(jobs),
  nav: { path: "/settings", label: "Settings", icon: "cog-6-tooth", order: 6 },
});
