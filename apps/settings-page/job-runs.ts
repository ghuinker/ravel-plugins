import { action } from "@ravel/action.ts";
import { backTo } from "@app/design-system/api.ts";
import { html } from "@ravel/html.ts";
import { job, live } from "@ravel/job.ts";
import type { Ctx } from "@ravel/types.ts";
import { listJobs } from "@app/settings/api.ts";
import { ago, jobState, nextText } from "./job-state.ts";
import { type Run, runView } from "./run-view.ts";
import { cancel, run, toggle } from "./job-state.ts";

const RUNS_SHOWN = 30;

export { cancel, run, toggle } from "./job-state.ts";

// The run list may leave out result and error; status has them.
async function loadRuns(name: string): Promise<Run[]> {
  const listed: Run[] = await job.runs(name, RUNS_SHOWN).catch(() => []);
  return Promise.all(listed.map(async (run) => ({ ...run, ...(await job.status(run.id).catch(() => null)) })));
}

const row = "flex items-center justify-between gap-3 px-4 py-3";

export default async (ctx: Ctx) => {
  const name = ctx.params.job ?? "";
  const found = (await listJobs()).find((file) => file.name === name);
  if (!found) return html`<p class="t-muted">No such job.</p>`;
  const [runs, state] = await Promise.all([loadRuns(name), jobState(name)]);
  const description = found.description;
  const start = (apply: boolean) => `ravel.haptic('tap'); ${action(ctx, "run", { job: name, apply: apply ? 1 : 0 })}`;
  const can = state.enabled && !state.busy;
  const runButton = (label: string, run: string, off = false) => html`<button type="button" ${off ? "disabled" : ""} data-on:click="${run}" class="${row} w-full text-left t-accent disabled:opacity-40"><span class="font-medium">${label}</span></button>`;
  return html`
    <section class="space-y-5 ask-item" ${live(ctx)}>${backTo("/settings/background")}
      <div class="px-1"><h1 class="ask-title t-title text-3xl">${name}</h1>${description ? html`<p class="mt-1 text-sm t-muted">${description}</p>` : ""}</div>
      <div class="t-group-lined">
        <label class="${row}"><span class="font-medium">Enabled</span>
          <input type="checkbox" aria-label="Enabled" ${state.enabled ? "checked" : ""} class="t-switch"
            data-on:change="ravel.haptic('select'); ${action(ctx, "toggle", { job: name, on: state.enabled ? 0 : 1 })}" /></label>
        <div class="${row}"><span>Next run</span><span class="text-sm t-muted">${nextText(state).replace(/^Next run /, "")}</span></div>
        <div class="${row}"><span>Last run</span><span class="text-sm ${state.last?.state === "failed" ? "t-accent" : "t-muted"}">${state.last ? `${ago(state.last.run_at)} · ${state.last.state}` : "Never"}</span></div>
      </div>
      <div class="t-group-lined">
        ${runButton("Run now", start(true), !can)}
        ${runButton("Preview (changes nothing)", start(false), !can)}
        ${runButton("Ask AI", `ravel.haptic('tap'); ravelAsk(el, 'job', '${name}')`)}
      </div>
      <div class="space-y-2">
        <div class="t-title px-1">Runs</div>
        ${runs.length ? runs.map((run) => runView(ctx, name, run)) : html`<p class="px-1 text-sm t-muted">No runs yet.</p>`}
      </div>
    </section>`;
};

export const actions = { cancel, run, toggle };
