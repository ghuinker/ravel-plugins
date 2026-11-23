// Which tags are alive. Each item under a tag counts for how recently it moved (half-life 3 weeks); open work counts in full,
// finished work for less, and an old open task never quite fades. The result is `tags.heat`, which orders every list and filter.
import { allItems } from "./items.ts";
import { linksIn, listTags, setHeat } from "./db.ts";

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 21;
const DONE_WEIGHT = 0.3;
const OPEN_FLOOR = 0.15;

export function itemHeat(item: { done: boolean; at: number }, now: number): number {
  const decay = item.at ? 0.5 ** (Math.max(0, now - item.at) / DAY_MS / HALF_LIFE_DAYS) : 0;
  return item.done ? decay * DONE_WEIGHT : Math.max(decay, OPEN_FLOOR);
}

/** Recomputes every tag's heat and saves it. */
export function rankTags(now = Date.now()): Map<number, number> {
  const items = allItems();
  const heats = new Map<number, number>();
  for (const tag of listTags()) {
    let heat = 0;
    for (const link of linksIn(tag.id)) {
      const item = items.get(`${link.kind}:${link.item_id}`);
      if (item) heat += itemHeat(item, now);
    }
    heats.set(tag.id, Math.round(heat * 1000) / 1000);
  }
  setHeat(heats);
  return heats;
}
