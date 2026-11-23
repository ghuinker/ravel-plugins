import { assertEquals } from "jsr:@std/assert";
import { validUsername } from "./username.ts";

Deno.test("username rules", () => {
  assertEquals(validUsername("sam-h"), true);
  assertEquals(validUsername("-sam"), false);
  assertEquals(validUsername("Sam"), false);
  assertEquals(validUsername("a--b"), false);
  assertEquals(validUsername(""), false);
  assertEquals(validUsername("a".repeat(31)), false);
});
