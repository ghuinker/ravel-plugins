import { action, argText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { kebab } from "@app/design-system/api.ts";
import { initialValues, saveSetting as save, settingsPanel, userZone } from "@app/settings/api.ts";
import { settings } from "./settings.ts";
import { logAge, groupByApp } from "./view.ts";
import { type LogRow, recentLog, setTypeEnabled, typeEnabled } from "./db.ts";
import { send } from "./send.ts";
import { type NotificationType, notificationTypes, typeById } from "./types.ts";

// Dots are Datastar modifiers, so a type's signal is lowercase with underscores.
const signalOf = (id: string) => `notify_${id.replace(/[.-]/g, "_")}`;

export async function toggle(ctx: Ctx) {
  const id = argText(ctx, "id");
  await setTypeEnabled(id, ctx.signals[signalOf(id)] === true);
}

export async function turnOff(ctx: Ctx) {
  await setTypeEnabled(argText(ctx, "id"), false);
}

export function test() {
  return send("test", { title: "Test notification", body: "Notifications are working on this device.", path: "/settings/notifications" });
}

const typeRow = (ctx: Ctx, type: NotificationType) => html`
  <label class="flex items-center gap-4 px-4 py-3">
    <div class="min-w-0 flex-1">
      <div class="font-medium">${type.label}</div>
    </div>
    <input type="checkbox" data-bind:${signalOf(type.id)} data-on:change="ravel.haptic('select'); ${action(ctx, "toggle", { id: type.id })}" class="t-switch" />
  </label>`;

const typesPanel = (ctx: Ctx, groups: [string, NotificationType[]][]) => groups.map(([app, types]) => html`
  <div class="space-y-1.5">
    <h2 class="px-4 text-xs font-medium uppercase tracking-wide t-muted">${app}</h2>
    <div class="t-group">${types.map((type) => typeRow(ctx, type))}</div>
  </div>`);

const logRow = (ctx: Ctx, row: LogRow, now: number, types: NotificationType[]) => {
  const type = types.find((candidate) => candidate.id === row.type);
  const options = [
    ...(type && !type.asked && typeEnabled(type) ? [{ label: "Turn this type off", icon: "bell-slash", run: action(ctx, "turnOff", { id: type.id }) }] : []),
    { label: "Ask AI", icon: "sparkles", run: `ravelAsk(el, 'notification', '${row.type.replace(/[^\w.-]/g, "")}')` },
  ];
  return html`
    <li class="ask-item flex items-start gap-3 px-4 py-3">
      <span class="mt-1.5 size-2 shrink-0 rounded-full ${row.sent ? "t-accent-bg" : "t-skeleton"}"></span>
      <div class="min-w-0 flex-1">
        <div class="ask-title truncate text-sm font-semibold">${row.title}</div>
        <div class="text-xs t-muted">${row.sent ? "Sent" : `Blocked: ${row.reason}`} · ${type?.label ?? "unregistered"} · ${logAge(row.at, now, userZone())}</div>
      </div>
      ${kebab(`n${row.id}`, options)}
    </li>`;
};

const recentPanel = (ctx: Ctx, types: NotificationType[]) => {
  const now = Date.now();
  const rows = recentLog();
  return html`
    <div class="space-y-1.5">
      <h2 class="px-4 text-xs font-medium uppercase tracking-wide t-muted">Recent</h2>
      <div class="t-group">
        ${rows.length ? html`<ul>${rows.map((row) => logRow(ctx, row, now, types))}</ul>` : html`<p class="px-5 py-4 text-sm t-muted">Nothing has tried to notify you yet.</p>`}
      </div>
    </div>`;
};

const devicePanel = (ctx: Ctx) => html`
  <div class="space-y-1.5" data-signals="{pushstatus: ''}" data-init="ravelPush.status().then((s) => $pushstatus = s).catch(() => $pushstatus = 'unsupported')">
    <h2 class="px-4 text-xs font-medium uppercase tracking-wide t-muted">This device</h2>
    <div class="t-group space-y-3 p-4">
      <p class="text-sm" data-text="{on: 'Notifications are on here.', off: 'Notifications are off here.', denied: 'Blocked in this browser\\'s settings.', unsupported: 'Not supported here (on an iPhone, use the Ravel app or add the site to your Home Screen).'}[$pushstatus] ?? 'Checking…'"></p>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-show="$pushstatus === 'off'" data-on:click="ravelPush.enable().then(() => ravelPush.status()).then((s) => $pushstatus = s).catch((err) => alert(err.message))" class="t-pill rounded-full t-accent-bg px-5 py-2 text-sm font-semibold">Turn on here</button>
        <button type="button" data-on:click="ravel.haptic('tap'); ${action(ctx, "test")}" class="t-pill rounded-full border t-chip px-5 py-2 text-sm font-semibold">Send test</button>
      </div>
    </div>
  </div>`;

const initialSignals = (groups: [string, NotificationType[]][]) => JSON.stringify({
  ...initialValues(settings),
  ...Object.fromEntries(groups.flatMap(([, types]) => types.filter((type) => !type.asked).map((type) => [signalOf(type.id), typeEnabled(type)]))),
});

export default async (ctx: Ctx) => {
  const types = await notificationTypes();
  const groups = groupByApp(types);
  return html`
  <div data-signals="${initialSignals(groups)}" class="t-stagger grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div class="min-w-0 space-y-6">
      ${settingsPanel(ctx, settings, "Delivery", true)}
      ${typesPanel(ctx, groups)}
    </div>
    <div class="min-w-0 space-y-6">
      ${devicePanel(ctx)}
      ${recentPanel(ctx, types)}
    </div>
  </div>`;
};

export const actions = { save, test, toggle, turnOff };
