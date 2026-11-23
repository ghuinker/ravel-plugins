// The rich editor's document: markdown <-> a flat list of blocks, one per line (no DOM, so it can be tested).
// A block is {k, d, done, text}: k is p, h1, h2, h3, mono, quote, bullet, dash, num, check, hr or table.
import { escapeHtml, FENCE, HEADING, IMAGE, imageSrc, INDENT_WIDTH, LIST_ITEM, QUOTE, renderInline, RULE, splitRow, startsTable, TABLE_ROW, TASK } from "./markdown.ts";

/** One line of the document; a table is one block with its cells in `rows`. */
export type Block = { k: string; d?: number; done?: boolean; text?: string; rows?: string[][] };

export const LIST_KINDS = ["bullet", "dash", "num", "check"];
export const MAX_DEPTH = 4;
const HEADING_KINDS = ["h1", "h2", "h3", "h3", "h3", "h3"];
const HEADING_MARKS: Record<string, string> = { h1: "# ", h2: "## ", h3: "### " };
const WRAPPED_KINDS = ["hr", "table", "img"];

/** The text of a markdown document as blocks. A document always has at least one block. */
export function parseDoc(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (FENCE.test(line)) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !FENCE.test(lines[index])) code.push(lines[index++]);
      index++;
      for (const row of code.length ? code : [""]) blocks.push({ k: "mono", text: row });
    } else if (startsTable(lines, index)) {
      const rows = [splitRow(line)];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) rows.push(splitRow(lines[index++]));
      const width = Math.max(...rows.map((row) => row.length));
      blocks.push({ k: "table", rows: rows.map((row) => Array.from({ length: width }, (_none, at) => row[at] ?? "")) });
    } else {
      blocks.push(parseLine(line));
      index++;
    }
  }
  return blocks.length ? blocks : [{ k: "p", text: "" }];
}

function parseLine(line: string): Block {
  const image = line.trim().match(IMAGE);
  if (image) return { k: "img", text: imageSrc(image[1]) };
  const heading = line.match(HEADING);
  if (heading) return { k: HEADING_KINDS[heading[1].length - 1], text: heading[2] };
  if (RULE.test(line.trim())) return { k: "hr" };
  const quote = line.match(QUOTE);
  if (quote) return { k: "quote", text: quote[1] };
  const item = line.match(LIST_ITEM);
  if (item) {
    const depth = Math.min(MAX_DEPTH, Math.floor(item[1].replace(/\t/g, "  ").length / INDENT_WIDTH));
    const task = item[3].match(TASK);
    if (task) return { k: "check", d: depth, done: task[1] !== " ", text: task[2] };
    const k = /\d/.test(item[2]) ? "num" : item[2] === "+" ? "dash" : "bullet";
    return { k, d: depth, text: item[3] };
  }
  return { k: "p", text: line.trimStart() };
}

/** The number each numbered block shows (0 for the others): it counts up within a run at the same depth. */
export function numberBlocks(blocks: Block[]) {
  const counts: number[] = [];
  return blocks.map((block) => {
    if (!LIST_KINDS.includes(block.k)) {
      counts.length = 0;
      return 0;
    }
    const depth = block.d ?? 0;
    if (block.k !== "num") {
      counts.length = Math.min(counts.length, depth);
      return 0;
    }
    while (counts.length < depth + 1) counts.push(0);
    counts.length = depth + 1;
    return ++counts[depth];
  });
}

/** Text that would start a heading, list, quote, rule, fence or table gets a backslash so it stays a plain line. */
export function escapeLineStart(text: string) {
  if (/^\d+\.(\s|$)/.test(text)) return text.replace(".", "\\.");
  if (RULE.test(text.trim()) || /^(#{1,6}\s|>|[-+]\s|\||```)/.test(text)) return `\\${text}`;
  return text;
}

const cellMark = (text: string) => text.replace(/\|/g, (bar, at) => (text[at - 1] === "\\" ? bar : "\\|"));

/** The markdown of a list of blocks; a table is written with its first row as the header. */
export function docToMarkdown(blocks: Block[]) {
  const numbers = numberBlocks(blocks);
  const lines: string[] = [];
  let fenced = false;
  blocks.forEach((block, at) => {
    if (block.k === "mono") {
      if (!fenced) lines.push("```");
      fenced = true;
      lines.push(block.text ?? "");
      return;
    }
    if (fenced) lines.push("```");
    fenced = false;
    const indent = "  ".repeat(block.d ?? 0);
    const text = block.text ?? "";
    if (block.k === "p") lines.push(escapeLineStart(text));
    else if (HEADING_MARKS[block.k]) lines.push(HEADING_MARKS[block.k] + text);
    else if (block.k === "quote") lines.push(`> ${text}`);
    else if (block.k === "bullet") lines.push(`${indent}- ${text}`);
    else if (block.k === "dash") lines.push(`${indent}+ ${text}`);
    else if (block.k === "num") lines.push(`${indent}${numbers[at]}. ${text}`);
    else if (block.k === "check") lines.push(`${indent}- [${block.done ? "x" : " "}] ${text}`);
    else if (block.k === "hr") lines.push("---");
    else if (block.k === "img") lines.push(`![](${text})`);
    else if (block.k === "table") lines.push(...tableLines(block.rows ?? [[]]));
  });
  if (fenced) lines.push("```");
  while (lines.length && lines.at(-1) === "") lines.pop();
  return lines.join("\n");
}

function tableLines(rows: string[][]) {
  const row = (cells: string[]) => `| ${cells.map((cell) => cellMark(cell)).join(" | ")} |`;
  return [row(rows[0]), `| ${rows[0].map(() => "---").join(" | ")} |`, ...rows.slice(1).map(row)];
}

const cellHtml = (text: string, editable: boolean) => `<td${editable ? ' contenteditable="true"' : ""}>${renderInline(text) || "<br>"}</td>`;

/** The editor markup for one block (the DOM keeps the same facts in data attributes). */
export function blockHtml(block: Block, number = 0, editable = true) {
  if (block.k === "hr") return `<div data-k="hr" contenteditable="false"><hr></div>`;
  if (block.k === "img") return `<div data-k="img" data-src="${escapeHtml(block.text ?? "")}" contenteditable="false"><img src="${escapeHtml(block.text ?? "")}" alt="" draggable="false">${editable ? '<button type="button" class="rich-img-x" aria-label="Remove picture" tabindex="-1">✕</button>' : ""}</div>`;
  if (block.k === "table") {
    const rows = (block.rows ?? []).map((row) => `<tr>${row.map((cell) => cellHtml(cell, editable)).join("")}</tr>`).join("");
    return `<div data-k="table" contenteditable="false"><table><tbody>${rows}</tbody></table></div>`;
  }
  const inner = block.k === "mono" ? escapeHtml(block.text ?? "") : renderInline(block.text ?? "");
  const depth = block.d ? ` data-d="${block.d}"` : "";
  const done = block.done ? " data-done" : "";
  const counted = number ? ` data-n="${number}"` : "";
  return `<div data-k="${block.k}"${depth}${done}${counted}>${inner || "<br>"}</div>`;
}

export function blocksHtml(blocks: Block[], editable = true) {
  const numbers = numberBlocks(blocks);
  return blocks.map((block, at) => blockHtml(block, numbers[at], editable)).join("");
}

export const isWrapped = (kind: string) => WRAPPED_KINDS.includes(kind);
