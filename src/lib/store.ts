"use client";

import { create } from "zustand";

export interface HistoryEntry {
  toolId: string;
  input: string;
  at: number;
}

interface MathLabState {
  /** active view: "home" or a tool id */
  view: string;
  /** increments on every openTool call to force remount of the tool component */
  viewNonce: number;
  /** query pre-filled into the tool when opened */
  pendingInput?: string;
  history: HistoryEntry[];
  searchOpen: boolean;
  goHome: () => void;
  openTool: (id: string, pendingInput?: string) => void;
  setSearchOpen: (open: boolean) => void;
  pushHistory: (entry: HistoryEntry) => void;
}

export const useMathLab = create<MathLabState>((set) => ({
  view: "home",
  viewNonce: 0,
  history: [],
  searchOpen: false,
  goHome: () => set({ view: "home", pendingInput: undefined }),
  openTool: (id, pendingInput) => set((s) => ({
    view: id,
    viewNonce: s.viewNonce + 1,
    pendingInput,
    history: s.history.length === 0 || s.history[0].toolId !== id || s.history[0].input !== pendingInput
      ? [{ toolId: id, input: pendingInput ?? "", at: Date.now() }, ...s.history].slice(0, 12)
      : s.history,
  })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  pushHistory: (entry) =>
    set((s) => ({
      history: [{ ...entry }, ...s.history].slice(0, 12),
    })),
}));
