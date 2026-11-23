import { html, raw } from "@ravel/html.ts";
import { clientCode, clientVersion, styles } from "@ravel/client.ts";
import { action } from "@ravel/action.ts";
import type { Ctx } from "@ravel/types.ts";
import { plugsFor } from "../../lib/plugs.ts";
import { readUsageLimits } from "./usage-warning.ts";

const UI_FILES = ["loader.client.ts", "keyboard.client.ts", "usage-warning.client.ts", "uh-oh.client.ts", "expand.client.ts", "place.client.ts"];

const here = (path: string) => new URL(path, import.meta.url);
const mtime = (file: URL) => Deno.statSync(file).mtime?.getTime() ?? 0;
const isFile = (file: URL) => {
  try {
    return Deno.statSync(file).isFile;
  } catch {
    return false;
  }
};

/** The browser script each app lists as `ai` in its `plugs`, run after the panel's own scripts (see apps/README.md). */
export async function pluginFiles(): Promise<URL[]> {
  const plugs = await plugsFor<string>("ai");
  return plugs.map(({ app, value }) => here(`../${app}/${/\.[jt]s$/.test(value) ? value.slice(2) : `${value.slice(2)}.ts`}`)).filter(isFile);
}

export async function checkUsage(ctx: Ctx) {
  const limits = await readUsageLimits();
  if (JSON.stringify(limits) !== JSON.stringify(ctx.signals.usageLimits ?? [])) ctx.signals.usageHidden = false;
  ctx.signals.usageLimits = limits;
  ctx.signals.usageCheckedAt = Date.now();
}

// Each script gets the shared chat client and a signal that aborts when the scripts run again.
const runScripts = [
  "Promise.resolve({ chat: window.ravelChat }).then((m) => {",
  "window.senAiRun?.abort(); const run = window.senAiRun = new AbortController();",
  "document.querySelectorAll('script.ai-js').forEach((s) => { try { new Function('chat', 'signal', s.textContent)(m.chat, run.signal) } catch (err) { console.error(s.dataset.file, err) } })",
  "})",
].join(" ");

const icon = (path: string) =>
  raw(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5">${path}</svg>`);

const focusChat = "setTimeout(() => document.querySelector('#claude-panel ravel-chat')?.focus(), 50)";

export default async (ctx: Ctx) => {
  if (!ctx.owner) return "";
  const scripts = [...UI_FILES.map((file) => here(`./${file}`)), ...await pluginFiles()];
  const version = Math.max(mtime(here(import.meta.url)), mtime(here("./style.css")), ...scripts.map(clientVersion));
  const bodies = await Promise.all(scripts.map(clientCode));
  return html`
  <style>#claude-wrap:not(:has(#claude-panel.open)){pointer-events:none}#claude-panel:not(.open){visibility:hidden;opacity:0}</style>
  ${styles(here("./style.css"))}
  <div id="claude-wrap" data-on:pointerdown__window="el.pressedOutside = !el.contains(evt.target) && !evt.target.closest?.('#claude-fab')" data-on:click__window="el.pressedOutside && !el.contains(evt.target) && ($chatOpen = false)" class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0">
    <button type="button" id="claude-close" aria-label="Close chat" data-on:click="document.activeElement?.blur(); $chatOpen = false" class="t-card t-ink border shadow-lg">${icon('<path d="M18 6 6 18M6 6l12 12" />')}</button>
    <div id="claude-panel" data-signals__ifmissing="{chatOpen: false, usageLimits: [], usageHidden: false, usageCheckedAt: 0}" data-class:open="$chatOpen" class="border t-card t-ink shadow-lg"
      data-on:focusin="$chatOpen = true"
      data-on:keydown="evt.key === 'Escape' && (document.activeElement?.blur(), $chatOpen = false)"
      data-on:ravel-chat__window="evt.detail.type === 'ask' && ($chatOpen = true, ${focusChat})">
      <div id="claude-content">
        <div id="claude-offline" class="t-muted">
          <div class="offline-orb t-accent">
            <span class="offline-ring"></span><span class="offline-ring"></span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-9"><path d="M2 8.8a15 15 0 0 1 4-2.6M22 8.8a15 15 0 0 0-9.3-4.7M5 12.9a10 10 0 0 1 5-2.7M19 12.9a10 10 0 0 0-2.4-1.9M8.5 16.4a5 5 0 0 1 3.5-1.4M15.5 16.4a5 5 0 0 0-1-.9"/><circle cx="12" cy="20" r="1" fill="currentColor"/><path d="m3 3 18 18"/></svg>
          </div>
          <div class="offline-title t-accent">You're offline</div>
          <div class="text-sm">The chat is taking a nap<span class="offline-dots"></span><br>Messages you send now go out when your connection is back.</div>
        </div>
        <ravel-chat></ravel-chat>
        <div data-show="$usageLimits.length && !$usageHidden" style="display: none" class="mx-2 mb-2 flex items-center justify-between gap-2 rounded-lg border t-chip px-3 py-1.5 text-sm">
          <span><span data-text="$usageLimits && (window.senUsageText?.($usageLimits) ?? '')"></span></span>
          <button type="button" aria-label="Dismiss" data-on:click="$usageHidden = true" class="t-muted">✕</button>
        </div>
        <button hidden type="button" id="ai-usage-check" data-on:click="window.senUsageDue?.() ? ${action(ctx, "checkUsage")} : ($usageHidden = $usageHidden && JSON.stringify(window.senUsageSaved()) === JSON.stringify($usageLimits), $usageLimits = window.senUsageSaved())"></button>
        <div hidden data-effect="$usageCheckedAt && window.senUsageSeen?.($usageLimits)"></div>
      </div>
    </div>
  </div>
  <div hidden id="ai-run" data-init="${runScripts}, ${version}"></div>
  ${scripts.map((file, i) => html`<script type="text/plain" class="ai-js" data-file="${file.pathname.split("/").slice(-2).join("/")}">${raw(bodies[i])}</script>`)}
`;
};

export const actions = { checkUsage };
