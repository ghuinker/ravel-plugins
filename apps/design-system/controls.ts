import { html, type Raw } from "@ravel/html.ts";

/** Markup, or a string shown as text. */
type Part = Raw | string;

/** The look of a text, number, date or select field. */
export const fieldInput = "t-input t-field border px-2.5 py-1.5 text-sm";

export type FieldRowOptions = {
  /** A muted line under the label. */
  note?: string;
  /** "label" (default) makes the whole row focus its control; "div" for a stepper or a pair of fields. */
  tag?: "label" | "div";
  class?: string;
};

/** A setting row: the label on the left, its control on the right. Put several in `list(rows, { lined: true })` or a `t-list`. */
export function fieldRow(label: Part, control: Part, options: FieldRowOptions = {}): Raw {
  const body = html`<span class="min-w-0"><span class="block">${label}</span>${options.note ? html`<span class="block text-xs t-muted">${options.note}</span>` : ""}</span>${control}`;
  const classes = `flex items-center justify-between gap-3 px-4 py-2.5 ${options.class ?? ""}`;
  return options.tag === "div" ? html`<div class="${classes}">${body}</div>` : html`<label class="${classes}">${body}</label>`;
}

/** A pill stepper on a number signal, for small counts (days a week, points). Dollar amounts are typed fields. */
export const stepper = (signal: string, min: number, max: number, label: string) => html`<div class="t-pill t-chip flex shrink-0 items-center rounded-full border">
  <button type="button" aria-label="Less ${label}" data-on:click="ravel.haptic('select'); $${signal} = Math.max(${min}, $${signal} - 1)" class="size-9 text-xl leading-none">−</button>
  <span class="w-8 text-center tabular-nums" data-text="$${signal}"></span>
  <button type="button" aria-label="More ${label}" data-on:click="ravel.haptic('select'); $${signal} = Math.min(${max}, $${signal} + 1)" class="size-9 text-xl leading-none">+</button>
</div>`;

export type Chip = {
  label: Part;
  /** Whether it's picked: a boolean from the server, or a Datastar expression. */
  on: boolean | string;
  /** The Datastar statement a tap runs (a haptic is added). */
  click: string;
};

/** Pick-one chips that set a value. Tabs that switch a page's content are `segmented()`. */
export function chips(items: Chip[], label: string, options: { class?: string } = {}): Raw {
  const chip = (item: Chip) => {
    const pressed = typeof item.on === "string" ? html`aria-pressed="false" data-attr:aria-pressed="${item.on}"` : html`aria-pressed="${item.on}"`;
    return html`<button type="button" ${pressed} data-on:click="ravel.haptic('select'); ${item.click}" class="t-pill rounded-full px-3 py-1 text-sm font-medium">${item.label}</button>`;
  };
  return html`<div class="t-chips flex flex-wrap gap-1.5 ${options.class ?? ""}" role="group" aria-label="${label}">${items.map(chip)}</div>`;
}

export type Disclosure = {
  /** Datastar expression that's true while it's open. */
  open: string;
  /** Datastar statement that opens or closes it. */
  toggle: string;
};

/** One open at a time: `signal` holds the open row's `id` ('' when none). Set it up with `data-signals__ifmissing="{name: ''}"`. */
export const oneOpen = (signal: string, id: string): Disclosure => ({
  open: `$${signal} === '${id}'`,
  toggle: `$${signal} = $${signal} === '${id}' ? '' : '${id}'`,
});

export type DisclosureOptions = Disclosure & {
  title: Part;
  /** An emoji or icon, shown in a rounded square. */
  icon?: Part;
  /** A muted line under the title: the numbers that matter, so it reads closed. */
  note?: Part;
  /** A Datastar expression shown muted on the right (the current value). */
  value?: string;
  /** The › that turns when the row is open. Off by default: the row reads as tappable from its hover and haptic. */
  chevron?: boolean;
  class?: string;
};

/** The header row of a disclosure: icon, title, note or value, and, when `chevron` is set, a › that turns when open. Use with `disclosureBody()` when a row wraps it (`swipeRow`). */
export function disclosureHead(options: DisclosureOptions): Raw {
  return html`<button type="button" aria-expanded="false" data-attr:aria-expanded="${options.open}" data-on:click="ravel.haptic('select'); ${options.toggle}" class="flex w-full items-center gap-3 px-4 py-3 text-left ${options.class ?? ""}">
    ${options.icon && typeof options.icon !== "string" ? html`<span class="grid size-8 shrink-0 place-items-center rounded-[var(--radius-field)] t-chip" aria-hidden="true">${typeof options.icon === "string" ? "" : options.icon}</span>` : ""}
    <span class="flex min-w-0 flex-1 flex-col"><span class="font-medium">${options.title}</span>${options.note ? html`<span class="text-xs t-muted">${options.note}</span>` : ""}</span>
    ${options.value ? html`<span class="min-w-0 truncate text-sm t-muted" data-text="${options.value}"></span>` : ""}
    ${options.chevron ? html`<span class="t-chev t-muted" aria-hidden="true" data-class="{'is-open': ${options.open}}">›</span>` : ""}
  </button>`;
}

/** What a disclosure slides open. */
export const disclosureBody = (open: string, body: Part): Raw => html`<div class="t-expand" data-class="{'is-open': ${open}}"><div>${body}</div></div>`;

/** A row that slides open to more rows or controls: grouped settings (Finances' numbers, a goal's area and date, a habit). Put several in `list(rows, { lined: true, inset: "3.75rem" })`. */
export const disclosure = (options: DisclosureOptions & { body: Part }): Raw => html`<div>${disclosureHead(options)}${disclosureBody(options.open, options.body)}</div>`;
