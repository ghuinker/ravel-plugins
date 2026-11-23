import { html } from "@ravel/html.ts";
import type { Ctx } from "@ravel/types.ts";


/** The line under the Today headline: type and press Enter to start a chat. It sends to a new chat tab and opens the panel (`$chatOpen`), so the answer streams in there. `todo:` still adds tasks without the AI. */
export function askBox(ctx: Ctx) {
  const send = `evt.preventDefault(); const input = el.querySelector('input'); const text = input.value.trim(); if (text && window.ravelChat) { ravel.haptic('tap'); input.value = ''; input.blur(); $chatOpen = true; const id = ${ctx.client === "ios" ? "ravelChat.ask('')" : "ravelChat.newTab()"}; ravelChat.send(id, text); setTimeout(() => document.querySelector('#claude-panel ravel-chat')?.focus(), 50); }`;
  return html`<form class="bt-ask" data-on:submit="${send}">
    <input type="text" name="ask" autocomplete="off" enterkeyhint="send" placeholder="How can I help?" aria-label="Ask or add a task" />
    <button type="submit" class="bt-ask-go t-accent-bg" aria-label="Send">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </button>
  </form>`;
}
