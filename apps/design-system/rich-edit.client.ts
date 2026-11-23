// The rich editor (browser): a contenteditable with one <div data-k="..."> per line, shown formatted like iOS Notes.
// Markdown is only the stored form: `richLoad` turns it into blocks and every edit turns the blocks back into
// markdown and fires `rich-change` ({md, toggled}). Undo and redo are the editor's own (snapshots of the markdown),
// because the browser can't undo changes made to the blocks by script.
import { type Block, blocksHtml, docToMarkdown, isWrapped, LIST_KINDS, MAX_DEPTH, numberBlocks, parseDoc } from "./rich-model.ts";
import { cellsFormat, cellsInit, cellsPaste, pickedCells } from "./rich-cells.client.ts";
import { popInit } from "./rich-pop.client.ts";

type Cell = HTMLTableCellElement;
/** A block of picked table cells (rows r1..r2, columns c1..c2); `anchor` is where the pick started. */
export type Picked = { table: HTMLTableElement; r1: number; r2: number; c1: number; c2: number; anchor: Cell };
type Caret = { at: number; offset: number } | null;
type Snapshot = { md: string; caret: Caret };
type RichState = { md: string; editable: boolean; key: string; undo: Snapshot[]; redo: Snapshot[]; pushedAt: number; caret: Caret; sig: string; picked: Picked | null };
/** The editor element; its state lives on it so a re-render that keeps the element keeps the history. */
export type RichEl = HTMLElement & { __rich?: RichState };
/** What the toolbar shows for the caret: the block kind and the inline marks, and whether it is in a table. */
export type SelectionState = { k: string; b: boolean; i: boolean; u: boolean; s: boolean; t: boolean };
export type Commit = (el: RichEl, boundary?: boolean, toggled?: { done: boolean } | null) => void;
type Formats = { bold: boolean; italic: boolean; under: boolean; strike: boolean };
type Page = typeof globalThis & { __richSelection?: boolean; __richKeyboard?: boolean };

const HEADINGS = ["h1", "h2", "h3"];
const INLINE_TAGS = ["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "A", "CODE", "BR"];
const SNAPSHOT_GAP_MS = 800;
const HISTORY_MAX = 200;
const CHECK_HIT_REM = 2;
const SHORTCUTS: Record<string, string> = { "-": "bullet", "*": "bullet", "+": "dash", ">": "quote", "[]": "check", "[ ]": "check", "1.": "num" };
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const TYPED_LINK = /(https?:\/\/[^\s<>]+?)([.,;:!?)]*)(\s)$/;

const page = globalThis as Page;
const stateOf = (el: RichEl) => el.__rich!;
const blocksOf = (el: Element) => [...el.children] as HTMLElement[];
const kindOf = (block: HTMLElement) => block.dataset.k ?? "p";
const depthOf = (block: HTMLElement) => Number(block.dataset.d ?? 0);
const plainText = (node: Node) => (node.textContent ?? "").replace(/\u00a0/g, " ");
const selection = () => getSelection()!;
const editorById = (id: string) => document.getElementById(id) as RichEl | null;

function blockOf(el: Element, node: Node | null | undefined): HTMLElement | null {
  let at = node?.nodeType === 3 ? node.parentNode : node;
  while (at && at.parentNode !== el) at = at.parentNode;
  return (at as HTMLElement | null | undefined) ?? null;
}

function selectionRange(el: Element) {
  const selection = getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return el.contains(range.startContainer) ? range : null;
}

/** Focuses the editor unless focus is already inside it (a table cell is its own editing host, and focusing the editor would drop the caret). */
function focusEditor(el: HTMLElement) {
  if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
}

function placeCaret(node: Node, atEnd = false) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(!atEnd);
  selection().removeAllRanges();
  selection().addRange(range);
}

// ---- reading the blocks back as markdown

function wrapMarks(inner: string, mark: string) {
  const [, before, body, after] = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return body ? `${before}${mark}${body}${mark}${after}` : inner;
}

function escapeText(text: string, inCell: boolean) {
  const plain = text.replace(/\u00a0/g, " ").replace(/\\/g, "\\\\").replace(/([*`~[<])/g, "\\$1");
  const marked = plain.replace(/_/g, (mark, at) => (/\w/.test(plain[at - 1] ?? "") && /\w/.test(plain[at + 1] ?? "") ? mark : "\\_"));
  return inCell ? marked.replace(/\|/g, "\\|") : marked;
}

function formatsOf(node: Element): Formats {
  const tag = node.tagName;
  const style = (node as HTMLElement).style ?? {};
  return {
    bold: tag === "B" || tag === "STRONG" || /^(bold|[6-9]00)$/.test(style.fontWeight),
    italic: tag === "I" || tag === "EM" || style.fontStyle === "italic",
    under: tag === "U" || /underline/.test(style.textDecorationLine || style.textDecoration || ""),
    strike: ["S", "STRIKE", "DEL"].includes(tag) || /line-through/.test(style.textDecorationLine || style.textDecoration || ""),
  };
}

/** The markdown of an element's inline content (bold, italic, underline, strike, code, links). */
function inlineMarkdown(parent: Node, inCell = false): string {
  let out = "";
  for (const node of parent.childNodes) {
    if (node.nodeType === 3) {
      out += escapeText(node.nodeValue ?? "", inCell);
    } else if (node instanceof Element && node.tagName !== "BR") {
      if (node.tagName === "CODE") {
        const code = plainText(node);
        out += code && !code.includes("`") ? `\`${code}\`` : escapeText(code, inCell);
        continue;
      }
      let inner = inlineMarkdown(node, inCell);
      const { bold, italic, under, strike } = formatsOf(node);
      if (node.tagName === "A") {
        const href = node.getAttribute("href") ?? "";
        if (SAFE_LINK.test(href) && inner.trim()) inner = `[${inner}](${href.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
      }
      if (strike) inner = wrapMarks(inner, "~~");
      if (under && inner.trim()) inner = inner.replace(/^(\s*)([\s\S]*?)(\s*)$/, "$1<u>$2</u>$3");
      if (italic) inner = wrapMarks(inner, "_");
      if (bold) inner = wrapMarks(inner, "**");
      out += inner;
    }
  }
  return out.replace(/\*\*\*\*/g, "").replace(/~~~~/g, "").replace(/<\/u><u>/g, "");
}

function readBlocks(el: Element) {
  return blocksOf(el).map((block): Block => {
    const k = kindOf(block);
    if (k === "hr") return { k };
    if (k === "img") return { k, text: block.dataset.src ?? "" };
    if (k === "table") return { k, rows: [...block.querySelectorAll("tr")].map((row) => [...row.cells].map((cell) => inlineMarkdown(cell, true).trim())) };
    if (k === "mono") return { k, text: plainText(block).replace(/\n/g, " ") };
    const list = LIST_KINDS.includes(k);
    return { k, d: list ? depthOf(block) : 0, done: k === "check" && block.hasAttribute("data-done"), text: inlineMarkdown(block).trim() };
  });
}

// ---- keeping the DOM tidy

function unwrap(node: Element) {
  node.replaceWith(...node.childNodes);
}

/** Turns what a browser or spell-checker leaves behind (spans with styles, stray text) into plain blocks and inline tags. */
function tidyInline(root: Element) {
  for (const node of [...root.querySelectorAll("*")]) {
    if (!INLINE_TAGS.includes(node.tagName)) {
      const { bold, italic, under, strike } = formatsOf(node);
      const marks = ([[bold, "b"], [italic, "i"], [under, "u"], [strike, "s"]] as const).filter(([on]) => on);
      for (const [, tag] of marks) {
        const wrapper = document.createElement(tag);
        wrapper.append(...node.childNodes);
        node.append(wrapper);
      }
      unwrap(node);
    } else if (node.hasAttribute("style")) node.removeAttribute("style");
  }
}

function tidyCells(table: Element) {
  for (const cell of table.querySelectorAll("td")) {
    for (const nested of [...cell.querySelectorAll("div, p")]) unwrap(nested);
    tidyInline(cell);
    if (!cell.textContent && !cell.querySelector("br")) cell.innerHTML = "<br>";
  }
}

function tidy(el: HTMLElement) {
  let run: HTMLElement | null = null;
  for (const node of [...el.childNodes]) {
    const isBlock = node instanceof HTMLElement && node.tagName === "DIV";
    const isInline = node.nodeType === 3 || (node instanceof Element && INLINE_TAGS.includes(node.tagName));
    if (isBlock) {
      run = null;
      if (!node.dataset.k) node.dataset.k = "p";
    } else if (isInline) {
      if (!run) {
        run = document.createElement("div");
        run.dataset.k = "p";
        node.before(run);
      }
      run.append(node);
    } else {
      run = null;
      const stray = document.createElement("div");
      stray.dataset.k = "p";
      stray.textContent = node.textContent ?? "";
      (node as ChildNode).replaceWith(stray);
    }
  }
  for (const block of blocksOf(el)) {
    for (const nested of [...block.querySelectorAll(":scope > div")]) unwrap(nested);
    const k = kindOf(block);
    if (k === "table") tidyCells(block);
    if (isWrapped(k)) continue;
    if (!LIST_KINDS.includes(k)) block.removeAttribute("data-d");
    if (k !== "check") block.removeAttribute("data-done");
    if (k === "mono") {
      if (block.querySelector("*:not(br)")) block.textContent = plainText(block);
    } else tidyInline(block);
    if (!block.textContent && !block.querySelector("br")) block.innerHTML = "<br>";
  }
  const last = el.lastElementChild as HTMLElement | null;
  if (!last || isWrapped(kindOf(last))) el.insertAdjacentHTML("beforeend", `<div data-k="p"><br></div>`);
  renumber(el);
}

function renumber(el: Element) {
  const blocks = blocksOf(el);
  const numbers = numberBlocks(blocks.map((block) => ({ k: kindOf(block), d: depthOf(block) })));
  blocks.forEach((block, at) => {
    if (numbers[at]) block.dataset.n = String(numbers[at]);
    else block.removeAttribute("data-n");
  });
}

// ---- caret, history and committing changes

function saveCaret(el: Element): Caret {
  const range = selectionRange(el);
  const block = range && blockOf(el, range.startContainer);
  if (!block) return null;
  const at = blocksOf(el).indexOf(block);
  if (isWrapped(kindOf(block))) return { at, offset: 0 };
  const before = document.createRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  return { at, offset: before.toString().length };
}

function restoreCaret(el: Element, caret: Caret) {
  if (!caret) return;
  const block = el.children[Math.min(caret.at, el.children.length - 1)];
  if (!block) return;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let left = caret.offset;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (left <= node.length) {
      const range = document.createRange();
      range.setStart(node, left);
      range.collapse(true);
      selection().removeAllRanges();
      selection().addRange(range);
      return;
    }
    left -= node.length;
  }
  placeCaret(block, true);
}

function markEmpty(el: Element) {
  const blocks = blocksOf(el);
  const empty = blocks.length === 1 && kindOf(blocks[0]) === "p" && !blocks[0].textContent;
  el.toggleAttribute("data-empty", empty);
  if (empty) el.style.setProperty("--rich-ph", JSON.stringify(el.dataset.ph ?? "")); // the empty line's ::before can't read the editor's attribute
}

/** Tidies the blocks and reports the new markdown. `boundary` makes this change its own undo step. */
const commit: Commit = (el, boundary = false, toggled = null) => {
  const state = stateOf(el);
  tidy(el);
  const md = docToMarkdown(readBlocks(el));
  markEmpty(el);
  if (md === state.md) return;
  const now = Date.now();
  if (boundary || !state.undo.length || now - state.pushedAt > SNAPSHOT_GAP_MS) {
    state.undo.push({ md: state.md, caret: state.caret });
    if (state.undo.length > HISTORY_MAX) state.undo.shift();
  }
  state.pushedAt = boundary ? 0 : now;
  state.redo = [];
  state.md = md;
  el.dispatchEvent(new CustomEvent("rich-change", { bubbles: true, detail: { md, toggled } }));
};

function replaceWith(el: RichEl, entry: Snapshot) {
  const state = stateOf(el);
  state.md = entry.md;
  state.picked = null;
  el.removeAttribute("data-picking");
  el.innerHTML = blocksHtml(parseDoc(entry.md), state.editable);
  tidy(el);
  markEmpty(el);
  restoreCaret(el, entry.caret);
  el.dispatchEvent(new CustomEvent("rich-change", { bubbles: true, detail: { md: entry.md, toggled: null } }));
}

function undo(el: RichEl, from: "undo" | "redo" = "undo", to: "undo" | "redo" = "redo") {
  const state = stateOf(el);
  const entry = state[from].pop();
  if (!entry) return;
  state[to].push({ md: state.md, caret: saveCaret(el) });
  replaceWith(el, entry);
  state.pushedAt = 0;
}

// ---- blocks

function newBlock(kind: string, depth = 0) {
  const block = document.createElement("div");
  block.dataset.k = kind;
  if (depth && LIST_KINDS.includes(kind)) block.dataset.d = String(depth);
  block.innerHTML = "<br>";
  return block;
}

function setKind(block: HTMLElement, kind: string) {
  block.dataset.k = kind;
  if (!LIST_KINDS.includes(kind)) block.removeAttribute("data-d");
  if (kind !== "check") block.removeAttribute("data-done");
}

function selectedBlocks(el: Element) {
  const range = selectionRange(el);
  if (!range) return [];
  const first = blockOf(el, range.startContainer);
  const last = blockOf(el, range.endContainer);
  const blocks = blocksOf(el);
  if (!first || !last) return [];
  return blocks.slice(blocks.indexOf(first), blocks.indexOf(last) + 1).filter((block) => !isWrapped(kindOf(block)));
}

const NEXT_KIND: Record<string, string> = { h1: "p", h2: "p", h3: "p", check: "check", num: "num", bullet: "bullet", dash: "dash", quote: "quote", mono: "mono", p: "p" };

/** Enter: ends an empty list item, quote or code line; otherwise splits the block at the caret. */
function splitBlock(el: RichEl) {
  const range = selectionRange(el);
  if (!range) return;
  if (!range.collapsed) range.deleteContents();
  const block = blockOf(el, range.startContainer);
  if (!block || isWrapped(kindOf(block))) return;
  const kind = kindOf(block);
  const depth = depthOf(block);
  const empty = !block.textContent;
  if (empty && (LIST_KINDS.includes(kind) || kind === "quote" || kind === "mono")) {
    if (depth) block.dataset.d = String(depth - 1);
    else setKind(block, "p");
    commit(el, true);
    return;
  }
  const head = document.createRange();
  head.selectNodeContents(block);
  head.setEnd(range.startContainer, range.startOffset);
  if (!head.toString() && !empty) {
    const above = newBlock(HEADINGS.includes(kind) ? "p" : kind, depth);
    block.before(above);
    commit(el, true);
    return;
  }
  const tail = document.createRange();
  tail.selectNodeContents(block);
  tail.setStart(range.startContainer, range.startOffset);
  const next = newBlock(NEXT_KIND[kind] ?? "p", depth);
  const rest = tail.extractContents();
  if (rest.textContent) next.replaceChildren(rest);
  if (!block.textContent) block.innerHTML = "<br>";
  block.after(next);
  placeCaret(next);
  next.scrollIntoView({ block: "nearest" });
  commit(el, true);
}

function setBlocks(el: RichEl, kind: string) {
  const blocks = selectedBlocks(el);
  if (!blocks.length) return;
  const all = blocks.every((block) => kindOf(block) === kind);
  for (const block of blocks) setKind(block, all ? "p" : kind);
  commit(el, true);
}

function indent(el: RichEl, step: number) {
  const blocks = selectedBlocks(el).filter((block) => LIST_KINDS.includes(kindOf(block)));
  if (!blocks.length) return false;
  for (const block of blocks) {
    const above = block.previousElementSibling as HTMLElement | null;
    const room = above && LIST_KINDS.includes(kindOf(above)) ? depthOf(above) + 1 : 0;
    const depth = Math.max(0, Math.min(MAX_DEPTH, room, depthOf(block) + step));
    if (depth) block.dataset.d = String(depth);
    else block.removeAttribute("data-d");
  }
  commit(el, true);
  return true;
}

function atBlockStart(el: Element) {
  const range = selectionRange(el);
  if (!range?.collapsed) return null;
  const block = blockOf(el, range.startContainer);
  if (!block || isWrapped(kindOf(block))) return null;
  const before = document.createRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString() === "" ? block : null;
}

/** Backspace at the start of a block takes off its style first (list marker, heading) before it joins the line above. */
function backspace(el: RichEl) {
  const block = atBlockStart(el);
  if (!block) return false;
  const kind = kindOf(block);
  if (kind !== "p") {
    if (depthOf(block)) block.dataset.d = String(depthOf(block) - 1);
    else setKind(block, "p");
    commit(el, true);
    return true;
  }
  const above = block.previousElementSibling as HTMLElement | null;
  if (above && isWrapped(kindOf(above))) {
    if (kindOf(above) === "hr" || kindOf(above) === "img") {
      above.remove();
      commit(el, true);
    }
    return true;
  }
  return false;
}

// ---- tables

function cellOf(node: Node | null | undefined): Cell | null {
  const element = (node?.nodeType === 3 ? node.parentNode : node) as Element | null | undefined;
  return element?.closest?.("td") ?? null;
}

function focusCell(cell: Cell, atEnd = true) {
  cell.focus({ preventScroll: true });
  placeCaret(cell, atEnd);
}

function addRowAfter(table: HTMLTableElement, rowIndex: number) {
  const rows = table.rows;
  const row = rows[rowIndex].cloneNode(false) as HTMLTableRowElement;
  for (let at = 0; at < rows[rowIndex].cells.length; at++) row.insertAdjacentHTML("beforeend", `<td contenteditable="true"><br></td>`);
  rows[rowIndex].after(row);
  return row;
}

function moveCell(el: RichEl, cell: Cell, step: number, grow = false) {
  const table = cell.closest("table")!;
  const cells = [...table.querySelectorAll("td")];
  const at = cells.indexOf(cell) + step;
  if (at >= 0 && at < cells.length) return focusCell(cells[at]);
  if (step > 0 && grow) {
    const row = addRowAfter(table, table.rows.length - 1);
    commit(el, true);
    return focusCell(row.cells[0]);
  }
  const wrapper = table.closest("[data-k]")!;
  const neighbour = step > 0 ? wrapper.nextElementSibling : wrapper.previousElementSibling;
  if (neighbour) placeCaret(neighbour, step < 0);
}

const rowOf = (cell: Cell) => cell.parentNode as HTMLTableRowElement;
const columns = (cell: Cell) => rowOf(cell).cells.length;

const newCells = (count: number) => `<td contenteditable="true"><br></td>`.repeat(count);

function addColumnAt(table: HTMLTableElement, index: number) {
  for (const row of table.rows) {
    const cell = row.cells[index];
    if (cell) cell.insertAdjacentHTML("beforebegin", newCells(1));
    else row.insertAdjacentHTML("beforeend", newCells(1));
  }
}

function addRowAt(table: HTMLTableElement, index: number) {
  const row = table.rows[0].cloneNode(false) as HTMLTableRowElement;
  row.innerHTML = newCells(table.rows[0].cells.length);
  if (table.rows[index]) table.rows[index].before(row);
  else table.rows[table.rows.length - 1].after(row);
  return row;
}

/**
 * The table actions, from the toolbar, the table's menu and its hover +. "insert" makes a 2 x 2 table; the rest change the table the
 * caret is in, or the picked block of cells (rows and columns delete together). `index` is where "insertRow" / "insertColumn" go.
 */
export function richTable(id: string, action: string, index = 0) {
  const el = editorById(id);
  if (!el || !stateOf(el)?.editable) return;
  focusEditor(el);
  const range = selectionRange(el);
  const picked = stateOf(el).picked;
  const cell = picked?.anchor ?? cellOf(range?.startContainer);
  if (action === "insert" && !cell) {
    const block = range && blockOf(el, range.startContainer);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = blocksHtml([{ k: "table", rows: [["", ""], ["", ""]] }]);
    const table = wrapper.firstElementChild!;
    if (block && !block.textContent && kindOf(block) === "p") block.replaceWith(table);
    else if (block) block.after(table);
    else el.append(table);
    commit(el, true);
    return focusCell(table.querySelector("td")!);
  }
  if (!cell) return;
  const table = cell.closest("table")!;
  const first = picked ?? { r1: rowOf(cell).rowIndex, r2: rowOf(cell).rowIndex, c1: cell.cellIndex, c2: cell.cellIndex };
  const columnCount = table.rows[0].cells.length;
  if (action === "selectRow" || action === "selectColumn") {
    const [from, to] = action === "selectRow"
      ? [table.rows[first.r1].cells[0], table.rows[first.r1].cells[columnCount - 1]]
      : [table.rows[0].cells[first.c1], table.rows[table.rows.length - 1].cells[first.c1]];
    return el.dispatchEvent(new CustomEvent("rich-pick", { detail: { from, to } }));
  }
  if (action === "clearCells") {
    for (const each of picked ? pickedCells(picked).flat() : [cell]) each.innerHTML = "<br>";
  } else if (action === "addRow") focusCell(addRowAt(table, first.r2 + 1).cells[cell.cellIndex], false);
  else if (action === "addColumn") {
    addColumnAt(table, first.c2 + 1);
    focusCell(rowOf(cell).cells[first.c2 + 1], false);
  } else if (action === "insertRow") focusCell(addRowAt(table, index).cells[0], false);
  else if (action === "insertColumn") {
    addColumnAt(table, index);
    focusCell(table.rows[0].cells[index], false);
  } else if (action === "deleteRow" && first.r2 - first.r1 + 1 < table.rows.length) {
    const next = table.rows[first.r2 + 1] ?? table.rows[first.r1 - 1];
    for (let row = first.r2; row >= first.r1; row--) table.rows[row].remove();
    focusCell(next.cells[Math.min(cell.cellIndex, next.cells.length - 1)], false);
  } else if (action === "deleteColumn" && first.c2 - first.c1 + 1 < columnCount) {
    const next = rowOf(cell).cells[first.c2 + 1] ?? rowOf(cell).cells[first.c1 - 1];
    for (const row of [...table.rows]) for (let column = first.c2; column >= first.c1; column--) row.cells[column].remove();
    focusCell(next, false);
  } else if (action === "deleteTable" || action === "deleteRow" || action === "deleteColumn") {
    const wrapper = table.closest("[data-k]")!;
    const neighbour = wrapper.nextElementSibling ?? wrapper.previousElementSibling;
    wrapper.remove();
    if (neighbour) placeCaret(neighbour);
  }
  el.dispatchEvent(new CustomEvent("rich-unpick"));
  commit(el, true);
}

// ---- toolbar actions

/** Sets the style of the selected lines: title, heading, subheading, body, mono, bullet, dash, num, check, quote. */
export function richBlock(id: string, kind: string) {
  const el = editorById(id);
  if (!el || !stateOf(el)?.editable) return;
  focusEditor(el);
  setBlocks(el, kind);
}

const INLINE_COMMANDS: Record<string, string> = { bold: "bold", italic: "italic", underline: "underline", strike: "strikeThrough" };

/** Bold, italic, underline or strike on the selection. */
export function richInline(id: string, kind: string) {
  const el = editorById(id);
  if (!el || !stateOf(el)?.editable) return;
  focusEditor(el);
  document.execCommand("styleWithCSS", false, "false");
  const picked = stateOf(el).picked;
  if (picked && INLINE_COMMANDS[kind]) cellsFormat(el, picked, INLINE_COMMANDS[kind]);
  else if (INLINE_COMMANDS[kind]) document.execCommand(INLINE_COMMANDS[kind]);
  commit(el, true);
}

export function richLink(id: string) {
  const el = editorById(id);
  const range = el && selectionRange(el);
  if (!el || !range || !stateOf(el).editable) return;
  const saved = range.cloneRange();
  const url = (globalThis.prompt?.("Link address", "https://") ?? "").trim();
  if (!SAFE_LINK.test(url)) return;
  focusEditor(el);
  selection().removeAllRanges();
  selection().addRange(saved);
  if (saved.collapsed) document.execCommand("insertHTML", false, `<a href="${encodeURI(url)}">${url.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a>`);
  else document.execCommand("createLink", false, encodeURI(url));
  commit(el, true);
}

export function richFocus(id: string) {
  const el = editorById(id);
  if (!el || !stateOf(el)?.editable) return;
  focusEditor(el);
  if (!selectionRange(el)) placeCaret(el.firstElementChild ?? el);
}

/** Focuses the editor with the caret at the end of the text (a tap on the empty space below it). Run it inside the tap so a phone raises the keyboard. */
export function richFocusEnd(id: string) {
  const el = editorById(id);
  if (!el || !stateOf(el)?.editable) return;
  el.focus({ preventScroll: true });
  const last = el.lastElementChild;
  placeCaret(last && kindOf(last) === "table" ? el : (last ?? el), true);
}

// ---- typing

function typedShortcut(el: RichEl) {
  const range = selectionRange(el);
  const block = range?.collapsed && blockOf(el, range.startContainer);
  if (!block || kindOf(block) !== "p") return false;
  const kind = SHORTCUTS[plainText(block).replace(/ $/, "")];
  if (!kind || !/ $/.test(plainText(block))) return false;
  commit(el, true);
  block.innerHTML = "<br>";
  setKind(block, kind);
  placeCaret(block);
  commit(el, true);
  return true;
}

/** A link typed or pasted and followed by a space becomes a link. */
function autoLink(el: Element) {
  const range = selectionRange(el);
  const node = range?.collapsed ? range.startContainer : null;
  if (!range || !(node instanceof Text) || node.parentElement?.closest("a, code")) return;
  const match = (node.nodeValue ?? "").slice(0, range.startOffset).match(TYPED_LINK);
  if (!match) return;
  const [whole, url, trailing, space] = match;
  const start = range.startOffset - whole.length;
  const link = document.createElement("a");
  link.href = url;
  link.textContent = url;
  const after = node.splitText(range.startOffset);
  const urlNode = node.splitText(start);
  urlNode.replaceWith(link);
  link.after(document.createTextNode(trailing + space));
  placeCaret(after.previousSibling!, true);
}

function pasteText(el: RichEl, text: string) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const range = selectionRange(el);
  const target = stateOf(el).picked?.anchor ?? (range && cellOf(range.startContainer));
  if (target) {
    if (/[\t\n]/.test(lines.replace(/\n+$/, ""))) return cellsPaste(el, target, lines, addRowAfter, commit);
    el.dispatchEvent(new CustomEvent("rich-unpick"));
    focusCell(target);
    document.execCommand("insertText", false, lines.trim());
    return commit(el, true);
  }
  if (!lines.includes("\n")) {
    document.execCommand("insertText", false, lines);
    return commit(el, true);
  }
  if (!range) return;
  if (!range.collapsed) range.deleteContents();
  const block = blockOf(el, range.startContainer);
  if (!block || isWrapped(kindOf(block))) return;
  const tail = document.createRange();
  tail.selectNodeContents(block);
  tail.setStart(range.startContainer, range.startOffset);
  const rest = tail.extractContents();
  const holder = document.createElement("div");
  holder.innerHTML = blocksHtml(parseDoc(lines.replace(/\n+$/, "")));
  const pasted = [...holder.children] as HTMLElement[];
  let last = block;
  for (const piece of pasted) {
    last.after(piece);
    last = piece;
  }
  if (rest.textContent) {
    const tailBlock = newBlock(kindOf(block), depthOf(block));
    tailBlock.replaceChildren(rest);
    last.after(tailBlock);
  }
  if (!block.textContent) block.remove();
  commit(el, true);
  placeCaret(last, true);
}

// ---- pictures: shrunk in the browser, saved through the chat's upload (private/uploads), kept in the text as a line `![](/private/uploads/x.jpg)`

const PICTURE_SIDE = 1600;
const imageFiles = (files?: FileList | null) => [...(files ?? [])].filter((file) => file.type.startsWith("image/"));

async function shrink(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PICTURE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no image"))), "image/jpeg", 0.85));
}

/** Puts the pictures on their own lines after the line at the caret (or at the end). Needs the connection to upload; offline it buzzes. */
async function insertImages(el: RichEl, files: File[], into?: HTMLElement | null) {
  let anchor = into ?? blockOf(el, selectionRange(el)?.startContainer) ?? (el.lastElementChild as HTMLElement | null);
  el.setAttribute("data-uploading", "");
  try {
    for (const file of files) {
      let path = "";
      try {
        path = await globalThis.ravelChat!.upload(await shrink(file));
      } catch {
        globalThis.ravel?.haptic("warning");
        break;
      }
      const holder = document.createElement("div");
      holder.innerHTML = blocksHtml([{ k: "img", text: path.startsWith("/") ? path : `/${path}` }]);
      const picture = holder.firstElementChild as HTMLElement;
      if (!anchor || !el.contains(anchor)) el.append(picture);
      else if (kindOf(anchor) === "p" && !anchor.textContent) {
        anchor.replaceWith(picture);
      } else anchor.after(picture);
      anchor = picture;
      globalThis.ravel?.haptic("success");
    }
  } finally {
    el.removeAttribute("data-uploading");
  }
  commit(el, true);
  const after = anchor?.nextElementSibling;
  if (after) placeCaret(after, false);
}

/** The toolbar's picture button: asks for photos (the camera or library on a phone) and adds them at the caret. */
export function richImage(id: string) {
  const el = editorById(id);
  if (!el || !stateOf(el)?.editable) return;
  const at = blockOf(el, selectionRange(el)?.startContainer);
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.onchange = () => insertImages(el, imageFiles(input.files), at);
  input.click();
}

function checkboxHit(event: MouseEvent, block: HTMLElement) {
  if (kindOf(block) !== "check") return false;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const box = block.getBoundingClientRect();
  const left = depthOf(block) * 1.5 * rem - 4;
  const x = event.clientX - box.left;
  return x >= left && x <= left + CHECK_HIT_REM * rem && event.clientY - box.top <= 1.9 * rem;
}

function onClick(el: RichEl, event: MouseEvent) {
  const state = stateOf(el);
  const link = (event.target as Element).closest?.("a");
  if (link && (event.metaKey || event.ctrlKey || matchMedia("(pointer: coarse)").matches || !state.editable)) {
    event.preventDefault();
    open(link.href, "_blank", "noopener");
    return;
  }
  const block = blockOf(el, event.target as Node);
  if (block && kindOf(block) === "img") {
    if (!state.editable) return;
    if ((event.target as Element).closest(".rich-img-x")) {
      block.remove();
      commit(el, true);
      globalThis.ravel?.haptic("warning");
    } else {
      for (const other of el.querySelectorAll("[data-picked]")) other.removeAttribute("data-picked");
      block.setAttribute("data-picked", "");
    }
    return;
  }
  if (!state.editable || !block || !checkboxHit(event, block)) return;
  event.preventDefault();
  const done = !block.hasAttribute("data-done");
  block.toggleAttribute("data-done", done);
  globalThis.ravel?.haptic(done ? "success" : "tap");
  commit(el, true, { done });
}

function onBeforeInput(el: RichEl, event: InputEvent) {
  const state = stateOf(el);
  const type = event.inputType;
  if (type === "historyUndo" || type === "historyRedo") {
    event.preventDefault();
    return type === "historyUndo" ? undo(el) : undo(el, "redo", "undo");
  }
  if (!state.editable) return;
  const cell = cellOf(event.target as Node);
  if (type === "insertParagraph" || type === "insertLineBreak") {
    event.preventDefault();
    if (cell) moveCell(el, cell, columns(cell));
    else splitBlock(el);
  } else if (type === "deleteContentBackward" && !cell) {
    if (backspace(el)) event.preventDefault();
  } else if (type === "insertFromDrop" || type === "insertFromPaste") {
    event.preventDefault();
  }
}

function onKeyDown(el: RichEl, event: KeyboardEvent) {
  const state = stateOf(el);
  if (!state.editable) return;
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key.toLowerCase() === "z") {
    event.preventDefault();
    return event.shiftKey ? undo(el, "redo", "undo") : undo(el);
  }
  if (event.ctrlKey && event.key.toLowerCase() === "y") {
    event.preventDefault();
    return undo(el, "redo", "undo");
  }
  if (event.key === "Tab" && !mod) {
    const cell = cellOf(event.target as Node);
    if (cell) {
      event.preventDefault();
      moveCell(el, cell, event.shiftKey ? -1 : 1, true);
    } else if (indent(el, event.shiftKey ? -1 : 1)) event.preventDefault();
  }
  if ((event.key === "Backspace" || event.key === "Delete") && !mod) {
    const picked = el.querySelector<HTMLElement>('[data-k="img"][data-picked]');
    if (picked) {
      event.preventDefault();
      const next = (picked.nextElementSibling ?? picked.previousElementSibling) as HTMLElement | null;
      picked.remove();
      commit(el, true);
      if (next) placeCaret(next, false);
      return;
    }
  }
  if (event.key === "Escape") (event.target as HTMLElement).blur?.();
}

function onInput(el: RichEl, event: InputEvent) {
  const state = stateOf(el);
  if (!state.editable) return;
  if (event.inputType === "insertText" && event.data === " " && !cellOf(event.target as Node)) {
    if (typedShortcut(el)) return;
    autoLink(el);
  }
  commit(el);
}

function describeSelection(el: Element): SelectionState {
  const range = selectionRange(el);
  const block = range && blockOf(el, range.startContainer);
  const inCell = Boolean(range && cellOf(range.startContainer));
  const query = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };
  const kind = block && !isWrapped(kindOf(block)) ? kindOf(block) : "p";
  // An editor with `data-title` styles its first line bold in CSS; that is not a bold mark.
  const styledBold = HEADINGS.includes(kind) || (el.hasAttribute("data-title") && block === el.firstElementChild);
  return { k: kind, b: !styledBold && query("bold"), i: query("italic"), u: query("underline"), s: query("strikeThrough"), t: inCell };
}

function richInit(el: RichEl) {
  const state: RichState = { md: "", editable: true, key: "", undo: [], redo: [], pushedAt: 0, caret: null, sig: "", picked: null };
  el.__rich = state;
  el.addEventListener("beforeinput", (event) => onBeforeInput(el, event));
  el.addEventListener("input", (event) => onInput(el, event as InputEvent));
  el.addEventListener("keydown", (event) => onKeyDown(el, event));
  el.addEventListener("click", (event) => onClick(el, event));
  el.addEventListener("mousedown", (event) => {
    const block = blockOf(el, event.target as Node);
    // A picture's ✕ is a button: pressing it must not move focus out of the editor.
    if (state.editable && block && (checkboxHit(event, block) || (event.target as Element).closest?.(".rich-img-x"))) event.preventDefault();
  });
  el.addEventListener("paste", (event) => {
    event.preventDefault();
    if (!state.editable) return;
    const pictures = imageFiles(event.clipboardData?.files);
    if (pictures.length) insertImages(el, pictures);
    else pasteText(el, event.clipboardData?.getData("text/plain") ?? "");
  });
  el.addEventListener("dragover", (event) => event.preventDefault());
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    const pictures = imageFiles(event.dataTransfer?.files);
    if (state.editable && pictures.length) insertImages(el, pictures);
  });
  el.addEventListener("cut", () => setTimeout(() => state.editable && commit(el, true)));
  cellsInit(el, { commit, cellOf });
  popInit(el, { selectionRange, cellOf, describeSelection, pasteText, richBlock, richInline, richTable, richLink });
  return state;
}

/**
 * Shows `markdown` in the editor `el` (only when it differs from what the editor already holds, so typing never
 * resets the caret). `key` names what is open: a new key starts a fresh undo history.
 */
export function richLoad(el: RichEl, markdown: string, editable = true, key = "") {
  const state = el.__rich ?? richInit(el);
  if (state.md === markdown && state.editable === editable && state.key === key && el.firstElementChild) return;
  if (state.key !== key) {
    state.undo = [];
    state.redo = [];
  }
  Object.assign(state, { md: markdown, editable, key, caret: null, picked: null });
  el.removeAttribute("data-picking");
  el.innerHTML = blocksHtml(parseDoc(markdown), editable);
  el.contentEditable = editable ? "true" : "false";
  el.setAttribute("enterkeyhint", "enter");
  tidy(el);
  markEmpty(el);
}

// One listener keeps the toolbar's state (`rich-state` on the editor) and the caret for undo up to date.
if (typeof document !== "undefined" && !page.__richSelection) {
  page.__richSelection = true;
  document.addEventListener("selectionchange", () => {
    const el = document.activeElement?.closest?.<RichEl>("[data-rich]");
    const state = el?.__rich;
    if (!el || !state) return;
    state.caret = saveCaret(el);
    const detail = describeSelection(el);
    const sig = JSON.stringify(detail);
    if (sig === state.sig) return;
    state.sig = sig;
    el.dispatchEvent(new CustomEvent("rich-state", { bubbles: true, detail }));
  });
}

/** Keeps the formatting bar above the on-screen keyboard (iOS): sets --rich-b while the keyboard is up. */
export function richKeyboard() {
  const viewport = globalThis.visualViewport;
  if (!viewport || page.__richKeyboard) return;
  page.__richKeyboard = true;
  const place = () => {
    const keyboard = innerHeight - viewport.height - viewport.offsetTop;
    document.documentElement.style.setProperty("--rich-b", keyboard > 80 ? `${keyboard + 8}px` : "");
  };
  viewport.addEventListener("resize", place);
  viewport.addEventListener("scroll", place);
}
if (typeof document !== "undefined") richKeyboard();
