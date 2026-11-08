import { differenceInCalendarDays, parseISO, format } from "date-fns";

export interface RelativeDueInfo {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  colorClass: string;
}

export function getRelativeDueDate(dateStr: string | null): RelativeDueInfo | null {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    const diff = differenceInCalendarDays(d, now);

    if (diff < 0) {
      const daysAgo = Math.abs(diff);
      return {
        label: daysAgo === 1 ? "Yesterday" : `${daysAgo}d overdue`,
        isOverdue: true,
        isToday: false,
        isTomorrow: false,
        colorClass: "badge-overdue",
      };
    }
    if (diff === 0) {
      return {
        label: "Today",
        isOverdue: false,
        isToday: true,
        isTomorrow: false,
        colorClass: "badge-today",
      };
    }
    if (diff === 1) {
      return {
        label: "Tomorrow",
        isOverdue: false,
        isToday: false,
        isTomorrow: true,
        colorClass: "badge-tomorrow",
      };
    }
    if (diff <= 7) {
      return {
        label: `In ${diff}d`,
        isOverdue: false,
        isToday: false,
        isTomorrow: false,
        colorClass: "badge-soon",
      };
    }
    return {
      label: format(d, "d MMM"),
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      colorClass: "badge-normal",
    };
  } catch {
    return null;
  }
}
