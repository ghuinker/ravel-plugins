import { html } from "@ravel/html.ts";
import { kebab, askAction, kebabOptions } from "@app/design-system/api.ts";
import { tagsOf, type Tag } from "@app/tags/api.ts";
import { longWhen, minutesLabel, money, plural } from "./format.ts";
import { chatActions, openChat, tagChips } from "./list.ts";
import type { ChatRow } from "./stats.ts";

const fact = (label: string, value: string) => html`<div class="flex justify-between gap-3 px-4 py-2.5 text-sm"><span class="t-muted">${label}</span><b class="t-ink text-right">${value}</b></div>`;

/** The card beside the list (desktop) for the picked chat; one per chat, shown while it is `$sel`. Its ⋮ menu is the only one for a chat. */
export function preview(name: string, row: ChatRow, tags: Tag[], zone: string, index: number) {
  const have = tagsOf("chat", row.id);
  const menu = kebab(`cv-${index}`, kebabOptions([...chatActions(name, row, tags.length > 0, true), askAction("chat", row.id)]));
  return html`
    <div class="ask-item space-y-3" data-show="$sel === '${row.id}'" style="display:none">
      <div class="flex items-center justify-between gap-2 px-1">
        <button type="button" data-on:click="ravel.haptic('tap'); $sel = ''" class="t-accent">‹ Overview</button>
        ${menu}
      </div>
      <div class="t-card space-y-3 rounded-2xl border p-4">
        <h2 class="ask-title break-words text-lg font-semibold t-ink">${row.title}</h2>
        ${row.summary ? html`<p class="text-sm t-ink">${row.summary}</p>` : ""}
        ${row.firstAsk ? html`<div class="text-sm"><div class="text-xs uppercase tracking-wide t-muted">You asked</div><p class="t-ink">${row.firstAsk}</p></div>` : ""}
        ${row.preview ? html`<div class="text-sm"><div class="text-xs uppercase tracking-wide t-muted">Last reply</div><p class="t-ink">${row.preview}</p></div>` : ""}
        ${row.touched.length ? html`<div class="flex flex-wrap gap-1.5">${row.touched.map((app) => html`<span class="t-pill t-accent-tint px-2.5 py-0.5 text-xs">${app}</span>`)}</div>` : ""}
        <button type="button" data-on:click="ravel.haptic('success'); ${openChat(row.id)}" class="t-pill t-accent-bg w-full px-4 py-2.5 font-medium">Continue this chat</button>
      </div>
      <div class="t-group" style="--t-inset:1rem">
        ${fact("Started", longWhen(row.startedAt, zone))}
        ${fact("Messages", `${plural(row.sent, "sent")}, ${row.messages} in all`)}
        ${fact("Time", minutesLabel(row.activeMinutes))}
        ${fact("Cost", row.costUsd ? money(row.costUsd) : "None logged")}
        ${tags.length ? html`<div class="space-y-2 px-4 py-2.5 text-sm"><span class="t-muted">Tags</span>
          <div class="flex flex-wrap gap-2">${tagChips(name, row.id, tags, have)}</div></div>` : ""}
      </div>
    </div>`;
}
