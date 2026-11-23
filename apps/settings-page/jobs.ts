import { action } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import { live } from "@ravel/job.ts";
import type { Ctx } from "@ravel/types.ts";
import { swipeRow } from "@app/design-system/api.ts";
import { listJobs } from "@app/settings/api.ts";
import { ago, type JobState, jobState, nextText, soon } from "./job-state.ts";
import { cancel, run, toggle } from "./job-state.ts";

export { cancel, run, toggle } from "./job-state.ts";

// What each job is for, so 20-odd rows read as a few short lists. A job not listed lands in Other.
const GROUPS: [string, string[]][] = [
  ["Sync", ["sync-calendar", "sync-workouts", "since-sync", "git-sync"]],
  ["Sorting and tags", ["tag-sweep", "tag-suggest", "tag-rank", "todo-sort", "planit-sort"]],
  ["Planit", ["planit-discover", "planit-help", "planit-explore"]],
  ["Reminders", ["planit-nudge", "habits-nudge"]],
  ["Assistant and chats", ["assistant-brief", "patterns-learn", "memory-change", "daily-picks", "since-sort", "chat-summaries"]],
  ["Housekeeping", ["cleanup", "theme-schedule"]],
];

const failed = (state: JobState) => state.last?.state === "failed";

/** One short line: when it last ran (or failed), then when it runs next; "Running now" or "Disabled" replace it. */
function statusLine(state: JobState) {
  if (!state.enabled) return "Disabled";
  if (state.active && !state.later) return nextText(state);
  const ran = state.last ? `${failed(state) ? "Failed" : "Ran"} ${ago(state.last.run_at)}` : "Never run";
  return state.later && state.active ? `${ran} · next ${soon(state.active.run_at)}` : ran;
}

function jobRow(ctx: Ctx, file: { name: string }, state: JobState) {
  const start = (apply: boolean) => `ravel.haptic('tap'); ${action(ctx, "run", { job: file.name, apply: apply ? 1 : 0 })}`;
  const can = state.enabled && !state.busy;
  return swipeRow({
    key: `job-${file.name}`,
    actions: can ? [
      { label: "Run now", icon: "▶", run: start(true) },
      { label: "Preview", icon: "eye", run: start(false), swipe: false },
    ] : [],
    ask: { kind: "job", id: file.name },
    contentClass: "px-0",
    content: html`<div class="flex items-center gap-3 px-4 py-3">
      <a href="/settings/background/${file.name}" data-on:click="ravel.haptic('tap')" class="flex min-w-0 flex-1 items-center">
        <span class="min-w-0 flex-1">
          <span class="ask-title block truncate font-medium ${state.enabled ? "" : "t-muted"}">${file.name}</span>
          <span class="flex items-center gap-1 text-xs ${failed(state) && state.enabled ? "t-accent" : "t-muted"}">${failed(state) && state.enabled ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5 shrink-0" role="img" aria-label="Last run failed"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>` : ""}<span class="truncate">${statusLine(state)}</span></span>
        </span>
      </a>
      <input type="checkbox" aria-label="${file.name} enabled" ${state.enabled ? "checked" : ""} class="t-switch"
        data-on:change="ravel.haptic('select'); ${action(ctx, "toggle", { job: file.name, on: state.enabled ? 0 : 1 })}" />
    </div>`,
  });
}

export default async (ctx: Ctx) => {
  const files = await listJobs();
  const states = new Map(await Promise.all(files.map(async (file) => [file.name, await jobState(file.name)] as const)));
  const byName = new Map(files.map((file) => [file.name, file]));
  const placed = new Set(GROUPS.flatMap(([, names]) => names));
  const groups = [...GROUPS, ["Other", files.map((file) => file.name).filter((name) => !placed.has(name))] as [string, string[]]]
    .map(([title, names]) => [title, names.filter((name) => byName.has(name))] as const)
    .filter(([, names]) => names.length);

  const all = [...states.values()];
  const running = all.filter((state) => state.active?.state === "running").length;
  const failing = all.filter((state) => state.enabled && failed(state)).length;
  const off = all.filter((state) => !state.enabled).length;
  const summary = [`${all.length} jobs`, running ? `${running} running` : "", failing ? `${failing} failing` : "", off ? `${off} disabled` : ""].filter(Boolean).join(" · ");

  return html`
    <div class="space-y-5" ${live(ctx)}>
      <div class="px-1 text-xs t-muted">${summary}</div>
      ${files.length ? groups.map(([title, names]) => html`
        <section class="space-y-2">
          <div class="t-title px-1">${title}</div>
          <div class="t-group">${names.map((name) => jobRow(ctx, byName.get(name)!, states.get(name)!))}</div>
        </section>`) : html`<p class="px-1 text-sm t-muted">No jobs registered in any app.ts yet.</p>`}
    </div>`;
};

export const actions = { cancel, run, toggle };
