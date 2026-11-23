import { glyph } from "./glyph.ts";
import { html } from "@ravel/html.ts";

// One ⋮ menu for the whole site. Any app calls kebab() with a list of options; the popout, placement and closing live here.
export type KebabOption =
  | { label: string; icon?: string; run: string; danger?: boolean } // `run` is a Datastar expression the caller built from safe parts
  | { label: string; icon?: string; href: string; danger?: boolean }
  | { heading: string } // a small heading above the options that follow
  | { rule: true }; // a divider

const KEY = /^[a-z0-9-]+$/;
const DOTS = "M8 12h.01M12 12h.01M16 12h.01";

const optionHtml = (option: KebabOption) => {
  if ("rule" in option) return html`<div class="kebab-rule"></div>`;
  if ("heading" in option) return html`<div class="kebab-label">${option.heading}</div>`;
  const inner = html`<span class="grid w-5 place-items-center">${glyph(option.icon, "size-4")}</span><span>${option.label}</span>`;
  const classes = `kebab-item ${option.danger ? "danger" : ""}`;
  return "href" in option
    ? html`<a role="menuitem" href="${option.href}" class="${classes}">${inner}</a>`
    : html`<button type="button" role="menuitem" class="${classes}" data-on:click="${option.run}; $menu = ''">${inner}</button>`;
};

/** `key` names this menu on the page (lowercase letters, digits, dashes). Only one menu is open at a time. */
export function kebab(key: string, options: KebabOption[], label = "More options") {
  if (!KEY.test(key)) throw new Error(`kebab key must match ${KEY}: ${key}`);
  const open = `$menu === '${key}'`;
  return html`
    <div class="kebab" data-signals__ifmissing="{menu: ''}" data-on:click__outside="${open} && ($menu = '')">
      <button type="button" class="kebab-btn" aria-label="${label}" aria-haspopup="menu" data-attr:aria-expanded="${open} ? 'true' : 'false'" data-on:click__stop="${open} || ravel.haptic('tap'); $menu = ${open} ? '' : '${key}'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="size-6"><circle cx="12" cy="12" r="9.5" stroke-width="1.6" /><path d="${DOTS}" /></svg>
      </button>
      <div class="kebab-pop t-nav" role="menu" data-show="${open}" style="display:none">${options.map(optionHtml)}</div>
    </div>`;
}
