import { html } from "@ravel/html.ts";
import { bar, barButton } from "@ravel/nav.ts";
import type { Ctx } from "@ravel/types.ts";

// Password text stays in these inputs and goes straight to the core: no signals, actions, database or chat.
const save = `const f = el.closest('form'); const cur = f.elements.current.value, next = f.elements.next.value; if (next !== f.elements.again.value) { $pwerror = 'The new passwords do not match.'; return } $pwbusy = true; ravel.account.changePassword(cur, next).then(() => { f.reset(); ravel.haptic('success'); $pwdone = true }).catch((e) => { ravel.haptic('warning'); $pwerror = e.message }).finally(() => { $pwbusy = false })`;

const field = (name: string, placeholder: string, autocomplete: string) =>
  html`<input type="password" name="${name}" placeholder="${placeholder}" autocomplete="${autocomplete}" required data-on:input="$pwerror = ''" class="w-full bg-transparent px-4 py-3 outline-none" />`;

/** The password sheet: current, new, repeat. Changing it logs out the other devices. */
export default (_ctx: Ctx) => html`
  <section class="space-y-4 px-1 pt-6" data-signals__ifmissing="{pwerror: '', pwbusy: false, pwdone: false}">
    ${bar({ title: "Password", nativeTitle: true, toolbar: [barButton({ label: "Close", icon: "x-mark", on: "ravel.haptic('tap'); ravel.close()" })] })}
    <form class="space-y-3" data-show="!$pwdone" data-on:submit__prevent="${save}">
      <div class="t-group">
        ${field("current", "Current password", "current-password")}
        ${field("next", "New password", "new-password")}
        ${field("again", "Repeat new password", "new-password")}
      </div>
      <p data-show="$pwerror" style="display:none" data-text="$pwerror" class="px-4 text-sm t-muted"></p>
      <p class="px-4 text-xs t-muted">Changing your password logs out every other device and keeps this one signed in.</p>
      <button data-attr:disabled="$pwbusy" class="t-pill w-full rounded-full px-5 py-3 font-bold t-accent-bg">Change password</button>
    </form>
    <div data-show="$pwdone" style="display:none" class="space-y-3">
      <p class="px-4 text-sm">Password changed. Other devices were logged out.</p>
      <button data-on:click="ravel.haptic('tap'); ravel.close()" class="t-pill w-full rounded-full px-5 py-3 font-bold t-accent-bg">Done</button>
    </div>
  </section>`;
