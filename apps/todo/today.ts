import { userZone } from "@app/settings/api.ts";

/** Today in the owner's zone; the server's own clock is UTC. */
export function ownerToday(at = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: userZone() }).format(at);
}
