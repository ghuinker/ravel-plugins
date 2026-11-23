import assert from "node:assert/strict";

// The design-system Rules a grep can check, over every app's .ts files.
const APPS = new URL("../", import.meta.url);
const COLORS = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const UTIL = "bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow|accent|caret|decoration|placeholder";
const CHECKS: [string, RegExp][] = [
  ["Tailwind colour class (use t-*)", new RegExp(`(?<=^|[\\s"'\`:])(?:${UTIL})-(?:${COLORS})(?:-\\d+)?(?:/\\d+)?(?=[\\s"'\`]|$)`, "gm")],
  ["hard-coded corner (use the --radius-* variables)", /(?<=^|[\s"'`:])rounded(?:-[tblrse]{1,2})?-(?:none|sm|md|lg|xl|2xl|3xl)(?=[\s"'`]|$)/gm],
  ["divide-y lines (use list())", /(?<=^|[\s"'`:])divide-[xy](?=[\s"'`]|$)/gm],
  ["cursor-pointer (base.css already sets it)", /(?<=^|[\s"'`:])cursor-pointer(?=[\s"'`]|$)/gm],
];
// Visitor pages have their own look and don't follow the site's theme.
const EXEMPT = ["site/", "contact/"];
// Files that broke a rule before it was checked, with how many hits each had. Lower a number when you fix some; never raise one.
const BASELINE: Record<string, number> = JSON.parse(await Deno.readTextFile(new URL("./rules.baseline.json", import.meta.url)));

async function* files(dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(new URL(dir, APPS))) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory) yield* files(`${path}/`);
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) yield path;
  }
}

async function hits() {
  const found: Record<string, string[]> = {};
  for await (const file of files("")) {
    if (EXEMPT.some((dir) => file.startsWith(dir))) continue;
    const text = await Deno.readTextFile(new URL(file, APPS));
    for (const [rule, pattern] of CHECKS) {
      for (const match of text.matchAll(pattern)) (found[file] ??= []).push(`${rule}: ${match[0]}`);
    }
  }
  return found;
}

Deno.test("apps follow the design-system rules", async () => {
  const over = Object.entries(await hits())
    .filter(([file, list]) => list.length > (BASELINE[file] ?? 0))
    .map(([file, list]) => `${file} (${list.length}, allowed ${BASELINE[file] ?? 0}):\n  ${[...new Set(list)].join("\n  ")}`);
  assert.equal(over.length, 0, `See Rules in apps/design-system/README.md.\n${over.join("\n")}`);
});
