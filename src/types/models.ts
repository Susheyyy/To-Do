export type Priority = "high" | "medium" | "low" | "none";

export interface Subtask {
  id: string;
  title: string;
  completedAt: string | null;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  completedAt: string | null;
  projectId: string | null;
  sectionId: string | null;
  tags: string[];
  subtasks: Subtask[];
  recurRule: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  notes: string | null;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  projectId: string | null;
  sectionId: string | null;
  tags: string[];
  recurRule: string | null;
}

export interface Section {
  id: string;
  projectId: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  color: string | null;
  sections: Section[];
}

export type HabitFrequency = "daily" | "weekdays" | "weekly" | "custom";

export interface Habit {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  frequency: HabitFrequency;
  customDays: string | null;
  targetStreak: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitInput {
  name: string;
  color: string | null;
  icon: string | null;
  frequency: HabitFrequency;
  customDays: string | null;
  targetStreak: number;
}

export interface HabitLog {
  id: string;
  habitId: string;
  loggedDate: string;
  createdAt: string;
}