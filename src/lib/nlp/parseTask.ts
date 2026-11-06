import { addDays, format, nextDay, startOfDay } from "date-fns";
import type { Day } from "date-fns";

import type { Priority } from "../../types/models";

export interface ParsedTask {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  tags: string[];
  projectName: string | null;
}

const PRIORITY_WORDS: Record<string, Priority> = {
  high: "high",
  medium: "medium",
  med: "medium",
  low: "low",
  none: "none",
};

const PRIORITY_CODES: Record<string, Priority> = {
  "1": "high",
  "2": "medium",
  "3": "low",
  "4": "none",
};

// Canonical weekday names indexed 0=Sun … 6=Sat, matching date-fns Day type.
const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

// All recognised aliases → canonical name
const WEEKDAY_ALIASES: Record<string, (typeof WEEKDAY_NAMES)[number]> = {
  sun: "sunday",
  sunday: "sunday",
  mon: "monday",
  monday: "monday",
  tue: "tuesday",
  tues: "tuesday",
  tuesday: "tuesday",
  wed: "wednesday",
  weds: "wednesday",
  wednesday: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  thursday: "thursday",
  fri: "friday",
  friday: "friday",
  sat: "saturday",
  saturday: "saturday",
};

/** Index 0-6 for a canonical weekday name (Sun=0…Sat=6). */
function weekdayIndex(name: (typeof WEEKDAY_NAMES)[number]): Day {
  return WEEKDAY_NAMES.indexOf(name) as Day;
}

/** Next occurrence of `target` weekday at or after `from`. */
function nextWeekday(from: Date, target: Day): Date {
  if (from.getDay() === target) return from; // today is that day
  return nextDay(from, target);
}

/** Next occurrence of `target` weekday strictly after today. */
function strictNextWeekday(from: Date, target: Day): Date {
  if (from.getDay() === target) return addDays(from, 7); // next week's occurrence
  return nextDay(from, target);
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MONTH_PATTERN = "sept|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const DAY_MONTH = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(${MONTH_PATTERN})\\b(?:\\s+(\\d{4}))?`,
  "i"
);
const MONTH_DAY = new RegExp(
  `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?`,
  "i"
);

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function monthDate(
  day: number,
  monthWord: string,
  year: number | undefined,
  today: Date
): string | null {
  const month = MONTHS[monthWord.toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;

  let d = new Date(year ?? today.getFullYear(), month, day);
  if (d.getMonth() !== month) return null;
  if (year === undefined && d < startOfDay(today)) {
    d = new Date(today.getFullYear() + 1, month, day);
  }
  return iso(d);
}

// ─── Recurrence tokens ──────────────────────────────────────────────────────
// These are stripped from the title but currently only stored as metadata.
// A future `recur_rule` column can consume them directly.
const RECUR_TOKENS: Array<[RegExp, string]> = [
  [/\beveryday\b/i, "daily"],
  [/\bevery\s+day\b/i, "daily"],
  [/\bdaily\b/i, "daily"],
  [/\bevery\s+weekday\b/i, "weekdays"],
  [/\bweekdays\b/i, "weekdays"],
  [/\bevery\s+weekend\b/i, "weekends"],
  [/\bweekends\b/i, "weekends"],
  [/\bweekly\b/i, "weekly"],
  [/\beverywee?k\b/i, "weekly"],
  [/\bmonthly\b/i, "monthly"],
  ...Object.entries(WEEKDAY_ALIASES).map(
    ([alias, canonical]) =>
      [new RegExp(`\\bevery\\s+${alias}\\b`, "i"), `every-${canonical.slice(0, 3)}`] as [RegExp, string]
  ),
];

function extractRecur(text: string): { recur: string | null; rest: string } {
  for (const [re, rule] of RECUR_TOKENS) {
    const m = text.match(re);
    if (m) {
      return { recur: rule, rest: text.replace(m[0], " ") };
    }
  }
  return { recur: null, rest: text };
}

// ─── Single-date extraction ──────────────────────────────────────────────────
function extractDate(
  text: string,
  today: Date
): { date: string | null; rest: string } {
  // ISO literal
  const exact = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (exact) return { date: exact[1], rest: text.replace(exact[0], " ") };

  // today / tomorrow
  const relative = text.match(/\b(today|tomorrow|tmrw|tmr)\b/i);
  if (relative) {
    const offset = relative[1].toLowerCase() === "today" ? 0 : 1;
    return {
      date: iso(addDays(today, offset)),
      rest: text.replace(relative[0], " "),
    };
  }

  // "in N days / weeks"
  const inN = text.match(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/i);
  if (inN) {
    const days =
      Number(inN[1]) * (inN[2].toLowerCase().startsWith("week") ? 7 : 1);
    return { date: iso(addDays(today, days)), rest: text.replace(inN[0], " ") };
  }

  // "next week"
  const nextWeek = text.match(/\bnext\s+week\b/i);
  if (nextWeek)
    return {
      date: iso(addDays(today, 7)),
      rest: text.replace(nextWeek[0], " "),
    };

  // "this weekend" → coming Saturday
  const thisWeekend = text.match(/\bthis\s+weekend\b/i);
  if (thisWeekend) {
    const sat = nextWeekday(today, 6 as Day);
    return { date: iso(sat), rest: text.replace(thisWeekend[0], " ") };
  }

  // "next weekend" → Saturday of next week
  const nextWeekend = text.match(/\bnext\s+weekend\b/i);
  if (nextWeekend) {
    const sat = strictNextWeekday(today, 6 as Day);
    return { date: iso(sat), rest: text.replace(nextWeekend[0], " ") };
  }

  // "this weekday" / "next weekday" → next Mon-Fri
  const weekdayToken = text.match(/\b(?:this|next)\s+weekday\b/i);
  if (weekdayToken) {
    // Find the next Mon-Fri
    let d = addDays(today, 1);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
    return { date: iso(d), rest: text.replace(weekdayToken[0], " ") };
  }

  // Named weekday: "(on|next|this) <day>" or bare "<day>" at boundary
  //   "next wed", "on friday", "this sat", "monday"
  const ALIAS_PATTERN = Object.keys(WEEKDAY_ALIASES).join("|");
  const weekdayRe = new RegExp(
    `\\b(?:(on|next|this)\\s+)?(${ALIAS_PATTERN})\\b`,
    "i"
  );
  const weekday = text.match(weekdayRe);
  if (weekday) {
    const marker = (weekday[1] ?? "").toLowerCase();
    const canonical = WEEKDAY_ALIASES[weekday[2].toLowerCase()];
    const target = weekdayIndex(canonical);
    let date: Date;
    if (marker === "next") {
      date = strictNextWeekday(today, target);
    } else if (marker === "this") {
      date = nextWeekday(today, target);
    } else {
      // bare weekday name or "on X" → next occurrence (today counts)
      date = nextWeekday(today, target);
    }
    return { date: iso(date), rest: text.replace(weekday[0], " ") };
  }

  // "15 jan", "jan 15", "jan 15 2027"
  const dayMonth = text.match(DAY_MONTH);
  if (dayMonth) {
    const date = monthDate(
      Number(dayMonth[1]),
      dayMonth[2],
      dayMonth[3] ? Number(dayMonth[3]) : undefined,
      today
    );
    if (date) return { date, rest: text.replace(dayMonth[0], " ") };
  }

  const monthDay = text.match(MONTH_DAY);
  if (monthDay) {
    const date = monthDate(
      Number(monthDay[2]),
      monthDay[1],
      monthDay[3] ? Number(monthDay[3]) : undefined,
      today
    );
    if (date) return { date, rest: text.replace(monthDay[0], " ") };
  }

  return { date: null, rest: text };
}

function extractTime(text: string): { time: string | null; rest: string } {
  const twelve = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (twelve && Number(twelve[1]) >= 1 && Number(twelve[1]) <= 12) {
    let hour = Number(twelve[1]);
    const meridiem = twelve[3].toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    const minutes = twelve[2] ?? "00";
    return {
      time: `${String(hour).padStart(2, "0")}:${minutes}`,
      rest: text.replace(twelve[0], " "),
    };
  }

  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    return {
      time: `${twentyFour[1].padStart(2, "0")}:${twentyFour[2]}`,
      rest: text.replace(twentyFour[0], " "),
    };
  }

  return { time: null, rest: text };
}

export function parseTask(
  raw: string,
  today: Date = new Date()
): ParsedTask & { recurRule: string | null } {
  const quoted: string[] = [];
  let text = raw.replace(/"([^"]+)"/g, (_, inner: string) => {
    quoted.push(inner);
    return ` __q${quoted.length - 1}__ `;
  });

  const tags: string[] = [];
  let projectName: string | null = null;
  let priority: Priority = "none";

  text = text.replace(/(^|\s)@([\w-]+)/g, (_, space: string, tag: string) => {
    tags.push(tag.toLowerCase());
    return space;
  });

  text = text.replace(/(^|\s)#([\w-]+)/g, (_, space: string, name: string) => {
    projectName = name;
    return space;
  });

  text = text.replace(/(^|\s)!(high|medium|med|low|none)\b/gi, (_, space: string, word: string) => {
    priority = PRIORITY_WORDS[word.toLowerCase()];
    return space;
  });

  text = text.replace(/(^|\s)p([1-4])(?=\s|$)/gi, (_, space: string, code: string) => {
    priority = PRIORITY_CODES[code];
    return space;
  });

  // Extract recurrence first (before date, to avoid "every friday" matching as date)
  const recurResult = extractRecur(text);
  const recurRule = recurResult.recur;
  text = recurResult.rest;

  const dateResult = extractDate(text, today);
  const timeResult = extractTime(dateResult.rest);
  const dueTime = timeResult.time;
  let dueDate = dateResult.date;

  // If a time was parsed but no date, default to today
  if (dueTime && !dueDate) dueDate = iso(today);

  // If a recurrence was detected but no due date, default to today as first
  // occurrence so the task appears in the right section.
  if (recurRule && !dueDate) dueDate = iso(today);

  const title = timeResult.rest
    .replace(/__q(\d+)__/g, (_, i: string) => quoted[Number(i)])
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    dueDate,
    dueTime,
    priority,
    tags: [...new Set(tags)],
    projectName,
    recurRule,
  };
}
