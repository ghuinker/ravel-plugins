// The pieces bento grids are built from (Home, Workouts, Habits, Goals, Forward): one tile shell that can flip to a back face, a row of numbers, a chart with a big number above it, a short list.
// The classes `bn-*` are in base.css; where each tile sits is the area map of its tab, in that app's .css.
import { html, raw } from "@ravel/html.ts";

type Html = ReturnType<typeof html>;

export type TileOpts = {
  title?: string | Html;
  /** Small text on the right of the title. */
  count?: string;
  tone?: "tint" | "accent" | "invert" | "flush" | "plain";
  /** Turns the tile's colour around the colour wheel (degrees). */
  hue?: number;
  /** Makes the whole tile a link. */
  href?: string;
  /** Lets a popup spill out of the tile (the day heatmap). */
  open?: boolean;
  /** Extra classes, for a tile's own look. */
  extra?: string;
  /** Shown before the title; a tile with an icon, a back or a link is drawn as a card on a stage. */
  icon?: string;
  /** The other side: the tile flips to it by itself and with the ↻ button. */
  back?: Html;
  backTitle?: string;
  /** A moment (ms) the page counts down to in the tile's `.bt-value`. */
  until?: number;
  /** A link over the card, for a tile whose body has its own controls. */
  link?: string;
  /** For a tile with no page of its own: an expression that opens a sheet (`openSheet(...)`) when the card is tapped. */
  sheet?: string;
};

const TAP = "ravel.haptic('tap')";
const FLIP_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>`;

const face = (which: "front" | "back", opts: TileOpts, body: Html) => {
  const label = typeof opts.title === "string" ? opts.title : "";
  const tone = opts.tone && opts.tone !== "plain" ? ` bn-${opts.tone}` : "";
  const title = which === "back" ? (opts.backTitle ?? opts.title) : opts.title;
  return html`<div class="bn-face bn-${which}${tone}"${which === "back" ? raw(' aria-hidden="true"') : ""}>${opts.link ? html`<a class="bn-link" href="${opts.link}" data-on:click="${TAP}" aria-label="${label}" tabindex="${which === "back" ? -1 : 0}"></a>` : ""}${opts.sheet ? html`<button type="button" class="bn-link" data-on:click="${TAP}; ${opts.sheet}" aria-label="${label}" tabindex="${which === "back" ? -1 : 0}"></button>` : ""}<header class="bn-head"><h2 class="bn-title ask-title">${title ?? ""}</h2>${opts.count ? html`<span class="bn-count">${opts.count}</span>` : ""}<span class="bn-tools">${opts.back ? html`<button type="button" class="bn-flipbtn" data-flip aria-label="Show the other side">${FLIP_ICON}</button>` : ""}</span></header><div class="bn-body">${body}</div></div>`;
};

/** One tile. `area` is the name in the grid's area map and `index` the place in the fade-in order. */
export function tile(area: string, opts: TileOpts, body: Html, index = 0) {
  const style = `grid-area:${area};--i:${index}${opts.hue ? `;--hue:${opts.hue}` : ""}`;
  if (opts.back || opts.link || opts.sheet || opts.icon) {
    const classes = `bn bn-stage bn-${area}${opts.back ? " bn-flips" : ""} ${opts.open ? "bn-open" : ""} ${opts.extra ?? ""}`;
    return html`<section class="${classes}" style="${style}"${opts.until ? raw(` data-until="${opts.until}"`) : ""}><div class="bn-inner">${face("front", opts, body)}${opts.back ? face("back", opts, opts.back) : ""}</div></section>`;
  }
  const classes = `bn bn-${area} ${opts.tone && opts.tone !== "plain" ? `bn-${opts.tone}` : ""} ${opts.open ? "bn-open" : ""} ${opts.extra ?? ""}`;
  const inner = html`${opts.title ? html`<div class="bn-head"><h2 class="bn-title">${opts.title}</h2>${opts.count ? html`<span class="bn-count">${opts.count}</span>` : ""}</div>` : ""}<div class="bn-body">${body}</div>`;
  return opts.href
    ? html`<a class="${classes}" style="${style}" href="${opts.href}" data-on:click="${TAP}">${inner}</a>`
    : html`<section class="${classes}" style="${style}">${inner}</section>`;
}

/** Makes a tile builder for one grid: it numbers the tiles so they fade in one after another. */
export function tileMaker() {
  let index = 0;
  return (area: string, opts: TileOpts, body: Html) => tile(area, opts, body, index++);
}

export type Stat = { label: string; big: Html; note?: Html };

/** Numbers side by side (or stacked), each with a label and, optionally, its change from last week. */
export const stats = (items: Stat[], stacked = false) => html`<div class="bn-stats ${stacked ? "bn-stats-col" : ""}" style="--n:${items.length}">
  ${items.map((item) => html`<div class="bn-stat"><div class="bn-sl t-muted">${item.label}</div><div class="bn-sv">${item.big}</div>${item.note ?? ""}</div>`)}</div>`;

/** A big number over a chart that fills the rest of the tile. */
export const numberOverChart = (big: Html, unit: string, chart: Html) => html`<div class="bn-bigline"><span class="bn-big">${big}</span><span class="t-muted text-sm">${unit}</span></div><div class="bn-chart">${chart}</div>`;

export const chartOnly = (chart: Html) => html`<div class="bn-chart">${chart}</div>`;

export type Line = { label: string; value: string; href?: string; sub?: string };

/** A short list: a label, its value on the right, and a link when there is one. No lines between them. */
export const lines = (items: Line[], columns = false) => html`<div class="bn-recs ${columns ? "bn-cols2" : ""}">
  ${items.map((item) => {
    const inner = html`<span class="bn-rl"><span class="bn-rt">${item.label}</span>${item.sub ? html`<span class="bn-rs t-muted">${item.sub}</span>` : ""}</span><b class="bn-rv">${item.value}</b>`;
    return item.href ? html`<a class="bn-rec" href="${item.href}" data-on:click="ravel.haptic('tap')">${inner}</a>` : html`<div class="bn-rec">${inner}</div>`;
  })}</div>`;

export const nothing = (message: string) => html`<p class="m-auto text-center text-sm t-muted">${message}</p>`;
