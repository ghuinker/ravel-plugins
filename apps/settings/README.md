# settings

The settings kit: every app's settings and small state, with no page of its own. `apps/settings-page` draws `/settings` from it; another page can draw the same settings its own way.

- An app declares its settings in `apps/<app>/settings.ts` and plugs it in with `settings: "./settings"` in its `app.ts`'s `plugs`:
  `export const settings = define(import.meta, { label, icon, blurb, order?, pane?, values: { name: { type: "number" | "switch", label, hint, fallback, min?, max? } } })`.
  It reads them with `settings.get("name")` (typed, clamped, the fallback when unset) and writes with `settings.set`.
  Keys are stored as `<app folder>.<name>`.
- `pane` is a fragment that draws the app's whole section, its values included (with `settingsPanel`). Without one, the settings page shows the values under Preferences.
- `state(import.meta)` is an app's undeclared key/value state (sync cursors, one-time flags), stored as `<app folder>.<key>`; nothing shows it.
- `list()` imports every app's plugged-in `settings` file (by `order`); `getValue` / `setValue` take a full key, for pages that show many apps' settings.
- `cards.ts`: the rows (`t-switch`, pill stepper). `settingsPanel(ctx, settings, title?, switchesFirst?)` draws one app's values; the fragment puts `initialValues(settings)` in its `data-signals` and exports `saveSetting` as its `save` action.
- `jobs.ts`: job switches and the job list. An app's `app.ts` exports all its jobs as `jobs` and registers the enabled ones with `jobs: enabledJobs(jobs)`. `listJobs()` reads every app's `jobs` (name, app, path, the first-line `//` description); `setJobEnabled(name, on)` stores `settings.job-off.<name>` and re-saves that `app.ts` so Ravel drops or restores the schedule.
- Other apps import only `@app/settings/api.ts`.
- `zone.ts`: the owner's home zone (`tz.home`, `homeZone()`) and current zone (`tz.current`, `userZone()` / `currentZone()`), `reportZone` for the root `app.ts`'s `zone.report`, `setHomeZone`, and `fmt` (formats in the current zone). Zone-free date helpers stay in `lib/time.ts`.
- Storage is the `settings` table. `getSetting` / `setSetting` read and write a raw key, for keys that predate `state()` (`tz.*`, `cleanup.last`).
