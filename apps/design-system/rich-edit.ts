import { clientScript } from "@ravel/client.ts";
import { html, raw } from "@ravel/html.ts";
import { barButton, barMenu, hideKeyboard, keyboardBar } from "@ravel/nav.ts";

/** The editor's browser script, once per page that has a `richField`. It puts the editor on `globalThis.ravelRich`. */
export const richScript = () => clientScript(import.meta.resolve("./rich.client.ts"));

/** Page signals the editor and its bar share: the style of the line at the caret, the inline marks, whether it is in a table, and whether the editor has focus. */
export const richSignals = "rk: 'p', rb: false, ri: false, ru: false, rs: false, rt: false, rf: false, rm: ''";
const STATE = "$rk = evt.detail.k; $rb = evt.detail.b; $ri = evt.detail.i; $ru = evt.detail.u; $rs = evt.detail.s; $rt = evt.detail.t";

type Field = {
  id: string;
  placeholder: string;
  /** Datastar attributes that load the text (`richLoad(el, ...)`) and take its changes (`rich-change`, whose `evt.detail.md` is the markdown). */
  attrs: string;
  /** Runs when focus leaves the editor (save). */
  onBlur?: string;
  classes?: string;
};

/** The editable area for markdown text. `ravelRich.richLoad` (from `richScript()`) fills it. */
export const richField = ({ id, placeholder, attrs, onBlur = "", classes = "" }: Field) => html`
  <div id="${id}" class="rich ${classes}" data-rich data-ph="${placeholder}" role="textbox" aria-multiline="true"
    data-on:rich-state="${STATE}" data-on:focusin="$rf = true" data-on:focusout="$rf = false; ${onBlur}" ${raw(attrs)}></div>`;

/**
 * Formatting for the editor with this id. It is a
 * `keyboardBar`: in the app the buttons replace the system bar above the keyboard; in a browser it is a glass pill
 * that sticks above the keyboard (or the screen's bottom) while the editor has focus.
 */
export const richBar = (id: string) => {
  const run = (call: string) => `ravel.haptic('select'); ravelRich.${call}`;
  const mark = (label: string, kind: string, on: string) => ({ label, on: run(`richInline('${id}', '${kind}')`), checked: on });
  const style = (label: string, kind: string) => ({ label, on: run(`richBlock('${id}', '${kind}')`), checked: `$rk === '${kind}'` });
  const cell = (label: string, action: string, extra = {}) => ({ label, on: run(`richTable('${id}', '${action}')`), ...extra });
  return html`
    <div class="rich-bar t-glass" data-class="{'rich-bar-off': !$rf}" data-on:pointerdown="evt.preventDefault()" role="toolbar" aria-label="Formatting">
      ${keyboardBar({ for: `#${id}`, leading: [hideKeyboard()] },
        barMenu({ label: "Format", icon: "h1" },
          mark("Bold", "bold", "$rb"), mark("Italic", "italic", "$ri"), mark("Underline", "underline", "$ru"), mark("Strikethrough", "strike", "$rs"),
          style("Title", "h1"), style("Heading", "h2"), style("Subheading", "h3"), style("Body", "p"), style("Monostyled", "mono"),
          style("Bulleted List", "bullet"), style("Dashed List", "dash"), style("Numbered List", "num"), style("Block Quote", "quote")),
        barButton({ label: "Bold", icon: "bold", on: run(`richInline('${id}', 'bold')`), checked: "$rb" }),
        barButton({ label: "Italic", icon: "italic", on: run(`richInline('${id}', 'italic')`), checked: "$ri" }),
        barButton({ label: "Checklist", icon: "check-circle", on: run(`richBlock('${id}', 'check')`), checked: "$rk === 'check'" }),
        barButton({ label: "Bulleted list", icon: "list-bullet", on: run(`richBlock('${id}', 'bullet')`), checked: "$rk === 'bullet'" }),
        barButton({ label: "Table", icon: "table-cells", on: run(`richTable('${id}', 'insert')`), show: "!$rt" }),
        barMenu({ label: "Table", icon: "table-cells", show: "$rt" },
          cell("Add Row", "addRow"), cell("Add Column", "addColumn"), cell("Delete Row", "deleteRow"), cell("Delete Column", "deleteColumn"), cell("Delete Table", "deleteTable", { destructive: true })),
        barButton({ label: "Picture", icon: "photo", on: run(`richImage('${id}')`) }),
        barButton({ label: "Link", icon: "link", on: run(`richLink('${id}')`) }),
      )}
    </div>`;
};

const svg = (body: string) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">${raw(body)}</svg>`;
const ICONS = {
  check: '<circle cx="5.5" cy="7" r="2.8"/><path d="M4.3 7l.9.9 1.6-1.8"/><circle cx="5.5" cy="17" r="2.8"/><path d="M11.5 7h9M11.5 17h9"/>',
  table: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 10h18M3 14.8h18M9 4.5v15"/>',
  photo: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};

/**
 * The format pill for a mouse, meant for the left of a card's header row (next to the tag, pin and trash buttons):
 * Aa opens the text styles in the site's ⋮ menu style, then checklist, table and link. A phone uses `richBar`.
 */
export const richToolbar = (id: string, show = "true") => {
  const run = (call: string) => `ravel.haptic('select'); ravelRich.${call}; $rm = ''`;
  const round = "flex size-9 shrink-0 items-center justify-center rounded-full t-hover t-muted";
  const item = (label: string, call: string, on: string) =>
    html`<button type="button" role="menuitem" class="kebab-item" data-on:click="${run(call)}"><span>${label}</span><span class="t-accent ml-auto" data-show="${on}" style="display: none">✓</span></button>`;
  const mark = (label: string, kind: string, on: string) => item(label, `richInline('${id}', '${kind}')`, on);
  const style = (label: string, kind: string) => item(label, `richBlock('${id}', '${kind}')`, `$rk === '${kind}'`);
  return html`
    <div class="rich-toolbar t-pill t-chip items-center gap-0.5 rounded-full border p-0.5" data-show="${show}" data-on:pointerdown="evt.preventDefault()" data-on:click__outside="$rm = ''" role="toolbar" aria-label="Formatting">
      <div class="kebab">
        <button type="button" aria-label="Text style" title="Text style" data-on:click="ravel.haptic('tap'); $rm = $rm === 'fmt' ? '' : 'fmt'" data-class="{'t-active': $rm === 'fmt'}" class="${round} text-sm font-semibold">Aa</button>
        <div class="kebab-pop t-nav" role="menu" data-show="$rm === 'fmt'" style="display: none">
          <div class="kebab-label">Format</div>
          ${mark("Bold", "bold", "$rb")}${mark("Italic", "italic", "$ri")}${mark("Underline", "underline", "$ru")}${mark("Strikethrough", "strike", "$rs")}
          <div class="kebab-label">Style</div>
          ${style("Title", "h1")}${style("Heading", "h2")}${style("Subheading", "h3")}${style("Body", "p")}${style("Monostyled", "mono")}
          ${style("Bulleted List", "bullet")}${style("Dashed List", "dash")}${style("Numbered List", "num")}${style("Block Quote", "quote")}
        </div>
      </div>
      <button type="button" aria-label="Checklist" title="Checklist" data-on:click="${run(`richBlock('${id}', 'check')`)}" data-class="{'t-active': $rk === 'check'}" class="${round}">${svg(ICONS.check)}</button>
      <button type="button" aria-label="Table" title="Insert table" data-on:click="${run(`richTable('${id}', 'insert')`)}" data-class="{'t-active': $rt}" class="${round}">${svg(ICONS.table)}</button>
      <button type="button" aria-label="Picture" title="Add picture" data-on:click="${run(`richImage('${id}')`)}" class="${round}">${svg(ICONS.photo)}</button>
      <button type="button" aria-label="Link" title="Link" data-on:click="${run(`richLink('${id}')`)}" class="${round}">${svg(ICONS.link)}</button>
    </div>`;
};
