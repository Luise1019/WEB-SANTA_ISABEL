import { Injectable } from '@nestjs/common';

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface CpmTask {
  id: string;
  duration: number; // working days
  predecessors: Array<{
    predecessorId: string;
    type: DependencyType;
    lag: number; // can be negative (lead)
  }>;
  successors: Array<{
    successorId: string;
    type: DependencyType;
    lag: number;
  }>;
}

export interface CpmResult {
  id: string;
  es: number; // Early Start
  ef: number; // Early Finish
  ls: number; // Late Start
  lf: number; // Late Finish
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

/**
 * Critical Path Method — forward/backward pass.
 *
 * Supports FS / SS / FF / SF dependencies with positive/negative lag.
 *
 * Time unit: integer "day numbers" starting at 0.
 *   ES=0 means "starts at beginning of day 0".
 *   EF = ES + duration (exclusive end: EF=5 means ends at end of day 4).
 *
 * Dependency constraints:
 *   FS: succ.ES = pred.EF + lag
 *   SS: succ.ES = pred.ES + lag
 *   FF: succ.EF = pred.EF + lag  → succ.ES = pred.EF + lag - succ.dur
 *   SF: succ.EF = pred.ES + lag  → succ.ES = pred.ES + lag - succ.dur
 */
@Injectable()
export class CpmService {
  /**
   * Compute CPM on the given task list.
   * Returns one CpmResult per task, keyed by task id.
   */
  compute(tasks: CpmTask[]): Map<string, CpmResult> {
    if (tasks.length === 0) return new Map();

    const taskMap = new Map<string, CpmTask>(tasks.map((t) => [t.id, t]));

    // ── Topological sort (Kahn's algorithm) ────────────────────
    const inDegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));
    for (const t of tasks) {
      for (const dep of t.predecessors) {
        inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
      }
    }

    // Rebuild in-degree from successor edges to avoid double-count
    const inDeg2 = new Map<string, number>(tasks.map((t) => [t.id, 0]));
    for (const t of tasks) {
      for (const s of t.successors) {
        inDeg2.set(s.successorId, (inDeg2.get(s.successorId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDeg2) {
      if (deg === 0) queue.push(id);
    }

    const topoOrder: string[] = [];
    const tempDeg = new Map(inDeg2);
    while (queue.length > 0) {
      const id = queue.shift()!;
      topoOrder.push(id);
      const task = taskMap.get(id)!;
      for (const s of task.successors) {
        const d = (tempDeg.get(s.successorId) ?? 1) - 1;
        tempDeg.set(s.successorId, d);
        if (d === 0) queue.push(s.successorId);
      }
    }

    // If cycle detected, fall back to natural order (graceful)
    const order = topoOrder.length === tasks.length ? topoOrder : tasks.map((t) => t.id);

    // ── Forward pass ────────────────────────────────────────────
    const ES = new Map<string, number>();
    const EF = new Map<string, number>();

    for (const id of order) {
      const task = taskMap.get(id)!;
      let es = 0;

      for (const dep of task.predecessors) {
        const predEF = EF.get(dep.predecessorId) ?? 0;
        const predES = ES.get(dep.predecessorId) ?? 0;

        let constraint: number;
        switch (dep.type) {
          case 'FS':
            constraint = predEF + dep.lag;
            break;
          case 'SS':
            constraint = predES + dep.lag;
            break;
          case 'FF':
            constraint = predEF + dep.lag - task.duration;
            break;
          case 'SF':
            constraint = predES + dep.lag - task.duration;
            break;
        }
        es = Math.max(es, constraint);
      }

      ES.set(id, es);
      EF.set(id, es + task.duration);
    }

    // Project end = max EF
    const projectEnd = Math.max(...Array.from(EF.values()));

    // ── Backward pass ───────────────────────────────────────────
    const LS = new Map<string, number>();
    const LF = new Map<string, number>();

    for (const id of [...order].reverse()) {
      const task = taskMap.get(id)!;
      let lf = projectEnd;

      for (const s of task.successors) {
        const succLS = LS.get(s.successorId) ?? projectEnd;
        const succLF = LF.get(s.successorId) ?? projectEnd;
        const succDur = taskMap.get(s.successorId)?.duration ?? 0;

        let constraint: number;
        switch (s.type) {
          case 'FS':
            constraint = succLS - s.lag;
            break;
          case 'SS':
            constraint = succLS - s.lag + task.duration;
            break;
          case 'FF':
            constraint = succLF - s.lag;
            break;
          case 'SF':
            constraint = succLS - s.lag + succDur;
            break;
        }
        lf = Math.min(lf, constraint);
      }

      LF.set(id, lf);
      LS.set(id, lf - task.duration);
    }

    // ── Float & critical path ───────────────────────────────────
    const results = new Map<string, CpmResult>();

    for (const task of tasks) {
      const es = ES.get(task.id) ?? 0;
      const ef = EF.get(task.id) ?? 0;
      const ls = LS.get(task.id) ?? 0;
      const lf = LF.get(task.id) ?? 0;
      const totalFloat = ls - es;

      // Free float: how much task can delay without affecting earliest successor
      let minSuccES = Infinity;
      for (const s of task.successors) {
        const succES = ES.get(s.successorId);
        if (succES !== undefined) {
          let earliest: number;
          switch (s.type) {
            case 'FS':
              earliest = succES;
              break;
            case 'SS':
              earliest = succES + task.duration;
              break;
            case 'FF':
              earliest = succES + task.duration;
              break;
            case 'SF':
              earliest = succES + task.duration;
              break;
          }
          minSuccES = Math.min(minSuccES, earliest);
        }
      }
      const freeFloat = isFinite(minSuccES) ? minSuccES - ef : totalFloat;

      results.set(task.id, {
        id: task.id,
        es,
        ef,
        ls,
        lf,
        totalFloat,
        freeFloat: Math.max(0, freeFloat),
        isCritical: totalFloat <= 0,
      });
    }

    return results;
  }
}
