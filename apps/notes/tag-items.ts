import type { Item, Kind } from "@app/tags/api.ts";
import { readNotes } from "./db.ts";
import { splitBody } from "./format.ts";

const TEXT_PREVIEW = 400;

const items = (): Item[] =>
  readNotes().filter((note) => note.deleted_at === null).map((note) => {
    const { title, text } = splitBody(note.body);
    return { kind: "note", id: note.id, title: title.trim() || "New Note", text: text.slice(0, TEXT_PREVIEW), done: false, href: "/notes", at: note.updated_at };
  });

export const tagKinds: Record<string, Kind> = { note: { label: "Note", plural: "Notes", icon: "document-text", list: items } };
