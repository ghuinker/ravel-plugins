# shell

The layout every page renders inside (`layout` in the root `app.ts`). It gets the page as `ctx.page` and every app's
nav entries as `ctx.nav`, and draws the tab bar (`tabBar` from `apps/design-system`) and the chat (`apps/ai`) around it. Visitors get the page
alone; in the iOS app the tab bar and chat are native, so they're left out there too.

Ravel's router swaps only the page when a link is clicked, so anything here stays put across pages.

On a computer the tab bar is the frosted pill across the top, in every theme (`base.css` in `apps/design-system` styles it); a phone keeps it at the bottom.

The tab bar shows Home, Notes, Todo and Forward (the first four nav entries) with the rest under More, in the side and top variants alike.

`back.ts` (with `back.css`, `back.client.ts`) is the **Back** pill fixed at the top left, shown only on pages that register a parent with `backTo(href)` from the design system (the client script watches the page pane for it). It goes back in history after in-site navigation, otherwise to the registered parent. Pages must not draw their own back link.

`transition.client.ts` (loaded by `apps/theme`'s `theme.client.ts`) animates page changes: sideways toward the side the new tab sits on in the bar (nav order), and a slight zoom in or out when going into or back out of a page. Ravel's router swaps the page in place, so it animates the `data-page-pane` wrapper: `ravel-navigate` starts the exit, the first change inside the pane starts the entrance (or after 2.5 s it brings the page back). A full page load keeps the fade in `base.css`.

