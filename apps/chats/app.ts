import { app } from "@ravel/app.ts";
import { enabledJobs } from "@app/settings/api.ts";

export const jobs = { "chat-summaries": "./summary" };

export const plugs = { tags: "./tag-items" };

export default app({
  path: "/chats",
  routes: { "": "./page" },
  jobs: enabledJobs(jobs),
  nav: { label: "Chats", icon: "chat-bubble-left-right", order: 7, extra: true },
});
