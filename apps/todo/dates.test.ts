import assert from "node:assert/strict";
import { dueLabel, firstDue, nextDue, parseDate, parseRepeat, parseTask, repeatText } from "./dates.ts";

const WED = "2026-10-21";

Deno.test("weekdays, relative words and month names become dates", () => {
  assert.deepEqual(parseDate("Wed", WED), { due: WED, soft: false });
  assert.deepEqual(parseDate("fri", WED), { due: "2026-10-23", soft: false });
  assert.deepEqual(parseDate("next fri", WED), { due: "2026-10-30", soft: false });
  assert.deepEqual(parseDate("tomorrow", WED), { due: "2026-10-22", soft: false });
  assert.deepEqual(parseDate("in 2 weeks", WED), { due: "2026-11-04", soft: false });
  assert.deepEqual(parseDate("Oct 28", WED), { due: "2026-10-28", soft: false });
  assert.deepEqual(parseDate("Oct 2", WED), { due: "2027-10-02", soft: false });
  assert.deepEqual(parseDate("before Monday", WED), { due: "2026-10-26", soft: true });
  assert.equal(parseDate("someday soon", WED), null);
});

Deno.test("parseTask pulls a date, a repeat or a priority off the text", () => {
  assert.deepEqual(parseTask("Build X Wed", WED), { body: "Build X", due: WED, soft: false, repeat: "", priority: null });
  assert.deepEqual(parseTask("Plan date before Monday", WED), { body: "Plan date", due: "2026-10-26", soft: true, repeat: "", priority: null });
  assert.deepEqual(parseTask("Tomorrow: call mom !", WED), { body: "call mom", due: "2026-10-22", soft: false, repeat: "", priority: 2 });
  assert.deepEqual(parseTask("Water plants every Mon and Thu", WED), { body: "Water plants", due: "2026-10-22", soft: false, repeat: "weekdays:1,4", priority: null });
});

Deno.test("parseTask leaves ordinary titles alone", () => {
  for (const title of ["buy groceries", "Sun cream", "Read chapter 12", "Mon", "Book the sat tutor"]) {
    assert.deepEqual(parseTask(title, WED), { body: title, due: "", soft: false, repeat: "", priority: null }, title);
  }
});

Deno.test("repeats parse, print back, and move to the next date after today", () => {
  assert.equal(parseRepeat("every 2 weeks"), "week:2");
  assert.equal(parseRepeat("every weekday"), "weekdays:1,2,3,4,5");
  assert.equal(parseRepeat("lunch"), null);
  for (const repeat of ["day:1", "week:2", "month:1", "weekdays:1,4", "weekdays:1,2,3,4,5"]) assert.equal(parseRepeat(repeatText(repeat)), repeat);
  assert.equal(nextDue("day:1", WED, WED), "2026-10-22");
  assert.equal(nextDue("weekdays:1,4", WED, WED), "2026-10-22");
  assert.equal(nextDue("week:1", "2026-10-05", WED), "2026-10-26");
  assert.equal(nextDue("month:1", "2026-01-31", "2026-01-31"), "2026-02-28");
  assert.equal(firstDue("weekdays:1", WED), "2026-10-26");
});

Deno.test("due labels are short", () => {
  assert.equal(dueLabel(WED, WED), "Today");
  assert.equal(dueLabel("2026-10-24", WED), "Sat");
  assert.equal(dueLabel("2026-12-01", WED), "Dec 1");
});

Deno.test("this week is the coming Sunday, soft", () => {
  assert.deepEqual(parseDate("this week", WED), { due: "2026-10-25", soft: true });
});
