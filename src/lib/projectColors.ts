import type { ThemeId } from "../styles/themes";

const PALETTES: Record<ThemeId, string[]> = {
  kawaii: ["#f4a6c8", "#e58bb5", "#c77dd6", "#a88be0", "#f7c6dc", "#d9a3c9"],
  cat: ["#f9a875", "#f08a4b", "#d9793a", "#f5c49b", "#b86a3d", "#ffb88c"],
  bunny: ["#7fd1ae", "#3fb08a", "#ffb3c7", "#f08fa8", "#a6e3c8", "#5fbf9b"],
  night: ["#b59cff", "#8c73e6", "#6f5bd1", "#d0c3ff", "#5a4aa8", "#9d8cf0"],
  office: ["#2563eb", "#1d4ed8", "#3b82f6", "#475569", "#6b7280", "#93c5fd"],
  forest: ["#6b8f4e", "#4d7a3a", "#8fae6e", "#3d6130", "#a7c48a", "#2f4f24"],
  ocean: ["#3fa7d6", "#2b87b5", "#58c4dd", "#1d6f93", "#7fd3e8", "#0e5a7a"],
  retro: ["#ff8c42", "#1e8a85", "#ffb36b", "#2fa39c", "#e0603a", "#0f6b67"],
  mono: ["#ffffff", "#d4d4d4", "#a3a3a3", "#737373", "#525252", "#e5e5e5"],
};

export const PROJECT_SLOTS = 6;

export function projectColor(themeId: ThemeId, slot: string | null): string {
  const index = Number(slot ?? 0) % PROJECT_SLOTS;
  return PALETTES[themeId][index];
}

export function nextProjectSlot(existingCount: number): string {
  return String(existingCount % PROJECT_SLOTS);
}

export const TAG_COLORS: Record<string, string> = {
  red: "#e0556e",
  orange: "#f08a4b",
  amber: "#f2b84b",
  green: "#4caf7a",
  teal: "#2ec4b6",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
  brown: "#a0785a",
  grey: "#7b8794",
  charcoal: "#1f2937",
};