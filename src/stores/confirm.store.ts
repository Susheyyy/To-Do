import { create } from "zustand";

interface ConfirmState {
  message: string | null;
  resolve: ((ok: boolean) => void) | null;
  ask: (message: string) => Promise<boolean>;
  answer: (ok: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  message: null,
  resolve: null,
  ask: (message) => new Promise<boolean>((resolve) => set({ message, resolve })),
  answer: (ok) => {
    get().resolve?.(ok);
    set({ message: null, resolve: null });
  },
}));