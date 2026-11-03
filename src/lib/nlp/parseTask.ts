import { addDays, format, startOfDay } from "date-fns";

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

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(${MONTH_PATTERN})\\b(?:\\s+(\\d{4}))?`, "i");
const MONTH_DAY = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?`, "i");

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function monthDate(day: number, monthWord: string, year: number | undefined, today: Date): string | null {
  const month = MONTHS[monthWord.toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;

  let d = new Date(year ?? today.getFullYear(), month, day);
  if (d.getMonth() !== month) return null;
  if (year === undefined && d < startOfDay(today)) {
    d = new Date(today.getFullYear() + 1, month, day);
  }
  return iso(d);
}

function extractDate(text: string, today: Date): { date: string | null; rest: string } {
  const exact = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (exact) return { date: exact[1], rest: text.replace(exact[0], " ") };

  const relative = text.match(/\b(today|tomorrow|tmrw|tmr)\b/i);
  if (relative) {
    const offset = relative[1].toLowerCase() === "today" ? 0 : 1;
    return { date: iso(addDays(today, offset)), rest: text.replace(relative[0], " ") };
  }

  const inN = text.match(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/i);
  if (inN) {
    const days = Number(inN[1]) * (inN[2].toLowerCase().startsWith("week") ? 7 : 1);
    return { date: iso(addDays(today, days)), rest: text.replace(inN[0], " ") };
  }

  const nextWeek = text.match(/\bnext\s+week\b/i);
  if (nextWeek) return { date: iso(addDays(today, 7)), rest: text.replace(nextWeek[0], " ") };

  const weekday = text.match(/\b(on|next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (weekday) {
    const marker = weekday[1].toLowerCase();
    const target = WEEKDAYS.indexOf(weekday[2].toLowerCase());
    let diff = (target - today.getDay() + 7) % 7;
    if (marker === "next" && diff === 0) diff = 7;
    return { date: iso(addDays(today, diff)), rest: text.replace(weekday[0], " ") };
  }

  const dayMonth = text.match(DAY_MONTH);
  if (dayMonth) {
    const date = monthDate(Number(dayMonth[1]), dayMonth[2], dayMonth[3] ? Number(dayMonth[3]) : undefined, today);
    if (date) return { date, rest: text.replace(dayMonth[0], " ") };
  }

  const monthDay = text.match(MONTH_DAY);
  if (monthDay) {
    const date = monthDate(Number(monthDay[2]), monthDay[1], monthDay[3] ? Number(monthDay[3]) : undefined, today);
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

export function parseTask(raw: string, today: Date = new Date()): ParsedTask {
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

  const dateResult = extractDate(text, today);
  const timeResult = extractTime(dateResult.rest);
  const dueTime = timeResult.time;
  let dueDate = dateResult.date;
  if (dueTime && !dueDate) dueDate = iso(today);

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
  };
}