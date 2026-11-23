// "Ask AI" in any ⋮ menu: opens a new chat tab with a reference to the thing, ready for the owner to say what to do.
declare const chat: RavelChatClient; // passed in by the panel (apps/ai/index.ts)

const TITLE_MAX = 80;

const WHERE: Record<string, string> = {
  chat: "file chats/<id>.jsonl; the chat_meta table holds pin, hidden and summary",
  chats: "apps/chats",
  todo: "table todos",
  note: "table notes",
  tag: "table tags (items are in item_tags)",
  app: "apps folder",
  job: "background job registered in its app's app.ts (jobs)",
  notification: "apps/notifications (registry in types.ts, table notification_log)",
};

function ravelAsk(button: Element | null, kind: string, id: string) {
  const title = button?.closest(".ask-item")?.querySelector(".ask-title")?.textContent?.trim().slice(0, TITLE_MAX) ?? "";
  const named = title ? ` "${title}"` : "";
  const where = WHERE[kind] ?? kind;
  chat.ask(`About my ${kind}${named} (id ${id}, ${where}): `);
}

Object.assign(globalThis, { ravelAsk });
