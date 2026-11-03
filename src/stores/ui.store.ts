import { create } from "zustand";

export type ListId = "inbox" | "today" | "upcoming";
export type ViewId = ListId | "settings" | `project:${string}`;
export type Layout = "list" | "board";
export type SortKey = "manual" | "priority" | "due" | "name";

interface UiState {
  view: ViewId;
  setView: (view: ViewId) => void;
  layout: Layout;
  setLayout: (layout: Layout) => void;
  showCompleted: boolean;
  setShowCompleted: (on: boolean) => void;
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  quickAddOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  selectedTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
}

export const useUi = create<UiState>((set) => ({
  view: "today",
  setView: (view) => set({ view }),
  layout: "list",
  setLayout: (layout) => set({ layout }),
  showCompleted: false,
  setShowCompleted: (showCompleted) => set({ showCompleted }),
  sort: "manual",
  setSort: (sort) => set({ sort }),
  quickAddOpen: false,
  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
  selectedTaskId: null,
  openTask: (id) => set({ selectedTaskId: id }),
  closeTask: () => set({ selectedTaskId: null }),
}));