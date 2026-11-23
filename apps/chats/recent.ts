// The chats the owner has been having lately, for the assistant: no system chats (the ones background jobs start) and no hidden ones,
// with their tags and the last thing the owner said.
import { listChats, readChat } from "@ravel/chat.ts";
import { tagsOf } from "@app/tags/api.ts";
import { allMeta } from "./db.ts";

export type RecentChat = { id: string; title: string; tags: string[]; lastSaid: string };

export async function recentChats(since: number, limit: number): Promise<RecentChat[]> {
  const meta = allMeta();
  const recent = (await listChats())
    .filter((chat) => Date.parse(chat.updatedAt) >= since && !chat.labels.includes("system") && !meta.get(chat.id)?.hidden)
    .slice(0, limit);
  return Promise.all(recent.map(async (chat) => {
    const last = (await readChat(chat.id)).filter((entry) => entry.role === "you").at(-1);
    return { id: chat.id, title: chat.title, tags: tagsOf("chat", chat.id).map((tag) => tag.name), lastSaid: last?.text ?? "" };
  }));
}
