import { html, raw, type Raw } from "@ravel/html.ts";

export type Segment = { href: string; label: string };

/**
 * Pill tabs that switch a page's content (Forward, Workouts, Goals). Each tab is a link to its own path; the router
 * swaps the page and keeps this bar and the scroll where they are. Pass `active` (an href) when the page renders the
 * bar itself; leave it out in a frame the router keeps, and the tab whose page is open lights up from `aria-current`.
 */
export function segmented(tabs: Segment[], active?: string): Raw {
  const mode = active === undefined ? raw("data-seg-auto") : "";
  const tab = (segment: Segment) => html`<a href="${segment.href}" data-nav="replace" data-on:click="ravel.haptic('select')"
    class="t-pill flex-1 rounded-full px-2 py-1.5 text-center text-sm font-semibold ${segment.href === active ? "t-seg-on" : ""}">${segment.label}</a>`;
  return html`<div data-ravel-keep-scroll ${mode} class="t-seg t-chip flex gap-1 rounded-full p-1">${tabs.map(tab)}</div>`;
}
