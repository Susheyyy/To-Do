import { create } from "zustand";

export type ListId = "inbox" | "today" | "upcoming";
export type ViewId = ListId | "settings" | `project:${string}`;
export type Layout = "list" | "board";

interface UiState {
  view: ViewId;
  setView: (view: ViewId) => void;
  layout: Layout;
  setLayout: (layout: Layout) => void;
  quickAddOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
}

export const useUi = create<UiState>((set) => ({
  view: "today",
  setView: (view) => set({ view }),
  layout: "list",
  setLayout: (layout) => set({ layout }),
  quickAddOpen: false,
  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
}));