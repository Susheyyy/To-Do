import { create } from "zustand";

import type { Priority } from "../types/models";

export type ListId = "inbox" | "today" | "upcoming" | "search" | "filters";
export type ViewId = ListId | "settings" | `project:${string}` | `tag:${string}`;
export type Layout = "list" | "board" | "calendar";
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
  filterPriority: Priority | "all";
  setFilterPriority: (p: Priority | "all") => void;
  filterTag: string | "all";
  setFilterTag: (t: string | "all") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
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
  filterPriority: "all",
  setFilterPriority: (filterPriority) => set({ filterPriority }),
  filterTag: "all",
  setFilterTag: (filterTag) => set({ filterTag }),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  quickAddOpen: false,
  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
  selectedTaskId: null,
  openTask: (id) => set({ selectedTaskId: id }),
  closeTask: () => set({ selectedTaskId: null }),
}));