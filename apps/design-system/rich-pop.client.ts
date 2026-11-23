// The rich editor's pointer controls (a desktop with a mouse or trackpad; a phone uses the keyboard bar instead):
// a + that follows the mouse along a table's left and top edges (inserts a row or column there), a ⋯ menu on the table, and a right-click menu.
// Menus are drawn like the site's other ⋮ menus (`kebab-pop`, `kebab-item` from kebab.css).
// `popInit(el, api)` is called by rich-edit.client.ts with the few helpers it needs; everything acts through the
// editor's own actions (richBlock, richInline, richTable, richLink), so the keyboard bar and these controls do the same things.
import type { RichEl, SelectionState } from "./rich-edit.client.ts";

type Cell = HTMLTableCellElement;
type MenuItem = { heading: string } | { label: string; run: () => void; checked?: boolean; danger?: boolean };
type Hover = { node: HTMLElement; axis: string; index: number; table: HTMLTableElement };
export type PopApi = {
  selectionRange: (el: RichEl) => Range | null;
  cellOf: (node: Node | null | undefined) => Cell | null;
  describeSelection: (el: RichEl) => SelectionState;
  pasteText: (el: RichEl, text: string) => void;
  richBlock: (id: string, kind: string) => void;
  richInline: (id: string, kind: string) => void;
  richTable: (id: string, action: string, index?: number) => void;
  richLink: (id: string) => void;
};

const POINTER = "(hover: hover) and (min-width: 768px)";
const HOVER_REACH = 30;

const STYLES = [["Title", "h1"], ["Heading", "h2"], ["Subheading", "h3"], ["Body", "p"], ["Checklist", "check"], ["Bulleted List", "bullet"], ["Dashed List", "dash"], ["Numbered List", "num"], ["Block Quote", "quote"], ["Monostyled", "mono"]];
const MARKS = [["Bold", "bold", "b"], ["Italic", "italic", "i"], ["Underline", "underline", "u"], ["Strikethrough", "strike", "s"]] as const;

const ICON_PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="size-4"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_DOTS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="size-6"><circle cx="12" cy="12" r="9.5" stroke-width="1.6"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>`;

const tableBox = (cell: Element) => cell.closest("[data-k='table']")!.getBoundingClientRect();

export function popInit(el: RichEl, api: PopApi) {
  if (!matchMedia(POINTER).matches) return;
  const parent = el.parentNode as HTMLElement;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  const layer = document.createElement("div");
  layer.className = "rich-layer";
  parent.append(layer);
  let controls: HTMLElement[] = [];
  let menuBox: HTMLElement | null = null;
  let signature = "";
  let frame = 0;

  const editable = () => el.__rich?.editable && el.contains(document.activeElement);
  const haptic = (kind: RavelHaptic) => globalThis.ravel?.haptic(kind);

  function closeMenu() {
    menuBox?.remove();
    menuBox = null;
  }

  function clearControls() {
    for (const node of controls) node.remove();
    controls = [];
  }

  function add(node: HTMLElement) {
    layer.append(node);
    controls.push(node);
    return node;
  }

  /** A menu in the site's ⋮ style at (x, y) of the layer. */
  function openMenu(items: MenuItem[], x: number, y: number) {
    closeMenu();
    const box = document.createElement("div");
    box.className = "kebab-pop t-nav rich-menu";
    box.setAttribute("role", "menu");
    box.innerHTML = items.map((item, at) => "heading" in item
      ? `<div class="kebab-label">${item.heading}</div>`
      : `<button type="button" role="menuitem" data-i="${at}" class="kebab-item ${item.danger ? "danger" : ""}"><span>${item.label}</span>${item.checked ? `<span class="t-accent ml-auto">✓</span>` : ""}</button>`).join("");
    box.addEventListener("click", (event) => {
      const row = (event.target as Element).closest<HTMLElement>("[data-i]");
      const item = row && items[Number(row.dataset.i)];
      if (!item || "heading" in item) return;
      haptic("select");
      closeMenu();
      item.run();
      schedule();
    });
    layer.append(box);
    const width = box.offsetWidth;
    const left = Math.max(0, Math.min(x, layer.clientWidth - width));
    box.style.left = `${left}px`;
    box.style.top = `${y}px`;
    const over = box.getBoundingClientRect().bottom - innerHeight + 12;
    if (over > 0) box.style.top = `${y - over}px`;
    menuBox = box;
  }

  const markItems = (state: SelectionState): MenuItem[] => MARKS.map(([label, kind, flag]) => ({ label, checked: state[flag], run: () => api.richInline(el.id, kind) }));
  const styleItems = (state: SelectionState): MenuItem[] => STYLES.map(([label, kind]) => ({ label, checked: state.k === kind, run: () => api.richBlock(el.id, kind) }));
  function tableItems(): MenuItem[] {
    const picked = el.__rich?.picked;
    const rows = picked ? picked.r2 - picked.r1 + 1 : 1;
    const columns = picked ? picked.c2 - picked.c1 + 1 : 1;
    const act = (label: string, action: string, extra = {}) => ({ label, run: () => api.richTable(el.id, action), ...extra });
    return [
      { heading: "Table" }, act("Add Row", "addRow"), act("Add Column", "addColumn"), act("Select Row", "selectRow"), act("Select Column", "selectColumn"),
      ...(picked ? [act("Clear Cells", "clearCells")] : []),
      act(rows > 1 ? `Delete ${rows} Rows` : "Delete Row", "deleteRow", { danger: true }), act(columns > 1 ? `Delete ${columns} Columns` : "Delete Column", "deleteColumn", { danger: true }), act("Delete Table", "deleteTable", { danger: true }),
    ];
  }

  function button(className: string, html: string, label: string, onTap: (node: HTMLButtonElement) => void) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.innerHTML = html;
    node.setAttribute("aria-label", label);
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      onTap(node);
    });
    return node;
  }

  const place = (node: HTMLElement, left: number, top: number) => {
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    return node;
  };

  function showTableMenu(cell: Cell, base: DOMRect) {
    const box = tableBox(cell);
    const more = button("kebab-btn rich-more", ICON_DOTS, "Table options", (node) => {
      haptic("tap");
      const at = node.getBoundingClientRect();
      openMenu(tableItems(), at.right - base.left - 200, at.bottom - base.top + 4);
    });
    add(place(more, box.right - base.left - 32, box.top - base.top - 34));
  }

  // The + that follows the mouse along a table's left edge (between rows) or top edge (between columns).
  let hover: Hover | null = null;
  let hoverFrame = 0;

  function hideHover() {
    hover?.node.remove();
    hover = null;
  }

  function nearest(list: number[], at: number) {
    let best = 0;
    list.forEach((position, index) => {
      if (Math.abs(position - at) < Math.abs(list[best] - at)) best = index;
    });
    return best;
  }

  function moveHover(x: number, y: number) {
    hoverFrame = 0;
    if (!el.__rich?.editable || menuBox) return hideHover();
    const base = layer.getBoundingClientRect();
    for (const table of el.querySelectorAll<HTMLTableElement>("[data-k='table'] table")) {
      const box = table.getBoundingClientRect();
      let axis = "";
      let list: number[] = [];
      if (x >= box.left - HOVER_REACH && x <= box.left + 10 && y >= box.top - 8 && y <= box.bottom + 8) {
        axis = "row";
        list = [table.rows[0].getBoundingClientRect().top, ...[...table.rows].map((row) => row.getBoundingClientRect().bottom)];
      } else if (y >= box.top - HOVER_REACH && y <= box.top + 10 && x >= box.left - 8 && x <= box.right + 8) {
        axis = "column";
        list = [table.rows[0].cells[0].getBoundingClientRect().left, ...[...table.rows[0].cells].map((cell) => cell.getBoundingClientRect().right)];
      }
      if (!axis) continue;
      const index = nearest(list, axis === "row" ? y : x);
      if (hover?.axis === axis && hover.index === index && hover.table === table) return;
      hideHover();
      const node = button("rich-hover t-glass", ICON_PLUS, axis === "row" ? "Insert row here" : "Insert column here", () => {
        haptic("tap");
        api.richTable(el.id, axis === "row" ? "insertRow" : "insertColumn", index);
        hideHover();
      });
      node.title = axis === "row" ? "Insert row here" : "Insert column here";
      layer.append(node);
      place(node, axis === "row" ? box.left - base.left - 28 : list[index] - base.left - 12, axis === "row" ? list[index] - base.top - 12 : box.top - base.top - 28);
      hover = { node, axis, index, table };
      return;
    }
    hideHover();
  }

  document.addEventListener("mousemove", (event) => {
    if (!hoverFrame) hoverFrame = requestAnimationFrame(() => moveHover(event.clientX, event.clientY));
  });

  function refresh() {
    frame = 0;
    const picked = el.__rich?.picked;
    const range = editable() ? api.selectionRange(el) : null;
    const base = layer.getBoundingClientRect();
    const cell = editable() ? (picked ? picked.anchor : range && api.cellOf(range.startContainer)) : null;
    const box = cell && tableBox(cell);
    const next = box ? `table ${Math.round(box.top)} ${Math.round(box.height)} ${Math.round(box.right)}` : "";
    if (next === signature) return;
    signature = next;
    closeMenu();
    clearControls();
    if (cell) showTableMenu(cell, base);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(refresh);
  }

  document.addEventListener("selectionchange", schedule);
  addEventListener("resize", schedule);
  el.addEventListener("input", schedule);
  el.addEventListener("focusout", () => setTimeout(() => !el.contains(document.activeElement) && (signature = "", closeMenu(), clearControls())));
  // Buttons here must not take focus from the text, or the selection they act on would be lost.
  layer.addEventListener("pointerdown", (event) => event.preventDefault());
  document.addEventListener("pointerdown", (event) => menuBox && !menuBox.contains(event.target as Node) && closeMenu());
  el.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuBox) {
      event.stopImmediatePropagation();
      closeMenu();
    }
  }, true);

  el.addEventListener("contextmenu", (event) => {
    if (event.shiftKey || !el.__rich?.editable) return;
    event.preventDefault();
    const state = api.describeSelection(el);
    const range = api.selectionRange(el);
    const base = layer.getBoundingClientRect();
    const items: MenuItem[] = [];
    if ((range && !range.collapsed) || el.__rich.picked) items.push({ label: "Cut", run: () => document.execCommand("cut") }, { label: "Copy", run: () => document.execCommand("copy") });
    items.push({ label: "Paste", run: () => navigator.clipboard?.readText().then((text) => api.pasteText(el, text)).catch(() => {}) });
    if (api.cellOf(event.target as Node)) items.push(...tableItems());
    items.push({ heading: "Format" }, ...markItems(state), { heading: "Style" }, ...styleItems(state), { heading: "Insert" });
    items.push({ label: "Table", run: () => api.richTable(el.id, "insert") }, { label: "Link", run: () => api.richLink(el.id) });
    openMenu(items, event.clientX - base.left, event.clientY - base.top);
  });
}
