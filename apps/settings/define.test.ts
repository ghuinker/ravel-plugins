import { assertEquals } from "jsr:@std/assert";
import { db } from "@ravel/db.ts";
import { define, getValue, setValue, state } from "./define.ts";

const settings = define(import.meta, {
  label: "Test",
  icon: "beaker",
  blurb: "",
  values: {
    testCount: { type: "number", label: "", hint: "", fallback: 4, min: 1, max: 14 },
    testOn: { type: "switch", label: "", hint: "", fallback: true },
  },
});

const clean = () => db.exec("DELETE FROM settings WHERE key LIKE 'settings.test%'");

Deno.test("numbers are prefixed, clamped, validated and defaulted", () => {
  clean();
  try {
    assertEquals(settings.key("testCount"), "settings.testCount");
    assertEquals(settings.get("testCount"), 4);
    assertEquals(settings.set("testCount", 99), true);
    assertEquals(settings.get("testCount"), 14);
    settings.set("testCount", 1);
    assertEquals(settings.get("testCount"), 1);
    assertEquals(settings.set("testCount", NaN), false);
  } finally {
    clean();
  }
});

Deno.test("switches default, save and reject other types", () => {
  clean();
  try {
    assertEquals(settings.get("testOn"), true);
    assertEquals(settings.set("testOn", false), true);
    assertEquals(settings.get("testOn"), false);
    assertEquals(settings.set("testOn", "yes" as never), false);
  } finally {
    clean();
  }
});

Deno.test("full keys reach declared values only", async () => {
  clean();
  try {
    assertEquals(await setValue("settings.testCount", "7"), true);
    assertEquals(await getValue("settings.testCount"), 7);
    assertEquals(await setValue("settings.bogus", 1), false);
    assertEquals(await getValue("settings.bogus"), undefined);
  } finally {
    clean();
  }
});

Deno.test("state is prefixed with the app folder", () => {
  clean();
  try {
    const kv = state(import.meta);
    assertEquals(kv.get("testCursor"), undefined);
    kv.set("testCursor", "42");
    assertEquals(kv.get("testCursor"), "42");
    assertEquals((db.prepare("SELECT value FROM settings WHERE key = 'settings.testCursor'").get() as { value: string }).value, "42");
  } finally {
    clean();
  }
});
