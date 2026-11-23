// Claude's memory: one markdown file per fact (frontmatter + body) next to a MEMORY.md index, in the space's
// project folder under `claude/projects/`.
export type Memory = { file: string; name: string; description: string; type: string; text: string };

const INDEX = "MEMORY.md";
const FILE_PATTERN = /^[a-z0-9][a-z0-9-]*\.md$/;
const MAX_BYTES = 20_000;

export const memoryDir = (spaceDir = new URL("../../", import.meta.url).pathname) => {
  const space = spaceDir.replace(/\/$/, "");
  const home = space.replace(/\/space$/, "");
  return `${home}/claude/projects/${space.replaceAll("/", "-")}/memory`;
};

export const isMemoryFile = (file: string) => FILE_PATTERN.test(file) && file !== INDEX;

export function parseMemory(file: string, text: string): Memory {
  const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (key: string) => front.match(new RegExp(`^\\s*${key}:\\s*(.*)$`, "m"))?.[1].trim().replace(/^(["'])(.*)\1$/, "$2") ?? "";
  return { file, name: field("name") || file.replace(/\.md$/, ""), description: field("description"), type: field("type") || "memory", text };
}

export const validMemoryText = (text: string) => text.startsWith("---\n") && text.length <= MAX_BYTES;

export const withoutIndexLine = (index: string, file: string) =>
  index.split("\n").filter((line) => !line.includes(`(${file})`)).join("\n");

export function listMemories(dir = memoryDir()): Memory[] | undefined {
  try {
    return [...Deno.readDirSync(dir)]
      .filter((entry) => entry.isFile && isMemoryFile(entry.name))
      .map((entry) => parseMemory(entry.name, Deno.readTextFileSync(`${dir}/${entry.name}`)))
      .sort((first, second) => first.type.localeCompare(second.type) || first.name.localeCompare(second.name));
  } catch {
    return undefined;
  }
}

export function saveMemory(file: string, text: string, dir = memoryDir()): boolean {
  if (!isMemoryFile(file) || !validMemoryText(text)) return false;
  Deno.writeTextFileSync(`${dir}/${file}`, text.endsWith("\n") ? text : `${text}\n`);
  return true;
}

export function deleteMemory(file: string, dir = memoryDir()): boolean {
  if (!isMemoryFile(file)) return false;
  try {
    Deno.removeSync(`${dir}/${file}`);
    const index = `${dir}/${INDEX}`;
    Deno.writeTextFileSync(index, withoutIndexLine(Deno.readTextFileSync(index), file));
  } catch {
    return false;
  }
  return true;
}
