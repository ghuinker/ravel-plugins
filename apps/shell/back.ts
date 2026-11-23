// The Back pill at the top left: shown on pages deeper than a tab, hidden on the tabs themselves.
import { clientScript, styles } from "@ravel/client.ts";
import { html } from "@ravel/html.ts";
import { icon } from "@ravel/icons.ts";

export const backPill = async () => html`${styles(import.meta.resolve("./back.css"))}
  <a href="/" id="back-pill" class="t-nav t-ink" aria-label="Back" hidden>${icon("chevron-left")}<span>Back</span></a>
  ${await clientScript(import.meta.resolve("./back.client.ts"))}`;
