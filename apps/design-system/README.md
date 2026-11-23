# design-system

The shared UI every app builds on: CSS classes on every page, markup helpers other apps import from `@app/design-system/api.ts` (and nothing else from this folder), and the rules every page follows. It imports only `@ravel/*`, so any app can require it.

**Before any UI work, read Rules below and build from the helpers.** A helper that fits is always used over hand-written markup, so its rules hold everywhere.

## Rules

**Colour and shape**
- Colours only through the `t-*` classes (or the variables in an app's `.css`); never Tailwind colour classes. Tailwind is for size, spacing and border width (`border t-card`).
- Accent-coloured text uses `t-accent` (or `var(--accent-text)`), never `var(--accent)` directly: in light mode it's mixed toward `--ink` so it reads on light cards and tints. Tile counts do the same with `--c-text`.
- To add a colour: a variable in both default modes, every theme's two mode files (and the Ravel theme's `vars.*.css` in `apps/theme/themes/ravel`), and a class in `base.css`.
- Corners only from `--radius-card`, `--radius-field`, `--radius-pill` (`t-group`, `t-widget`, `t-pill`, `t-field`, `rounded-[var(--radius-…)]`, or `rounded-full` for circles); never `rounded-lg` and friends.
- Every clickable thing already gets the pointer cursor from `base.css`; never add `cursor-pointer`.
- Every theme has a light and a dark mode.

**Lists**
- Every list is `list()`: one rounded group, never a card per item and never several boxes for one list. A heading above it is `section()`.
- Separators: rows get no lines by default. Rows that are different kinds of controls (a switch, a stepper, a link) can ask for inset lines with `list(rows, { lined: true })`, which also draws a full-width line between the sections of `list([rowsA, rowsB])`. Pick-lists (filters, a settings rail, lists of links) are flat.
- Rows that open a page are `linkRow()`, and disclosure rows slide open; neither shows a › unless the page passes `chevron: true`. Components add no label a row already says (no "Upcoming" over future dates). Nothing in a group lifts or moves on hover; no press highlight.
- Row actions are written once with `swipeRow()` (swipe buttons on touch, a ⋮ at the row's edge with a mouse).
- Chips are soft filled `t-pill`s; pick-one chips are `chips()`. Due dates are plain text. Grouped settings are `disclosure()` rows that slide open to `fieldRow()`s (each value on the right); switches are `t-switch`, small counts a `stepper()`, dollar amounts and other big numbers a typed `fieldInput`.

**Menus**
- Every item that can be acted on gets a `kebab()` ⋮ inline in its title or status row (never alone on its own line), with "Ask AI" (`ravelAsk`). One ⋮ per card, with Refresh and Ask AI. Home tiles have none.

**Pages**
- Tabs or chips that switch a page's content are `segmented()`: each tab is its own path, and only the content changes; the header and tabs stay put. A side rail does the same with `data-ravel-keep-scroll` on its container.
- A page with sections is a list that pushes a section page with a "‹ back" link on a phone, with a rail beside the pane from md up (Settings).
- `bar()` with `nativeTitle: true` for the large title. No logo in a page header.
- On a phone a new-item action is `fab()`. Filters are a funnel button next to a pill search box, opening a dropdown `t-group`. Sheets are as tall as their content on the web (`base.css` drops the platform's min-height; max 90vh, then they scroll), so never give a sheet a `min-h-[…vh]`; `large` only sets the iOS detent.
- Full apps are never one narrow column on a desktop: a list plus a right aside, a left rail plus content, or a dashboard (hero row, then main and side columns), in a container of `64rem`+ (see `apps/notes/index.ts`); one column on a phone with the key info first.
- Real empty, loading and error states; an empty state shows only when the data is empty.

**Phone and iOS**
- iOS only raises the keyboard when `focus()` runs inside the tap: never in a `setTimeout`. Keep a field collapsed (height 0) instead of `display:none`, and use `focus({preventScroll: true})`.
- `ravel.haptic()` (`tap`, `select`, `success`, `warning`) on every tap that does something and on rows that open a sheet or page. The helpers here already do.
- Don't add pull-to-refresh, hover lift, spinning or bouncing rows, or folders (tags replace them).

**Text**
- Editable formatted text always uses the rich editor (`richField()`); never a plain textarea, and the owner never sees markdown while editing. Read-only text uses `renderMarkdown`.

**Motion**
- `t-stagger` on sections, count-ups and animated rings and bars; everything honours `prefers-reduced-motion`.

**Bento pages**
- Each grid has a hand-drawn `grid-template-areas` map for a phone (4 columns) and 1100px+ (6), never auto-flow. At least four tile shapes (wide, tall, square, small), no holes, one hero tile (a quarter to a third of the grid).
- One idea per tile, shown visually (map, ring, heatmap, chart, big number); at most one small number tile in four. A chart tile is about 2:1 on both breakpoints. A tile is a preview; the full list stays below the grid as a `list()`.
- Vary tones (`tint`, `accent`, `invert`, `flush` for a map, a `hue` turn) so neighbours differ. No captions or legends, no borders inside a tile.

`rules.test.ts` fails on Tailwind colour classes, hard-coded `rounded-*`, `divide-y` and `cursor-pointer` anywhere in `apps/`.

## theme/

Ravel serves the space's `theme/` folder with every page (`theme.css`, `tokens.json`, `theme.client.ts`). This app writes it (`write.ts`, `writeTheme()`): `theme.css` is the skin's `@import` lines, then the default variables for both modes (`defaults.light.css`, `defaults.dark.css`: Ravel's Midnight palette), then `base.css`, `kebab.css`, `markdown.css`, `rich-edit.css` and `heatmap.css`, then the skin's CSS, so its variables win. `app.ts` writes it whenever the worker starts; anything that changes the look calls `writeTheme()` again. Only changed files are rewritten, and open pages pick them up. If the skin fails to load while `theme.css` was last written with one (it ends with `/* skin:<app> */` and that app's folder still exists), `writeTheme()` retries, then keeps the current files rather than flipping every page to the defaults. Don't edit `theme/` by hand. `writeTheme("theme-preview")` writes the same files to the folder only your browser reads (`apps/theme/preview.ts` does this).

A **skin** is an app that lists `"design-system": "./skin"` in its `plugs` and exports `skin` (type `Skin` in `types.ts`) from that file: `css()`, `tokens()` (`mode` and the iOS tokens), optional `client()` (browser files for `theme/`, `theme.client.ts` first) and `thread()` (the chat loader's colours). `apps/theme` is the skin today. With none installed, the defaults apply: dark mode, Midnight colours, no scenery.

`thread()` gives the skin's thread colours, or the defaults' `--r-t1..3`.

## Classes (`base.css`)

Colours always come from the variables (`--bg`, `--card`, `--ink`, `--muted`, `--accent`, `--border`, ...), so every theme works:
- Colour: `t-bg`, `t-card`, `t-chip`, `t-nav`, `t-input`, `t-border`, `t-ink`, `t-muted`, `t-accent`, `t-accent-bg`, `t-accent-grad`, `t-accent-tint`, `t-active`, `t-skeleton`, `t-hover`.
- iOS-style pieces, rounded by `--radius-card` / `--radius-field` / `--radius-pill`: `t-group` / `t-group-lined` (rows in a rounded box; `--t-inset` moves the line), `t-list`, `t-widget`, `t-pill`, `t-field`, `t-title`, `t-check`, `t-switch`, `t-expand`, `t-glass`, `t-chips`, `t-chev`.
- Motion: `t-stagger`, `t-grow`, `t-loading`, the sheet's slide-up, page cross-fades. Reduced motion turns it all off.
- Bento (`bn-*`): the grid and tiles. Each page places its tiles with `grid-template-areas` in its own CSS.

## Helpers (`api.ts`)

- `bento.ts` (a tile with no page of its own takes `sheet: openSheet(...)` instead of `link`, never a link to a random page): `tileMaker`, `tile`, `stats`, `lines`, `numberOverChart`, `chartOnly`, `nothing`: the one tile shell for Home and the bento pages; tiles can flip.
- `kebab.ts` + `kebab.css`: `kebab(key, options)`, the ⋮ popout menu. Options run an action, link, or call `ravelAsk` for "Ask AI".
- `row-actions.ts`: `swipeRow`, `rowKey`, `askAction`, `kebabOptions`: a row's actions written once, swipe buttons on touch and a ⋮ at the edge with a mouse.
- `list.ts`: `list(rows, { lined, inset })`, every list (see Rules); `section(title, body, { count, menu })`, the title above one; `linkRow({ href, label, note, icon, value, chevron })`, a row that opens a page (no › unless `chevron`) (pass `icon(name)` from `@ravel/icons.ts`). Rows can be `html` or strings, so browser-rendered lists (Todo, Notes) use them too (`.value` for a string).
- `controls.ts`: `disclosure({ open, toggle, icon, title, note, value, chevron, body })`, a row that slides open (`oneOpen(signal, id)` gives `open` and `toggle` so one is open at a time; `disclosureHead` and `disclosureBody` when a `swipeRow` wraps it); `fieldRow(label, control, { note, tag })`, a setting row; `fieldInput`, the class for its fields; `stepper(signal, min, max, label)`, a pill stepper; `chips(items, label)`, pick-one chips (`on` is a boolean or a Datastar expression). Strings are shown as text. Used by finances, goals and habits.
- `segmented.ts`: `segmented(tabs, active?)`, pill tabs that switch a page's content. Pass `active` (an href) when the page draws the bar; leave it out in a frame the router keeps.
- `fab.ts`: `fab({ label, on, icon })`, the round glass new-item button on a phone. Render it outside any `t-stagger` section.
- `tabbar.ts` + `tabbar.client.ts`: `tabBar(ctx)`, the site's tab bar (bottom on a phone, a sidebar from md up), drawn by `apps/shell`. Entries are every app's `nav` in its `app.ts` (`ctx.nav`, sorted by `order`): path, label, Heroicons name, and `also` for other paths that light the tab (Forward covers `/goals`, `/habits` and `/workouts`). A phone shows 3 tabs plus More, a desktop 4 plus More; `extra: true` entries are only under More. The router keeps the layout, so `tabbar.client.ts` lights the new tab on `ravel-navigate`.
- `skeleton.ts`: `cardSkeleton`, `noSkeleton` for slots.
- `markdown.ts` + `markdown.css`: `renderMarkdown`, `renderInline`, `escapeHtml`; safe on the server and in the browser (`.md` class).
- `heatmap.ts` + `heatmap.css`: `heatmap({ cells, weeks, label })`, a calendar heatmap with a square a day, Monday first. Each cell is `{ shade: 0..1, title?, pop? }` or `null` (the future); a cell with a `title` or `pop` gets a card on hover or tap (`hm-pop-row` and `hm-pop-name` style rows in it). `weeks: "rows"` lays a week per row. It fills its width; set `width` (or `height: 100%; width: auto`) on `.hm` to size it, and `--hm-color` to colour it. Used by chats, habits, workouts and the home tiles.
- The rich editor (`rich-edit.ts`, `rich-model.ts`, `rich-edit.client.ts`, `rich-cells.client.ts`, `rich-pop.client.ts`, `rich.client.ts`, `rich-edit.css`): formatted lines like Apple Notes with checklists and tables; markdown is only how the text is stored. A page renders `richField(...)`, `richBar(id)` (keyboard bar on a phone) and `richToolbar(id)` (the desktop format pill), adds `richSignals` to its signals and `${await richScript()}` once; its attributes call `ravelRich.richLoad(el, text, editable, key)` and `ravelRich.richFocus(id)`, and `rich-change` events carry the markdown. `ravelRich.richFocusEnd(id)` focuses with the caret at the end (a tap on empty space below the text); an editor with the `data-title` attribute styles its first line as a title in the page's CSS, and the toolbar then ignores that line's weight. `rich-cells.client.ts` picks several table cells, `rich-pop.client.ts` adds the table + and ⋯ menus and the right-click menu. Pictures: paste, drop or the toolbar's picture button (`richImage(id)`) shrinks the image to 1600px in the browser, saves it with the chat's `ravelChat.upload` and adds a block `{k: "img"}` on its own line, stored as `![](/private/uploads/x.jpg)` (only `private/uploads` paths count, `IMAGE` in `markdown.ts`; `renderMarkdown` draws it too). A tap selects a picture; its ✕ or Delete removes it. Used by notes, todo and planit.

`api.ts` is safe to bundle for the browser (todo's and notes' list scripts import it): the theme writer is only loaded when `writeTheme()` or `thread()` is called.

## Tests

`rules.test.ts` (the Rules a grep can check), `list.test.ts`, `markdown.test.ts`, `rich-model.test.ts`, `row-actions.test.ts`, `heatmap.test.ts`, `write.test.ts` (the order of `theme.css`, matching default modes) and `client.test.ts` (the editor script runs and sets `ravelRich`).

- **Back pill**: a page below a tab registers its parent with `backTo(href)` (from `api.ts`); the shell shows the pill top left only then. Never draw a page-level back link.
