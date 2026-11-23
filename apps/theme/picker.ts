import { action, argText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { currentMode, savePick } from "./picks.ts";
import { appChanged } from "@ravel/app.ts";
import { writeTheme } from "@app/design-system/api.ts";
import { currentTheme, listThemes, previewClass, setTheme, themeLabel } from "./site-theme.ts";

// The site-wide choices: light or dark (every theme has both), and which theme, when there is more than one.
export async function use(ctx: Ctx) {
  if (!setTheme(argText(ctx, "name"))) return;
  await writeTheme();
  appChanged(); // the tab bar and the home page can differ per theme, so open pages reload
}

export async function mode(ctx: Ctx) {
  if (savePick("mode", argText(ctx, "value"))) await writeTheme();
}

const MODES = [["dark", "Dark"], ["light", "Light"]] as const;

export default (ctx: Ctx) => {
  const active = currentTheme();
  const current = currentMode();
  const themes = listThemes();
  return html`
    <div class="space-y-6">
      <div>
        <div class="mb-2 text-[11px] font-semibold uppercase tracking-widest t-muted">Mode</div>
        <div class="t-pill t-chip inline-flex gap-1 border p-1">
          ${MODES.map(([value, label]) => html`<button type="button" data-on:click="ravel.haptic('select'); ${action(ctx, "mode", { value })}.then(() => location.reload())" class="t-pill px-4 py-1.5 text-sm font-semibold ${current === value ? "t-active" : "t-hover"}">${label}</button>`)}
        </div>
      </div>
      ${themes.length > 1 ? html`
      <div>
        <div class="mb-2 text-[11px] font-semibold uppercase tracking-widest t-muted">Theme</div>
        <ul class="grid grid-cols-2 gap-3 lg:grid-cols-3">
          ${themes.map((name) => html`
            <li>
              <button type="button" data-on:click="ravel.haptic('select'); ${action(ctx, "use", { name })}.then(() => location.reload())" class="block h-full w-full border p-2 text-left ${name === active ? "t-active" : "t-card"}" style="border-radius:var(--radius-card)">
                <div class="${previewClass(name)} t-bg flex flex-col items-center gap-2 border t-border p-2" style="border-radius:var(--radius-field)">
                  <div class="size-8 rounded-lg t-accent-grad"></div>
                  <div class="w-full space-y-1.5">
                    <div class="h-2 w-2/3 rounded-full t-skeleton"></div>
                    <div class="h-2 w-1/3 rounded-full t-skeleton"></div>
                  </div>
                </div>
                <div class="mt-2 text-center">
                  <div class="truncate text-sm font-bold">${themeLabel(name)}</div>
                  ${name === active ? html`<div class="text-[11px] t-accent">Current</div>` : ""}
                </div>
              </button>
            </li>`)}
        </ul>
      </div>` : ""}
    </div>`;
};

export const actions = { mode, use };
