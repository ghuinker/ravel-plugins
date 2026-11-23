import { action, argText, js } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { dialValue, savePick } from "./picks.ts";
import { writeTheme } from "@app/design-system/api.ts";
import { currentTheme } from "./site-theme.ts";
import { themeDials } from "./theme-dials.ts";

// One dial of the active theme; the value must be one the theme offers.
export async function pick(ctx: Ctx) {
  if (savePick(argText(ctx, "kind"), argText(ctx, "value"))) await writeTheme();
}

// A fixed theme's numeric dials: a pill stepper per dial. The change shows at once (the theme's script rebuilds its scenery), then it is saved.
const stepperRows = (ctx: Ctx, theme: string) => html`
  <div>
    ${themeDials(theme).map((dial) => {
      const name = `$dial_${dial.kind}`;
      const next = (sign: "-" | "+") => sign === "-" ? `Math.max(${dial.min}, ${name} - 1)` : `Math.min(${dial.max}, ${name} + 1)`;
      const change = (sign: "-" | "+") =>
        `ravel.haptic('select'); ${name} = ${next(sign)}; Object.assign(window.__themeDials ??= {}, {${dial.kind}: ${name}}); window.__themeRefresh?.(); ${action(ctx, "pick", { kind: dial.kind, value: js(name) })}`;
      return html`
        <div class="flex items-center gap-4 px-4 py-3">
          <div class="min-w-0 flex-1">
            <div class="font-medium">${dial.label}</div>
            <p class="mt-0.5 text-sm t-muted">${dial.hint}</p>
          </div>
          <div class="t-pill t-chip flex shrink-0 items-center rounded-full border">
            <button type="button" aria-label="Fewer" data-on:click="${change("-")}" class="size-9 text-xl leading-none">−</button>
            <span class="w-10 text-center" data-text="${name}"></span>
            <button type="button" aria-label="More" data-on:click="${change("+")}" class="size-9 text-xl leading-none">+</button>
          </div>
        </div>`;
    })}
  </div>`;

export default (ctx: Ctx) => {
  const theme = currentTheme();
  const signals = JSON.stringify(Object.fromEntries(themeDials(theme).map((dial) => [`dial_${dial.kind}`, dialValue(dial.kind, dial.fallback, dial.min, dial.max)])));
  return html`<div data-signals="${signals}">${stepperRows(ctx, theme)}</div>`;
};

export const actions = { pick };
