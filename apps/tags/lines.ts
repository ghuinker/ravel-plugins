// What Tags tells the assistant: for each tag, what is open, what moved lately, and which ones have gone quiet.
import { linksIn, listTags } from "./db.ts";
import { allItems } from "./items.ts";

const DAY_MS = 86_400_000;
const QUIET_AFTER_DAYS = 10;
const TAGS_SEEN = 6;
const TASKS_NAMED = 2;

export function tagLines(now = Date.now()): string[] {
  const items = allItems();
  const lines = listTags().map((tag) => {
    const tasks = linksIn(tag.id).flatMap((link) => link.kind === "todo" ? items.get(`todo:${link.item_id}`) ?? [] : []);
    const open = tasks.filter((task) => !task.done);
    const touched = Math.max(tag.created_at, ...tasks.map((task) => task.at));
    const quietDays = Math.floor((now - touched) / DAY_MS);
    const named = open.slice(0, TASKS_NAMED).map((task) => task.title).join("; ");
    const state = !open.length ? "no open tasks" : `${open.length} open task${open.length === 1 ? "" : "s"}${named ? ` (e.g. ${named})` : ""}`;
    const quiet = quietDays >= QUIET_AFTER_DAYS ? `, QUIET for ${quietDays} days` : "";
    return { quietDays, line: `[${tag.id}] ${tag.name}: ${state}${quiet}` };
  });
  return lines.sort((first, second) => second.quietDays - first.quietDays).slice(0, TAGS_SEEN).map((entry) => entry.line);
}
