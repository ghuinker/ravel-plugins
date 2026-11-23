import { html } from "@ravel/html.ts";

// Behind every page (`backdrop` in the root app.ts) and alone at /_backdrop for the iOS app. A theme's scenery script draws into .t-backdrop.
export default () => html`
  <div class="t-backdrop"></div>
  <div class="t-glow"></div>
`;
