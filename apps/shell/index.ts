import { aiPanel, topGroup } from "@app/ai/api.ts";
import { html } from "@ravel/html.ts";
import { slot } from "@ravel/slot.ts";
import type { LayoutCtx } from "@ravel/types.ts";
import { noSkeleton, tabBar } from "@app/design-system/api.ts";
import { backPill } from "./back.ts";

// Visitors get the page alone. In the iOS app the tab bar and the chat are native, so the page leaves out its own.
export default async (ctx: LayoutCtx) => {
  if (!ctx.owner) return ctx.page;
  const inApp = ctx.client === "ios";
  return html`
    <div data-page-pane class="${inApp ? "pb-6" : "pb-32 t-nav-clear"}">${ctx.page}</div>
    ${inApp ? "" : html`<div class="t-dock">${await tabBar(ctx)}${topGroup()}${await backPill()}</div>`}
    ${inApp ? "" : slot(aiPanel, {}, { skeleton: noSkeleton })}
  `;
};
