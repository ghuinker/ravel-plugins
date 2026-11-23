import { action, argText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { type NumberValue, type Settings, setValue, type SwitchValue } from "./define.ts";

// Dots are Datastar modifiers, attribute names are lowercased and dashes turn into camelCase, so signals are lowercase with underscores.
const signalName = (key: string) => `setting_${key.replace(/[^A-Za-z0-9]/g, "_").toLowerCase()}`;

const entries = (settings: Settings) => Object.entries(settings.spec.values).map(([name, value]) => ({ key: settings.key(name), name, value }));

/** The `save` action of any fragment that shows setting cards: `export const actions = { save: saveSetting }`. */
export async function saveSetting(ctx: Ctx) {
  const key = argText(ctx, "key");
  await setValue(key, ctx.signals[signalName(key)]);
}

/** The signals the cards bind to, for the `data-signals` of the element around them. */
export const initialValues = (...all: Settings[]): Record<string, number | boolean> =>
  Object.fromEntries(all.flatMap((settings) => entries(settings).map(({ key, name }) => [signalName(key), settings.get(name)])));

// A number setting is a row with a pill stepper: tap − or + (big ranges step by 10) or type in the middle.
const numberCard = (ctx: Ctx, key: string, setting: NumberValue) => {
  const name = `$${signalName(key)}`;
  const step = setting.max - setting.min > 200 ? 10 : 1;
  const save = action(ctx, "save", { key });
  const next = (sign: "-" | "+") => sign === "-" ? `Math.max(${setting.min}, ${name} - ${step})` : `Math.min(${setting.max}, ${name} + ${step})`;
  const change = (sign: "-" | "+") => `ravel.haptic('select'); ${name} = ${next(sign)}; ${save}`;
  return html`
  <div class="flex items-center gap-4 px-4 py-3">
    <div class="min-w-0 flex-1">
      <label class="font-medium" for="${signalName(key)}">${setting.label}</label>
    </div>
    <div class="t-pill t-chip flex shrink-0 items-center rounded-full border">
      <button type="button" aria-label="Decrease" data-on:click="${change("-")}" class="size-9 text-xl leading-none">−</button>
      <input id="${signalName(key)}" type="number" min="${setting.min}" max="${setting.max}" data-bind:${signalName(key)}
        data-on:change="${save}"
        class="w-14 bg-transparent text-center outline-none [appearance:textfield]" />
      <button type="button" aria-label="Increase" data-on:click="${change("+")}" class="size-9 text-xl leading-none">+</button>
    </div>
  </div>`;
};

const switchCard = (ctx: Ctx, key: string, setting: SwitchValue) => html`
  <label class="flex items-center gap-4 px-4 py-3">
    <div class="min-w-0 flex-1">
      <div class="font-medium">${setting.label}</div>
    </div>
    <input type="checkbox" data-bind:${signalName(key)}
      data-on:change="ravel.haptic('select'); ${action(ctx, "save", { key })}"
      class="t-switch" />
  </label>`;

/** One app's values as a group of rows under a small heading. The fragment needs `initialValues` in its signals and `saveSetting` as its `save` action. */
export const settingsPanel = (ctx: Ctx, settings: Settings, title = settings.spec.label, switchesFirst = false) => {
  const all = entries(settings);
  const numbers = all.flatMap(({ key, value }) => value.type === "number" ? [numberCard(ctx, key, value)] : []);
  const switches = all.flatMap(({ key, value }) => value.type === "switch" ? [switchCard(ctx, key, value)] : []);
  return html`
  <div class="space-y-1.5">
    <h2 class="px-4 text-xs font-medium uppercase tracking-wide t-muted">${title}</h2>
    <div class="${numbers.length && switches.length ? "t-group-lined" : "t-group"}">
      ${switchesFirst ? [...switches, ...numbers] : [...numbers, ...switches]}
    </div>
  </div>`;
};
