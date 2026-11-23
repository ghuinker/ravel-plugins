export type Mode = "light" | "dark";

/** The thread loader's three colours, and whether the page is light (the loaders blend differently there). */
export type Thread = { colors: string[]; light: boolean };

/**
 * What a theme app gives the design system, from the file its `app.ts` lists as `plugs: { "design-system": "./file" }`
 * (exported as `skin`). Its CSS goes after the defaults and components, so its variables win.
 */
export type Skin = {
  /** Variables for both modes under `:root[data-mode=light]` / `[data-mode=dark]`, plus any rules; @import lines may be anywhere. */
  css(): string;
  /** `mode` and the tokens the iOS app reads (`bg`, `card`, `ink`, `accent`, ...), as `theme/tokens.json`. */
  tokens(): Record<string, string>;
  /** Browser files for theme/ by name; `theme.client.ts` runs on every page. Others are removed. */
  client?(): Record<string, string>;
  thread?(): Thread;
};
