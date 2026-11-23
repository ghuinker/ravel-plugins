import { ref } from "@ravel/slot.ts";
import { define } from "@app/settings/api.ts";

export const settings = define(import.meta, {
  label: "Appearance",
  icon: "paint-brush",
  blurb: "Theme and when it switches.",
  order: 10,
  pane: ref(import.meta, "./appearance"),
  values: {
    auto: { type: "switch", label: "Dark mode follows the sun", hint: "The theme turns dark at sunset and light at sunrise, wherever you are.", fallback: true },
  },
});
