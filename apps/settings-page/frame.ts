import { bar } from "@ravel/nav.ts";
import { html, raw } from "@ravel/html.ts";
import { linkRow, list } from "@app/design-system/api.ts";
import { icon } from "@ravel/icons.ts";
import type { LayoutCtx } from "@ravel/types.ts";
import { styles } from "@ravel/client.ts";
import { sections, type SettingsSection } from "./sections.ts";

const railLink = (section: SettingsSection, index: number) =>
  linkRow({ href: `/settings/${section.id}`, label: section.label, icon: icon(section.icon, "size-5"), attrs: index === 0 ? raw("data-default") : "" });

/** Settings around every section: iOS Settings on a phone (the list at /settings, one section per page), the rail beside the pane from md up. The router keeps it in place and swaps only the pane. */
export default async (ctx: LayoutCtx) => html`
  ${styles(import.meta.resolve("./settings.css"))}
  <section class="settings-page px-1 pt-6 md:px-0">
    <div class="t-stagger space-y-5">
      <header class="space-y-1">
        <div class="hidden text-[11px] font-semibold uppercase tracking-widest t-accent md:block">My workspace</div>
        ${bar({ title: "Settings" })}
      </header>
      <div class="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
        ${list((await sections()).map(railLink), { class: "settings-rail md:sticky md:top-4 md:self-start", attrs: raw("data-ravel-keep-scroll") })}
        <div class="settings-pane min-w-0 space-y-6">${ctx.page}</div>
      </div>
    </div>
  </section>`;
