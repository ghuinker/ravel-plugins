import { action as post, js } from "@ravel/action.ts";
import { html, raw } from "@ravel/html.ts";
import { action } from "@ravel/offline.ts";
import type { Ctx } from "@ravel/types.ts";
import { fab, kebab, richBar, richField, richToolbar } from "@app/design-system/api.ts";
import { maxTags, type Tag } from "@app/tags/api.ts";

const tagName = (tag: Tag) => tag.name.trim();

const icon = (path: string, size = "size-5") => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${size} shrink-0"><path d="${path}" /></svg>`;
const ICONS = {
  trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6",
  pin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z",
  compose: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  back: "m15 18-6-6 6-6",
  search: "m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
  restore: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
};

const openField = (name: string) => `notesView.field($_notes, $open, '${name}')`;
const startTyping = "ravelRich.richFocusEnd('note-text'); setTimeout(() => ravelRich.richFocusEnd('note-text'))";

export const saveNote = (ctx: Ctx) => action(ctx, "save", `{id: $open, body: ${openField("body")}}`);

/** The filter: every note, one tag, notes without a tag, and the deleted ones, as one rounded group in a dropdown behind the filter button. */
function filterGroup(tags: Tag[]) {
  const row = (label: string, picked: string, pick: string, count: string) => html`
    <button data-on:click="ravel.haptic('select'); ${pick}; $open = ''; $fmenu = false" data-class="{'t-active': ${picked}, 't-hover': !(${picked})}" class="flex w-full items-center gap-2 px-4 py-2.5 text-left">
      <span class="flex-1 truncate">${label}</span><span class="text-sm opacity-60" data-text="${count}"></span>
    </button>`;
  const all = "$view === 'all' && $tag === 'all'";
  return html`
    <div class="t-group">
      ${row("All notes", all, "$view = 'all'; $tag = 'all'", "notesView.count($_notes, 'all')")}
      ${tags.length ? row("No tag", "$view === 'all' && $tag === 0", "$view = 'all'; $tag = 0", "notesView.tagCount($_notes, 0)") : ""}
      ${tags.map((tag) => row(tagName(tag), `$view === 'all' && $tag === ${tag.id}`, `$view = 'all'; $tag = ${tag.id}`, `notesView.tagCount($_notes, ${tag.id})`))}
      ${row("Deleted", "$view === 'trash'", "$view = 'trash'; $tag = 'all'", "notesView.count($_notes, 'trash')")}
    </div>`;
}

const NEW_ITEM = "{body: '', auto: '', pinned: false, trashed: false, updated: Date.now(), tags: []}";

/**
 * A new note opens beside the list (a phone shows it in place of the list) with the caret in it. It exists only in the browser until it has text,
 * so there is no action to send: the first save makes it on the server. The focus runs inside the tap, so a phone raises the keyboard.
 */
export function newNote() {
  return `ravel.haptic('tap'); $view === 'trash' && ($view = 'all'); $open = ravel.add($_notes, ${NEW_ITEM}, () => {}); ${startTyping}`;
}

/** The round glass new-note button on a phone. It sits outside the page section so `fixed` is against the screen. */
export function composeButtons() {
  return fab({ label: "New note", class: "notes-fab", on: newNote(), haptic: false, icon: icon(ICONS.compose, "size-6"), attrs: raw('data-show="!$open"') });
}

const current = "$_notes[$open]";
const noteActions = (ctx: Ctx) => ({
  pin: `ravel.haptic('tap'); ${current}.pinned = !${current}.pinned; ${action(ctx, "pin", `{id: $open, pinned: ${current}.pinned}`)}`,
  trash: `ravel.haptic('warning'); ${current}.trashed = true; ${current}.pinned = false; ${current}.updated = Date.now(); ${action(ctx, "trash", "{id: $open}")}`,
  restore: `ravel.haptic('success'); ${current}.trashed = false; ${current}.updated = Date.now(); ${action(ctx, "restore", "{id: $open}")}`,
  erase: `ravel.haptic('error'); ${current}.gone = true; ${action(ctx, "erase", "{id: $open}")}`,
});

export function leftBar(tags: Tag[]) {
  return html`
    <div class="space-y-5">
      <div data-filter class="relative space-y-3">
        <div class="flex items-center gap-2">
          <div class="relative min-w-0 flex-1">
            ${icon(ICONS.search, "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 t-muted")}
            <input data-bind:q type="search" placeholder="Search" class="t-pill w-full rounded-full border t-input py-2.5 pl-10 pr-4 outline-none" />
          </div>
          <button data-on:click="ravel.haptic('tap'); $fmenu = !$fmenu" aria-label="Filter" data-class="{'t-active': $fmenu || $view !== 'all' || $tag !== 'all'}" class="t-pill flex size-11 shrink-0 items-center justify-center rounded-full border t-chip">${icon(ICONS.filter)}</button>
          <button data-on:click="${newNote()}" aria-label="New note" title="New note" class="t-pill t-chip hidden size-11 shrink-0 items-center justify-center rounded-full border md:flex">${icon(ICONS.compose)}</button>
        </div>
        <div class="notes-filter" data-class="{'hidden': !$fmenu}" data-on:click__window="evt.target.closest('[data-filter]') || ($fmenu = false)">${filterGroup(tags)}</div>
      </div>
      <div class="space-y-5" data-ignore-morph data-effect="$_build; $tag; ravel.html(el, notesView.listHTML($_notes, $view, $q, $open, undefined, $tag))"></div>
    </div>`;
}

/** The note's tags as one pill under its text that opens a menu where each tag toggles on or off (up to the limit). It shows when the note has tags, or while the menu is open. */
function tagMenu(ctx: Ctx, tags: Tag[]) {
  const max = maxTags();
  const toggle = (tagId: number) =>
    `const now = notesView.toggleTag($_notes, $open, ${tagId}, el.querySelector('[data-label]').textContent.trim(), ${max}); now === 'full' ? ravel.haptic('warning') : (ravel.haptic('select'), ${post(ctx, "setTag", { id: js("$open"), tag: tagId, on: js("now === 'on' ? 1 : 0") })})`;
  const row = (label: string, picked: string, run: string) => html`
    <button data-on:click="${run}" data-class="{'t-active': ${picked}, 't-hover': !(${picked})}" class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm">
      <span data-label class="flex-1 truncate">${label}</span><span class="t-accent" data-show="${picked}" style="display: none">✓</span>
    </button>`;
  const none = `ravel.haptic('select'); notesView.toggleTag($_notes, $open, 0, '', 0); ${post(ctx, "setTag", { id: js("$open"), tag: 0, on: 0 })}`;
  return html`
    <div class="notes-meta relative" data-show="$tagmenu || !notesView.noTags($_notes, $open)" style="display: none" data-on:click__outside="$tagmenu = false">
      <button data-on:click="ravel.haptic('tap'); $tagmenu = !$tagmenu" aria-label="Tags" data-class="{'t-active': $tagmenu}" class="t-pill t-chip flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs">
        <span class="truncate" data-text="notesView.tagValue($_notes, $open)"></span>
      </button>
      <div class="t-group absolute right-0 top-full z-30 mt-2 w-64 shadow-lg" data-show="$tagmenu" style="display: none">
        ${row("No tag", "notesView.noTags($_notes, $open)", none)}
        ${tags.map((tag) => row(tagName(tag), `notesView.hasTag($_notes, $open, ${tag.id})`, toggle(tag.id)))}
      </div>
    </div>`;
}

/** The ⋮ menu: the only control a note shows while it is being read. */
function moreMenu(ctx: Ctx, tags: Tag[], ownPage: boolean) {
  const act = noteActions(ctx);
  // On a note's own page in a browser there's no sheet to close: show the list in place.
  const leave = ownPage ? (ctx.client === "ios" ? "; ravel.close()" : "; $open = ''; history.pushState(null, '', '/notes')") : "; $open = ''";
  const trashed = openField("trashed");
  const menu = (key: string, shown: string, options: Parameters<typeof kebab>[1]) =>
    html`<div data-show="${shown}" style="display: none">${kebab(key, options)}</div>`;
  const pinOption = { label: "Pin / unpin", icon: "bookmark", run: act.pin };
  const tagOption = tags.length ? [{ label: "Tags", icon: "tag", run: "ravel.haptic('tap'); setTimeout(() => $tagmenu = true)" }] : [];
  const deleteOption = { label: "Delete", icon: "trash", danger: true, run: `${act.trash}${leave}` };
  return html`
    ${menu("note-menu", `!${trashed} && !notesView.longFirst($_notes, $open)`, [pinOption, ...tagOption, deleteOption])}
    ${menu("note-menu-long", `!${trashed} && notesView.longFirst($_notes, $open)`, [{ label: "Add title", icon: "pencil", run: `ravel.haptic('tap'); notesView.addTitle($_notes, $open); setTimeout(() => ravelRich.richFocus('note-text'))` }, pinOption, ...tagOption, deleteOption])}
    ${menu("note-menu-trash", trashed, [
      { label: "Restore", icon: "arrow-uturn-left", run: `${act.restore}${leave}` },
      { label: "Delete forever", icon: "x-mark", danger: true, run: `${act.erase}${leave}` },
    ])}`;
}

/**
 * The open note, like Apple Notes: one text whose first line is the title. Reading it shows only the text and a ⋮ menu; focusing the text (a tap anywhere on the page)
 * brings in the formatting controls (`$rf`), and leaving it takes them away again.
 */
export function editor(ctx: Ctx, tags: Tag[], ownPage: boolean) {
  const save = saveNote(ctx);
  const trashed = openField("trashed");
  const text = `data-title data-effect="$_build; ravelRich.richLoad(el, ${openField("body")} ?? '', !(${trashed}), $open); el.toggleAttribute('data-long', notesView.longFirst($_notes, $open))"
    data-on:rich-change="notesView.edit($_notes, $open, 'body', evt.detail.md); el.toggleAttribute('data-long', notesView.firstLineLong(evt.detail.md))" data-on:rich-change__debounce.600ms="${save}"`;
  const closed = "notes-closed";
  return html`
    <div class="hidden h-64 items-center justify-center t-muted md:flex" data-show="!$open">Select a note</div>
    <div hidden data-effect="const left = notesView.leaving($_notes, $open); left && ${action(ctx, "discard", "{id: left}")}"></div>
    <div class="notes-editor${ownPage ? " notes-own" : ""}" data-class="{'${closed}': !$open, 'is-editing': $rf, 'tag-open': $tagmenu, 'is-trashed': ${trashed}}">
      <div class="notes-top">
        ${ownPage ? "" : html`<button data-on:click="ravel.haptic('tap'); $open = ''" class="notes-back md:hidden" aria-label="Back to notes">${icon(ICONS.back, "size-5")}<span>Notes</span></button>`}
        <div class="notes-format" data-show="$rf">${richToolbar("note-text", `!(${trashed})`)}</div>
        <div class="flex-1"></div>
        <button class="notes-done md:hidden" data-show="$rf" style="display: none" data-on:pointerdown="evt.preventDefault()" data-on:click="ravel.haptic('tap'); document.activeElement?.blur()">Done</button>
        <div data-show="$rf || $tagmenu || ${trashed}" style="display: none" data-on:pointerdown="evt.preventDefault()">${moreMenu(ctx, tags, ownPage)}</div>
      </div>
      <div class="notes-info">
        <div class="notes-date" data-text="notesView.editedAt($_notes, $open)"></div>
        ${tagMenu(ctx, tags)}
      </div>
      <div class="notes-doc" data-ignore-morph data-on:click="evt.target === el && ravelRich.richFocusEnd('note-text')">
        ${richField({ id: "note-text", placeholder: "Title", attrs: text, onBlur: save })}
      </div>
      ${richBar("note-text")}
    </div>`;
}
