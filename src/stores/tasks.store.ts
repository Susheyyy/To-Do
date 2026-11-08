import { addDays, format, startOfDay } from "date-fns";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";

import { api } from "../lib/api";
import { nextProjectSlot } from "../lib/projectColors";
import { syncTaskToGoogle } from "../lib/googleCalendar";
import type { Priority, Project, Task, TaskInput } from "../types/models";

export const todayIso = () => format(new Date(), "yyyy-MM-dd");

export function toInput(task: Task, patch: Partial<TaskInput> = {}): TaskInput {
  return {
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    projectId: task.projectId,
    sectionId: task.sectionId,
    tags: task.tags,
    recurRule: task.recurRule,
    ...patch,
  };
}

interface TasksState {
  open: Task[];
  today: Task[];
  overdue: Task[];
  completedToday: Task[];
  projects: Project[];
  error: string | null;
  version: number;
  load: () => Promise<void>;
  createTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, done: boolean) => Promise<void>;
  createProject: (name: string) => Promise<string>;
  ensureProject: (name: string) => Promise<string>;
  updateProject: (id: string, name: string, color: string | null) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createSection: (projectId: string, name: string) => Promise<void>;
  renameSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tag: string) => Promise<void>;
  rescheduleOverdue: () => Promise<void>;
  batchToggle: (ids: string[], done: boolean) => Promise<void>;
  batchDelete: (ids: string[]) => Promise<void>;
  batchReschedule: (ids: string[], dueDate: string | null) => Promise<void>;
  batchSetPriority: (ids: string[], priority: Priority) => Promise<void>;
  batchMoveProject: (ids: string[], projectId: string | null) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export const useTasks = create<TasksState>((set, get) => {
  const guard = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (err) {
      set({ error: String(err) });
      return;
    }
    set({ error: null });
    await get().load();
  };

  return {
    open: [],
    today: [],
    overdue: [],
    completedToday: [],
    projects: [],
    error: null,
    version: 0,
    load: async () => {
      const day = todayIso();
      const dayStart = startOfDay(new Date()).toISOString();
      const dayEnd = startOfDay(addDays(new Date(), 1)).toISOString();
      const [open, today, overdue, completedToday, projects] = await Promise.all([
        api.listOpenTasks(),
        api.listToday(day),
        api.listOverdue(day),
        api.listCompletedBetween(dayStart, dayEnd),
        api.listProjects(),
      ]);
      set({ open, today, overdue, completedToday, projects, version: get().version + 1 });
    },
    createTask: (input) =>
      guard(async () => {
        const id = input.id || "task_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        const taskPayload = { ...input, id };
        await api.createTask(taskPayload);
        void syncTaskToGoogle({
          id,
          title: input.title,
          notes: input.notes ?? null,
          priority: input.priority,
          dueDate: input.dueDate ?? null,
          dueTime: input.dueTime ?? null,
          projectId: input.projectId ?? null,
          sectionId: input.sectionId ?? null,
          tags: input.tags ?? [],
          recurRule: input.recurRule ?? null,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subtasks: [],
        });
      }),
    updateTask: (id, input) => guard(() => api.updateTask(id, input)),
    toggleTask: async (task) => {
      const willBeDone = task.completedAt === null;
      const nowIso = new Date().toISOString();
      const updatedTask: Task = {
        ...task,
        completedAt: willBeDone ? nowIso : null,
      };

      
      const prevOpen = get().open;
      const prevToday = get().today;
      const prevOverdue = get().overdue;
      const prevCompleted = get().completedToday;

      if (willBeDone) {
        set({
          open: prevOpen.filter((t) => t.id !== task.id),
          today: prevToday.filter((t) => t.id !== task.id),
          overdue: prevOverdue.filter((t) => t.id !== task.id),
          completedToday: [updatedTask, ...prevCompleted.filter((t) => t.id !== task.id)],
        });
      } else {
        const isToday = task.dueDate === todayIso();
        const isOverdue = task.dueDate !== null && task.dueDate < todayIso();
        set({
          open: [updatedTask, ...prevOpen.filter((t) => t.id !== task.id)],
          today: isToday ? [updatedTask, ...prevToday.filter((t) => t.id !== task.id)] : prevToday,
          overdue: isOverdue ? [updatedTask, ...prevOverdue.filter((t) => t.id !== task.id)] : prevOverdue,
          completedToday: prevCompleted.filter((t) => t.id !== task.id),
        });
      }

      
      try {
        await api.setTaskCompleted(task.id, willBeDone);
      } catch (err) {
        set({
          open: prevOpen,
          today: prevToday,
          overdue: prevOverdue,
          completedToday: prevCompleted,
          error: String(err),
        });
      }
    },
    deleteTask: (id) => guard(() => api.deleteTask(id)),
    addSubtask: (taskId, title) => guard(() => api.addSubtask(taskId, title)),
    toggleSubtask: (taskId, subtaskId, done) => guard(() => api.toggleSubtask(taskId, subtaskId, done)),
    createProject: async (name) => {
      const created = await api.createProject(name, nextProjectSlot(get().projects.length));
      await get().load();
      return created.id;
    },
    ensureProject: async (name) => {
      const existing = get().projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      return get().createProject(name);
    },
    updateProject: (id, name, color) => guard(() => api.updateProject(id, name, color)),
    deleteProject: (id) => guard(() => api.deleteProject(id)),
    createSection: (projectId, name) => guard(() => api.createSection(projectId, name)),
    renameSection: (id, name) => guard(() => api.renameSection(id, name)),
    deleteSection: (id) => guard(() => api.deleteSection(id)),
    renameTag: (oldTag: string, newTag: string) =>
      guard(async () => {
        const cleanOld = oldTag.trim().toLowerCase();
        const cleanNew = newTag.trim().toLowerCase();
        if (!cleanNew || cleanOld === cleanNew) return;
        const matchingTasks = get().open.filter((t) => t.tags.includes(cleanOld));
        for (const task of matchingTasks) {
          const updatedTags = Array.from(
            new Set(task.tags.map((t) => (t === cleanOld ? cleanNew : t)))
          );
          await api.updateTask(task.id, toInput(task, { tags: updatedTags }));
        }
      }),
    deleteTag: (tag: string) =>
      guard(async () => {
        const clean = tag.trim().toLowerCase();
        const matchingTasks = get().open.filter((t) => t.tags.includes(clean));
        for (const task of matchingTasks) {
          const updatedTags = task.tags.filter((t) => t !== clean);
          await api.updateTask(task.id, toInput(task, { tags: updatedTags }));
        }
      }),
    rescheduleOverdue: () =>
      guard(async () => {
        await api.rescheduleOverdue(todayIso());
      }),
    batchToggle: (ids, done) =>
      guard(async () => {
        for (const id of ids) {
          await api.setTaskCompleted(id, done);
        }
      }),
    batchDelete: (ids) =>
      guard(async () => {
        for (const id of ids) {
          await api.deleteTask(id);
        }
      }),
    batchReschedule: (ids, dueDate) =>
      guard(async () => {
        const allTasks = [...get().open, ...get().today, ...get().overdue];
        for (const id of ids) {
          const t = allTasks.find((item) => item.id === id);
          if (t) {
            await api.updateTask(id, toInput(t, { dueDate }));
          }
        }
      }),
    batchSetPriority: (ids, priority) =>
      guard(async () => {
        const allTasks = [...get().open, ...get().today, ...get().overdue];
        for (const id of ids) {
          const t = allTasks.find((item) => item.id === id);
          if (t) {
            await api.updateTask(id, toInput(t, { priority }));
          }
        }
      }),
    batchMoveProject: (ids, projectId) =>
      guard(async () => {
        const allTasks = [...get().open, ...get().today, ...get().overdue];
        for (const id of ids) {
          const t = allTasks.find((item) => item.id === id);
          if (t) {
            await api.updateTask(id, toInput(t, { projectId, sectionId: null }));
          }
        }
      }),
    undo: () => guard(() => api.undo()),
    redo: () => guard(() => api.redo()),
  };
});

let debounceLoadTimer: any = null;

if (typeof window !== "undefined") {
  listen("tasks-changed", () => {

    if (debounceLoadTimer) clearTimeout(debounceLoadTimer);
    debounceLoadTimer = setTimeout(() => {
      void useTasks.getState().load();
    }, 120);
  }).catch(() => {});
}