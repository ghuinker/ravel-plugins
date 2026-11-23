// What an app needs to put a card on Home. An app lists `home: "./home"` in its `plugs` and that file exports `cards`;
// Home collects them (`plugModules` in `cards.ts`) and never imports the apps that plug in.
import type { Ctx } from "@ravel/types.ts";

export type HomeCard = {
  /** Unique across apps. */
  id: string;
  /** Position on the page, lowest first (a phone shows one column in this order). Leave gaps of ten so another card fits between. */
  order: number;
  /** Columns out of 12 on a wide screen. */
  size: 4 | 6 | 8 | 12;
  /** Two rows tall on a wide screen. */
  tall?: boolean;
  /** The card's HTML, usually `homeCard(index, title, body, options)`; `index` is its place in the stagger. A slow card returns a `slot()`. */
  render: (ctx: Ctx, index: number) => unknown | Promise<unknown>;
};

export { CHEV, dots, homeCard, stepDots } from "./ui.ts";
export type { CardOptions } from "./ui.ts";
