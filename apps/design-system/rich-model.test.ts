import assert from "node:assert/strict";
import { blocksHtml, docToMarkdown, escapeLineStart, numberBlocks, parseDoc } from "./rich-model.ts";
import { renderInline, renderMarkdown } from "./markdown.ts";

const SAMPLE = [
  "# Title",
  "## Heading",
  "### Sub",
  "Body text",
  "",
  "- bullet",
  "  - nested",
  "+ dashed",
  "1. one",
  "2. two",
  "- [ ] todo",
  "- [x] done",
  "> quoted",
  "```",
  "code line",
  "",
  "more",
  "```",
  "| One | Two |",
  "| --- | --- |",
  "| a \\| b | c |",
  "---",
  "last",
].join("\n");

Deno.test("a document round-trips through blocks", () => {
  assert.equal(docToMarkdown(parseDoc(SAMPLE)), SAMPLE);
});

Deno.test("every line is its own block, blank lines are empty paragraphs", () => {
  const blocks = parseDoc("one\ntwo\n\nthree");
  assert.deepEqual(blocks.map((block: { text?: string }) => block.text), ["one", "two", "", "three"]);
  assert.equal(docToMarkdown(blocks), "one\ntwo\n\nthree");
});

Deno.test("an empty document is one empty paragraph", () => {
  assert.deepEqual(parseDoc(""), [{ k: "p", text: "" }]);
  assert.equal(docToMarkdown(parseDoc("")), "");
});

Deno.test("trailing blank lines are dropped on the way out", () => {
  assert.equal(docToMarkdown(parseDoc("a\n\n\n")), "a");
});

Deno.test("block kinds", () => {
  const kinds = parseDoc(SAMPLE).map((block: { k: string }) => block.k);
  assert.deepEqual(kinds.slice(0, 13), ["h1", "h2", "h3", "p", "p", "bullet", "bullet", "dash", "num", "num", "check", "check", "quote"]);
  assert.ok(kinds.includes("table") && kinds.includes("hr"));
  assert.equal(parseDoc("  - x")[0].d, 1);
});

Deno.test("numbers count within a run and restart after other blocks", () => {
  const blocks = parseDoc("1. a\n1. b\n  1. c\n  1. d\n1. e\ntext\n5. f");
  assert.deepEqual(numberBlocks(blocks), [1, 2, 1, 2, 3, 0, 1]);
  assert.equal(docToMarkdown(blocks), "1. a\n2. b\n  1. c\n  2. d\n3. e\ntext\n1. f");
});

Deno.test("text that looks like markup stays plain", () => {
  for (const text of ["# not a heading", "- not a list", "1. not a list", "> not a quote", "---", "| not | a table"]) {
    const markdown = docToMarkdown([{ k: "p", text: escapeLineStart(text) }]);
    const back = parseDoc(markdown);
    assert.equal(back.length, 1);
    assert.equal(back[0].k, "p", text);
    assert.ok(!renderInline(back[0].text ?? "").includes("\\"), text);
  }
});

Deno.test("escapes and underline render", () => {
  assert.equal(renderInline("a \\*b\\* c"), "a &#42;b&#42; c");
  assert.equal(renderInline("<u>under</u> and \\<u>"), "<u>under</u> and &#60;u&gt;");
  assert.equal(renderInline("`a\\*b`"), "<code>a\\*b</code>");
});

Deno.test("tables render in both the editor and the plain renderer", () => {
  const html = renderMarkdown("| A | B |\n| --- | --- |\n| 1 | **2** |");
  assert.ok(html.includes("<th>A</th>") && html.includes("<td><strong>2</strong></td>"));
  const editor = blocksHtml(parseDoc("| A | B |\n| --- | --- |\n| 1 | 2 |"));
  assert.ok(editor.includes('data-k="table"') && editor.includes('<td contenteditable="true">1</td>'));
  assert.ok(!blocksHtml(parseDoc("| A |\n| - |\n| 1 |"), false).includes("contenteditable=\"true\""));
});

Deno.test("dashed lists render with a class", () => {
  assert.ok(renderMarkdown("+ one\n+ two").startsWith('<ul class="dash">'));
});

Deno.test("editor markup", () => {
  const html = blocksHtml(parseDoc("- [x] done\n1. n\n\n**b**"));
  assert.ok(html.includes('<div data-k="check" data-done>done</div>'));
  assert.ok(html.includes('<div data-k="num" data-n="1">n</div>'));
  assert.ok(html.includes('<div data-k="p"><br></div>'));
  assert.ok(html.includes("<strong>b</strong>"));
});

Deno.test("a picture is its own line and round-trips as markdown", () => {
  const text = "hello\n![](/private/uploads/a1.jpg)\nbye";
  const blocks = parseDoc(text);
  assert.deepEqual(blocks[1], { k: "img", text: "/private/uploads/a1.jpg" });
  assert.equal(docToMarkdown(blocks), text);
});

Deno.test("only files the site saved count as pictures", () => {
  assert.equal(parseDoc("![](https://example.com/x.png)")[0].k, "p");
  assert.equal(parseDoc("![](private/uploads/a.jpg)")[0].text, "/private/uploads/a.jpg");
});
