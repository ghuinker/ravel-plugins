import { action, argNumber, argText, js, signalText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { addTag, deleteTag, getTag, linksIn, listTags, mergeTags, renameTag, setEmoji, setHue, setPinned, isDormant } from "./db.ts";
import { queueSweep } from "./queue.ts";
import { EMOJIS, tagLabel } from "./tags.ts";
import { initialValues, saveSetting as save, settingsPanel } from "@app/settings/api.ts";
import { settings } from "./settings.ts";


// The Tags section of /settings: rename, recolor, merge and delete the tags that Claude files things under.
const NAME_MAX = 40;
const HUE_MAX = 359;
const DEFAULT_HUE = 260;

const tagId = (ctx: Ctx) => {
  const id = argNumber(ctx, "id");
  return Number.isInteger(id) && getTag(id) ? id : 0;
};
const hueOf = (value: unknown) => Math.min(Math.max(Math.round(Number(value)), 0), HUE_MAX);

export function rename(ctx: Ctx) {
  const id = tagId(ctx);
  const tag = id ? getTag(id) : undefined;
  const name = signalText(ctx, `tagname${id}`).slice(0, NAME_MAX);
  if (tag && name) renameTag(id, name);
}

export function recolor(ctx: Ctx) {
  const id = tagId(ctx);
  const hue = hueOf(ctx.signals[`taghue${id}`]);
  if (id && Number.isFinite(hue)) setHue(id, hue);
}

export function icon(ctx: Ctx) {
  const id = tagId(ctx);
  const emoji = argText(ctx, "emoji");
  if (id && EMOJIS.includes(emoji)) setEmoji(id, emoji);
}

export function pin(ctx: Ctx) {
  const id = tagId(ctx);
  if (id) setPinned(id, ctx.query.get("on") === "1");
}

export function merge(ctx: Ctx) {
  const id = tagId(ctx);
  const into = Number(ctx.signals[`tagmerge${id}`]);
  if (id && Number.isInteger(into) && getTag(into)) mergeTags(id, into);
  ctx.signals[`tagmerge${id}`] = "";
}

export function remove(ctx: Ctx) {
  const id = tagId(ctx);
  if (id) deleteTag(id);
}

export function add(ctx: Ctx) {
  const name = String(ctx.signals.newtag ?? "").trim().slice(0, NAME_MAX);
  if (!name) return;
  addTag({ name, emoji: EMOJIS[listTags().length % EMOJIS.length], hue: (DEFAULT_HUE + listTags().length * 47) % 360 });
  ctx.signals.newtag = "";
  void queueSweep(5_000); // a new tag may be where old loose items belong
}


// One tag is a row in a rounded group (emoji, name, item count); tapping it slides its details open: rename, emoji, color, merge, delete.
function row(ctx: Ctx, tag: ReturnType<typeof listTags>[number], others: typeof tag[]) {
  const count = linksIn(tag.id).length;
  return html`
    <details class="group" data-signals="${JSON.stringify({ [`tagname${tag.id}`]: tag.name, [`taghue${tag.id}`]: tag.hue, [`tagmerge${tag.id}`]: "" })}">
      <summary class="flex list-none items-center gap-3 px-4 py-3 t-hover" data-on:click="ravel.haptic('tap')">
        <span class="size-3 shrink-0 rounded-full" style="background: hsl(${tag.hue} 85% 62%)" aria-hidden="true"></span>
        <span class="min-w-0 flex-1 truncate font-medium">${tag.name}</span>
        <span class="shrink-0 text-sm t-muted">${isDormant(tag) ? "dormant · " : ""}${count}</span>
        <span class="text-xl leading-none t-muted transition-transform group-open:rotate-90">›</span>
      </summary>
      <div class="space-y-3 px-4 pb-4">
        <input data-bind:tagname${tag.id} maxlength="${NAME_MAX}" aria-label="Tag name" data-on:change="${action(ctx, "rename", { id: tag.id })}" class="t-field w-full rounded-xl border t-input px-3 py-2 font-semibold" />
        <label class="flex items-center gap-3 text-xs t-muted">Color
          <input type="range" min="0" max="${HUE_MAX}" data-bind:taghue${tag.id} data-on:change="${action(ctx, "recolor", { id: tag.id })}" class="flex-1 accent-[var(--accent)]" />
        </label>
        <label class="flex items-center justify-between gap-3 text-sm">Pin to the top
          <input type="checkbox" class="t-switch" ${tag.pinned ? "checked" : ""} aria-label="Pin to the top" data-on:change="ravel.haptic('select'); ${action(ctx, "pin", { id: tag.id, on: js("el.checked ? 1 : 0") })}" />
        </label>
        <div class="flex flex-wrap items-center gap-2">
          ${others.length ? html`<select data-bind:tagmerge${tag.id} aria-label="Merge into" data-on:change="$tagmerge${tag.id} && confirm('Merge this tag into the one you picked?') ? ${action(ctx, "merge", { id: tag.id })} : $tagmerge${tag.id} = ''" class="t-pill rounded-full border t-input px-3 py-1.5 text-sm">
            <option value="">Merge into…</option>
            ${others.map((other) => html`<option value="${other.id}">${tagLabel(other)}</option>`)}
          </select>` : ""}
          <button type="button" data-on:click="confirm('Delete this tag? Its items stay, just untagged.') && (ravel.haptic('warning'), ${action(ctx, "remove", { id: tag.id })})" class="ml-auto text-sm t-accent">Delete</button>
        </div>
      </div>
    </details>`;
}

export default (ctx: Ctx) => {
  const tags = listTags();
  return html`
    <div class="space-y-4" data-signals="${JSON.stringify({ newtag: "", ...initialValues(settings) })}">
      ${tags.length ? html`<div class="t-group">${tags.map((tag) => row(ctx, tag, tags.filter((other) => other.id !== tag.id)))}</div>`
        : html`<div class="t-group-lined p-4 text-sm t-muted">No tags yet. Add one, or Claude will suggest some overnight.</div>`}
      <form data-on:submit__prevent="ravel.haptic('success'); ${action(ctx, "add")}" class="flex gap-2">
        <input data-bind:newtag maxlength="${NAME_MAX}" placeholder="New tag…" class="t-pill min-w-0 flex-1 rounded-full border t-input px-4 py-2.5" />
        <button class="t-pill rounded-full t-accent-bg px-5 py-2.5 font-semibold">Add</button>
      </form>
      ${settingsPanel(ctx, settings, "Limits")}
    </div>`;
};

export const actions = { add, icon, merge, pin, recolor, remove, rename, save };
