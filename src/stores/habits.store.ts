import { create } from "zustand";
import { api } from "../lib/api";
import type { Habit, HabitInput, HabitLog } from "../types/models";

interface HabitsState {
  habits: Habit[];
  logs: HabitLog[];
  load: () => Promise<void>;
  loadLogs: (start: string, end: string) => Promise<void>;
  createHabit: (input: HabitInput) => Promise<void>;
  updateHabit: (id: string, input: HabitInput) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  logHabit: (habitId: string, date: string) => Promise<void>;
  unlogHabit: (habitId: string, date: string) => Promise<void>;
}

export const useHabits = create<HabitsState>((set, get) => ({
  habits: [],
  logs: [],
  load: async () => {
    const habits = await api.listHabits();
    set({ habits });
  },
  loadLogs: async (start, end) => {
    const logs = await api.listHabitLogs(start, end);
    set({ logs });
  },
  createHabit: async (input) => {
    await api.createHabit(input);
    await get().load();
  },
  updateHabit: async (id, input) => {
    await api.updateHabit(id, input);
    await get().load();
  },
  deleteHabit: async (id) => {
    await api.deleteHabit(id);
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  },
  logHabit: async (habitId, date) => {
    await api.logHabit(habitId, date);
    const logs = await api.listHabitLogs(date, date);
    set((s) => ({
      logs: [...s.logs.filter((l) => !(l.habitId === habitId && l.loggedDate === date)), ...logs],
    }));
  },
  unlogHabit: async (habitId, date) => {
    await api.unlogHabit(habitId, date);
    set((s) => ({
      logs: s.logs.filter((l) => !(l.habitId === habitId && l.loggedDate === date)),
    }));
  },
}));

