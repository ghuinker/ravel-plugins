import { html } from "@ravel/html.ts";
import { ref } from "@ravel/slot.ts";
import { styles } from "@ravel/client.ts";

/** The chat panel. */
export const aiPanel = ref(import.meta, "./index");

/** The round chat button in the top-right group (`topGroup()`, which takes more buttons after it). Opens the panel; its mark shows when the chat is working. */
export const chatButton = () => html`<button type="button" id="claude-fab" aria-label="Open chat" data-on:click="ravel.haptic('tap'); $chatOpen = true, setTimeout(() => document.querySelector('#claude-panel ravel-chat')?.focus(), 50)" class="ai-btn">
  <span class="fab-busy"><canvas data-ravel-loader="knot" data-key="fab" data-ignore-morph class="fab-loader"></canvas></span>
  <span class="fab-idle"><canvas data-ravel-loader="idle" data-key="fab-idle" data-ignore-morph class="fab-idle-loader"></canvas></span>
</button>`;

/** The frosted pill in the top right that holds the chat button and, beside it, whatever else belongs there (Today). */
export const topGroup = (...more: unknown[]) => html`${styles(import.meta.resolve("./group.css"))}<div class="top-group t-nav">${chatButton()}${more}</div>`;
