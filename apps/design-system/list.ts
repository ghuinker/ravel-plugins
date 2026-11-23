import { html, raw, type Raw } from "@ravel/html.ts";

type Part = Raw | string;
const asRaw = (part: Part) => (typeof part === "string" ? raw(part) : part);

export type ListOptions = {
  /** Inset lines between rows, and a full-width line between sections. Off by default; for rows that are different kinds of controls (a switch, a stepper, a link). */
  lined?: boolean;
  /** Where the inset line starts, e.g. "3.25rem" to clear an icon or check circle. */
  inset?: string;
  class?: string;
  attrs?: Part;
};

/**
 * One rounded group of rows: every list on the site. Rows get no lines unless `lined` is set.
 * Pass several arrays to split one card into sections; with `lined` there is a full-width line between them.
 */
export function list(rows: Part[] | Part[][], options: ListOptions = {}): Raw {
  const kind = options.lined ? "t-group-lined" : "t-group";
  const style = options.inset ? html` style="--t-inset: ${options.inset}"` : "";
  const attrs = options.attrs ? asRaw(options.attrs) : "";
  const sections = Array.isArray(rows[0]) ? (rows as Part[][]) : [rows as Part[]];
  const body = sections.length === 1
    ? sections[0].map(asRaw)
    : sections.map((part, index) => html`<div class="${index && options.lined ? "t-list-break" : ""}">${part.map(asRaw)}</div>`);
  return html`<div class="${kind} ${options.class ?? ""}"${style} ${attrs}>${body}</div>`;
}

export type SectionOptions = { count?: number; menu?: Part; class?: string; attrs?: Part };

/** A sentence-case title above a list (or anything else), with an optional count and ⋮ menu on its right. */
export function section(title: string, body: Part, options: SectionOptions = {}): Raw {
  const side = options.count === undefined && !options.menu ? "" : html`<span class="ml-auto flex items-center gap-2 text-base font-normal t-muted">${options.count ?? ""}${options.menu ? asRaw(options.menu) : ""}</span>`;
  return html`<section class="space-y-1.5 ${options.class ?? ""}" ${options.attrs ? asRaw(options.attrs) : ""}>
    <h2 class="t-title flex items-center gap-2 px-1"><span>${title}</span>${side}</h2>
    ${asRaw(body)}
  </section>`;
}

export type LinkRowOptions = {
  href: string;
  label: string;
  /** A muted line under the label. */
  note?: string;
  /** An icon (`icon(name)` from `@ravel/icons.ts`), shown in an accent square. Passed in so this file stays small in browser bundles. */
  icon?: Raw;
  /** Shown on the right, muted (a current setting, a count). */
  value?: string;
  /** The › on the right, off by default; `"phone"` shows it only below md (a rail that pushes pages on a phone). */
  chevron?: boolean | "phone";
  attrs?: Part;
};

/** A row that opens a page: Settings' sections, Archived, lists of links. Put several in `list()`. */
export function linkRow(options: LinkRowOptions): Raw {
  const chevron = !options.chevron ? "" : html`<span class="text-xl leading-none opacity-50 ${options.chevron === "phone" ? "md:hidden" : ""}">›</span>`;
  return html`<a href="${options.href}" ${options.attrs ? asRaw(options.attrs) : ""} data-on:click="ravel.haptic('tap')" class="flex items-center gap-3 px-4 py-3 t-hover">
    ${options.icon ? html`<span class="grid size-8 shrink-0 place-items-center rounded-[var(--radius-field)] t-accent-bg">${options.icon}</span>` : ""}
    <span class="flex min-w-0 flex-1 flex-col"><span class="truncate font-medium">${options.label}</span>${options.note ? html`<span class="truncate text-sm t-muted">${options.note}</span>` : ""}</span>
    ${options.value ? html`<span class="t-muted">${options.value}</span>` : ""}
    ${chevron}
  </a>`;
}
