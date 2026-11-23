import { app } from "@ravel/app.ts";
import { enabledJobs } from "@app/settings/api.ts";

export const jobs = { "todo-sort": "./sort" };

export const plugs = { tags: "./tag-items", home: "./home" };

export default app({
  path: "/todo",
  routes: { "": "./index" },
  jobs: enabledJobs(jobs),
  nav: { label: "TODO", icon: "check-circle", order: 3 },
  widgets: [{ id: "today", title: "Today", slot: "./widget" }],
});
