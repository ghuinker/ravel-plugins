import { html, raw } from "@ravel/html.ts";
import { clientScript } from "@ravel/client.ts";
import type { WorkingState } from "@ravel/chat.ts";
import { thread } from "@app/design-system/api.ts";

// The working line is the /branding "Thinking" demo: a 56×28 thread loader whose shape follows the work, then the status.
// Styles are inline and the loader is inlined because the iOS app shows this in a bare web view with no site CSS or login.
const EDIT_TOOLS = ["Edit", "MultiEdit", "Write", "NotebookEdit"];
const loaderScript = () => clientScript(import.meta.resolve("./loader.client.ts"), {}, { always: true });

export function loaderKind({ tool, waiting }: Pick<WorkingState, "tool" | "waiting">): string {
  if (waiting) return "wave";
  if (!tool) return "knot";
  if (tool.name.startsWith("Web")) return "braid";
  if (EDIT_TOOLS.includes(tool.name)) return "unravel";
  return "orbit";
}

async function threadAttrs(): Promise<string> {
  const { colors, light } = await thread();
  return ` data-colors="${colors.join(",")}" data-blend="${light ? "source-over" : "lighter"}"`;
}

export const working = async (state: WorkingState) => html`
  <span style="display:inline-flex;align-items:center;gap:.625rem">
    <span style="display:inline-flex;flex:none;width:56px;min-height:28px;align-items:center;justify-content:center;color:var(--accent,#8b7bff)">
      ${raw(`<canvas data-ravel-loader="${loaderKind(state)}" data-key="chat"${await threadAttrs()} style="display:block;width:56px;height:28px"></canvas>`)}
    </span>
    <span style="font-size:.875rem;font-style:italic;color:var(--muted,inherit)">${state.status}</span>
  </span>
  ${await loaderScript()}`;
