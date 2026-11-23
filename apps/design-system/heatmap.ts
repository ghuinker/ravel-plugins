import { html, type Raw } from "@ravel/html.ts";

/** One day. `shade` is 0 (nothing) to 1 (the most); `title` and `pop` fill the card that pops up on hover or tap. */
export type HeatCell = { shade: number; title?: string; pop?: Raw | string } | null;

type Options = {
  /** Seven a week, oldest first, Monday first; null for a day that doesn't count yet (the future). */
  cells: HeatCell[];
  /** "columns": a week per column, Monday on top (the default). "rows": a week per row, the newest at the bottom. */
  weeks?: "columns" | "rows";
  label: string;
};

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const percent = (value: number, total: number) => ((value / total) * 100).toFixed(3);
const opacity = (shade: number) => (shade <= 0 ? 0.1 : 0.25 + Math.min(1, shade) * 0.75).toFixed(2);

/**
 * A calendar heatmap, a square a day in the accent colour (or `--hm-color`). It fills its container's width; set a
 * width, or `height: 100%` and `width: auto`, on `.hm` to size it otherwise. Days with a `title` or `pop` get a card.
 */
export function heatmap({ cells, weeks = "columns", label }: Options) {
  const count = Math.ceil(cells.length / 7);
  const [cols, rows] = weeks === "columns" ? [count, 7] : [7, count];
  const width = cols * STEP - GAP;
  const height = rows * STEP - GAP;
  const place = (index: number) => {
    const [week, day] = [Math.floor(index / 7), index % 7];
    return weeks === "columns" ? { week, col: week, row: day } : { week, col: day, row: week };
  };
  const squares = cells.map((cell, index) => {
    if (!cell) return "";
    const { week, col, row } = place(index);
    return html`<rect style="--i:${week}" x="${col * STEP}" y="${row * STEP}" width="${CELL}" height="${CELL}" rx="3" fill-opacity="${opacity(cell.shade)}"/>`;
  });
  const hits = cells.map((cell, index) => {
    if (!cell || (!cell.title && !cell.pop)) return "";
    const { col, row } = place(index);
    const across = (col + 0.5) / cols;
    const side = across > 0.65 ? "hm-pop-left" : across < 0.2 ? "hm-pop-right" : "";
    const flip = (row + 0.5) / rows > 0.55 ? "hm-pop-up" : "";
    return html`<div class="hm-hit" tabindex="0" style="left:${percent(col * STEP, width)}%;top:${percent(row * STEP, height)}%;width:${percent(CELL, width)}%;height:${percent(CELL, height)}%">
      <div class="hm-pop t-card border ${side} ${flip}">${cell.title ? html`<div class="t-ink font-semibold">${cell.title}</div>` : ""}${cell.pop ?? ""}</div>
    </div>`;
  });
  return html`<div class="hm" style="aspect-ratio:${width} / ${height}">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${label}"><g fill="currentColor">${squares}</g></svg>${hits}
  </div>`;
}
