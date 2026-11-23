# todo

`/todo`: tasks with dates, repeats, priority and markdown notes/subtasks, in sections down one page: High priority (every open high-priority task, whatever its date, soonest first), Unsorted (new undated tasks, until they're placed), Today (due today,
overdue, high-priority undated), Upcoming (later dates, one group sorted by date; the due chip shows the day), Someday (undated), Done
(deleted after 30 days; collapsed by default). Works offline (`.ravel/offline.md`): the list is `$_todos` in the browser.

- `index.ts`: actions (`add`, `save`, `remove`) and the page. `save` writes the whole task, last write wins.
- `db.ts`: a trigger rejects ids that aren't lowercase letters and digits starting with a letter (anything that writes tasks must use `newId()`). Table `todo` (`table()`) (`due` as YYYY-MM-DD, `soft` = "by" deadline, `repeat`, `priority` 0/1/2, `notes`, `lane` unsorted/soon/someday, `auto` = placed by Claude) and its queries.
- `view.ts`: server markup: add row (an empty row at the top of the list, always shown on wide screens; on a phone a floating round glass + (`addButton`, focuses the field inside the tap so iOS raises the keyboard; the row is collapsed with `.todo-collapsed`, not display:none; outside the section so `fixed` is against the screen) opens it, `$adding`; focusing it slides open date and tag chips (`$newDue`, `$newTag`; `add` files the tag by hand); paste a list still works), and the task editor (date, repeat, priority, subtasks/notes).
- `list.ts`: browser code: list rendering (rows are `<ravel-row>` with swipe actions: right = Today/Someday, left = Ask AI and Delete via the `todo-remove` event, no ⋮ menu: the task sheet holds everything), checking a task (a repeating one moves to its next date), pasted-list parsing.
- `dates.ts`: dates, repeats ("every Mon and Thu") and natural phrases ("Wed", "before Monday", "in 2 weeks").
  Weeks start Monday. A phrase counts only at the start or end of the text.
- `triage.ts`: places unsorted tasks. Haiku picks "soon" (goes to Today, with a ✦ chip) or "someday"; if it picks more than 4, Sonnet reviews them against what's already in Today. The `triage` action runs it (the page asks a moment after adding, and on load). The owner's own choice ("Do soon"/"Someday" in the sheet) is never overridden; unreadable replies leave tasks unsorted to retry.
- `sort.ts` (job `todo-sort`) and `queue.ts`: `queueTriage()` starts the job whenever a task is added (page, iOS app, `todo:` chat), so unsorted tasks get placed without the todo page open. The page still asks too, for instant feedback.
- `todo.css`: widens the site shell for this page on wide screens (the shell is a 42rem column), and styles the list iOS-style (sizes and a few Todo-only bits; the shared look is in `apps/design-system/base.css`: `t-group-lined`, `t-pill`, `t-check`, `t-switch`, `t-expand`, `t-glass`).
- `tag-items.ts`: tasks as a taggable kind (`todo`), plugged into Tags as `tags: "./tag-items"`.
- `api.ts`: what other apps may import.
- `chat.ts`: a `beforeSend` hook (registered in the root `app.ts`): a chat message starting with `todo:` adds one undated, low-priority task per comma (several lines are one task, like a paste) instead of going to the AI.
- `todo.client.ts`: the page's `todoView` script: `list.ts` and the rich editor, bundled by `clientScript()`.

Subtasks are markdown checkboxes in a task's notes. Pasting several lines makes ONE unsorted task (first line the title, the rest its notes, flagged `split_check`). The sort job (`splitPasted` in `triage.ts`) asks Haiku once "one task or a list?": a list becomes a task per line (`splitLines` in `list.ts`; undated ones low priority; lines indented under another become its subtasks), a single task stays as it is. Unreadable answers retry next run. `!` means high.

The task sheet has a Tag row: each tag chip toggles on or off (up to the limit; a full task buzzes), saved by the `setTag` action (`tag`, `on`; `manual`, so the AI never moves it). Shared picking logic is in `lib/tag-pick.ts`.

The list re-renders when any job run changes (`live`), which is how a tag chip added by the sweep appears without a reload.

The page has a search box and tag chips (All, No tag, each tag) in a left column on wide screens (above the list on a phone); they filter in the browser (`$fp`, `$q`, `matches` in `list.ts`). The chips are one rounded group of rows (`.todo-filter`, no separators); on a phone it is a dropdown behind a filter icon right of the search box (`$fmenu`).

Other apps read and write tasks only through `api.ts` (`@app/todo/api.ts`). Todo puts the Tasks card on Home itself (`home.ts`, a `home` plug: Todo's order as a table, the add field and the checks, with `home.css` and `home.client.ts`).

A task shows a chip per tag with its emoji and name (`tags`: `[{id, label}]` on each item, read through `@app/tags/api.ts`); the filter matches any of a task's tags.

`moveTasks(ids, due)` (used by the assistant when the owner accepts an offer) moves open tasks to a date or to Someday; `completeTask(id, today)` checks a task off like the page does (a repeating one moves to its next date); `listDoneSince` gives what was finished today.

- `linked.ts`: tasks that belong to another app (`SOURCES`): the chip label and icon, and what ticking one does. Planit is the first.
- `links.ts`: what other apps plug in with `todo: "./todo"` in their `app.ts`, found at start-up: `todoLinks()` (chips for tasks another app owns without syncing them: task id to label and href) and `todoEvents(from, to)` (Calendar's events, for the widget). Todo imports no other app except Tags and the design system, through their `api.ts`.

A task added from a Planit trip or date page shows a chip with the plan's emoji and title that opens it (`plan` / `planHref` on each item, from `planit/todo.ts` via `links.ts`; on iOS it is part of the caption). `getTodos(ids)` and `reopenTask(id)` serve that card.

- `task.ts`: the task editor, a fragment opened as a sheet (`ravel.sheet`): a native sheet in the app, a dialog in a browser. It's bound to `$open`, so a re-render keeps showing the same task.

- `widget.ts`: the iOS home-screen widget "Today" (id `today`, registered in `apps/todo/app.ts`'s `widgets`): today's tasks with checkboxes (action `done` runs `completeTask` and refreshes widgets) and, on medium/large, the next event from any app's `todoEvents`.

iOS look (swipe buttons are hidden when a mouse is the pointer): the list is rounded groups of rows (`.todo-group`) with big sentence-case section titles, borderless chips and the due date/repeat as plain text under the title (`meta` in `list.ts`), a pill search box, a native large title (`nativeTitle`), a "Completed" disclosure row, and a pop on the check circle.

Task editor (`editor` in `view.ts`): the title and notes in one card (the notes are the rich editor, so pictures go inline there), and a details card: **When** (two buttons side by side, Date and Repeat, each showing its value; a tap slides that one's options open underneath, `$sec`), **Priority** (three always-visible buttons) and **Tags** (None and five chips, then "Show more" for the rest, `$tagsAll`; a tag on the task always shows). On a wide screen the sheet is widened (`#ravel-sheet:has(.todo-editor)` in `todo.css`) and the details sit in a column beside the notes. The values come from `list.ts`.

`sheet.ts` (`openTaskSheet(id)`, exported in `api.ts`) is what Home's task rows use to open this same editor over Home: `task.ts` gets `standalone=1` and brings its own script and save listeners, since Home has none.

Rich text fields use the design system's editor (`richField`, `richBar`, `richToolbar`, `richSignals` and `richScript` from `@app/design-system/api.ts`; see `apps/design-system/README.md`). The page adds `${await richScript()}` and `richSignals` to its signals, and its attributes call `ravelRich.richLoad` / `ravelRich.richFocus`.

Pictures: paste (cmd+V), drop or the toolbar's picture button put a picture on its own line in the notes (`![](/private/uploads/x.jpg)`, see `apps/design-system/README.md`). `todo.images` (a JSON array of `private/uploads/*.jpg` paths, max 10, `readImages` in `index.ts`) holds photos added before that: `photoCard` still shows and removes them (`photos`, `removePhoto` in `list.ts`), but nothing adds to it now; the list row shows a `🖼 n` chip for them.

## For whoever merges updates

- `api.ts` is the contract with other apps (assistant, home, calendar, planit, goals): keep its names and shapes, or update every caller.
- Requires `tags`, `settings` (`enabledJobs`) and `design-system`. Task ids are checked by a trigger; keep `newId()`.
- The `todos` → `todo` rename in `db.ts` only matters for spaces made before `table()`.
