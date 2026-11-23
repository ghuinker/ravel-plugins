import { app } from "@ravel/app.ts";

// The cards on this page come from the apps that list `home: "./home"` in their `plugs` (see api.ts and cards.ts).
export default app({
  path: "/",
  routes: { "": "./index" },
  nav: { label: "Home", icon: "home", order: 1 },
});
