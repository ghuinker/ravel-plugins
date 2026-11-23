import { hourIn } from "../../lib/time.ts";
import { userZone } from "@app/settings/api.ts";

const MORNING_END = 12;
const AFTERNOON_END = 17;

export const greeting = (hour: number) => (hour < MORNING_END ? "Good morning" : hour < AFTERNOON_END ? "Good afternoon" : "Good evening");

/** The greeting and the date for the top of Home, in the owner's current time zone. */
export function hello(now = new Date()) {
  const zone = userZone();
  return { greeting: greeting(hourIn(zone, now.getTime())), date: now.toLocaleDateString("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" }) };
}
