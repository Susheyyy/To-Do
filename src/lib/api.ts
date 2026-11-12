import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { Habit, HabitInput, HabitLog, Project, Section, Priority, Task, TaskInput } from "../types/models";


export const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);


const STORAGE_KEY_TASKS = "todo_pwa_tasks";
const STORAGE_KEY_PROJECTS = "todo_pwa_projects";
const STORAGE_KEY_HABITS = "todo_pwa_habits";
const STORAGE_KEY_LOGS = "todo_pwa_logs";

function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const mockStorage = {
  tasks: loadLocal<Task[]>(STORAGE_KEY_TASKS, []),
  projects: loadLocal<Project[]>(STORAGE_KEY_PROJECTS, []),
  habits: loadLocal<Habit[]>(STORAGE_KEY_HABITS, []),
  logs: loadLocal<HabitLog[]>(STORAGE_KEY_LOGS, []),
};


async function safeInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri) {
    return tauriInvoke<T>(cmd, args);
  }


  console.debug(`[Web/PWA Fallback] executing mock command: ${cmd}`, args);

  switch (cmd) {
    case "list_open_tasks":
      return mockStorage.tasks.filter((t) => !t.completedAt) as unknown as T;
    case "list_today":
      return mockStorage.tasks.filter((t) => !t.completedAt && t.dueDate === args.today) as unknown as T;
    case "list_overdue": {
      const today = args.today as string;
      return mockStorage.tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today) as unknown as T;
    }
    case "list_completed_between": {
      const start = Date.parse(args.start as string);
      const end = Date.parse(args.end as string);
      return mockStorage.tasks.filter((t) => {
        const completed = t.completedAt ? Date.parse(t.completedAt) : NaN;
        return completed >= start && completed < end;
      }) as unknown as T;
    }
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
      const tasks = [...mockStorage.tasks, newTask];
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
      mockStorage.tasks = tasks;
      return newTask as unknown as T;
    }
    case "batch_tasks": {
      const ids = new Set(args.ids as string[]);
      const action = args.action as BatchTaskAction;
      const selected = mockStorage.tasks.filter((task) => ids.has(task.id));
      if (selected.length !== ids.size) throw new Error("A selected task no longer exists.");
      const now = new Date().toISOString();
      const updates = new Map(selected.map((task) => {
        const next = { ...task, updatedAt: now };
        switch (action.kind) {
          case "complete": next.completedAt = action.done ? now : null; break;
          case "reschedule": next.dueDate = action.dueDate; break;
          case "setPriority": next.priority = action.priority; break;
          case "move": next.projectId = action.projectId; next.sectionId = null; break;
        }
        return [task.id, next];
      }));
      const tasks = action.kind === "delete"
        ? mockStorage.tasks.filter((task) => !ids.has(task.id))
        : mockStorage.tasks.map((task) => updates.get(task.id) ?? task);
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
      mockStorage.tasks = tasks;
      return (action.kind === "delete" ? [] : [...updates.values()]) as unknown as T;
    }
    case "list_tasks_for_project":
      return mockStorage.tasks.filter((task) => task.projectId === args.projectId) as unknown as T;
    case "search_tasks_fts": {
      const query = String(args.query).trim().toLowerCase();
      return mockStorage.tasks.filter((task) =>
        [task.title, task.notes, ...task.tags].some((field) => field?.toLowerCase().includes(query))
      ) as unknown as T;
    }
    case "set_task_completed": {
      const task = mockStorage.tasks.find((item) => item.id === args.id);
      if (!task) throw new Error("Task no longer exists.");
      const now = new Date().toISOString();
      const updated = { ...task, updatedAt: now, completedAt: args.done ? now : null };
      const tasks = mockStorage.tasks.map((item) => item.id === task.id ? updated : item);
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
      mockStorage.tasks = tasks;
      return { task: updated, nextTask: null } as unknown as T;
    }
    case "get_sync_status":
      return {
        enabled: false,
        server_url: null,
        device_id: "mobile_web_device",
        unsynced_count: 0,
        last_synced_at: null,
        pull_cursor: null,
        quarantined_count: 0,
      } as unknown as T;
    case "set_sync_config":
    case "mark_synced":
    case "update_tray_badge":
    case "hide_window":
    case "start_dragging":
      return undefined as unknown as T;
    default:
      throw new Error(`This action requires the desktop app (${cmd}).`);
  }
}

export type BatchTaskAction =
  | { kind: "complete"; done: boolean }
  | { kind: "delete" }
  | { kind: "reschedule"; dueDate: string | null }
  | { kind: "setPriority"; priority: Priority }
  | { kind: "move"; projectId: string | null };

export const api = {
  batchTasks: (ids: string[], action: BatchTaskAction) => safeInvoke<Task[]>("batch_tasks", { ids, action }),
  createTask: (input: TaskInput) => safeInvoke<Task>("create_task", { input }),
  updateTask: (id: string, input: TaskInput) => safeInvoke<Task>("update_task", { id, input }),
  setTaskCompleted: (id: string, done: boolean) => safeInvoke<{ task: Task; nextTask: Task | null }>("set_task_completed", { id, done }),
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
  getCalendarChanges: () =>
    safeInvoke<{ changes: { revision: number; taskId: string; task: Task | null }[]; error: string | null }>("get_calendar_changes"),
  acknowledgeCalendarChange: (revision: number) =>
    safeInvoke<void>("acknowledge_calendar_change", { revision }),
  deferCalendarChange: (revision: number, error: string) =>
    safeInvoke<void>("defer_calendar_change", { revision, error }),
  createBackup: () => safeInvoke<string>("create_backup"),
  exportJson: () => safeInvoke<string>("export_json"),
  exportCsv: () => safeInvoke<string>("export_csv"),
  exportIcal: () => safeInvoke<string>("export_ical"),
  generateRecurring: () => safeInvoke<number>("generate_recurring"),
  rescheduleOverdue: (targetDate: string) =>
    safeInvoke<Task[]>("reschedule_overdue", { targetDate }),
  searchTasksFts: (query: string) => safeInvoke<Task[]>("search_tasks_fts", { query }),
  getSyncStatus: () =>
    safeInvoke<{
      enabled: boolean;
      server_url: string | null;
      device_id: string;
      unsynced_count: number;
      last_synced_at: string | null;
      pull_cursor: string | null;
      quarantined_count: number;
    }>("get_sync_status"),
  setSyncConfig: (enabled: boolean | null, serverUrl?: string, groupId?: string) =>
    safeInvoke<void>("set_sync_config", { enabled, serverUrl: serverUrl ?? null, groupId: groupId ?? null }),
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
    }[],
    cursor: string,
  ) => safeInvoke<number>("apply_sync_changes", { changes, cursor }),
};
