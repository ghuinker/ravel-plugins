/**
 * Dates, repeats and task-text parsing for todo. Runs in the browser and on the server.
 * Dates are "YYYY-MM-DD" strings in local time. Weeks start on Monday.
 * A repeat is "day:N", "week:N", "month:N" or "weekdays:0,1,..." (0 is Sunday).
 */

const DAY_INDEX: Record<string, number> = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTH_INDEX: Record<string, number> = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = [1, 2, 3, 4, 5];
const MAX_STEPS = 1000;
const LOOKAHEAD_DAYS = 6;

const alternatives = (names: Record<string, number>) => Object.keys(names).sort((a, b) => b.length - a.length).join("|");
const DAY = alternatives(DAY_INDEX);
const MONTH = alternatives(MONTH_INDEX);
const DAY_LIST = `(?:${DAY})(?:\\s*(?:,|&|/)\\s*(?:${DAY})|\\s+and\\s+(?:${DAY})|\\s+(?:${DAY}))*`;

const REPEAT_SOURCE = `daily|weekly|monthly|(?:every\\s+)?weekdays?|every\\s+(?:other\\s+|\\d+\\s+)?(?:day|week|month)s?|every\\s+${DAY_LIST}`;
const DATE_PREFIX = "(?:(?:before|by|due|until|on|next|this)\\s+)?";
const DATE_CORE = [
  `(?:${DAY})`,
  "today|tonight|tomorrow|tmrw|tmr",
  "in\\s+\\d+\\s+(?:day|week|month)s?",
  `(?:${MONTH})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?`,
  `\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH})`,
  "\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?",
  "\\d{4}-\\d{2}-\\d{2}",
  "(?:this\\s+)?weekend|week",
].join("|");
const DATE_SOURCE = `${DATE_PREFIX}(?:${DATE_CORE})`;
// Without a separator, only unambiguous openers count: "Sun cream" stays a task title.
const SURE_OPENER = /^(today|tonight|tomorrow|tmrw|tmr|next|this|by|before|due|on|until|in|every|daily|weekly|monthly)\b|\d/i;

// ---- dates

const pad = (number: number) => String(number).padStart(2, "0");

export function toISO(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function today(now = new Date()) {
  return toISO(now);
}

export function addDays(iso: string, count: number) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + count);
  return toISO(date);
}

export function addMonths(iso: string, count: number) {
  const date = fromISO(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return toISO(date);
}

export function weekday(iso: string) {
  return fromISO(iso).getDay();
}

function weekStart(iso: string) {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}

export function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && toISO(fromISO(value)) === value;
}

export function dayGap(from: string, to: string) {
  return Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86400000);
}

/** "Today", "Tomorrow", "Yesterday", a weekday for the coming week, else "Oct 28". */
export function dueLabel(due: string, now: string) {
  const gap = dayGap(now, due);
  if (gap === 0) return "Today";
  if (gap === 1) return "Tomorrow";
  if (gap === -1) return "Yesterday";
  if (gap > 1 && gap <= LOOKAHEAD_DAYS) return DAY_SHORT[weekday(due)];
  const date = fromISO(due);
  const year = date.getFullYear() === fromISO(now).getFullYear() ? "" : `, ${date.getFullYear()}`;
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}${year}`;
}

// ---- repeats

export function isRepeat(value: unknown): value is string {
  return value === "" || (typeof value === "string" && /^((day|week|month):[1-9]\d{0,2}|weekdays:[0-6](,[0-6]){0,6})$/.test(value));
}

function repeatFrom(text: string) {
  const words = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^daily$|^every day$/.test(words)) return "day:1";
  if (/^weekly$|^every week$/.test(words)) return "week:1";
  if (/^monthly$|^every month$/.test(words)) return "month:1";
  if (/^(every )?weekdays?$/.test(words)) return `weekdays:${WEEKDAYS}`;
  const interval = words.match(/^every (other |\d+ )?(day|week|month)s?$/);
  if (interval) return `${interval[2]}:${interval[1] ? (interval[1].trim() === "other" ? 2 : parseInt(interval[1])) : 1}`;
  const days = words.match(new RegExp(`^every (${DAY_LIST})$`));
  if (!days) return null;
  const picked = new Set([...days[1].matchAll(new RegExp(DAY, "g"))].map((match) => DAY_INDEX[match[0]]));
  return `weekdays:${[...picked].sort()}`;
}

/** "every mon and thu" gives "weekdays:1,4"; text that isn't a repeat gives null. */
export function parseRepeat(text: string) {
  const repeat = repeatFrom(text);
  return repeat !== null && isRepeat(repeat) ? repeat : null;
}

/** The text that parseRepeat turns back into the same repeat. */
export function repeatText(repeat: string) {
  if (!repeat) return "";
  const [unit, value] = repeat.split(":");
  if (unit === "weekdays") {
    return value === WEEKDAYS.join(",") ? "every weekday" : `every ${value.split(",").map((day) => DAY_SHORT[Number(day)]).join(", ")}`;
  }
  return value === "1" ? `every ${unit}` : `every ${value} ${unit}s`;
}

function stepOf(repeat: string): (iso: string) => string {
  const [unit, value] = repeat.split(":");
  if (unit === "day") return (iso) => addDays(iso, Number(value));
  if (unit === "week") return (iso) => addDays(iso, 7 * Number(value));
  if (unit === "month") return (iso) => addMonths(iso, Number(value));
  const days = value.split(",").map(Number);
  return (iso: string) => {
    let next = addDays(iso, 1);
    for (let index = 0; index < 7 && !days.includes(weekday(next)); index++) next = addDays(next, 1);
    return next;
  };
}

/** The first occurrence strictly after both the current due date and today. */
export function nextDue(repeat: string, due: string, now: string) {
  const step = stepOf(repeat);
  let next = step(due || now);
  for (let count = 0; count < MAX_STEPS && next <= now; count++) next = step(next);
  return next;
}

/** Where a new repeating task starts: today, or the first matching weekday from today. */
export function firstDue(repeat: string, now: string) {
  const [unit, value] = repeat.split(":");
  return unit === "weekdays" && !value.split(",").map(Number).includes(weekday(now)) ? stepOf(repeat)(now) : now;
}

// ---- natural dates

function monthDay(text: string, now: string) {
  const named = text.match(new RegExp(`^(?:(${MONTH})\\.?\\s+(\\d{1,2})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH}))`));
  const numeric = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  let month: number, day: number, year: number | null = null;
  if (named) {
    month = MONTH_INDEX[named[1] ?? named[4]];
    day = Number(named[2] ?? named[3]);
  } else if (numeric) {
    month = Number(numeric[1]) - 1;
    day = Number(numeric[2]);
    if (numeric[3]) year = Number(numeric[3]) + (numeric[3].length === 2 ? 2000 : 0);
  } else return null;
  const thisYear = fromISO(now).getFullYear();
  const make = (yearNumber: number) => {
    const date = new Date(yearNumber, month, day, 12);
    return date.getMonth() === month && date.getDate() === day ? toISO(date) : null;
  };
  if (year !== null) return make(year);
  const date = make(thisYear);
  return date !== null && date < now ? make(thisYear + 1) : date;
}

function resolveCore(core: string, upcoming: boolean, now: string) {
  const name = core.match(new RegExp(`^(${DAY})$`));
  if (name) {
    const index = DAY_INDEX[name[1]];
    if (upcoming) return addDays(weekStart(now), 7 + ((index + 6) % 7));
    return addDays(now, (index - weekday(now) + 7) % 7);
  }
  if (/^(today|tonight)$/.test(core)) return now;
  if (/^(tomorrow|tmrw|tmr)$/.test(core)) return addDays(now, 1);
  const relative = core.match(/^in (\d+) (day|week|month)s?$/);
  if (relative) {
    const count = Number(relative[1]);
    return relative[2] === "month" ? addMonths(now, count) : addDays(now, count * (relative[2] === "week" ? 7 : 1));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(core)) return isDate(core) ? core : null;
  if (/weekend$/.test(core)) return addDays(now, (6 - weekday(now) + 7) % 7);
  if (core === "week") return upcoming ? addDays(weekStart(now), 7) : null;
  return monthDay(core, now);
}

/** "before monday" gives { due, soft: true }: soft means "by then", not "on that day". */
export function parseDate(text: string, now: string) {
  const words = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(this week|(by )?(the )?end of (the |this )?week)$/.test(words)) return { due: addDays(weekStart(now), 6), soft: true };
  const prefixed = words.match(/^(before|by|due|until|on|next|this) (.+)$/);
  const prefix = prefixed?.[1] ?? "";
  const due = resolveCore(prefixed ? prefixed[2] : words, prefix === "next", now);
  if (due === null) return null;
  return { due, soft: ["before", "by", "due", "until"].includes(prefix) };
}

// ---- task text

/** Cuts a phrase matching `source` off the end of the text, or off the start when it's unambiguous. */
function cutPhrase(text: string, source: string) {
  const end = text.match(new RegExp(`^(.*?)(?:^|\\s)(${source})[\\s.,;]*$`, "i"));
  if (end && end[1].trim()) return { phrase: end[2], rest: end[1].trim() };
  const start = text.match(new RegExp(`^\\s*(${source})\\s*([:,-]?)\\s+(?=\\S)(.*)$`, "i"));
  if (start && (start[2] || SURE_OPENER.test(start[1]))) return { phrase: start[1], rest: start[3].trim() };
  return null;
}

/** Returns the title without the phrase, plus whatever the phrase said. Unparsed text is left alone. */
export function parseTask(text: string, now: string) {
  let rest = text.trim();
  let priority: number | null = null;
  if (/(^|\s)!+(?=\s|$)/.test(rest)) {
    priority = 2;
    rest = rest.replace(/(^|\s)!+(?=\s|$)/g, " ").trim();
  }
  let repeat = "";
  const repeating = cutPhrase(rest, REPEAT_SOURCE);
  const parsedRepeat = repeating && parseRepeat(repeating.phrase);
  if (repeating && parsedRepeat) {
    repeat = parsedRepeat;
    rest = repeating.rest;
  }
  let due = "";
  let soft = false;
  const dated = cutPhrase(rest, DATE_SOURCE);
  const parsed = dated && parseDate(dated.phrase, now);
  if (parsed) {
    ({ due, soft } = parsed);
    rest = dated.rest;
  }
  if (repeat && !due) due = firstDue(repeat, now);
  return { body: rest.replace(/\s+/g, " ").replace(/[\s:,-]+$/, ""), due, soft, repeat, priority };
}
