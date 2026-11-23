import { assertEquals } from "jsr:@std/assert";
import { deleteMemory, isMemoryFile, listMemories, memoryDir, parseMemory, saveMemory, validMemoryText, withoutIndexLine } from "./memory-files.ts";

const SAMPLE = "---\nname: dogs\ndescription: Has a dog\nmetadata:\n  type: user\n---\n\nLikes dogs.\n";

Deno.test("memory dir mirrors the space path", () => {
  assertEquals(memoryDir("/app/ravel/users/abc/space/"), "/app/ravel/users/abc/claude/projects/-app-ravel-users-abc-space/memory");
});

Deno.test("parses frontmatter", () => {
  const memory = parseMemory("dogs.md", SAMPLE);
  assertEquals([memory.name, memory.description, memory.type], ["dogs", "Has a dog", "user"]);
});

Deno.test("file names are checked", () => {
  assertEquals(isMemoryFile("dogs.md"), true);
  assertEquals(isMemoryFile("MEMORY.md"), false);
  assertEquals(isMemoryFile("../x.md"), false);
  assertEquals(validMemoryText("no frontmatter"), false);
});

Deno.test("removes the index line", () => {
  assertEquals(withoutIndexLine("- [A](a.md) — x\n- [B](b.md) — y", "a.md"), "- [B](b.md) — y");
});

// Needs a temp dir; the test profile only grants read, so it is skipped there.
const canWrite = Deno.permissions.querySync({ name: "write" }).state === "granted";

Deno.test({ name: "save, list and delete", ignore: !canWrite, fn: () => {
  const dir = Deno.makeTempDirSync();
  Deno.writeTextFileSync(`${dir}/MEMORY.md`, "- [Dogs](dogs.md) — dogs\n");
  assertEquals(saveMemory("dogs.md", SAMPLE, dir), true);
  assertEquals(saveMemory("../evil.md", SAMPLE, dir), false);
  assertEquals(listMemories(dir)?.map((memory) => memory.file), ["dogs.md"]);
  assertEquals(deleteMemory("dogs.md", dir), true);
  assertEquals(listMemories(dir), []);
  assertEquals(Deno.readTextFileSync(`${dir}/MEMORY.md`), "");
} });
