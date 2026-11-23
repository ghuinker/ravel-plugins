import { action } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import { heatmap as heatmapOf, kebab } from "@app/design-system/api.ts";
import { openChat } from "./list.ts";
import { heatGrid, heatLevel, minutesLabel, money, plural, weekCounts } from "./format.ts";
import type { ChatRow } from "./stats.ts";
import { dateIn } from "../../lib/time.ts";

const TOP_APPS = 6;

const countUp = (value: number, places = 0, prefix = "") =>
  html`<span data-init="convView.count(el)" data-count="${Number(value.toFixed(places))}" data-places="${places}" data-prefix="${prefix}">${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places })}</span>`;

const tile = (index: number, label: string, big: ReturnType<typeof html>, note: string) => html`
  <div class="cv-tile" style="--i:${index}"><div class="text-xs t-muted">${label}</div><div class="cv-big t-ink">${big}</div><div class="text-xs t-muted">${note}</div></div>`;

function delta(now: number, before: number) {
  const change = now - before;
  return change === 0 ? "same as last week" : `${change > 0 ? "▲" : "▼"} ${Math.abs(change)} vs last week`;
}

const MAX_POP_ROWS = 6;

/** Twelve weeks of messages sent, one square a day. Hovering (or tapping) a day pops down the chats you wrote in; tapping one opens it. */
export function heatmap(rows: ChatRow[], zone: string, now = Date.now()) {
  const daily: Record<string, number> = {};
  const chatsOn = new Map<string, { row: ChatRow; count: number }[]>();
  for (const row of rows) {
    for (const [day, count] of Object.entries(row.daily)) {
      daily[day] = (daily[day] ?? 0) + count;
      chatsOn.set(day, [...(chatsOn.get(day) ?? []), { row, count }]);
    }
  }
  const days = heatGrid(daily, dateIn(now, zone)).flat();
  const max = Math.max(0, ...days.map((cell) => cell?.count ?? 0));
  const cells = days.map((cell) => {
    if (!cell) return null;
    const chats = (chatsOn.get(cell.day) ?? []).sort((a, b) => b.count - a.count);
    const pop = chats.length
      ? html`${chats.slice(0, MAX_POP_ROWS).map(({ row: chat, count }) => html`<button type="button" class="hm-pop-row" data-on:click="ravel.haptic('tap'); ${openChat(chat.id)}"><span class="hm-pop-name">${chat.title}</span><span class="t-muted">${count}</span></button>`)}
        ${chats.length > MAX_POP_ROWS ? html`<div class="t-muted">+${chats.length - MAX_POP_ROWS} more</div>` : ""}`
      : html`<div class="t-muted">No chats</div>`;
    return { shade: heatLevel(cell.count, max) / 4, title: shortDay(cell.day), pop };
  });
  return heatmapOf({ cells, label: "Messages you sent in the last 12 weeks" });
}

const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

/** Totals, the heatmap, and the one ⋮ menu for the page. */
export function hero(rows: ChatRow[], zone: string, name: string, now = Date.now()) {
  const { thisWeek, lastWeek } = weekCounts(rows.map((row) => row.startedAt), now);
  const sent = rows.reduce((sum, row) => sum + row.sent, 0);
  const minutes = rows.reduce((sum, row) => sum + row.activeMinutes, 0);
  const cost = rows.reduce((sum, row) => sum + row.costUsd, 0);
  const menu = kebab("conv-page", [
    { label: "Refresh", icon: "↻", run: action(name, "refresh") },
    { label: "Ask AI", icon: "sparkles", run: "ravelAsk(el, 'chats', 'page')" },
  ]);
  return html`
    <section class="cv-hero t-card border">
      <div class="flex items-start justify-between gap-3">
        <div><h2 class="t-title text-base">Your chats</h2><p class="text-sm t-muted">${plural(rows.length, "chat")} so far, ${plural(thisWeek, "chat")} this week</p></div>
        ${menu}
      </div>
      <div class="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          ${tile(0, "This week", countUp(thisWeek), delta(thisWeek, lastWeek))}
          ${tile(1, "Messages sent", countUp(sent), `across ${plural(rows.length, "chat")}`)}
          ${tile(2, "Time together", html`${minutesLabel(minutes)}`, "active, not idle")}
          ${tile(3, "Spent", countUp(cost, 2, "$"), cost ? `${money(cost / Math.max(1, rows.length))} a chat` : "nothing logged")}
        </div>
        <div class="cv-heatwrap"><div class="mb-1 text-xs t-muted">Last 12 weeks</div>${heatmap(rows, zone, now)}</div>
      </div>
    </section>`;
}

/** Shown beside the list while no chat is picked: which apps the chats changed most. */
export function appsAside(rows: ChatRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) for (const app of row.touched) counts.set(app, (counts.get(app) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, TOP_APPS);
  const widest = top[0]?.[1] ?? 1;
  return html`
    <div data-show="$sel === ''" class="space-y-2">
      <h2 class="t-title px-1 text-base">Most changed</h2>
      <div class="t-card rounded-2xl border p-4">
        ${top.length ? top.map(([app, chats], index) => html`
          <div class="cv-bar" style="--i:${index}"><div class="flex justify-between text-sm"><span class="t-ink">${app}</span><span class="t-muted">${plural(chats, "chat")}</span></div>
            <div class="cv-track t-chip"><div class="cv-fill t-accent-bg" style="width:${Math.max(6, Math.round((chats / widest) * 100))}%"></div></div></div>`)
        : html`<p class="text-sm t-muted">Chats that edit the site will show up here.</p>`}
        <p class="mt-3 text-xs t-muted">Pick a chat to see its details here.</p>
      </div>
    </div>`;
}
