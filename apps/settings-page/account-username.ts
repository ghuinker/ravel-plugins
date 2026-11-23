import { account } from "@ravel/account.ts";
import { html } from "@ravel/html.ts";
import { bar, barButton } from "@ravel/nav.ts";
import type { Ctx } from "@ravel/types.ts";
import { USERNAME_PATTERN } from "./username.ts";

const done = (ownPage: boolean) => `ravel.haptic('tap'); ravel.close()${ownPage ? "" : "; location.reload()"}`;

// The pattern is a fixed regex; the typed name only ever reaches the core call, never an attribute value.
const save = `const n = $newusername.trim(); if (!/${USERNAME_PATTERN.source}/.test(n) || n.length > 30) { $usernameerror = 'Use lowercase letters, digits and inner dashes (30 at most).'; return } $usernamebusy = true; ravel.account.setUsername(n).then((r) => { ravel.haptic('success'); $usernamedone = r.url }).catch((e) => { ravel.haptic('warning'); $usernameerror = e.message }).finally(() => { $usernamebusy = false })`;

/** The username sheet: one field, the cost of renaming in a line, one button. */
export default async (ctx: Ctx) => {
  const { username } = await account();
  return html`
    <section class="space-y-4 px-1 pt-6" data-signals__ifmissing="{newusername: '', usernameerror: '', usernamebusy: false, usernamedone: ''}">
      ${bar({ title: "Username", nativeTitle: true, toolbar: [barButton({ label: "Close", icon: "x-mark", on: "ravel.haptic('tap'); ravel.close()" })] })}
      <form data-show="!$usernamedone" class="space-y-3" data-on:submit__prevent="${save}">
        <div class="t-group"><input data-bind:newusername data-on:input="$usernameerror = ''" value="" placeholder="${username || "new-name"}" maxlength="30" autocomplete="off" autocapitalize="none" class="w-full bg-transparent px-4 py-3 outline-none" /></div>
        <p data-show="$usernameerror" style="display:none" data-text="$usernameerror" class="px-4 text-sm t-muted"></p>
        <p class="px-4 text-xs t-muted">Every link shared under the old name stops working: shared pages, webhook URLs you gave other services and QR codes. Custom domains keep working.</p>
        <button data-attr:disabled="$usernamebusy" class="t-pill w-full rounded-full px-5 py-3 font-bold t-accent-bg">Change username</button>
      </form>
      <div data-show="$usernamedone" style="display:none" class="space-y-3">
        <p class="px-4 text-sm">Your address is now <span class="t-accent" data-text="$usernamedone"></span></p>
        <button data-on:click="${done(!!ctx.ownPage)}" class="t-pill w-full rounded-full px-5 py-3 font-bold t-accent-bg">Done</button>
      </div>
    </section>`;
};
