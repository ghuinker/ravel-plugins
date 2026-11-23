import { action } from "@ravel/action.ts";
import { html, raw } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { renderMarkdown } from "@app/design-system/api.ts";
import { userZone } from "@app/settings/api.ts";

export const ACTIVE = ["queued", "running"];

// deno-lint-ignore no-explicit-any
export type Run = any;

export const button = "t-pill border t-chip px-3 py-1.5 text-xs font-semibold";

// Opens a new chat tab with the prompt pointing at this run's report, so a follow-up can start from it.
function replyAction(jobName: string, run: Run) {
  const id = Number(run.id);
  const reference = `[Report: ${jobName} #${id}] `;
  return `ravelChat.ask(${JSON.stringify(reference)})`;
}

export function runView(ctx: Ctx, jobName: string, run: Run) {
  const active = ACTIVE.includes(run.state);
  const text = run.error || (typeof run.result === "string" ? run.result : run.result ? JSON.stringify(run.result, null, 2) : "");
  return html`
    <div class="t-widget p-4 text-xs space-y-2">
      <div class="flex justify-between gap-2">
        <span class="${run.state === "failed" ? "t-accent" : "t-muted"} font-semibold uppercase tracking-widest">${run.state}</span>
        <span class="t-muted">${run.run_at ? new Date(run.run_at).toLocaleString("en-US", { timeZone: userZone() }) : ""}</span>
      </div>
      ${run.message ? html`<div class="t-muted">${run.message}</div>` : ""}
      ${active ? html`<button data-on:click="${action(ctx, "cancel", { id: run.id })}" class="${button}">Stop</button>` : ""}
      ${text ? html`<details data-ignore-morph><summary class="t-accent">Report</summary><div class="md mt-2">${raw(renderMarkdown(text))}</div><button type="button" data-on:click="${replyAction(jobName, run)}" class="${button} mt-3">Reply</button></details>` : ""}
    </div>`;
}

