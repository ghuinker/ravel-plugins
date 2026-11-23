import { html } from "@ravel/html.ts";

/** Registers where the Back pill (top left, drawn by the shell) leads from this page. Put it anywhere in a page below a tab; a page without one shows no pill. */
export const backTo = (href: string) => html`<span data-back-to="${href}" hidden></span>`;
