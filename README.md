# ravel-plugins

Apps for a Ravel space, laid out like one: copy `apps/<name>/` into a space's `apps/` and the `lib/` files it
imports into its `lib/`. Imports (`@app/...`, `../../lib/...`) work unchanged.

## Base

Every other app here assumes these are installed:

- `design-system`: the `t-*`/`bn-*` classes, `theme/` writer and shared UI helpers.
- `settings`: the settings store, time zones and job switches.
- `tags`: tags on tasks, notes and chats, filed by Haiku, with nightly tag ideas.
- `shell`: the layout every page renders in (tab bar, chat button, back pill).
- `theme`: themes, mode, dials and the backdrop.
- `ai`: the chat panel on every page.

## Apps

- `home`: greeting, date and ask box over a grid of cards other apps add (`home` plug).
- `todo`: tasks with tags, swipe rows and quick add.
- `notes`: notes with rich text and tags.
- `chats`: the `/chats` page, past chats and usage.
- `notifications`: notification types, the gate and quiet hours.
- `settings-page`: the `/settings` hub.

## lib

`plugs.ts` (how apps plug into each other: an app's `plugs` in its `app.ts`), `time.ts` (dates and time zones),
`tag-pick.ts` (picking and matching tags in the browser).

## Updates

A space that installed an app here records the commit it came from. Updating applies this repo's diff since that
commit to the space's copy with `git apply -3`; the space's own edits stay.
