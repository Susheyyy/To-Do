import { parseISO } from "date-fns";
import type { Task } from "../types/models";

const WEEKDAY_INDEX: Record<string, number> = {
  "every-sun": 0,
  "every-mon": 1,
  "every-tue": 2,
  "every-wed": 3,
  "every-thu": 4,
  "every-fri": 5,
  "every-sat": 6,
};

/**
 * Checks if a task occurs on a specific target date (YYYY-MM-DD).
 * For regular tasks, it checks `task.dueDate === targetDateStr`.
 * For recurring tasks, it checks if the target date is on/after task.dueDate and matches the recurrence schedule.
 */
export function taskOccursOnDate(task: Task, targetDateStr: string): boolean {
  if (!task.dueDate) return false;
  if (!task.recurRule) {
    return task.dueDate === targetDateStr;
  }

  // If recurring task's initial due date is in the future relative to target, it hasn't started yet
  if (task.dueDate > targetDateStr) return false;
  if (task.dueDate === targetDateStr) return true;

  const target = parseISO(targetDateStr);
  const start = parseISO(task.dueDate);
  const dayOfWeek = target.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

  switch (task.recurRule) {
    case "daily":
      return true;

    case "weekdays":
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case "weekends":
      return dayOfWeek === 0 || dayOfWeek === 6;

    case "weekly":
      return dayOfWeek === start.getDay();

    case "monthly":
      return target.getDate() === start.getDate();

    default:
      if (task.recurRule.startsWith("every-")) {
        const expectedDay = WEEKDAY_INDEX[task.recurRule];
        return expectedDay !== undefined && dayOfWeek === expectedDay;
      }
      return false;
  }
}

