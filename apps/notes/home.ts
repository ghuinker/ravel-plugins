import { styles } from "@ravel/client.ts";
import { html } from "@ravel/html.ts";
import { homeCard, type HomeCard } from "@app/home/api.ts";
import { recentNotes } from "./api.ts";

const TAP = "ravel.haptic('tap')";
const NOTES_SHOWN = 5;

function notesCard(index: number) {
  const notes = recentNotes(NOTES_SHOWN);
  const line = (text: string) => text.replace(/^[#>\-*\s]+|[*_`~]/g, "").trim();
  const rows = notes.map((note) => {
    const [title = "Untitled note", preview = ""] = note.body.split("\n").map(line).filter(Boolean);
    return html`<a class="h2-line" href="/notes/${note.id}" data-on:click="${TAP}"><span class="h2-name"><b>${title}</b>${preview ? html`<small class="t-muted">${preview}</small>` : ""}</span></a>`;
  });
  const links = html`<div class="h2-links"><a href="/notes">Notes</a><a href="/chats">Chats</a><a href="/archived">Archived</a><a href="/settings">Settings</a></div>`;
  return homeCard(index, "Notes", html`<div class="h2-list">${rows.length ? rows : html`<p class="h2-empty">No notes yet.</p>`}</div>${links}`, { href: "/notes" });
}

/** The Notes card on Home (`plugs.home` in `app.ts`), with links to the rest of the site. */
export const cards: HomeCard[] = [{ id: "notes", order: 130, size: 12, render: (_ctx, index) => html`${styles(import.meta.resolve("./home.css"))}${notesCard(index)}` }];
