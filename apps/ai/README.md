# ai

The chat on every page: a round button in the top-right pill (`topGroup()` and `chatButton()` in `api.ts`, drawn by the shell and the site page; its mark animates while the chat works),
opens a panel that drops from that pill with the core's `<ravel-chat>` (see `.ravel/chat.md`). The core draws the
conversation, keeps the chats and titles them; this app places it, themes it and adds extras.

- `index.ts`: the panel (hidden until opened) (`$chatOpen`), the offline card, the usage banner and the
  `checkUsage` action. It embeds the scripts below (each bundled by `clientCode()`), then the script each app lists as `ai` in its `plugs`
  (`pluginFiles()`), and runs them with `chat` (the chat client) and an AbortController `signal`.
- `working.ts`: the chat's working line, laid out as Ravel's "Thinking" line. The loader follows the work: Knot while thinking, Braid for web searches, Unravel for edits, Orbit for other tools, Pulse while waiting in line. Uses the picked palette's thread colors (`thread()` from `@app/design-system/api.ts`, which asks the installed theme and falls back to the default colours).
- `loader.client.ts`: the Ravel thread glyphs as a standalone canvas engine, inlined into the working line (the iOS app shows it in a bare web view) and run on the page for the button's busy mark. Each slot's thread is kept on `window`, so a re-rendered line morphs into the new kind instead of restarting.
- `group.css`: the top-right pill and the chat button. `topGroup()` inlines it, because the pill is drawn in the layout before the panel (a slot) and its `style.css` arrive; without it the pill and its icons show unstyled as a big square on first load.
- `style.css`: the panel's shape and animation, and the theme variables mapped onto
  `<ravel-chat>` (`--ravel-chat-accent`, the tab, input and menu colors).
- `expand.client.ts`: adds "Expand chat" to the ⋮ menu; on desktop the open panel becomes a large centered card (`data-expanded` on `#claude-wrap`, remembered in localStorage).
- `place.client.ts`: on a computer the open chat hangs below the top-right group and moves up with it as the page scrolls, stopping 1rem from the top.
- `keyboard.client.ts`: lifts the panel above the phone keyboard.
- `usage-warning.ts`, `usage-warning.client.ts`: a banner when any plan limit is at 90% or more,
  checked after a reply at most every 30 minutes, or every 5 once usage is high. The result is saved in localStorage, so tabs that didn't run the check show it too.
- `uh-oh.client.ts`: turns the core's red `.ravel-error` boxes into a card. For the first 90 seconds it shows the Ravel loop and "Working on it…" (the AI is usually mid-edit and fixes it) with the error hidden; after that it becomes "Uh oh" with the error and an "Ask AI to fix this" button (new chat with the error and page path). A ⋮ menu is always there: ask AI, show/hide error, copy.

Settings for the chat itself (the fixed suggestions, menu, hooks) are in the root `app.ts`'s `chat`.
`ravelChat.ask(text)` from anywhere opens the panel on a new chat with `text` as the draft.
