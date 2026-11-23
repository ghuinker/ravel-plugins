import { assertEquals } from "jsr:@std/assert";
import { decide, type GateState, inQuietHours } from "./rules.ts";
import { type NotificationType, typeById } from "./types.ts";

const state = (over: Partial<GateState> = {}): GateState => ({ paused: false, quiet: true, quietStart: 22, quietEnd: 7, hour: 12, typeOn: () => true, ...over });
const morning: NotificationType = { id: "habits.morning", app: "Habits", label: "Morning", hint: "", fallback: true };
const reminder = await typeById("reminder");

Deno.test("quiet hours wrap midnight", () => {
  assertEquals(inQuietHours(23, 22, 7), true);
  assertEquals(inQuietHours(3, 22, 7), true);
  assertEquals(inQuietHours(7, 22, 7), false);
  assertEquals(inQuietHours(12, 22, 7), false);
  assertEquals(inQuietHours(12, 9, 17), true);
  assertEquals(inQuietHours(5, 5, 5), false);
});

Deno.test("unregistered, paused and switched-off notifications are blocked", () => {
  assertEquals(decide(undefined, state()), { send: false, reason: "not registered" });
  assertEquals(decide(morning, state()), { send: true });
  assertEquals(decide(morning, state({ typeOn: () => false })), { send: false, reason: "turned off" });
  assertEquals(decide(morning, state({ paused: true })), { send: false, reason: "all notifications paused" });
});

Deno.test("asked-for reminders ignore the type switch but not the master switch or quiet hours", () => {
  assertEquals(decide(reminder, state({ typeOn: () => false })), { send: true });
  assertEquals(decide(reminder, state({ paused: true })), { send: false, reason: "all notifications paused" });
  assertEquals(decide(reminder, state({ hour: 23 })), { send: false, reason: "quiet hours" });
  assertEquals(decide(reminder, state({ hour: 23, quiet: false })), { send: true });
});
