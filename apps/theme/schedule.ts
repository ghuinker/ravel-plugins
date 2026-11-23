// Every 10 minutes: dark mode from sunset to sunrise where the owner is, light the rest of the day. Acts only when the period changes, so a hand-picked mode sticks until the next switch.
import { cron } from "@ravel/job.ts";
import type { JobCtx } from "@ravel/types.ts";
import { state, userZone } from "@app/settings/api.ts";
import { settings } from "./settings.ts";
import { setPick } from "./picks.ts";
import { writeTheme } from "@app/design-system/api.ts";
import { isNight } from "./sun.ts";

const kv = state(import.meta);

export const schedule = cron("*/10 * * * *");

export default async function (_ctx: JobCtx) {
  if (!settings.get("auto")) return { changed: false };
  const period = isNight(Date.now(), userZone()) ? "night" : "day";
  if (kv.get("period") === period) return { changed: false, period };
  kv.set("period", period);
  setPick("mode", period === "day" ? "light" : "dark");
  await writeTheme();
  return { changed: true, period };
}
