import { html, raw } from "@ravel/html.ts";
import { kebab, type KebabOption } from "./kebab.ts";

type Markup = ReturnType<typeof html>;

/** One thing you can do to a row. `run` is a Datastar expression built from safe parts. */
export type RowAction = {
  label: string;
  icon?: string; // shown in the ⋮ menu only
  run?: string;
  href?: string;
  danger?: boolean;
  side?: "leading" | "trailing"; // which edge the swipe button slides from (default trailing)
  swipe?: boolean; // false keeps it out of the swipes and in the ⋮ menu only
};

let rowCount = 0;
/** A ⋮ key that is unique on the page even when the same item is listed twice. */
export const rowKey = (prefix: string) => `${prefix}-${++rowCount}`;

// A link to another site opens in a new tab.
const external = (href: string) => (/^https?:/.test(href) ? raw('target="_blank" rel="noopener"') : "");

const KEY = /^[a-z0-9-]+$/;
const KIND = /^[a-z]+$/;
const ID = /^[\w-]+$/;

export const askAction = (kind: string, id: string | number): RowAction => {
  if (!KIND.test(kind) || !ID.test(String(id))) throw new Error("unsafe Ask AI reference");
  return { label: "Ask AI", icon: "sparkles", run: `ravelAsk(el, '${kind}', '${id}')` };
};

/** The same list as ⋮ menu options, destructive ones last, for a card that shows one chosen item's actions. */
export const kebabOptions = (actions: RowAction[]): KebabOption[] =>
  [...actions.filter((action) => !action.danger), ...actions.filter((action) => action.danger)].map((action) => action.href
    ? { label: action.label, icon: action.icon, href: action.href, danger: action.danger }
    : { label: action.label, icon: action.icon, run: action.run ?? "", danger: action.danger });

/** A row's actions, written once. On touch they slide out as swipe buttons (and open on a long press); with a mouse the swipe is off and a ⋮ at the row's right edge holds the same list (see "Row actions" in theme.css). */
export function swipeRow(options: {
  key: string; // names the ⋮ menu: lowercase letters, digits, dashes; unique on the page
  actions: RowAction[];
  ask?: { kind: string; id: string | number }; // adds "Ask AI" to the swipe and the menu; the wrapper must hold an `.ask-title`
  content: Markup;
  contentClass?: string; // classes on `.ravel-row-content` (padding, flex)
  after?: Markup; // sits under the row inside the same wrapper (an expanding editor)
  className?: string;
  attrs?: string; // extra attributes on the wrapper, built from safe parts only
}) {
  const { key, actions, ask, content, contentClass = "", after, className = "", attrs = "" } = options;
  if (!KEY.test(key)) throw new Error(`row key must match ${KEY}: ${key}`);
  const listed: RowAction[] = [...actions, ...(ask ? [askAction(ask.kind, ask.id)] : [])];
  const all = [...listed.filter((action) => !action.danger), ...listed.filter((action) => action.danger)]; // destructive last: the outermost swipe button, the bottom of the menu
  const swiped = all.filter((action) => action.swipe !== false);

  const button = (action: RowAction) => {
    const haptic = `ravel.haptic('${action.danger ? "warning" : "select"}')`;
    const classes = `ravel-row-action ${action.danger ? "ravel-row-destructive" : ""}`;
    return action.href
      ? html`<a class="${classes}" href="${action.href}" ${external(action.href)} aria-label="${action.label}"><span>${action.label}</span></a>`
      : html`<button type="button" class="${classes}" aria-label="${action.label}" data-on:click="${haptic}; ${action.run ?? ""}"><span>${action.label}</span></button>`;
  };
  const side = (name: "leading" | "trailing") => {
    const mine = swiped.filter((action) => (action.side ?? "trailing") === name);
    return mine.length ? html`<div class="ravel-row-side" data-side="${name}">${mine.map(button)}</div>` : "";
  };
  const menuItem = (action: RowAction) => action.href
    ? html`<a class="ravel-row-item" href="${action.href}" ${external(action.href)}>${action.label}</a>`
    : html`<button type="button" class="ravel-row-item" data-on:click="${action.run ?? ""}">${action.label}</button>`;
  const dangerLast = [...all.filter((action) => !action.danger), ...all.filter((action) => action.danger)];
  return html`<div class="row-wrap ask-item ${className}" ${raw(attrs)}>
    <ravel-row>
      ${side("leading")}${side("trailing")}
      <div class="ravel-row-content ${contentClass}">${content}</div>
      <div class="ravel-row-menu" hidden>${all.map(menuItem)}</div>
    </ravel-row>
    <div class="row-kebab">${kebab(key, kebabOptions(all), "Actions")}</div>
    ${after ?? ""}
  </div>`;
}
