// Selecting several cells of a table. Every cell is its own editing area, so the browser can't select across them;
// this keeps its own selection (`state.picked`): drag across cells or shift-click to pick a block of them, then
// Delete clears them, copy and cut give a tab-separated grid, paste fills a grid, and formatting applies to each cell.
// `cellsInit(el, api)` is called by rich-edit.client.ts with `commit` and `cellOf`.
import type { Commit, Picked, RichEl } from "./rich-edit.client.ts";

type Cell = HTMLTableCellElement;
type CellsApi = { commit: Commit; cellOf: (node: Node | null | undefined) => Cell | null };
type PickDetail = { from: Cell; to: Cell };

const PICKED = "is-picked";

const cellText = (cell: Cell) => (cell.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ").trim();
const rowOf = (cell: Cell) => (cell.parentNode as HTMLTableRowElement).rowIndex;
const tableOf = (cell: Cell) => cell.closest("table")!;
const selection = () => getSelection()!;

/** The cells of the picked block, row by row. */
export function pickedCells(picked: Picked) {
  const rows: Cell[][] = [];
  for (let row = picked.r1; row <= picked.r2; row++) rows.push([...picked.table.rows[row].cells].slice(picked.c1, picked.c2 + 1));
  return rows;
}

export function cellsInit(el: RichEl, api: CellsApi) {
  const state = el.__rich!;
  state.picked = null;
  let anchor: Cell | null = null;
  let dragging = false;

  function paint() {
    for (const cell of el.querySelectorAll(`td.${PICKED}`)) cell.classList.remove(PICKED);
    const picked = state.picked;
    el.toggleAttribute("data-picking", Boolean(picked));
    if (picked) for (const cell of pickedCells(picked).flat()) cell.classList.add(PICKED);
  }

  function clear() {
    if (!state.picked) return;
    state.picked = null;
    paint();
  }

  function pick(from: Cell, to: Cell) {
    const rows = [rowOf(from), rowOf(to)].sort((a, b) => a - b);
    const columns = [from.cellIndex, to.cellIndex].sort((a, b) => a - b);
    state.picked = { table: tableOf(from), r1: rows[0], r2: rows[1], c1: columns[0], c2: columns[1], anchor: from };
    paint();
    // The browser's own caret would show inside one cell; the picked block is the selection now.
    selection().removeAllRanges();
  }

  const grid = (picked: Picked) => pickedCells(picked).map((row) => row.map(cellText).join("\t")).join("\n");

  function wipe(picked: Picked) {
    for (const cell of pickedCells(picked).flat()) cell.innerHTML = "<br>";
    api.commit(el, true);
  }

  el.addEventListener("mousedown", (event) => {
    if (!state.editable || event.button !== 0) return;
    const cell = api.cellOf(event.target as Node);
    if (!cell) return clear();
    const from = state.picked?.anchor ?? anchor ?? api.cellOf(selection().anchorNode);
    if (event.shiftKey && from && from !== cell && tableOf(from) === tableOf(cell)) {
      event.preventDefault();
      return pick(from, cell);
    }
    clear();
    anchor = cell;
    dragging = true;
  });

  document.addEventListener("mousemove", (event) => {
    if (!dragging || !(event.buttons & 1) || !anchor) return;
    const cell = api.cellOf(document.elementFromPoint(event.clientX, event.clientY));
    if (cell && cell !== anchor && tableOf(anchor) === tableOf(cell)) pick(anchor, cell);
  });
  document.addEventListener("mouseup", () => {
    dragging = false;
  });

  el.addEventListener("keydown", (event) => {
    const picked = state.picked;
    if (!picked || !state.editable) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      return wipe(picked);
    }
    if (event.key === "Escape") {
      event.stopImmediatePropagation();
      return clear();
    }
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier && !["Shift", "Alt", "Control", "Meta"].includes(event.key)) {
      // Typing or moving leaves the block, back to a caret in the cell it started in.
      clear();
      picked.anchor.focus({ preventScroll: true });
    }
  }, true);

  el.addEventListener("copy", (event) => {
    if (!state.picked) return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", grid(state.picked));
  }, true);
  el.addEventListener("cut", (event) => {
    const picked = state.picked;
    if (!picked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.clipboardData?.setData("text/plain", grid(picked));
    wipe(picked);
  }, true);
  el.addEventListener("rich-unpick", clear);
  el.addEventListener("rich-pick", (event) => {
    const { from, to } = (event as CustomEvent<PickDetail>).detail;
    pick(from, to);
  });
  el.addEventListener("input", clear);
  el.addEventListener("focusout", () => setTimeout(() => !el.contains(document.activeElement) && clear()));
}

/** Pastes tab-separated text into the table from `start`, adding the rows and columns it needs, and picks what it filled. */
export function cellsPaste(el: RichEl, start: Cell, text: string, addRow: (table: HTMLTableElement, index: number) => void, commit: Commit) {
  const table = tableOf(start);
  const picked = el.__rich?.picked;
  const row0 = picked ? picked.r1 : rowOf(start);
  const column0 = picked ? picked.c1 : start.cellIndex;
  const lines = text.replace(/\n+$/, "").split("\n").map((line) => line.split("\t"));
  const width = Math.max(...lines.map((line) => line.length));
  while (table.rows.length < row0 + lines.length) addRow(table, table.rows.length - 1);
  while (table.rows[0].cells.length < column0 + width) {
    for (const row of table.rows) row.insertAdjacentHTML("beforeend", `<td contenteditable="true"><br></td>`);
  }
  lines.forEach((line, y) => line.forEach((value, x) => {
    const cell = table.rows[row0 + y].cells[column0 + x];
    cell.textContent = value.trim();
    if (!cell.textContent) cell.innerHTML = "<br>";
  }));
  commit(el, true);
  el.dispatchEvent(new CustomEvent("rich-pick", { detail: { from: table.rows[row0].cells[column0], to: table.rows[row0 + lines.length - 1].cells[column0 + width - 1] } }));
}

/** Bold, italic and the rest on every picked cell. */
export function cellsFormat(el: RichEl, picked: Picked, command: string) {
  for (const cell of pickedCells(picked).flat()) {
    cell.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(cell);
    selection().removeAllRanges();
    selection().addRange(range);
    document.execCommand(command);
  }
  el.dispatchEvent(new CustomEvent("rich-pick", { detail: { from: picked.table.rows[picked.r1].cells[picked.c1], to: picked.table.rows[picked.r2].cells[picked.c2] } }));
}
