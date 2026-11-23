import { component } from "@ravel/component.ts";
import { html, raw } from "@ravel/html.ts";
import { ref, slot } from "@ravel/slot.ts";
import type { Ctx } from "@ravel/types.ts";
import { cardSkeleton, backTo } from "@app/design-system/api.ts";
import { sectionById, sections, type SettingsSection } from "./sections.ts";

const HOME = raw(`<div data-settings-home hidden></div>`);

/** A section's heading (on a phone, where the rail is hidden), then what it draws. */
const sectionPage = (section: SettingsSection, pane = slot(section.slot, {}, { skeleton: cardSkeleton })) => html`
  <header class="space-y-1">
    ${backTo("/settings")}<h2 class="t-title text-2xl md:hidden">${section.label}</h2>
  </header>
  ${pane}`;

const notFound = html`<p class="t-muted">No such section.</p>`;

/** On a phone /settings is only the rail; from md up it shows the first section beside it. The app never shows that pane, so it isn't drawn there. */
export default async (ctx: Ctx) => html`${HOME}${ctx.client === "ios" ? "" : sectionPage((await sections())[0])}`;

export const Section = component(async (ctx: Ctx) => {
  const section = await sectionById(ctx.params.section);
  return section ? sectionPage(section) : notFound;
});

export const JobRuns = component(async () => sectionPage((await sectionById("background"))!, slot(ref(import.meta, "./job-runs"), {}, { skeleton: cardSkeleton })));