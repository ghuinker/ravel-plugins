import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { initialValues, saveSetting as save, settingsPanel } from "@app/settings/api.ts";
import { preferenceApps } from "./sections.ts";

/** The values of every app that has no section of its own, one group per app. */
export default async (ctx: Ctx) => {
  const apps = await preferenceApps();
  return html`
  <div data-signals="${JSON.stringify(initialValues(...apps))}" class="space-y-6">
    ${apps.map((settings) => settingsPanel(ctx, settings))}
  </div>`;
};

export const actions = { save };
