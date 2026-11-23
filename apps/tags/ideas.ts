import { action, argNumber, argText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { type Proposal } from "./db.ts";
import { acceptProposal, declineProposal } from "./proposals.ts";
import { allItems } from "./items.ts";

const TITLES_SHOWN = 4;


const ID = /^[0-9]+$/;
const ideaId = (ctx: Ctx) => (ID.test(argText(ctx, "id")) ? argNumber(ctx, "id") : 0);

// Actions for the Yes/No on a recommended tag; both fragments that show ideas re-export them.
export const acceptIdea = (ctx: Ctx) => void (ideaId(ctx) && acceptProposal(ideaId(ctx)));
export const declineIdea = (ctx: Ctx) => void (ideaId(ctx) && declineProposal(ideaId(ctx)));

/** A recommended tag from the nightly job, with Yes / No. */
export function ideaCard(ctx: Ctx, idea: Proposal, index = 0) {
  const known = allItems();
  const titles = idea.items.map((item) => known.get(`${item.kind}:${item.id}`)?.title).filter(Boolean) as string[];
  return html`
    <div class="p-card p-pop t-rise min-w-0 space-y-3 p-4" style="--hue: ${(idea.id * 47) % 360}; --i: ${index}">
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-[10px] font-semibold uppercase tracking-widest t-accent">✦ Tag idea</div>
          <div class="font-semibold t-ink">${idea.name}</div>
          ${idea.description ? html`<p class="text-xs t-muted">${idea.description}</p>` : ""}
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${titles.slice(0, TITLES_SHOWN).map((title) => html`<span class="p-chip t-muted max-w-full"><span class="min-w-0 truncate">${title}</span></span>`)}
        ${titles.length > TITLES_SHOWN ? html`<span class="p-chip t-muted">+${titles.length - TITLES_SHOWN}</span>` : ""}
      </div>
      <div class="flex gap-2">
        <button type="button" class="t-accent-bg flex-1 rounded-xl py-2 text-sm font-semibold" data-on:click="ravel.haptic('success'); ${action(ctx, "acceptIdea", { id: idea.id })}">Yes, make it</button>
        <button type="button" class="t-chip rounded-xl border px-4 py-2 text-sm t-muted" data-on:click="ravel.haptic('tap'); ${action(ctx, "declineIdea", { id: idea.id })}">No</button>
      </div>
    </div>`;
}
