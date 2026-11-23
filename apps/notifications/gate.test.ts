import { assertEquals } from "jsr:@std/assert";
import { state } from "@app/settings/api.ts";
import { settings } from "./settings.ts";
import { gate } from "./gate.ts";
import { recentLog, setTypeEnabled, typeEnabled } from "./db.ts";
import type { NotificationType } from "./types.ts";

settings.set("quiet", false);

Deno.test("a registered type passes and is logged; an unknown thread is dropped and logged", async () => {
  assertEquals((await gate({ title: "Hi", thread: "test" }))?.title, "Hi");
  assertEquals(await gate({ title: "Surprise" }), null);
  assertEquals(await gate({ title: "Old thread", thread: "garmin-key" }), null);
  const [old, surprise, hi] = recentLog(3);
  assertEquals([hi.sent, surprise.sent, old.sent], [1, 0, 0]);
  assertEquals(surprise.reason, "not registered");
});

Deno.test("a type's switch overrides its default", () => {
  const nudge: NotificationType = { id: "sample.nudge", app: "Sample", label: "Nudge", hint: "", fallback: true };
  assertEquals(typeEnabled(nudge), true);
  state(import.meta).set(`type.${nudge.id}`, "0");
  assertEquals(typeEnabled(nudge), false);
});

Deno.test("the master switch blocks; asked-for types have no switch", async () => {
  settings.set("on", false);
  assertEquals(await gate({ title: "x", thread: "reminder" }), null);
  settings.set("on", true);
  assertEquals((await gate({ title: "x", thread: "reminder" }))?.title, "x");
  assertEquals(await setTypeEnabled("reminder", false), false);
});
