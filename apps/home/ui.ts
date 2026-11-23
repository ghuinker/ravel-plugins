import { html } from "@ravel/html.ts";

/** A row of dots, the first `ratio` of them filled (a number out of `total`). `hot` turns them to the warning color. */
export const dots = (ratio: number, total = 10, hot = false) => {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * total);
  return html`<span class="h2-dots${hot ? " h2-dots-hot" : ""}" aria-hidden="true">${Array.from({ length: total }, (_, n) => html`<i class="${n < filled ? "on" : ""}" style="--n:${n}"></i>`)}</span>`;
};

/** The same, for "3 of 5": one dot per step. */
export const stepDots = (done: number, total: number) => dots(total ? done / total : 0, Math.max(1, total));

export const CHEV = html`<span class="h2-chev" aria-hidden="true">›</span>`;

const TAP = "ravel.haptic('tap')";

export type CardOptions = { count?: string; href?: string; sheet?: string; tone?: string; className?: string };

/** The frame of a card on Home: a title (a link, or a button that opens a sheet) with a muted count, then the body. `index` sets how late it rises in. */
export const homeCard = (index: number, title: string, body: unknown, options: CardOptions = {}) => html`<section class="h2-card ${options.tone ?? ""} ${options.className ?? ""}" style="--i:${index}">
  <div class="h2-head"><h2>${options.href ? html`<a href="${options.href}" data-on:click="${TAP}">${title}</a>` : options.sheet ? html`<button type="button" data-on:click="${TAP}; ${options.sheet}">${title}</button>` : title}</h2>${options.count ? html`<span class="t-muted">${options.count}</span>` : ""}</div>
  ${body}
</section>`;
