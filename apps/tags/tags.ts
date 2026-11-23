import { settings } from "./settings.ts";
import { attach, checkOf, detach, detachAll, getTag, linksOf, type Tag } from "./db.ts";

// An item (task, note, chat) carries a few tags, filed by Claude or by hand.
export const tagLabel = (tag?: Pick<Tag, "emoji" | "name">) => tag ? tag.name.trim() : "";

/** The most tags one item can carry (the `tags.max` setting). */
export const maxTags = () => settings.get("max");

/** The tags an item has, the most confident first. */
export function tagsOf(kind: string, itemId: string): Tag[] {
  return linksOf(kind, itemId, "attached").map((link) => getTag(link.tag_id)).filter((tag): tag is Tag => tag !== undefined);
}

/** The owner gives an item a tag by hand. False for an unknown tag, or when the item already has the most it may. */
export function tagItem(kind: string, itemId: string, tagId: number): boolean {
  if (!Number.isInteger(tagId) || !getTag(tagId)) return false;
  const have = linksOf(kind, itemId, "attached");
  if (have.some((link) => link.tag_id === tagId)) return true;
  if (have.length >= maxTags()) return false;
  attach(kind, itemId, tagId);
  return true;
}

/** The owner takes one tag off an item (tag 0 takes them all off). */
export function untagItem(kind: string, itemId: string, tagId: number) {
  if (tagId === 0) detachAll(kind, itemId);
  else if (Number.isInteger(tagId)) detach(kind, itemId, tagId);
}

/** An item the assistant may offer tags for: it has none yet, and the owner hasn't made a call on it (Claude's own look doesn't count). */
export function canOfferTag(kind: string, itemId: string): boolean {
  if (linksOf(kind, itemId, "attached").length) return false;
  const check = checkOf(kind, itemId);
  return !check || (check.source === "ai" && check.state === "checked");
}

/** What a tap on a tag chip does: on adds it (false when full or unknown), off removes it. */
export function toggleTag(kind: string, itemId: string, tagId: number, on: boolean): boolean {
  if (on) return tagItem(kind, itemId, tagId);
  untagItem(kind, itemId, tagId);
  return true;
}

export const EMOJIS = [""];
