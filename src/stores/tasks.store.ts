import { addDays, format, startOfDay } from "date-fns";
import { create } from "zustand";

import { api } from "../lib/api";
import { nextProjectSlot } from "../lib/projectColors";
import type { Project, Task, TaskInput } from "../types/models";

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
  rescheduleOverdue: () => Promise<void>;
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
    createTask: (input) => guard(() => api.createTask(input)),
    updateTask: (id, input) => guard(() => api.updateTask(id, input)),
    toggleTask: (task) => guard(() => api.setTaskCompleted(task.id, task.completedAt === null)),
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
    rescheduleOverdue: () =>
      guard(async () => {
        for (const task of get().overdue) {
          await api.updateTask(task.id, toInput(task, { dueDate: todayIso() }));
        }
      }),
    undo: () => guard(() => api.undo()),
    redo: () => guard(() => api.redo()),
  };
});