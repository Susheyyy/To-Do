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