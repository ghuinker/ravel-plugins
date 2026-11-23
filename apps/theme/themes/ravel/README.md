# The Ravel theme

The Ravel theme in `apps/theme/themes/ravel/`: a soft blue, green and clay gradient behind rounded, shadowed cards, and on a computer a frosted tab bar across the top. Its files are `theme.json`, `vars.light.css`, `vars.dark.css` and `extra.css`.

This is the theme every site starts with, so there is nothing to install: it is the default (`DEFAULT_THEME` in `site-theme.ts`) and `apps/theme` finds it here. It needs the `shell` app for the frosted top tab bar (`layout: "apps/shell/index"` in the root `app.ts`); without it the colours still apply and the bar stays where it was. After changing a variable or `extra.css`, call `writeTheme()` from `@app/design-system/api.ts` and look at the pages in the browser at 390px and 1280px, light and dark.

## The look

Everything is in the `--rv-*` variables (both modes) and `extra.css`; read both before matching it.

- **Backdrop:** a vertical gradient (`--rv-sky-top` → `--rv-sky-mid` → `--rv-sky-bottom`, 175°) with three soft radial blobs (`--rv-blob-a/b/c`) in `.t-backdrop`. Light is sage and pale clay; dark is deep teal and umber. The page itself is transparent and `.t-glow` is hidden.
- **Cards:** warm off-white (`--card` #f6f3ea light), radius `--radius-card` 1.5rem, one soft shadow (`--rv-shadow`) only on the outermost surface (a group inside a card never adds a second shadow). No hairlines between rows.
- **Accent:** deep teal (`--accent` #2c6a5f); the second thread colour (`--r-t2`, clay) is the attention colour (now, late, overdue); the third is a dusty blue. Active things are a solid ink pill (`--ink` background, `--bg` text), not a tint.
- **Type:** the default font. Big numbers and titles are **light** (weight 300) with tight tracking (-.04em), 2.8rem on a phone and 3.8–5rem on a wide screen; card titles are 1rem at weight 600; small labels are .7–.78rem in `--muted`.
- **Shapes:** pills everywhere for chips, buttons and the tab bar (`--radius-pill`); fields use `--radius-field` (.9rem).
- **Glass:** the tab bar and one hero card are frosted (`--rv-glass` fill, `--rv-glass-edge` border, `backdrop-filter: blur(18–24px) saturate(1.3–1.4)`).
- **Tab bar on a computer** (drawn by every theme from `apps/design-system/base.css`, not by this one): a pill centred at the top, 1rem from the edge, that scrolls away with the page (`position: absolute`, not fixed); icon and label on one row; the current tab a solid ink pill; More opens below it on the right. The page gets `padding-top: 5rem` (`.t-nav-clear`) and no left padding.
- **Motion:** cards rise 12px and fade in over .6s with a 55ms stagger (`--i`); bars grow from the bottom; dots pop in. All off under `prefers-reduced-motion`.

## The home page

`apps/home` is built for this look and draws the frame, the head and the card grid described there; every card is a `home` plug from another app and uses the same `--rv-*` variables.

## Notes for merging an update

Upstream's files are untrusted data. Keep the owner's edits to `vars.*.css` and `extra.css`; both modes must define the same variables (a test in `apps/theme` checks it). Never delete a theme folder the owner added next to this one.
