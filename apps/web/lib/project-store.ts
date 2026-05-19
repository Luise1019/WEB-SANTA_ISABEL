'use client';

import { create } from 'zustand';

type ActiveProject = {
  id: string;
  name: string;
  code: string;
  status: string;
  city: string;
};

type ProjectState = {
  activeProject: ActiveProject | null;
  recentProjects: ActiveProject[];
  setActiveProject: (p: ActiveProject) => void;
  clearActiveProject: () => void;
};

/** Store liviano para el proyecto actualmente abierto.
 *  Se usa en el breadcrumb, sidebar switcher y header. */
export const useProjectStore = create<ProjectState>()((set, get) => ({
  activeProject: null,
  recentProjects: [],

  setActiveProject: (p) => {
    const recent = get().recentProjects;
    const filtered = recent.filter((r) => r.id !== p.id);
    set({
      activeProject: p,
      recentProjects: [p, ...filtered].slice(0, 5), // max 5 recientes
    });
  },

  clearActiveProject: () => set({ activeProject: null }),
}));
