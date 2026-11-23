# notes

`/notes`: notes in the style of Mac Notes (tags instead of folders, pinning, trash kept 30 days, markdown), styled like iOS Notes.
Works offline (`.ravel/offline.md`): every note is in the page as `$notes`, and the list,
editor render in the browser.

- `index.ts`: actions and the page. Note actions take the note's id in the payload. `save` sends the whole text as `body` and makes the note on the first save that has any text; `discard` removes a note that was emptied; the page load sweeps up leftover blank, untagged, unpinned notes. **A blank note is never kept.**
- `db.ts`: table `notes` (`table()`; text ids, times in ms); all queries. Folders were removed (tags replace them); the old `folder_id` column and `folders` table are left alone.
- `title.ts`: job `notes-title`: Haiku writes `auto_title` for a note whose first line is a paragraph (over 70 characters) once it has 12+ words; the list shows it. Started 20 s after such a save. ⋮ → Add title puts that title (or an empty line) on top of the text.
- `view.ts`: server markup (the open note reads like Apple Notes: only the text, with a small tags pill at the right above it (when it has tags) and the date as a quiet line under it; the ⋮ `kebab()` (the top row holds the back link, format pill, Done and ⋮ and is folded away while a note is only being read, so the text starts right under the page top; Pin, Tags, Add title, Delete, or Restore and Delete forever; focusing the text (`$rf`) brings in Done on a phone and the format pill on a desktop): the search box and filter dropdown (All notes, each tag, Deleted: `$view`, `$tag`), the round glass new-note button (`composeButtons`), and the editor. The note is one rich text whose first line is the title (styled in `notes.css`; a long first line isn't); a new note exists only in the browser (`ravel.add` with no action) and takes focus inside the tap so a phone raises the keyboard. Leaving it (`notesView.leaving`) drops it if still blank.
- `list.ts`: browser code for the list, preview, task toggles and the open note and view, which
  each device keeps in `localStorage`.
- `format.ts`: title/preview/date helpers (server and browser). `notePreview` strips markdown marks for the list.
- `notes.client.ts`: the page's `notesView` script, bundled by `clientScript()` (its `clientVersion()` changes on save, so the page re-runs it); the tests import `list.ts` directly.
- `notes.css`: widens the page shell on desktop and clears the side nav, like Todo.

- Tags: each note can carry several tags (through `@app/tags/api.ts`): a chip each in the list, a small tags pill right above the text (shown when the note has tags, or from ⋮ → Tags) that opens a menu of toggles, and a filter row in the left bar (`$tag`, matching any of a note's tags). Tagging needs a connection (`setTag` action with `tag` and `on`).
- A note has its own page at `/notes/<id>`: the app pushes it, a browser opens it beside the list. An unknown id gets a blank note, since a new one can open before its create action arrives.

Other apps read notes only through `api.ts` (`@app/notes/api.ts`); `home.ts` is the Notes card on Home (a `home` plug).

- `tag-items.ts`: notes as a taggable kind (`note`), plugged into Tags as `tags: "./tag-items"`.

Rich text fields use the design system's editor (`richField`, `richBar`, `richToolbar`, `richSignals` and `richScript` from `@app/design-system/api.ts`; see `apps/design-system/README.md`). The page adds `${await richScript()}` and `richSignals` to its signals, and its attributes call `ravelRich.richLoad` / `ravelRich.richFocus`.

## For whoever merges updates

- `api.ts` is the contract with other apps (assistant, home): keep its names and shapes, or update every caller.
- Requires `tags` and `design-system`.
