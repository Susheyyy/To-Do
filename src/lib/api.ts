import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { Habit, HabitInput, HabitLog, Project, Section, Task, TaskInput } from "../types/models";

// Detect if running inside desktop Tauri shell or mobile/tablet browser / PWA
export const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

// In-memory fallback database for mobile/tablet PWA runs outside Tauri desktop
const mockStorage = {
  tasks: [] as Task[],
  projects: [] as Project[],
  habits: [] as Habit[],
  logs: [] as HabitLog[],
};

// Safe invoke wrapper
async function safeInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri) {
    return tauriInvoke<T>(cmd, args);
  }

  // Mobile / Web Browser Fallback handler
  console.debug(`[Web/PWA Fallback] executing mock command: ${cmd}`, args);

  switch (cmd) {
    case "list_open_tasks":
      return mockStorage.tasks.filter((t) => !t.completedAt) as unknown as T;
    case "list_today":
      return mockStorage.tasks.filter((t) => !t.completedAt) as unknown as T;
    case "list_overdue":
      return [] as unknown as T;
    case "list_projects":
      return mockStorage.projects as unknown as T;
    case "list_habits":
      return mockStorage.habits as unknown as T;
    case "list_habit_logs":
      return mockStorage.logs as unknown as T;
    case "create_task": {
      const input = (args.input as TaskInput) || {};
      const newTask: Task = {
        id: "web_" + Math.random().toString(36).slice(2, 9),
        title: input.title || "",
        notes: input.notes ?? null,
        priority: input.priority || "none",
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        completedAt: null,
        projectId: input.projectId ?? null,
        sectionId: input.sectionId ?? null,
        tags: input.tags || [],
        subtasks: [],
        recurRule: input.recurRule ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockStorage.tasks.push(newTask);
      return newTask as unknown as T;
    }
    case "set_task_completed": {
      const id = args.id as string;
      const done = args.done as boolean;
      const t = mockStorage.tasks.find((item) => item.id === id);
      if (t) {
        t.completedAt = done ? new Date().toISOString() : null;
      }
      return (t || {}) as unknown as T;
    }
    case "get_sync_status":
      return {
        enabled: true,
        server_url: "http://localhost:4040",
        device_id: "mobile_web_device",
        unsynced_count: 0,
        last_synced_at: null,
      } as unknown as T;
    case "set_sync_config":
    case "mark_synced":
    case "update_tray_badge":
    case "hide_window":
    case "start_dragging":
      return undefined as unknown as T;
    default:
      return [] as unknown as T;
  }
}

export const api = {
  createTask: (input: TaskInput) => safeInvoke<Task>("create_task", { input }),
  updateTask: (id: string, input: TaskInput) => safeInvoke<Task>("update_task", { id, input }),
  setTaskCompleted: (id: string, done: boolean) => safeInvoke<Task>("set_task_completed", { id, done }),
  deleteTask: (id: string) => safeInvoke<void>("delete_task", { id }),
  addSubtask: (taskId: string, title: string) => safeInvoke<Task>("add_subtask", { taskId, title }),
  toggleSubtask: (taskId: string, subtaskId: string, done: boolean) =>
    safeInvoke<Task>("toggle_subtask", { taskId, subtaskId, done }),
  listOpenTasks: () => safeInvoke<Task[]>("list_open_tasks"),
  listToday: (today: string) => safeInvoke<Task[]>("list_today", { today }),
  listOverdue: (today: string) => safeInvoke<Task[]>("list_overdue", { today }),
  listTasksForProject: (projectId: string) => safeInvoke<Task[]>("list_tasks_for_project", { projectId }),
  listCompletedBetween: (start: string, end: string) =>
    safeInvoke<Task[]>("list_completed_between", { start, end }),
  listProjects: () => safeInvoke<Project[]>("list_projects"),
  createProject: (name: string, color: string | null) => safeInvoke<Project>("create_project", { name, color }),
  updateProject: (id: string, name: string, color: string | null) =>
    safeInvoke<void>("update_project", { id, name, color }),
  deleteProject: (id: string) => safeInvoke<void>("delete_project", { id }),
  createSection: (projectId: string, name: string) => safeInvoke<Section>("create_section", { projectId, name }),
  renameSection: (id: string, name: string) => safeInvoke<void>("rename_section", { id, name }),
  deleteSection: (id: string) => safeInvoke<void>("delete_section", { id }),
  undo: () => safeInvoke<string | null>("undo"),
  redo: () => safeInvoke<string | null>("redo"),
  updateTrayBadge: (count: number) => safeInvoke<void>("update_tray_badge", { count }),
  hideWindow: (label: string) => safeInvoke<void>("hide_window", { label }),
  startDragging: (label: string) => safeInvoke<void>("start_dragging", { label }),
  listHabits: () => safeInvoke<Habit[]>("list_habits"),
  createHabit: (input: HabitInput) => safeInvoke<Habit>("create_habit", { input }),
  updateHabit: (id: string, input: HabitInput) => safeInvoke<Habit>("update_habit", { id, input }),
  deleteHabit: (id: string) => safeInvoke<void>("delete_habit", { id }),
  logHabit: (habitId: string, date: string) => safeInvoke<HabitLog>("log_habit", { habitId, date }),
  unlogHabit: (habitId: string, date: string) => safeInvoke<void>("unlog_habit", { habitId, date }),
  listHabitLogs: (start: string, end: string) => safeInvoke<HabitLog[]>("list_habit_logs", { start, end }),
  createBackup: () => safeInvoke<string>("create_backup"),
  exportJson: () => safeInvoke<string>("export_json"),
  exportCsv: () => safeInvoke<string>("export_csv"),
  generateRecurring: () => safeInvoke<number>("generate_recurring"),
  rescheduleOverdue: (targetDate: string) =>
    safeInvoke<number>("reschedule_overdue", { targetDate }),
  listTrash: () => safeInvoke<Task[]>("list_trash"),
  restoreTask: (id: string) => safeInvoke<void>("restore_task", { id }),
  permanentDeleteTask: (id: string) => safeInvoke<void>("permanent_delete_task", { id }),
  emptyTrash: () => safeInvoke<number>("empty_trash"),
  searchTasksFts: (query: string) => safeInvoke<Task[]>("search_tasks_fts", { query }),
  getSyncStatus: () =>
    safeInvoke<{
      enabled: boolean;
      server_url: string | null;
      device_id: string;
      unsynced_count: number;
      last_synced_at: string | null;
    }>("get_sync_status"),
  setSyncConfig: (enabled: boolean, serverUrl?: string | null) =>
    safeInvoke<void>("set_sync_config", { enabled, serverUrl: serverUrl ?? null }),
  getUnsyncedItems: (limit?: number) =>
    safeInvoke<
      {
        id: number;
        entity_type: string;
        entity_id: string;
        op_type: string;
        payload: string | null;
        client_timestamp: string;
      }[]
    >("get_unsynced_items", { limit }),
  markSynced: (ids: number[], timestamp: string) =>
    safeInvoke<void>("mark_synced", { ids, timestamp }),
  setTrayClickAction: (action: string) =>
    safeInvoke<void>("set_tray_click_action", { action }),
  applySyncChanges: (
    changes: {
      entity_type: string;
      entity_id: string;
      op_type: string;
      payload: string | null;
      updated_at: string;
    }[]
  ) => safeInvoke<number>("apply_sync_changes", { changes }),
};
