import { html } from "@ravel/html.ts";
import { ref, slot } from "@ravel/slot.ts";
import type { Ctx } from "@ravel/types.ts";
import { icon } from "@ravel/icons.ts";
import { linkRow, list } from "@app/design-system/api.ts";
import { initialValues, saveSetting as save, settingsPanel } from "@app/settings/api.ts";
import { currentTheme, themeLabel } from "./site-theme.ts";
import { themeDials } from "./theme-dials.ts";
import { settings } from "./settings.ts";

export default (ctx: Ctx) => html`
  <div data-signals="${JSON.stringify(initialValues(settings))}" class="space-y-6">
    <div class="space-y-1.5">
      <h2 class="px-4 text-xs font-medium uppercase tracking-wide t-muted">Theme</h2>
      <div class="t-group p-4">${slot(ref(import.meta, "./picker"), {}, { skeleton: html`<div class="h-40"></div>` })}</div>
    </div>
    ${themeDials(currentTheme()).length ? html`<div class="space-y-1.5">
      <h2 class="px-4 text-xs font-medium uppercase tracking-wide t-muted">${themeLabel(currentTheme())} look</h2>
      <div class="t-group p-4">${slot(ref(import.meta, "./dials"), {}, { skeleton: html`<div class="h-40"></div>` })}</div>
    </div>` : ""}
    ${settingsPanel(ctx, settings, "Schedule")}
    ${list([linkRow({ href: "/design-system", label: "Design System", note: "Every colour and component in this theme", icon: icon("swatch", "size-5"), chevron: true })])}
  </div>`;

export const actions = { save };
