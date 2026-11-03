import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ClockFormat = "12h" | "24h";

interface SettingsState {
  clock: ClockFormat;
  setClock: (clock: ClockFormat) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  quietHoursEnabled: boolean;
  setQuietHoursEnabled: (enabled: boolean) => void;
  quietHoursStart: string;
  setQuietHoursStart: (time: string) => void;
  quietHoursEnd: string;
  setQuietHoursEnd: (time: string) => void;
  morningBriefingEnabled: boolean;
  setMorningBriefingEnabled: (enabled: boolean) => void;
  morningBriefingTime: string;
  setMorningBriefingTime: (time: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      clock: "12h",
      setClock: (clock) => set({ clock }),
      notificationsEnabled: true,
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      quietHoursEnabled: false,
      setQuietHoursEnabled: (quietHoursEnabled) => set({ quietHoursEnabled }),
      quietHoursStart: "22:00",
      setQuietHoursStart: (quietHoursStart) => set({ quietHoursStart }),
      quietHoursEnd: "08:00",
      setQuietHoursEnd: (quietHoursEnd) => set({ quietHoursEnd }),
      morningBriefingEnabled: true,
      setMorningBriefingEnabled: (morningBriefingEnabled) => set({ morningBriefingEnabled }),
      morningBriefingTime: "09:00",
      setMorningBriefingTime: (morningBriefingTime) => set({ morningBriefingTime }),
    }),
    { name: "todo.settings" }
  )
);
