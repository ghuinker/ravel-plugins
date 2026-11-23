# tags

The engine behind tags. A tag has a name, emoji and color (`hue`). Each task, note, chat or app can carry several, up to `tags.max` (a number setting in the Tags section of `/settings`, default 3). There are no pages here: Todo, Notes and Chats show chips, a filter and a picker (`tags.ts`, and `lib/tag-pick.ts` in the browser), and the Tags section of `/settings` (`pane.ts`, declared in `settings.ts`) renames, recolors, merges, deletes and adds them.

Items are tagged **by Claude, not by hand** (the owner can always tag by hand):
- `matcher.ts`: Haiku sorts items never looked at before and answers with zero to `tags.max` tags each. The best match attaches when confident and is "suggested" when unsure (the assistant offers those as a `file` offer); a second or third tag attaches only when it is very confident (0.85) and the best one attached; no fit is just "looked at". **Each item is judged once**; any row in `tags_checks` means "looked at", so editing an item never triggers another check. Items with under 4 characters wait. With no tags, nothing is judged.
- `sweep.ts` (job `tag-sweep`): runs the matcher. `queue.ts` `queueSweep()` schedules it a minute out (once per burst; a new todo asks for 3 seconds); `todo`, `notes`, `planit` and the assistant call it, and adding a tag does too.
- `suggest.ts` (job `tag-suggest`, nightly): sweeps, then Sonnet looks at loose items for groups of 3+ that deserve a tag (`proposals.ts`). Ideas show on the home page's Focus card one at a time, with "N more after this one" (the rows are `apps/assistant/tag-ideas.ts`; `ideas.ts` answers them). The step runs one at a time and re-reads the queue after Sonnet answers, so the 3-idea limit and the repeat check hold; Sonnet is also told which apps are already built. Yes makes the tag and tags the items; No is remembered (same name, or mostly the same items, is never proposed again).
- The owner always wins: tagging or untagging by hand writes a `manual` row and marks the item looked at, and the AI never touches it again.

## Ranking

Tags are ordered by how alive they are, not by age. `rank.ts` gives each tag a `heat`: every item under it counts for how recently it moved (half-life 3 weeks); open work counts fully but never fades below a floor, finished work counts for 30%. The nightly job `tag-rank` (`rank-job.ts`) saves it, so the order holds still during the day. `listTags()` returns pinned tags first, then by heat, then by name, and `recentTags()` (the chips on a new task) skips dormant ones. A tag is dormant when its heat is under `DORMANT_BELOW` (0.3) and it isn't pinned; Todo's filter tucks dormant tags under "More", and the Tags section of `/settings` shows "dormant" and a Pin switch. New tags start hot. Tested in `rank.test.ts`.

## Files

- `db.ts`: tables `tags`, `tags_items` (one row per item **and tag**: `state` attached/suggested, `source` ai/manual, `confidence`), `tags_checks` (one row per item that was looked at: `checked`, or `dismissed` when the owner said no to a suggestion) and `tags_proposals`, all made with `table()`. `attach`/`detach`/`detachAll`/`dismiss` are the owner's moves, `recordJudgment` is Claude's single look; `mergeTags`, `deleteTag`.
- `api.ts`: everything other apps may import (`@app/tags/api.ts`). Tags imports only Settings, through its `api.ts`.
- `tags.ts`: `tagsOf`, `tagLabel`, `tagItem` (false when unknown or at the limit), `untagItem` (0 removes all), `toggleTag`, `canOfferTag`, `maxTags`, `EMOJIS`.
- `items.ts`: what can be tagged (`KINDS`). Each app plugs its kinds in with `tags: "./tag-items"` in its `app.ts`, a file exporting `tagKinds` (`{ [kind]: { label, plural, icon, list } }`): Todo (`todo`), Notes (`note`), Chats (`chat`, judged once it has a summary), Calendar (`event`), Setup and Branding (`app`). Kinds two apps share are listed together. Tests add their own with `addKind`.
- `rank.ts`, `rank-job.ts`: heat per tag and the nightly job that saves it.
- `lines.ts`: `tagLines()`, what the assistant is told about each live tag (open tasks, read through the `todo` kind's items; quiet for N days).
- `tags.css`: the idea cards' look.
- `chat.client.ts`: defines `ravelAsk(button, kind, id)`, used by every "Ask AI" menu option: opens a new chat tab (`ravelChat.ask`) with a draft that references the thing. Plugged into `apps/ai` (`ai` in `plugs`), which runs it next to the chat panel.

## For whoever merges updates

- `api.ts` is the contract with notes, todo, chats, calendar, goals, home and the assistant: keep its names and shapes, or update every caller.
- Requires `settings` (the `tags.max` setting, `enabledJobs`).
- The `Item`/`Kind` shape is what every `tag-items.ts` plug exports; changing it breaks them.
