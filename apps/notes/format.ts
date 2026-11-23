const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;

/** A note is stored as one string: the first line is the title, the rest is the text. */
export function splitBody(body: string) {
  const newline = body.indexOf("\n");
  if (newline === -1) return { title: body, text: "" };
  return { title: body.slice(0, newline), text: body.slice(newline + 1) };
}

export function joinBody({ title, text }: { title: string; text: string }) {
  return text ? `${title}\n${text}` : title;
}

const LINE_MARK = /^(?:#{1,6}\s+|>\s?|\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?|\|\s*)/;

/** A line of markdown as plain text: no list or heading marks, no bold or links, no backslashes. */
function plainLine(line: string) {
  if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(line.trim())) return "Photo";
  return line.replace(LINE_MARK, "").replace(/\|/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<\/?u>/g, "").replace(/(\*\*|~~|`)/g, "").replace(/\\(.)/g, "$1").replace(/\s+/g, " ").trim();
}

/** The note's title as plain text: its first line, or "New Note" when there is none. */
export function noteTitle(title: string) {
  return plainLine(title) || "New Note";
}

export const isBlank = (body?: string) => !body?.trim();

const TITLE_MAX_CHARS = 70;
const TITLE_AFTER_WORDS = 12;

/** A first line this long is a paragraph, not a title: the note has no title of its own. */
export function firstLineLong(body: string) {
  return plainLine(splitBody(body).title).length > TITLE_MAX_CHARS;
}

/** The note has run on long enough without a short first line that a title should be written for it. */
export function wantsTitle(body: string) {
  return firstLineLong(body) && body.trim().split(/\s+/).length >= TITLE_AFTER_WORDS;
}

/** The first line with text in it, as plain text, as shown under the title in the list. */
export function notePreview(text: string) {
  const line = text.split("\n").map((entry) => (/^```|^[\s|:-]+$/.test(entry) ? "" : plainLine(entry))).find(Boolean);
  return line ?? "No additional text";
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** The Notes app's section for a date: Today, Yesterday, Previous 7 Days, ..., then months and years. */
export function dateGroup(date: Date, now: Date) {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo <= WEEK_DAYS) return "Previous 7 Days";
  if (daysAgo <= MONTH_DAYS) return "Previous 30 Days";
  const month = date.toLocaleString("en-US", { month: "long" });
  return date.getFullYear() === now.getFullYear() ? month : String(date.getFullYear());
}

/** Time today, weekday this week, otherwise a short date, like the list rows. */
export function shortDate(date: Date, now: Date) {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (daysAgo <= 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo <= WEEK_DAYS) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

export function longDate(date: Date) {
  const day = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}
