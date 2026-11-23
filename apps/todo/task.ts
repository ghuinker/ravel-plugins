import { argText } from "@ravel/action.ts";
import { html } from "@ravel/html.ts";
import { barButton, bar } from "@ravel/nav.ts";
import { state } from "@ravel/offline.ts";
import type { Ctx } from "@ravel/types.ts";
import { clientScript, styles } from "@ravel/client.ts";
import { ref } from "@ravel/slot.ts";
import { items } from "./index.ts";
import { editor, saveListeners } from "./view.ts";
import { richScript, richSignals } from "@app/design-system/api.ts";
import { remove, save, setTag, tickLinkedTask } from "./index.ts";
export { remove, save, setTag, tickLinkedTask } from "./index.ts";

const ID = /^[a-z][a-z0-9]*$/;

// A browser sheet sits on the list page, which already posts saves and has the script running.
export default async (ctx: Ctx) => {
  const id = argText(ctx, "id");
  // Opened from another page (Home) the sheet carries its own script and listeners, like on iOS.
  const own = ctx.ownPage || argText(ctx, "standalone") === "1";
  const open = ID.test(id) ? html`data-signals:open="'${id}'"` : html`data-signals:open__ifmissing="''"`;
  return html`
    ${own ? html`${await clientScript(import.meta.resolve("./todo.client.ts"), { id: "todo-view", "data-task": ref(import.meta, "./task") })}${await richScript()}` : ""}
    ${styles(import.meta.resolve("./todo.css"))}
    <section class="space-y-4" ${state("_todos", items())} ${open} data-signals__ifmissing="{${richSignals}, sec: '', tagsAll: false}">
      ${bar({ title: "Task", nativeTitle: true, toolbar: [barButton({ label: "Close", icon: "x-mark", on: "ravel.haptic('tap'); todoView.isBlank($_todos, $open) && ($_todos[$open].gone = true, dispatchEvent(new CustomEvent('todo-remove', {detail: {id: $open}}))); ravel.close()" })] })}
      ${editor(ctx)}
      ${own ? saveListeners(ctx) : ""}
    </section>`;
};

export const actions = { remove, save, setTag, tickLinkedTask };
