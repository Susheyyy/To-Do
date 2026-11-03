import { invoke } from "@tauri-apps/api/core";

import type { Project, Section, Task, TaskInput } from "../types/models";

export const api = {
  createTask: (input: TaskInput) => invoke<Task>("create_task", { input }),
  updateTask: (id: string, input: TaskInput) => invoke<Task>("update_task", { id, input }),
  setTaskCompleted: (id: string, done: boolean) => invoke<Task>("set_task_completed", { id, done }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),
  addSubtask: (taskId: string, title: string) => invoke<Task>("add_subtask", { taskId, title }),
  toggleSubtask: (taskId: string, subtaskId: string, done: boolean) =>
    invoke<Task>("toggle_subtask", { taskId, subtaskId, done }),
  listOpenTasks: () => invoke<Task[]>("list_open_tasks"),
  listToday: (today: string) => invoke<Task[]>("list_today", { today }),
  listOverdue: (today: string) => invoke<Task[]>("list_overdue", { today }),
  listTasksForProject: (projectId: string) => invoke<Task[]>("list_tasks_for_project", { projectId }),
  listCompletedBetween: (start: string, end: string) =>
    invoke<Task[]>("list_completed_between", { start, end }),
  listProjects: () => invoke<Project[]>("list_projects"),
  createProject: (name: string, color: string | null) =>
    invoke<Project>("create_project", { name, color }),
  createSection: (projectId: string, name: string) =>
    invoke<Section>("create_section", { projectId, name }),
  undo: () => invoke<string | null>("undo"),
  redo: () => invoke<string | null>("redo"),
};