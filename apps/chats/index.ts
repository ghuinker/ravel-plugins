import { argNumber, argText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";
import { live } from "@ravel/job.ts";
import { clientScript, styles } from "@ravel/client.ts";
import { listTags, maxTags, tagsOf, toggleTag } from "@app/tags/api.ts";
import { isChatId, setHidden, setPinned } from "./db.ts";
import { appsAside, hero } from "./hero.ts";
import { filterGroup, sections, toolbar } from "./list.ts";
import { preview } from "./preview.ts";
import { chatRows } from "./stats.ts";
import { userZone } from "@app/settings/api.ts";

const SIGNALS = "{cq: '', cf: 'all', fmenu: false, sel: '', tagrow: ''}";

const chatId = (ctx: Ctx) => {
  const id = argText(ctx, "id");
  return isChatId(id) ? id : null;
};

export function pin(ctx: Ctx) {
  const id = chatId(ctx);
  if (id) setPinned(id, ctx.query.get("on") === "1");
}

export function hide(ctx: Ctx) {
  const id = chatId(ctx);
  if (id) setHidden(id, ctx.query.get("on") === "1");
}

// Adds a tag to a chat, or takes one off (`on` 0; tag 0 takes them all off).
export function setTag(ctx: Ctx) {
  const id = chatId(ctx);
  if (id) toggleTag("chat", id, argNumber(ctx, "tag"), ctx.query.get("on") !== "0");
}

export function refresh(_ctx: Ctx) {}

export default async (ctx: Ctx) => {
  const zone = userZone();
  const rows = chatRows();
  const visible = rows.filter((row) => !row.hidden && !row.system);
  const tags = listTags();
  const tagIds = new Map(rows.map((row) => [row.id, tagsOf("chat", row.id).map((tag) => tag.id)]));
  return html`
    ${styles(import.meta.resolve("./chats.css"))}${await clientScript(import.meta.resolve("./chats.client.ts"))}
    <section class="cv-page space-y-5" data-signals="${SIGNALS}" ${live(ctx)}>
      ${hero(visible, zone, ctx.name)}
      <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_21rem] md:items-start">
        <div class="min-w-0 space-y-5">
          ${toolbar(filterGroup(rows, tags, tagIds))}
          <div class="space-y-5">${sections(ctx.name, rows, tags, zone)}</div>
          <p class="px-1 py-6 text-center t-muted" data-show="convView.none($cq, $cf)" style="display:none">${rows.length ? "No chats match." : "No chats yet. Use the box at the bottom to start one."}</p>
        </div>
        <aside class="hidden space-y-5 md:sticky md:top-4 md:block">
          ${appsAside(visible)}
          ${rows.map((row, index) => preview(ctx.name, row, tags, zone, index))}
        </aside>
      </div>
    </section>`;
};

export const actions = { hide, pin, refresh, setTag };
