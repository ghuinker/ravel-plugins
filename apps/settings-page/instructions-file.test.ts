import { assertEquals } from "jsr:@std/assert";
import { writeInstructions } from "./instructions-file.ts";

Deno.test("empty or oversize text is refused before touching the file", () => {
  assertEquals(writeInstructions("   "), false);
  assertEquals(writeInstructions("x".repeat(60_001)), false);
});
