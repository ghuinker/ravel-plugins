// The design system: what other apps import as `@app/design-system/api.ts`. Its CSS (the t-*, bn-*, kebab-*, md, rich
// and hm-* classes) is in theme/theme.css on every page, so these only return markup. Safe to bundle for the browser:
// the theme writer loads only when called.
export * from "./bento.ts";
export * from "./kebab.ts";
export * from "./row-actions.ts";
export * from "./skeleton.ts";
export * from "./rich-edit.ts";
export * from "./heatmap.ts";
export * from "./list.ts";
export * from "./controls.ts";
export * from "./segmented.ts";
export * from "./fab.ts";
export * from "./tabbar.ts";
export * from "./back.ts";
export { escapeHtml, renderInline, renderMarkdown } from "./markdown.ts";
export type { Mode, Skin, Thread } from "./types.ts";
import type { Skin } from "./types.ts";

/** Rewrites theme/ (or `folder`) from the defaults and the installed skin (or `skin`). A theme app calls it after any change to its look. */
export const writeTheme = async (folder?: string, skin?: Skin) => (await import("./write.ts")).writeTheme(folder, skin);

/** The thread loader's colours for the current theme and mode. */
export const thread = async () => (await import("./write.ts")).thread();
export * from "./glyph.ts";
