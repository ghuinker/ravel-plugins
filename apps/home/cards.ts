import { plugModules } from "../../lib/plugs.ts";
import type { HomeCard } from "./api.ts";

/** Every card the installed apps put on Home (their `plugs.home` file's `cards`), in page order. A file that fails to import is logged and skipped. */
export async function homeCards(): Promise<HomeCard[]> {
  const found = await plugModules<{ cards?: HomeCard[] }>("home");
  const seen = new Set<string>();
  return found.flatMap(({ mod }) => mod.cards ?? [])
    .filter((card) => !seen.has(card.id) && !!seen.add(card.id))
    .sort((a, b) => a.order - b.order);
}
