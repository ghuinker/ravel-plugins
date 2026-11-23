import { html, raw } from "@ravel/html.ts";
import { icon } from "@ravel/icons.ts";
import type { Ctx } from "@ravel/types.ts";
import {
  chips, disclosure, fieldInput, fieldRow, heatmap, kebab, linkRow, list, renderMarkdown, section, segmented, stepper, tileMaker, stats, lines, numberOverChart, chartOnly, oneOpen,
} from "@app/design-system/api.ts";

// A full page (/design-system) showing every design-system piece in the current theme and mode. Reached from Settings → Appearance.
const SWATCHES: [string, string][] = [
  ["--bg", "Background"], ["--card", "Card"], ["--nav", "Nav"], ["--input", "Input"], ["--chip", "Chip"], ["--border", "Border"],
  ["--ink", "Ink"], ["--muted", "Muted"], ["--accent", "Accent"], ["--accent-hi", "Accent hi"], ["--active", "Active"], ["--accent-ink", "Accent ink"],
];

const swatch = ([variable, name]: [string, string]) => html`<div class="space-y-1">
  <div class="h-12 rounded-[var(--radius-field)] border t-border" style="background: var(${raw(variable)})"></div>
  <div class="text-xs font-medium">${name}</div><div class="text-xs t-muted">${variable}</div></div>`;

const bars = html`<svg viewBox="0 0 200 60" class="h-full w-full" preserveAspectRatio="none" aria-hidden="true">${[12, 28, 20, 40, 34, 52, 44].map((h, i) => html`<rect x="${i * 28 + 4}" y="${60 - h}" width="18" height="${h}" rx="4" fill="currentColor" opacity=".7"/>`)}</svg>`;

export default (ctx: Ctx) => {
  const tile = tileMaker();
  const cells = Array.from({ length: 70 }, (_, i) => ({ shade: ((i * 37) % 11) / 10, title: `Day ${i + 1}` }));
  const open = oneOpen("dsOpen", "a");
  return html`
  <section class="mx-auto max-w-5xl px-1 pt-6 md:px-0" data-signals="${JSON.stringify({ dsSwitch: true, dsCount: 3, dsPick: "b", dsOpen: "", dsText: "Hello" })}">
    <div class="t-stagger space-y-8 pb-24">
      <header class="space-y-2">
        <a href="/settings/theme" data-on:click="ravel.haptic('tap')" class="inline-flex items-center gap-1 text-sm t-accent"><span class="text-xl leading-none">‹</span> Settings</a>
        <h1 class="text-3xl font-bold">Design System</h1>
        <p class="t-muted">Every colour, shape and component the site is built from, drawn in the current theme and mode.</p>
      </header>

      ${section("Colours", html`<div class="t-group grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">${SWATCHES.map(swatch)}</div>`)}

      ${section("Type", html`<div class="t-group space-y-2 p-4">
        <div class="text-3xl font-bold">Large title</div><div class="t-title">Section title</div>
        <div class="font-medium">Body medium</div><div>Body text with <span class="t-accent">accent</span> and <span class="t-muted">muted</span> text.</div>
        <div class="text-sm t-muted">Small muted note</div>
        <div class="text-[11px] font-semibold uppercase tracking-widest t-accent">Eyebrow label</div></div>`)}

      ${section("Shapes", html`<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="t-group grid h-20 place-items-center text-sm">t-group</div>
        <div class="t-widget grid h-20 place-items-center text-sm">t-widget</div>
        <div class="t-field t-input grid h-20 place-items-center border text-sm">t-field</div>
        <div class="t-pill t-chip grid h-20 place-items-center border text-sm">t-pill</div></div>`)}

      ${section("Pills and chips", html`<div class="t-group space-y-4 p-4">
        <div class="flex flex-wrap gap-2"><span class="t-pill t-chip px-3 py-1 text-sm">Chip</span><span class="t-pill t-accent-bg px-3 py-1 text-sm">Accent</span><span class="t-pill t-accent-tint px-3 py-1 text-sm">Tint</span><span class="t-pill t-active px-3 py-1 text-sm">Active</span></div>
        ${chips([{ label: "Day", on: "$dsPick === 'a'", click: "$dsPick = 'a'" }, { label: "Week", on: "$dsPick === 'b'", click: "$dsPick = 'b'" }, { label: "Month", on: "$dsPick === 'c'", click: "$dsPick = 'c'" }], "Pick one")}
        <div class="flex flex-wrap gap-2"><button type="button" class="t-accent-grad rounded-full px-4 py-2 font-semibold">Primary</button><button type="button" class="t-chip t-pill border px-4 py-2 font-medium">Secondary</button></div></div>`)}

      ${section("Segmented tabs", segmented([{ href: "/design-system", label: "Overview" }, { href: "/design-system#a", label: "Goals" }, { href: "/design-system#b", label: "Habits" }], "/design-system"))}

      ${section("Lists", list([
        linkRow({ href: "/settings", label: "Link row", note: "Opens a page", icon: icon("cog-6-tooth", "size-5"), chevron: true }),
        linkRow({ href: "/settings", label: "With a value", icon: icon("bell", "size-5"), value: "On", chevron: true }),
        linkRow({ href: "/settings", label: "Flat, no icon", chevron: true }),
      ]))}
      ${section("Lined list", list([
        fieldRow("Switch", html`<input type="checkbox" class="t-switch" data-bind="dsSwitch" />`),
        fieldRow("Stepper", stepper("dsCount", 0, 7, "days"), { tag: "div" }),
        fieldRow("Text field", html`<input class="${fieldInput}" data-bind="dsText" />`),
      ], { lined: true }))}
      ${section("Disclosure", list([
        disclosure({ ...open, icon: "flag", title: "Slides open", note: "A grouped setting", value: "'3 days'", body: html`<div class="px-4 pb-3 t-muted">Fields and rows appear here.</div>` }),
        disclosure({ ...oneOpen("dsOpen", "b"), icon: "fire", title: "Another one", body: html`<div class="px-4 pb-3 t-muted">Only one is open at a time.</div>` }),
      ], { lined: true, inset: "3.75rem" }))}

      ${section("Menu", html`<div class="t-group flex items-center gap-3 px-4 py-3"><span class="flex-1 font-medium">Item with a ⋮ menu</span>${kebab("ds-demo", [{ label: "Ask AI", icon: "sparkles", run: "ravel.haptic('tap')" }, { rule: true }, { label: "Delete", icon: "trash", run: "ravel.haptic('warning')", danger: true }])}</div>`)}

      ${section("Bento tiles", html`<div class="bn-grid" style="grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-areas: 'a a b c' 'a a d d' 'a a d d';">
        ${tile("a", { title: "Hero", tone: "accent", count: "12" }, numberOverChart(html`42`, "this week", chartOnly(bars)))}
        ${tile("b", { title: "Tint", tone: "tint", hue: 150 }, stats([{ label: "Streak", big: html`9` }]))}
        ${tile("c", { title: "Invert", tone: "invert" }, stats([{ label: "Best", big: html`21` }]))}
        ${tile("d", { title: "Plain", count: "3" }, lines([{ label: "Run", value: "5 km" }, { label: "Lift", value: "45 min" }, { label: "Walk", value: "3 km" }]))}
      </div>`)}

      ${section("Calendar heatmap", html`<div class="t-group p-4">${heatmap({ cells, label: "Demo heatmap" })}</div>`)}

      ${section("Markdown", html`<div class="t-group md p-4">${raw(renderMarkdown("## Heading\n\nSome **bold**, *italic* and `code`.\n\n- [x] A checklist item\n- [ ] Another\n\n> A quote"))}</div>`)}

      ${section("Loading", html`<div class="t-group space-y-2 p-4"><div class="t-skeleton h-4 w-2/3 rounded-full"></div><div class="t-skeleton h-4 w-1/2 rounded-full"></div></div>`)}
    </div>
  </section>`;
};
