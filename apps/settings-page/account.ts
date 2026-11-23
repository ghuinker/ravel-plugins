import { ref } from "@ravel/slot.ts";
import { account } from "@ravel/account.ts";
import { auth } from "@ravel/claude.ts";
import { html } from "@ravel/html.ts";
import { openSheet } from "@ravel/nav.ts";
import type { Ctx } from "@ravel/types.ts";
import zoneBlock from "./zone.ts";

const rowClass = "flex w-full items-center justify-between gap-3 px-4 py-3 text-left t-hover";
const chevron = html`<span class="text-xl leading-none opacity-50">›</span>`;

const hero = (username: string, url: string) => html`
  <div class="t-group flex items-center gap-4 p-5">
    <div class="t-pill grid size-16 shrink-0 place-items-center rounded-full text-3xl font-bold t-accent-grad">${(username || "?").slice(0, 1).toUpperCase()}</div>
    <div class="min-w-0">
      <div class="truncate text-2xl font-bold">${username || "No username yet"}</div>
      ${url ? html`<a href="${url}" class="truncate text-sm t-accent" target="_blank" rel="noopener">${url.replace(/^https?:\/\/[^.]+\./, `${username}@`)}</a>` : html`<div class="text-sm t-muted">Pick one to get a public address.</div>`}
    </div>
  </div>`;

/** The core ends the other sessions; the count is shown in place so the page behind stays put. */
const logoutOthers = `ravel.haptic('warning'); $othersbusy = true; ravel.account.logoutAll().then((r) => { $othersdone = r.ended === 0 ? 'No other devices were logged in.' : 'Logged out ' + r.ended + (r.ended === 1 ? ' other device.' : ' other devices.') }).catch((e) => { $othersdone = e.message }).finally(() => { $othersbusy = false })`;

const claudeStatus = async () => {
  try {
    const { loggedIn, email, subscriptionType } = await auth();
    return { loggedIn, email: email ?? "", plan: subscriptionType ?? "" };
  } catch {
    return { loggedIn: false, email: "", plan: "" };
  }
};

/** Step 1 gets the sign-in link; step 2 sends the code it shows. The code stays in the page's own script. */
const claudeStart = `ravel.haptic('tap'); $cbusy = true; $cerr = ''; ravel.claude.login().then((r) => { $curl = r.url; $cstep = 1 }).catch((e) => { $cerr = e.message }).finally(() => { $cbusy = false })`;
const claudeSend = `const el = document.getElementById('claude-code'); ravel.haptic('tap'); $cbusy = true; $cerr = ''; ravel.claude.submitCode(el.value.trim()).then((r) => { el.value = ''; ravel.haptic('success'); $cstep = 0; $cok = r.loggedIn ? 'Logged in' + (r.email ? ' as ' + r.email : '') + '.' : 'Not logged in.' }).catch((e) => { ravel.haptic('warning'); $cerr = e.message }).finally(() => { $cbusy = false })`;

export default async (ctx: Ctx) => {
  const [{ email, username, url }, claude] = await Promise.all([account(), claudeStatus()]);
  return html`
    <div class="space-y-5" data-signals="{othersbusy: false, othersdone: '', cstep: 0, curl: '', cerr: '', cok: '', cbusy: false}">
      ${hero(username, url)}
      <div class="t-group">
        <div class="${rowClass}"><span>Email</span><span class="min-w-0 truncate t-muted">${email}</span></div>
        <button class="${rowClass}" data-on:click="ravel.haptic('tap'); ${openSheet(ref(import.meta, "./account-username"), {}, "large")}"><span>Username</span><span class="flex min-w-0 items-center gap-2"><span class="truncate t-muted">${username || "Not set"}</span>${chevron}</span></button>
        <button class="${rowClass}" data-on:click="ravel.haptic('tap'); ${openSheet(ref(import.meta, "./account-password"), {}, "large")}"><span>Password</span>${chevron}</button>
      </div>
      ${zoneBlock(ctx)}
      <div class="space-y-1.5">
        <div class="t-group" ${claude.loggedIn ? "" : html`data-init="${claudeStart}"`}>
          <div class="${rowClass}"><span>Claude</span><span class="min-w-0 truncate ${claude.loggedIn ? "t-muted" : "t-accent"}">${claude.loggedIn ? [claude.email, claude.plan].filter(Boolean).join(" · ") || "Logged in" : "Not logged in"}</span></div>
          <button data-show="$cstep === 0" data-on:click="${claudeStart}" data-attr:disabled="$cbusy" class="w-full px-4 py-3 text-center font-medium t-accent t-hover">${claude.loggedIn ? "Log in to Claude again" : "Log in to Claude"}</button>
          <div data-show="$cstep === 1" style="display:none" class="space-y-3 px-4 py-3">
            <p class="text-sm t-muted">Sign in on the page that opens, then paste the code it shows.</p>
            <a data-attr:href="$curl" target="_blank" rel="noopener" class="block text-sm font-medium t-accent">Open Claude sign-in</a>
            <input id="claude-code" autocomplete="off" placeholder="Code" class="t-field w-full px-3 py-2" />
            <button data-on:click="${claudeSend}" data-attr:disabled="$cbusy" class="t-pill px-4 py-2 font-medium t-accent-bg">Submit code</button>
          </div>
        </div>
        <p data-show="$cerr" style="display:none" data-text="$cerr" class="px-4 text-xs t-accent"></p>
        <p data-show="$cok" style="display:none" data-text="$cok" class="px-4 text-xs t-muted"></p>
      </div>
      <div class="space-y-1.5">
        <div class="t-group">
          <form method="POST" action="/_logout"><button data-on:click="ravel.haptic('warning')" class="w-full px-4 py-3 text-center font-medium t-accent t-hover">Log out of this device</button></form>
          <button data-on:click="${logoutOthers}" data-attr:disabled="$othersbusy" class="w-full px-4 py-3 text-center font-medium t-accent t-hover">Log out of other devices</button>
        </div>
        <p data-show="$othersdone" style="display:none" data-text="$othersdone" class="px-4 text-xs t-muted"></p>
      </div>
    </div>`;
};
