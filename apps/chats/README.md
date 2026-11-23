# chats

`/chats`: past chats from `chats/*.jsonl`, styled like iOS. `page.ts` is the route (a plain wide page with a back link to Home, outside the Settings frame) and slots in `index.ts`, the list itself.

- **Hero** (`hero.ts`): this week vs last, messages sent, active time, cost, a 12-week heatmap of messages per day (hover or tap a day for the chats you wrote in; tap one to open it), and the page's one ⋮ menu (Refresh, Ask AI).
- **List** (`list.ts`): a search box (title, summary and the start of the chat's text) and a funnel dropdown (All, Pinned, Changed the site, Had an error, each tag, System, Hidden). Rows sit in flat `t-group`s under Pinned, Today, Yesterday, This week, then a group per month. A row shows title, summary (or last reply), time, and chips for its tag and the apps it changed. Rows come from `apps/design-system/row-actions.ts`: on a phone tap opens the chat in the `ai` panel and swipes give Pin, Tag (chips slide open), Ask AI, Hide; with a mouse the same list is a ⋮ on the row, and tap picks the chat for the preview card.
- **Aside** (`preview.ts`, `hero.ts`): while no chat is picked, bars for the apps chats changed most; when one is picked, a card with the first ask, last reply, facts, toggle chips for its tags, Continue, and its ⋮ menu (Pin, Ask AI, Hide).
- Filtering is in the browser (`chats.client.ts`, `convView.show` per row, `data-show`); pin, hide and tag are actions in `index.ts`.
- `usage-log.ts`: reads `usage/*.jsonl` (entries, totals, per-day sums).
- `stats.ts`: reads each chat once per change (`analyze`): messages sent, apps changed (from Edit/Write tool lines), active minutes (gaps over 5 minutes don't count), errors (a "Stopped." is not one), per-day counts; cost comes from `usage/` (`kind: chat`).
- `summary.ts` (job `chat-summaries`, hourly): Haiku writes a one-line summary for a chat that has been quiet 20 minutes. When new messages came in since, it gets the current summary plus only those messages and keeps it (SAME) or rewrites it; chats with no new messages are skipped without a call. Then it queues a tag sweep.
- **System chats**: a chat a background job started (listed in a job run's `sessions`) carries the chat label `system` (`ctx.agent(prompt, { labels: ["system"] })`, set from the start). They are left out of the list, the counts, the heatmap and the apps bars unless the "System" filter is chosen, and show a `system` chip.
- `recent.ts`: the owner's recent chats (no system or hidden ones) with tags and last message, read by the assistant.
- `db.ts`: table `chats_meta` (`table()`: pinned, hidden, summary). "Hide" only keeps a chat out of the list; the chat files are never edited.
- `format.ts`: day grouping (in the owner's zone), time labels, heatmap grid.
- Tags: chats are a taggable kind (`tag-items.ts`, plugged into Tags as `tags: "./tag-items"`), filed by Claude from the summary like tasks and notes.
- `api.ts`: what other apps may import (`recentChats`, `allMeta`, `setHidden`).

## For whoever merges updates

- `api.ts` is the contract with other apps (assistant): keep its names and shapes, or update every caller.
- Requires `tags`, `settings` (`enabledJobs`) and `design-system`.
