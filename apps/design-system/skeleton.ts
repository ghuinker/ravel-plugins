import { html, raw } from "@ravel/html.ts";

const bar = (classes: string) => html`<div class="animate-pulse rounded-full t-skeleton ${classes}"></div>`;

export const cardSkeleton = html`
  <section class="space-y-3 rounded-[var(--radius-card)] border t-card p-5" aria-hidden="true">
    ${bar("h-3 w-1/3")}${bar("h-3 w-full")}${bar("h-3 w-2/3")}
  </section>`;

export const noSkeleton = raw("");
