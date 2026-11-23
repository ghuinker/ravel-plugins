import { ref } from "@ravel/slot.ts";
import { define } from "@app/settings/api.ts";

export const settings = define(import.meta, {
  label: "Tags",
  icon: "tag",
  blurb: "The tags Claude files your tasks and notes under.",
  order: 40,
  pane: ref(import.meta, "./pane"),
  values: {
    max: { type: "number", label: "Tags per item", hint: "The most tags one task, note or chat can carry. Claude adds a second or third only when it is confident.", fallback: 3, min: 1, max: 5 },
  },
});
