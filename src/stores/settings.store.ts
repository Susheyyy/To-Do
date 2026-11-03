import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ClockFormat = "12h" | "24h";

interface SettingsState {
  clock: ClockFormat;
  setClock: (clock: ClockFormat) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      clock: "12h",
      setClock: (clock) => set({ clock }),
    }),
    { name: "todo.settings" }
  )
);