/** A small, safe markdown renderer for notes. All text is escaped before any markup is added. Runs on the server and in the browser. */

const SAFE_URL = /^(https?:\/\/|mailto:)/i;
export const FENCE = /^```/;
export const HEADING = /^(#{1,6})\s+(.*)$/;
export const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
export const QUOTE = /^>\s?(.*)$/;
export const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
export const TASK = /^\[( |x|X)\]\s+(.*)$/;
/** A picture on a line of its own: only files the site saved itself (`private/uploads`), written `![](/private/uploads/name.jpg)`. */
export const IMAGE = /^!\[[^\]]*\]\((\/?private\/uploads\/[\w.-]+)\)\s*$/;
export const imageSrc = (path: string) => (path.startsWith("/") ? path : `/${path}`);
export const INDENT_WIDTH = 2;
const INDENT_REM = 1.25;
const TABLE_SEPARATOR = /^[\s|:-]+$/;
export const TABLE_ROW = /^\s*\|/;
/** A backslash before one of these keeps it literal (the editor writes them for text that would otherwise be markup). */
const ESCAPABLE = /\\([\\`*_~\[\]<>|#+\-.!(){}])/g;
const HIDE_OPEN = "\uE000";
const HIDE_CLOSE = "\uE001";
const HIDDEN = /\uE000(\d+)\uE001/g;

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const unhide = (text: string, asCode = false) => text.replace(HIDDEN, (_whole, code) => (asCode ? "\\" + String.fromCharCode(code) : `&#${code};`));

export function renderInline(text: string) {
  const hidden = text.replace(ESCAPABLE, (_whole, char: string) => HIDE_OPEN + char.charCodeAt(0) + HIDE_CLOSE);
  return hidden.split(/(`[^`\n]+`)/).map((part, index) => {
    if (index % 2) return `<code>${escapeHtml(unhide(part.slice(1, -1), true))}</code>`;
    return unhide(escapeHtml(part)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, url: string) =>
        SAFE_URL.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : whole)
      .replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, "<u>$1</u>")
      .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, "<strong>$2</strong>")
      .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, "<del>$1</del>")
      .replace(/(^|[^*\w])\*(?=[^\s*])([^*]+?)\*(?!\w)/g, "$1<em>$2</em>")
      .replace(/(^|[^_\w])_(?=[^\s_])([^_]+?)_(?!\w)/g, "$1<em>$2</em>"));
  }).join("");
}

/** The cells of one table row, still as markdown (an escaped pipe stays escaped). */
export function splitRow(line: string) {
  const body = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  const cells: string[] = [];
  let cell = "";
  for (let at = 0; at < body.length; at++) {
    if (body[at] === "\\" && body[at + 1] === "|") {
      cell += "\\|";
      at++;
    } else if (body[at] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += body[at];
  }
  cells.push(cell.trim());
  return cells;
}

/** True when `lines[at]` starts a table: a row of pipes followed by the dashed separator row. */
export function startsTable(lines: string[], at: number) {
  return TABLE_ROW.test(lines[at]) && at + 1 < lines.length && TABLE_SEPARATOR.test(lines[at + 1]) && lines[at + 1].includes("|") && lines[at + 1].includes("-");
}

/** options.taskAttrs(line) gives extra attributes for a task checkbox on that line of the text. */
export function renderMarkdown(text: string, options: { taskAttrs?: (line: number) => string } = {}) {
  const lines = text.split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph = [];
  };

  const renderListItem = (match: RegExpMatchArray, line: number) => {
    const depth = Math.floor(match[1].replace(/\t/g, "  ").length / INDENT_WIDTH);
    const style = depth ? ` style="margin-left: ${depth * INDENT_REM}rem"` : "";
    const task = match[3].match(TASK);
    if (!task) return `<li${style}>${renderInline(match[3])}</li>`;
    const done = task[1] !== " ";
    const attrs = options.taskAttrs?.(line) ?? "disabled";
    return `<li class="task${done ? " done" : ""}"${style}><input type="checkbox" ${done ? "checked" : ""} ${attrs}><span>${renderInline(task[2])}</span></li>`;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (FENCE.test(line)) {
      flushParagraph();
      const code: string[] = [];
      index++;
      while (index < lines.length && !FENCE.test(lines[index])) code.push(lines[index++]);
      index++;
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    } else if (HEADING.test(line)) {
      flushParagraph();
      const [, hashes, content] = line.match(HEADING)!;
      out.push(`<h${hashes.length}>${renderInline(content)}</h${hashes.length}>`);
      index++;
    } else if (IMAGE.test(line.trim())) {
      flushParagraph();
      const src = escapeHtml(imageSrc(line.trim().match(IMAGE)![1]));
      out.push(`<a class="md-img" href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="" loading="lazy"></a>`);
      index++;
    } else if (RULE.test(line.trim())) {
      flushParagraph();
      out.push("<hr>");
      index++;
    } else if (startsTable(lines, index)) {
      flushParagraph();
      const rows = [splitRow(line)];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) rows.push(splitRow(lines[index++]));
      const width = Math.max(...rows.map((row) => row.length));
      const cells = (row: string[], tag: string) => Array.from({ length: width }, (_none, at) => `<${tag}>${renderInline(row[at] ?? "")}</${tag}>`).join("");
      out.push(`<div class="md-table"><table><thead><tr>${cells(rows[0], "th")}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${cells(row, "td")}</tr>`).join("")}</tbody></table></div>`);
    } else if (QUOTE.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index])) quoted.push(lines[index++].match(QUOTE)![1]);
      out.push(`<blockquote>${quoted.map(renderInline).join("<br>")}</blockquote>`);
    } else if (LIST_ITEM.test(line)) {
      flushParagraph();
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (index < lines.length && LIST_ITEM.test(lines[index]) && /^\s*\d/.test(lines[index]) === ordered) {
        items.push(renderListItem(lines[index].match(LIST_ITEM)!, index));
        index++;
      }
      const dashed = /^\s*\+/.test(line);
      out.push(`<${ordered ? "ol" : "ul"}${dashed ? ' class="dash"' : ""}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
    } else if (!line.trim()) {
      flushParagraph();
      index++;
    } else {
      paragraph.push(line);
      index++;
    }
  }
  flushParagraph();
  return out.join("");
}
