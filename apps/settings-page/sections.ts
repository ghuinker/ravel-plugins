import { ref } from "@ravel/slot.ts";
import { list, type Settings } from "@app/settings/api.ts";

/** A Settings section in the rail. `slot` is the fragment that draws the pane. */
export type SettingsSection = { id: string; label: string; icon: string; blurb: string; slot: string; order: number };

const OWN: SettingsSection[] = [
  { id: "account", label: "Account", icon: "user-circle", blurb: "Your address, username and signing out.", slot: ref(import.meta, "./account"), order: 0 },
  { id: "preferences", label: "Preferences", icon: "adjustments-horizontal", blurb: "Settings from your apps that have no section of their own.", slot: ref(import.meta, "./preferences"), order: 20 },
  { id: "memory", label: "Memory", icon: "light-bulb", blurb: "What Claude remembers about you between chats.", slot: ref(import.meta, "./memory"), order: 60 },
  { id: "instructions", label: "Instructions", icon: "document-text", blurb: "CLAUDE.md: how your site works and what Claude should follow.", slot: ref(import.meta, "./instructions"), order: 70 },
  { id: "background", label: "Background Work", icon: "cog-6-tooth", blurb: "The jobs that run on their own: run one now or read what it did.", slot: ref(import.meta, "./jobs"), order: 80 },
];

const fromApp = (settings: Settings): SettingsSection => ({
  id: settings.app,
  label: settings.spec.label,
  icon: settings.spec.icon,
  blurb: settings.spec.blurb,
  slot: settings.spec.pane!,
  order: settings.spec.order ?? 50,
});

/** Apps with values but no pane of their own; Preferences shows them. */
export const preferenceApps = async () => (await list()).filter((settings) => !settings.spec.pane && Object.keys(settings.spec.values).length);

/** Every section in rail order: this page's own, then one per app that has a pane. Preferences is left out when nothing goes in it. */
export async function sections(): Promise<SettingsSection[]> {
  const apps = await list();
  const own = (await preferenceApps()).length ? OWN : OWN.filter((section) => section.id !== "preferences");
  return [...own, ...apps.filter((settings) => settings.spec.pane).map(fromApp)].sort((a, b) => a.order - b.order);
}

export const sectionById = async (id: string) => (await sections()).find((section) => section.id === id);
