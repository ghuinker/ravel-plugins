// How other apps show up in Todo. An app adds `todo: "./todo"` to the `plugs` in its `app.ts`: a file exporting
// `todoLinks`, a function that returns, for each task id it owns, the chip's label and where it opens, and/or `todoEvents`,
// the things on its calendar between two instants (the widget shows the next one). Every such file is found at start-up,
// so there is nothing to wire and Todo never imports those apps. The worker keeps imported modules, so a new one shows up
// after ravel restarts.
import { plugModules } from "../../lib/plugs.ts";

export type TodoLink = { label: string; href: string };
export type TodoLinks = () => Map<string, TodoLink>;
export type TodoEvent = { title: string; start: number; end: number; allDay: boolean };
export type TodoEvents = (from: number, to: number) => TodoEvent[];

const plugged = (await plugModules<{ todoLinks?: TodoLinks; todoEvents?: TodoEvents }>("todo")).filter(({ app }) => app !== "todo");
const linkSources = plugged.flatMap(({ mod }) => mod.todoLinks ? [mod.todoLinks] : []);
const eventSources = plugged.flatMap(({ mod }) => mod.todoEvents ? [mod.todoEvents] : []);

/** Every app's labels for the tasks it owns, by task id. */
export const linkedLabels = (): Map<string, TodoLink> => new Map(linkSources.flatMap((source) => [...source()]));

/** Every app's events between two instants (ms), earliest first. */
export const eventsBetween = (from: number, to: number): TodoEvent[] =>
  eventSources.flatMap((source) => source(from, to)).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
