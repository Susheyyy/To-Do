import { create } from "zustand";
import { persist } from "zustand/middleware";
import { emit, listen } from "@tauri-apps/api/event";

export type ClockFormat = "12h" | "24h";

interface SettingsState {
  clock: ClockFormat;
  setClock: (clock: ClockFormat) => void;
  dailyGoal: number;
  setDailyGoal: (goal: number) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
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
  floatingBarPosition: { x: number; y: number } | null;
  setFloatingBarPosition: (pos: { x: number; y: number } | null) => void;
  trayClickAction: "quick-capture" | "floating-bar" | "main";
  setTrayClickAction: (action: "quick-capture" | "floating-bar" | "main") => void;
}

let isBroadcasting = false;

function broadcastSettings(patch: Partial<SettingsState>) {
  if (isBroadcasting) return;
  emit("settings-changed", patch).catch(() => {});
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      clock: "12h",
      setClock: (clock) => {
        set({ clock });
        broadcastSettings({ clock });
      },
      dailyGoal: 5,
      setDailyGoal: (dailyGoal) => {
        set({ dailyGoal });
        broadcastSettings({ dailyGoal });
      },
      notificationsEnabled: true,
      setNotificationsEnabled: (notificationsEnabled) => {
        set({ notificationsEnabled });
        broadcastSettings({ notificationsEnabled });
      },
      soundEnabled: true,
      setSoundEnabled: (soundEnabled) => {
        set({ soundEnabled });
        broadcastSettings({ soundEnabled });
      },
      quietHoursEnabled: false,
      setQuietHoursEnabled: (quietHoursEnabled) => {
        set({ quietHoursEnabled });
        broadcastSettings({ quietHoursEnabled });
      },
      quietHoursStart: "22:00",
      setQuietHoursStart: (quietHoursStart) => {
        set({ quietHoursStart });
        broadcastSettings({ quietHoursStart });
      },
      quietHoursEnd: "08:00",
      setQuietHoursEnd: (quietHoursEnd) => {
        set({ quietHoursEnd });
        broadcastSettings({ quietHoursEnd });
      },
      morningBriefingEnabled: true,
      setMorningBriefingEnabled: (morningBriefingEnabled) => {
        set({ morningBriefingEnabled });
        broadcastSettings({ morningBriefingEnabled });
      },
      morningBriefingTime: "09:00",
      setMorningBriefingTime: (morningBriefingTime) => {
        set({ morningBriefingTime });
        broadcastSettings({ morningBriefingTime });
      },
      floatingBarPosition: null,
      setFloatingBarPosition: (floatingBarPosition) => {
        set({ floatingBarPosition });
        broadcastSettings({ floatingBarPosition });
      },
      trayClickAction: "quick-capture",
      setTrayClickAction: (trayClickAction) => {
        set({ trayClickAction });
        broadcastSettings({ trayClickAction });
      },
    }),
    { name: "todo.settings" }
  )
);


listen<Partial<SettingsState>>("settings-changed", (event) => {
  if (event.payload && typeof event.payload === "object") {
    isBroadcasting = true;
    useSettings.setState(event.payload);
    isBroadcasting = false;
  }
}).catch(() => {});

