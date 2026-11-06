import { invoke } from "@tauri-apps/api/core";

import type { Habit, HabitInput, HabitLog, Project, Section, Task, TaskInput } from "../types/models";

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
  createProject: (name: string, color: string | null) => invoke<Project>("create_project", { name, color }),
  updateProject: (id: string, name: string, color: string | null) =>
    invoke<void>("update_project", { id, name, color }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),
  createSection: (projectId: string, name: string) => invoke<Section>("create_section", { projectId, name }),
  renameSection: (id: string, name: string) => invoke<void>("rename_section", { id, name }),
  deleteSection: (id: string) => invoke<void>("delete_section", { id }),
  undo: () => invoke<string | null>("undo"),
  redo: () => invoke<string | null>("redo"),
  updateTrayBadge: (count: number) => invoke<void>("update_tray_badge", { count }),
  hideWindow: (label: string) => invoke<void>("hide_window", { label }),
  startDragging: (label: string) => invoke<void>("start_dragging", { label }),
  listHabits: () => invoke<Habit[]>("list_habits"),
  createHabit: (input: HabitInput) => invoke<Habit>("create_habit", { input }),
  updateHabit: (id: string, input: HabitInput) => invoke<Habit>("update_habit", { id, input }),
  deleteHabit: (id: string) => invoke<void>("delete_habit", { id }),
  logHabit: (habitId: string, date: string) => invoke<HabitLog>("log_habit", { habitId, date }),
  unlogHabit: (habitId: string, date: string) => invoke<void>("unlog_habit", { habitId, date }),
  listHabitLogs: (start: string, end: string) => invoke<HabitLog[]>("list_habit_logs", { start, end }),
  createBackup: () => invoke<string>("create_backup"),
  exportJson: () => invoke<string>("export_json"),
  exportCsv: () => invoke<string>("export_csv"),
  generateRecurring: () => invoke<number>("generate_recurring"),
};