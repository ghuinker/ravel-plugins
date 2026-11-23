import { action, argText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import { job, live } from "@ravel/job.ts";
import type { Run } from "@ravel/job.ts";
import type { Ctx } from "@ravel/types.ts";
import { isMemoryFile, listMemories } from "./memory-files.ts";
import type { Memory } from "./memory-files.ts";

const TYPE_ORDER = ["user", "feedback", "project", "reference"];
const TYPE_LABELS: Record<string, string> = { user: "About you", feedback: "How you like to work", project: "Projects", reference: "References" };

// The file name is checked against a strict pattern, so it is safe in a signal name and a URL.
const signal = (file: string) => `mem_${file.replace(/\.md$/, "").replaceAll("-", "_")}`;

const JOB = "memory-change";
const RUNS_LOOKED_AT = 20;

// The site can't write to Claude's memory folder (its changes never reach the real files), so Save and Forget start
// a background job: a Claude run, which can. The fragment is live, so it refreshes when the job finishes.

export async function save(ctx: Ctx) {
  const file = argText(ctx, "file");
  if (isMemoryFile(file)) await job.start(JOB, { file, kind: "save", text: String(ctx.signals[signal(file)] ?? "") });
}

export async function forget(ctx: Ctx) {
  const file = argText(ctx, "file");
  if (isMemoryFile(file)) await job.start(JOB, { file, kind: "forget" });
}

const spinner = html`<svg class="mr-2 inline h-4 w-4 animate-spin align-[-3px]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

type Work = { busy: Map<string, string>; failed: Map<string, string> };

const card = (ctx: Ctx, memory: Memory, work: Work) => {
  const doing = work.busy.get(memory.file);
  const off = work.busy.size ? "disabled" : "";
  const label = (kind: string, text: string) => (doing === kind ? html`${spinner}${doing === "forget" ? "Forgetting…" : "Saving…"}` : text);
  return html`
  <details class="group">
    <summary class="flex list-none items-center gap-3 px-4 py-3 t-hover">
      <div class="min-w-0 flex-1">
        <div class="truncate font-semibold">${memory.name}</div>
        <div class="line-clamp-2 text-sm t-muted">${memory.description}</div>
      </div>
      <span class="shrink-0 text-xl leading-none t-muted transition-transform group-open:rotate-90">›</span>
    </summary>
    <div class="space-y-2 px-4 pb-3">
      <textarea data-bind:${signal(memory.file)} rows="10" spellcheck="false" ${doing ? "readonly" : ""} class="t-field w-full rounded-2xl border t-input p-3 font-mono text-xs">${memory.text}</textarea>
      ${work.failed.has(memory.file) ? html`<p class="text-sm t-muted">That didn't work: ${work.failed.get(memory.file)}</p>` : ""}
      <div class="flex gap-2">
        <button type="button" ${off} data-on:click="ravel.haptic('success'); ${action(ctx, "save", { file: memory.file })}" class="t-pill rounded-full px-5 py-2 text-sm font-bold t-accent-bg disabled:opacity-60">${label("save", "Save")}</button>
        <button type="button" ${off} data-on:click="confirm('Forget this?') && (ravel.haptic('warning'), ${action(ctx, "forget", { file: memory.file })})" class="t-pill t-chip rounded-full border px-5 py-2 text-sm font-bold t-accent disabled:opacity-60">${label("forget", "Forget")}</button>
      </div>
    </div>
  </details>`;
};

const group = (ctx: Ctx, type: string, memories: Memory[], work: Work) => html`
  <div class="space-y-1.5">
    <h2 class="px-4 text-xs font-medium uppercase tracking-wide t-muted">${TYPE_LABELS[type] ?? type}</h2>
    <div class="t-group">${memories.map((memory) => card(ctx, memory, work))}</div>
  </div>`;

export default async (ctx: Ctx) => {
  const memories = listMemories();
  if (!memories) return html`<p class="t-group-lined p-5 t-muted">Memory isn't available from the site right now.</p>`;
  if (!memories.length) return html`<p class="t-group-lined p-5 t-muted">Nothing remembered yet. Tell Claude in the chat what to remember and it shows up here.</p>`;
  const runs: Run[] = await job.runs(JOB, RUNS_LOOKED_AT).catch(() => []);
  const work: Work = { busy: new Map(), failed: new Map() };
  const seen = new Set<string>();
  for (const run of [...runs].reverse()) {
    const { file, kind } = run.args as { file: string; kind: string };
    if (run.state === "queued" || run.state === "running") work.busy.set(file, kind);
  }
  for (const run of runs) {
    const { file } = run.args as { file: string };
    if (seen.has(file)) continue;
    seen.add(file);
    if (run.state === "failed") work.failed.set(file, run.error);
  }
  const types = [...new Set([...TYPE_ORDER, ...memories.map((memory) => memory.type)])];
  return html`
    <div class="space-y-6" ${live(ctx)}>
      ${types.map((type) => {
        const inType = memories.filter((memory) => memory.type === type);
        return inType.length ? group(ctx, type, inType, work) : "";
      })}
    </div>`;
};

export const actions = { forget, save };
