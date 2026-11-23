// Tasks that belong to another app. Each app lists what it wants in the todo list with `syncLinkedTasks` (db.ts) and ends up here:
// the label and icon on the chip, and (for tasks with `tick`) what the checkbox does. Add a line to SOURCES for each new app.
import { linkedTask } from "./db.ts";

export type Source = { label: string; icon: string; tick?: (ref: string, today: string) => void };

export const SOURCES: Record<string, Source> = {
  planit: { label: "Planit", icon: "calendar-days" },
  // habits: { label: "Habits", icon: "fire", tick: (ref, today) => logHabit(ref, today) },
};

export const sourceChip = (source: string) => {
  const found = SOURCES[source];
  return found ? found.label : source;
};

/** The owner ticked a linked task here. Only tasks that opted in (`tick`) and whose app can do it are handled; others just open the app. */
export function tickLinked(id: string, today: string): boolean {
  const task = linkedTask(id);
  const tick = task?.tick ? SOURCES[task.source]?.tick : undefined;
  if (!task || !tick || task.done) return false;
  tick(task.ref, today);
  return true;
}
