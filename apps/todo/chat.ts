// A message starting with "todo:" adds tasks (one per comma, or one task for several lines) instead of going to the AI.
import { ref } from "@ravel/slot.ts";
import type { HookResult } from "@ravel/chat.ts";
import { addTodo } from "./db.ts";
import { queueTriage } from "./queue.ts";
import { queueSweep } from "@app/tags/api.ts";

const PREFIX = /^todo:\s*/i;
const LOW = 0;
const NEW_TASK_SWEEP_MS = 3000;

export function todoHook({ text }: { text: string }): HookResult | void {
  if (!PREFIX.test(text)) return;
  const message = text.replace(PREFIX, "").trim();
  if (!message) return { cancel: true, error: "Nothing to add after todo:." };
  // Several lines are one task (first line the title, the rest notes); the sort job decides whether it was really a list.
  const lines = message.split("\n").map((line) => line.trim()).filter(Boolean);
  const bodies = lines.length > 1 ? [lines[0]] : message.split(",").map((part) => part.trim()).filter(Boolean);
  if (lines.length > 1) addTodo(lines[0], undefined, Date.now(), { priority: LOW, lane: "unsorted", notes: lines.slice(1).join("\n") });
  else for (const body of bodies) addTodo(body, undefined, Date.now(), { priority: LOW, lane: "unsorted" });
  void queueTriage();
  void queueSweep(NEW_TASK_SWEEP_MS);
  return { handled: true, reply: "Added to your list: " + bodies.join(", ") + ".", refresh: [ref(import.meta, "./index")] };
}
