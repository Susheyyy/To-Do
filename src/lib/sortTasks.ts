import type { SortKey } from "../stores/ui.store";
import type { Priority, Task } from "../types/models";

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  const list = [...tasks];
  switch (sort) {
    case "priority":
      return list.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
    case "due":
      return list.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    case "name":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return list;
  }
}