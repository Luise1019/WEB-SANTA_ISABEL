'use client';

import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { useState } from 'react';

type ApiTask = {
  id: string;
  code: string;
  name: string;
  kind: string;
  plannedStart: string;
  plannedEnd: string;
  durationDays: number;
  progress: string | number;
  parentId?: string | null;
  isCritical: boolean;
};

function toGanttTask(t: ApiTask): GanttTask {
  return {
    id: t.id,
    name: `${t.code} ${t.name}`,
    start: new Date(t.plannedStart),
    end: new Date(t.plannedEnd),
    progress: Math.round(Number(t.progress)),
    type: t.kind === 'MILESTONE' ? 'milestone' : t.kind === 'SUMMARY' ? 'project' : 'task',
    project: t.parentId ?? undefined,
    isDisabled: false,
    styles: {
      progressColor: t.isCritical ? '#ef4444' : '#3b82f6',
      progressSelectedColor: t.isCritical ? '#dc2626' : '#2563eb',
      backgroundColor: t.isCritical ? '#fca5a5' : '#93c5fd',
      backgroundSelectedColor: t.isCritical ? '#f87171' : '#60a5fa',
    },
  };
}

const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'Día', value: ViewMode.Day },
  { label: 'Semana', value: ViewMode.Week },
  { label: 'Mes', value: ViewMode.Month },
];

export default function GanttChart({
  tasks,
  projectId: _projectId,
}: {
  tasks: ApiTask[];
  projectId: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);

  if (tasks.length === 0) return null;

  const ganttTasks = tasks.map(toGanttTask);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {VIEW_MODES.map((m) => (
          <button
            key={m.value}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === m.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            onClick={() => setViewMode(m.value)}
          >
            {m.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-300"></span>
          Ruta crítica
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-300"></span>
          Normal
        </span>
      </div>
      <div className="min-h-[300px]">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          locale="es"
          listCellWidth="180px"
          columnWidth={viewMode === ViewMode.Day ? 40 : viewMode === ViewMode.Week ? 80 : 120}
          ganttHeight={Math.min(400, 50 + tasks.length * 40)}
          onProgressChange={(_task) => {
            // handled by table inline edit
          }}
        />
      </div>
    </div>
  );
}
