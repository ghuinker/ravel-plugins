// CLAUDE.md at the root of the space, with one backup of the text it had before the last save.
export const INSTRUCTIONS_FILE = "CLAUDE.md";
const MAX_CHARS = 60_000;

const root = new URL("../../", import.meta.url);
const file = new URL(INSTRUCTIONS_FILE, root);
const backup = new URL("private/claude-md.previous", root);

export const readInstructions = () => Deno.readTextFileSync(file);

export const backupInstructions = (): string | undefined => {
  try {
    return Deno.readTextFileSync(backup);
  } catch {
    return undefined;
  }
};

export function writeInstructions(text: string): boolean {
  if (!text.trim() || text.length > MAX_CHARS) return false;
  Deno.mkdirSync(new URL("private/", root), { recursive: true });
  Deno.writeTextFileSync(backup, readInstructions());
  Deno.writeTextFileSync(file, text.endsWith("\n") ? text : `${text}\n`);
  return true;
}

export function restoreInstructions(): boolean {
  const previous = backupInstructions();
  if (previous === undefined) return false;
  Deno.writeTextFileSync(backup, readInstructions());
  Deno.writeTextFileSync(file, previous);
  return true;
}
