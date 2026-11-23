import { app } from "@ravel/app.ts";

export const plugs = { tags: "./tag-items", home: "./home" };

export default app({
  path: "/notes",
  jobs: { "notes-title": "./title" },
  routes: { "": "./index", "/:id": "./index" },
  nav: { label: "Notes", icon: "document-text", order: 2 },
});
