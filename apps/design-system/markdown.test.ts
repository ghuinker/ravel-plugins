import assert from "node:assert/strict";
import { renderMarkdown } from "./markdown.ts";

Deno.test("renders common markdown", () => {
  const html = renderMarkdown("# Title\n\nSome **bold**, *italic*, ~~gone~~ and `code`.\n\n- one\n- two\n\n1. first\n\n> quoted");
  for (const part of ["<h1>Title</h1>", "<strong>bold</strong>", "<em>italic</em>", "<del>gone</del>", "<code>code</code>", "<ul><li>one</li><li>two</li></ul>", "<ol><li>first</li></ol>", "<blockquote>quoted</blockquote>"]) {
    assert.ok(html.includes(part), part);
  }
});

Deno.test("escapes html and rejects unsafe links", () => {
  const html = renderMarkdown("<script>alert(1)</script> [x](javascript:alert(1)) [ok](https://a.com/?q=1&r=2)");
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("href=\"javascript"));
  assert.ok(html.includes('href="https://a.com/?q=1&amp;r=2"'));
});

Deno.test("code blocks stay literal", () => {
  assert.equal(renderMarkdown("```\n**no** <b>\n```"), "<pre><code>**no** &lt;b&gt;</code></pre>");
});

Deno.test("tasks get attrs with their line", () => {
  const text = "intro\n- [ ] milk\n- [x] eggs";
  const html = renderMarkdown(text, { taskAttrs: (line: number) => `data-line="${line}"` });
  assert.ok(html.includes('data-line="1"') && html.includes('data-line="2"'));
});

Deno.test("a saved picture renders as an image", () => {
  assert.match(renderMarkdown("![](/private/uploads/a.jpg)"), /<img src="\/private\/uploads\/a\.jpg"/);
});
