import type { JobCtx } from "@ravel/types.ts";
import { isMemoryFile, validMemoryText } from "./memory-files.ts";

export type MemoryChange = { file: string; kind: "save" | "forget"; text?: string };

// The site itself can't write to Claude's memory folder, but a Claude run started by a job can.
const prompt = ({ file, kind, text }: MemoryChange) =>
  kind === "forget"
    ? `Forget the memory file ${file}: delete it from your memory folder and remove its line from MEMORY.md. Reply with one short sentence.`
    : `Replace the memory file ${file} in your memory folder with exactly the text between the markers below, and keep its line in MEMORY.md in step with its name and description. Reply with one short sentence.\n\n<<<TEXT\n${text}\nTEXT>>>`;

export default async function (ctx: JobCtx, change: MemoryChange) {
  if (!isMemoryFile(change.file)) throw new Error("bad memory file name");
  if (change.kind === "save" && !validMemoryText(change.text ?? "")) throw new Error("memory text must start with frontmatter");
  ctx.progress(null, change.kind === "forget" ? "Forgetting…" : "Saving…");
  return (await ctx.agent(prompt(change), { model: "haiku", labels: ["system"] })).text;
}
