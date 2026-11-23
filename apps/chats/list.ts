import { action } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import { type RowAction, swipeRow } from "@app/design-system/api.ts";
import { maxTags, tagLabel, tagsOf, type Tag } from "@app/tags/api.ts";
import { groupOf, whenLabel } from "./format.ts";
import type { ChatRow } from "./stats.ts";

const ICONS = {
  search: "m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
};
export const icon = (path: string, size = "size-5") => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${size} shrink-0"><path d="${path}" /></svg>`;

// Chat ids are UUIDv7 (checked by isChatId), so they are safe inside an expression.
export const openChat = (id: string) =>
  `$chatOpen = true, ravelChat.open('${id}'), setTimeout(() => document.querySelector('#claude-panel ravel-chat')?.focus(), 50)`;

const MAX_CHIPS = 2;
const chip = "t-pill t-accent-tint px-2.5 py-0.5 text-xs";

export function filterGroup(rows: ChatRow[], tags: Tag[], tagIds: Map<string, number[]>) {
  const live = rows.filter((row) => !row.hidden && !row.system);
  const option = (label: string, value: string, count: number) => html`
    <button data-on:click="ravel.haptic('select'); $cf = '${value}'; $fmenu = false" data-class="{'t-active': $cf === '${value}', 't-hover': $cf !== '${value}'}" class="flex w-full items-center gap-2 px-4 py-2.5 text-left">
      <span class="flex-1 truncate">${label}</span><span class="text-sm opacity-60">${count}</span>
    </button>`;
  return html`<div class="t-group t-group-flat">
    ${option("All chats", "all", live.length)}
    ${option("Pinned", "pinned", live.filter((row) => row.pinned).length)}
    ${option("Changed the site", "changed", live.filter((row) => row.touched.length).length)}
    ${option("Had an error", "errored", live.filter((row) => row.errored).length)}
    ${tags.map((tag) => option(tagLabel(tag), `tag-${tag.id}`, live.filter((row) => tagIds.get(row.id)?.includes(tag.id)).length))}
    ${option("System", "system", rows.filter((row) => row.system && !row.hidden).length)}
    ${option("Hidden", "hidden", rows.filter((row) => row.hidden).length)}
  </div>`;
}

export function toolbar(filters: ReturnType<typeof html>) {
  return html`
    <div data-filter class="relative space-y-3">
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          ${icon(ICONS.search, "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 t-muted")}
          <input data-bind:cq type="search" placeholder="Search chats" class="t-pill w-full rounded-full border t-input py-2.5 pl-10 pr-4 outline-none" />
        </div>
        <button data-on:click="ravel.haptic('tap'); $fmenu = !$fmenu" aria-label="Filter" data-class="{'t-active': $fmenu || $cf !== 'all'}" class="t-pill flex size-11 shrink-0 items-center justify-center rounded-full border t-chip">${icon(ICONS.filter)}</button>
      </div>
      <div class="cv-filter" data-class="{'hidden': !$fmenu}" data-on:click__window="evt.target.closest('[data-filter]') || ($fmenu = false)">${filters}</div>
    </div>`;
}

/**
 * One chip per tag that toggles it on the chat. A chat that already has the most tags it may dims the rest and buzzes instead.
 * `after` runs once a tag was picked, e.g. to close the row that slid open.
 */
export function tagChips(name: string, id: string, tags: Tag[], have: Tag[], after = "") {
  const full = have.length >= maxTags();
  const pick = (value: number, label: string, on: boolean) => {
    const blocked = !on && value !== 0 && full;
    const run = blocked ? "ravel.haptic('warning')" : `ravel.haptic('select'); ${after}${action(name, "setTag", { id, tag: value, on: on || value === 0 ? 0 : 1 })}`;
    return html`<button type="button" data-on:click="${run}" class="${chip} ${on ? "t-active" : "t-chip"} ${blocked ? "opacity-50" : ""}">${label}</button>`;
  };
  return html`${pick(0, "No tag", have.length === 0)}${tags.map((tag) => pick(tag.id, tagLabel(tag), have.some((one) => one.id === tag.id)))}`;
}

/** Tag chips that slide open under a row (the phone's way to tag a chat by hand). */
function tagPicker(name: string, id: string, tags: Tag[], have: Tag[]) {
  return html`<div class="t-expand" data-class="{'is-open': $tagrow === '${id}'}"><div><div class="flex flex-wrap gap-2 px-4 pb-3">
    ${tagChips(name, id, tags, have, "$tagrow = ''; ")}
  </div></div></div>`;
}

/** What can be done to a chat: swipe buttons on a phone, the ⋮ menu with a mouse, and the preview card's menu. */
export function chatActions(name: string, row: ChatRow, hasTags: boolean, inPreview = false): RowAction[] {
  const flag = (on: boolean) => (on ? "1" : "0");
  return [
    { label: row.pinned ? "Unpin" : "Pin", icon: "bookmark", side: "leading", run: `ravel.haptic('tap'); ${action(name, "pin", { id: row.id, on: flag(!row.pinned) })}` },
    ...(hasTags && !inPreview ? [{ label: "Tag", icon: "tag", run: `$tagrow = $tagrow === '${row.id}' ? '' : '${row.id}'` }] : []),
    row.hidden
      ? { label: "Restore", icon: "↩︎", run: action(name, "hide", { id: row.id, on: 0 }) }
      : { label: "Hide", icon: "eye-slash", danger: true, run: `${action(name, "hide", { id: row.id, on: 1 })}${inPreview ? "; $sel = ''" : ""}` },
  ];
}

export function item(name: string, row: ChatRow, tags: Tag[], zone: string) {
  const have = tagsOf("chat", row.id);
  const flag = (on: boolean) => (on ? "1" : "0");
  const lines = row.summary || row.preview || row.firstAsk;
  const extra = row.touched.length - MAX_CHIPS;
  const tapped = `ravel.haptic('tap'); convView.wide() ? $sel = '${row.id}' : (${openChat(row.id)})`;
  const flags = `data-chat-row data-cv-hidden="${flag(row.hidden)}" data-cv-system="${flag(row.system)}" data-cv-pinned="${flag(row.pinned)}" data-cv-changed="${flag(row.touched.length > 0)}" data-cv-errored="${flag(row.errored)}" data-cv-tags=",${have.map((tag) => tag.id).join(",")}," data-show="convView.show($cq, $cf, el)"`;
  return swipeRow({
    key: `r-${row.id}`,
    attrs: flags,
    actions: chatActions(name, row, tags.length > 0),
    ask: { kind: "chat", id: row.id },
    content: html`
      <button type="button" data-on:click="${tapped}" data-class="{'t-active': $sel === '${row.id}'}" class="cv-open block w-full px-4 py-3 text-left">
        <span class="flex items-baseline gap-2">
          <span class="ask-title line-clamp-2 min-w-0 flex-1 break-words font-medium t-ink">${row.title}</span>
          <span class="shrink-0 text-xs t-muted">${whenLabel(row.updatedAt, zone)}</span>
        </span>
        ${lines ? html`<span class="mt-0.5 line-clamp-2 block text-sm t-muted">${lines}</span>` : ""}
        <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
          ${have.map((tag) => html`<span class="${chip}">${tagLabel(tag)}</span>`)}
          ${row.touched.slice(0, MAX_CHIPS).map((app) => html`<span class="${chip}">${app}</span>`)}
          ${extra > 0 ? html`<span class="${chip}">+${extra}</span>` : ""}
          ${row.system ? html`<span class="${chip}">system</span>` : ""}
          ${row.errored ? html`<span class="${chip}">error</span>` : ""}
        </span>
      </button>`,
    after: html`${tagPicker(name, row.id, tags, have)}<span class="conv-hay" hidden>${row.title} ${row.summary} ${row.haystack}</span>`,
  });
}

/** Pinned first, then one titled group per day range or month, each a flat rounded group; hidden chats last. */
export function sections(name: string, rows: ChatRow[], tags: Tag[], zone: string) {
  const order: string[] = [];
  const groups = new Map<string, ChatRow[]>();
  for (const row of rows) {
    const key = row.hidden ? "Hidden" : row.pinned ? "Pinned" : groupOf(row.startedAt, zone);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  for (const key of ["Pinned", ...groups.keys()].filter((key, index, all) => key !== "Hidden" && groups.has(key) && all.indexOf(key) === index)) order.push(key);
  if (groups.has("Hidden")) order.push("Hidden");
  return order.map((key) => html`
    <section data-show="convView.any($cq, $cf, el)" class="space-y-2">
      <h2 class="t-title px-1 text-base">${key}</h2>
      <div class="t-group t-group-flat">${groups.get(key)!.map((row) => item(name, row, tags, zone))}</div>
    </section>`);
}
