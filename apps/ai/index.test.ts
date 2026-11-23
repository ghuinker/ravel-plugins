import assert from "node:assert/strict";
import panel, { pluginFiles } from "./index.ts";
import { fakeCtx } from "@ravel/test.ts";

const render = async (ctx: ReturnType<typeof fakeCtx>) => ((await panel(ctx)) as { value: string }).value;

Deno.test("the panel renders only for the owner", async () => {
  assert.equal(await panel(fakeCtx({ owner: false })), "");
  const page = await render(fakeCtx());
  for (const part of ['id="claude-panel"', "<ravel-chat>", 'id="ai-run"']) assert.ok(page.includes(part), part);
});

Deno.test("asking from anywhere opens the panel", async () => {
  assert.match(await render(fakeCtx()), /data-on:ravel-chat__window="evt.detail.type === 'ask' && \(\$chatOpen = true/);
});

Deno.test("the panel embeds its scripts and every app's chat.client.ts", async () => {
  const page = await render(fakeCtx());
  for (const file of ["ai/keyboard.client.ts", "ai/usage-warning.client.ts", "ai/uh-oh.client.ts", "tags/chat.client.ts"]) {
    assert.ok(page.includes(`data-file="${file}"`), file);
  }
  assert.ok(page.indexOf('data-file="ai/uh-oh.client.ts"') < page.indexOf('data-file="tags/chat.client.ts"'), "plugins run after the panel");
  assert.ok((await pluginFiles()).some((file) => file.pathname.endsWith("/apps/tags/chat.client.ts")));
});

Deno.test("panel scripts are bundled without types and run with the chat client and signal", async () => {
  const page = await render(fakeCtx());
  const body = page.match(/data-file="tags\/chat.client.ts">([\s\S]*?)<\/script>/)![1];
  assert.ok(!body.includes(": string"), "types are stripped");
  const asked: string[] = [];
  new Function("chat", "signal", body)({ ask: (text: string) => asked.push(text) }, new AbortController().signal);
  (globalThis as unknown as { ravelAsk: (button: null, kind: string, id: string) => void }).ravelAsk(null, "todo", "a1");
  assert.equal(asked[0], "About my todo (id a1, table todos): ");
});
