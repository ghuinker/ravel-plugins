import type { Ctx } from "@ravel/types.ts";
import { refreshWidgets, type Widget } from "@ravel/notify.ts";
import { hstack, item, key, list, open, post, spacer, text, toggle, vstack } from "@ravel/ui.ts";
import { eventsBetween } from "./links.ts";
import { completeTask, listTodayTasks } from "./db.ts";
import { ownerToday } from "./today.ts";
import { addDays, dateIn, dayStart, formatTime } from "../../lib/time.ts";
import { userZone } from "@app/settings/api.ts";

const ROWS = { small: 3, medium: 4, large: 9 };

/** Widget action: checks a task off like the Todo page does (a repeating one moves to its next date). */
export async function done(ctx: Ctx) {
  const id = String(ctx.signals.id ?? "");
  if (id && ctx.signals.done === true) completeTask(id, ownerToday(ctx.at), ctx.at);
  await refreshWidgets();
}

/** The next event that hasn't ended yet today, as "3:30 PM Standup"; empty when there is none. */
function nextEvent(at: number): string {
  const zone = userZone();
  const tomorrow = dayStart(addDays(dateIn(at, zone), 1), zone);
  const event = eventsBetween(at, tomorrow).find((entry) => !entry.allDay);
  return event ? `${formatTime(event.start, zone)}  ${event.title}` : "";
}

export const widget: Widget = (ctx, { size }) => {
  const tasks = listTodayTasks(ownerToday(ctx.at));
  const shown = tasks.slice(0, ROWS[size]);
  const event = size === "small" ? "" : nextEvent(ctx.at);
  const more = tasks.length - shown.length;
  return vstack(
    { spacing: 6, align: "leading" },
    hstack(text("Today", "headline", { tone: "accent" }), spacer(), text(tasks.length ? `${tasks.length} to do` : "All clear", "caption", { tone: "muted" })),
    ...(event ? [text(event, "caption", { tone: "muted" })] : []),
    list(
      "_today",
      Object.fromEntries(shown.map((task) => [task.id, { body: task.body, done: false }])),
      hstack(toggle(item("done"), [post("done", { id: key(), done: item("done") })]), text(item("body"))),
      { tap: [open("/todo")], empty: "Nothing due today" },
    ),
    ...(more > 0 ? [text(`+${more} more`, "caption", { tone: "muted" })] : []),
  );
};

export const actions = { done };
