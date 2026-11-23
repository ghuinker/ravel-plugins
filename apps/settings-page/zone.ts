import { ref } from "@ravel/slot.ts";
import { action, argText, js } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { isZone } from "../../lib/time.ts";
import { currentZone, homeZone, setHomeZone } from "@app/settings/api.ts";

const rowClass = "flex w-full items-center justify-between gap-3 px-4 py-3 text-left";

/** "America/Denver" as "Denver", with the zone's current offset, e.g. "Denver (GMT-7)". */
export function zoneLabel(tz: string) {
  const city = tz.split("/").pop()!.replaceAll("_", " ");
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value ?? "";
  return `${city} (${offset})`;
}

/** Makes the zone the owner is in now their home zone, or the one picked from the list. */
export function home(ctx: Ctx) {
  const picked = argText(ctx, "zone") || currentZone();
  if (setHomeZone(picked)) ctx.signals.zoneChanged = true;
}

// Drawn inside the account page, so its buttons post here by name.
const ZONE = ref(import.meta, "./zone");

const allZones = () => (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf("timeZone");

/** The Time zone block on the Account page: where the owner is now, their home zone, and a picker for home. */
export default (_ctx: Ctx) => {
  const current = currentZone();
  const home = homeZone();
  const away = current !== home;
  return html`
    <div class="space-y-1.5" data-signals="{zoneChanged: false, homePick: ''}" data-effect="$zoneChanged && location.reload()">
      <div class="t-group">
        <div class="${rowClass}"><span>Now</span><span class="min-w-0 truncate t-muted">${zoneLabel(current)}</span></div>
        <div class="${rowClass}"><span>Home</span><span class="min-w-0 truncate t-muted">${zoneLabel(home)}</span></div>
        ${away ? html`<button class="w-full px-4 py-3 text-center font-medium t-accent t-hover" data-on:click="ravel.haptic('success'); ${action(ZONE, "home")}">Use ${zoneLabel(current)} as home</button>` : ""}
        <label class="${rowClass}"><span>Change home</span>
          <select class="t-field max-w-[60%] px-2 py-1" data-bind:homePick data-on:change="$homePick && (ravel.haptic('select'), ${action(ZONE, "home", { zone: js("$homePick") })})">
            <option value="">Choose…</option>
            ${allZones().filter(isZone).map((zone) => html`<option value="${zone}">${zone.replaceAll("_", " ")}</option>`)}
          </select>
        </label>
      </div>
      <p class="px-4 text-xs t-muted">Now follows the device you open the site on. Home is for habits, backups and nightly work. Quiet hours and sunset follow where you are.</p>
    </div>`;
};

export const actions = { home };
