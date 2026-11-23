import { html } from "@ravel/html.ts";
import type { LayoutCtx } from "@ravel/types.ts";
import { icon } from "@ravel/icons.ts";
import { clientScript } from "@ravel/client.ts";

// Ordered by priority: the first MOBILE_COUNT get a tab on mobile, the rest live in More. Desktop shows the first DESKTOP_COUNT.
type Tab = { path: string; label: string; icon: string; also?: string[] };

const MOBILE_COUNT = 3;
const DESKTOP_COUNT = 4;
const CENTER_GAP = "w-24 shrink-0";
const MORE_ICON = "ellipsis-horizontal";

// Items past the mobile count are a tab on desktop only; past the desktop count they are a More entry everywhere.
const barDisplay = (index: number) => (index < MOBILE_COUNT ? "flex" : index < DESKTOP_COUNT ? "hidden md:flex" : "hidden");

/** The site's tab bar (a floating bar at the bottom on a phone and a pill across the top from md up; the first four tabs show and the rest sit under More), built from every app's `nav` in its app.ts; entries with `extra` only show under More. `base.css` styles it, the same in every theme. */
export async function tabBar(ctx: LayoutCtx) {
  const items = ctx.nav.filter((entry) => !entry.extra);
  const EXTRA_ITEMS = ctx.nav.filter((entry) => entry.extra);
  const onExtra = EXTRA_ITEMS.some((item) => ctx.path === item.path || ctx.path.startsWith(`${item.path}/`));
  const under = (path: string) => path === ctx.path || (path !== "/" && ctx.path.startsWith(`${path}/`));
  const isActive = (tab: Tab) => [tab.path, ...(tab.also ?? [])].some(under);
  const state = (active: boolean) => (active ? "t-active" : "t-muted");
  const link = (tab: Tab, index: number) => html`
    <a href="${tab.path}" data-nav-also="${(tab.also ?? []).join(" ")}" class="${barDisplay(index)} flex-1 flex-col items-center gap-1 rounded-[var(--radius-field)] py-2 text-[11px] font-medium ${state(isActive(tab))}">
      ${icon(tab.icon)}
      ${tab.label}
    </a>`;
  const moreActive = items.slice(MOBILE_COUNT).some(isActive) || onExtra;
  const deskMoreActive = items.slice(DESKTOP_COUNT).some(isActive) || onExtra;
  const popupItem = (tab: Tab) => html`
    <a href="${tab.path}" data-nav-also="${(tab.also ?? []).join(" ")}" class="flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-sm font-medium ${state(isActive(tab))}">${icon(tab.icon)}${tab.label}</a>`;
  const withIndex = items.map((tab, index) => ({ tab, index }));
  const bar = withIndex;
  const overflow = withIndex.slice(MOBILE_COUNT);
  return html`
    ${await clientScript(import.meta.resolve("./tabbar.client.ts"))}
    <nav data-tab-bar data-placement="top" data-signals="{moreOpen: false, deskMore: false}" class="fixed inset-x-3 bottom-3 z-0 mx-auto flex max-w-md items-center justify-between rounded-[var(--radius-card)] border t-nav p-1.5 backdrop-blur md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:mx-0 md:w-20 md:flex-col md:items-stretch md:justify-start md:gap-1">
      ${bar.slice(0, 2).map(({ tab, index }) => link(tab, index))}
      <div class="${CENTER_GAP} md:hidden"></div>
      ${bar.slice(2).map(({ tab, index }) => link(tab, index))}
      <div data-on:click__outside="$moreOpen = false" class="relative flex flex-1 md:hidden">
        <button type="button" data-more data-on:click="$moreOpen = !$moreOpen" class="flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-field)] py-2 text-[11px] font-medium ${state(moreActive)}">
          ${icon(MORE_ICON)}
          More
        </button>
        <div data-show="$moreOpen" data-on:click="$moreOpen = false" style="display:none" class="absolute bottom-full right-0 mb-3 md:bottom-auto md:left-full md:right-auto md:top-0 md:ml-3 md:mb-0 flex w-48 flex-col gap-1 rounded-[var(--radius-field)] border t-menu p-1.5">
          ${overflow.map(({ tab }) => popupItem(tab))}
          ${EXTRA_ITEMS.map(popupItem)}
        </div>
      </div>
      <div data-on:click__outside="$deskMore = false" class="relative hidden md:flex">
        <button type="button" data-more data-on:click="ravel.haptic('tap'); $deskMore = !$deskMore" class="flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-field)] py-2 text-[11px] font-medium ${state(deskMoreActive)}">
          ${icon(MORE_ICON)}
          More
        </button>
        <div data-show="$deskMore" data-on:click="$deskMore = false" style="display:none" class="absolute left-full top-0 ml-3 flex w-48 flex-col gap-1 rounded-[var(--radius-field)] border t-menu p-1.5">
          ${items.slice(DESKTOP_COUNT).map(popupItem)}
          ${EXTRA_ITEMS.map(popupItem)}
        </div>
      </div>
    </nav>
  `;
}
