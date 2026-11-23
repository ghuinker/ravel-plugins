import type { Item, Kind } from "@app/tags/api.ts";
import { listTodos } from "./db.ts";

const TEXT_PREVIEW = 400;

const items = (): Item[] =>
  listTodos().map((todo) => ({ kind: "todo", id: todo.id, title: todo.body, text: todo.notes.slice(0, TEXT_PREVIEW), done: Boolean(todo.done), href: "/todo", at: todo.updated_at }));

export const tagKinds: Record<string, Kind> = { todo: { label: "Task", plural: "Tasks", icon: "check-circle", list: items } };
