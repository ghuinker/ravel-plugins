import { ref } from "@ravel/slot.ts";
import { define } from "@app/settings/api.ts";

export const settings = define(import.meta, {
  label: "Notifications",
  icon: "bell",
  blurb: "What can notify you, when, and what was sent.",
  order: 30,
  pane: ref(import.meta, "./index"),
  values: {
    on: { type: "switch", label: "Notifications", hint: "The master switch. Off, nothing is sent, including reminders you asked for.", fallback: true },
    quiet: { type: "switch", label: "Quiet hours", hint: "No notifications between the times below (wherever you are), reminders you asked for included.", fallback: true },
    quietStart: { type: "number", label: "Quiet hours start", hint: "Hour of the day, 0 to 23 (22 is 10pm).", fallback: 22, min: 0, max: 23 },
    quietEnd: { type: "number", label: "Quiet hours end", hint: "Hour of the day, 0 to 23 (7 is 7am).", fallback: 7, min: 0, max: 23 },
  },
});
