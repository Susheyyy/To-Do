import { addDays, format } from "date-fns";

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
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function parseTask(raw: string, today: Date = new Date()): ParsedTask {
  let text = raw;
  const tags: string[] = [];
  let projectName: string | null = null;
  let priority: Priority = "medium";

  text = text.replace(/(^|\s)@([\w-]+)/g, (_, space: string, tag: string) => {
    tags.push(tag.toLowerCase());
    return space;
  });

  text = text.replace(/(^|\s)#([\w-]+)/g, (_, space: string, name: string) => {
    projectName = name;
    return space;
  });

  text = text.replace(/(^|\s)!(high|medium|med|low)\b/gi, (_, space: string, word: string) => {
    priority = PRIORITY_WORDS[word.toLowerCase()];
    return space;
  });

  let dueDate: string | null = null;
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const relative = text.match(/\b(today|tomorrow)\b/i);
  const weekday = text.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);

  if (iso) {
    dueDate = iso[1];
    text = text.replace(iso[0], " ");
  } else if (relative) {
    const offset = relative[1].toLowerCase() === "tomorrow" ? 1 : 0;
    dueDate = format(addDays(today, offset), "yyyy-MM-dd");
    text = text.replace(relative[0], " ");
  } else if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[2].toLowerCase());
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    dueDate = format(addDays(today, diff), "yyyy-MM-dd");
    text = text.replace(weekday[0], " ");
  }

  let dueTime: string | null = null;
  const twelveHour = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const twentyFourHour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const meridiem = twelveHour[3].toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    dueTime = `${String(hour).padStart(2, "0")}:${twelveHour[2] ?? "00"}`;
    text = text.replace(twelveHour[0], " ");
  } else if (twentyFourHour) {
    dueTime = `${twentyFourHour[1].padStart(2, "0")}:${twentyFourHour[2]}`;
    text = text.replace(twentyFourHour[0], " ");
  }

  if (dueTime && !dueDate) {
    dueDate = format(today, "yyyy-MM-dd");
  }

  return {
    title: text.replace(/\s+/g, " ").trim(),
    dueDate,
    dueTime,
    priority,
    tags: [...new Set(tags)],
    projectName,
  };
}