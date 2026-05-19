'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

export type GanttTask = {
  id: string;
  code: string;
  name: string;
  kind: 'SUMMARY' | 'TASK' | 'MILESTONE';
  plannedStart: string;
  plannedEnd: string;
  durationDays: number;
  progress: string | number;
  parentId?: string | null;
  isCritical: boolean;
  totalFloat?: number | null;
  predecessors?: Array<{ predecessorId: string; type: string; lagDays: number }>;
};

type ViewMode = 'week' | 'month' | 'quarter';

function getWeekNum(d: Date): number {
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
}

const VIEW_CONFIGS = {
  week:    { label: 'Semana',     colWidthPx: 28, unitDays: 7,  fmt: (d: Date) => `S${getWeekNum(d)}'${String(d.getFullYear()).slice(2)}` },
  month:   { label: 'Mes',       colWidthPx: 64, unitDays: 30, fmt: (d: Date) => d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }) },
  quarter: { label: 'Trimestre', colWidthPx: 96, unitDays: 91, fmt: (d: Date) => `T${Math.ceil((d.getMonth() + 1) / 3)}-${d.getFullYear()}` },
} as const;

const ROW_H = 34;
const LEFT_W = 264;
const HEADER_H = 48;

function dateOnly(d: Date | string): Date {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function GanttChart({
  tasks,
  onTaskDateChange,
}: {
  tasks: GanttTask[];
  projectId: string;
  onTaskDateChange?: (taskId: string, start: Date, end: Date, durationDays: number) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [dragging, setDragging] = useState<{
    taskId: string;
    type: 'move' | 'resize-end' | 'resize-start';
    startX: number;
    origStart: Date;
    origEnd: Date;
    origDur: number;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const cfg = VIEW_CONFIGS[viewMode];

  // Only show top-level summaries + tasks (not nested summaries without children for clarity)
  const visibleTasks = useMemo(() => tasks, [tasks]);

  // ── Timeline boundaries ──────────────────────────────────────
  const { timelineStart, totalTimelineDays, columns, totalPx } = useMemo(() => {
    if (visibleTasks.length === 0) {
      const ts = dateOnly(new Date());
      return { timelineStart: ts, totalTimelineDays: 365, columns: [] as Date[], totalPx: 365 * 2 };
    }
    const allDates = visibleTasks.flatMap((t) => [dateOnly(t.plannedStart), dateOnly(t.plannedEnd)]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    const ts = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const te = addDays(maxDate, 30);
    const totalDays = diffDays(ts, te) || 1;
    const cols: Date[] = [];
    let cur = new Date(ts);
    while (cur < te) { cols.push(new Date(cur)); cur = addDays(cur, cfg.unitDays); }
    const px = cols.length * cfg.colWidthPx;
    return { timelineStart: ts, totalTimelineDays: totalDays, columns: cols, totalPx: px };
  }, [visibleTasks, viewMode]);

  const dateToPx = useCallback((d: Date): number =>
    Math.round((diffDays(timelineStart, dateOnly(d)) / totalTimelineDays) * totalPx),
    [timelineStart, totalTimelineDays, totalPx]
  );

  // ── Drag ─────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent, taskId: string, type: 'move' | 'resize-end' | 'resize-start') => {
    e.preventDefault(); e.stopPropagation();
    const t = visibleTasks.find((x) => x.id === taskId);
    if (!t) return;
    setDragging({ taskId, type, startX: e.clientX,
      origStart: dateOnly(t.plannedStart), origEnd: dateOnly(t.plannedEnd), origDur: t.durationDays });
    setDragDelta(0);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    setDragDelta(Math.round((dx / totalPx) * totalTimelineDays));
  };
  const onMouseUp = () => {
    if (!dragging || !onTaskDateChange) { setDragging(null); setDragDelta(0); return; }
    const delta = dragDelta;
    let newStart = dragging.origStart, newEnd = dragging.origEnd, newDur = dragging.origDur;
    if (dragging.type === 'move') { newStart = addDays(dragging.origStart, delta); newEnd = addDays(dragging.origEnd, delta); }
    else if (dragging.type === 'resize-end') { newEnd = addDays(dragging.origEnd, delta); newDur = Math.max(1, diffDays(newStart, newEnd)); }
    else { newStart = addDays(dragging.origStart, delta); newDur = Math.max(1, diffDays(newStart, newEnd)); }
    onTaskDateChange(dragging.taskId, newStart, newEnd, newDur);
    setDragging(null); setDragDelta(0);
  };

  const todayPx = dateToPx(new Date());
  const svgHeight = HEADER_H + visibleTasks.length * ROW_H + 8;

  // Dependency arrows
  const arrows = useMemo(() => {
    const idxMap = new Map(visibleTasks.map((t, i) => [t.id, i]));
    const result: { x1: number; y1: number; x2: number; y2: number; crit: boolean }[] = [];
    for (const t of visibleTasks) {
      if (!t.predecessors) continue;
      for (const dep of t.predecessors) {
        const pi = idxMap.get(dep.predecessorId); const si = idxMap.get(t.id);
        if (pi === undefined || si === undefined) continue;
        const pred = visibleTasks[pi]!;
        result.push({
          x1: dateToPx(dateOnly(pred.plannedEnd)), y1: HEADER_H + pi * ROW_H + ROW_H / 2,
          x2: dateToPx(dateOnly(t.plannedStart)), y2: HEADER_H + si * ROW_H + ROW_H / 2,
          crit: pred.isCritical && t.isCritical,
        });
      }
    }
    return result;
  }, [visibleTasks, dateToPx]);

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* View mode controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(VIEW_CONFIGS) as ViewMode[]).map((m) => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {VIEW_CONFIGS[m].label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-5 rounded-sm bg-red-400" />Crítica</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-5 rounded-sm bg-blue-400" />Normal</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-5 rounded-sm bg-indigo-400" />Resumen</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rotate-45 bg-amber-400" />Hito</span>
        </span>
      </div>

      {/* Gantt */}
      <div className="flex overflow-hidden rounded-lg border border-border text-xs">
        {/* Name column */}
        <div className="flex-shrink-0 border-r border-border bg-card" style={{ width: LEFT_W }}>
          <div className="flex items-center border-b border-border px-3 font-semibold text-muted-foreground"
            style={{ height: HEADER_H }}>
            Actividad
          </div>
          {visibleTasks.map((t, i) => (
            <div key={t.id}
              className={`flex items-center border-b border-border/40 px-2 ${
                t.kind === 'SUMMARY' ? 'bg-indigo-50/50 font-semibold text-indigo-800' :
                t.isCritical ? 'text-red-700' : 'text-foreground'
              } ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}
              style={{ height: ROW_H }}>
              <span className="truncate" style={{ paddingLeft: t.parentId ? 14 : 0 }} title={`${t.code} ${t.name}`}>
                {t.kind === 'MILESTONE' ? '◆ ' : t.kind === 'SUMMARY' ? '▸ ' : '  '}
                <span className="text-muted-foreground mr-1">{t.code}</span>{t.name}
              </span>
            </div>
          ))}
        </div>

        {/* SVG timeline */}
        <div className="overflow-x-auto flex-1">
          <svg ref={svgRef} width={Math.max(totalPx, 400)} height={svgHeight}
            style={{ display: 'block', cursor: dragging ? 'ew-resize' : 'default', userSelect: 'none' }}
            onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

            {/* Column headers + vertical gridlines */}
            {columns.map((col, ci) => {
              const x = ci * cfg.colWidthPx;
              return (
                <g key={ci}>
                  <rect x={x} y={0} width={cfg.colWidthPx} height={HEADER_H}
                    fill={ci % 2 === 0 ? '#f8fafc' : '#f1f5f9'} />
                  <text x={x + cfg.colWidthPx / 2} y={HEADER_H / 2 + 5}
                    textAnchor="middle" fontSize={9} fill="#64748b">{cfg.fmt(col)}</text>
                  <line x1={x} y1={0} x2={x} y2={svgHeight} stroke="#e2e8f0" strokeWidth={0.5} />
                </g>
              );
            })}
            {/* Header bottom border */}
            <line x1={0} y1={HEADER_H} x2={totalPx} y2={HEADER_H} stroke="#cbd5e1" strokeWidth={1} />

            {/* Row backgrounds */}
            {visibleTasks.map((t, i) => (
              <rect key={`bg-${t.id}`} x={0} y={HEADER_H + i * ROW_H} width={Math.max(totalPx, 400)} height={ROW_H}
                fill={t.kind === 'SUMMARY' ? 'rgba(238,242,255,0.5)' : i % 2 !== 0 ? 'rgba(241,245,249,0.4)' : 'transparent'} />
            ))}
            {/* Row dividers */}
            {visibleTasks.map((_, i) => (
              <line key={`hl-${i}`} x1={0} y1={HEADER_H + i * ROW_H} x2={Math.max(totalPx, 400)} y2={HEADER_H + i * ROW_H}
                stroke="#e2e8f0" strokeWidth={0.4} />
            ))}

            {/* Arrow markers */}
            <defs>
              <marker id="arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L0,5 L5,2.5 z" fill="#94a3b8" />
              </marker>
              <marker id="arr-c" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L0,5 L5,2.5 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Dependency arrows */}
            {arrows.map((a, i) => {
              const mx = a.x1 + Math.max(16, (a.x2 - a.x1) * 0.4);
              return (
                <path key={i}
                  d={`M${a.x1},${a.y1} C${mx},${a.y1} ${mx},${a.y2} ${a.x2},${a.y2}`}
                  fill="none" stroke={a.crit ? '#ef4444' : '#94a3b8'} strokeWidth={1.2}
                  strokeDasharray={a.crit ? undefined : '4,2'}
                  markerEnd={a.crit ? 'url(#arr-c)' : 'url(#arr)'} opacity={0.75} />
              );
            })}

            {/* Task bars */}
            {visibleTasks.map((t, i) => {
              let barStart = dateOnly(t.plannedStart);
              let barEnd   = dateOnly(t.plannedEnd);
              if (dragging?.taskId === t.id) {
                if (dragging.type === 'move')         { barStart = addDays(barStart, dragDelta); barEnd = addDays(barEnd, dragDelta); }
                else if (dragging.type === 'resize-end')   { barEnd   = addDays(barEnd, dragDelta); }
                else                                       { barStart = addDays(barStart, dragDelta); }
              }
              const bx = dateToPx(barStart);
              const bw = Math.max(t.kind === 'MILESTONE' ? 0 : 4, dateToPx(barEnd) - bx);
              const by = HEADER_H + i * ROW_H + 6;
              const bh = ROW_H - 12;
              const prog = Math.max(0, Math.min(1, Number(t.progress)));

              if (t.kind === 'MILESTONE') {
                const cy = HEADER_H + i * ROW_H + ROW_H / 2;
                const s = 8;
                return (
                  <polygon key={t.id}
                    points={`${bx},${cy - s} ${bx + s},${cy} ${bx},${cy + s} ${bx - s},${cy}`}
                    fill={t.isCritical ? '#ef4444' : '#f59e0b'} stroke="white" strokeWidth={1.5} />
                );
              }

              const isSummary = t.kind === 'SUMMARY';
              const fill = isSummary ? '#6366f1' : t.isCritical ? '#ef4444' : '#3b82f6';

              return (
                <g key={t.id}>
                  {/* Track */}
                  <rect x={bx} y={by} width={bw} height={bh} rx={isSummary ? 2 : 3}
                    fill={fill} fillOpacity={isSummary ? 0.12 : 0.15}
                    stroke={fill} strokeWidth={isSummary ? 2 : 1}
                    style={{ cursor: onTaskDateChange && !isSummary ? 'grab' : 'default' }}
                    onMouseDown={(e) => onTaskDateChange && !isSummary && onMouseDown(e, t.id, 'move')} />
                  {/* Progress fill */}
                  {prog > 0 && (
                    <rect x={bx} y={by} width={Math.max(2, bw * prog)} height={bh} rx={isSummary ? 2 : 3}
                      fill={fill} fillOpacity={0.65} style={{ pointerEvents: 'none' }} />
                  )}
                  {/* Drag handles */}
                  {onTaskDateChange && !isSummary && bw > 14 && (
                    <>
                      <rect x={bx} y={by} width={6} height={bh} rx={2}
                        fill={fill} fillOpacity={0.4} cursor="w-resize"
                        onMouseDown={(e) => onMouseDown(e, t.id, 'resize-start')} />
                      <rect x={bx + bw - 6} y={by} width={6} height={bh} rx={2}
                        fill={fill} fillOpacity={0.4} cursor="e-resize"
                        onMouseDown={(e) => onMouseDown(e, t.id, 'resize-end')} />
                    </>
                  )}
                  {/* Progress label */}
                  {bw > 44 && prog > 0 && (
                    <text x={bx + 8} y={by + bh / 2 + 4} fontSize={9}
                      fill={isSummary ? '#4338ca' : 'white'} fontWeight={600}
                      style={{ pointerEvents: 'none' }}>
                      {Math.round(prog * 100)}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Today line */}
            {todayPx >= 0 && todayPx <= Math.max(totalPx, 400) && (
              <g>
                <line x1={todayPx} y1={HEADER_H} x2={todayPx} y2={svgHeight}
                  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3" />
                <text x={todayPx + 3} y={HEADER_H - 6} fontSize={9} fill="#f59e0b" fontWeight="600">Hoy</text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
