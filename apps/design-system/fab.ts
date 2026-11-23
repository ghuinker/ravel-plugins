import { html, raw, type Raw } from "@ravel/html.ts";

const PLUS = raw(`<svg viewBox="0 0 24 24" class="size-7" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`);

export type FabOptions = {
  label: string;
  /** Datastar expression for the tap. To raise the keyboard, call `focus({preventScroll: true})` in it directly: iOS ignores a focus from a timeout. */
  on: string;
  /** Defaults to a plus. */
  icon?: Raw;
  /** Leave out the tap haptic when `on` already plays one. */
  haptic?: boolean;
  class?: string;
  attrs?: Raw;
};

/** The round glass new-item button, bottom right on a phone. Render it outside any `t-stagger` section: a fixed element inside a transformed one is placed against the section. */
export function fab(options: FabOptions): Raw {
  return html`<button type="button" data-on:click="${options.haptic === false ? "" : "ravel.haptic('tap'); "}${options.on}" ${options.attrs ?? ""} aria-label="${options.label}"
    class="t-glass fixed right-5 z-30 flex size-14 items-center justify-center rounded-full md:hidden ${options.class ?? ""}">${options.icon ?? PLUS}</button>`;
}
