'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarState = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

/** Estado del sidebar — persistido en localStorage */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      toggle: () => set({ collapsed: !get().collapsed }),
      setCollapsed: (v) => set({ collapsed: v }),
    }),
    { name: 'santaisabel.sidebar' },
  ),
);
