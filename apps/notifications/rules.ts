import type { NotificationType } from "./types.ts";

export type Verdict = { send: true } | { send: false; reason: string };

export type GateState = {
  paused: boolean;
  quiet: boolean;
  quietStart: number;
  quietEnd: number;
  /** The hour (0 to 23) in the owner's zone. */
  hour: number;
  typeOn: (type: NotificationType) => boolean;
};

/** A window that may wrap midnight (22 to 7). Equal start and end means no window. */
export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** The one decision: unregistered, paused, quiet hours, then the type's own switch (asked-for types have none). */
export function decide(type: NotificationType | undefined, state: GateState): Verdict {
  if (!type) return { send: false, reason: "not registered" };
  if (state.paused) return { send: false, reason: "all notifications paused" };
  if (state.quiet && inQuietHours(state.hour, state.quietStart, state.quietEnd)) return { send: false, reason: "quiet hours" };
  if (!type.asked && !state.typeOn(type)) return { send: false, reason: "turned off" };
  return { send: true };
}
