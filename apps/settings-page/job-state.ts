import { argText } from "@ravel/action.ts";
import { job } from "@ravel/job.ts";
import type { Ctx } from "@ravel/types.ts";
import { isJobName, jobEnabled, setJobEnabled, userZone } from "@app/settings/api.ts";
import { ACTIVE, type Run } from "./run-view.ts";

const RECENT = 6;

export type JobState = { name: string; enabled: boolean; last?: Run; active?: Run; later: boolean; busy: boolean };

/** Where a job stands: its last finished run apart from the run that is queued or running now. */
export async function jobState(name: string): Promise<JobState> {
  const runs: Run[] = await job.runs(name, RECENT).catch(() => []);
  const last = runs.find((run) => !ACTIVE.includes(run.state));
  const active = runs.find((run) => ACTIVE.includes(run.state));
  // A run queued for a later time (the next scheduled one) doesn't block starting one now.
  const later = active?.state === "queued" && new Date(active.run_at).getTime() > Date.now();
  return { name, enabled: jobEnabled(name), last, active, later, busy: !!active && !later };
}

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: userZone(), month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** A short time for a list: just the clock time if it's today (in the owner's zone), else the date too. */
export function soon(iso: string): string {
  const zone = userZone();
  const day = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: zone });
  const at = new Date(iso);
  const time = at.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });
  return day(at) === day(new Date()) ? time : `${at.toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric" })}, ${time}`;
}

export function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

/** The schedule half of the status: when it runs next, or why it won't. */
export function nextText(state: JobState): string {
  const { enabled, active, later } = state;
  if (!enabled) return "Disabled";
  if (!active) return "Not scheduled";
  if (later) return `Next run ${when(active.run_at)}`;
  return active.state === "running" ? "Running now" : "Queued to run";
}

export async function run(ctx: Ctx) {
  const name = argText(ctx, "job");
  if (await isJobName(name)) await job.start(name, { apply: ctx.query.get("apply") === "1" });
}

export async function toggle(ctx: Ctx) {
  const name = argText(ctx, "job");
  await setJobEnabled(name, ctx.query.get("on") === "1");
}

export async function cancel(ctx: Ctx) {
  const id = argText(ctx, "id");
  if (/^[\w-]+$/.test(id)) await job.cancel(Number(id));
}
