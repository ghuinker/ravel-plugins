import { action, selfURL } from "@ravel/action.ts";
import { html, raw } from "@ravel/html.ts";
import { renderMarkdown } from "@app/design-system/api.ts";
import type { Ctx } from "@ravel/types.ts";
import { backupInstructions, INSTRUCTIONS_FILE, readInstructions, restoreInstructions, writeInstructions } from "./instructions-file.ts";

// Shown once on the next render.
let notice = "";

export function save(ctx: Ctx) {
  const text = String(ctx.signals.claudemd ?? "");
  notice = writeInstructions(text) ? "Saved. The previous version is kept for Revert." : "That couldn't be saved (empty or too long).";
}

export function revert() {
  notice = restoreInstructions() ? "Reverted to the version before your last save." : "No earlier version to go back to.";
}

const ASK_REVIEW = "Read my CLAUDE.md and suggest what to add, tighten or remove. Only propose changes; do not edit it until I say which ones.";
const ASK_CHANGE = "Change my CLAUDE.md: ";

const askButton = (label: string, text: string, primary = false) => html`
  <button type="button" data-on:click="ravel.haptic('tap'); ravelChat.ask('${text}')" class="t-pill rounded-full px-5 py-2 font-bold ${primary ? "t-accent-bg" : "border t-chip t-hover"}">${label}</button>`;

export default (ctx: Ctx) => {
  const message = notice;
  notice = "";
  const hasBackup = backupInstructions() !== undefined;
  return html`
    <div class="space-y-4" data-signals="{editinstr: false}">
      <div class="flex flex-wrap items-center gap-2">
        ${askButton("Ask Claude to improve it", ASK_REVIEW, true)}
        ${askButton("Ask for a change…", ASK_CHANGE)}
        <button type="button" data-on:click="$editinstr = !$editinstr" class="ml-auto text-sm t-muted underline" data-text="$editinstr ? 'Back to read-only' : 'Edit by hand'"></button>
      </div>
      ${message ? html`<p class="text-sm t-accent">${message}</p>` : ""}
      <div data-show="!$editinstr" class="md t-group p-5">${raw(renderMarkdown(readInstructions()))}</div>
      <div data-show="$editinstr" style="display:none" class="space-y-3">
        <textarea data-bind:_claudemd rows="26" spellcheck="false" class="t-field w-full rounded-2xl border t-input p-4 font-mono text-xs leading-relaxed">${readInstructions()}</textarea>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" data-on:click="@post('${selfURL(ctx, { action: "save" })}', {payload: {claudemd: $_claudemd}})" class="t-pill rounded-full px-5 py-2 font-bold t-accent-bg">Save</button>
          ${hasBackup ? html`<button type="button" data-on:click="confirm('Go back to the version before your last save?') && ${action(ctx, "revert")}" class="t-pill rounded-full border t-chip px-5 py-2 font-bold t-hover">Revert last save</button>` : ""}
        </div>
      </div>
    </div>`;
};

export const actions = { revert, save };
