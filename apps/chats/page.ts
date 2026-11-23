import { bar } from "@ravel/nav.ts";
import { html } from "@ravel/html.ts";
import { ref, slot } from "@ravel/slot.ts";
import { cardSkeleton } from "@app/design-system/api.ts";

/** A plain wide page with a back link to Home; the list itself is `index.ts`. */
export default () => html`
  <section class="settings-page px-1 pt-6 md:px-0">
    <div class="t-stagger space-y-5">
      <header class="space-y-1">
        ${bar({ title: "Chats", nativeTitle: true })}
        <p class="t-muted">Your past chats: search, tag, pin and pick one to continue.</p>
      </header>
      <div class="min-w-0 space-y-6">${slot(ref(import.meta, "./index"), {}, { skeleton: cardSkeleton })}</div>
    </div>
  </section>`;
