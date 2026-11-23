# home

`/`: a soft frosted frame on the theme's gradient with the date, "Good morning" (or afternoon, evening) with a small loop, the ask box, and a grid of cards. Home itself draws only that head and the grid; **every card comes from another app**, so installing or deleting an app adds or removes its card and Home never imports it. Built for the Ravel theme (it uses its `--rv-*` variables, with fallbacks for other themes). Visitors get an empty page.

## Putting a card on Home

An app lists `home: "./home"` in its `plugs` (`apps/goals` uses `"./spark/home"`); that file exports `cards: HomeCard[]` (types in `api.ts`):

- `id` (unique), `order` (lowest first; a phone is one column in this order; the apps leave gaps of ten), `size` (4, 6, 8 or 12 of 12 columns from 1100px wide) and `tall` (two rows high).
- `render(ctx, index)`: the card's HTML, usually `homeCard(index, title, body, { href, sheet, count, tone, className })` from `@app/home/api.ts` (a title that links or opens a sheet, a muted count, the body). `index` is its place in the rise-in stagger. A slow card returns a `slot()` with a skeleton (`apps/dev/home.ts`, `apps/todo/home.ts`). A card that throws is logged and left out.
- Pieces for the body: `dots`, `stepDots`, `CHEV` and the `h2-*` classes in `home.css` (tables with a header of muted labels and rows on one grid, chips `h2-chip` / `h2-ok` / `h2-hot` / `h2-warn`, short lists `h2-list` / `h2-line`, `h2-empty`). A card's own parts are styled in its app (`apps/<app>/home.css`, loaded with `styles()` in the card).
- Actions a card posts live in the same file (`export const actions`).

Who adds what (`order`, `size`): Assistant `apps/assistant/home.ts` (Your day 10/8, Upcoming 20/4, For you 40/4, Next steps 50/4), Todo `apps/todo/home.ts` (Tasks 30/8 tall, with the add field and checks), Habits 60/6, Days since 70/6, Workouts 80/6, Spark (`apps/goals/spark/home.ts`) 90/6, Finances 100/4, System (`apps/dev/home.ts`) 110/4, Planit 120/4, Notes 130/12.

## Files

- `index.ts`: the page: head, ask box and the grid of cells (one per card, `--span` and `--rows` set from `size` and `tall`).
- `cards.ts`: `homeCards()`, every installed app's `home` plug, one per id, in order (`plugModules` from `lib/plugs.ts`).
- `api.ts`, `ui.ts`: the card type and what cards draw with (`homeCard`, `dots`, `stepDots`, `CHEV`).
- `hello.ts`: the greeting and the date in the owner's current zone.
- `ask.ts`: `askBox()`, the one-line input under the greeting (styles `.bt-ask` in `home.css`). Enter sends the text to a new chat tab and opens the chat panel (`$chatOpen`); `todo:` still adds tasks without the AI.
- `home.css`: the frame, head, grid and the shared card, table, chip, dot and list styles. `home.test.ts`: the greeting, card order and the card frame.
