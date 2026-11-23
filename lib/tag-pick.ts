// Picking tags on an item in the browser (Todo, Notes, Chats). An item carries `tags`: a list of `{id, label}`.
// The server has the last word on the limit; this only keeps the screen honest while the save is on its way.

export type PickedTag = { id: number; label: string };
export type Tagged = { tags?: PickedTag[] };

/** A picked list with one tag toggled: added (unless it already has `max`), or removed. Returns a new list. */
export function toggledTags(list: PickedTag[], tag: { id: number | string; label: string }, max: number): PickedTag[] {
  const id = Number(tag.id);
  // Fresh plain objects: the page's signals hand out proxies, and those can't be posted to the other tabs.
  const plain = list.map((picked) => ({ id: picked.id, label: picked.label }));
  if (plain.some((picked) => picked.id === id)) return plain.filter((picked) => picked.id !== id);
  return plain.length >= max ? plain : [...plain, { id, label: tag.label }];
}

export const itemHasTag = (item: Tagged | undefined, tagId: number) => (item?.tags ?? []).some((tag) => tag.id === tagId);

export const itemNoTags = (item: Tagged | undefined) => !(item?.tags ?? []).length;

/** The item's tags as one line, or "None". */
export const itemTagNames = (item: Tagged | undefined) => (item?.tags ?? []).map((tag) => tag.label).join(", ") || "None";

/**
 * Toggles a tag on the item right away; `tagId` 0 clears them all.
 * Returns "on", "off", or "full" when the item already has `max` tags (nothing changed).
 */
export function pickTag(item: Tagged | undefined, tagId: number, label: string, max: number) {
  if (!item) return "full";
  if (!tagId) {
    item.tags = [];
    return "off";
  }
  const had = itemHasTag(item, tagId);
  const next = toggledTags(item.tags ?? [], { id: tagId, label }, max);
  if (!had && next.length === (item.tags ?? []).length) return "full";
  item.tags = next;
  return had ? "off" : "on";
}

/** `tag` is "all", 0 (no tag) or a tag id; an item with several tags matches each of them. */
export function matchesTag(item: Tagged, tag: string | number = "all") {
  if (tag === "all") return true;
  const have = (item.tags ?? []).map((one) => one.id);
  return Number(tag) === 0 ? have.length === 0 : have.includes(Number(tag));
}

/** How many of the items match `tag`. */
export const countTag = (items: Tagged[], tag: string | number) => items.filter((item) => matchesTag(item, tag)).length;
