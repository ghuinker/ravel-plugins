import assert from "node:assert/strict";
import { db } from "@ravel/db.ts";
import { describeJob, enabledJobs, jobEnabled, listJobs } from "./jobs.ts";

Deno.test("a job's description is its first-line comment", () => {
  assert.equal(describeJob("// Tidy up.\nexport default () => {}"), "Tidy up.");
  assert.equal(describeJob("export default () => {}"), "");
});

Deno.test("every app's jobs are listed with their app and description", async () => {
  const sweep = (await listJobs()).find((job) => job.name === "tag-sweep");
  assert.equal(sweep?.app, "tags");
  assert.equal(sweep?.path, "apps/tags/sweep");
  assert.ok(sweep?.description);
});

Deno.test("a switched-off job is left out of enabledJobs", () => {
  db.exec("DELETE FROM settings WHERE key LIKE 'settings.job-off.%'");
  try {
    db.exec("INSERT INTO settings (key, value) VALUES ('settings.job-off.b', '1')");
    assert.equal(jobEnabled("a"), true);
    assert.equal(jobEnabled("b"), false);
    assert.deepEqual(enabledJobs({ a: "./a", b: "./b" }), { a: "./a" });
  } finally {
    db.exec("DELETE FROM settings WHERE key LIKE 'settings.job-off.%'");
  }
});
