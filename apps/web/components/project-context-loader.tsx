'use client';

import { useEffect } from 'react';

import { api } from '@/lib/api-client';
import { useProjectStore } from '@/lib/project-store';

type Props = { projectId: string };

/**
 * Componente invisible que carga los datos del proyecto activo
 * y los guarda en el ProjectStore para que el breadcrumb y el
 * sidebar switcher puedan mostrar el nombre real.
 */
export function ProjectContextLoader({ projectId }: Props) {
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const activeProject = useProjectStore((s) => s.activeProject);

  useEffect(() => {
    // Si ya tenemos este proyecto en caché, no re-fetch
    if (activeProject?.id === projectId) return;

    api.getProject(projectId)
      .then((data) => {
        const p = data as unknown as {
          id: string; name: string; code: string; status: string; city: string;
        };
        setActiveProject({
          id: p.id,
          name: p.name,
          code: p.code,
          status: p.status ?? '',
          city: p.city ?? '',
        });
      })
      .catch(() => {
        // Silencioso — el breadcrumb mostrará "Proyecto" como fallback
      });
  }, [projectId, activeProject?.id, setActiveProject]);

  return null;
}
