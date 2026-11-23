import { listChats } from "@ravel/chat.ts";
import type { Item, Kind } from "@app/tags/api.ts";
import { allMeta } from "./db.ts";

// A chat is filed by its summary, so one without a summary yet waits for the summary job.
const items = (): Item[] => {
  const meta = allMeta();
  return listChats().filter((chat) => meta.get(chat.id)?.summary).map((chat) =>
    ({ kind: "chat", id: chat.id, title: chat.title, text: meta.get(chat.id)!.summary, done: false, href: "/chats", at: Date.parse(String(chat.updatedAt)) || 0 }));
};

export const tagKinds: Record<string, Kind> = { chat: { label: "Chat", plural: "Chats", icon: "chat-bubble-left", list: items } };
