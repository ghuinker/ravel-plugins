import { define } from "@app/settings/api.ts";

export const settings = define(import.meta, {
  label: "Haptics",
  icon: "device-phone-mobile",
  blurb: "The iOS app's feel.",
  values: {
    tabHaptics: { type: "switch", label: "Tab bar haptics", hint: "A light tap when you switch tabs in the iOS app.", fallback: true },
  },
});
