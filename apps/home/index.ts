import { clientScript, styles } from "@ravel/client.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { askBox } from "./ask.ts";
import { homeCards } from "./cards.ts";
import { hello } from "./hello.ts";

/** Home: a greeting, the date and the ask box on a soft frame, over a grid of cards that the installed apps put there (`cards.ts`, `api.ts`). */
export default async (ctx: Ctx) => {
  if (!ctx.owner) return html``;
  const top = hello();
  const cards = await homeCards();
  const cells = await Promise.all(cards.map(async (card, index) => {
    try {
      return html`<div class="h2-cell" data-card="${card.id}" style="--span:${card.size};--rows:${card.tall ? 2 : 1}">${await card.render(ctx, index)}</div>`;
    } catch (error) {
      console.error(`home card ${card.id} not drawn:`, error);
      return html``;
    }
  }));
  return html`
    ${styles(import.meta.resolve("./home.css"))}
    <div class="h2-page">
      <div class="h2-frame">
        <header class="h2-top">
          <p class="h2-meta t-muted">${top.date}</p>
          <h1 class="h2-hello"><canvas class="h2-mark" data-ravel-loader="idle" data-key="hello" data-ignore-morph aria-hidden="true"></canvas>${top.greeting}</h1>
          ${askBox(ctx)}
        </header>
        ${cells.length ? html`<div class="h2-grid">${cells}</div>` : ""}
      </div>
    </div>`;
};
